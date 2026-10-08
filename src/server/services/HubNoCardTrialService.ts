/** Server-only, no-card NestLocal trial. Never creates Stripe billing records or changes MusicScale. */
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
export const HUB_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export class HubTrialError extends Error {
  constructor(public readonly code: string, public readonly httpStatus = 409) {
    super(code);
    this.name = 'HubTrialError';
  }
}
/** A used Hub trial disqualifies a second Stripe trial, even after flag rollback. */
export function shouldAddStripeTrial(params: {
  appId: 'nestlocal' | 'musicscale';
  hasLegacyTrialHistory: boolean;
  internalTrialConsumed: boolean;
  newNestLocalTrialEnabled: boolean;
}): boolean {
  if (params.hasLegacyTrialHistory || params.internalTrialConsumed) return false;
  if (params.appId === 'nestlocal' && params.newNestLocalTrialEnabled) return false;
  return true;
}
export async function hasConsumedHubTrial(db: Firestore, orgId: string, appId: 'nestlocal' | 'musicscale'): Promise<boolean> {
  if (appId !== 'nestlocal') return false;
  if (!orgId || orgId.includes('/')) throw new HubTrialError('INVALID_ORGANIZATION', 400);
  return (await db.collection('nestlocal_internal_trials').doc(orgId).get()).exists;
}
function timeMs(value: any): number | null {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
export async function activateNestLocalHubTrial(params: {
  db: Firestore;
  organizationId: string;
  ownerUid: string;
  stripeHistoricalClear: boolean;
  nowMs?: number;
}): Promise<{
  status: 'created' | 'already_active'; organizationId: string;
  startsAt: string; expiresAt: string; canRead: boolean; canWrite: boolean;
}> {
  const { db, organizationId, ownerUid } = params;
  if (!organizationId || !ownerUid || organizationId.includes('/') || ownerUid.includes('/')) {
    throw new HubTrialError('INVALID_TRIAL_ACTIVATION', 400);
  }
  if (!params.stripeHistoricalClear) throw new HubTrialError('PRIOR_SUBSCRIPTION_OR_STRIPE_UNVERIFIED');
  const nowMs = params.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw new HubTrialError('INVALID_SERVER_TIME', 500);
  const beginsAt = Timestamp.fromMillis(nowMs);
  const expiresAt = Timestamp.fromMillis(nowMs + HUB_TRIAL_DURATION_MS);
  const orgRef = db.collection('organizations').doc(organizationId);
  const subRef = db.collection('subscriptions').doc(organizationId);
  const trialRef = db.collection('nestlocal_internal_trials').doc(organizationId);
  const ownerRef = db.collection('nestlocal_trial_owners').doc(ownerUid);
  const entitlementRef = orgRef.collection('app_entitlements').doc('nestlocal');
  return db.runTransaction(async (tx) => {
    const [orgSnap, subSnap, trialSnap, ownerSnap, entitlementSnap] = await Promise.all([
      tx.get(orgRef), tx.get(subRef), tx.get(trialRef), tx.get(ownerRef), tx.get(entitlementRef),
    ]);
    if (!orgSnap.exists) throw new HubTrialError('ORGANIZATION_NOT_FOUND', 404);
    const org = orgSnap.data() || {};
    if (org.disabled === true || ['inactive', 'archived', 'suspended', 'disabled'].includes(String(org.status || ''))) {
      throw new HubTrialError('ORGANIZATION_INACTIVE');
    }
    if (trialSnap.exists) {
      const grant = trialSnap.data() || {};
      const start = timeMs(grant.beginsAt);
      const end = timeMs(grant.expiresAt);
      if (grant.ownerUid === ownerUid && start !== null && end !== null &&
          grant.status === 'active' && grant.revoked !== true && nowMs < end) {
        return {
          status: 'already_active' as const, organizationId,
          startsAt: new Date(start).toISOString(), expiresAt: new Date(end).toISOString(),
          canRead: true, canWrite: true,
        };
      }
      throw new HubTrialError('TRIAL_ALREADY_CONSUMED');
    }
    if (ownerSnap.exists) throw new HubTrialError('OWNER_TRIAL_ALREADY_CONSUMED');
    const appSubscription = subSnap.exists ? subSnap.data()?.apps?.nestlocal : undefined;
    const appProjection = org.apps?.nestlocal;
    const entitlement = entitlementSnap.exists ? entitlementSnap.data() : undefined;
    if (appSubscription && Object.keys(appSubscription).length > 0) {
      throw new HubTrialError('PRIOR_NESTLOCAL_SUBSCRIPTION');
    }
    if (appProjection && (appProjection.stripeSubscriptionId || appProjection.trialUsed ||
        ['active', 'trialing', 'expired', 'canceled', 'cancelled', 'past_due', 'unpaid'].includes(String(appProjection.status || '')))) {
      throw new HubTrialError('PRIOR_NESTLOCAL_ACCESS');
    }
    if (entitlement && (entitlement.trialUsed || entitlement.stripeSubscriptionId || entitlement.source)) {
      throw new HubTrialError('PRIOR_NESTLOCAL_ENTITLEMENT');
    }
    const source = 'hub_internal_trial';
    tx.create(trialRef, {
      appId: 'nestlocal', organizationId, ownerUid, source,
      status: 'active', revoked: false, consumed: true, grantVersion: 2,
      beginsAt, expiresAt, createdAt: beginsAt, cohort: 'nestlocal_no_card_v1',
      idempotencyKey: 'nestlocal_internal_trial:' + organizationId,
    });
    tx.create(ownerRef, { organizationId, appId: 'nestlocal', trialRef: trialRef.path, createdAt: beginsAt });
    tx.set(entitlementRef, {
      schemaVersion: 3, appId: 'nestlocal', source,
      accessState: 'internal_trial_active', trialUsed: true,
      trialStartedAt: beginsAt, trialEndsAt: expiresAt,
      canRead: true, canWrite: true, canUseAI: true,
      billingState: 'not_started', updatedAt: beginsAt,
    });
    tx.update(orgRef, {
      'apps.nestlocal.status': 'trialing',
      'apps.nestlocal.trialSource': source,
      'apps.nestlocal.trialUsed': true,
      'apps.nestlocal.trialEndsAt': expiresAt,
    });
    return {
      status: 'created' as const, organizationId,
      startsAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + HUB_TRIAL_DURATION_MS).toISOString(),
      canRead: true, canWrite: true,
    };
  });
}
