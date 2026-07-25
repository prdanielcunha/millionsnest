const fs = require('fs');
let code = fs.readFileSync('scripts/test_mn_access_04_launcher_contract.ts', 'utf8');

code = code.replace(/deps\)/g, 'deps as any)');
code = code.replace(/depsPayload\)/g, 'depsPayload as any)');

fs.writeFileSync('scripts/test_mn_access_04_launcher_contract.ts', code, 'utf8');
