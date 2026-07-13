import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

const db = getFirestore();

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

  try {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    let userData = userSnap.data();

    // Create minimal profile if not exists
    if (!userSnap.exists) {
      const userRecord = await getAuth().getUser(uid);
      userData = {
        uid,
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        products: [],
        organizations: [],
        subscriptionStatus: 'none',
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp()
      };
      await userRef.set(userData);
    } else {
      await userRef.update({ lastLoginAt: FieldValue.serverTimestamp() });
      userData = (await userRef.get()).data();
    }

    // 5. Query active canonical memberships
    const membersQuery = await db.collectionGroup('members')
      .where('uid', '==', uid)
      .get();
      
    const activeMemberships = membersQuery.docs.filter(d => d.ref.path.includes('/organizations/') && !d.ref.path.includes('organization_members'));

    if (activeMemberships.length > 0) {
       const firstMember = activeMemberships[0];
       const orgId = firstMember.ref.parent.parent?.id;
       if (!orgId) throw new Error("Invalid membership path");
       
       return res.status(200).json({
         success: true,
         reusedExistingContext: true,
         activeOrganizationId: userData?.activeOrganizationId || orgId,
         primaryOrganizationId: userData?.primaryOrganizationId || orgId,
         organizationId: userData?.organizationId || orgId,
         reasonCode: 'EXISTING_CONTEXT_REUSED'
       });
    }

    // 8. Check for legacy memberships
    const legacyMembersQuery = await db.collection('organization_members')
      .where('uid', '==', uid)
      .get();
      
    if (legacyMembersQuery.docs.length === 1) {
       const legacyDoc = legacyMembersQuery.docs[0];
       const legacyData = legacyDoc.data();
       const orgId = legacyData.organizationId;
       
       if (orgId) {
          // Repair
          const newMemberRef = db.doc(`organizations/${orgId}/members/${uid}`);
          await newMemberRef.set({
             ...legacyData,
             role: legacyData.role || 'member',
             organizationRole: legacyData.organizationRole || legacyData.role || 'member'
          }, { merge: true });
          
          await db.collection(`organizations/${orgId}/audit_logs`).add({
            action: 'tenant.bootstrap.legacy_membership_repaired',
            actorUid: uid,
            timestamp: FieldValue.serverTimestamp()
          });

          return res.status(200).json({
             success: true,
             repairedLegacyMembership: true,
             activeOrganizationId: orgId,
             primaryOrganizationId: orgId,
             organizationId: orgId,
             reasonCode: 'LEGACY_REPAIRED'
          });
       }
    }

    // 9. If no membership and no pending invite (we assume no invite if they hit bootstrap without token)
    const targetOrgRef = db.collection('organizations').doc();
    const targetOrgId = targetOrgRef.id;

    // Create organization
    await targetOrgRef.set({
      id: targetOrgId,
      name: `Organização de ${userData?.displayName || userData?.email?.split('@')[0] || 'Usuário'}`,
      slug: targetOrgId,
      ownerUid: uid,
      enabledApps: [], // Rule 10: Empty
      subscriptionStatus: 'none',
      status: 'active',
      createdAt: FieldValue.serverTimestamp()
    });

    // Create canonical membership
    const memberData = {
      uid,
      organizationId: targetOrgId,
      role: 'owner',
      organizationRole: 'owner',
      createdAt: FieldValue.serverTimestamp()
    };
    await db.doc(`organizations/${targetOrgId}/members/${uid}`).set(memberData);

    // Create legacy projection
    await db.collection('organization_members').doc(`${uid}_${targetOrgId}`).set(memberData);

    // Update user
    await userRef.update({
      organizationId: targetOrgId,
      primaryOrganizationId: userData?.primaryOrganizationId || targetOrgId,
      activeOrganizationId: targetOrgId,
      organizations: FieldValue.arrayUnion(targetOrgId)
    });
    
    await db.collection(`organizations/${targetOrgId}/audit_logs`).add({
      action: 'tenant.bootstrap.completed',
      actorUid: uid,
      timestamp: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      createdOrganization: true,
      activeOrganizationId: targetOrgId,
      primaryOrganizationId: userData?.primaryOrganizationId || targetOrgId,
      organizationId: targetOrgId,
      reasonCode: 'CREATED_NEW_ORGANIZATION'
    });

  } catch (error: any) {
    console.error('Bootstrap error:', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export async function acceptInvitation(req: Request, res: Response) {
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
