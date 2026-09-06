# Architecture: RBAC (Role-Based Access Control)

## Core Philosophy
Roles represent **organizational identity**.
Permissions represent **actual capabilities**.

We do **NOT** use hardcoded role evaluations in the frontend (e.g., `if (role === 'admin')`). Instead, evaluate explicit namespace permissions (e.g., `if (permissions['organization.manageMembers'])`).

## Roles
- `owner`: Has absolute administrative control, including billing. Cannot be demoted or removed easily without transferring ownership.
- `admin`: Operational administrator.
- `secretary`: Specific operational role (customizable permissions).
- `member`: Standard access.
- `guest`: Read-only or highly restricted access.

**PROHIBITED:** 
- Do NOT hardcode logic based purely on string `role` matching in the view layer.
- Do NOT establish generic permission names like `manage` or `edit`.

## Versioning
Permissions are versioned using `permissionsVersion`. 
This allows backward compatibility when introducing new apps in the MillionsNest multi-app ecosystem. 
If an older user logs in without namespaced permissions, the `normalizePermissions` function automatically maps legacy boolean values to the new namespaced standard based on their `role`.


## Global ecosystem roles

Canonical global roles are:

- `ceo` — highest operational authority; the last active CEO cannot self-demote.
- `founder` — founder-level governance, below CEO for role assignment.
- `ecosystem_owner` — ecosystem governance, below Founder and above Global Admin.
- `global_admin` — global administration.
- `ecosystem_support` — support entitlement role; it is **not** global governance.
- `user` — no global privilege.

The historical `admin` system role is **legacy compatibility only**. It remains recognized so existing live users are not locked out before Firestore can be inventoried and migrated, but the UI/API must normalize new `admin` assignments to `global_admin`.

Global-role decisions must use the helpers in `src/lib/permissionService.ts` and `src/lib/roleResolver.ts`. Do not introduce new hardcoded arrays such as `['ceo', 'admin', 'global_admin']` in server or frontend code.
