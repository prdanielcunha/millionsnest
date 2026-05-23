# Realtime Synchronization

## Firebase Context
We utilize `onSnapshot` within the React frontend to keep local application state synchronized with the single source of truth in Firestore.

## Sync Contracts
1. **User Profile**: `onSnapshot(doc(db, 'users', uid))`
2. **Organization Member Data**: `onSnapshot(doc(db, 'organization_members', '{uid}_{orgId}'))`
3. **Organization Data**: `onSnapshot(doc(db, 'organizations', orgId))`
4. **Subscription Data**: `onSnapshot(doc(db, 'subscriptions', orgId))`

These subscriptions must be established early in the session lifecycle (typically via `AuthContext.tsx`) to react instantly when:
- Webhooks update billing.
- Admins revoke access or change roles via RBAC.
- Ownership repairs trigger retroactively.

All UI components should depend on these reactive hooks rather than stale, one-time fetches.
