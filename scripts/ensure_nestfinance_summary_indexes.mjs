import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Canonical Hub owns these indexes. No full manifest deploy, deletion, data
// writes, IAM or billing mutation. Keep the two proven SUM query shapes pinned.
export const SUMMARY_INDEX_SPECS = ['listQueryKeys.direction', 'listQueryKeys.directionStatus'].map(key => ({
  collectionGroup: 'financeTransactions', queryScope: 'COLLECTION',
  fields: ['financeEntityId', key, 'amountCents'].map(fieldPath => ({ fieldPath, order: 'ASCENDING' })),
}));
const prefix = ['firestore', 'indexes', 'composite'];
const projectArgs = ['--project=millionsnest', '--database=(default)'];
const sameFields = (left, right) => JSON.stringify(left.map(field => [field.fieldPath, field.order])) ===
  JSON.stringify(right.map(field => [field.fieldPath, field.order]));
function command(args) {
  try {
    return execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  } catch {
    // Never print CLI response bodies or credentials.
    throw Error('FINANCE_INDEX_COMMAND_FAILED:' + args.slice(0, 4).join(':'));
  }
}
function matches(index, spec) {
  const fields = (index.fields ?? []).filter(field => field.fieldPath !== '__name__');
  return String(index.name ?? '').includes('/collectionGroups/financeTransactions/indexes/') &&
    index.queryScope === 'COLLECTION' && sameFields(fields, spec.fields);
}
export async function ensureSummaryIndexes({ manifest, run = command, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  attempts = 80, pollMs = 10000, log = console.log } = {}) {
  for (const spec of SUMMARY_INDEX_SPECS) {
    if (!manifest?.indexes?.some(index => index.collectionGroup === spec.collectionGroup &&
      index.queryScope === spec.queryScope && sameFields(index.fields ?? [], spec.fields))) {
      throw Error('REVIEWED_FINANCE_SUMMARY_INDEX_NOT_DECLARED');
    }
  }
  const list = () => {
    const indexes = JSON.parse(run([...prefix, 'list', ...projectArgs, '--format=json']));
    if (!Array.isArray(indexes)) throw Error('FINANCE_INDEX_LIST_INVALID');
    return indexes;
  };
  for (const spec of SUMMARY_INDEX_SPECS) {
    const key = spec.fields[1].fieldPath;
    let existing = list().find(index => matches(index, spec));
    if (!existing) {
      try {
        run([...prefix, 'create', ...projectArgs, '--collection-group=financeTransactions',
          '--query-scope=collection', '--async', '--quiet',
          ...spec.fields.map(field => '--field-config=field-path=' + field.fieldPath + ',order=ascending')]);
        log('FINANCE_SUMMARY_INDEX_ADD_ONLY_REQUESTED=' + key);
      } catch (error) {
        // Another authorized publisher may have created this exact index.
        if (!list().some(index => matches(index, spec))) throw error;
      }
    }
    let ready = false;
    for (let attempt = 0; attempt < attempts; attempt++) {
      existing = list().find(index => matches(index, spec));
      if (existing?.state === 'READY') { ready = true; break; }
      if (existing && existing.state !== 'CREATING') throw Error('FINANCE_SUMMARY_INDEX_UNHEALTHY:' + key);
      if (attempt + 1 < attempts) await sleep(pollMs);
    }
    if (!ready) throw Error('FINANCE_SUMMARY_INDEX_NOT_READY:' + key);
    log('FINANCE_SUMMARY_INDEX_READY=' + key);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await ensureSummaryIndexes({ manifest: JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) });
}
