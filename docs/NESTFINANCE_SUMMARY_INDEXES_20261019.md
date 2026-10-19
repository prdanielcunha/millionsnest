# NestFinance Today summary — additive index repair

The authenticated Today summary failed while transaction listing worked.
Read-only production run `39290816826`, job `118190672386`, proved the status
COUNT shape returned HTTP200, while both SUM(amountCents) shapes returned
FAILED_PRECONDITION with `requiresIndex:true`. These queries used a synthetic
nonexistent organization/entity path and returned no real tenant documents.

The canonical Hub versions only the two missing COLLECTION indexes on
financeTransactions: financeEntityId + listQueryKeys.direction + amountCents,
and financeEntityId + listQueryKeys.directionStatus + amountCents, all ascending.
The additive publisher checks these exact specs in the versioned manifest,
creates only absent indexes, preserves every other index, and waits for READY.
It uses the existing deployer identity; no new service, IAM/billing change,
financial data write or change to Rules/RBAC is included. Existing shared Rules
workflow gates still run if the manifest changes; their source hash is unchanged.
The standalone read-only investigation is available manually. Automatic changes
to these scripts use the certification workflow, restricted to production, which
probes queries only after both indexes are READY; this prevents a racing diagnostic
from treating a normal index build as a failed repair. Index metadata uses the
same established gcloud read-only path as the canonical publisher.

Regression tests cover ready no-op, exact missing-index creation, preservation
of unrelated indexes, concurrent creator, unhealthy/timeout failures and manifest
guards. Production certification must also repeat the actual synthetic COUNT
and SUM queries successfully. Emulator success alone cannot certify live indexes.
After certification, verify Today with an authenticated browser session; do not
convert unavailable or unverified balances to zero. Index creation does not
approve/post transactions or change a member's permission to see the balance.

Rollback: retain these additive supporting indexes and revert application changes
independently if needed. Never remove other products' indexes, deploy a reduced
full index manifest, restore vulnerable Rules or grant broader IAM to force a gate.
