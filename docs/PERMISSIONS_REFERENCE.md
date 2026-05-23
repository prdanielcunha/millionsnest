# Permissions Reference

All capabilities within the MillionsNest ecosystem must be explicitly documented and checked using a fully namespaced string. 

## Namespace Structure
`{appName}.{action}{Resource}`

## Core Permissions

### Organization Level
- `organization.manageMembers`: Add, remove, or invite members to the organization.
- `organization.manageRoles`: Change roles/capabilities for other members (cannot change Owner).
- `organization.manageBilling`: Access billing portal to upgrade or downgrade subscription.
- `organization.manageOrganization`: Edit organization name, settings, or delete the organization.

### Music Scale App
- `musicScale.manageSongs`: Add, edit, or remove songs in the organization's repertoire.
- `musicScale.manageScales`: Create, edit, or delete event schedules/scales.
- `musicScale.manageTeams`: Manage team composition within the music scope.

## Multiapp Readiness
As new apps are integrated (e.g., Cells, Cults, Financials), their permissions must be added to `AppPermissions` type in `src/lib/rbac.ts` following this strict namespacing format:
- `future.cells.manageCells`
- `future.cult.manageServices`

Always bump `CURRENT_PERMISSIONS_VERSION` when adding or deprecating permissions to trigger normalization flows.
