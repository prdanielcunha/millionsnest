import { isGlobalPrivilegedRole } from './permissionService.js';

export type SystemRole =
  | 'ceo'
  | 'founder'
  | 'ecosystem_owner'
  | 'global_admin'
  | 'ecosystem_support'
  | 'user'
  | 'admin'; // legacy compatibility only

export type OrganizationRole = 'owner' | 'admin' | 'leader' | 'member';

export const ASSIGNABLE_SYSTEM_ROLES = [
  'user',
  'ecosystem_support',
  'global_admin',
  'ecosystem_owner',
  'founder',
  'ceo'
] as const;

export type AssignableSystemRole = (typeof ASSIGNABLE_SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_RANK: Record<string, number> = {
  user: 0,
  ecosystem_support: 40,
  admin: 80, // legacy alias for global_admin
  global_admin: 80,
  ecosystem_owner: 85,
  founder: 90,
  ceo: 100,
};

export const ORG_ROLE_RANK: Record<string, number> = {
  guest: 5,
  member: 10,
  secretary: 20,
  leader: 30,
  admin: 70,
  owner: 100,
};

export function normalizeLegacySystemRole(role: unknown): unknown {
  return role === 'admin' ? 'global_admin' : role;
}

export function isAssignableSystemRole(role: unknown): role is AssignableSystemRole {
  const normalized = normalizeLegacySystemRole(role);
  return typeof normalized === 'string'
    && ASSIGNABLE_SYSTEM_ROLES.includes(normalized as AssignableSystemRole);
}

export function getSystemRoleLabel(role: string | undefined | null): string {
  switch (role) {
    case 'ceo': return 'CEO do Ecossistema';
    case 'founder': return 'Fundador';
    case 'ecosystem_owner': return 'Proprietário do Ecossistema';
    case 'global_admin': return 'Administrador Global';
    case 'admin': return 'Administrador Global (legado)';
    case 'ecosystem_support': return 'Suporte do Ecossistema';
    default: return 'Usuário Padrão';
  }
}

export function canChangeSystemRole(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null,
  newRole: string | undefined | null,
  isSelfDemotion: boolean = false,
  activeCeosCount: number = 0
): { allowed: boolean; message?: string } {
  const actorRank = SYSTEM_ROLE_RANK[actorRole || 'user'] || 0;
  const targetRank = SYSTEM_ROLE_RANK[targetRole || 'user'] || 0;
  const normalizedNewRole = normalizeLegacySystemRole(newRole || 'user');
  const newRank = SYSTEM_ROLE_RANK[String(normalizedNewRole)] || 0;

  if (!isGlobalPrivilegedRole(actorRole) || actorRank === 0) {
    return { allowed: false, message: 'Você não tem permissão para alterar cargos globais.' };
  }

  if (!isAssignableSystemRole(normalizedNewRole)) {
    return { allowed: false, message: 'Cargo global inválido.' };
  }

  // CEO remains the highest operational role and protects the last active CEO.
  if (actorRole === 'ceo') {
    if (isSelfDemotion) {
      if (activeCeosCount <= 1) {
        return { allowed: false, message: 'Não é possível remover o último CEO do ecossistema.' };
      }
      return { allowed: true };
    }
    if (targetRole === 'ceo') {
      return { allowed: false, message: 'Você não pode rebaixar, remover ou alterar o cargo de outro CEO do ecossistema.' };
    }
    return { allowed: true };
  }

  if (newRank > actorRank) {
    return { allowed: false, message: 'Você não pode conceder um cargo acima do seu nível de acesso.' };
  }

  if (targetRank >= actorRank && !isSelfDemotion) {
    return { allowed: false, message: 'Você não pode alterar o cargo de um usuário com o mesmo ou maior nível de acesso.' };
  }

  return { allowed: true };
}

export function canChangeOrganizationRole(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null,
  newRole: string | undefined | null,
  isSelfDemotion: boolean = false,
  activeOwnersCount: number = 0,
  isGlobalAdmin: boolean = false
): { allowed: boolean; message?: string } {
  if (isGlobalAdmin) {
    return { allowed: true };
  }

  const actorRank = ORG_ROLE_RANK[actorRole || 'member'] || 0;
  const targetRank = ORG_ROLE_RANK[targetRole || 'member'] || 0;
  const newRank = ORG_ROLE_RANK[newRole || 'member'] || 0;

  if (actorRank < 70) {
    return { allowed: false, message: 'Você não tem permissão para gerenciar funções neste nível.' };
  }

  if (actorRank === 100) {
    if (isSelfDemotion) {
      if (activeOwnersCount <= 1) {
        return { allowed: false, message: 'Não é possível remover o último dono da organização.' };
      }
      return { allowed: true };
    }
    if (targetRank === 100) {
      return { allowed: false, message: 'Você não pode rebaixar ou alterar outro dono. Apenas o próprio usuário pode se rebaixar.' };
    }
    return { allowed: true };
  }

  if (actorRank === 70) {
    if (newRank >= 100) {
      return { allowed: false, message: 'Você não pode conceder ou alterar um cargo acima do seu nível na organização.' };
    }
    if (targetRank >= 70 && !isSelfDemotion) {
      return { allowed: false, message: 'Você não pode alterar outro administrador ou dono. Apenas donos podem alterar administradores.' };
    }
    return { allowed: true };
  }

  return { allowed: false, message: 'Acesso negado.' };
}

export function canAssignSystemRole(
  actor: { systemRole?: string | null } | null | undefined,
  targetRole: string
): boolean {
  const normalizedTarget = normalizeLegacySystemRole(targetRole);
  if (!isAssignableSystemRole(normalizedTarget)) return false;
  const actorRank = SYSTEM_ROLE_RANK[actor?.systemRole || 'user'] || 0;
  const targetRank = SYSTEM_ROLE_RANK[String(normalizedTarget)] || 0;
  return isGlobalPrivilegedRole(actor?.systemRole) && actorRank >= targetRank;
}

export function canAssignOrganizationRole(
  actorMember: { role?: string } | null | undefined,
  targetRole: string,
  isGlobalAdmin: boolean = false
): boolean {
  if (isGlobalAdmin) return true;
  const actorRank = ORG_ROLE_RANK[actorMember?.role || 'member'] || 0;
  const targetRank = ORG_ROLE_RANK[targetRole || 'member'] || 0;
  return actorRank >= targetRank && actorRank >= 70;
}

export type ResolvedUserRoleDisplay = {
  primaryRoleLabel: string;
  secondaryRoleLabel?: string;
  badges: Array<{
    label: string;
    tone: 'purple' | 'blue' | 'gold' | 'gray' | 'green';
    priority: number;
  }>;
  systemRole?: SystemRole;
  organizationRole?: OrganizationRole;
  appRole?: string;
  isGlobalPrivilegedUser: boolean;
};

export function resolveUserRoleDisplay({
  userProfile,
  organizationMember,
  appRole
}: {
  userProfile?: { systemRole?: string | null };
  organizationMember?: { role?: string };
  appRole?: string;
}): ResolvedUserRoleDisplay {
  const systemRole = (userProfile?.systemRole || 'user') as SystemRole;
  const organizationRole = (organizationMember?.role || 'member') as OrganizationRole;
  const globalPrivileged = isGlobalPrivilegedRole(systemRole);

  const badges: ResolvedUserRoleDisplay['badges'] = [];
  let primaryRoleLabel = '';
  let secondaryRoleLabel = '';

  if (globalPrivileged) {
    primaryRoleLabel = getSystemRoleLabel(systemRole);
    const tone =
      systemRole === 'ceo' || systemRole === 'founder' ? 'gold'
      : systemRole === 'ecosystem_owner' ? 'purple'
      : 'blue';
    badges.push({
      label: systemRole === 'admin' ? 'Admin Global · legado' : getSystemRoleLabel(systemRole),
      tone,
      priority: 1
    });
  } else if (systemRole === 'ecosystem_support') {
    primaryRoleLabel = getSystemRoleLabel(systemRole);
    badges.push({ label: 'Suporte', tone: 'green', priority: 2 });
  }

  let orgLabel = '';
  let orgBadgeLabel = '';
  let orgBadgeTone: 'purple' | 'blue' | 'gold' | 'gray' | 'green' = 'gray';

  switch (organizationRole) {
    case 'owner':
      orgLabel = 'Dono da Organização';
      orgBadgeLabel = 'Dono';
      orgBadgeTone = 'purple';
      break;
    case 'admin':
      orgLabel = 'Administrador da Organização';
      orgBadgeLabel = 'Admin Org';
      break;
    case 'leader':
      orgLabel = 'Líder / Ministro';
      orgBadgeLabel = 'Líder';
      break;
    case 'member':
    default:
      orgLabel = 'Membro';
      orgBadgeLabel = 'Membro';
      break;
  }

  if (primaryRoleLabel) {
    if (organizationMember?.role) {
      secondaryRoleLabel = orgLabel;
      badges.push({ label: orgBadgeLabel, tone: orgBadgeTone, priority: 3 });
    }
  } else {
    primaryRoleLabel = orgLabel;
    badges.push({ label: orgBadgeLabel, tone: orgBadgeTone, priority: 3 });
  }

  if (appRole) {
    if (!primaryRoleLabel) {
      primaryRoleLabel = appRole;
    } else if (!secondaryRoleLabel) {
      secondaryRoleLabel = appRole;
    }
    badges.push({ label: appRole, tone: 'gray', priority: 4 });
  }

  badges.sort((a, b) => a.priority - b.priority);

  return {
    primaryRoleLabel,
    secondaryRoleLabel: secondaryRoleLabel || undefined,
    badges,
    systemRole,
    organizationRole,
    appRole,
    isGlobalPrivilegedUser: globalPrivileged
  };
}
