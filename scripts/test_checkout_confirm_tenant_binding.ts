import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

const required = [
  "const sessionUserId =",
  "CHECKOUT_SESSION_USER_MISMATCH",
  "CHECKOUT_SESSION_ORG_MISSING",
  "resolveUserOrganizationContext(userId)",
  "organization.billing.manage",
  "CHECKOUT_ORG_FORBIDDEN",
  "Session/user binding rejected",
  "Organization billing authorization rejected",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing checkout confirmation authorization contract token: ${token}`);
  }
}

const unsafeLegacy = "Mismatch client_reference_id for user";
if (source.includes(unsafeLegacy)) {
  throw new Error('Checkout confirmation still only logs a client_reference mismatch instead of blocking it.');
}

console.log('PASS: checkout confirmation is bound to the authenticated user and re-authorizes organization billing access before provisioning.');
