import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  applyEcosystemOrganizationCleanup,
  previewEcosystemOrganizationCleanup,
} from '../src/server/services/EcosystemOrganizationCleanupService.js';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'millionsnest';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const auth = getAuth();
const apply = process.argv.includes('--apply');

async function main() {
  if (!apply) {
    const { preview } = await previewEcosystemOrganizationCleanup({ db });
    console.log(`CLEANUP_SUMMARY_JSON=${JSON.stringify({ mode: 'dry-run', projectId, ...preview })}`);
    return;
  }

  // Never run destructive tenant removal from a generic CLI flag.
  // Individual choices and the owner-account option require authenticated
  // administrative review with fresh eligibility checks through the Hub.
  throw new Error('USE_AUTHENTICATED_SELECTIVE_ORGANIZATION_CLEANUP');
}

main().catch(error => {
  console.error('CLEANUP_FATAL', error?.message || 'Unexpected failure');
  process.exit(1);
});
