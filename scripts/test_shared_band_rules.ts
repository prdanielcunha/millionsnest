import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_REQUIRED: this QA never runs against production');
}

const env = await initializeTestEnvironment({
  projectId: 'demo-millionsnest-shared-band-qa',
  firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
});

let assertions = 0;
async function seed({ role = 'member', status = 'active', permissions = {}, uid = 'user-1', legacy = false, globalRole = 'user' } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore();
    for (const orgId of ['org-one', 'org-two']) {
      await setDoc(doc(firestore, 'organizations', orgId), {
        status: 'active', apps: { musicscale: { status: 'active' } },
      });
      await setDoc(doc(firestore, 'subscriptions', orgId), { status: 'active' });
    }
    await setDoc(doc(firestore, 'users', uid), { systemRole: globalRole });
    if (legacy) {
      await setDoc(doc(firestore, 'organization_members', uid + '_org-one'), {
        role, status, permissions,
      });
    } else {
      await setDoc(doc(firestore, 'organizations', 'org-one', 'members', uid), {
        organizationRole: role, status, permissions,
      });
    }
  });
  return env.authenticatedContext(uid).firestore();
}
async function succeeds(op) { await assertSucceeds(op); assertions += 1; }
async function fails(op) { await assertFails(op); assertions += 1; }

try {
  {
    const db = await seed({ role: 'worship_leader' });
    await succeeds(setDoc(doc(db, 'bandScales', 'leader-band'), { organizationId: 'org-one', assignments: [] }));
    await succeeds(setDoc(doc(db, 'fixedBandScales', 'leader-fixed'), { organizationId: 'org-one', assignments: [] }));
    await succeeds(updateDoc(doc(db, 'fixedBandScales', 'leader-fixed'), { status: 'published' }));
    await fails(updateDoc(doc(db, 'fixedBandScales', 'leader-fixed'), { organizationId: 'org-two' }));
  }
  {
    const db = await seed({ role: 'member', permissions: { canManageScales: true } });
    await succeeds(setDoc(doc(db, 'fixedBandScales', 'explicit-fixed'), { organizationId: 'org-one' }));
    await succeeds(deleteDoc(doc(db, 'fixedBandScales', 'explicit-fixed')));
  }
  {
    const db = await seed({ role: 'leader', legacy: true });
    await succeeds(setDoc(doc(db, 'bandScales', 'legacy-band'), { organizationId: 'org-one' }));
  }
  {
    const db = await seed({ role: 'member' });
    await fails(setDoc(doc(db, 'bandScales', 'member-band'), { organizationId: 'org-one' }));
    await fails(setDoc(doc(db, 'fixedBandScales', 'member-fixed'), { organizationId: 'org-one' }));
  }
  {
    const db = await seed({ role: 'leader', status: 'suspended' });
    await fails(setDoc(doc(db, 'bandScales', 'suspended-band'), { organizationId: 'org-one' }));
  }
  {
    const db = await seed({ role: 'leader' });
    await fails(setDoc(doc(db, 'fixedBandScales', 'other-tenant'), { organizationId: 'org-two' }));
  }
  {
    const db = await seed({ role: 'member', globalRole: 'ceo' });
    await succeeds(setDoc(doc(db, 'fixedBandScales', 'global-admin'), { organizationId: 'org-two' }));
  }
  {
    await seed();
    const db = env.unauthenticatedContext().firestore();
    await fails(setDoc(doc(db, 'fixedBandScales', 'anonymous'), { organizationId: 'org-one' }));
  }
  assert.equal(assertions, 13);
  console.log('SHARED_BAND_RULES_EMULATOR_OK: ' + assertions + ' permission assertions');
} finally {
  await env.cleanup();
}
