import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/server/services/SubscriptionEligibility.ts', 'utf8');

content = content.replace(
  'hasResidualAccess = latestCanceledSub.current_period_end * 1000 > Date.now();',
  'hasResidualAccess = (latestCanceledSub as any).current_period_end * 1000 > Date.now();'
);

content = content.replace(
  'accessUntil = new Date(latestCanceledSub.current_period_end * 1000).toISOString();',
  'accessUntil = new Date((latestCanceledSub as any).current_period_end * 1000).toISOString();'
);

writeFileSync('src/server/services/SubscriptionEligibility.ts', content);
