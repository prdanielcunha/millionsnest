# MillionsNest Ecosystem Architecture Rules

## 1. Single Source of Truth
- **Subscription state:** `/subscriptions/{organizationId}`
- **Owner identity:** `/organizations/{orgId}` -> `ownerUid: uid`
- **Member relation:** `/organization_members/{uid}_{orgId}` -> `role` & `permissions`

## 2. RBAC Contract
- Always use `permissions` (capabilities object) to check access via the frontend, NEVER the `role` directly.
- Ensure all permissions are NAMESPACED: e.g. `organization.manageMembers` or `musicScale.manageSongs`
- Always bump `CURRENT_PERMISSIONS_VERSION` in `src/lib/constants.ts` when adding a new permission property.

## 3. Stripe & Webhook Integration
- Webbooks are handled in `server.ts`. 
- Stripe manages the billing. Webhook handles the infrastructure provisioning into Firebase.
- Do NOT build parallel billing logic. Use the existing API endpoints and webhooks.
- Prohibited from checking `subscription.status` inside `/users/{uid}`, it must be loaded from `/subscriptions/{orgId}`.

## 4. Multi-app Isolation
- App development features should NOT bleed into cross-domain contexts.
- Each core domain entity MUST be nested under the logic of `where("organizationId", "==", orgId)`.

**Violation of these constraints will result in breaking the current ecosystem architecture.**
