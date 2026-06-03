export type SystemRole = 'ceo' | 'admin' | 'global_admin' | 'user';
export type OrganizationRole = 'owner' | 'admin' | 'leader' | 'member';

export const SYSTEM_ROLE_RANK: Record<string, number> = {
  user: 0,
  admin: 80,
  global_admin: 80,
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

export function canChangeSystemRole(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null,
  newRole: string | undefined | null,
  isSelfDemotion: boolean = false,
  activeCeosCount: number = 0
): { allowed: boolean; message?: string } {
  const actorRank = SYSTEM_ROLE_RANK[actorRole || 'user'] || 0;
  const targetRank = SYSTEM_ROLE_RANK[targetRole || 'user'] || 0;
  const newRank = SYSTEM_ROLE_RANK[newRole || 'user'] || 0;

  if (actorRank === 0) {
    return { allowed: false, message: 'Você não tem permissão para alterar cargos globais.' };
  }

  // CEO rules
  if (actorRank === 100) {
    if (isSelfDemotion) {
       if (activeCeosCount <= 1) {
          return { allowed: false, message: 'Não é possível remover o último CEO do ecossistema.' };
       }
       return { allowed: true };
    }
    if (targetRank === 100) {
       return { allowed: false, message: 'Você não pode rebaixar, remover ou alterar o cargo de outro CEO do ecossistema.' };
    }
    return { allowed: true };
  }

  // Admin rules
  if (actorRank === 80) {
    if (newRank > actorRank) {
       return { allowed: false, message: 'Você não pode conceder um cargo acima do seu nível de acesso.' };
    }
    if (targetRank >= actorRank && !isSelfDemotion) {
       return { allowed: false, message: 'Você não pode alterar o cargo de um usuário com o mesmo ou maior nível de acesso.' };
    }
    return { allowed: true };
  }

  return { allowed: false, message: 'Acesso negado.' };
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

  // Owner rules
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

  // Admin rules
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

export function canAssignSystemRole(actor: { systemRole?: string | null } | null | undefined, targetRole: string): boolean {
  const actorRank = SYSTEM_ROLE_RANK[actor?.systemRole || 'user'] || 0;
  const targetRank = SYSTEM_ROLE_RANK[targetRole || 'user'] || 0;
  return actorRank >= targetRank && actorRank > 0;
}

export function canAssignOrganizationRole(actorMember: { role?: string } | null | undefined, targetRole: string, isGlobalAdmin: boolean = false): boolean {
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
  
  const isGlobalPrivilegedUser = ['ceo', 'admin', 'global_admin'].includes(systemRole);
  
  const badges: ResolvedUserRoleDisplay['badges'] = [];
  let primaryRoleLabel = '';
  let secondaryRoleLabel = '';

  // 1. Resolve System Role
  if (systemRole === 'ceo') {
    primaryRoleLabel = 'CEO do Ecossistema';
    badges.push({ label: 'CEO', tone: 'gold', priority: 1 });
  } else if (systemRole === 'admin' || systemRole === 'global_admin') {
    primaryRoleLabel = 'Administrador Global';
    badges.push({ label: 'Admin Global', tone: 'blue', priority: 2 });
  }

  // 2. Resolve Organization Role
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
      orgBadgeTone = 'gray';
      break;
    case 'leader':
      orgLabel = 'Líder / Ministro';
      orgBadgeLabel = 'Líder';
      orgBadgeTone = 'gray';
      break;
    case 'member':
    default:
      orgLabel = 'Membro';
      orgBadgeLabel = 'Membro';
      orgBadgeTone = 'gray';
      break;
  }

  // Se tiver um master role, o org label vira secundario
  if (primaryRoleLabel) {
    if (organizationMember?.role) {
      secondaryRoleLabel = orgLabel;
      badges.push({ label: orgBadgeLabel, tone: orgBadgeTone, priority: 3 });
    }
  } else {
    // senao o org label dita as regras
    primaryRoleLabel = orgLabel;
    badges.push({ label: orgBadgeLabel, tone: orgBadgeTone, priority: 3 });
  }

  // App Role if provided
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
    isGlobalPrivilegedUser
  };
}
