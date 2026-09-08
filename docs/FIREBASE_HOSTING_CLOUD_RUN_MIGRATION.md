# Firebase Hosting + Cloud Run migration

The MillionsNest Hub is being migrated from Vercel-first web delivery to **Firebase Hosting + Cloud Run**. Vercel remains available temporarily as a manual rollback path until the Firebase deployment is fully certified.

## Canonical target

- Firebase project: `millionsnest`
- Hosting target: `hub`
- Hosting site: `mn-hub-555464791734`
- Cloud Run API service: `millionsnest-api`
- Cloud Run region: `us-central1`
- Public domains after cutover: `millionsnest.com` and `www.millionsnest.com`

## Routing contract

Firebase Hosting serves the Vite SPA from `dist/`.
Requests under `/api/**` are routed to the pinned revision of `millionsnest-api`.
All remaining application routes fall back to `/index.html`.

The public Firebase Web configuration used by the browser is intentionally non-secret and is preserved from the current production bundle. Private Stripe and Firebase Admin credentials are never committed.

## Backend identity

Cloud Run must use Google Application Default Credentials through its runtime service account. The Hub already supports this path when `FIREBASE_PROJECT_ID=millionsnest`; a service-account JSON key is therefore not required inside the container.

## Billing and webhook safety

The canonical Stripe webhook URL remains `https://millionsnest.com/api/stripe/webhook` after domain cutover. Firebase Hosting forwards the same path to Cloud Run, so the application route and raw-body verification contract remain unchanged.

Private Stripe values must be supplied through Secret Manager/runtime configuration. They must never be written to GitHub, Docker images, Firebase Hosting files, logs or documentation.

## Safety rules

1. Vercel is not removed until Firebase production smoke tests pass.
2. Stripe checkout, webhooks, subscriptions and billing authority remain unchanged.
3. Auth, organization ownership, memberships, RBAC, entitlements, Firestore Rules and tenant isolation are outside this infrastructure migration scope.
4. Cloud Run must honor the platform-provided `PORT`.
5. `/api/**` must be routed before the SPA fallback.
6. Domain cutover happens only after the Firebase-provided URL and Cloud Run API are certified.
7. A rollback to the existing Vercel deployment must remain possible during the stabilization window.

## Validation

Run the normal MillionsNest QA plus:

```bash
npx tsx scripts/test_firebase_hosting_cloudrun_policy.ts
```

The workflow `firebase-web-infra-preflight.yml` attempts read-only Google Cloud discovery through Workload Identity Federation. It does not read secret values and does not mutate cloud resources.
