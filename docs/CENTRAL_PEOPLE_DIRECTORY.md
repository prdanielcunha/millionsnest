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

All namespaces are excluded from generic tenant SDK access. New Journey person
documents are server-gateway-only in ALL organizations, including future ones,
independent of rollout marker presence. Old cached clients must update, never fall
back to SDK creation. Only the authenticated
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
The initial source limit is a preflight bound, not a cap on concurrent growth.
Read-only Monitoring telemetry must also show conservative free-tier headroom for
the initial reconciliation. Missing permission/telemetry or insufficient room stops
apply without adding IAM privileges or provisioning any service. Telemetry has lag;
the safety reserve is not a guarantee about future billing or concurrent traffic.

The additive migration keeps every authoritative source record unchanged and
records a private recovery journal and per-organization rollout markers in
people_directory_policies. These are not authorization grants: SDK person creation
remains denied even if a marker is missing or disabled. The new Journey client and
gateway must be live before publishing the permanent SDK creation denial.
To recover an interrupted rollout, restore the prior
Hosting/Cloud Run release and restore ONLY policies introduced by that release,
using its journal. Preserve mappings and audit; do not delete source people.

Validation: synthetic emulator data only, replay/concurrency/source-change tests,
direct SDK tampering tests, per-tenant boundaries, independent security review,
and exact deployed artifact checks. Production reports contain aggregate counts only.

## Name, phone, login and recoverable removal (2026-11-03)

`create` accepts `{name, phone?, distinctReason?}` for an organization-only person;
`register` accepts member rows with name, optional preferredName and phone. Both
use the same organization-scoped gateway and idempotent request receipt. Storing
an administrative phone leaves `consent=false`, grants no app role and creates
no care task. An administrator must separately obtain messaging authorization.

Organization owners and active owner/admin/pastor/data_admin memberships retain
management access. A current active membership with the canonical capability
`organization.members.manage=true` may also manage this directory. Global CEO
status alone does not grant access to church contacts. Authority is rechecked
inside each write transaction; a revoked membership cannot retain delegation.

An account joins the organization through the existing invitation/join flow
before directory reconciliation offers it as an account target. Google and
email/password are authentication methods, not separate person types. Account
email and administrative phone are shown only through the authorized API. Never
merge by matching a name or phone. Link and unlink require explicit identity
confirmation, a reason and the current source revision. Login, membership, roles,
financial facts, attendance evidence and care history remain in their original
records. Two independent login accounts are never merged by this endpoint.

`archive` and `restore` accept `{fromId, reason, revision}`. They remove/restore a
canonical person from active lists and flag the existing Journey participations
with `directoryArchived`. They do not delete an Auth user, revoke a membership,
erase history or change consent. GET defaults to active records; authorized
administrators can request `includeArchived=true` to restore a record. Linked
aliases use their canonical target's archived state. Source reconciliation does
not silently resurrect archived identities. Restore preserves the same IDs.

Existing event eligibility snapshots and evidence remain factual. Consumers
must exclude archived people from new default rosters but retain them when an
existing event's frozen roster or checks refers to them. New Journey member
participation may reuse the existing canonical administrative phone while still
keeping contact consent false. Existing participation is reused without resetting
its phone, consent, visits or historical records.

No schema migration, new database, paid service, Auth merge or Rules relaxation
is required. Test exclusively with the synthetic emulator fixture in
`scripts/test_people_directory.ts`. Revert application revisions for code recovery;
restore archived people through the audited API rather than deleting the audit.
