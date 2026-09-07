import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

assert.equal(
  config.git?.deploymentEnabled,
  false,
  'all automatic Git deployments must stay disabled; releases are manual-only'
);
assert.equal(
  Object.prototype.hasOwnProperty.call(config, 'ignoreCommand'),
  false,
  'manual-only release mode must not depend on an ignored-build shell command'
);

// Operational contract: commits, pull requests, main and production pushes are
// validated by CI only. A Vercel deployment is created explicitly by the
// release operator after the batch is approved.

const apiHeaders = (config.headers || [])
  .find((entry: any) => entry.source === '/api/(.*)')?.headers || [];

const headerMap = new Map<string, string>(
  apiHeaders.map((entry: any): [string, string] => [
    String(entry.key).toLowerCase(),
    String(entry.value)
  ])
);

assert.equal(
  headerMap.get('access-control-allow-origin'),
  '*',
  'Bearer-token APIs keep cross-origin access for ecosystem satellite apps'
);
assert.equal(
  headerMap.has('access-control-allow-credentials'),
  false,
  'wildcard CORS must not advertise credentialed requests'
);
assert.match(
  headerMap.get('access-control-allow-headers') || '',
  /Authorization/i,
  'Authorization header must remain allowed for Bearer-token ecosystem APIs'
);

const server = readFileSync('server.ts', 'utf8');
assert.equal(
  server.includes('app.use(cors());'),
  true,
  'Express CORS middleware must remain enabled'
);

console.log('PASS Vercel release, build-cost, and CORS hygiene');
