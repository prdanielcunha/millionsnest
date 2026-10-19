import assert from 'node:assert/strict';
import { ensureSummaryIndexes, SUMMARY_INDEX_SPECS } from './ensure_nestfinance_summary_indexes.mjs';
const clone = value => structuredClone(value);
const manifest = { indexes: clone(SUMMARY_INDEX_SPECS) };
const asLive = (spec, state = 'READY') => ({ ...clone(spec), state,
  name: 'projects/millionsnest/databases/(default)/collectionGroups/financeTransactions/indexes/' + spec.fields[1].fieldPath });
async function scenario(initial, options = {}) {
  const indexes = clone(initial), calls = [];
  const run = args => {
    calls.push(args);
    assert.deepEqual(args.slice(0, 3), ['firestore', 'indexes', 'composite']);
    assert(args.includes('--project=millionsnest') && args.includes('--database=(default)'));
    if (args[3] === 'list') return JSON.stringify(indexes);
    assert.equal(args[3], 'create', 'never delete/update/deploy indexes or mutate other resources');
    assert(args.includes('--async') && args.includes('--query-scope=collection'));
    const spec = SUMMARY_INDEX_SPECS.find(spec => args.includes('--field-config=field-path=' + spec.fields[1].fieldPath + ',order=ascending'));
    assert(spec);
    assert.equal(args.filter(arg => arg.startsWith('--field-config=')).length, 3);
    indexes.push(asLive(spec, options.creating ? 'CREATING' : 'READY'));
    if (options.race) throw Error('synthetic concurrent creator');
    return '{}';
  };
  await ensureSummaryIndexes({ manifest, run, sleep: async () => {}, attempts: 2, log: () => {} });
  return { indexes, calls };
}
const other = { name: 'projects/millionsnest/databases/(default)/collectionGroups/songs/indexes/keep', queryScope: 'COLLECTION', fields: [{ fieldPath: 'organizationId', order: 'ASCENDING' }], state: 'READY' };
const ready = await scenario([...SUMMARY_INDEX_SPECS.map(spec => asLive(spec)), other]);
assert.equal(ready.calls.filter(args => args[3] === 'create').length, 0);
assert.deepEqual(ready.indexes.at(-1), other);
await scenario(SUMMARY_INDEX_SPECS.map(spec => ({ ...asLive(spec), fields: spec.fields.map(field => ({ order: field.order, fieldPath: field.fieldPath })) })));
const missing = await scenario([other]);
assert.equal(missing.calls.filter(args => args[3] === 'create').length, 2);
assert.deepEqual(missing.indexes[0], other);
await scenario([], { race: true });
await assert.rejects(scenario([], { creating: true }), /NOT_READY/);
await assert.rejects(scenario([asLive(SUMMARY_INDEX_SPECS[0], 'NEEDS_REPAIR')]), /UNHEALTHY/);
let called = false;
await assert.rejects(ensureSummaryIndexes({ manifest: { indexes: [] }, run: () => { called = true; } }), /NOT_DECLARED/);
assert.equal(called, false, 'missing versioned spec must fail before any cloud command');
await assert.rejects(ensureSummaryIndexes({ manifest, run: () => '{}' }), /LIST_INVALID/);
console.log('Finance additive indexes: already-ready no-op, exact creation, unrelated preservation, race, unhealthy state, timeout and declaration guards passed');
