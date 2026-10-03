import { isAllowedAppDestinationPath } from './appExperienceRegistry.js';

export type InvitationTargetAppId = 'musicscale' | 'nestfinance' | 'nestlocal' | 'nestjourney';

export type InvitationAppTarget = {
  appId: InvitationTargetAppId;
  appName: string;
  destinationPath: string;
  membershipAccessKey: 'musicscale' | 'nestFinance' | 'nestlocal' | 'nestjourney';
};

const TARGETS: Readonly<Record<InvitationTargetAppId, Omit<InvitationAppTarget, 'appId'>>> = {
  musicscale: {
    appName: 'MusicScale',
    destinationPath: '/start',
    membershipAccessKey: 'musicscale',
  },
  nestfinance: {
    appName: 'NestFinance',
    destinationPath: '/',
    membershipAccessKey: 'nestFinance',
  },
  nestlocal: {
    appName: 'NestLocal',
    destinationPath: '/',
    membershipAccessKey: 'nestlocal',
  },
  nestjourney: {
    appName: 'NestJourney',
    destinationPath: '/',
    membershipAccessKey: 'nestjourney',
  },
};

export type ResolveInvitationAppTargetResult =
  | { success: true; target: InvitationAppTarget | null }
  | { success: false; reasonCode: 'INVALID_TARGET_APP' | 'INVALID_TARGET_PATH' };

export function isInvitationTargetAppId(value: unknown): value is InvitationTargetAppId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGETS, value);
}

export function resolveInvitationAppTarget(
  rawAppId: unknown,
  rawDestinationPath?: unknown,
): ResolveInvitationAppTargetResult {
  if (rawAppId === undefined || rawAppId === null || rawAppId === '') {
    return { success: true, target: null };
  }

  if (!isInvitationTargetAppId(rawAppId)) {
    return { success: false, reasonCode: 'INVALID_TARGET_APP' };
  }

  const definition = TARGETS[rawAppId];
  const destinationPath =
    rawDestinationPath === undefined || rawDestinationPath === null || rawDestinationPath === ''
      ? definition.destinationPath
      : typeof rawDestinationPath === 'string'
        ? rawDestinationPath.trim()
        : '';

  if (!destinationPath || !isAllowedAppDestinationPath(rawAppId, destinationPath)) {
    return { success: false, reasonCode: 'INVALID_TARGET_PATH' };
  }

  return {
    success: true,
    target: {
      appId: rawAppId,
      appName: definition.appName,
      destinationPath,
      membershipAccessKey: definition.membershipAccessKey,
    },
  };
}

export function buildInvitationLaunchPath(target: InvitationAppTarget | null): string {
  if (!target) return '/dashboard/overview';
  const params = new URLSearchParams();
  params.set('returnTo', target.destinationPath);
  return `/apps/${encodeURIComponent(target.appId)}/launch?${params.toString()}`;
}

export function buildInvitationMemberAppAccess(
  existingAppAccess: unknown,
  target: InvitationAppTarget | null,
  organizationRole: string,
): Record<string, unknown> | undefined {
  if (!target) return undefined;

  const root =
    existingAppAccess && typeof existingAppAccess === 'object' && !Array.isArray(existingAppAccess)
      ? { ...(existingAppAccess as Record<string, unknown>) }
      : {};

  const existing =
    root[target.membershipAccessKey] &&
    typeof root[target.membershipAccessKey] === 'object' &&
    !Array.isArray(root[target.membershipAccessKey])
      ? { ...(root[target.membershipAccessKey] as Record<string, unknown>) }
      : {};

  const normalizedRole = String(organizationRole || 'member').trim().toLowerCase() || 'member';

  const next: Record<string, unknown> = {
    ...existing,
    enabled: true,
    roles: Array.isArray(existing.roles) && existing.roles.length > 0 ? existing.roles : [normalizedRole],
  };

  if (target.appId === 'nestlocal') {
    const existingPermissions = Array.isArray(existing.permissions)
      ? existing.permissions.filter((value): value is string => typeof value === 'string')
      : [];
    next.permissions = Array.from(new Set([...existingPermissions, 'nestlocal.manage']));
    next.scopes =
      existing.scopes && typeof existing.scopes === 'object'
        ? existing.scopes
        : { nestlocal: ['manage'] };
  }

  root[target.membershipAccessKey] = next;
  return root;
}

export function getInvitationTargetAppName(appId: unknown): string | null {
  if (!isInvitationTargetAppId(appId)) return null;
  return TARGETS[appId].appName;
}
