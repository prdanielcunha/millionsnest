import * as admin from 'firebase-admin';
import { resolveEcosystemAppAccess, ResolvedAppAccess } from './EcosystemAccessResolver.js';

export interface HandoffParams {
  uid: string;
  appId: string;
  orgId?: string;
  supportMode?: boolean;
}

export interface HandoffResult {
  customToken: string;
  orgId: string;
  uid: string;
  expiresAt: number;
}

/**
 * Service to execute the handoff logic for MusicScale using the canonical EcosystemAccessResolver.
 * Avoids any dynamic Stripe checks or self-healing routines, relying strictly on Firestore state.
 */
export class MusicScaleHandoffService {
  private db: admin.firestore.Firestore;
  private auth: admin.auth.Auth;

  constructor(db: admin.firestore.Firestore, auth: admin.auth.Auth) {
    this.db = db;
    this.auth = auth;
  }

  /**
   * Resolves candidate organization IDs for a given user.
   */
  public async getCandidateOrganizations(uid: string): Promise<string[]> {
    const candidateOrgs = new Set<string>();

    try {
      const userDoc = await this.db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        if (userData.activeOrganizationId) candidateOrgs.add(userData.activeOrganizationId);
        if (userData.primaryOrganizationId) candidateOrgs.add(userData.primaryOrganizationId);
        if (userData.organizationId) candidateOrgs.add(userData.organizationId);

        if (Array.isArray(userData.organizations)) {
          userData.organizations.forEach((id: any) => {
            if (typeof id === 'string') candidateOrgs.add(id);
          });
        }
      }
    } catch (err) {
      console.warn('[MusicScaleHandoffService] Failed to fetch user doc for candidates:', err);
    }

    try {
      const legacyMembersSnap = await this.db.collection('organization_members')
        .where('uid', '==', uid)
        .get();
      legacyMembersSnap.docs.forEach(doc => {
        const oId = doc.data()?.organizationId;
        if (oId && typeof oId === 'string') {
          candidateOrgs.add(oId);
        }
      });
    } catch (err) {
      console.warn('[MusicScaleHandoffService] Failed to fetch legacy memberships for candidates:', err);
    }

    return Array.from(candidateOrgs);
  }

  /**
   * Performs the handoff checks and creates a Custom Token.
   */
  public async processHandoff(params: HandoffParams): Promise<HandoffResult> {
    const { uid, appId, orgId, supportMode } = params;

    if (appId !== 'musicscale') {
      throw new Error('Invalid app');
    }

    // 1. Identify user system roles (Global Admin check)
    const userDoc = await this.db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const systemRole = userData?.systemRole;
    const isGlobalAdmin = systemRole === 'ceo' || systemRole === 'admin' || systemRole === 'global_admin';

    let verifiedSupportMode = false;
    if (supportMode === true) {
      if (!isGlobalAdmin) {
        throw new Error('Forbidden: only global admins can use support mode');
      }
      verifiedSupportMode = true;
    }

    // 2. Resolve organization ID list
    const candidateOrgs = await this.getCandidateOrganizations(uid);
    let chosenOrgId: string | null = null;
    let accessGranted = false;
    let subscriptionStatus: string | null = null;

    // A. If a specific orgId was requested
    if (orgId && typeof orgId === 'string' && orgId.trim() !== '') {
      const targetOrgId = orgId.trim();

      // For non-admins, ensure they have a link to the target org to prevent security cross-tenant access violations
      if (!isGlobalAdmin && !candidateOrgs.includes(targetOrgId)) {
        throw new Error('Forbidden: You do not have access to this organization.');
      }

      // Check access via canonical resolver
      const access = await resolveEcosystemAppAccess({
        uid,
        organizationId: targetOrgId,
        appId: 'musicscale',
        db: this.db,
      });

      if (access.accessible) {
        chosenOrgId = targetOrgId;
        accessGranted = true;
        subscriptionStatus = access.entitlement?.subscriptionStatus || 'active';
      } else {
        // Log access denied
        console.warn(`[MusicScaleHandoffService] Access denied for user ${uid} to org ${targetOrgId}. Reason: ${access.denialReason}`);
      }
    } else {
      // B. Loop over candidates to find the first one that is accessible
      for (const oId of candidateOrgs) {
        const access = await resolveEcosystemAppAccess({
          uid,
          organizationId: oId,
          appId: 'musicscale',
          db: this.db,
        });

        if (access.accessible) {
          chosenOrgId = oId;
          accessGranted = true;
          subscriptionStatus = access.entitlement?.subscriptionStatus || 'active';
          break;
        }
      }
    }

    // 3. Handle global admin fallback if no subscription/access found (or define final org id)
    const finalOrgId = chosenOrgId || (orgId && orgId.trim() !== '' ? orgId.trim() : (candidateOrgs.length > 0 ? candidateOrgs[0] : uid));

    if (!isGlobalAdmin && !accessGranted) {
      // Print clean handover log on denial (important for test suite compliance)
      console.log('[HANDOFF]', {
        uid,
        organizationId: finalOrgId,
        subscriptionFound: false,
        subscriptionStatus: null,
        stripeLookupPerformed: false,
        selfHealingExecuted: false,
        accessGranted: false,
      });

      throw new Error('Access denied: Subscription missing. Reason: No active subscription found in Firestore or Stripe for users organizations.');
    }

    // Print clean handover log on success
    console.log('[HANDOFF]', {
      uid,
      organizationId: finalOrgId,
      subscriptionFound: accessGranted,
      subscriptionStatus,
      stripeLookupPerformed: false,
      selfHealingExecuted: false,
      accessGranted: true,
    });

    const customToken = await this.auth.createCustomToken(uid, {
      orgId: finalOrgId,
      appId,
      supportMode: verifiedSupportMode,
    });

    return {
      customToken,
      orgId: finalOrgId,
      uid,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
  }
}
