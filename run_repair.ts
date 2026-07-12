import admin from 'firebase-admin';

// Initialize Firebase Admin (mock or real if credentials exist)
import { readFileSync } from 'fs';
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
} catch (e) {
  // If no SA, try default app
}

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
   const users = await db.collection('users').where('email', '==', 'pastordanielpcunha@gmail.com').get();
   if (users.empty) {
      console.log('User not found');
      return;
   }
   const user = users.docs[0].data();
   const orgId = user.organizationId || user.primaryOrganizationId || users.docs[0].id;
   console.log('Found orgId:', orgId);
   // We won't actually repair because we need the stripe key to query subscriptions.
}
run();
