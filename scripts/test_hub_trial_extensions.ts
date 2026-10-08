import assert from 'node:assert/strict';
import {DAY_MS,TRIAL_BASE_DAYS,trialWindow} from '../src/server/services/HubTrialExtensionService.js';
const start=Date.parse('2026-10-01T12:00:00Z');
for(const app of ['musicscale','nestlocal'] as const) {
  const base=start+TRIAL_BASE_DAYS[app]*DAY_MS;
  const record={appId:app,organizationId:'org1',source:'hub_internal_trial',
    status:'active',consumed:true,revoked:false,grantVersion:2,
    beginsAt:{toMillis:()=>start},expiresAt:{toMillis:()=>base}};
  assert.equal(trialWindow(app,record,base-1,'org1').active,true);
  assert.equal(trialWindow(app,record,base,'org1').expired,true);
  const extended={...record,extensionCount:1,extensionDays:7,
    extensionEndsAt:{toMillis:()=>base+7*DAY_MS}};
  assert.equal(trialWindow(app,extended,base+1,'org1').active,true);
  assert.equal(trialWindow(app,extended,base+7*DAY_MS,'org1').expired,true);
  assert.equal(trialWindow(app,{...extended,extensionCount:2},base+1,'org1').valid,false);
  assert.equal(trialWindow(app,{...extended,extensionDays:8},base+1,'org1').valid,false);
  assert.equal(trialWindow(app,extended,base+1,'another_org').valid,false);
}
console.log('PASS: 14/7 day trials, seven-day extension, final expiry and tenant safety');
