import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSafePostLoginPath} from '../src/lib/connectLaunchPolicy.js';
for (const app of ['musicscale','nestlocal']) {
  const path='/start-trial?app='+app;
  assert.equal(resolveSafePostLoginPath('?next='+encodeURIComponent(path)),path);
}
for (const path of ['//evil.test','/start-trial?app=musicscale&returnTo=https://evil.test','/start-trial?app=bad','/start-trial?app=musicscale&app=nestlocal']) {
  assert.equal(resolveSafePostLoginPath('?next='+encodeURIComponent(path)),null);
}
const page=readFileSync('src/pages/StartTrial.tsx','utf8');
assert.ok(!page.includes('unified-checkout') && !page.includes('create-checkout'));
assert.ok(page.includes('/api/v1/billing/trial/activate'));
assert.ok(page.includes("navigate('/apps/' + appId + '/launch'"));
const pricing=readFileSync('src/components/Pricing.tsx','utf8');
assert.ok(pricing.includes("navigate('/start-trial?app=musicscale')"));
assert.ok(pricing.includes("navigate(`/checkout?plan=${lookupKey}`)"),'one-time add-ons retain explicit paid flow');
console.log('PASS no-card acquisition, safe login return, activation, launch and paid add-on isolation');
