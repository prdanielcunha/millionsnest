# Canonical identity and membership boundary — 2026-10-19

Discovered while certifying the NestFinance per-member access editor. Reproduced
in a synthetic `demo-canonical-authority` emulator: the Rules v2 user recursive
wildcard matched the root profile, and the organization generic wildcard allowed
ordinary members to overwrite authority memberships when the tenant was active.

The shared Rules now require a real user subcollection segment, protect user
lifecycle/session fields, and reserve root-profile deletion to canonical global
administrators. Canonical memberships and both legacy mirror ID conventions are
client-write-free; existing authenticated Admin SDK invitation, role, removal,
ownership and access commands remain the only writers. The Dashboard no longer
silently rewrites or invents its own owner membership. Existing explicit ownership
repair UI and backend authorization remain in place. New-user bootstrap already
uses the server and does not require direct profile creation.

The organization generic wildcard excludes membership and audit writes. Existing
nonfinancial client audit actions retain their previous behavior; the
`nestfinance.member.permissions_updated` action cannot be forged, overwritten or
deleted with a client SDK. Its server transaction remains unchanged.

`tests/firestore/canonical_authority.rules.test.ts` verifies negative direct
operations for ordinary members, restricted administrators, owners and global
administrators, including marker removal, scopes, lifecycle, session revocation,
legacy mirrors, audit evidence and atomic batches. Positive controls preserve
profile edits, nested preferences, unrelated namespaces and trusted-server writes.
`REPRODUCE_AUTHORITY_BYPASS=1` is exclusively for reproducing the old vulnerable
source in the isolated emulator; deployment always runs the default denial suite.

Release order: publish this focused security patch from Hub production first;
prove the exact live Rules source; update NestFinance's pinned certified Rules
hash; then publish the Hub access editor. Keep unrelated main/production product
differences intact. Roll back application UI independently if needed; do not
restore the vulnerable Rules or remove the individual permission marker from real
members. Security regressions require a compatible reviewed fix forward.
