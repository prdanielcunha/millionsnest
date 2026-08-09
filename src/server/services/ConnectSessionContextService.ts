import admin from 'firebase-admin';
import express from 'express';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { resolveEcosystemAppAccess } from './EcosystemAccessResolver.js';
import { mapCanonicalDecisionToCatalogState } from '../../lib/ecosystemAccessProjection.js';
import {
  ConnectSessionContextResponse,
  ConnectSessionOrganization,
  ConnectSessionAppAccess,
  ConnectSessionUser
} from '../../lib/connectSessionContext.js';

export interface ConnectSessionContextDependencies {
  verifyIdToken: (token: string) => Promise<admin.auth.DecodedIdToken>;
  getDb: () => admin.firestore.Firestore | null;
  logger: {
    error: (msg: string, meta?: unknown) => void;
    info: (msg: string, meta?: unknown) => void;
  };
}

const MAX_CANDIDATE_ORGANIZATIONS = 50;

function sanitizeString(val: unknown): string | null {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function sanitizeStringArray(val: unknown): string[] {
  const result = new Set<string>();
  if (Array.isArray(val)) {
    for (const item of val) {
      const sanitized = sanitizeString(item);
      if (sanitized) result.add(sanitized);
    }
  } else if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      if (v === true) {
        const sanitized = sanitizeString(k);
        if (sanitized) result.add(sanitized);
      } else if (typeof v === 'string') {
        const sanitized = sanitizeString(v);
        if (sanitized) result.add(sanitized);
      }
    }
  }
  return Array.from(result);
}

function isExcludedStatus(status: unknown): boolean {
  const s = sanitizeString(status)?.toLowerCase();
  if (!s) return false;
  return ['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'].includes(s);
}

function getCandidateIdsFromUser(userData: admin.firestore.DocumentData): string[] {
  const ids = new Set<string>();
  
  const addId = (id: unknown) => {
    const s = sanitizeString(id);
    if (s) ids.add(s);
  };

  addId(userData.activeOrganizationId);
  addId(userData.primaryOrganizationId);
  addId(userData.organizationId);
  
  if (Array.isArray(userData.organizationIds)) {
    userData.organizationIds.forEach(addId);
  }
  if (Array.isArray(userData.memberships)) {
    userData.memberships.forEach((m: unknown) => {
      if (typeof m === 'string') addId(m);
      else if (m && typeof m === 'object' && m !== null) {
        addId((m as Record<string, unknown>).organizationId);
      }
    });
  }
  return Array.from(ids);
}

export async function handleConnectSessionContextRequest(
  req: express.Request,
  res: express.Response,
  deps: ConnectSessionContextDependencies
) {
  const startTimeMs = Date.now();
  let authorizedOrganizationCount = 0;
  let activeOrganizationIdResolved: string | null = null;
  let maskedUid = 'unknown';
  let hasGlobalRole = false;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const authHeader = req.headers.authorization;
    if (
      !authHeader || 
      typeof authHeader !== 'string' || 
      !authHeader.trim().toLowerCase().startsWith('bearer ') ||
      authHeader.trim().toLowerCase() === 'bearer'
    ) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await deps.verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }

    const uid = sanitizeString(decoded.uid);
    if (!uid) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required.' });
    }
    maskedUid = uid.substring(0, 3) + '***' + uid.substring(uid.length - 3);

    const db = deps.getDb();
    if (!db) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'Database service unavailable.' });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', error: 'User profile not found.' });
    }

    const userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', error: 'User profile empty.' });
    }

    if (isExcludedStatus(userData.status) || userData.disabled === true) {
      return res.status(403).json({ success: false, code: 'USER_INACTIVE', error: 'User account is inactive.' });
    }

    const systemRole = sanitizeString(userData.systemRole) || 'user';
    hasGlobalRole = isCanonicalGlobalRole(systemRole);

    const sessionUser: ConnectSessionUser = {
      uid,
      displayName: sanitizeString(userData.displayName) || sanitizeString(userData.name),
      photoUrl: sanitizeString(userData.photoURL) || sanitizeString(userData.photoUrl) || sanitizeString(userData.avatarUrl),
      locale: sanitizeString(userData.locale) || sanitizeString(userData.language),
      systemRole,
      capabilities: sanitizeStringArray(userData.capabilities).slice(0, 100)
    };

    const potentialOrgIds = new Set<string>();
    getCandidateIdsFromUser(userData).forEach(id => potentialOrgIds.add(id));

    try {
      const legacyMembersSnap = await db.collection('organization_members').where('uid', '==', uid).limit(MAX_CANDIDATE_ORGANIZATIONS).get();
      legacyMembersSnap.docs.forEach(doc => {
        const oId = sanitizeString(doc.data().organizationId);
        if (oId) potentialOrgIds.add(oId);
      });
    } catch (e) {
      throw new Error('Failed to query organization_members');
    }

    try {
      const q1 = await db.collection('organizations').where('ownerUserId', '==', uid).limit(MAX_CANDIDATE_ORGANIZATIONS).get();
      q1.docs.forEach(doc => potentialOrgIds.add(doc.id));
      
      const q2 = await db.collection('organizations').where('ownerUid', '==', uid).limit(MAX_CANDIDATE_ORGANIZATIONS).get();
      q2.docs.forEach(doc => potentialOrgIds.add(doc.id));
      
      const q3 = await db.collection('organizations').where('ownerId', '==', uid).limit(MAX_CANDIDATE_ORGANIZATIONS).get();
      q3.docs.forEach(doc => potentialOrgIds.add(doc.id));
    } catch (e) {
      throw new Error('Failed to query owned organizations');
    }

    const candidateIds = Array.from(potentialOrgIds).slice(0, MAX_CANDIDATE_ORGANIZATIONS);
    const authorizedOrganizations: ConnectSessionOrganization[] = [];

    if (candidateIds.length > 0) {
      const orgChunks: string[][] = [];
      for (let i = 0; i < candidateIds.length; i += 10) {
        orgChunks.push(candidateIds.slice(i, i + 10));
      }

      const orgsData = new Map<string, admin.firestore.DocumentData>();
      for (const chunk of orgChunks) {
        try {
          const qs = await db.collection('organizations').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
          qs.docs.forEach(doc => orgsData.set(doc.id, doc.data()));
        } catch (e) {
          throw new Error('Failed to fetch organizations');
        }
      }

      for (const orgId of candidateIds) {
        const orgData = orgsData.get(orgId);
        if (!orgData) continue;

        if (isExcludedStatus(orgData.status) || orgData.disabled === true || orgData.archived === true) {
          continue;
        }

        let membershipData: admin.firestore.DocumentData | null = null;
        try {
          const mDoc = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
          if (mDoc.exists) {
            membershipData = mDoc.data() || null;
          }
        } catch (e) {
          throw new Error('Failed to fetch membership');
        }

        if (hasGlobalRole && !membershipData) {
          authorizedOrganizations.push({
            id: orgId,
            name: sanitizeString(orgData.name) || orgId,
            slug: sanitizeString(orgData.slug),
            status: sanitizeString(orgData.status) || 'active',
            accessSource: 'global_system_role',
            organizationRole: null,
            membershipStatus: null,
            permissions: [],
            capabilities: []
          });
          continue;
        }

        if (!membershipData) continue;
        if (isExcludedStatus(membershipData.status) || membershipData.enabled === false) continue;

        authorizedOrganizations.push({
          id: orgId,
          name: sanitizeString(orgData.name) || orgId,
          slug: sanitizeString(orgData.slug),
          status: sanitizeString(orgData.status) || 'active',
          accessSource: 'organization_membership',
          organizationRole: sanitizeString(membershipData.role) || sanitizeString(membershipData.organizationRole),
          membershipStatus: sanitizeString(membershipData.status) || 'active',
          permissions: sanitizeStringArray(membershipData.permissions).slice(0, 100),
          capabilities: sanitizeStringArray(membershipData.capabilities).slice(0, 100)
        });
      }
    }

    authorizedOrganizations.sort((a, b) => {
      if (a.accessSource === 'organization_membership' && b.accessSource !== 'organization_membership') return -1;
      if (a.accessSource !== 'organization_membership' && b.accessSource === 'organization_membership') return 1;
      
      const roleWeight = (role: string | null) => {
        if (role === 'owner') return 3;
        if (role === 'admin') return 2;
        if (role === 'member') return 1;
        return 0;
      };
      const weightA = roleWeight(a.organizationRole);
      const weightB = roleWeight(b.organizationRole);
      if (weightA !== weightB) return weightB - weightA;

      return a.name.localeCompare(b.name);
    });

    authorizedOrganizationCount = authorizedOrganizations.length;

    const requestedActiveId = sanitizeString(userData.activeOrganizationId);
    const requestedPrimaryId = sanitizeString(userData.primaryOrganizationId);

    if (requestedActiveId && authorizedOrganizations.some(o => o.id === requestedActiveId)) {
      activeOrganizationIdResolved = requestedActiveId;
    } else if (requestedPrimaryId && authorizedOrganizations.some(o => o.id === requestedPrimaryId)) {
      activeOrganizationIdResolved = requestedPrimaryId;
    } else if (authorizedOrganizations.length > 0) {
      activeOrganizationIdResolved = authorizedOrganizations[0].id;
    }

    const activeOrganization = activeOrganizationIdResolved
      ? authorizedOrganizations.find(o => o.id === activeOrganizationIdResolved) || null
      : null;

    let appAccessResponse: { musicscale: ConnectSessionAppAccess } | null = null;
    if (activeOrganizationIdResolved) {
      const appAccessResult = await resolveEcosystemAppAccess({
        uid,
        organizationId: activeOrganizationIdResolved,
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
          organizationId: activeOrganizationIdResolved,
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
      activeOrganizationId: activeOrganizationIdResolved,
      activeOrganization,
      organizations: authorizedOrganizations,
      appAccess: appAccessResponse
    };

    deps.logger.info('ConnectSessionContext success', {
      eventName: 'CONNECT_SESSION_CONTEXT_SUCCESS',
      protocolVersion: '1.0.0',
      maskedUid,
      authorizedOrganizationCount,
      activeOrganizationId: activeOrganizationIdResolved,
      globalAccess: hasGlobalRole,
      result: 'success',
      errorCode: null,
      durationMs: Date.now() - startTimeMs
    });

    return res.status(200).json(payload);

  } catch (err: unknown) {
    deps.logger.error('ConnectSessionContext failed', {
      eventName: 'CONNECT_SESSION_CONTEXT_FAILED',
      protocolVersion: '1.0.0',
      maskedUid,
      authorizedOrganizationCount,
      activeOrganizationId: activeOrganizationIdResolved,
      globalAccess: hasGlobalRole,
      result: 'error',
      errorCode: 'SESSION_CONTEXT_FAILED',
      durationMs: Date.now() - startTimeMs
    });

    return res.status(500).json({
      success: false,
      code: 'SESSION_CONTEXT_FAILED',
      error: 'An internal server error occurred while resolving the session context.'
    });
  }
}
