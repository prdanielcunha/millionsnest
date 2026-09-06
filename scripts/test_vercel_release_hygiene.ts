import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

assert.equal(
  config.git?.deploymentEnabled?.main,
  false,
  'main must not trigger duplicate Vercel deployments; production remains the release branch'
);
assert.equal(
  config.git?.deploymentEnabled?.production,
  true,
  'production deployments must remain explicitly enabled'
);
assert.match(
  config.ignoreCommand || '',
  /VERCEL_GIT_COMMIT_REF/,
  'Vercel ignored-build policy must inspect the Git branch'
);

const runIgnore = (ref: string) => spawnSync(config.ignoreCommand, {
  shell: true,
  env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
  encoding: 'utf8'
});
assert.equal(runIgnore('production').status, 1, 'production must proceed with a Vercel build');
assert.equal(runIgnore('main').status, 0, 'main must be skipped by Vercel');
assert.equal(runIgnore('fix/home-authority').status, 0, 'ordinary branches must be skipped by Vercel');

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
