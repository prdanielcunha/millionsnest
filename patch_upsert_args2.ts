import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('server.ts', 'utf8');

content = content.replace(
  /await upsertEcosystemSubscription\(\{[\s\S]*?db: dbInstance,[\s\S]*?userId: orgData\.ownerUid \|\| decodedToken\.uid,[\s\S]*?orgId,[\s\S]*?customerId,[\s\S]*?subscription: activeSub,[\s\S]*?eventCreatedTs: Date\.now\(\) \/ 1000[\s\S]*?\}\);/,
  `await upsertEcosystemSubscription({
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000,
           event_type: 'repair'
         });`
);

writeFileSync('server.ts', content);
