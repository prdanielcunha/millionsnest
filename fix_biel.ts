import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
} catch(e) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}
const db = admin.firestore();
const auth = admin.auth();

async function run() {
    const userRef = db.collection('users').doc('Z7aB9TTiMAVsEmGahGt3dTLvKjI2');
    const userDoc = await userRef.get();
    console.log("User Doc:", userDoc.exists ? userDoc.data() : "NOT EXISTS");

    const mRef = db.collection('organizations').doc('Z7aB9TTiMAVsEmGahGt3dTLvKjI2').collection('members').doc('Z7aB9TTiMAVsEmGahGt3dTLvKjI2');
    const mDoc = await mRef.get();
    console.log("Member Doc:", mDoc.exists ? mDoc.data() : "NOT EXISTS");

    const oRef = db.collection('organizations').doc('Z7aB9TTiMAVsEmGahGt3dTLvKjI2');
    const oDoc = await oRef.get();
    console.log("Org Doc:", oDoc.exists ? oDoc.data() : "NOT EXISTS");

    console.log("Finished diagnostics check");
}
run().catch(console.error);
