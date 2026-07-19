export const CURRENT_PERMISSIONS_VERSION = 2;

export const ROLE_KEYS = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
  SECRETARY: 'secretary',
  GUEST: 'guest',
} as const;

export type RoleKey = typeof ROLE_KEYS[keyof typeof ROLE_KEYS];

export const PERMISSION_KEYS = {
  ORG_UPDATE_SETTINGS: 'organization.settings.update',
  ORG_MANAGE_MEMBERS: 'organization.members.manage',
  ORG_INVITE_MEMBERS: 'organization.members.invite',
  ORG_MANAGE_ROLES: 'organization.roles.manage',
  ORG_MANAGE_BILLING: 'organization.billing.manage',
  ORG_MANAGE_APPS: 'organization.apps.manage',
  ORG_VIEW_AUDIT: 'organization.audit.view',
  MUSIC_MANAGE_SONGS: 'musicscale.songs.manage',
  MUSIC_EDIT_SONGS: 'musicscale.songs.edit',
  MUSIC_MANAGE_SCALES: 'musicscale.scales.manage',
  MUSIC_MANAGE_TEAMS: 'musicscale.teams.manage',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

export const FEATURE_KEYS = {
  TEAMS: 'teams',
  REPERTOIRE: 'repertoire',
  AUTOMATIZATIONS: 'automatizations',
  METRICS: 'metrics',
  WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];
