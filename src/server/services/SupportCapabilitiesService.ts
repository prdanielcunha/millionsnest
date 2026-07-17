import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { resolveEcosystemPrivilegePolicy, resolveEffectiveSupportAccess } from '../../lib/permissionService.js';
import { getSupportConfig } from '../config/supportConfig.js';

export async function resolveAuthenticatedSupportContext(params: {
  authorizationHeader?: string;
  organizationId: string;
}) {
  const { authorizationHeader, organizationId } = params;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return { error: { status: 401, reasonCode: 'UNAUTHENTICATED' } };
  }

  const token = authorizationHeader.substring(7);
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (err) {
    return { error: { status: 401, reasonCode: 'UNAUTHENTICATED' } };
  }

  const uid = decodedToken.uid;
  const db = admin.firestore();

  // Check organization existence
  const orgDoc = await db.collection('organizations').doc(organizationId).get();
  if (!orgDoc.exists) {
    return { error: { status: 404, reasonCode: 'ORGANIZATION_NOT_FOUND' } };
  }
  const orgData = orgDoc.data() || {};

  // Load user doc for system role and active organization
  const userDoc = await db.collection('users').doc(uid).get();
  const userDocData = userDoc.exists ? userDoc.data() : null;

  const systemRole = userDocData?.systemRole || 'user';
  const privilegePolicy = resolveEcosystemPrivilegePolicy(systemRole);

  if (!privilegePolicy.canBypassSupportMembership) {
    const userActiveOrgId = userDocData?.activeOrganizationId || userDocData?.organizationId;
    if (organizationId !== userActiveOrgId) {
      return { error: { status: 409, reasonCode: 'ORGANIZATION_CONTEXT_MISMATCH' } };
    }

    // Check membership
    const memberDoc = await db.collection('organizations').doc(organizationId).collection('members').doc(uid).get();
    if (!memberDoc.exists) {
      return { error: { status: 403, reasonCode: 'MEMBERSHIP_REQUIRED' } };
    }
    const memberData = memberDoc.data();
    const memberStatus = memberData?.status;
    if (memberStatus && memberStatus !== 'active') {
      return { error: { status: 403, reasonCode: 'MEMBERSHIP_INACTIVE' } };
    }
  }

  // Resolve support tier and access source
  const subDoc = await db.collection('subscriptions').doc(organizationId).get();
  const subData = subDoc.exists ? subDoc.data() : null;

  const resolvedAccess = resolveEffectiveSupportAccess({
    systemRole,
    subscription: subData,
    organization: orgData
  });

  const hasGlobalEntitlementOverride = privilegePolicy.isCanonicalGlobalRole || privilegePolicy.isEcosystemSupportStaff;
  
  let displayName = decodedToken.name || userDocData?.displayName || decodedToken.email?.split('@')[0] || 'Usuário';

  return {
    success: true,
    uid,
    displayName,
    resolvedAccess,
    hasGlobalEntitlementOverride,
    orgData
  };
}

export async function getSupportCapabilities(req: Request, res: Response) {
  try {
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });
    }

    if (organizationId.length > 128) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });
    }

    const context = await resolveAuthenticatedSupportContext({
      authorizationHeader: req.headers.authorization,
      organizationId
    });

    if (context.error) {
      return res.status(context.error.status).json({ success: false, reasonCode: context.error.reasonCode });
    }

    const config = getSupportConfig();
    const canUseWhatsAppSupport = context.resolvedAccess!.hasPrioritySupport && config.isWhatsAppConfigured;

    return res.status(200).json({
      success: true,
      supportTier: context.resolvedAccess!.supportTier,
      hasPrioritySupport: context.resolvedAccess!.hasPrioritySupport,
      canUseWhatsAppSupport,
      isWhatsAppConfigured: config.isWhatsAppConfigured,
      hasGlobalEntitlementOverride: context.hasGlobalEntitlementOverride
    });
  } catch (error: any) {
    console.error('[SupportCapabilitiesService] CRITICAL ERROR:', error.message);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
