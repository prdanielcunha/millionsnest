# Architecture: Subscriptions

## Source of Truth
The single source of truth for an organization's subscriptions is the `/subscriptions/{organizationId}` document in Firestore. App-specific state lives under `apps.{appId}`. MusicScale retains its legacy top-level projection during migration, but new products must use the app-specific map.

**PROHIBITED:** 
- Do NOT save subscription data in `/users/{userId}` as a fallback. 
- Do NOT check legacy `subscriptionStatus` inside the user document for organization-level features.
- Do NOT let one app subscription overwrite another app's entitlement.

## Billing Engine
All billing interactions are handled by Stripe via Webhooks (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`).

## Validation
- Subscriptions belong strictly to the **Organization**, not the individual User. 
- The `owner` of the Organization is responsible for billing and manages the portal.
- Subscriptions dictate the availability of **Features** (see `FEATURE_KEYS`).
- The Hub validates membership and app entitlement server-side before issuing a short-lived handoff.

## NestLocal plans

- `essential`: R$ 79/month, 1 user, 100 requests/month.
- `growth`: R$ 129/month, 3 users, 500 requests/month.
- `pro`: R$ 199/month, 10 users, 5,000 requests/month under fair-use policy.
- A seven-day trial is offered only when the organization has no prior NestLocal subscription history.
- Checkout, renewals, dunning, cancellation and the Customer Portal remain centralized in Stripe through the Hub. NestLocal consumes the resulting entitlement and never stores payment credentials.

## Webhook Lifecycle
1. `checkout.session.completed`: Creates the subscription document, establishes Ownership if new, updates `activeOrganizationId`.
2. `customer.subscription.updated`: Re-syncs the plan tier and status.
3. `customer.subscription.deleted`: Revokes access, updates status to `canceled` or `past_due`.
4. Fallbacks exist to recover missing user IDs relying on email matching if needed.
