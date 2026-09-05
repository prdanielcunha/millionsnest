import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

const start = source.indexOf("app.post('/api/v1/billing/reactivate'");
const end = source.indexOf("app.post('/api/v1/billing/portal'", start);
if (start < 0 || end < 0) {
  throw new Error('Could not isolate billing reactivation endpoint.');
}
const block = source.slice(start, end);

const required = [
  "resolveUserOrganizationContext(uid)",
  "organization.billing.manage",
  "const canManageBilling =",
  "if (!canManageBilling && !isSystemAdmin)",
  "stripe.subscriptions.update(stripeSubscriptionId",
];

for (const token of required) {
  if (!block.includes(token)) {
    throw new Error(`Missing reactivation billing authorization token: ${token}`);
  }
}

const forbidden = [
  "let isMember = false;",
  "let isOrgAdmin = false;",
  "Apenas administradores podem gerenciar assinaturas.",
];

for (const token of forbidden) {
  if (block.includes(token)) {
    throw new Error(`Legacy role-only reactivation gate remains: ${token}`);
  }
}

console.log('PASS: subscription reactivation honors the canonical organization billing capability and remains tenant-authorized.');
