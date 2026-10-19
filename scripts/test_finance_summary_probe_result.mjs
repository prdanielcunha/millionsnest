import assert from 'node:assert/strict';
import { summarizeProbeResult } from './finance_summary_probe_result.mjs';
const missing = { error: { status: 'FAILED_PRECONDITION', message: 'The query requires an index. Private details omitted.' } };
assert.deepEqual(summarizeProbeResult(missing, 400), { http: 400, code: 'FAILED_PRECONDITION', requiresIndex: true });
assert.deepEqual(summarizeProbeResult([missing], 400), summarizeProbeResult(missing, 400));
assert.equal(summarizeProbeResult([{ readTime: 'synthetic' }, missing], 400).requiresIndex, true);
assert.deepEqual(summarizeProbeResult([{ result: { aggregateFields: {} } }], 200), { http: 200, code: 'OK', requiresIndex: false });
assert.deepEqual(summarizeProbeResult({}, 400), { http: 400, code: 'UNKNOWN_HTTP_ERROR', requiresIndex: false });
assert.deepEqual(summarizeProbeResult({ error: { status: 'PERMISSION_DENIED', message: 'Access denied' } }, 403),
  { http: 403, code: 'PERMISSION_DENIED', requiresIndex: false });
assert.equal(JSON.stringify(summarizeProbeResult(missing, 400)).includes('Private details'), false);
console.log('Firestore probe: streamed errors, unknown HTTP failures, permission denial and output redaction passed');
