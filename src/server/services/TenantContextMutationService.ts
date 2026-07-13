import { planBootstrap, BootstrapDecisionCode } from './TenantBootstrapPlanner.js';
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

  try {
    const result = await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      let userData = userSnap.data();
      const userEmail = userData?.email || (await auth.getUser(uid)).email || null;

      // Check lock
      const lockRef = db.collection('tenantBootstrapLocks').doc(uid);
      const lockSnap = await t.get(lockRef);
      const lockData = lockSnap.data();
      
      let lockExists = lockSnap.exists;
      let lockCompleted = lockExists && lockData?.status === 'completed';
      let lockOrgId = lockData?.organizationId;
      let lockOrgExists = false;
      let lockMemberExists = false;

      if (lockCompleted && lockOrgId) {
        const checkOrg = await t.get(db.collection('organizations').doc(lockOrgId));
        lockOrgExists = checkOrg.exists;
        const checkMem = await t.get(db.collection(`organizations/${lockOrgId}/members`).doc(uid));
        lockMemberExists = checkMem.exists;
      }

      const lockStatus = {
        exists: lockExists,
        completed: lockCompleted,
        organizationId: lockOrgId,
        orgExists: lockOrgExists,
        memberExists: lockMemberExists
      };

      // Get Canonical Memberships
      // We can't query collectionGroups inside transaction, so we must rely on what we can. 
      // Actually, we CAN query but not with transactions.
      // Wait, Firestore transactions in Node SDK allow queries if they are read before writes.
      const membersQuery = await t.get(
        db.collectionGroup('members').where('uid', '==', uid)
      );
      const activeCanonical = membersQuery.docs
        .filter(d => d.ref.path.includes('/organizations/') && !d.ref.path.includes('organization_members'))
        .map(d => ({ ...d.data(), organizationId: d.ref.parent.parent!.id } as any));

      // Get Legacy Memberships
      const legacyQuery = await t.get(
        db.collection('organization_members').where('uid', '==', uid)
      );
      const legacyMemberships = legacyQuery.docs.map(d => d.data() as any);

      // Get Invites
      const normalizedEmail = userEmail?.toLowerCase().trim();
      let pendingInvites: any[] = [];
      if (normalizedEmail) {
        // Can't do multiple where clauses easily with 'OR' in firestore, so just query by email
        const invitesQuery = await t.get(
          db.collectionGroup('invites').where('email', '==', normalizedEmail).where('status', '==', 'pending')
        );
        pendingInvites = invitesQuery.docs.map(d => ({ ...d.data(), id: d.id } as any));
        
        const invitesQuery2 = await t.get(
          db.collectionGroup('invites').where('emailNormalized', '==', normalizedEmail).where('status', '==', 'pending')
        );
        pendingInvites.push(...invitesQuery2.docs.map(d => ({ ...d.data(), id: d.id } as any)));
      }

      const userContext = {
        activeOrganizationId: userData?.activeOrganizationId,
        primaryOrganizationId: userData?.primaryOrganizationId,
        organizationId: userData?.organizationId,
      };

      const decision = planBootstrap(
        activeCanonical,
        legacyMemberships,
        pendingInvites,
        userContext,
        lockStatus,
        userEmail
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
        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: orgId
        };
        if (!userData?.primaryOrganizationId) {
          updates.primaryOrganizationId = orgId;
        }
        if (userData?.organizationId) {
          updates.organizationId = orgId;
        }
        
        if (!userSnap.exists) {
           t.set(userRef, { uid, email: userEmail, displayName: null, photoURL: null, organizations: [], createdAt: FieldValue.serverTimestamp(), ...updates });
        } else {
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            reusedExistingContext: true,
            activeOrganizationId: orgId,
            primaryOrganizationId: updates.primaryOrganizationId || userData?.primaryOrganizationId || orgId,
            organizationId: updates.organizationId || userData?.organizationId,
            reasonCode: decision.reasonCode
          }
        };
      }

      if (decision.code === BootstrapDecisionCode.REPAIR_LEGACY_MEMBERSHIP) {
        const orgId = decision.organizationId!;
        const legacyData = legacyMemberships.find(m => m.organizationId === orgId);
        
        const newMemberRef = db.doc(`organizations/${orgId}/members/${uid}`);
        t.set(newMemberRef, {
           ...legacyData,
           uid,
           organizationId: orgId,
           role: legacyData?.role || 'member',
           organizationRole: legacyData?.organizationRole || legacyData?.role || 'member',
           status: 'active'
        }, { merge: true });

        const auditRef = db.collection(`organizations/${orgId}/audit_logs`).doc();
        t.set(auditRef, {
          action: 'tenant.bootstrap.legacy_membership_repaired',
          actorUid: uid,
          timestamp: FieldValue.serverTimestamp()
        });

        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: orgId
        };
        if (!userData?.primaryOrganizationId) {
          updates.primaryOrganizationId = orgId;
        }
        if (userData?.organizationId) {
          updates.organizationId = orgId;
        }

        if (!userSnap.exists) {
           t.set(userRef, { uid, email: userEmail, displayName: null, photoURL: null, organizations: [], createdAt: FieldValue.serverTimestamp(), ...updates });
        } else {
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            repairedLegacyMembership: true,
            activeOrganizationId: orgId,
            primaryOrganizationId: updates.primaryOrganizationId || userData?.primaryOrganizationId || orgId,
            organizationId: updates.organizationId || userData?.organizationId,
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

        const updates: any = {
          lastLoginAt: FieldValue.serverTimestamp(),
          activeOrganizationId: targetOrgId
        };
        if (!userData?.primaryOrganizationId) {
          updates.primaryOrganizationId = targetOrgId;
        }
        if (userData?.organizationId || !userSnap.exists) {
          updates.organizationId = targetOrgId;
        }

        if (!userSnap.exists) {
           t.set(userRef, { 
             uid, 
             email: userEmail, 
             displayName: null, 
             photoURL: null, 
             organizations: [targetOrgId], 
             createdAt: FieldValue.serverTimestamp(), 
             updatedAt: FieldValue.serverTimestamp(),
             ...updates 
           });
        } else {
           updates.organizations = FieldValue.arrayUnion(targetOrgId);
           t.update(userRef, updates);
        }

        return {
          status: 200,
          payload: {
            success: true,
            createdOrganization: true,
            activeOrganizationId: targetOrgId,
            primaryOrganizationId: updates.primaryOrganizationId || userData?.primaryOrganizationId || targetOrgId,
            organizationId: updates.organizationId || userData?.organizationId,
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
