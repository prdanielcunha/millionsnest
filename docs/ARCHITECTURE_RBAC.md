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
