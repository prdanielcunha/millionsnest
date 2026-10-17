import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifySourceServingRelease } from './source-recovery-image-policy.mjs';
export function verifyServingRelease(service, revision, sha, digest) {
  try { return verifySourceServingRelease(service, revision, sha, digest, 'musicscale'); }
  catch { throw Error('MUSICSCALE_SERVING_RELEASE_PROOF_FAILED'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [service, revision, sha, digest] = process.argv.slice(2);
  const proof = verifyServingRelease(JSON.parse(readFileSync(service)), JSON.parse(readFileSync(revision)), sha, digest);
  console.log('MUSICSCALE_ACTUAL_SERVING_RELEASE_PROOF_OK=' + JSON.stringify(proof));
}
