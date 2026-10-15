import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Read-only cloud compiler comparison; never creates/releases Rules or writes data. */
export async function verifyConnectRulesCompiler({ token, candidate, fetchImpl = fetch, report = () => {} }) {
  if (typeof token !== 'string' || !token.trim() || token.length > 16384 || /[\r\n]/.test(token) || typeof candidate !== 'string' || !candidate || Buffer.byteLength(candidate) > 256000) throw new Error('RULES_COMPILER_INPUT_INVALID');
  const base = 'https://firebaserules.googleapis.com/v1';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function read(url) {
    const response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('RULES_COMPILER_BASELINE_READ_UNAVAILABLE');
    return response.json();
  }
  const release = await read(`${base}/projects/millionsnest/releases/cloud.firestore`);
  if (typeof release.rulesetName !== 'string' || !/^projects\/millionsnest\/rulesets\/[a-zA-Z0-9-]+$/.test(release.rulesetName)) throw new Error('RULES_COMPILER_BASELINE_INVALID');
  const ruleset = await read(`${base}/${release.rulesetName}`);
  const files = ruleset.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || files[0].name !== 'firestore.rules' || typeof files[0].content !== 'string') throw new Error('RULES_COMPILER_BASELINE_INVALID');
  let failed = false;
  let baselineValidated = false;
  const control = "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }";
  for (const [label, source] of [['CONTROL', control], ['BASELINE', files[0].content], ['CANDIDATE', candidate]]) {
    report(`CONNECT_RULES_${label}_SHA256=${createHash('sha256').update(source).digest('hex')}`);
    if (label === 'CANDIDATE' && baselineValidated && source === files[0].content) {
      report('CONNECT_RULES_CANDIDATE_COMPILER_HTTP=200');
      report('CONNECT_RULES_CANDIDATE_COMPILER_ERRORS=0');
      report('CONNECT_RULES_CANDIDATE_IDENTICAL_VALIDATED_BASELINE=true');
      continue;
    }
    const response = await fetchImpl(`${base}/projects/millionsnest:test`, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(30000), body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] } }) });
    report(`CONNECT_RULES_${label}_COMPILER_HTTP=${response.status}`);
    if (!response.ok) { if (label !== 'BASELINE') failed = true; continue; }
    const result = await response.json();
    if (result.issues !== undefined && !Array.isArray(result.issues)) throw new Error('RULES_COMPILER_RESPONSE_INVALID');
    const errors = (result.issues ?? []).filter(issue => issue?.severity === 'ERROR').length;
    report(`CONNECT_RULES_${label}_COMPILER_ERRORS=${errors}`);
    if (label === 'BASELINE' && errors === 0) baselineValidated = true;
    if (errors > 0 && label !== 'BASELINE') failed = true;
  }
  if (failed) throw new Error('RULES_COMPILER_COMPARISON_FAILED');
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyConnectRulesCompiler({ token: readFileSync(0, 'utf8').trim(), candidate: readFileSync('firestore.rules', 'utf8'), report: console.log });
    console.log('CONNECT_RULES_CLOUD_COMPILER_COMPARISON_OK');
  } catch (error) {
    console.error(error instanceof Error && /^RULES_COMPILER_[A-Z_]+$/.test(error.message) ? error.message : 'RULES_COMPILER_COMPARISON_UNAVAILABLE');
    process.exitCode = 1;
  }
}
