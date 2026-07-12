import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/server/services/SubscriptionEligibility.ts', 'utf8');
content = content.replace(
  'export type SubscriptionPurchaseEligibility =',
  `export type SubscriptionPurchaseEligibility = {
  allowed: boolean;
  reason: string;
  orgId: string;
  canonicalSubscriptionStatus: string | null;
  stripeSubscriptionId?: string;
  entitlementMaterialized: boolean;
  repairRequired: boolean;
  managementUrl: string;
  decision: "allow_new_subscription" | "resume_existing" | "block_duplicate" | "regularize_existing";
  hasResidualAccess?: boolean;
  accessUntil?: string | null;
  stripeCustomerId?: string;
  subscriptionId?: string;
}; //`
);
writeFileSync('src/server/services/SubscriptionEligibility.ts', content);
