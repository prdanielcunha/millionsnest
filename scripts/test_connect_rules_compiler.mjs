import assert from 'node:assert/strict';
import { verifyConnectRulesCompiler } from './verify_connect_rules_compiler.mjs';
function fixture(statuses = [200, 200, 200], badRef = false) {
  const reports = [], requests = [];
  return { reports, requests, token: 'synthetic-readonly-token', candidate: 'synthetic-candidate', report: message => reports.push(message), async fetchImpl(url, init) {
    requests.push({ url, method: init.method });
    assert.equal(init.headers.Authorization, 'Bearer synthetic-readonly-token'); assert.equal(init.redirect, 'error'); assert(init.signal);
    if (url.endsWith(':test')) {
      const input = JSON.parse(init.body); assert.equal(input.source.files[0].name, 'firestore.rules');
      assert(['synthetic-baseline', 'synthetic-candidate'].includes(input.source.files[0].content) || input.source.files[0].content.includes('allow read, write: if false;'));
      return Response.json({}, { status: statuses.shift() });
    }
    assert.equal(init.method, undefined, 'no release/data mutations');
    return Response.json(url.endsWith('/cloud.firestore') ? { rulesetName: badRef ? 'projects/foreign/rulesets/id' : 'projects/millionsnest/rulesets/synthetic' }
      : { source: { files: [{ name: 'firestore.rules', content: 'synthetic-baseline' }] } });
  } };
}
const good = fixture(); assert.equal(await verifyConnectRulesCompiler(good), true); assert.equal(good.requests.length, 5);
assert(!good.reports.some(value => /synthetic-readonly-token|synthetic-candidate|synthetic-baseline/.test(value)));
const unavailable = fixture([200, 503, 503]); await assert.rejects(() => verifyConnectRulesCompiler(unavailable), /COMPARISON_FAILED/);
assert(unavailable.reports.includes('CONNECT_RULES_BASELINE_COMPILER_HTTP=503')); assert(unavailable.reports.includes('CONNECT_RULES_CANDIDATE_COMPILER_HTTP=503'));
await assert.rejects(() => verifyConnectRulesCompiler(fixture([200, 200, 503])), /COMPARISON_FAILED/);
assert.equal(await verifyConnectRulesCompiler(fixture([200, 503, 200])), true, 'a validated repair may compile when the previously published large baseline does not');
await assert.rejects(() => verifyConnectRulesCompiler(fixture([503, 200, 200])), /COMPARISON_FAILED/);
await assert.rejects(() => verifyConnectRulesCompiler(fixture([200, 200], true)), /BASELINE_INVALID/);
await assert.rejects(() => verifyConnectRulesCompiler({ ...fixture(), token: 'line\nbreak' }), /INPUT_INVALID/);
console.log('Connect Rules compiler: exact published baseline/candidate, read-only endpoints, sanitized diagnostics and scoped failure guards passed');
