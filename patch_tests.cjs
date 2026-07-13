const fs = require('fs');
let content = fs.readFileSync('scripts/test_p0a3_invitation_acceptance_transaction.ts', 'utf8');

// replace rX.reasonCode with (rX as any).reasonCode
content = content.replace(/r(\d+)\.reasonCode/g, '(r$1 as any).reasonCode');
fs.writeFileSync('scripts/test_p0a3_invitation_acceptance_transaction.ts', content);

let tService = fs.readFileSync('src/server/services/TenantContextMutationService.ts', 'utf8');
tService = tService.replace(
  "if (!capacityResult.success) {",
  "if (capacityResult.success === false) {"
);
tService = tService.replace(
  "const code = capacityResult.reasonCode;",
  "const code = (capacityResult as any).reasonCode;"
);
fs.writeFileSync('src/server/services/TenantContextMutationService.ts', tService);
