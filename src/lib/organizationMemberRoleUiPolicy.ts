import { normalizeExistingOrganizationRole } from './organizationRoles.js';

export type MemberRoleUiPolicyInput = {
  actorUid?: string | null;
  actorIsGlobalPrivileged?: boolean;
  actorOrganizationRole?: string | null;
  actorIsAuthoritativeOwner?: boolean;
  targetUid?: string | null;
  targetOrganizationRole?: string | null;
  authoritativeOwnerUid?: string | null;
};

export type MemberRoleUiPolicyDecision = {
  canEdit: boolean;
  reason:
    | 'allowed_global'
    | 'allowed_authoritative_owner'
    | 'allowed_global_owner_repair'
    | 'allowed_owner_membership'
    | 'allowed_admin'
    | 'self'
    | 'authoritative_owner_target'
    | 'protected_owner_target'
    | 'protected_admin_target'
    | 'insufficient_role';
};

/**
 * Client-side affordance policy only.
 *
 * The server remains authoritative for every mutation. This helper intentionally
 * allows an actor whose current organization membership says "owner" to attempt
 * repair of a stale owner target even when the client organization projection
 * is missing/outdated. The backend then verifies the real organization owner
 * metadata and the actor's global role from Firestore before applying anything.
 */
export function getMemberRoleUiPolicy(
  input: MemberRoleUiPolicyInput,
): MemberRoleUiPolicyDecision {
  const actorUid = String(input.actorUid || '');
  const targetUid = String(input.targetUid || '');
  if (!targetUid || (actorUid && actorUid === targetUid)) {
    return { canEdit: false, reason: 'self' };
  }

  const authoritativeOwnerUid = String(input.authoritativeOwnerUid || '');

  const actorRole = normalizeExistingOrganizationRole(
    String(input.actorOrganizationRole || ''),
  );

  if (authoritativeOwnerUid && authoritativeOwnerUid === targetUid) {
    if (input.actorIsGlobalPrivileged && actorRole === 'owner') {
      return { canEdit: true, reason: 'allowed_global_owner_repair' };
    }
    return { canEdit: false, reason: 'authoritative_owner_target' };
  }
  const targetRole = normalizeExistingOrganizationRole(
    String(input.targetOrganizationRole || 'member'),
  );

  if (input.actorIsGlobalPrivileged) {
    return { canEdit: true, reason: 'allowed_global' };
  }

  if (input.actorIsAuthoritativeOwner) {
    return { canEdit: true, reason: 'allowed_authoritative_owner' };
  }

  // Important recovery path: the client can know the signed-in actor is the
  // organization owner from membership data while its organization metadata
  // projection is stale/missing. Let the server decide whether this owner
  // authority is canonical before performing the mutation.
  if (actorRole === 'owner') {
    return { canEdit: true, reason: 'allowed_owner_membership' };
  }

  if (actorRole === 'admin') {
    if (targetRole === 'owner') {
      return { canEdit: false, reason: 'protected_owner_target' };
    }
    if (targetRole === 'admin') {
      return { canEdit: false, reason: 'protected_admin_target' };
    }
    return { canEdit: true, reason: 'allowed_admin' };
  }

  return { canEdit: false, reason: 'insufficient_role' };
}
