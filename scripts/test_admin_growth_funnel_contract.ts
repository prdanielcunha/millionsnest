import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const analytics = readFileSync('src/lib/analytics.ts', 'utf8');
const admin = readFileSync('src/pages/EcosystemAdmin.tsx', 'utf8');
const panel = readFileSync('src/components/admin/GrowthFunnelPanel.tsx', 'utf8');
const server = readFileSync('server.ts', 'utf8');

for (const eventType of [
  'trial_cta_clicked',
  'signup',
  'checkout_started',
  'checkout_completed',
]) {
  assert.match(
    analytics,
    new RegExp(`growthMirrorEventTypes[\\s\\S]*'${eventType}'`),
    `growth root mirror missing ${eventType}`,
  );
}

assert.equal(
  admin.includes('getDocs(query(collection(db, "analytics_events")))'),
  false,
  'global admin must not download the entire analytics_events collection on every load',
);
assert.match(admin, /GrowthFunnelPanel/, 'admin Analytics tab must mount the commercial funnel');
assert.match(panel, /\/api\/admin\/analytics\/growth\?days=/, 'panel must use bounded admin growth API');
assert.match(panel, /\[7, 30\]/, 'panel must expose the 7/30-day window selector');
assert.match(panel, /useState<7 \| 30>\(7\)/, 'panel must default to the 7-day sales window');
assert.match(server, /app\.get\('\/api\/admin\/analytics\/growth'/, 'server must expose admin growth endpoint');
assert.match(server, /verifyIdToken/, 'growth endpoint must verify Firebase auth');
assert.match(server, /isGlobalPrivilegedRole/, 'growth endpoint must require global privileged role');
assert.match(server, /limit\(maxEvents\)/, 'growth endpoint must bound event reads');
assert.match(server, /maxEvents = 5000/, 'growth endpoint must define an explicit operational read cap');
assert.match(server, /Cache-Control', 'private, no-store'/, 'growth response must not be publicly cached');

console.log('PASS bounded admin Growth funnel, authentication, and commercial event mirror contract');
