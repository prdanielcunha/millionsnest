import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('server.ts', 'utf8');

content = content.replace(
  /await upsertEcosystemSubscription\([\s\S]*?dbInstance,[\s\S]*?orgData\.ownerUid \|\| decodedToken\.uid,[\s\S]*?orgId,[\s\S]*?customerId,[\s\S]*?activeSub,[\s\S]*?planId,[\s\S]*?app[\s\S]*?\);/,
  `await upsertEcosystemSubscription({
           db: dbInstance,
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           customerId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000
         });`
);

writeFileSync('server.ts', content);
