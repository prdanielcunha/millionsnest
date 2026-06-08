import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

let db = null;
try {
  admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
  });
  db = admin.firestore();
} catch(e) {
  admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
  });
  db = admin.firestore();
}

async function run() {
  try {
     const p = await db!.collection('users').where('email', '==', 'bielherique2003@gmail.com').get();
     if(p.empty) {
        console.log("Not found by email.");
        return;
     }
     const doc = p.docs[0];
     console.log("UID:", doc.id);
     const uid = doc.id;
     console.log("USER DATA:", doc.data());
     
     const m = await db!.collection('organization_members').where('uid', '==', uid).get();
     console.log("LEGACY MEMBERSHIPS:", m.docs.map(d => ({id: d.id, data: d.data()})));
     
     const o = await db!.collection('organizations').where('ownerUid', '==', uid).get();
     const o2 = await db!.collection('organizations').where('ownerUserId', '==', uid).get();
     const o3 = await db!.collection('organizations').where('ownerId', '==', uid).get();
     const o4 = await db!.collection('organizations').doc(uid).get();
     
     console.log("OWNER ORGANIZATIONS:");
     o.docs.forEach(d => console.log(d.id, "OwnerUid:", d.data()));
     o2.docs.forEach(d => console.log(d.id, "OwnerUserId:", d.data()));
     o3.docs.forEach(d => console.log(d.id, "OwnerId:", d.data()));
     if (o4.exists) console.log(o4.id, "ID == UID:", o4.data());
     
     console.log("ALL ORGS DIRECT:");
     const allOrgs = await db!.collection('organizations').get();
     let foundInMembers = [];
     for(const org of allOrgs.docs) {
         const m2 = await db!.collection('organizations').doc(org.id).collection('members').doc(uid).get();
         if(m2.exists) foundInMembers.push({orgId: org.id, name: org.data().name, role: m2.data()?.role});
     }
     console.log("MEMBERS (NEW SUBCOLLECTION):", foundInMembers);

  } catch(e) {
     console.error(e);
  }
}
run();
