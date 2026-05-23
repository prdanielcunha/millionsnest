# Architecture: Subscriptions

## Source of Truth
The single source of truth for an organization's subscription is the `/subscriptions/{organizationId}` document in Firestore.

**PROHIBITED:** 
- Do NOT save subscription data in `/users/{userId}` as a fallback. 
- Do NOT check legacy `subscriptionStatus` inside the user document for organization-level features.

## Billing Engine
All billing interactions are handled by Stripe via Webhooks (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`).

## Validation
- Subscriptions belong strictly to the **Organization**, not the individual User. 
- The `owner` of the Organization is responsible for billing and manages the portal.
- Subscriptions dictate the availability of **Features** (see `FEATURE_KEYS`).

## Webhook Lifecycle
1. `checkout.session.completed`: Creates the subscription document, establishes Ownership if new, updates `activeOrganizationId`.
2. `customer.subscription.updated`: Re-syncs the plan tier and status.
3. `customer.subscription.deleted`: Revokes access, updates status to `canceled` or `past_due`.
4. Fallbacks exist to recover missing user IDs relying on email matching if needed.
