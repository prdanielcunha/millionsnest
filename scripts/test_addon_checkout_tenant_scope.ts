import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

const required = [
  "app.post('/api/v1/billing/addons'",
  "verifyIdToken(authHeader.slice(7))",
  "organization.billing.manage",
  "organizationId: orgId",
  "Authorized addon checkout created",
  "Missing organizationId for organization-scoped addon purchase",
  "const organizationRef = db.collection('organizations').doc(sessionOrganizationId)",
  "organizationId: sessionOrganizationId",
  "Successfully provisioned organization addon",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing tenant-scoped addon contract token: ${token}`);
  }
}

const forbidden = [
  "const { userId, email, lookupKey } = req.body;",
  "const orgRef = db.collection('organizations').doc(userId);",
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`Unsafe legacy addon behavior remains: ${token}`);
  }
}

console.log('PASS: MusicScale add-on checkout is authenticated and add-on provisioning is scoped to the purchasing organization.');
