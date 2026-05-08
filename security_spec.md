# Security Specification - MillionsNest SaaS

## Data Invariants
1. **User Identity Isolation**: A user can only read and write their own profile (`users/{uid}`).
2. **Field Immutability**: `createdAt` and `uid` cannot be changed after creation.
3. **Privileged Fields**: `products`, `roles`, and `subscriptions` can ONLY be modified by the Backend (Firebase Admin SDK).
4. **Authorization Source**: Real multi-tenant access is verified via the `organization_members` global collection. Subcollections are not used for auth.
5. **Organization Context**: The `organizationId` in the `users` document is strictly for visual preference (which project to show first). Access is still checked against memberships.

## The Dirty Dozen (Test Payloads)

| Payload ID | Target Action | Path | Description | Expected |
|:---|:---|:---|:---|:---|
| P01 | Create | `users/attacker` | Attacker trying to create profile with `uid` of target user. | DENIED |
| P02 | Create | `users/me` | User trying to self-assign 'musicscale' product. | DENIED |
| P03 | Update | `users/me` | User trying to change their own `uid`. | DENIED |
| P04 | Update | `users/me` | User trying to add 'musicscale' to `products` list. | DENIED |
| P05 | Update | `users/me` | User updating `organizationId` (Visual Context). | ALLOWED |
| P06 | Read | `organizations/org1` | User without membership trying to read org data. | DENIED |
| P07 | Read | `organizations/org1` | User with record in `organization_members` reading org data. | ALLOWED |
| P08 | Write | `subscriptions/sub1` | User trying to modify their subscription status directly. | DENIED (Admin Only) |
| P09 | Update | `users/me` | User sending 1MB string to `displayName`. | DENIED |
| P10 | Delete | `users/me` | User trying to delete account via frontend. | DENIED |
| P11 | Read | `organization_members/other_user_org` | User trying to read memberships they don't belong to. | DENIED |
| P12 | Create | `users/me` | User creating profile with `request.time` mismatch. | DENIED |
