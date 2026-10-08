import * as admin from 'firebase-admin';
import { canAccessNestFinanceDevelopment, resolveEcosystemPrivilegePolicy } from '../../../src/lib/permissionService.js';
import { isNestLocalInternalTrialActive, isNestLocalInternalTrialExpired } from './NestLocalAiEntitlement.js';
import { trialWindow } from './HubTrialExtensionService.js';
import { hasPriorMusicScaleSubscription } from './MusicScaleNoCardTrialService.js';

export type EcosystemAppId = 'musicscale' | 'nestfinance' | 'nestlocal' | 'nestjourney' | 'nestlive';
export type AppAccessSource = 'global_system_role' | 'organization_membership' | 'denied';

export type CanonicalAppAccessState = 'granted' | 'denied';

export type CanonicalMusicScaleSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'inactive'
  | 'missing'
  | 'unknown';

export type MusicScaleIndividualAccessSource =
  | 'explicit_enabled'
  | 'membership_compatibility'
  | 'explicit_disabled'
  | 'global_system_role';

export type MusicScaleEntitlementDecision = {
  subscriptionStatus: string | null;
  organizationAppStatus: string | null;
  canonicalStatus: CanonicalMusicScaleSubscriptionStatus;
  cancellationScheduled: boolean;
  currentPeriodEndMs: number | null;
  individualAccessSource: MusicScaleIndividualAccessSource;
};

export type ResolvedAppAccess = {
  appId: EcosystemAppId;
  organizationId: string;
  accessible: boolean;
  // Explicit capabilities for newer Hub clients; legacy boolean access retained.
  readOnly?: boolean;
  canWrite?: boolean;
  canUseAI?: boolean;
  isGlobalAccess: boolean;
  accessSource: AppAccessSource;
  systemRole?: string;
  organizationRole?: string;
  roles: string[];
  permissions: string[];
  scopes?: Record<string, string[]>;
  denialReason?: string;
  decisionState?: CanonicalAppAccessState;
  entitlement?: MusicScaleEntitlementDecision;
};

export const DENIAL_REASONS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  ORGANIZATION_REQUIRED: 'ORGANIZATION_REQUIRED',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_INACTIVE: 'ORGANIZATION_INACTIVE',
  MEMBERSHIP_NOT_FOUND: 'MEMBERSHIP_NOT_FOUND',
  MEMBERSHIP_INACTIVE: 'MEMBERSHIP_INACTIVE',
  APP_NOT_ENABLED: 'APP_NOT_ENABLED',
  ENTITLEMENT_NOT_CONFIGURED: 'ENTITLEMENT_NOT_CONFIGURED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_PAYMENT_REQUIRED: 'SUBSCRIPTION_PAYMENT_REQUIRED',
  ENTITLEMENT_INACTIVE: 'ENTITLEMENT_INACTIVE',
  MEMBER_APP_ACCESS_DISABLED: 'MEMBER_APP_ACCESS_DISABLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SCOPE_DENIED: 'SCOPE_DENIED',
  NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED: 'NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED',
} as const;

export async function resolveEcosystemAppAccess(params: {
  uid: string | null | undefined;
  organizationId: string | null | undefined;
  appId: EcosystemAppId;
  db: admin.firestore.Firestore;
}): Promise<ResolvedAppAccess> {
  const { uid, organizationId, appId, db } = params;

  const defaultDenied: ResolvedAppAccess = {
    appId,
    // @ts-ignore
    organizationId: organizationId || '',
    accessible: false,
    isGlobalAccess: false,
    accessSource: 'denied',
    roles: [],
    permissions: [],
    decisionState: 'denied'
  };

  if (!uid) {
    return { ...defaultDenied, denialReason: DENIAL_REASONS.UNAUTHENTICATED };
  }

  if (!organizationId) {
    return { ...defaultDenied, denialReason: DENIAL_REASONS.ORGANIZATION_REQUIRED };
  }

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return { ...defaultDenied, denialReason: DENIAL_REASONS.USER_NOT_FOUND };
  }

  const userData = userDoc.data() || {};
  if (userData.status === 'inactive' || userData.status === 'suspended' || userData.status === 'disabled' || userData.disabled === true) {
    return { ...defaultDenied, denialReason: DENIAL_REASONS.USER_INACTIVE };
  }

  const systemRole = userData.systemRole;
  const privilegePolicy = resolveEcosystemPrivilegePolicy(systemRole);
  const hasGlobalRole = privilegePolicy.canManageGlobalGovernance;

  const orgRef = db.collection('organizations').doc(organizationId);
  const orgDoc = await orgRef.get();

  if (!orgDoc.exists) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_NOT_FOUND };
  }

  const orgData = orgDoc.data() || {};
  if (orgData.status === 'archived' || orgData.status === 'inactive' || orgData.status === 'suspended' || orgData.status === 'disabled' || orgData.disabled === true) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_INACTIVE };
  }

  if (appId === 'nestfinance' && !canAccessNestFinanceDevelopment(systemRole)) {
    return {
      ...defaultDenied,
      systemRole,
      denialReason: DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED
    };
  }

  if (privilegePolicy.isEcosystemSupportStaff && appId === 'musicscale') {
    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: true,
      accessSource: 'global_system_role',
      systemRole,
      roles: ['ecosystem_support'],
      permissions: [
        'songs.read', 'songs.create', 'songs.update', 'songs.delete',
        'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
        'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
        'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
        'scaleResponses.readManaged'
      ],
      scopes: { musicscale: ['support'] },
      decisionState: 'granted',
      entitlement: {
        subscriptionStatus: null,
        organizationAppStatus: null,
        canonicalStatus: 'active',
        cancellationScheduled: false,
        currentPeriodEndMs: null,
        individualAccessSource: 'global_system_role'
      }
    };
  }

  if (hasGlobalRole) {
    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: true,
      accessSource: 'global_system_role',
      systemRole,
      roles: systemRole ? [systemRole === 'admin' ? 'global_admin' : systemRole] : [],
      permissions: ['*'],
      scopes: { '*': ['*'] },
      decisionState: 'granted',
      ...(appId === 'musicscale' ? {
        entitlement: {
          subscriptionStatus: null,
          organizationAppStatus: null,
          canonicalStatus: 'active',
          cancellationScheduled: false,
          currentPeriodEndMs: null,
          individualAccessSource: 'global_system_role'
        }
      } : {})
    };
  }

  const memRef = db.collection(`organizations/${organizationId}/members`).doc(uid);
  const memDoc = await memRef.get();

  if (!memDoc.exists) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.MEMBERSHIP_NOT_FOUND };
  }

  const memData = memDoc.data() || {};
  if (
    memData.enabled === false ||
    memData.status === 'inactive' ||
    memData.status === 'suspended' ||
    memData.status === 'disabled' ||
    memData.status === 'removed' ||
    memData.status === 'revoked' ||
    memData.status === 'archived'
  ) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.MEMBERSHIP_INACTIVE };
  }

  const organizationRole = memData.role || memData.organizationRole || 'member';
  const enabledApps = orgData.enabledApps || [];

  if (appId === 'nestfinance') {
    if (!enabledApps.includes('nestfinance')) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.APP_NOT_ENABLED };
    }

    const hasEntitlement = orgData.entitlements?.nestfinance?.active === true || orgData.entitlements?.nestfinance?.status === 'active';
    if (!hasEntitlement) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED };
    }

    if (memData.appAccess?.nestFinance?.enabled !== true) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED };
    }

    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      systemRole,
      organizationRole,
      roles: memData.appAccess.nestFinance.roles || [],
      permissions: memData.appAccess.nestFinance.permissions || [],
      scopes: memData.appAccess.nestFinance.scopes || {},
      decisionState: 'granted'
    };
  }

  if (appId === 'nestjourney') {
    const orgAppAccess = orgData.apps?.nestjourney || orgData.apps?.raiz_e_mesa;
    const appStatus = String(orgAppAccess?.status || '').trim().toLowerCase();
    if (!['active', 'trialing'].includes(appStatus)) {
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason: orgAppAccess ? DENIAL_REASONS.ENTITLEMENT_INACTIVE : DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED
      };
    }

    const memberAccess = memData.appAccess?.nestjourney || memData.appAccess?.raiz_e_mesa;
    if (memberAccess?.enabled === false) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED };
    }

    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      systemRole,
      organizationRole,
      roles: memberAccess?.roles || [organizationRole],
      permissions: memberAccess?.permissions || [],
      scopes: memberAccess?.scopes || {},
      decisionState: 'granted'
    };
  }

  if (appId === 'nestlocal') {
    const subDoc = await db.collection('subscriptions').doc(organizationId).get();
    const appSubscription = subDoc.exists ? subDoc.data()?.apps?.nestlocal : null;
    const orgAppAccess = orgData.apps?.nestlocal;
    // Dedicated server-issued, no-card internal trial. Strictly opt-in; does not modify Stripe.
    const internalTrialEnabled = process.env.NESTLOCAL_INTERNAL_TRIAL_ENABLED === 'true';
    const trialDoc = internalTrialEnabled
      ? await db.collection('nestlocal_internal_trials').doc(organizationId).get()
      : null;
    const internalTrialActive = internalTrialEnabled &&
      isNestLocalInternalTrialActive(trialDoc?.exists ? trialDoc.data() : null);
    const internalTrialExpired = internalTrialEnabled &&
      isNestLocalInternalTrialExpired(trialDoc?.exists ? trialDoc.data() : null, Date.now(), organizationId);

    const subscriptionStatus = String(appSubscription?.status || '').toLowerCase();
    const organizationAppStatus = String(orgAppAccess?.status || '').toLowerCase();
    const paymentIssueStatuses = ['past_due', 'unpaid', 'incomplete', 'paused'];
    const activeStatuses = ['active', 'trialing'];

    // A valid paid/Stripe legacy subscription wins over an expired Hub trial.
    // Otherwise a verified expired Hub trial may open READ-ONLY; it cannot
    // grant AI, write or fresh Stripe trial in any downstream consumer.
    const internalTrialReadOnly = internalTrialExpired && !activeStatuses.includes(subscriptionStatus) &&
      !paymentIssueStatuses.includes(subscriptionStatus);
    if (!appSubscription && !internalTrialActive && !internalTrialReadOnly) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.SUBSCRIPTION_NOT_FOUND };
    }
    if (paymentIssueStatuses.includes(subscriptionStatus)) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.SUBSCRIPTION_PAYMENT_REQUIRED };
    }
    if (!activeStatuses.includes(subscriptionStatus) && !internalTrialActive && !internalTrialReadOnly) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.SUBSCRIPTION_INACTIVE };
    }
    if (!activeStatuses.includes(organizationAppStatus)) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.ENTITLEMENT_INACTIVE };
    }

    const memberAccess = memData.appAccess?.nestlocal;
    const normalizedOrganizationRole = String(organizationRole).toLowerCase();
    const isOwner = normalizedOrganizationRole === 'owner';
    if (!isOwner && memberAccess?.enabled !== true) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED };
    }
    const canManage = isOwner
      || memData.permissions?.['nestlocal.manage'] === true
      || memberAccess?.permissions?.includes?.('nestlocal.manage');
    if (!canManage) {
      return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.PERMISSION_DENIED };
    }

    return {
      appId,
      organizationId,
      accessible: true,
      readOnly: internalTrialReadOnly,
      canWrite: !internalTrialReadOnly,
      canUseAI: !internalTrialReadOnly,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      systemRole,
      organizationRole,
      roles: internalTrialReadOnly ? ['reader'] : (memberAccess?.roles || [organizationRole]),
      permissions: internalTrialReadOnly ? ['nestlocal.read'] : (memberAccess?.permissions || ['nestlocal.manage']),
      scopes: internalTrialReadOnly ? { nestlocal: ['read'] } : (memberAccess?.scopes || { nestlocal: ['manage'] }),
      decisionState: 'granted'
    };
  }

  if (appId === 'nestlive') {
    const orgAppAccess = orgData.apps?.nestlive;
    const appStatus = String(orgAppAccess?.status || '').trim().toLowerCase();
    const enabledApps = Array.isArray(orgData.enabledApps) ? orgData.enabledApps : [];
    const organizationEnabled =
      enabledApps.includes('nestlive') ||
      ['active', 'trialing', 'beta'].includes(appStatus);

    if (!organizationEnabled) {
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason: orgAppAccess
          ? DENIAL_REASONS.ENTITLEMENT_INACTIVE
          : DENIAL_REASONS.APP_NOT_ENABLED
      };
    }

    const memberAccess = memData.appAccess?.nestlive;
    if (memberAccess?.enabled === false) {
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason: DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED
      };
    }

    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      systemRole,
      organizationRole,
      roles: memberAccess?.roles || [organizationRole],
      permissions: memberAccess?.permissions || ['nestlive.use'],
      scopes: memberAccess?.scopes || { nestlive: ['use'] },
      decisionState: 'granted'
    };
  }

    if (appId === 'musicscale') {
    let individualAccessSource: MusicScaleIndividualAccessSource = 'membership_compatibility';

    if (memData.appAccess?.musicscale?.enabled === false) {
      individualAccessSource = 'explicit_disabled';
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason: DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED,
        decisionState: 'denied',
        entitlement: {
          subscriptionStatus: null,
          organizationAppStatus: null,
          canonicalStatus: 'missing',
          cancellationScheduled: false,
          currentPeriodEndMs: null,
          individualAccessSource
        }
      };
    } else if (memData.appAccess?.musicscale?.enabled === true) {
      individualAccessSource = 'explicit_enabled';
    }

    const subRef = db.collection('subscriptions').doc(organizationId);
    const subDoc = await subRef.get();

    // New, explicitly piloted MusicScale trial. Stripe-backed subscriptions
    // continue through the legacy branch below, unchanged.
    const musicScaleSubscriptionAlreadyRecorded = subDoc.exists &&
      hasPriorMusicScaleSubscription(subDoc.data());
    if (!musicScaleSubscriptionAlreadyRecorded &&
        orgData.apps?.musicscale?.trialSource === 'hub_internal_trial' &&
        process.env.MUSICSCALE_INTERNAL_TRIAL_ENABLED === 'true') {
      const trialSnap = await db.collection('musicscale_internal_trials').doc(organizationId).get();
      const window = trialWindow('musicscale',trialSnap.exists?trialSnap.data():null,Date.now(),organizationId);
      if (window.valid) {
        const readonly = window.expired;
        const p = memData.appAccess?.musicscale;
        return {
          appId,organizationId,accessible:true,readOnly:readonly,
          canWrite:!readonly,canUseAI:!readonly,isGlobalAccess:false,
          accessSource:'organization_membership',systemRole,organizationRole,
          roles:readonly?['reader']:(p?.roles||[]),
          permissions:readonly?['songs.read','scales.read','bandScales.read']:(p?.permissions||[]),
          scopes:readonly?{musicscale:['read']}:(p?.scopes||{}),
          decisionState:'granted',
          entitlement:{
            subscriptionStatus:readonly?'internal_trial_expired':'internal_trial_active',
            organizationAppStatus:String(orgData.apps?.musicscale?.status||''),
            canonicalStatus:readonly?'inactive':'trialing',
            cancellationScheduled:false,currentPeriodEndMs:window.endsAt,
            individualAccessSource,
          },
        };
      }
    }

    if (!subDoc.exists) {
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason: DENIAL_REASONS.SUBSCRIPTION_NOT_FOUND,
        decisionState: 'denied',
        entitlement: {
          subscriptionStatus: null,
          organizationAppStatus: null,
          canonicalStatus: 'missing',
          cancellationScheduled: false,
          currentPeriodEndMs: null,
          individualAccessSource
        }
      };
    }

    const subData = subDoc.data() || {};
    const appSubscription = subData.apps?.musicscale || null;
    const subscriptionStatus = String(
      appSubscription?.status || subData.status || ''
    ).trim().toLowerCase();

    // subscriptions/{orgId}.apps.musicscale is the canonical product purchase.
    // organizations/{orgId}.apps.musicscale is a projection/cache and may lag
    // briefly after checkout or reconciliation. A stale/missing cache must
    // never hide a valid paid/trialing product from an authenticated member.
    const orgAppAccess = orgData.apps?.musicscale || null;
    const normalizedOrganizationAppStatus = String(
      orgAppAccess?.status || ''
    ).trim().toLowerCase();
    const organizationAppStatus = normalizedOrganizationAppStatus || null;

    let canonicalStatus: CanonicalMusicScaleSubscriptionStatus = 'unknown';
    let denialReason: string | undefined = undefined;

    const validStatuses = ['active', 'trialing'];
    const subIsValid = validStatuses.includes(subscriptionStatus);

    const cancellationScheduled =
      appSubscription?.cancelAtPeriodEnd === true ||
      appSubscription?.cancel_at_period_end === true ||
      subData.cancelAtPeriodEnd === true ||
      subData.cancel_at_period_end === true;

    if (subIsValid) {
      canonicalStatus = subscriptionStatus === 'trialing' ? 'trialing' : 'active';
    } else {
      if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(subscriptionStatus)) {
        denialReason = DENIAL_REASONS.SUBSCRIPTION_PAYMENT_REQUIRED;
      } else {
        denialReason = DENIAL_REASONS.SUBSCRIPTION_INACTIVE;
      }
      canonicalStatus = 'inactive';
    }

    const currentPeriodValue =
      appSubscription?.currentPeriodEnd ||
      subData.currentPeriodEnd ||
      appSubscription?.trialEndsAt ||
      subData.trialEndsAt ||
      null;
    const currentPeriodEndMs =
      currentPeriodValue && typeof currentPeriodValue.toMillis === 'function'
        ? currentPeriodValue.toMillis()
        : currentPeriodValue && typeof currentPeriodValue.seconds === 'number'
          ? currentPeriodValue.seconds * 1000
          : typeof currentPeriodValue === 'number'
            ? currentPeriodValue
            : null;

    const entitlement: MusicScaleEntitlementDecision = {
      subscriptionStatus,
      organizationAppStatus,
      canonicalStatus,
      cancellationScheduled,
      currentPeriodEndMs,
      individualAccessSource
    };

    if (denialReason) {
      return {
        ...defaultDenied,
        systemRole,
        organizationRole,
        denialReason,
        decisionState: 'denied',
        entitlement
      };
    }

    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      systemRole,
      organizationRole,
      roles: memData.appAccess?.musicscale?.roles || [],
      permissions: memData.appAccess?.musicscale?.permissions || [],
      scopes: memData.appAccess?.musicscale?.scopes || {},
      decisionState: 'granted',
      entitlement
    };
  }

  return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.APP_NOT_ENABLED };
}
