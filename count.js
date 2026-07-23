const fs = require('fs');
const code = fs.readFileSync('scripts/test_mn_access_03_dashboard_projection.ts', 'utf-8');
const lines = code.split('\n');
let count = 0;
for (const line of lines) {
  if (line.includes('assert.strictEqual')) {
    if (line.includes('caseTests')) continue;
    // count loops?
  }
}
