import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
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
import { canManageTenantMembers } from '../../lib/permissionService.js';
import { buildInvitationTargetUrl, resolveInvitationTargetAppId } from '../../lib/InvitationTargetAppPolicy.js';
import {
  NESTJOURNEY_RESPONSIBILITIES,
  actorCanManageJourneyResponsibilities,
  type NestJourneyResponsibility,
} from './NestJourneyMemberResponsibilityCommandService.js';

export type InvitationCreationDependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  now?: () => number;
  generateTokenMaterial?: typeof generateInvitationTokenMaterial;
};

export async function createInvitation(
  req: Request,
  res: Response,
  dependencies: InvitationCreationDependencies = {}
) {
  const verifyIdToken = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
  const resolveFirestore = dependencies.getFirestore ?? getFirestore;
  const now = dependencies.now ?? Date.now;
  const generateTokenMaterial = dependencies.generateTokenMaterial ?? generateInvitationTokenMaterial;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }
    const uid = decodedToken.uid;

    const {
      organizationId,
      email,
      role,
      mode: rawMode,
      targetAppId: rawTargetAppId,
      nestJourneyResponsibility: rawNestJourneyResponsibility,
    } = req.body;
    const inviteMode = rawMode === 'link' ? 'link' : 'email';
    const targetResolution = resolveInvitationTargetAppId(rawTargetAppId);
    if ('reasonCode' in targetResolution) {
      return res.status(400).json({ success: false, reasonCode: targetResolution.reasonCode });
    }
    const targetAppId = targetResolution.targetAppId;

    let nestJourneyResponsibility: NestJourneyResponsibility | null = null;
    if (targetAppId === 'nestjourney') {
      const normalizedResponsibility =
        typeof rawNestJourneyResponsibility === 'string' && rawNestJourneyResponsibility.trim()
          ? rawNestJourneyResponsibility.trim().toLowerCase()
          : 'member';
      const candidate = normalizedResponsibility as NestJourneyResponsibility;
      if (!NESTJOURNEY_RESPONSIBILITIES.has(candidate)) {
        return res.status(400).json({ success: false, reasonCode: 'INVALID_NESTJOURNEY_RESPONSIBILITY' });
      }
      nestJourneyResponsibility = candidate;
    } else if (
      rawNestJourneyResponsibility !== undefined &&
      rawNestJourneyResponsibility !== null &&
      rawNestJourneyResponsibility !== ''
    ) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_NESTJOURNEY_RESPONSIBILITY' });
    }

    if (!isInvitationRole(role)) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_ROLE' });
    }

    let normalizedEmail: string | null = null;
    if (inviteMode === 'email') {
      if (typeof email !== 'string') {
        return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_EMAIL' });
      }
      normalizedEmail = normalizeInvitationEmail(email);
      if (!normalizedEmail || !isValidInvitationCreationEmail(normalizedEmail)) {
        return res.status(400).json({ success: false, reasonCode: 'INVALID_INVITE_EMAIL' });
      }
    }

    const db = resolveFirestore();
    
    const result = await db.runTransaction(async (t) => {
      // Load user global role
      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      const userData = userSnap.data() || {};
      const globalRole = typeof userData.systemRole === 'string'
        ? userData.systemRole.trim().toLowerCase()
        : undefined;
      
      const isGlobalAdmin = canManageTenantMembers(globalRole);
      
      let membershipData: any = {};
      let membershipExists = false;
      
      const membershipRef = db.collection('organizations').doc(organizationId).collection('members').doc(uid);
      if (!isGlobalAdmin) {
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

      // Ownership is an authority fact on the organization itself. Some older
      // tenants predate the canonical organizations/{orgId}/members/{uid}
      // projection or only expose organizationRole on that member document.
      // Do not reject a real owner just because that projection is absent/stale.
      const ownerIds = [
        orgData.ownerUid,
        orgData.ownerId,
        orgData.ownerUserId,
        orgData.owner_user_id
      ].filter((value) => typeof value === 'string' && value.trim() !== '');
      const isOrganizationOwner = ownerIds.includes(uid);

      if (!isGlobalAdmin) {
        if (isOrganizationOwner) {
          membershipExists = true;
          membershipData = {
            ...membershipData,
            role: 'owner',
            organizationRole: 'owner',
            status: membershipData.status || 'active'
          };
        } else if (membershipExists) {
          const canonicalMembershipRole =
            membershipData.role ||
            membershipData.organizationRole ||
            membershipData.membershipRole ||
            null;
          membershipData = {
            ...membershipData,
            role: canonicalMembershipRole
          };
        }
      }

      if (
        nestJourneyResponsibility &&
        nestJourneyResponsibility !== 'member' &&
        !actorCanManageJourneyResponsibilities({
          actorGlobal: isGlobalAdmin,
          actorMetadataOwner: isOrganizationOwner,
          actorMembership: membershipData,
        })
      ) {
        return { statusCode: 403, payload: { success: false, reasonCode: 'PERMISSION_DENIED' } };
      }
      
      const subRef = db.collection('subscriptions').doc(organizationId);
      const subSnap = await t.get(subRef);
      const subData = subSnap.data() || {};
      
      const membersRef = db.collection('organizations').doc(organizationId).collection('members');
      const membersQuery = await t.get(membersRef);
      const memberStatuses = membersQuery.docs.map(doc => doc.data().status);
      
      const invitesRef = db.collection('organizations').doc(organizationId).collection('invites');
      const invitesQuery = await t.get(invitesRef);
      
      const nowMs = now();
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
                 
                 // Every valid one-time pending invite reserves one seat on
                 // limited plans, whether it is email-bound or shareable.
                 pendingInvitesCount++;

                 if (
                   inviteMode === 'email' &&
                   typeof invData.emailNormalized === 'string' &&
                   invData.emailNormalized === normalizedEmail
                 ) {
                   existingPendingInvite = invData;
                 }
             }
          }
        }
      }
      
      // Global ecosystem roles have canonical full MusicScale entitlements,
      // including unlimited users. They must never depend on a tenant billing
      // projection just to manage membership in an organization.
      // NestJourney membership is not a MusicScale seat. Reusing the
      // MusicScale billing capacity here would block churches that use
      // NestJourney independently and would couple one app's user limit to
      // another app's onboarding.
      let capacityInput: InvitationCreationInput['capacity'] =
        isGlobalAdmin || targetAppId === 'nestjourney'
          ? { resolved: true, mode: 'unlimited' }
          : { resolved: false };

      if (!isGlobalAdmin && targetAppId !== 'nestjourney') {
        const appSubscription = subData.apps?.musicscale || null;
        const capacityResult = resolveCanonicalInvitationCapacity({
          organizationId,
          subscription: {
            exists: subSnap.exists,
            organizationId: subData.organizationId,
            app: appSubscription ? 'musicscale' : subData.app,
            status: appSubscription?.status ?? subData.status,
            plan:
              appSubscription?.plan ??
              subData.plan ??
              subData.productPlan ??
              subData.musicScalePlan ??
              subData.priceNickname,
            limitsUsers: appSubscription?.limits?.users ?? subData.limits?.users
          },
          organizationApp: {
            exists: !!orgData.apps?.musicscale,
            status: orgData.apps?.musicscale?.status,
            plan:
              orgData.apps?.musicscale?.plan ??
              orgData.subscriptionPlan ??
              orgData.plan,
            limitsUsers: orgData.apps?.musicscale?.limits?.users
          },
          memberStatuses
        });
        
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
      }

      const input: InvitationCreationInput = {
        creator: {
          uid,
          globalRole: globalRole
        },
        creatorMembership: {
          exists: membershipExists,
          role: membershipData.role || membershipData.organizationRole || membershipData.membershipRole,
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
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          role,
          mode: inviteMode
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
      const tokenMaterial = generateTokenMaterial();
      if (!tokenMaterial.success) {
         return { statusCode: 500, payload: { success: false, reasonCode: (tokenMaterial as any).reasonCode } };
      }
      
      const { rawToken, tokenHash } = tokenMaterial.material;

      // Scope collision detection to this organization's invite collection.
      // A collection-group query requires a dedicated Firestore collection-group
      // index and was causing every real production invite creation to fail with
      // INTERNAL_ERROR before the first write. Acceptance is organization-scoped,
      // and the token has 256 bits of entropy, so cross-organization collisions
      // are irrelevant to the lookup contract.
      const collisionQuery = await t.get(
        invitesRef.where('tokenHash', '==', tokenHash).limit(1)
      );
      if (!collisionQuery.empty) {
         return { statusCode: 500, payload: { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' } };
      }

      const inviteDoc = invitesRef.doc();
      const inviteId = inviteDoc.id;

      t.set(inviteDoc, {
        schemaVersion: 2,
        id: inviteId,
        organizationId,
        organizationName: planResult.organizationName,
        inviteMode: planResult.inviteMode,
        identityBound: planResult.identityBound,
        ...(planResult.email
          ? {
              email: planResult.email,
              emailNormalized: planResult.emailNormalized
            }
          : {}),
        role: planResult.role,
        status: planResult.status,
        tokenHash,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(planResult.expiresAtMs),
        maxUses: planResult.maxUses,
        useCount: planResult.useCount,
        ...(targetAppId ? { targetAppId } : {}),
        ...(nestJourneyResponsibility ? { nestJourneyResponsibility } : {})
      });

      t.set(orgRef, {
        invitesUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

            const auditLogRef = db.collection('organizations').doc(organizationId).collection('audit_logs').doc();
      t.set(auditLogRef, {
        action: 'invitation.created',
        actorUid: uid,
        actorSystemRole: globalRole || null,
        governanceScope: isGlobalAdmin ? 'ecosystem_global' : 'organization',
        invitationId: inviteId,
        membershipRole: planResult.role,
        targetAppId: targetAppId || null,
        nestJourneyResponsibility: nestJourneyResponsibility || null,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        payload: {
          success: true,
          reasonCode: planResult.reasonCode,
          invitePath: `/join/${organizationId}?token=${encodeURIComponent(rawToken)}`,
          ...(targetAppId ? { inviteUrl: buildInvitationTargetUrl(targetAppId, organizationId, rawToken) } : {}),
          invitation: {
            id: inviteId,
            organizationId,
            organizationName: planResult.organizationName,
            inviteMode: planResult.inviteMode,
            identityBound: planResult.identityBound,
            ...(planResult.email ? { email: planResult.email } : {}),
            role: planResult.role,
            status: planResult.status,
            expiresAtMs: planResult.expiresAtMs,
            ...(targetAppId ? { targetAppId } : {}),
            ...(nestJourneyResponsibility ? { nestJourneyResponsibility } : {})
          }
        }
      };
    });

    return res.status(result.statusCode).json(result.payload);

  } catch (error: any) {
    console.error('[InvitationCreation] Unhandled failure', {
      code: error?.code || null,
      message: error?.message || String(error),
      organizationId: req.body?.organizationId || null,
      mode: req.body?.mode === 'link' ? 'link' : 'email',
      role: req.body?.role || null,
      targetAppId: req.body?.targetAppId || null,
      nestJourneyResponsibility: req.body?.nestJourneyResponsibility || null
    });
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
