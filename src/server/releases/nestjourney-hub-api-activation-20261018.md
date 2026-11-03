# NestJourney Hub API activation — 2026-10-18

This change initiates a controlled Cloud Run deployment for Hub birthday, person intake and calendar API endpoints already merged to the production source at `903ae493`.

Mandatory external readiness gate before merging this release PR:

1. The preceding canonical Firestore Rules workflow from production commit `7dcbcbe414ea0fc80ca15a7750fd5a5adbf309f1` must have a **completed/success** conclusion.
2. That workflow must explicitly log `NESTJOURNEY_INDEX_READY=personBirthdays`, `NESTJOURNEY_INDEX_READY=nestjourney_calendar_feeds`, `MILLIONSNEST_FIRESTORE_RULES_DEPLOY_OK`, and `CONNECT_ACTUAL_PUBLISHED_PRIVATE_STORAGE_PROOF_OK`.
3. Cloud Run release must publish an isolated candidate revision, smoke test it and only then switch traffic. Never merge this commit while the Rules gate is failed or still running.
4. Do not enable any paid WhatsApp birthday delivery. Templates remain unapproved and opt-in only.

This is a no-runtime-code production deployment marker in a versioned source directory. It exists because `workflow_dispatch` is unavailable to the current GitHub connector.
