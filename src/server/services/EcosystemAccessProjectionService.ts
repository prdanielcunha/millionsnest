import * as express from 'express';
import { mapCanonicalDecisionToCatalogState, MusicScaleAccessProjection } from '../../lib/ecosystemAccessProjection.js';
import { resolveEcosystemAppAccess } from './EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';

export interface EcosystemAccessProjectionDependencies {
  verifyIdToken: (token: string) => Promise<admin.auth.DecodedIdToken>;
  getDb: () => admin.firestore.Firestore | null;
  resolveAccess: typeof resolveEcosystemAppAccess;
  now: () => number;
  logger: any;
}

export async function handleEcosystemAccessProjectionRequest(
  req: express.Request,
  res: express.Response,
  deps: EcosystemAccessProjectionDependencies
) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  let logUid: string | null = null;
  let logOrgId: string | null = null;
  let accessProjection: Partial<MusicScaleAccessProjection> = {};

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

    logUid = decoded.uid;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Invalid request.' });
    }

    const { organizationId: rawOrgId } = req.body;
    
    if (!rawOrgId || typeof rawOrgId !== 'string') {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Invalid request.' });
    }
    
    const organizationId = rawOrgId.trim();
    if (!organizationId) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Invalid request.' });
    }
    if (organizationId.length > 256) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Invalid request.' });
    }
    if (
      organizationId.includes('..') ||
      organizationId.includes('/') ||
      organizationId.includes('\\') ||
      organizationId === '.' ||
      /[\x00-\x1F\x7F]/.test(organizationId)
    ) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', error: 'Invalid request.' });
    }

    logOrgId = organizationId;

    const db = deps.getDb();
    if (!db) {
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'Access projection service unavailable.' });
    }

    const accessDecision = await deps.resolveAccess({
      uid: decoded.uid,
      organizationId,
      appId: 'musicscale',
      db
    });

    const catalogState = mapCanonicalDecisionToCatalogState(
      accessDecision.accessible,
      accessDecision.isGlobalAccess,
      accessDecision.denialReason,
      accessDecision.entitlement?.canonicalStatus,
      accessDecision.entitlement?.cancellationScheduled
    );

    const generatedAtMs = deps.now();

    const projection: MusicScaleAccessProjection = {
      appId: 'musicscale',
      organizationId,
      accessible: accessDecision.accessible,
      isGlobalAccess: accessDecision.isGlobalAccess,
      accessSource: accessDecision.accessSource,
      decisionState: accessDecision.accessible ? 'granted' : 'denied',
      denialReason: accessDecision.denialReason || null,
      catalogState,
      entitlement: accessDecision.entitlement ? {
        canonicalStatus: accessDecision.entitlement.canonicalStatus,
        cancellationScheduled: accessDecision.entitlement.cancellationScheduled,
        currentPeriodEndMs: accessDecision.entitlement.currentPeriodEndMs,
        individualAccessSource: accessDecision.entitlement.individualAccessSource
      } : null
    };

    accessProjection = projection;

    const maskedUid = decoded.uid ? `${decoded.uid.substring(0, 3)}...` : '...';
    deps.logger.log('[ACCESS_PROJECTION]', {
      appId: 'musicscale',
      organizationId,
      maskedUid,
      accessible: projection.accessible,
      isGlobalAccess: projection.isGlobalAccess,
      accessSource: projection.accessSource,
      denialReason: projection.denialReason,
      catalogState: projection.catalogState,
      timestamp: generatedAtMs
    });

    return res.status(200).json({
      success: true,
      organizationId,
      generatedAtMs,
      apps: {
        musicscale: projection
      }
    });
  } catch (e: any) {
    deps.logger.error('[ACCESS_PROJECTION_FATAL_ERROR]', {
      appId: 'musicscale',
      organizationId: logOrgId,
      maskedUid: logUid ? `${logUid.substring(0, 3)}...` : '...',
      timestamp: deps.now(),
      code: 'ACCESS_PROJECTION_FAILED'
    });
    return res.status(500).json({
      success: false,
      code: 'ACCESS_PROJECTION_FAILED',
      error: 'Could not resolve application access.'
    });
  }
}
