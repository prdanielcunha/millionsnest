# Security Specification - MillionsNest SaaS

## Data Invariants
1. **User Identity Isolation**: A user can only read and write their own profile (`users/{uid}`).
2. **Field Immutability**: `createdAt` and `uid` cannot be changed after creation.
3. **Privileged Fields**: `products`, `roles`, and `subscriptions` can ONLY be modified by the Backend (Firebase Admin SDK). The Client SDK must be restricted from these fields during `update`.
4. **Organization Context**: The `organizationId` is the only functional field a user can switch to change their active workspace.

## The Dirty Dozen (Test Payloads)

| Payload ID | Target Action | Path | Description | Expected |
|:---|:---|:---|:---|:---|
| P01 | Create | `users/attacker` | Attacker trying to create profile with `uid` of target user. | DENIED (Auth mismatch) |
| P02 | Create | `users/me` | User trying to self-assign 'musicscale' product on creation. | DENIED (Protected field) |
| P03 | Update | `users/me` | User trying to change their own `uid`. | DENIED (Immutable) |
| P04 | Update | `users/me` | User trying to add 'musicscale' to `products` list. | DENIED (Protected field) |
| P05 | Update | `users/me` | User trying to update `organizationId` (Valid Action). | ALLOWED |
| P06 | Update | `users/me` | User trying to update `lastLoginAt` (Valid Action). | ALLOWED |
| P07 | Update | `users/me` | User trying to update a non-existent field 'isAdmin: true'. | DENIED (Strict Schema) |
| P08 | Get | `users/other` | Authenticated user trying to read someone else's profile. | DENIED (Identity) |
| P09 | Update | `users/me` | User sending 1MB string to `displayName`. | DENIED (Resource Guard) |
| P10 | Delete | `users/me` | User trying to delete their own account via frontend. | DENIED (System Policy) |
| P11 | Update | `users/me` | User trying to change `email` without re-auth/verification. | DENIED (Identity Integrity) |
| P12 | Create | `users/me` | User creating profile with `request.time` mismatch for `createdAt`. | DENIED (Temporal Integrity) |
