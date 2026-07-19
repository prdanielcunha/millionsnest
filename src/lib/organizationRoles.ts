export const ORGANIZATION_ROLE_KEYS = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer'
} as const;

export type OrganizationRole = typeof ORGANIZATION_ROLE_KEYS[keyof typeof ORGANIZATION_ROLE_KEYS];

export type InviteableOrganizationRole = 'admin' | 'manager' | 'member' | 'viewer';

export const INVITEABLE_ORGANIZATION_ROLES: InviteableOrganizationRole[] = ['admin', 'manager', 'member', 'viewer'];

export function normalizeExistingOrganizationRole(role: string): string {
  if (!role) return 'viewer';
  const r = role.toLowerCase().trim();
  if (r === 'secretary') return 'manager';
  if (r === 'guest') return 'viewer';
  return r;
}

export function isInviteableOrganizationRole(role: string): role is InviteableOrganizationRole {
  return INVITEABLE_ORGANIZATION_ROLES.includes(role as any);
}

export interface OrganizationInviteActor {
  systemRole?: string | null;
  organizationRole?: string | null;
}

export function getInviteableOrganizationRolesForActor(actor: OrganizationInviteActor): InviteableOrganizationRole[] {
  if (!actor) return [];

  const sys = actor.systemRole?.toLowerCase() || '';
  if (sys === 'ceo' || sys === 'global_admin' || sys === 'ecosystem_owner' || sys === 'founder') {
    return ['admin', 'manager', 'member', 'viewer'];
  }

  const org = actor.organizationRole ? normalizeExistingOrganizationRole(actor.organizationRole) : '';
  
  if (org === 'owner') {
    return ['admin', 'manager', 'member', 'viewer'];
  }
  if (org === 'admin') {
    return ['admin', 'manager', 'member', 'viewer'];
  }
  if (org === 'manager') {
    return ['manager', 'member', 'viewer'];
  }
  return [];
}

export function getOrganizationRoleLabel(role: string, locale: 'pt' | 'en' | 'es' = 'pt'): string {
  const normalized = normalizeExistingOrganizationRole(role);
  const labels: Record<string, Record<'pt' | 'en' | 'es', string>> = {
    owner: { pt: 'Proprietário', en: 'Owner', es: 'Propietario' },
    admin: { pt: 'Administrador', en: 'Administrator', es: 'Administrador' },
    manager: { pt: 'Gestor', en: 'Manager', es: 'Gestor' },
    member: { pt: 'Membro', en: 'Member', es: 'Miembro' },
    viewer: { pt: 'Visualizador', en: 'Viewer', es: 'Visualizador' },
    leader: { pt: 'Líder (Legado)', en: 'Leader (Legacy)', es: 'Líder (Legado)' }
  };
  return labels[normalized]?.[locale] || role;
}

export function getOrganizationRoleDescription(role: string, locale: 'pt' | 'en' | 'es' = 'pt'): string {
  const normalized = normalizeExistingOrganizationRole(role);
  const descriptions: Record<string, Record<'pt' | 'en' | 'es', string>> = {
    owner: {
      pt: 'Controle total da organização, cobrança e aplicativos.',
      en: 'Full control over organization, billing, and apps.',
      es: 'Control total de la organización, facturación y aplicaciones.'
    },
    admin: {
      pt: 'Pode gerenciar configurações, integrantes, convites e funções da organização. Não controla cobrança ou propriedade.',
      en: 'Can manage settings, members, invitations, and organization roles. No control over billing or ownership.',
      es: 'Puede administrar configuraciones, integrantes, invitaciones y roles de la organización. No controla la facturación ni la propiedad.'
    },
    manager: {
      pt: 'Pode organizar a equipe e convidar membros, sem acesso a cobrança, aplicativos ou propriedade.',
      en: 'Can organize the team and invite members, without access to billing, apps, or ownership.',
      es: 'Puede organizar el equipo e invitar miembros, sin acceso a facturación, aplicaciones ni propiedad.'
    },
    member: {
      pt: 'Participa da organização e usa os aplicativos que forem liberados para ele.',
      en: 'Participates in the organization and uses the apps released to them.',
      es: 'Participa en la organización y utiliza las aplicaciones que se le liberen.'
    },
    viewer: {
      pt: 'Pode consultar informações liberadas, sem fazer alterações.',
      en: 'Can view released information, without making changes.',
      es: 'Puede consultar información liberada, sin realizar cambios.'
    },
    leader: {
      pt: 'Função de liderança legada de equipes.',
      en: 'Legacy team leadership role.',
      es: 'Rol de liderazgo de equipo legado.'
    }
  };
  return descriptions[normalized]?.[locale] || '';
}

export function getRoleHierarchyScore(role: string): number {
  const normalized = normalizeExistingOrganizationRole(role);
  switch (normalized) {
    case 'owner': return 100;
    case 'admin': return 80;
    case 'manager': return 60;
    case 'member': return 40;
    case 'viewer': return 20;
    default: return 0;
  }
}

export function canInviteOrganizationRole(actor: OrganizationInviteActor, targetRole: string): boolean {
  if (!isInviteableOrganizationRole(targetRole)) return false;
  return getInviteableOrganizationRolesForActor(actor).includes(targetRole as InviteableOrganizationRole);
}
