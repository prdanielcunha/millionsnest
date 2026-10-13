import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';

const projectId = 'demo-millionsnest-musicscale-global-curation';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') }
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/ceo'), { systemRole: 'ceo' }),
      setDoc(doc(db, 'users/administrator'), { globalRole: 'global_admin', systemRole: 'user' }),
      setDoc(doc(db, 'users/support'), { systemRole: 'ecosystem_support' }),
      setDoc(doc(db, 'users/tenant-admin'), { systemRole: 'user', organizationRole: 'admin' }),
      setDoc(doc(db, 'users/musician'), { systemRole: 'user' }),
      setDoc(doc(db, 'globalLibraryCandidates/candidate-1'), { status: 'pending_review', title: 'Song' }),
      setDoc(doc(db, 'globalLibraryCandidates/candidate-1/occurrences/occ-1'), { source: { organizationId: 'org-b' } }),
      setDoc(doc(db, 'songDiscoveryInbox/org-b_song-1'), { sourceOrganizationId: 'org-b' }),
    ]);
  });
});

for (const role of ['ceo', 'administrator', 'support']) {
  test(role + ' can read cross-org pending candidates and inbox', async () => {
    const db = env.authenticatedContext(role).firestore();
    await assertSucceeds(getDoc(doc(db, 'globalLibraryCandidates/candidate-1')));
    await assertSucceeds(getDoc(doc(db, 'globalLibraryCandidates/candidate-1/occurrences/occ-1')));
    await assertSucceeds(getDocs(collection(db, 'globalLibraryCandidates')));
    await assertSucceeds(getDoc(doc(db, 'songDiscoveryInbox/org-b_song-1')));
  });
  test(role + ' cannot change pending reviews directly', async () => {
    const db = env.authenticatedContext(role).firestore();
    await assertFails(setDoc(doc(db, 'globalLibraryCandidates/candidate-2'), { status: 'approved' }));
  });
}
for (const role of ['tenant-admin', 'musician']) {
  test(role + ' never receives global curation access', async () => {
    const db = env.authenticatedContext(role).firestore();
    await assertFails(getDoc(doc(db, 'globalLibraryCandidates/candidate-1')));
    await assertFails(getDocs(collection(db, 'globalLibraryCandidates')));
    await assertFails(getDoc(doc(db, 'globalLibraryCandidates/candidate-1/occurrences/occ-1')));
    await assertFails(getDoc(doc(db, 'songDiscoveryInbox/org-b_song-1')));
    await assertFails(setDoc(doc(db, 'globalLibraryCandidates/candidate-2'), { status: 'pending_review' }));
  });
}
