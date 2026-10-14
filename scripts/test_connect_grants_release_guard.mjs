import assert from 'node:assert/strict';
import { assertConnectGrantsRelease } from './connect_grants_release_guard.mjs';
const hashes={'src/lib/connectSessionContext.ts':'803408bc6bb4276afe8060b64239ceccc26714a8','src/server/services/ConnectSessionContextService.ts':'04c67f8851da4ae4b0772abe92bce636e141dde9'};
const good=['src/lib/connectSessionContext.ts','src/server/services/ConnectSessionContextService.ts'];
assert.doesNotThrow(()=>assertConnectGrantsRelease(good,hashes));
for(const path of ['server.ts','firestore.rules','package.json','src/server/services/EcosystemAccessResolver.ts','.github/workflows/other.yml','../src/lib/connectSessionContext.ts']) assert.throws(()=>assertConnectGrantsRelease([...good,path],hashes),/SCOPE_INVALID/);
assert.throws(()=>assertConnectGrantsRelease([],hashes),/SCOPE_INVALID/);
assert.throws(()=>assertConnectGrantsRelease(good,{...hashes,'src/server/services/ConnectSessionContextService.ts':'tampered'}),/SOURCE_MISMATCH/);
console.log('Connect grants release guard: scope injection, billing/auth/rules edits, missing/tampered reviewed source denied');
