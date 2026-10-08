import assert from 'node:assert/strict';
import { resolveEcosystemAppAccess } from '../src/server/services/EcosystemAccessResolver.js';

type RecordValue = Record<string,any>;
const docs=new Map<string,RecordValue>();
const mockDb={
  collection(name:string){
    return {
      doc(id:string){
        const path=name+'/'+id;
        return {get:async()=>({exists:docs.has(path),data:()=>docs.get(path)})};
      },
    };
  },
};
const org='org-readonly',uid='uid-owner',start=Date.parse('2026-10-01T00:00:00Z'),end=start+168*60*60*1000;
docs.set('users/'+uid,{status:'active',systemRole:'user'});
docs.set('organizations/'+org,{status:'active',apps:{nestlocal:{status:'trialing'}}});
docs.set('organizations/'+org+'/members/'+uid,{role:'owner',status:'active',appAccess:{nestlocal:{enabled:true}}});
const trial={
  organizationId:org,appId:'nestlocal',source:'hub_internal_trial',status:'active',
  revoked:false,consumed:true,grantVersion:2,
  beginsAt:{toDate:()=>new Date(start)},expiresAt:{toDate:()=>new Date(end)},
};
docs.set('nestlocal_internal_trials/'+org,trial);
const original=process.env.NESTLOCAL_INTERNAL_TRIAL_ENABLED;
try {
  process.env.NESTLOCAL_INTERNAL_TRIAL_ENABLED='true';
  // The unit assumes now is 2026-10-08 or later; source trial is expired.
  const ended=await resolveEcosystemAppAccess({uid,organizationId:org,appId:'nestlocal',db:mockDb as any});
  assert.equal(ended.accessible,true);
  assert.equal(ended.readOnly,true);
  assert.equal(ended.canWrite,false);
  assert.equal(ended.canUseAI,false);
  assert.deepEqual(ended.permissions,['nestlocal.read']);
  assert.deepEqual(ended.scopes,{nestlocal:['read']});

  docs.set('subscriptions/'+org,{apps:{nestlocal:{status:'active',plan:'growth'}}});
  docs.set('organizations/'+org,{status:'active',apps:{nestlocal:{status:'active'}}});
  const paid=await resolveEcosystemAppAccess({uid,organizationId:org,appId:'nestlocal',db:mockDb as any});
  assert.equal(paid.accessible,true);
  assert.equal(paid.readOnly,false);
  assert.equal(paid.canWrite,true);
  assert.equal(paid.canUseAI,true);

  docs.delete('subscriptions/'+org);
  docs.set('organizations/'+org,{status:'active',apps:{nestlocal:{status:'trialing'}}});
  docs.set('organizations/'+org+'/members/'+uid,{role:'member',status:'active',appAccess:{nestlocal:{enabled:false}}});
  const unauthorized=await resolveEcosystemAppAccess({uid,organizationId:org,appId:'nestlocal',db:mockDb as any});
  assert.equal(unauthorized.accessible,false);

  docs.set('organizations/'+org+'/members/'+uid,{role:'owner',status:'active'});
  docs.set('nestlocal_internal_trials/'+org,{...trial,organizationId:'other-org'});
  const swapped=await resolveEcosystemAppAccess({uid,organizationId:org,appId:'nestlocal',db:mockDb as any});
  assert.equal(swapped.accessible,false);
} finally {
  if(original===undefined)delete process.env.NESTLOCAL_INTERNAL_TRIAL_ENABLED;
  else process.env.NESTLOCAL_INTERNAL_TRIAL_ENABLED=original;
}
console.log('PASS: Hub expired NestLocal opens read-only, paid wins, revoked app and cross-tenant denied');
