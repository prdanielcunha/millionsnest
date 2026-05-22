import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize firebase
const serviceAccount = JSON.parse(readFileSync('./firebase-adminsdk.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const logs = await db.collection('stripe_webhook_logs').orderBy('receivedAt', 'desc').limit(5).get();
  console.log("Recent webhook logs:");
  logs.forEach(doc => {
    console.log(doc.id, "=>", doc.data().type, doc.data().status, doc.data().error || '');
  });
  process.exit(0);
}

run();
