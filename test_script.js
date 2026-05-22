import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize firebase
console.error("Starting debug script...");
try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    try {
      const serviceAccount = JSON.parse(readFileSync('./firebase-adminsdk.json', 'utf8'));
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.log('firebase-adminsdk.json not found, falling back to application default credentials');
      credential = admin.credential.applicationDefault();
    }
  }

  admin.initializeApp({
    credential
  });
} catch (e) {
  console.error("Error initializing Firebase:", e);
}

const db = admin.firestore();

async function run() {
  const uid = 'd1eu4UNmQgZcxhKDGy646igQhCt1';
  console.log(`Fetching user ${uid}...`);
  const userDoc = await db.collection('users').doc(uid).get();
  console.log("User data:", userDoc.data());
  
  const orgId = userDoc.data()?.organizationId || uid;
  console.log(`Fetching org ${orgId}...`);
  const orgDoc = await db.collection('organizations').doc(orgId).get();
  console.log("Org data:", orgDoc.data());
  
  const subDoc = await db.collection('subscriptions').doc(uid).get();
  console.log("Sub data:", subDoc.data());
  
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
