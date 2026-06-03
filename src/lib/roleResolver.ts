export type SystemRole = 'ceo' | 'admin' | 'global_admin' | 'user';
export type OrganizationRole = 'owner' | 'admin' | 'leader' | 'member';

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
