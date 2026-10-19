import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, setLogLevel, updateDoc, writeBatch } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) {
  throw new Error('Authority tests require an isolated demo Firestore emulator');
}
setLogLevel('silent');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT,
  firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
const org = 'syntheticauthority';
const access = { nestFinance: { enabled: true, permissions: ['finance.access.individual_v1', 'finance.count.execute'] } };
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db);
    batch.set(doc(db, 'organizations', org), { status: 'active', ownerUid: 'owner' });
    batch.set(doc(db, 'subscriptions', org), { status: 'active' });
    for (const [uid, role] of [['member', 'member'], ['admin', 'admin'], ['owner', 'owner'], ['global', 'owner']]) {
      batch.set(doc(db, 'users', uid), { uid, systemRole: uid === 'global' ? 'ceo' : 'user',
        organizationId: org, status: 'active', disabled: false, enabled: true, ecosystemSessionVersion: 5 });
      const membership = { uid, organizationId: org, role, organizationRole: role, status: 'active', appAccess: access };
      batch.set(doc(db, 'organizations', org, 'members', uid), membership);
      batch.set(doc(db, 'organization_members', `${uid}_${org}`), membership);
      batch.set(doc(db, 'organization_members', `${org}_${uid}`), membership);
    }
    batch.set(doc(db, 'organizations', org, 'audit_logs', 'protected'), { action: 'nestfinance.member.permissions_updated' });
    batch.set(doc(db, 'organizations', org, 'audit_logs', 'legacy'), { action: 'legacy.note' });
    await batch.commit();
  });
  if (process.env.REPRODUCE_AUTHORITY_BYPASS === '1') {
    const db = env.authenticatedContext('member').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'member'), { systemRole: 'ceo' }));
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users', 'member'), { systemRole: 'user' }));
    await assertSucceeds(updateDoc(doc(db, 'organizations', org, 'members', 'member'), { role: 'owner', appAccess: {} }));
    console.log('Reproduced both existing authority bypasses in isolated emulator');
  } else {
    let denied = 0;
    for (const uid of ['member', 'admin', 'owner', 'global']) {
      const db = env.authenticatedContext(uid).firestore();
      for (const path of [`organizations/${org}/members/${uid}`, `organization_members/${uid}_${org}`, `organization_members/${org}_${uid}`]) {
        const ref = doc(db, path);
        await assertSucceeds(getDoc(ref));
        for (const patch of [{ role: 'owner' }, { status: 'active', enabled: true, disabled: false },
          { appAccess: {} }, { permissions: ['finance.manage'], scope: { all: true } }]) {
          await assertFails(updateDoc(ref, patch)); denied++;
        }
        await assertFails(deleteDoc(ref));
        await assertFails(setDoc(doc(db, path + '-new'), { uid, organizationId: org, role: 'owner' }));
        denied += 2;
      }
      const audit = doc(db, 'organizations', org, 'audit_logs', 'protected');
      await assertFails(updateDoc(audit, { action: 'legacy.note' }));
      await assertFails(deleteDoc(audit));
      await assertFails(setDoc(doc(db, 'organizations', org, 'audit_logs', `forged-${uid}`), { action: 'nestfinance.member.permissions_updated' }));
      denied += 3;
      if (uid !== 'global') {
        const user = doc(db, 'users', uid);
        for (const patch of [{ systemRole: 'ceo' }, { globalRole: 'ceo' }, { capabilities: ['*'] },
          { status: 'active', disabled: false, enabled: true, ecosystemSessionVersion: 0 },
          { ecosystemSessionVersionUpdatedAt: null }, { uid: 'global' }, { organizationId: 'other' }]) {
          // Seed an inactive lifecycle before attempting reactivation.
          if ('status' in patch) await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users', uid), { status: 'disabled', disabled: true, enabled: false }));
          await assertFails(updateDoc(user, patch)); denied++;
        }
        await assertFails(deleteDoc(user));
        await assertFails(setDoc(doc(db, 'users', uid + '-new'), { systemRole: 'ceo' }));
        denied += 2;
        await assertSucceeds(updateDoc(user, { displayName: 'Safe profile edit', lastLoginAt: 123 }));
        await assertSucceeds(setDoc(doc(db, 'users', uid, 'preferences', 'appearance'), { theme: 'dark' }));
        const batch = writeBatch(db);
        batch.update(user, { displayName: 'Atomic malicious edit' });
        batch.update(doc(db, 'organizations', org, 'members', uid), { appAccess: {} });
        await assertFails(batch.commit()); denied++;
        assert.equal((await getDoc(user)).data()?.displayName, 'Safe profile edit');
      }
      await assertSucceeds(setDoc(doc(db, 'organizations', org, 'sharedNotes', uid), { title: 'Other app compatibility' }));
      await assertSucceeds(setDoc(doc(db, 'organizations', org, 'audit_logs', `benign-${uid}`), { action: 'legacy.note' }));
    }
    await env.withSecurityRulesDisabled(async context => {
      const ref = doc(context.firestore(), 'organizations', org, 'members', 'member');
      await updateDoc(ref, { role: 'viewer', appAccess: access });
      assert.deepEqual((await getDoc(ref)).data()?.appAccess, access);
    });
    console.log(`Canonical authority: ${denied} denied tampering operations; profile, preferences, other apps and trusted server controls passed`);
  }
} finally { await env.cleanup(); }
