# Architecture: Organization Lifecycle

## Principles
The Organization is the root context in MillionsNest. Everything revolves around the Organization (Users, Billing, Roles, Multiapps).

## Creation
1. An organization is created upon a user signing up or completing an initial subscription checkout.
2. The user who creates the organization is automatically assigned the `owner` role.
3. The Owner is synced across three points:
   - `organizations/{orgId}` -> `ownerUid: uid`
   - `organization_members/{uid}_{orgId}` -> `role: 'owner'`
   - `users/{uid}` -> `organizationRole: 'owner'` (for their current active scope)

## Membership
- Added via invites (magic links or direct adds).
- Member relation resides in `organization_members/{uid}_{orgId}`.

## Isolation
- Queries must always be isolated by `organizationId`. 
- Cross-tenant data bleeding is prevented by requiring `organizationId` in all top-level where clauses for domain entities (Scales, Songs, etc.).

## Repair Flow
The system embraces an eventual consistency self-healing flow (`[OWNERSHIP_SYNC]` / `[OWNER_REPAIR]`). If a user manages to purchase a subscription but the Firebase trigger failed, subsequent logins or `/api/v1/billing/sync` requests will heuristically detect their Stripe invoice and auto-provision the missing documents to restore their Owner integrity.
