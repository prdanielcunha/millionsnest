import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
const marker='match /{app}/{document=**} {';
assert.equal(rules.split(marker).length-1,1);
const start=rules.indexOf(marker);
const end=rules.indexOf('\n      }',start);
assert.ok(end>start,'generic organization namespace must have a complete rule block');
const generic=rules.slice(start,end);
assert.match(generic,/allow create: if[^\n]*app != 'app_entitlements' && !app\.matches\('\^nestlocal_\.\*'\)/);
assert.match(generic,/allow update, delete: if[^\n]*app != 'app_entitlements' && !app\.matches\('\^nestlocal_\.\*'\)/);
assert.match(rules,/function nestLocalCommercialProjectionUnchanged\(\)/);
assert.match(rules,/allow update: if isAuthenticated\(\) && \([\s\S]*?\) && nestLocalCommercialProjectionUnchanged\(\) &&\s*musicScaleTrialProjectionProtected\(\);/);
for(const name of ['nestlocal_internal_trials','nestlocal_trial_owners','nestai_credit_grant_outbox']){
  assert.match(rules,new RegExp('match /'+name+'/\\{[^}]+\\} \\{\\s+allow read, write: if false;'));
}
console.log('PASS: Firestore NestLocal commercial docs and tenant write exclusion regression checks');
