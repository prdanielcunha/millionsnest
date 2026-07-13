const fs = require('fs');
const content = fs.readFileSync('src/server/services/TenantContextMutationService.ts', 'utf8');

const importReplacement = `import { planBootstrap, BootstrapDecisionCode, resolveLegacyMembershipCandidates } from './TenantBootstrapPlanner.js';
import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { planInvitationAcceptance, normalizeInvitationEmail, InvitationAcceptanceInput } from './InvitationAcceptancePlanner.js';
import { resolveCanonicalInvitationCapacity } from './InvitationAcceptanceServerPolicy.js';`;

let newContent = content.replace(
  /import { planBootstrap.*?import \* as crypto from 'crypto';/s, 
  importReplacement
);

const acceptIdx = newContent.indexOf('export async function acceptInvitation');
const setOrgIdx = newContent.indexOf('export async function setActiveOrganization');

const acceptReplacement = `export async function acceptInvitation(req: Request, res: Response) {
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

      if (inviteData.organizationId && inviteData.organizationId !== orgId) {
        return { status: 409, data: { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' } };
      }

      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await t.get(orgRef);

      const memRef = db.collection(\`organizations/\${orgId}/members\`).doc(uid);
      const memSnap = await t.get(memRef);

      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);

      const subRef = db.collection('subscriptions').doc(orgId);
      const subSnap = await t.get(subRef);

      const allMemsQuery = await t.get(db.collection(\`organizations/\${orgId}/members\`));
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

      if (!capacityResult.success) {
         const code = capacityResult.reasonCode;
         const httpStatus = code === 'MEMBER_LIMIT_UNAVAILABLE' ? 503 : 409;
         return { status: httpStatus, data: { success: false, reasonCode: code } };
      }

      const expiresMs = inviteData.expiresAt?.toMillis ? inviteData.expiresAt.toMillis() : (typeof inviteData.expiresAt === 'number' ? inviteData.expiresAt : -1);
      const revokedMs = inviteData.revokedAt?.toMillis ? inviteData.revokedAt.toMillis() : (typeof inviteData.revokedAt === 'number' ? inviteData.revokedAt : undefined);

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
      const userData = userSnap.data() || {};
      const newPrimary = (!userData.primaryOrganizationId || typeof userData.primaryOrganizationId !== 'string' || userData.primaryOrganizationId.trim() === '') ? orgId : userData.primaryOrganizationId;

      t.set(memRef, {
        uid: authUser.uid,
        emailNormalized: normalizeInvitationEmail(authUser.email) || '',
        organizationId: orgId,
        role: planResult.membershipRole,
        organizationRole: planResult.membershipRole,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        joinedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      const legacyRef = db.collection('organization_members').doc(\`\${authUser.uid}_\${orgId}\`);
      t.set(legacyRef, {
        uid: authUser.uid,
        emailNormalized: normalizeInvitationEmail(authUser.email) || '',
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

      const nextUseCount = (inviteData.useCount || 0) + 1;
      const inviteUpdates: any = {
        useCount: nextUseCount,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (nextUseCount >= inviteData.maxUses) {
         inviteUpdates.status = 'accepted';
         inviteUpdates.acceptedBy = authUser.uid;
         inviteUpdates.acceptedAt = FieldValue.serverTimestamp();
      }
      
      t.update(inviteDoc.ref, inviteUpdates);

      const auditRef = db.collection(\`organizations/\${orgId}/audit_logs\`).doc();
      t.set(auditRef, {
        action: 'invitation.accepted',
        actorUid: authUser.uid,
        invitationId: inviteDoc.id,
        membershipRole: planResult.membershipRole,
        previousUseCount: inviteData.useCount || 0,
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

`;

newContent = newContent.slice(0, acceptIdx) + acceptReplacement + newContent.slice(setOrgIdx);
fs.writeFileSync('src/server/services/TenantContextMutationService.ts', newContent);
