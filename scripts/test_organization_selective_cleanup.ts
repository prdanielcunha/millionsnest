import assert from 'node:assert/strict';
import {previewEcosystemOrganizationCleanup,applyEcosystemOrganizationCleanup}
  from '../src/server/services/EcosystemOrganizationCleanupService.js';

// Completely synthetic Firestore; no ADC, API, production credentials or writes.
const empty={docs:[],empty:true,size:0};
function makeDb(name:string,ageDays:number,opts:{origin?:string,billing?:boolean}={}) {
  let writes=0;
  const id='org_test_001';
  const data={
    name, origin:opts.origin,
    ownerUid:'owner-01',
    createdAt:new Date(Date.now()-ageDays*86400000),
    ...(opts.billing?{subscriptionStatus:'active'}:{}),
  };
  const query={get:async()=>empty,limit(){return this},where(){return this}};
  const org:any={
    id,exists:true,data:()=>data,
    ref:{
      collection(field:string) {
        if(field==='members')return {...query,get:async()=>({docs:[{id:'owner-01',data:()=>({role:'owner'})}],size:1,empty:false})};
        return query;
      },
      listCollections:async()=>[],
    },
  };
  const db:any={
    collection(field:string) {
      if(field==='organizations')return {get:async()=>({docs:[org],size:1}),doc:()=>({get:async()=>({exists:true,data:()=>data}),listCollections:async()=>[]})};
      if(field==='subscriptions')return {doc:()=>({get:async()=>({exists:false})})};
      return query;
    }
  };
  return {db,getWrites:()=>writes};
}
const preview=async(name:string,age:number,opts:{origin?:string,billing?:boolean}={})=>
  (await previewEcosystemOrganizationCleanup({db:makeDb(name,age,opts).db})).preview;

const recent=await preview('Daniel Cunha',3);
assert.equal(recent.organizations.length,1);
assert.equal(recent.organizations[0].eligibleForDeletion,false);
assert.equal(recent.organizations[0].suggestedTest,false);

const protectedOrg=await preview('Família OBPC',200);
assert.equal(protectedOrg.organizations[0].protected,true);
assert.equal(protectedOrg.organizations[0].eligibleForDeletion,false);

const technical=await preview('Test Org',90,{origin:'fixture'});
assert.equal(technical.organizations[0].suggestedTest,true);
assert.equal(technical.organizations[0].eligibleForDeletion,true);
assert.equal(technical.deleteCandidates,1);
assert.equal(technical.organizations[0].id,'org_test_001');

// Last sign-in belongs to the account, not the organization. Timestamp evidence
// must stay unknown when Firebase Auth cannot provide a valid record.
const loginAt = '2026-10-17T14:35:00.000Z';
const auth: any = { getUser: async(uid:string) => {
  assert.equal(uid,'owner-01');
  return {metadata:{lastSignInTime:loginAt}};
}};
const withLogin = (await previewEcosystemOrganizationCleanup({
  db:makeDb('Old Test Org',90,{origin:'fixture'}).db,auth
})).preview.organizations[0];
assert.equal(withLogin.lastOwnerSignInAtMs,Date.parse(loginAt));
assert.equal(withLogin.lastRecordedActivityAtMs,null);
assert.equal(withLogin.eligibleForDeletion,true);

const unavailable = (await previewEcosystemOrganizationCleanup({
  db:makeDb('Old Test Org',90,{origin:'fixture'}).db,
  auth:{getUser:async()=>{throw Error('No Firebase metadata')}}
})).preview.organizations[0];
assert.equal(unavailable.lastOwnerSignInAtMs,null);

const paid=await preview('Test Org',90,{origin:'fixture',billing:true});
assert.equal(paid.organizations[0].billingProtected,true);
assert.equal(paid.organizations[0].eligibleForDeletion,false);

const {db}=makeDb('Test Org',90);
const base:any={db,auth:{},actorUid:'ceo',actorSystemRole:'ceo',confirmation:'EXCLUIR_ORGANIZACOES_SELECIONADAS'};
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base}),/INVALID_ORGANIZATION_SELECTION/);
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base,organizationIds:[]}),/INVALID_ORGANIZATION_SELECTION/);
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base,organizationIds:['org_test_001','org_test_001']}),/INVALID_ORGANIZATION_SELECTION/);
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base,organizationIds:['org_test_001'],deleteOwnerAccountsForOrgIds:['another']}),/INVALID_OWNER_ACCOUNT_SELECTION/);
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base,organizationIds:['org_test_001'],confirmation:'LIMPAR_ORGANIZACOES'}),/CONFIRMATION_REQUIRED/);
await assert.rejects(()=>applyEcosystemOrganizationCleanup({...base,organizationIds:['not-listed']}),/ORGANIZATION_SELECTION_NOT_ELIGIBLE/);

console.log('ORGANIZATION_SELECTIVE_CLEANUP_CONTRACT_OK');
