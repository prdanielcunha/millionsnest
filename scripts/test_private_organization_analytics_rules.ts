import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve('firestore.rules'), 'utf8');

assert.match(
  rules,
  /match \/analytics\/\{eventId\} \{/,
  'organization analytics must have an explicit Firestore rule'
);

const analyticsStart = rules.indexOf(
  'match /analytics/{eventId}'
);
const analyticsEnd = rules.indexOf(
  '\n      }',
  analyticsStart
);
assert.ok(
  analyticsStart >= 0 && analyticsEnd > analyticsStart,
  'organization analytics rule block must be discoverable'
);

const analyticsBlock = rules.slice(
  analyticsStart,
  analyticsEnd + 8
);

assert.match(
  analyticsBlock,
  /allow create:[\s\S]*?hasValidAnalyticsEnvelope\(\)/,
  'analytics create must use the canonical envelope validator'
);

assert.match(
  analyticsBlock,
  /organizationId'[\s\S]*?== orgId/,
  'analytics create must be bound to the active tenant path'
);

assert.match(
  analyticsBlock,
  /userId'[\s\S]*?request\.auth\.uid[\s\S]*?'none'/,
  'analytics attribution must be self or anonymous-within-tenant'
);

assert.match(
  rules,
  /function isValidOrganizationActionOsAnalytics\(\)/,
  'Action OS organization analytics must have a dedicated privacy validator'
);

assert.match(
  analyticsBlock,
  /eventType != 'action_os_interaction'[\s\S]*?isValidOrganizationActionOsAnalytics\(\)/,
  'Action OS analytics must pass the strict metadata validator before append'
);

for (const safeDismissCode of [
  'not_relevant',
  'already_handled',
  'not_my_responsibility',
  'too_early',
  'no_reason',
]) {
  assert.ok(
    rules.includes(`'${safeDismissCode}'`),
    `Action OS analytics rule must allow the structured dismiss code: ${safeDismissCode}`
  );
}

assert.match(
  rules,
  /metadata\.keys\(\)\.hasOnly\(\[[\s\S]*?'dismissCode'[\s\S]*?\]\)/,
  'Action OS analytics metadata must use an explicit field allowlist'
);

assert.match(
  analyticsBlock,
  /allow read:\s*if isSystemAdmin\(\);/,
  'ordinary tenant members must not receive analytics read access'
);

assert.match(
  analyticsBlock,
  /allow update, delete:\s*if false;/,
  'analytics events must remain append-only from clients'
);

const wildcardStart = rules.indexOf(
  'match /{app}/{document=**}'
);
const wildcardEnd = rules.indexOf(
  '\n      }',
  wildcardStart
);
assert.ok(
  wildcardStart >= 0 && wildcardEnd > wildcardStart,
  'generic organization wildcard must remain explicit'
);

const wildcard = rules.slice(
  wildcardStart,
  wildcardEnd + 8
);

for (const operation of [
  'allow read:',
  'allow create:',
  'allow update, delete:',
]) {
  const line = wildcard
    .split('\n')
    .find(value => value.includes(operation));

  assert.ok(line, `${operation} must exist in generic wildcard`);
  assert.match(
    line!,
    /app != 'analytics'/,
    `${operation} must exclude analytics because Firestore ORs overlapping matches`
  );
}

const analyticsClient = readFileSync(
  resolve('src/lib/analytics.ts'),
  'utf8'
);

assert.match(
  analyticsClient,
  /organizations\/\$\{orgId\}\/analytics/,
  'existing analytics writer must stay on the organization-scoped collection'
);

console.log('Private organization analytics Firestore rules contract passed.');
