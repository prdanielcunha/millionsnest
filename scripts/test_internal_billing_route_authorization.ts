import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server.ts', 'utf8');

function routeBlock(startMarker: string, nextMarker: string): string {
  const start = server.indexOf(startMarker);
  assert.ok(start >= 0, `missing route: ${startMarker}`);
  const end = server.indexOf(nextMarker, start + startMarker.length);
  assert.ok(end > start, `missing next route marker after: ${startMarker}`);
  return server.slice(start, end);
}

const syncBlock = routeBlock(
  "app.post('/api/internal/sync-stripe-products'",
  "app.get('/api/v1/billing/products'"
);

assert.match(syncBlock, /authorization/, 'billing sync must require Authorization');
assert.match(syncBlock, /verifyIdToken/, 'billing sync must verify Firebase token');
assert.match(syncBlock, /isGlobalPrivilegedRole/, 'billing sync must require global privileged role');
assert.match(syncBlock, /status\(401\)/, 'billing sync must reject unauthenticated requests');
assert.match(syncBlock, /status\(403\)/, 'billing sync must reject non-privileged users');
assert.match(syncBlock, /billing\.catalog\.sync_requested/, 'billing sync must leave an audit trail');
assert.match(syncBlock, /express\.json\(\{ limit: '1kb' \}\)/, 'billing sync body must remain tightly bounded');

const publicCatalogBlock = routeBlock(
  "app.get('/api/v1/billing/products'",
  "app.get('/api/v1/billing/debug'"
);
assert.equal(publicCatalogBlock.includes('verifyIdToken'), false, 'public pricing catalog must remain anonymously readable');
assert.match(publicCatalogBlock, /Cache-Control/, 'public pricing catalog must preserve caching');

const debugBlock = routeBlock(
  "app.get('/api/v1/billing/debug'",
  "app.post('/api/user/organization'"
);
assert.match(debugBlock, /MILLIONSNEST_DEBUG_ENDPOINTS_ENABLED/, 'billing debug must be feature-gated');
assert.match(debugBlock, /authorization/, 'billing debug must require Authorization');
assert.match(debugBlock, /verifyIdToken/, 'billing debug must verify Firebase token');
assert.match(debugBlock, /isGlobalPrivilegedRole/, 'billing debug must require global privileged role');
assert.match(debugBlock, /status\(401\)/, 'billing debug must reject unauthenticated requests');
assert.match(debugBlock, /status\(403\)/, 'billing debug must reject disabled/non-privileged access');

console.log('PASS internal billing sync and debug authorization contract');
