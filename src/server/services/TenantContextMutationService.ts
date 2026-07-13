import { planBootstrap, BootstrapDecisionCode, resolveLegacyMembershipCandidates } from './TenantBootstrapPlanner.js';
import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { planInvitationAcceptance, normalizeInvitationEmail, InvitationAcceptanceInput } from './InvitationAcceptancePlanner.js';
import { resolveCanonicalInvitationCapacity, normalizeInvitationTemporalMs } from './InvitationAcceptanceServerPolicy.js';



// Helper to verify Firebase ID token
async function verifyToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

// ... other implementations



export async function bootstrapUserContext(req: Request, res: Response) {
  const uid = await verifyToken(req);
  if (!uid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const db = getFirestore();
  const auth = getAuth();

  let userEmail: string | null = null;
  let userDisplayName: string | null = null;
  let userPhotoURL: string | null = null;
  try {
    const userRecord = await auth.getUser(uid);
    userEmail = userRecord.email || null;
    userDisplayName = userRecord.displayName || null;
    userPhotoURL = userRecord.photoURL || null;
  } catch (e) {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }

  const parseTimeMs = (val: any): number | undefined => {
    if (!val) return undefined;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.getTime === 'function') return val.getTime();
    if (typeof val === 'number') return val;
    return undefined;
  };

  const bootstrapNowMs = Date.now();

  try {
    const result = await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      let userData = userSnap.data();

      // Check lock
      const lockRef = db.collection('tenantBootstrapLocks').doc(uid);
      const lockSnap = await t.get(lockRef);
      const lockData = lockSnap.data();
      
      let lockExists = lockSnap.exists;
      let lockCompleted = lockExists && lockData?.status === 'completed';
      let lockOrgId = lockData?.organizationId;
      let lockOrgExists = false;
      let lockOrgActive = false;
      let lockMemberExists = false;
      let lockMemberActive = false;

      if (lockCompleted && lockOrgId) {
        const checkOrg = await t.get(db.collection('organizations').doc(lockOrgId));
        if (checkOrg.exists) {
           lockOrgExists = true;
           lockOrgActive = checkOrg.data()?.status === 'active';
        }
        const checkMem = await t.get(db.collection(`organizations/${lockOrgId}/members`).doc(uid));
        if (checkMem.exists) {
           lockMemberExists = true;
           const st = checkMem.data()?.status;
           lockMemberActive = !st || st === 'active';
        }
      }

      const lockStatus = {
        exists: lockExists,
        completed: lockCompleted,
        organizationId: lockOrgId,
        orgExists: lockOrgExists,
        orgActive: lockOrgActive,
        memberExists: lockMemberExists,
        memberActive: lockMemberActive
      };

      // Get Canonical Memberships
      const membersQuery = await t.get(
        db.collectionGroup('members').where('uid', '==', uid)
      );
      const allCanonical = membersQuery.docs
        .filter(d => 
           d.id === uid && 
           d.ref.parent.id === 'members' && 
           d.ref.parent.parent?.parent?.id === 'organizations'
        )
        .map(d => ({ ...d.data(), organizationId: d.ref.parent.parent!.id } as any));

      const candidateCanonical = allCanonical.filter(m => !m.status || m.status === 'active');
      const validCanonical = [];
      for (const m of candidateCanonical) {
         const orgSnap = await t.get(db.collection('organizations').doc(m.organizationId));
         if (orgSnap.exists && orgSnap.data()?.status === 'active') {
            validCanonical.push(m);
         }
      }

      if (candidateCanonical.length > 0 && validCanonical.length === 0) {
         throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
      }

      // Get Legacy Memberships
      const legacyQueryUid = await t.get(db.collection('organization_members').where('uid', '==', uid));
      const legacyQueryUserId = await t.get(db.collection('organization_members').where('user_id', '==', uid));
      
      const rawLegacyCandidates: any[] = [];
      [...legacyQueryUid.docs, ...legacyQueryUserId.docs].forEach(d => {
         const data = d.data();
         if (data.organizationId) {
             rawLegacyCandidates.push({
                 organizationId: data.organizationId,
                 sourcePath: d.ref.path,
                 status: data.status,
                 role: data.role,
                 organizationRole: data.organizationRole,
                 createdAtMs: parseTimeMs(data.createdAt)
             });
         }
      });
      
      const resolveResult = resolveLegacyMembershipCandidates(rawLegacyCandidates);
      if (!resolveResult.ok) {
          throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
      }
      
      const validLegacy = [];
      for (const m of resolveResult.memberships) {
          const orgSnap = await t.get(db.collection('organizations').doc(m.organizationId));
          const orgValid = orgSnap.exists && orgSnap.data()?.status === 'active';
          if (!orgValid) {
              throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
          }
          validLegacy.push(m);
      }

      // Get Invites
      let pendingInvites: any[] = [];
      const normalizedEmail = userEmail?.toLowerCase().trim();
      if (normalizedEmail) {
        const iQ1 = await t.get(db.collectionGroup('invites').where('emailNormalized', '==', normalizedEmail).where('status', '==', 'pending'));
        const originalEmail = userEmail!.trim();
        const iQ2 = await t.get(db.collectionGroup('invites').where('email', '==', originalEmail).where('status', '==', 'pending'));
        const iQ3 = await t.get(db.collectionGroup('invites').where('email', '==', normalizedEmail).where('status', '==', 'pending'));
        
        const inviteMap = new Map();
        [...iQ1.docs, ...iQ2.docs, ...iQ3.docs].forEach(d => {
           inviteMap.set(d.ref.path, d.data());
        });
        
        pendingInvites = Array.from(inviteMap.values()).map((d: any) => ({
           email: d.email,
           emailNormalized: d.emailNormalized,
           status: d.status,
           expiresAtMs: parseTimeMs(d.expiresAt)
        }));
      }

      const userContext = {
        activeOrganizationId: userData?.activeOrganizationId,
        primaryOrganizationId: userData?.primaryOrganizationId,
        organizationId: userData?.organizationId,
      };

      
      const decision = planBootstrap(
        validCanonical,
        validLegacy,
        pendingInvites,
        userContext,
        lockStatus,
        userEmail,
        bootstrapNowMs
      );

      if (decision.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE) {
        throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
      }
      if (decision.code === BootstrapDecisionCode.AMBIGUOUS_LEGACY_MEMBERSHIP) {
        throw new Error('AMBIGUOUS_LEGACY_MEMBERSHIP');
      }
      if (decision.code === BootstrapDecisionCode.WAIT_FOR_INVITATION) {
        throw new Error('INVITATION_PENDING');
      }

      // Action execution
      if (decision.code === BootstrapDecisionCode.REUSE_BOOTSTRAP_LOCK || decision.code === BootstrapDecisionCode.REUSE_CANONICAL_MEMBERSHIP) {
        const orgId = decision.organizationId!;
        
        let finalPrimaryId = orgId;
        if (userData?.primaryOrganizationId && validCanonical.some(m => m.organizationId === userData.primaryOrganizationId)) {
           finalPrimaryId = userData.primaryOrganizationId;
        }

        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: orgId,
          primaryOrganizationId: finalPrimaryId,
          organizationId: orgId,
          organizations: FieldValue.arrayUnion(orgId),
          updatedAt: FieldValue.serverTimestamp()
        };
        
        if (!userSnap.exists) {
           t.set(userRef, { uid, email: userEmail, displayName: userDisplayName, photoURL: userPhotoURL, createdAt: FieldValue.serverTimestamp(), ...updates });
        } else {
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            activeOrganizationId: orgId,
            primaryOrganizationId: finalPrimaryId,
            organizationId: orgId,
            createdOrganization: false,
            reusedExistingContext: true,
            repairedLegacyMembership: false,
            reasonCode: decision.reasonCode
          }
        };
      }

      if (decision.code === BootstrapDecisionCode.REPAIR_LEGACY_MEMBERSHIP) {
        const orgId = decision.organizationId!;
        const legacyData = validLegacy.find(m => m.organizationId === orgId);
        
        const newMemberRef = db.doc(`organizations/${orgId}/members/${uid}`);
        
        const validTime = legacyData?.createdAtMs ? new Date(legacyData.createdAtMs) : FieldValue.serverTimestamp();
        
        t.set(newMemberRef, {
           uid,
           organizationId: orgId,
           role: legacyData?.sanitizedRole,
           organizationRole: legacyData?.sanitizedRole,
           status: 'active',
           createdAt: validTime,
           updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        const auditRef = db.collection(`organizations/${orgId}/audit_logs`).doc();
        t.set(auditRef, {
          action: 'tenant.bootstrap.legacy_membership_repaired',
          actorUid: uid,
          timestamp: FieldValue.serverTimestamp()
        });

        let finalPrimaryId = orgId;
        if (userData?.primaryOrganizationId && validCanonical.some(m => m.organizationId === userData.primaryOrganizationId)) {
           finalPrimaryId = userData.primaryOrganizationId;
        }

        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: orgId,
          primaryOrganizationId: finalPrimaryId,
          organizationId: orgId,
          organizations: FieldValue.arrayUnion(orgId),
          updatedAt: FieldValue.serverTimestamp()
        };

        if (!userSnap.exists) {
           t.set(userRef, { uid, email: userEmail, displayName: userDisplayName, photoURL: userPhotoURL, createdAt: FieldValue.serverTimestamp(), ...updates });
        } else {
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            activeOrganizationId: orgId,
            primaryOrganizationId: finalPrimaryId,
            organizationId: orgId,
            createdOrganization: false,
            reusedExistingContext: false,
            repairedLegacyMembership: true,
            reasonCode: decision.reasonCode
          }
        };
      }

      if (decision.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION) {
        const targetOrgRef = db.collection('organizations').doc();
        const targetOrgId = targetOrgRef.id;

        t.set(targetOrgRef, {
          id: targetOrgId,
          name: 'My Workspace',
          slug: targetOrgId,
          ownerUid: uid,
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        const memberRef = db.doc(`organizations/${targetOrgId}/members/${uid}`);
        t.set(memberRef, {
          uid,
          organizationId: targetOrgId,
          role: 'owner',
          organizationRole: 'owner',
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        const legacyMemberRef = db.doc(`organization_members/${uid}_${targetOrgId}`);
        t.set(legacyMemberRef, {
          uid,
          organizationId: targetOrgId,
          role: 'owner',
          organizationRole: 'owner',
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        t.set(lockRef, {
          uid,
          organizationId: targetOrgId,
          status: 'completed',
          version: 1,
          completedAt: FieldValue.serverTimestamp()
        });

        const auditRef = db.collection(`organizations/${targetOrgId}/audit_logs`).doc();
        t.set(auditRef, {
          action: 'tenant.bootstrap.personal_organization_created',
          actorUid: uid,
          timestamp: FieldValue.serverTimestamp()
        });

        let finalPrimaryId = targetOrgId;
        if (userData?.primaryOrganizationId && validCanonical.some(m => m.organizationId === userData.primaryOrganizationId)) {
           finalPrimaryId = userData.primaryOrganizationId;
        }

        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: targetOrgId,
          primaryOrganizationId: finalPrimaryId,
          organizationId: targetOrgId,
          organizations: FieldValue.arrayUnion(targetOrgId),
          updatedAt: FieldValue.serverTimestamp()
        };

        if (!userSnap.exists) {
           t.set(userRef, { 
             uid, 
             email: userEmail, 
             displayName: userDisplayName, 
             photoURL: userPhotoURL, 
             createdAt: FieldValue.serverTimestamp(), 
             ...updates 
           });
        } else {
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            activeOrganizationId: targetOrgId,
            primaryOrganizationId: finalPrimaryId,
            organizationId: targetOrgId,
            createdOrganization: true,
            reusedExistingContext: false,
            repairedLegacyMembership: false,
            reasonCode: decision.reasonCode
          }
        };
      }

      throw new Error('UNKNOWN_DECISION');
    });

    return res.status(result.status).json(result.payload);

  } catch (error: any) {
    const reason = error.message;
    if (reason === 'BOOTSTRAP_STATE_INCONSISTENT' || reason === 'AMBIGUOUS_LEGACY_MEMBERSHIP' || reason === 'INVITATION_PENDING') {
      return res.status(409).json({ success: false, reasonCode: reason });
    }
    console.error('Bootstrap error:', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export async function acceptInvitation(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const uid = decodedToken.uid;
    let authUser;
    try {
      authUser = await getAuth().getUser(uid);
    } catch (e) {
      return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
    }
    
    const normalizedAuthenticatedEmail = normalizeInvitationEmail(authUser.email);
    if (normalizedAuthenticatedEmail === null) {
      return res.status(400).json({ success: false, reasonCode: 'AUTHENTICATED_EMAIL_REQUIRED' });
    }

    const token = req.body?.token;
    if (typeof token !== 'string' || token.trim() === '') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_TOKEN' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const acceptanceNowMs = Date.now();
    const db = getFirestore();

    const result = await db.runTransaction(async (t) => {
      const invitesQuery = await t.get(
        db.collectionGroup('invites').where('tokenHash', '==', tokenHash)
      );

      const validInvites = invitesQuery.docs.filter(d => {
        const parts = d.ref.path.split('/');
        return parts.length === 4 && parts[0] === 'organizations' && parts[2] === 'invites';
      });

      if (validInvites.length === 0) {
         return { status: 404, data: { success: false, reasonCode: 'INVITE_NOT_FOUND' } };
      }
      if (validInvites.length > 1) {
         return { status: 409, data: { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' } };
      }

      const inviteDoc = validInvites[0];
      const inviteData = inviteDoc.data();
      const orgId = inviteDoc.ref.parent.parent!.id;

      if (Object.prototype.hasOwnProperty.call(inviteData, 'organizationId')) {
        if (typeof inviteData.organizationId !== 'string' || inviteData.organizationId !== orgId) {
          return { status: 409, data: { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' } };
        }
      }

      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await t.get(orgRef);

      const memRef = db.collection(`organizations/${orgId}/members`).doc(uid);
      const memSnap = await t.get(memRef);

      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);

      const subRef = db.collection('subscriptions').doc(orgId);
      const subSnap = await t.get(subRef);

      const allMemsQuery = await t.get(db.collection(`organizations/${orgId}/members`));
      const memberStatuses = allMemsQuery.docs.map(d => d.data().status);

      const subData = subSnap.data() || {};
      const orgData = orgSnap.data() || {};

      const capacityResult = resolveCanonicalInvitationCapacity({
        organizationId: orgId,
        subscription: {
           exists: subSnap.exists,
           organizationId: subData.organizationId,
           app: subData.app,
           status: subData.status,
           plan: subData.plan,
           limitsUsers: subData.limits?.users
        },
        organizationApp: {
           exists: orgSnap.exists && !!orgData.apps?.musicscale,
           status: orgData.apps?.musicscale?.status,
           plan: orgData.apps?.musicscale?.plan,
           limitsUsers: orgData.apps?.musicscale?.limits?.users
        },
        memberStatuses
      });

      if (capacityResult.success === false) {
         const code = capacityResult.reasonCode;
         const httpStatus = code === 'MEMBER_LIMIT_UNAVAILABLE' ? 503 : 409;
         return { status: httpStatus, data: { success: false, reasonCode: code } };
      }

      const expiresMs = normalizeInvitationTemporalMs(inviteData.expiresAt);
      let revokedMs = normalizeInvitationTemporalMs(inviteData.revokedAt);
      if (Object.prototype.hasOwnProperty.call(inviteData, 'revokedAt') && revokedMs === undefined) {
        revokedMs = acceptanceNowMs;
      }

      const input: InvitationAcceptanceInput = {
        identity: {
          uid: authUser.uid,
          email: authUser.email
        },
        organization: {
          exists: orgSnap.exists,
          status: orgData.status
        },
        invitation: {
          exists: true,
          organizationId: orgId,
          status: inviteData.status,
          email: inviteData.email,
          emailNormalized: inviteData.emailNormalized,
          role: inviteData.role,
          expiresAtMs: expiresMs,
          revokedAtMs: revokedMs,
          maxUses: inviteData.maxUses,
          useCount: inviteData.useCount,
          acceptedBy: inviteData.acceptedBy
        },
        existingMembership: {
          exists: memSnap.exists,
          status: memSnap.data()?.status,
          role: memSnap.data()?.role
        },
        capacity: capacityResult.capacity
      };

      const planResult = planInvitationAcceptance(input, acceptanceNowMs);

      if (!planResult.success) {
         let httpStatus = 409;
         switch (planResult.reasonCode) {
           case 'AUTHENTICATED_EMAIL_REQUIRED':
           case 'INVALID_INVITE_ROLE':
             httpStatus = 400; break;
           case 'INVITE_IDENTITY_MISMATCH':
             httpStatus = 403; break;
           case 'INVITE_NOT_FOUND':
           case 'ORGANIZATION_NOT_FOUND':
             httpStatus = 404; break;
           case 'MEMBER_LIMIT_UNAVAILABLE':
             httpStatus = 503; break;
         }
         return { status: httpStatus, data: { success: false, reasonCode: planResult.reasonCode } };
      }

      if (planResult.action === 'ALREADY_MEMBER') {
         return {
           status: 200,
           data: {
             success: true,
             organizationId: orgId,
             organizationName: orgData.name,
             activeOrganizationId: orgId,
             membershipRole: planResult.membershipRole,
             alreadyMember: true,
             legacyTokenMigrated: false,
             reasonCode: 'ALREADY_MEMBER'
           }
         };
      }

      // CREATE_MEMBERSHIP
      const previousUseCount = inviteData.useCount;
      const maxUses = inviteData.maxUses;
      if (typeof previousUseCount !== 'number' || !Number.isInteger(previousUseCount) || typeof maxUses !== 'number' || !Number.isInteger(maxUses)) {
        return { status: 409, data: { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' } };
      }
      const nextUseCount = previousUseCount + 1;
      if (nextUseCount > maxUses) {
        return { status: 409, data: { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' } };
      }

      const userData = userSnap.data() || {};
      const newPrimary = (!userData.primaryOrganizationId || typeof userData.primaryOrganizationId !== 'string' || userData.primaryOrganizationId.trim() === '') ? orgId : userData.primaryOrganizationId;

      t.set(memRef, {
        uid: authUser.uid,
        emailNormalized: normalizedAuthenticatedEmail,
        organizationId: orgId,
        role: planResult.membershipRole,
        organizationRole: planResult.membershipRole,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        joinedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      const legacyRef = db.collection('organization_members').doc(`${authUser.uid}_${orgId}`);
      t.set(legacyRef, {
        uid: authUser.uid,
        emailNormalized: normalizedAuthenticatedEmail,
        organizationId: orgId,
        role: planResult.membershipRole,
        organizationRole: planResult.membershipRole,
        status: 'active'
      }, { merge: true });

      t.set(userRef, {
        organizations: FieldValue.arrayUnion(orgId),
        activeOrganizationId: orgId,
        organizationId: orgId,
        primaryOrganizationId: newPrimary,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      type InviteUpdate = {
        useCount: number;
        updatedAt: FieldValue;
        status?: string;
        acceptedBy?: string;
        acceptedAt?: FieldValue;
      };

      const inviteUpdates: InviteUpdate = {
        useCount: nextUseCount,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (nextUseCount === maxUses) {
         inviteUpdates.status = 'accepted';
         inviteUpdates.acceptedBy = authUser.uid;
         inviteUpdates.acceptedAt = FieldValue.serverTimestamp();
      }
      
      t.update(inviteDoc.ref, inviteUpdates);

      const auditRef = db.collection(`organizations/${orgId}/audit_logs`).doc();
      t.set(auditRef, {
        action: 'invitation.accepted',
        actorUid: authUser.uid,
        invitationId: inviteDoc.id,
        membershipRole: planResult.membershipRole,
        previousUseCount: previousUseCount,
        newUseCount: nextUseCount,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        status: 200,
        data: {
          success: true,
          organizationId: orgId,
          organizationName: orgData.name,
          activeOrganizationId: orgId,
          membershipRole: planResult.membershipRole,
          alreadyMember: false,
          legacyTokenMigrated: false,
          reasonCode: 'INVITATION_CAN_BE_ACCEPTED'
        }
      };
    });

    return res.status(result.status).json(result.data);

  } catch (error) {
    console.error('Accept invite error:', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export async function setActiveOrganization(req: Request, res: Response) {
  const db = getFirestore();
  const uid = await verifyToken(req);
  if (!uid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const { organizationId } = req.body;
  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_ORG_ID' });
  }

  try {
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    // Check membership
    const memberRef = db.doc(`organizations/${organizationId}/members/${uid}`);
    const memberSnap = await memberRef.get();

    let hasAccess = false;

    if (memberSnap.exists) {
      hasAccess = true;
    } else {
      // Check if global admin
      const isGlobalAdmin = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(userData?.systemRole);
      if (isGlobalAdmin) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, reasonCode: 'ACCESS_DENIED' });
    }

    const updates: any = {
      activeOrganizationId: organizationId
    };

    if (userData?.organizationId) {
      updates.organizationId = organizationId; // legacy projection
    }

    await userRef.update(updates);

    await db.collection(`organizations/${organizationId}/audit_logs`).add({
      action: 'organization.active_context_changed',
      actorUid: uid,
      previousOrganizationId: userData?.activeOrganizationId || null,
      timestamp: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      activeOrganizationId: organizationId
    });

  } catch (error: any) {
    console.error('Set active org error:', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
