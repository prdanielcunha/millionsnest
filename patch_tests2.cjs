const fs = require('fs');

let tService = fs.readFileSync('src/server/services/TenantContextMutationService.ts', 'utf8');
tService = tService.replace(
  "const code = (capacityResult as any).reasonCode;",
  "const code = capacityResult.success === false ? capacityResult.reasonCode : 'MEMBER_LIMIT_INVALID';"
);
fs.writeFileSync('src/server/services/TenantContextMutationService.ts', tService);

let testContent = fs.readFileSync('scripts/test_p0a3_invitation_acceptance_transaction.ts', 'utf8');
testContent = testContent.replace(/\(r(\d+) as any\)\.reasonCode/g, "(r$1.success === false ? r$1.reasonCode : '')");
fs.writeFileSync('scripts/test_p0a3_invitation_acceptance_transaction.ts', testContent);
