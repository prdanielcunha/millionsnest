# NestAffiliate Pinterest Trial broker

App **1625057** approved for Trial (confirmation received 2026-10-22). No Standard/public write endpoint is implemented.

Routes `/api/v1/nestaffiliate/pinterest`: GET `/status`, POST `/operator-credentials`, POST `/oauth/start`, POST `/oauth/complete`, POST `/disconnect`, GET/POST `/sandbox/boards`, POST `/sandbox/pins`. All reuse the existing NestAffiliate authenticated tenant/entitlement/admin resolver. POST additionally requires exact NestAffiliate Origin. Credential configuration requires canonical backend global authority; customer BYOK is not supported.

Exact registered callback: `https://nestaffiliate.millionsnest.com/integrations/pinterest/callback`. The SPA strips code/state from history and submits them with a Firebase ID token. No app secret or provider token returns to the browser. Owner must configure the callback and secret in the product, consent to OAuth, and test before Standard submission.

State: 256 random bits, hash at rest, ten-minute expiry, one use, actor/tenant/credential-version bound. The client also validates state in the initiating tab. Tokens have per-user/per-tenant private refs under the existing browser-denied `providerSecretState` namespace. Refresh leases serialize rotation; generation checks prevent reconnect/disconnect races from restoring old grants. Provider content is returned on demand, not cached. Writes always use Sandbox, specific human consent, request-id deduplication and 10/hour plus 30-second pacing. Ambiguous write errors are never automatically retried.

Disconnect removes local tokens; the user must revoke Pinterest-side authorization in their account settings. No billing, login, Rules or other product behavior changes. No new paid services or infrastructure.

Verification: `npm run lint`, `npm run build`, `node --import tsx scripts/test_nestaffiliate_pinterest.ts`. All provider/database data in this script are synthetic; end-to-end provider certification requires the owner’s credential and consent.
