/**
 * Tenant-aware Permissions and RBAC for MillionsNest OS
 */

export type AppResource = 'musicscale' | 'cultoflow' | 'cells' | 'core_org' | 'core_billing';
export type AppAction = 'read' | 'write' | 'manage' | 'delete';
export type CapabilityString = `${AppResource}.${AppAction}`;

export interface RoleDefinition {
  name: string;
  capabilities: CapabilityString[];
  isSystemAdmin?: boolean;
}

export const DEFAULT_ROLES: Record<string, RoleDefinition> = {
  owner: {
    name: 'Owner',
    capabilities: [
      'core_org.manage',
      'core_billing.manage',
      'musicscale.manage',
      'cultoflow.manage',
      'cells.manage'
    ]
  },
  admin: {
    name: 'Admin',
    capabilities: [
      'core_org.read',
      'musicscale.manage',
      'cultoflow.manage',
      'cells.manage'
    ]
  },
  member: {
    name: 'Member',
    capabilities: [
      'core_org.read',
      'musicscale.read',
      'cultoflow.read',
      'cells.read'
    ]
  }
};

/**
 * Validates if a given role has a specific capability.
 */
export function hasCapability(roleId: string, capability: CapabilityString, customRoles?: Record<string, RoleDefinition>): boolean {
  if (roleId === 'system_admin') return true;

  const roleDefinitions = { ...DEFAULT_ROLES, ...customRoles };
  const role = roleDefinitions[roleId];
  
  if (!role) return false;

  // If role is manager of that domain, allow specific actions implicitly
  const [resource, action] = capability.split('.');
  if (action === 'read' && role.capabilities.includes(`${resource}.manage` as CapabilityString)) {
    return true;
  }
  if (action === 'write' && role.capabilities.includes(`${resource}.manage` as CapabilityString)) {
    return true;
  }

  return role.capabilities.includes(capability);
}

/**
 * Higher Order logic to determine UI paths
 */
export function canAccessApp(roleId: string, resource: AppResource): boolean {
  return hasCapability(roleId, `${resource}.read`, DEFAULT_ROLES);
}
