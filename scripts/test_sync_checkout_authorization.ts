import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

const required = [
  "app.get('/api/v1/billing/sync-checkout'",
  "verifyIdToken(authHeader.slice(7))",
  "SYNC_CHECKOUT_USER_MISMATCH",
  "SYNC_CHECKOUT_ORG_MISSING",
  "SYNC_CHECKOUT_ORG_FORBIDDEN",
  "organization.billing.manage",
  "event_type: 'checkout_session_reconciliation'",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing authenticated sync-checkout contract token: ${token}`);
  }
}

const forbidden = [
  "const orgId = session.metadata?.organizationId || session.metadata?.uid || session.client_reference_id;",
  "event_type: 'manual_reconciliation_admin'",
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`Unsafe legacy sync-checkout behavior remains: ${token}`);
  }
}

console.log('PASS: checkout reconciliation requires authenticated user/session binding and organization billing authorization.');
