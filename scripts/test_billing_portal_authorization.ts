import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(process.cwd(), 'src/pages/Dashboard.tsx'), 'utf8');

const serverRequired = [
  "app.post('/api/v1/billing/portal'",
  "req.headers.authorization",
  "verifyIdToken(authHeader.slice(7))",
  "resolveUserOrganizationContext(userId)",
  "organization.billing.manage",
  "db.collection('subscriptions').doc(orgId).get()",
  "Creating authorized billing portal session",
];

for (const token of serverRequired) {
  if (!server.includes(token)) {
    throw new Error(`Missing billing portal authorization token: ${token}`);
  }
}

if (server.includes("const { userId } = req.body;")) {
  throw new Error('Billing portal still trusts userId supplied by the request body.');
}

const clientRequired = [
  "const token = await user.getIdToken();",
  "'Authorization': `Bearer ${token}`",
  "body: JSON.stringify({ organizationId: activeContextOrgId })",
];

for (const token of clientRequired) {
  if (!dashboard.includes(token)) {
    throw new Error(`Dashboard billing portal client is missing: ${token}`);
  }
}

console.log('PASS: billing portal sessions require authenticated, organization-authorized billing access.');
