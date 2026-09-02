import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let environment;
const org = 'org-a';
const otherOrg = 'org-b';
const productPath = (orgId, bucket, id) =>
  `organizations/${orgId}/products/raiz_e_mesa/${bucket}/${id}`;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'millionsnest-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', org), {
      name: 'Igreja A',
      apps: { raiz_e_mesa: { status: 'active' } },
    });
    await setDoc(doc(db, 'organizations', otherOrg), {
      name: 'Igreja B',
      apps: { raiz_e_mesa: { status: 'active' } },
    });
    await setDoc(doc(db, `organizations/${org}/members/care-user`), {
      status: 'active',
      role: 'member',
      organizationRole: 'care',
      congregationIds: ['campus-a'],
      appAccess: { raiz_e_mesa: { roles: ['care'] } },
    });
    await setDoc(doc(db, `organizations/${org}/members/pastor-user`), {
      status: 'active',
      role: 'member',
      organizationRole: 'pastor',
      congregationIds: ['campus-a'],
      appAccess: { raiz_e_mesa: { roles: ['pastor'] } },
    });
    await setDoc(doc(db, `organizations/${otherOrg}/members/other-user`), {
      status: 'active',
      role: 'member',
      organizationRole: 'care',
      congregationIds: ['campus-b'],
      appAccess: { raiz_e_mesa: { roles: ['care'] } },
    });
    await setDoc(doc(db, productPath(org, 'people', 'person-a')), {
      organizationId: org,
      congregationId: 'campus-a',
      name: 'Pessoa Teste',
    });
    await setDoc(doc(db, productPath(org, 'pastoral', 'note-a')), {
      organizationId: org,
      note: 'Restrita',
    });
    await setDoc(doc(db, productPath(org, 'audit', 'audit-a')), {
      organizationId: org,
      actorId: 'care-user',
      action: 'created',
    });
  });
});
after(async () => environment.cleanup());

test('impede leitura entre organizações', async () => {
  const db = environment.authenticatedContext('other-user').firestore();
  await assertFails(getDoc(doc(db, productPath(org, 'people', 'person-a'))));
});

test('limita cuidado à congregação atribuída e impede migração', async () => {
  const db = environment.authenticatedContext('care-user').firestore();
  await assertSucceeds(getDoc(doc(db, productPath(org, 'people', 'person-a'))));
  await assertFails(updateDoc(doc(db, productPath(org, 'people', 'person-a')), {
    congregationId: 'campus-b',
  }));
});

test('restringe dados pastorais ao papel pastoral', async () => {
  const careDb = environment.authenticatedContext('care-user').firestore();
  const pastorDb = environment.authenticatedContext('pastor-user').firestore();
  await assertFails(getDoc(doc(careDb, productPath(org, 'pastoral', 'note-a'))));
  await assertSucceeds(getDoc(doc(pastorDb, productPath(org, 'pastoral', 'note-a'))));
});

test('mantém auditoria imutável', async () => {
  const db = environment.authenticatedContext('care-user').firestore();
  await assertFails(updateDoc(doc(db, productPath(org, 'audit', 'audit-a')), {
    action: 'changed',
  }));
});
