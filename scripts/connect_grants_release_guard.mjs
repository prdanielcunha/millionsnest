import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const ALLOWED = new Set(['src/lib/connectSessionContext.ts','src/server/services/ConnectSessionContextService.ts','scripts/test_mn_connect_03_session_context.ts','scripts/connect_grants_release_guard.mjs','scripts/test_connect_grants_release_guard.mjs','.github/workflows/connect-grants-preserving-release.yml','.github/workflows/cloudrun-private-deploy.yml','docs/CONNECT_GRANTS_RELEASE.md']);
export function assertConnectGrantsRelease(paths, hashes) {
  if (!Array.isArray(paths) || !paths.length || paths.some(p => !ALLOWED.has(p))) throw new Error('CONNECT_GRANTS_RELEASE_SCOPE_INVALID');
  for (const [p, hash] of Object.entries({ 'src/lib/connectSessionContext.ts':'803408bc6bb4276afe8060b64239ceccc26714a8', 'src/server/services/ConnectSessionContextService.ts':'04c67f8851da4ae4b0772abe92bce636e141dde9' })) {
    if (hashes[p] !== hash) throw new Error('CONNECT_GRANTS_REVIEWED_SOURCE_MISMATCH');
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const before = process.env.RELEASE_BEFORE_SHA, head = process.env.GITHUB_SHA;
  if (![before,head].every(x => /^[a-f0-9]{40}$/.test(x || '') && !/^0+$/.test(x))) throw new Error('CONNECT_GRANTS_RELEASE_REF_INVALID');
  execFileSync('git',['merge-base','--is-ancestor',before,head]);
  const paths = execFileSync('git',['diff','--name-only',before,head],{encoding:'utf8'}).trim().split('\n');
  const hashes = Object.fromEntries(['src/lib/connectSessionContext.ts','src/server/services/ConnectSessionContextService.ts'].map(p => { const b = readFileSync(p); return [p,createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')]; }));
  assertConnectGrantsRelease(paths, hashes);
  console.log('CONNECT_GRANTS_REVIEWED_SCOPE_OK');
}
