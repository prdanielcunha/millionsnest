import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
let env: RulesTestEnvironment;
const arrangement = { id: 'medley-a', revision: 1, steps: [{ songId: 'song-a', snapshot: 'C G' }] };
const template = (organizationId = 'org-a') => ({
  organizationId, name: 'João viu + Além do rio azul', arrangement,
});
const memberDb = (uid: string) => env.authenticatedContext(uid).firestore();

async function seedMember(
  uid: string,
  role: string,
  organizationRole = 'member',
  status = 'active',
  permissions: Record<string, boolean> = {},
  legacy = false,
) {
  await env.withSecurityRulesDisabled(async ({ firestore }) => {
    const path = legacy ? `organization_members/${uid}_org-a` : `organizations/org-a/members/${uid}`;
    await setDoc(doc(firestore(), path), {
      uid, userId: uid, organizationId: 'org-a',
      role, organizationRole, status, permissions,
    });
    await setDoc(doc(firestore(), `users/${uid}`), { systemRole: 'user' });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-medley-template-rules',
    firestore: {
      host, port: Number(port), rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ({ firestore }) => {
    const db = firestore();
    await setDoc(doc(db, 'organizations/org-a'), {
      ownerUid: 'owner-without-membership',
      status: 'active', apps: { musicscale: { status: 'active' } },
    });
    await setDoc(doc(db, 'organizations/org-b'), {
      ownerUid: 'other-owner', status: 'active',
      apps: { musicscale: { status: 'active' } },
    });
    await setDoc(doc(db, 'subscriptions/org-a'), { status: 'active' });
    await setDoc(doc(db, 'subscriptions/org-b'), { status: 'active' });
    await setDoc(doc(db, 'users/owner-without-membership'), { systemRole: 'user' });
  });
});

test('organization owner, admin, worship leader and minister can save medley templates', async () => {
  for (const [uid, role, orgRole] of [
    ['owner', 'member', 'owner'],
    ['admin', 'admin', 'member'],
    ['worship-leader', 'member', 'worship_leader'],
    ['leader', 'leader', 'member'],
    ['minister', 'member', 'minister'],
    ['pastor', 'member', 'pastor'],
  ]) {
    await seedMember(uid, role, orgRole);
    const ref = doc(memberDb(uid), 'medleyTemplates', uid);
    await assertSucceeds(setDoc(ref, template()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { name: 'Medley atualizado' }));
    await assertSucceeds(deleteDoc(ref));
  }
});

test('canonical documented owner without member record can save; suspended owner cannot', async () => {
  const ownerRef = doc(memberDb('owner-without-membership'), 'medleyTemplates', 'owner-fallback');
  await assertSucceeds(setDoc(ownerRef, template()));
  await seedMember('owner-without-membership', 'owner', 'owner', 'suspended');
  await assertFails(setDoc(doc(memberDb('owner-without-membership'), 'medleyTemplates', 'owner-blocked'), template()));
});

test('active legacy leader and explicitly delegated manager retain existing scale authority', async () => {
  await seedMember('legacy-minister', 'Ministro', 'member', 'ativo', {}, true);
  await seedMember('delegated', 'member', 'member', 'active', { canManageScales: true });
  await assertSucceeds(setDoc(doc(memberDb('legacy-minister'), 'medleyTemplates', 'legacy'), template()));
  await assertSucceeds(setDoc(doc(memberDb('delegated'), 'medleyTemplates', 'delegated'), template()));
});

test('ordinary members can read organization templates but not modify them', async () => {
  await seedMember('leader', 'leader');
  await seedMember('member', 'member');
  const ref = doc(memberDb('leader'), 'medleyTemplates', 'shared');
  await assertSucceeds(setDoc(ref, template()));
  await assertSucceeds(getDoc(doc(memberDb('member'), 'medleyTemplates', 'shared')));
  await assertSucceeds(getDocs(query(collection(memberDb('member'), 'medleyTemplates'), where('organizationId', '==', 'org-a'))));
  await assertFails(setDoc(doc(memberDb('member'), 'medleyTemplates', 'forbidden'), template()));
  await assertFails(updateDoc(doc(memberDb('member'), 'medleyTemplates', 'shared'), { name: 'Tampered' }));
});

test('suspended membership, other tenants, anonymous users and organization transfer are denied', async () => {
  await seedMember('leader', 'leader');
  await seedMember('suspended', 'admin', 'admin', 'suspended');
  await seedMember('outsider', 'member');
  const original = doc(memberDb('leader'), 'medleyTemplates', 'protected');
  await assertSucceeds(setDoc(original, template()));
  await assertFails(setDoc(doc(memberDb('suspended'), 'medleyTemplates', 'suspended'), template()));
  await assertFails(getDoc(doc(memberDb('suspended'), 'medleyTemplates', 'protected')));
  await assertFails(setDoc(doc(memberDb('leader'), 'medleyTemplates', 'wrong-tenant'), template('org-b')));
  await assertFails(updateDoc(original, { organizationId: 'org-b' }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'medleyTemplates', 'protected')));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'medleyTemplates', 'anonymous'), template()));
  await assertFails(setDoc(doc(memberDb('outsider'), 'medleyTemplates', 'invalid'), { ...template(), name: '' }));
  await assertFails(setDoc(doc(memberDb('leader'), 'medleyTemplates', 'invalid-arrangement'), { ...template(), arrangement: null }));
});

test('suspended organization cannot accept writes or reads even from active leaders', async () => {
  await seedMember('leader', 'leader');
  await env.withSecurityRulesDisabled(async ({ firestore }) => {
    await updateDoc(doc(firestore(), 'organizations/org-a'), { status: 'suspended' });
  });
  await assertFails(setDoc(doc(memberDb('leader'), 'medleyTemplates', 'frozen'), template()));
});
