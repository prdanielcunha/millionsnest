import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync('.github/workflows/cloudrun-private-deploy.yml', 'utf8');
assert.match(workflow, /--update-env-vars/);
assert.match(workflow, /--update-secrets/);
assert.doesNotMatch(workflow, /--set-env-vars|--clear-env-vars|--set-secrets|--clear-secrets/);
assert.match(workflow, /NODE_ENV=production/);
assert.match(workflow, /--no-allow-unauthenticated/);
console.log('PASS Cloud Run environment preservation');
