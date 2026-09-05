import * as admin from 'firebase-admin';
import { isCanonicalGlobalRole, canAccessNestFinanceDevelopment } from '../../../src/lib/permissionService.js';

export type EcosystemAppId = 'musicscale' | 'nestfinance' | 'nestjourney' | 'raiz_e_mesa' | 'raiz-e-mesa';
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

  // Etapa 1 — identidade
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
  
  const hasGlobalRole = isCanonicalGlobalRole(systemRole);

  // Etapa 2 — papel global validation
  // Load target organization
  const orgRef = db.collection('organizations').doc(organizationId);
  const orgDoc = await orgRef.get();
  
  if (!orgDoc.exists) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_NOT_FOUND };
  }
  
  const orgData = orgDoc.data() || {};
  if (orgData.status === 'archived' || orgData.status === 'inactive' || orgData.status === 'suspended' || orgData.status === 'disabled' || orgData.disabled === true) {
     return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_INACTIVE };
  }


  if (
    appId === 'nestfinance' &&
    !canAccessNestFinanceDevelopment(systemRole)
  ) {
    return {
      ...defaultDenied,
      systemRole,
      denialReason:
        DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED
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
      roles: systemRole ? [systemRole] : [],
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

  // Etapa 3 — usuário organizacional
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
     
     // Entitlement explícito
     const hasEntitlement = orgData.entitlements?.nestfinance?.active === true || orgData.entitlements?.nestfinance?.status === 'active';
     if (!hasEntitlement) {
        return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED };
     }
     
     // Validar appAccess.nestFinance.enabled
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

  // NestJourney usa entitlement específico do produto; aliases antigos preservam compatibilidade.
  if (appId === 'nestjourney' || appId === 'raiz_e_mesa' || appId === 'raiz-e-mesa') {
     const appEntitlement = orgData.apps?.nestjourney || orgData.apps?.raiz_e_mesa || orgData.apps?.['raiz-e-mesa'];
     const validStatuses = ['active', 'trialing'];
     if (!appEntitlement || !validStatuses.includes(appEntitlement.status)) {
        return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED };
     }
     const memberAccess = memData.appAccess?.nestjourney || memData.appAccess?.raiz_e_mesa || memData.appAccess?.['raiz-e-mesa'];
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

  // Comportamento canônico para MusicScale
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
     const subscriptionStatus = subData.status;

     const orgAppAccess = orgData.apps?.musicscale;
     if (!orgAppAccess) {
        return {
           ...defaultDenied,
           systemRole,
           organizationRole,
           denialReason: DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED,
           decisionState: 'denied',
           entitlement: {
              subscriptionStatus,
              organizationAppStatus: null,
              canonicalStatus: 'missing',
              cancellationScheduled: false,
              currentPeriodEndMs: subData.currentPeriodEnd ? (subData.currentPeriodEnd.toMillis ? subData.currentPeriodEnd.toMillis() : (subData.currentPeriodEnd.seconds ? subData.currentPeriodEnd.seconds * 1000 : null)) : null,
              individualAccessSource
           }
        };
     }

     const organizationAppStatus = orgAppAccess.status;
     let canonicalStatus: CanonicalMusicScaleSubscriptionStatus = 'unknown';
     let denialReason: string | undefined = undefined;

     const validStatuses = ['active', 'trialing'];
     const subIsValid = validStatuses.includes(subscriptionStatus);
     const appIsValid = validStatuses.includes(organizationAppStatus);

     let cancellationScheduled = false;

     if (subIsValid && appIsValid) {
        if (subscriptionStatus === 'active') {
           canonicalStatus = 'active';
        } else if (subscriptionStatus === 'trialing') {
           canonicalStatus = 'trialing';
        }
        if (subData.cancelAtPeriodEnd === true || subData.cancel_at_period_end === true) {
           cancellationScheduled = true;
        }
     } else {
        if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(subscriptionStatus)) {
           denialReason = DENIAL_REASONS.SUBSCRIPTION_PAYMENT_REQUIRED;
        } else if (['canceled', 'none', 'expired', 'incomplete_expired'].includes(subscriptionStatus)) {
           denialReason = DENIAL_REASONS.SUBSCRIPTION_INACTIVE;
        } else if (!subIsValid) {
           denialReason = DENIAL_REASONS.SUBSCRIPTION_INACTIVE; // Fallback
        } else if (!appIsValid) {
           denialReason = DENIAL_REASONS.ENTITLEMENT_INACTIVE;
        }
        canonicalStatus = 'inactive';
     }

     const currentPeriodEndMs = (subData.currentPeriodEnd && typeof subData.currentPeriodEnd.toMillis === 'function') 
        ? subData.currentPeriodEnd.toMillis() 
        : (subData.currentPeriodEnd && typeof subData.currentPeriodEnd.seconds === 'number' 
           ? subData.currentPeriodEnd.seconds * 1000 
           : null);

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

