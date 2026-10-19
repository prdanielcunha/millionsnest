# Organization people directory

One person is organization-scoped. An account authenticates a user; a person may
exist without any login, e-mail, phone or document number. Church participation
and application permissions remain independent. No invented e-mail is required.

## Storage

| Namespace under organizations/{organizationId} | Responsibility |
| --- | --- |
| peopleDirectory | Minimal person identity and reversible canonical links |
| peopleDirectorySources | Canonical account UID, manual identity or Journey source mappings |
| peopleDirectoryNameLocks | Concurrency coordination; contact hashes are hints, never proof |
| peopleDirectoryRequests | Atomic idempotency receipts |
| peopleDirectoryEvents | Server-owned reconciliation and distinction audit |

All namespaces are excluded from generic tenant SDK access. Only the authenticated
Hub API may read/write them; local owner/admin/pastor/data_admin may reconcile.
A global SaaS role alone confers no directory access. Operational visitor writers
need current Journey entitlement, people permission and the target congregation.

## Registration and existing history

Hub Organization → Members & Invitations contains the central directory and a
manual registration that grants no account or app access. Journey member, visitor,
bulk import and public-intake integration use the same trusted directory logic.
Selecting an existing person reuses the same congregation participation, including
merged aliases, without resetting contact consent, visits or care tasks.

Names are normalized for collision review only. Phone hashes can signal a possible
duplicate but cannot merge people. Different login accounts cannot be merged by
this feature. Namesakes require an explicit administrative distinction reason.
Identity links do not move passwords, roles, ledger records or pastoral histories.
Links are auditable and reversible. A person's unit list is not an authorization.

Existing records are projected additively. Possible name duplicates remain separate
until an administrator verifies the identity. Never bulk-delete Journey profiles
or recreate accounts to reconcile identity.

## Consistency and operational limit

Because historical writers do not all maintain an incremental identity index, this
release deliberately verifies account/Journey source snapshots at registration.
The final transaction compares nanosecond source versions and retries after a
refresh if a source changed. This closes the scan-to-write race without new paid
triggers. It has linear read cost: up to 6,000 records per source kind per tenant;
larger tenants fail closed and require incremental writer integration before rollout.
Bulk member import is atomic, at most 75 rows. Visitor registration accepts one row.

No new service, paid plan, SMS authentication, scheduler, database or paid backup
is provisioned. Existing Firestore/Cloud Run usage and free quotas still apply;
this code is not a guarantee of zero billing above those quotas. Avoid frequent
manual refreshes. Incremental transaction hooks across ALL legacy membership and
profile writers are the required next optimization, not a polling cron job.

## Release and recovery

Publish Hub and canonical Rules, verify exact serving commits, then publish Journey
with the pinned live Rules hash. Only after both are verified may the production
activation manifest move from plan to apply. Reconciliation refuses an unexpected
runtime, Rules hash, release, more than 200 organizations or 2,000 initial sources.

The additive migration keeps every authoritative source record unchanged and
records a private recovery journal before enabling per-organization legacy-create
blocking in people_directory_policies. Policies must never be enabled before the
new Journey client is live. To recover an interrupted rollout, restore the prior
Hosting/Cloud Run release and restore ONLY policies introduced by that release,
using its journal. Preserve mappings and audit; do not delete source people.

Validation: synthetic emulator data only, replay/concurrency/source-change tests,
direct SDK tampering tests, per-tenant boundaries, independent security review,
and exact deployed artifact checks. Production reports contain aggregate counts only.
