import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('server.ts', 'utf8');

// Replace the block inside unified-checkout for planLookupKey block_duplicate
content = content.replace(
  /if \(eligibility\.decision === 'block_duplicate'\) \{\s*return res\.status\(400\)\.json\(\{[\s\S]*?\}\);\s*\}/m,
  `if (eligibility.decision === 'block_duplicate') {
          return res.status(400).json({ 
            ok: false, 
            code: 'ACTIVE_SUBSCRIPTION_EXISTS', 
            action: 'manage_existing_subscription',
            error: 'Sua assinatura já está ativa. Você pode gerenciá-la na área de assinatura.',
            repairRequired: eligibility.repairRequired,
            managementUrl: eligibility.managementUrl,
            orgId: eligibility.orgId
          });
        }`
);

writeFileSync('server.ts', content);
