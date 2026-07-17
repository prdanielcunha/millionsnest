import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { resolveEcosystemPrivilegePolicy, resolveEffectiveSupportAccess } from '../../lib/permissionService.js';

export async function getSupportCapabilities(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const uid = decodedToken.uid;
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });
    }

    if (organizationId.length > 128) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });
    }

    const db = admin.firestore();

    // Check organization existence
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' });
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
        return res.status(409).json({ success: false, reasonCode: 'ORGANIZATION_CONTEXT_MISMATCH' });
      }

      // Check membership
      const memberDoc = await db.collection('organizations').doc(organizationId).collection('members').doc(uid).get();
      if (!memberDoc.exists) {
        return res.status(403).json({ success: false, reasonCode: 'MEMBERSHIP_REQUIRED' });
      }
      const memberData = memberDoc.data();
      const memberStatus = memberData?.status;
      if (memberStatus && memberStatus !== 'active') {
        return res.status(403).json({ success: false, reasonCode: 'MEMBERSHIP_INACTIVE' });
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

    return res.status(200).json({
      success: true,
      supportTier: resolvedAccess.supportTier,
      hasPrioritySupport: resolvedAccess.hasPrioritySupport,
      canUseWhatsAppSupport: resolvedAccess.canUseWhatsAppSupport,
      hasGlobalEntitlementOverride
    });
  } catch (error: any) {
    console.error('[SupportCapabilitiesService] CRITICAL ERROR:', error.message);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
