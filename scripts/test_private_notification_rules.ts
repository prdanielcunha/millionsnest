import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve('firestore.rules'), 'utf8');

assert.match(
  rules,
  /match \/notifications\/\{notificationId\} \{/,
  'notifications must have an explicit narrow Firestore rule'
);

assert.match(
  rules,
  /resource\.data\.get\('recipientId', ''\) == request\.auth\.uid/,
  'notification reads must be recipient-scoped'
);

assert.match(
  rules,
  /affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'isRead'[\s\S]*?'isArchived'[\s\S]*?'readAt'[\s\S]*?'archivedAt'[\s\S]*?\]\)/,
  'notification client mutations must be limited to read/archive interaction fields'
);

const genericOrgWildcardIndex = rules.indexOf('match /{app}/{document=**}');
assert.ok(
  genericOrgWildcardIndex >= 0,
  'generic organization wildcard must remain explicit'
);

const genericOrgWildcard = rules.slice(
  genericOrgWildcardIndex,
  rules.indexOf('\n      }', genericOrgWildcardIndex) + 8
);

for (const operation of ['allow read:', 'allow create:', 'allow update, delete:']) {
  const line = genericOrgWildcard
    .split('\n')
    .find(value => value.includes(operation));

  assert.ok(line, `${operation} line must exist in generic organization wildcard`);
  assert.match(
    line!,
    /app != 'notifications'/,
    `${operation} must explicitly exclude notifications because Firestore ORs overlapping matches`
  );
}

console.log('Private notification Firestore rules contract passed.');
