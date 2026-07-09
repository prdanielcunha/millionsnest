import * as admin from 'firebase-admin';
import { isCanonicalGlobalRole, isLegacyGlobalRole } from '../../../src/lib/permissionService.js';

export type EcosystemAppId = 'musicscale' | 'nestfinance';
export type AppAccessSource = 'global_system_role' | 'organization_membership' | 'denied';
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
  MEMBER_APP_ACCESS_DISABLED: 'MEMBER_APP_ACCESS_DISABLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SCOPE_DENIED: 'SCOPE_DENIED',
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
  if (userData.status === 'inactive' || userData.status === 'suspended' || userData.disabled === true) {
    return { ...defaultDenied, denialReason: DENIAL_REASONS.USER_INACTIVE };
  }

  const systemRole = userData.systemRole;
  
  const hasGlobalRole = isCanonicalGlobalRole(systemRole) || isLegacyGlobalRole(systemRole);

  // Etapa 2 — papel global validation
  // Load target organization
  const orgRef = db.collection('organizations').doc(organizationId);
  const orgDoc = await orgRef.get();
  
  if (!orgDoc.exists) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_NOT_FOUND };
  }
  
  const orgData = orgDoc.data() || {};
  if (orgData.status === 'archived' || orgData.status === 'inactive' || orgData.status === 'suspended') {
     return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.ORGANIZATION_INACTIVE };
  }

  if (hasGlobalRole) {
    return {
      appId,
      organizationId,
      accessible: true,
      isGlobalAccess: true,
      accessSource: 'global_system_role',
      systemRole,
      roles: ['global_admin'],
      permissions: ['*'],
      scopes: { '*': ['*'] }
    };
  }

  // Etapa 3 — usuário organizacional
  const memRef = db.collection(`organizations/${organizationId}/members`).doc(uid);
  const memDoc = await memRef.get();
  
  if (!memDoc.exists) {
    return { ...defaultDenied, systemRole, denialReason: DENIAL_REASONS.MEMBERSHIP_NOT_FOUND };
  }
  
  const memData = memDoc.data() || {};
  if (memData.status === 'inactive' || memData.status === 'suspended') {
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
        scopes: memData.appAccess.nestFinance.scopes || {}
     };
  }

  // Comportamento legacy pro MusicScale (mesmo que a integridade completa esteja fora daqui)
  if (appId === 'musicscale') {
     return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED };
  }

  return { ...defaultDenied, systemRole, organizationRole, denialReason: DENIAL_REASONS.APP_NOT_ENABLED };
}
