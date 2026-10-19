// Read-only production query certification. Never reads a real tenant path,
// prints response documents, writes data/indexes, or changes IAM/billing.
import { readFileSync } from 'node:fs';
const token = readFileSync(0, 'utf8').trim();
if (!token) throw Error('ACCESS_TOKEN_REQUIRED_ON_STDIN');
const base = 'https://firestore.googleapis.com/v1/projects/millionsnest/databases/(default)';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const parent = '/documents/organizations/nf-probe-no-documents-20261019-4d739e20';
const field = (fieldPath, op, stringValue) => ({ fieldFilter: { field: { fieldPath }, op, value: { stringValue } } });
const specs = [
  { name: 'status_count', key: 'listQueryKeys.status', sum: false },
  { name: 'direction_sum', key: 'listQueryKeys.direction', sum: true },
  { name: 'direction_status_sum', key: 'listQueryKeys.directionStatus', sum: true },
];
const metadataResponse = await fetch(base + '/collectionGroups/financeTransactions/indexes?pageSize=100', {
  headers, signal: AbortSignal.timeout(20000),
});
if (metadataResponse.ok) {
  const metadata = await metadataResponse.json();
  for (const index of metadata.indexes ?? []) {
    const fields = (index.fields ?? []).filter(field => field.fieldPath !== '__name__');
    if (fields.some(field => field.fieldPath.startsWith('listQueryKeys.'))) {
      console.log('FINANCE_INDEX_METADATA=' + JSON.stringify({ state: index.state,
        scope: index.queryScope, fields: fields.map(field => [field.fieldPath, field.order]) }));
    }
  }
} else console.log('FINANCE_INDEX_METADATA_HTTP=' + metadataResponse.status);
let failures = 0;
for (const spec of specs) {
  const structuredQuery = {
    from: [{ collectionId: 'financeTransactions' }],
    where: { compositeFilter: { op: 'AND', filters: [
      field('financeEntityId', 'EQUAL', '__synthetic_index_probe__'),
      field(spec.key, 'GREATER_THAN_OR_EQUAL', '__synthetic_index_probe__|'),
      field(spec.key, 'LESS_THAN', '__synthetic_index_probe__|\uf8ff'),
    ] } }, limit: 1,
  };
  const response = await fetch(base + parent + ':runAggregationQuery', {
    method: 'POST', headers, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery,
      aggregations: [{ alias: 'probe', ...(spec.sum ? { sum: { field: { fieldPath: 'amountCents' } } } : { count: {} }) }],
    } }),
  });
  const payload = await response.json();
  const error = payload?.error;
  console.log('FINANCE_SUMMARY_QUERY_PROBE=' + JSON.stringify({ name: spec.name,
    http: response.status, code: error?.status ?? 'OK',
    requiresIndex: /requires an index|index.*required/i.test(String(error?.message ?? '')) }));
  if (!response.ok) failures++;
}
if (failures) process.exitCode = 1;
