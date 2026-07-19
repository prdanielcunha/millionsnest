import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { 
  planInvitationCreation, 
  isValidInvitationCreationEmail, 
  InvitationCreationInput 
} from './InvitationCreationPlanner.js';
import { 
  generateInvitationTokenMaterial 
} from './InvitationTokenService.js';
import { 
  resolveCanonicalInvitationCapacity,
  normalizeInvitationTemporalMs
} from './InvitationAcceptanceServerPolicy.js';
import { normalizeInvitationEmail, isInvitationRole, InvitationRole } from './InvitationAcceptancePlanner.js';

export async function createInvitation(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }
    const uid = decodedToken.uid;

    const { organizationId, email, role } = req.body;
    
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_EMAIL' });
    }
    if (!isInvitationRole(role)) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_ROLE' });
    }
    
    const normalizedEmail = normalizeInvitationEmail(email);
    if (!normalizedEmail || !isValidInvitationCreationEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_EMAIL' });
    }

    const db = getFirestore();
    
    const result = await db.runTransaction(async (t) => {
      // Load user global role
      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      const userData = userSnap.data() || {};
      const globalRole = userData.systemRole;
      
      const isGlobalAdmin = globalRole === 'ceo' || globalRole === 'global_admin' || globalRole === 'ecosystem_owner' || globalRole === 'founder';
      
      let membershipData: any = {};
      let membershipExists = false;
      
      if (!isGlobalAdmin) {
        const membershipRef = db.collection('organizations').doc(organizationId).collection('members').doc(uid);
        const membershipSnap = await t.get(membershipRef);
        membershipExists = membershipSnap.exists;
        membershipData = membershipSnap.data() || {};
      }
      
      const orgRef = db.collection('organizations').doc(organizationId);
      const orgSnap = await t.get(orgRef);
      if (!orgSnap.exists) {
        return { statusCode: 404, payload: { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' } };
      }
      const orgData = orgSnap.data() || {};
      
      const subRef = db.collection('subscriptions').doc(organizationId);
      const subSnap = await t.get(subRef);
      const subData = subSnap.data() || {};
      
      const membersRef = db.collection('organizations').doc(organizationId).collection('members');
      const membersQuery = await t.get(membersRef);
      const memberStatuses = membersQuery.docs.map(doc => doc.data().status);
      
      const invitesRef = db.collection('organizations').doc(organizationId).collection('invites');
      const invitesQuery = await t.get(invitesRef);
      
      const nowMs = Date.now();
      let pendingInvitesCount = 0;
      let existingPendingInvite = null;
      
      for (const doc of invitesQuery.docs) {
        const invData = doc.data();
        if (invData.status === 'pending') {
          const invExpiresMs = normalizeInvitationTemporalMs(invData.expiresAt);
          const invRevokedMs = normalizeInvitationTemporalMs(invData.revokedAt);
          
          let isRevoked = false;
          if (invRevokedMs !== undefined && Number.isFinite(invRevokedMs)) {
            isRevoked = true;
          }
          
          if (!isRevoked && invExpiresMs !== undefined && invExpiresMs > nowMs) {
             if (Number.isInteger(invData.maxUses) && invData.maxUses > 0 && 
                 Number.isInteger(invData.useCount) && invData.useCount < invData.maxUses) {
                 
                 if (typeof invData.emailNormalized === 'string') {
                     pendingInvitesCount++;
                     
                     if (invData.emailNormalized === normalizedEmail) {
                       existingPendingInvite = invData;
                     }
                 }
             }
          }
        }
      }
      
      // Use existing capacity resolver
      const capacityResult = resolveCanonicalInvitationCapacity({
        organizationId,
        subscription: {
          exists: subSnap.exists,
          organizationId: subData.organizationId,
          app: subData.app,
          status: subData.status,
          plan: subData.plan,
          limitsUsers: subData.limits?.users
        },
        organizationApp: {
          exists: !!orgData.apps?.musicscale,
          status: orgData.apps?.musicscale?.status,
          plan: orgData.apps?.musicscale?.plan,
          limitsUsers: orgData.apps?.musicscale?.limits?.users
        },
        memberStatuses
      });
      
      let capacityInput: InvitationCreationInput['capacity'] = { resolved: false };
      if (capacityResult.success) {
         if (capacityResult.capacity.mode === 'unlimited') {
            capacityInput = { resolved: true, mode: 'unlimited' };
         } else if (capacityResult.capacity.mode === 'limited') {
            capacityInput = { 
              resolved: true, 
              mode: 'limited', 
              occupiedSlots: capacityResult.capacity.currentActiveMembers! + pendingInvitesCount, 
              maxMembers: capacityResult.capacity.maxMembers! 
            };
         }
      }

      const input: InvitationCreationInput = {
        creator: {
          uid,
          globalRole: globalRole
        },
        creatorMembership: {
          exists: membershipExists,
          role: membershipData.role,
          status: membershipData.status
        },
        organization: {
          exists: true,
          organizationId,
          name: orgData.name,
          status: orgData.status
        },
        request: {
          organizationId,
          email: normalizedEmail,
          role
        },
        capacity: capacityInput,
        existingPendingInvitation: existingPendingInvite ? {
          exists: true,
          status: 'pending',
          emailNormalized: existingPendingInvite.emailNormalized,
          expiresAtMs: normalizeInvitationTemporalMs(existingPendingInvite.expiresAt),
          revokedAtMs: normalizeInvitationTemporalMs(existingPendingInvite.revokedAt)
        } : { exists: false }
      };

      const planResult = planInvitationCreation(input, nowMs);
      
      if (!planResult.success) {
         const code = planResult.reasonCode;
         let status = 400;
         if (code === 'UNAUTHENTICATED') status = 401;
         if (code === 'ACTOR_MEMBERSHIP_REQUIRED' || code === 'ACTOR_MEMBERSHIP_INACTIVE' || code === 'PERMISSION_DENIED') status = 403;
         if (code === 'ORGANIZATION_NOT_FOUND') status = 404;
         if (code === 'ORGANIZATION_INACTIVE' || code === 'ORGANIZATION_STATE_INCONSISTENT' || code === 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT' || code === 'INVITE_ALREADY_PENDING' || code === 'INVITE_STATE_INCONSISTENT' || code === 'MEMBER_LIMIT_INVALID' || code === 'MEMBER_LIMIT_REACHED') status = 409;
         if (code === 'MEMBER_LIMIT_UNAVAILABLE') status = 503;
         return { statusCode: status, payload: planResult };
      }

      // Generate tokens
      const tokenMaterial = generateInvitationTokenMaterial();
      if (!tokenMaterial.success) {
         return { statusCode: 500, payload: { success: false, reasonCode: (tokenMaterial as any).reasonCode } };
      }
      
      const { rawToken, tokenHash } = tokenMaterial.material;

      // Check for tokenHash collision across all invites
      const collisionQuery = await t.get(db.collectionGroup('invites').where('tokenHash', '==', tokenHash));
      if (!collisionQuery.empty) {
         return { statusCode: 500, payload: { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' } };
      }

      const inviteDoc = invitesRef.doc();
      const inviteId = inviteDoc.id;

      t.set(inviteDoc, {
        schemaVersion: 1,
        id: inviteId,
        organizationId,
        organizationName: planResult.organizationName,
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        role: planResult.role,
        status: planResult.status,
        tokenHash,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(planResult.expiresAtMs),
        maxUses: planResult.maxUses,
        useCount: planResult.useCount
      });

      const auditLogRef = db.collection('organizations').doc(organizationId).collection('audit_logs').doc();
      t.set(auditLogRef, {
        action: 'invitation.created',
        actorUid: uid,
        invitationId: inviteId,
        membershipRole: planResult.role,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        payload: {
          success: true,
          reasonCode: planResult.reasonCode,
          invitePath: `/join/${organizationId}?token=${encodeURIComponent(rawToken)}`,
          invitation: {
            id: inviteId,
            organizationId,
            organizationName: planResult.organizationName,
            email: normalizedEmail,
            role: planResult.role,
            status: planResult.status,
            expiresAtMs: planResult.expiresAtMs
          }
        }
      };
    });

    return res.status(result.statusCode).json(result.payload);

  } catch (error) {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
