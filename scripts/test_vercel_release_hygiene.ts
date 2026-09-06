import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

assert.equal(
  config.git?.deploymentEnabled?.main,
  false,
  'main must not trigger duplicate Vercel deployments; production remains the release branch'
);
assert.notEqual(
  config.git?.deploymentEnabled?.production,
  false,
  'production deployments must remain enabled'
);

const apiHeaders = (config.headers || [])
  .find((entry: any) => entry.source === '/api/(.*)')?.headers || [];

const headerMap = new Map(
  apiHeaders.map((entry: any) => [String(entry.key).toLowerCase(), String(entry.value)])
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

console.log('PASS Vercel release and CORS hygiene');
