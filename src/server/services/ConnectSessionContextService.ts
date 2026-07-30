import admin from 'firebase-admin';
import express from 'express';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { getDefaultPermissions } from '../../lib/rbac.js';
import { resolveEcosystemAppAccess } from './EcosystemAccessResolver.js';
import { mapCanonicalDecisionToCatalogState } from '../../lib/ecosystemAccessProjection.js';
import { ConnectSessionContextResponse, ConnectSessionOrganization, ConnectSessionAppAccess } from '../../lib/connectSessionContext.js';

export interface ConnectSessionContextDependencies {
  verifyIdToken: (token: string) => Promise<admin.auth.DecodedIdToken>;
  getDb: () => admin.firestore.Firestore | null;
  logger: any;
}

/**
 * Completely passive, read-only version of the organization context resolution.
 * Calculates inconsistencies and needsRepair status but NEVER writes to Firestore.
 */
export async function resolveUserOrganizationContextReadOnly(uid: string, db: admin.firestore.Firestore) {
  if (!uid) {
    return {
      activeOrganizationId: null,
      primaryOrganizationId: null,
      organizations: [],
      ownedOrganizations: [],
      memberships: [],
      hasOrganization: false,
      needsRepair: false,
      inconsistencies: []
    };
  }

  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;

  // 1. Fetch organizations where uid is marked as owner/creator
  const ownedQuery1 = await db.collection('organizations').where('ownerUserId', '==', uid).get();
  const ownedQuery2 = await db.collection('organizations').where('ownerUid', '==', uid).get();
  const ownedQuery3 = await db.collection('organizations').where('ownerId', '==', uid).get();

  const potentialOrgIds = new Set<string>();

  if (userData) {
    if (userData.activeOrganizationId) potentialOrgIds.add(userData.activeOrganizationId);
    if (userData.primaryOrganizationId) potentialOrgIds.add(userData.primaryOrganizationId);
    if (userData.organizationId) potentialOrgIds.add(userData.organizationId);

    if (Array.isArray(userData.organizations)) {
      userData.organizations.forEach((id: any) => { if (typeof id === 'string') potentialOrgIds.add(id); });
    }
    if (Array.isArray(userData.organizationIds)) {
      userData.organizationIds.forEach((id: any) => { if (typeof id === 'string') potentialOrgIds.add(id); });
    }
    if (Array.isArray(userData.memberships)) {
      userData.memberships.forEach((m: any) => {
        if (typeof m === 'string') potentialOrgIds.add(m);
        else if (m && typeof m === 'object' && typeof m.organizationId === 'string') potentialOrgIds.add(m.organizationId);
      });
    }
  }

  // Include any legacy organization_members links the user has
  try {
    const legacyMembersSnap = await db.collection('organization_members').where('uid', '==', uid).get();
    legacyMembersSnap.docs.forEach(doc => {
      const oId = doc.data()?.organizationId;
      if (oId && typeof oId === 'string') potentialOrgIds.add(oId);
    });
  } catch (legErr) {
    // Silent ignore
  }

  ownedQuery1.docs.forEach(doc => potentialOrgIds.add(doc.id));
  ownedQuery2.docs.forEach(doc => potentialOrgIds.add(doc.id));
  ownedQuery3.docs.forEach(doc => potentialOrgIds.add(doc.id));

  const organizationsMap: { [id: string]: any } = {};
  const membershipsMap: { [id: string]: any } = {};

  const orgIdsList = Array.from(potentialOrgIds);
  if (orgIdsList.length > 0) {
    const orgChunks = [];
    for (let i = 0; i < orgIdsList.length; i += 10) {
      orgChunks.push(orgIdsList.slice(i, i + 10));
    }

    for (const chunk of orgChunks) {
      const qs = await db.collection('organizations').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
      qs.docs.forEach(doc => {
        organizationsMap[doc.id] = { id: doc.id, ...doc.data() };
      });
    }
  }

  // Standalone membership lookup
  if (Object.keys(organizationsMap).length > 0) {
    const lookupPromises = Object.keys(organizationsMap).map(async (orgId) => {
      try {
        const mDoc = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
        if (mDoc.exists) {
          membershipsMap[orgId] = { id: uid, ...mDoc.data() };
        }
      } catch (mErr) {
        // Silent ignore
      }
    });
    await Promise.all(lookupPromises);
  }

  const finalOrganizations: any[] = [];
  const ownedOrganizations: any[] = [];
  let inconsistencies: string[] = [];
  let needsRepair = false;

  for (const orgId of Object.keys(organizationsMap)) {
    const org = organizationsMap[orgId];
    if (!membershipsMap[orgId]) {
      const isOwner = org.ownerUserId === uid || org.ownerUid === uid || org.ownerId === uid;
      if (isOwner) {
        needsRepair = true;
        inconsistencies.push(`Usuário é dono da organização ${org.name || 'Sem nome'} (${orgId}) mas não possui documento de membro.`);
      }
    }
  }

  for (const orgId of Object.keys(organizationsMap)) {
    const org = organizationsMap[orgId];
    const membership = membershipsMap[orgId];
    const isOwner = org.ownerUserId === uid || org.ownerUid === uid || org.ownerId === uid || membership?.role === 'owner' || membership?.organizationRole === 'owner';

    const orgItem = {
      id: orgId,
      name: org.name || 'Sem nome',
      slug: org.slug || null,
      ownerUserId: org.ownerUserId || org.ownerUid || org.ownerId || null,
      ownerEmail: org.ownerEmail || null,
      ownerName: org.ownerName || null,
      subscriptionPlan: org.subscriptionPlan || org.plan || 'starter',
      subscriptionStatus: org.subscriptionStatus || org.status || 'inactive',
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      apps: org.apps,
      userRole: membership?.role || membership?.organizationRole || (isOwner ? 'owner' : null),
      status: org.status || 'active',
      membership: membership || null,
      enabledApps: org.enabledApps || []
    };

    finalOrganizations.push(orgItem);
    if (isOwner) {
      ownedOrganizations.push(orgItem);
    }
  }

  const activeOrgsList = finalOrganizations.filter(o => o.status !== 'archived');

  finalOrganizations.sort((a, b) => {
    const roleWeight = (r: string | null) => r === 'owner' ? 3 : r === 'admin' ? 2 : r === 'member' ? 1 : 0;
    const diff = roleWeight(b.userRole) - roleWeight(a.userRole);
    if (diff !== 0) return diff;
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });

  let activeOrganizationId: string | null = null;
  let primaryOrganizationId: string | null = null;

  let uidUsedAsOrganizationIdSuspected = false;
  if (organizationsMap[uid] && organizationsMap[uid].status !== 'archived' && !organizationsMap[uid].archived) {
    uidUsedAsOrganizationIdSuspected = true;
    inconsistencies.push('SUSPEITA: Organização com ID igual ao UID do usuário identificada.');
  }

  if (userData) {
    if (userData.activeOrganizationId && organizationsMap[userData.activeOrganizationId] && organizationsMap[userData.activeOrganizationId].status !== 'archived') {
      activeOrganizationId = userData.activeOrganizationId;
    }
    
    if (userData.primaryOrganizationId && organizationsMap[userData.primaryOrganizationId] && organizationsMap[userData.primaryOrganizationId].status !== 'archived') {
      primaryOrganizationId = userData.primaryOrganizationId;
    }

    if (!activeOrganizationId && primaryOrganizationId) {
      activeOrganizationId = primaryOrganizationId;
    }

    if (!activeOrganizationId && !primaryOrganizationId && userData.organizationId && organizationsMap[userData.organizationId] && organizationsMap[userData.organizationId].status !== 'archived') {
      activeOrganizationId = userData.organizationId;
      primaryOrganizationId = userData.organizationId;
      needsRepair = true;
      inconsistencies.push('Usando organizationId legado como fallback.');
    }
  }

  if (activeOrgsList.length > 0) {
    if (!primaryOrganizationId) {
      const ownerOrg = activeOrgsList.find(o => o.userRole === 'owner');
      const memberOrg = activeOrgsList.find(o => o.membership != null);
      
      primaryOrganizationId = (ownerOrg || memberOrg || activeOrgsList[0]).id;
      activeOrganizationId = primaryOrganizationId;
      needsRepair = true;
      if (!uidUsedAsOrganizationIdSuspected) {
        inconsistencies.push('Vínculo primário canonical ausente. Fallback provisório assumido base nas organizações ativas.');
      }
    }
  } else {
    primaryOrganizationId = null;
    activeOrganizationId = null;
  }

  if (userData) {
    if (activeOrganizationId && userData.organizationId !== activeOrganizationId) {
      needsRepair = true;
      inconsistencies.push('userData.organizationId legado está desalinhado.');
    }
    if (activeOrganizationId && !userData.activeOrganizationId) {
      needsRepair = true;
    }
    if (primaryOrganizationId && !userData.primaryOrganizationId) {
      needsRepair = true;
    }
  }

  const hasOrganization = activeOrganizationId !== null;

  // Fully PASSIVE simulate single org repair
  if (finalOrganizations.length === 1 && !uidUsedAsOrganizationIdSuspected && hasOrganization) {
    const fixedOrgId = finalOrganizations[0].id;
    if (needsRepair && userData) {
      primaryOrganizationId = fixedOrgId;
      activeOrganizationId = fixedOrgId;
      
      // Filter out simulated repairs
      inconsistencies = inconsistencies.filter(i => !i.includes('primário canonical ausente') && !i.includes('desalinhado'));
      needsRepair = inconsistencies.length > 0;
    }
  }

  return {
    uid,
    activeOrganizationId,
    primaryOrganizationId,
    organizations: activeOrgsList,
    ownedOrganizations: ownedOrganizations.filter((o: any) => o.status !== 'archived' && o.archived !== true),
    memberships: Object.values(membershipsMap),
    hasOrganization,
    needsRepair,
    inconsistencies,
    uidUsedAsOrganizationIdSuspected
  };
}

export async function handleConnectSessionContextRequest(
  req: express.Request,
  res: express.Response,
  deps: ConnectSessionContextDependencies
) {
  // P0-C Security: Strict anti-caching headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ') || authHeader.trim() === 'Bearer') {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await deps.verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    if (!decoded.uid) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    const uid = decoded.uid;
    const db = deps.getDb();
    if (!db) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'Database service unavailable.' });
    }

    // Step 1: Identity Resolution
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'User profile not found.' });
    }

    const userData = userDoc.data() || {};
    
    // Status validation
    if (
      userData.status === 'inactive' ||
      userData.status === 'suspended' ||
      userData.status === 'disabled' ||
      userData.disabled === true
    ) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', error: 'User account is inactive.' });
    }

    const systemRole = userData.systemRole || 'user';
    const hasGlobalRole = isCanonicalGlobalRole(systemRole);

    // Step 2: Build ConnectSessionUser representation
    const userCapabilities: string[] = [];
    if (userData.capabilities && Array.isArray(userData.capabilities)) {
      userCapabilities.push(...userData.capabilities);
    }
    if (hasGlobalRole) {
      userCapabilities.push('*');
    }

    const sessionUser = {
      uid,
      displayName: userData.displayName || null,
      photoUrl: userData.photoURL || userData.photoUrl || null,
      locale: userData.locale || null,
      systemRole,
      capabilities: userCapabilities
    };

    // Step 3: Candidate Organizations Discovery (Using entirely read-only resolver)
    const context = await resolveUserOrganizationContextReadOnly(uid, db);

    const candidates: ConnectSessionOrganization[] = context.organizations.map(org => {
      const isOwner = org.ownerUserId === uid || org.ownerUid === uid || org.ownerId === uid || org.userRole === 'owner';
      const roleInOrg = org.userRole || 'member';

      let permissionsList: string[] = [];
      if (hasGlobalRole) {
        permissionsList = ['*'];
      } else if (org.membership?.permissions) {
        const perms = org.membership.permissions;
        permissionsList = Object.keys(perms).filter(k => perms[k] === true);
      } else if (org.userRole) {
        const perms = getDefaultPermissions(org.userRole);
        permissionsList = Object.keys(perms).filter(k => perms[k] === true);
      }

      const orgCapabilities: string[] = [];
      if (org.enabledApps && Array.isArray(org.enabledApps)) {
        orgCapabilities.push(...org.enabledApps);
      }
      if (org.apps?.musicscale?.access === true) {
        orgCapabilities.push('musicscale');
      }
      if (org.apps?.musicscale?.features) {
        const features = org.apps.musicscale.features;
        Object.keys(features).forEach(k => {
          if (features[k] === true) {
            orgCapabilities.push(`musicscale.feature.${k}`);
          }
        });
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug || null,
        status: org.status || 'active',
        accessSource: (hasGlobalRole ? "global_system_role" : "organization_membership") as any,
        organizationRole: roleInOrg,
        membershipStatus: org.membership?.status || 'active',
        permissions: permissionsList,
        capabilities: orgCapabilities
      };
    });

    // Step 4: Active Organization Resolution
    const activeOrganizationId = context.activeOrganizationId;
    const activeOrganization = activeOrganizationId
      ? candidates.find(c => c.id === activeOrganizationId) || null
      : null;

    // Step 5: Application Access (MusicScale)
    let appAccessResponse: { musicscale: ConnectSessionAppAccess } | null = null;

    if (activeOrganizationId) {
      const appAccessResult = await resolveEcosystemAppAccess({
        uid,
        organizationId: activeOrganizationId,
        appId: 'musicscale',
        db
      });

      const catalogState = mapCanonicalDecisionToCatalogState(
        appAccessResult.accessible,
        appAccessResult.isGlobalAccess,
        appAccessResult.denialReason,
        appAccessResult.entitlement?.canonicalStatus,
        appAccessResult.entitlement?.cancellationScheduled
      );

      appAccessResponse = {
        musicscale: {
          appId: 'musicscale',
          organizationId: activeOrganizationId,
          accessible: appAccessResult.accessible,
          isGlobalAccess: appAccessResult.isGlobalAccess,
          accessSource: appAccessResult.accessSource,
          decisionState: appAccessResult.accessible ? 'granted' : 'denied',
          denialReason: appAccessResult.denialReason || null,
          catalogState,
          entitlement: appAccessResult.entitlement ? {
            canonicalStatus: appAccessResult.entitlement.canonicalStatus,
            cancellationScheduled: appAccessResult.entitlement.cancellationScheduled,
            currentPeriodEndMs: appAccessResult.entitlement.currentPeriodEndMs,
            individualAccessSource: appAccessResult.entitlement.individualAccessSource
          } : null
        }
      };
    }

    const payload: ConnectSessionContextResponse = {
      success: true,
      protocolVersion: '1.0.0',
      generatedAtMs: Date.now(),
      user: sessionUser,
      globalAccess: hasGlobalRole,
      activeOrganizationId,
      activeOrganization,
      organizations: candidates,
      appAccess: appAccessResponse
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    deps.logger.error('[CONNECT_SESSION_CONTEXT_FATAL]', {
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      error: 'An internal server error occurred while resolving the session context.'
    });
  }
}
