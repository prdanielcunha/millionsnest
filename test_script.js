import admin from 'firebase-admin';

console.error("Starting debug script...");
try {
  let db;
  const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (saBase64 && !admin.apps.length) {
    const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else if (projectId && clientEmail && privateKey && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      })
    });
  } else if (projectId && !admin.apps.length) {
    admin.initializeApp({
      projectId: projectId,
    });
  }
} catch (e) {
  console.error("Error initializing:", e);
}
const db = admin.firestore();

async function run() {
  const uid = 'd1eu4UNmQgZcxhKDGy646igQhCt1';
  console.log(`Fetching user ${uid}...`);
  const userDoc = await db.collection('users').doc(uid).get();
  console.log("User data:", userDoc.data());
  
  const emails = await db.collection('users').where('email', '==', 'ocasalcunha@gmail.com').get();
  emails.forEach(doc => {
      console.log("Found user by email: ", doc.id, doc.data());
  });

  const orgId = userDoc.data()?.organizationId || uid;
  console.log(`Fetching org ${orgId}...`);
  const orgDoc = await db.collection('organizations').doc(orgId).get();
  console.log("Org data:", orgDoc.data());
  
  const subDoc = await db.collection('subscriptions').doc(uid).get();
  console.log("Sub data:", subDoc.data());
  
  const subs = await db.collection('subscriptions').get();
  console.log(`Found ${subs.size} total subscriptions`);
  subs.forEach(doc => {
      console.log("Sub: ", doc.id, doc.data());
  });

  const users = await db.collection('users').get();
  console.log(`Found ${users.size} total users`);
  users.forEach(doc => {
      if (doc.data().subscriptionStatus || doc.data().subscription_status || doc.data().status) {
         console.log("User with sub:", doc.id, doc.data());
      }
  });

  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
