const fs = require('fs');
let code = fs.readFileSync('src/server/services/ConnectSessionContextService.ts', 'utf8');

code = code.replace(
  'function sanitizeStringArray(val: unknown): string[] {',
  `function sanitizeStringArray(val: unknown): string[] {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const result = new Set<string>();
    for (const [k, v] of Object.entries(val)) {
      if (v === true) {
        const sanitized = sanitizeString(k);
        if (sanitized) result.add(sanitized);
      }
    }
    return Array.from(result);
  }`
);

fs.writeFileSync('src/server/services/ConnectSessionContextService.ts', code);
