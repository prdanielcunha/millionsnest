import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('server.ts', 'utf8');

content = content.replace(
  /await upsertEcosystemSubscription\(\{\s*db: dbInstance,\s*userId: orgData\.ownerUid \|\| decodedToken\.uid,\s*orgId,\s*subscription: activeSub,\s*eventCreatedTs: Date\.now\(\) \/ 1000,\s*event_type: 'repair'\s*\}\);/,
  `await upsertEcosystemSubscription({
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000,
           event_type: 'repair'
         });`
);
// In case the previous regex didn't match perfectly, let's just do a string replace
const oldStr = `await upsertEcosystemSubscription({
           db: dbInstance,
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           customerId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000
         });`;
const newStr = `await upsertEcosystemSubscription({
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000,
           event_type: 'repair'
         });`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
}

// And if it was with event_type: 'repair' but with db: dbInstance
const oldStr2 = `await upsertEcosystemSubscription({
           userId: orgData.ownerUid || decodedToken.uid,
           orgId,
           subscription: activeSub,
           eventCreatedTs: Date.now() / 1000,
           event_type: 'repair'
         });`;
// wait, if I did `patch_upsert_args2.ts` in the last run, it replaced:
// /await upsertEcosystemSubscription\(\{[\s\S]*?db: dbInstance,[\s\S]*?userId: orgData\.ownerUid \|\| decodedToken\.uid,[\s\S]*?orgId,[\s\S]*?customerId,[\s\S]*?subscription: activeSub,[\s\S]*?eventCreatedTs: Date\.now\(\) \/ 1000[\s\S]*?\}\);/
// with the correct one WITHOUT `db: dbInstance`.

writeFileSync('server.ts', content);
