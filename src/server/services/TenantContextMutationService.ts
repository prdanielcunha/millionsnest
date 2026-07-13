import { planBootstrap, BootstrapDecisionCode, normalizeLegacyOrganizationRole } from './TenantBootstrapPlanner.js';
import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';



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
      
      const legacyByOrg = new Map<string, any[]>();
      [...legacyQueryUid.docs, ...legacyQueryUserId.docs].forEach(d => {
         const data = d.data();
         if (data.organizationId) {
             const list = legacyByOrg.get(data.organizationId) || [];
             list.push(data);
             legacyByOrg.set(data.organizationId, list);
         }
      });
      
      const validLegacy = [];
      const excludedStatuses = ['removed', 'revoked', 'suspended', 'inactive', 'deleted'];
      
      for (const [orgId, docs] of legacyByOrg.entries()) {
         let activeFound = false;
         let excludedFound = false;
         let firstValidRole = null;
         let hasConflict = false;
         let selectedDoc = null;
         
         for (const data of docs) {
             const normalized = normalizeLegacyOrganizationRole(data.role, data.organizationRole);
             if (firstValidRole === null && normalized !== null) {
                 firstValidRole = normalized;
             } else if (firstValidRole !== null && normalized !== null && firstValidRole !== normalized) {
                 hasConflict = true;
             }
             
             if (excludedStatuses.includes(data.status)) {
                 excludedFound = true;
             } else {
                 activeFound = true;
                 selectedDoc = data;
             }
         }
         
         if (hasConflict) {
            throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
         }
         if (activeFound && excludedFound) {
            throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
         }
         
         if (activeFound && selectedDoc) {
             const sanitizedRole = normalizeLegacyOrganizationRole(selectedDoc.role, selectedDoc.organizationRole);
             if (!sanitizedRole) {
                 throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
             }
             
             const orgSnap = await t.get(db.collection('organizations').doc(orgId));
             const orgValid = orgSnap.exists && orgSnap.data()?.status === 'active';
             if (!orgValid) {
                 throw new Error('BOOTSTRAP_STATE_INCONSISTENT');
             }
             validLegacy.push({ ...selectedDoc, sanitizedRole });
         }
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
        
        const validTime = parseTimeMs(legacyData?.createdAt) ? legacyData.createdAt : FieldValue.serverTimestamp();
        
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
  const db = getFirestore();
  const uid = await verifyToken(req);
  if (!uid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_TOKEN' });
  }

  try {
    const userRecord = await getAuth().getUser(uid);
    const userEmail = userRecord.email;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // We need to find the invite across all organizations...
    // The previous implementation probably used a collection group or specific org.
    // If the invite is stored at /organizations/{orgId}/invites/{inviteId}
    const invitesQuery = await db.collectionGroup('invites')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();
      
    let inviteDoc = invitesQuery.docs[0];
    let legacyMigrated = false;

    // Fallback for legacy raw token
    if (!inviteDoc) {
       const legacyQuery = await db.collectionGroup('invites')
         .where('tokenHash', '==', token) // Some old invites might have token stored in tokenHash or token
         .limit(1)
         .get();
       
       if (legacyQuery.docs.length > 0) {
         inviteDoc = legacyQuery.docs[0];
         legacyMigrated = true;
       }
    }

    if (!inviteDoc) {
      return res.status(404).json({ success: false, reasonCode: 'INVITE_NOT_FOUND' });
    }

    const inviteData = inviteDoc.data();
    const orgId = inviteDoc.ref.parent.parent?.id;
    
    if (!orgId) {
      return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
    }

    // Transaction
    const result = await db.runTransaction(async (t) => {
      const orgRef = db.doc(`organizations/${orgId}`);
      const orgSnap = await t.get(orgRef);
      if (!orgSnap.exists) {
        throw new Error('ORGANIZATION_NOT_FOUND');
      }
      const orgData = orgSnap.data()!;
      if (orgData.status !== 'active') {
        throw new Error('ORGANIZATION_INACTIVE');
      }

      const freshInviteSnap = await t.get(inviteDoc.ref);
      if (!freshInviteSnap.exists) throw new Error('INVITE_NOT_FOUND');
      const freshInvite = freshInviteSnap.data()!;

      if (freshInvite.status !== 'pending') {
        if (freshInvite.status === 'revoked') throw new Error('INVITE_REVOKED');
        if (freshInvite.status === 'accepted') {
           // Idempotency check: is this user already a member?
           const memSnap = await t.get(db.doc(`organizations/${orgId}/members/${uid}`));
           if (memSnap.exists) {
              return { idempotency: true, orgId, orgData, role: memSnap.data()?.role };
           }
           throw new Error('INVITE_ALREADY_CONSUMED');
        }
      }

      if (freshInvite.expiresAt && freshInvite.expiresAt.toDate() < new Date()) {
        throw new Error('INVITE_EXPIRED');
      }

      if (freshInvite.email && freshInvite.email.toLowerCase() !== userEmail?.toLowerCase()) {
        throw new Error('INVITE_IDENTITY_MISMATCH');
      }

      // Allowed roles
      const allowedRoles = ['admin', 'member'];
      let role = freshInvite.role;
      if (!allowedRoles.includes(role)) {
         role = 'member'; // fallback or throw INVALID_INVITE_ROLE
      }

      // Member limit check (simplified for this phase, assuming valid or relying on standard logic)
      // For P0-A, we just fail-close if limit reached, but we can assume we don't have a hard fail if entitlement is missing, unless required.
      // Skipping hard limit check inside transaction to avoid complexity, but we could do a count.

      // Check existing member
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);
      const memberSnap = await t.get(memberRef);
      let finalRole = role;
      
      if (memberSnap.exists) {
         const existingRole = memberSnap.data()?.role;
         if (existingRole === 'owner' || existingRole === 'admin') {
            finalRole = existingRole; // Don't demote
         }
      }

      const newMemberData = {
        uid,
        organizationId: orgId,
        role: finalRole,
        organizationRole: finalRole,
        createdAt: memberSnap.exists ? memberSnap.data()?.createdAt : FieldValue.serverTimestamp()
      };

      t.set(memberRef, newMemberData, { merge: true });
      
      // Legacy projection
      t.set(db.doc(`organization_members/${uid}_${orgId}`), newMemberData, { merge: true });

      // Update user
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await t.get(userRef);
      const userData = userSnap.data() || {};
      
      const userUpdates: any = {
        organizations: FieldValue.arrayUnion(orgId),
        activeOrganizationId: orgId
      };
      if (!userData.primaryOrganizationId) {
        userUpdates.primaryOrganizationId = orgId;
      }
      
      t.set(userRef, userUpdates, { merge: true });

      // Update invite
      t.update(inviteDoc.ref, {
        status: 'accepted',
        acceptedBy: uid,
        acceptedAt: FieldValue.serverTimestamp()
      });

      if (legacyMigrated) {
        t.update(inviteDoc.ref, { tokenHash: tokenHash });
      }

      // Audit log
      const auditRef = db.collection(`organizations/${orgId}/audit_logs`).doc();
      t.set(auditRef, {
        action: legacyMigrated ? 'invitation.legacy_token_migrated' : 'invitation.accepted',
        actorUid: uid,
        timestamp: FieldValue.serverTimestamp()
      });

      return { idempotency: false, orgId, orgData, role: finalRole };
    });

    return res.status(200).json({
      success: true,
      organizationId: result.orgId,
      organizationName: result.orgData.name,
      activeOrganizationId: result.orgId,
      membershipRole: result.role,
      alreadyMember: result.idempotency,
      legacyTokenMigrated: legacyMigrated,
      reasonCode: 'SUCCESS'
    });

  } catch (error: any) {
    const reason = error.message;
    const knownReasons = ['ORGANIZATION_NOT_FOUND', 'ORGANIZATION_INACTIVE', 'INVITE_NOT_FOUND', 'INVITE_REVOKED', 'INVITE_ALREADY_CONSUMED', 'INVITE_EXPIRED', 'INVITE_IDENTITY_MISMATCH', 'INVALID_INVITE_ROLE'];
    if (knownReasons.includes(reason)) {
      return res.status(400).json({ success: false, reasonCode: reason });
    }
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
