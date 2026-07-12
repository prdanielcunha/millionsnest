import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import Stripe from 'stripe';

const serviceAccountStr = readFileSync('firebase-service-account.json', 'utf8');
const serviceAccount = JSON.parse(serviceAccountStr);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

async function run() {
  const users = await db.collection('users').where('email', '==', 'pastordanielpcunha@gmail.com').get();
  if (users.empty) {
     console.log("User not found");
     return;
  }
  const userDoc = users.docs[0];
  const userData = userDoc.data();
  console.log("Found user uid:", userDoc.id);
  const orgId = userData.organizationId || userData.primaryOrganizationId || userDoc.id;
  console.log("orgId to check:", orgId);

  const orgDoc = await db.collection('organizations').doc(orgId).get();
  console.log("Org exists?", orgDoc.exists);
  const orgData = orgDoc.data() || {};
  
  const subDoc = await db.collection('subscriptions').doc(orgId).get();
  const subData = subDoc.data() || {};
  
  let customerId = subData.stripeCustomerId || orgData.stripeCustomerId || userData.stripeCustomerId;
  
  if (!customerId) {
     const customers = await stripe.customers.list({ email: 'pastordanielpcunha@gmail.com', limit: 1 });
     if (customers.data.length > 0) customerId = customers.data[0].id;
  }
  console.log("CustomerId:", customerId);
  
  if (customerId) {
     const stripeSubs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 5 });
     const activeSub = stripeSubs.data.find(s => s.status === 'active' || s.status === 'trialing');
     if (activeSub) {
        console.log("Active Sub Status:", activeSub.status);
        console.log("Active Sub metadata:", activeSub.metadata);
        
        console.log("Current subscriptions/orgId:", subData);
        console.log("Current org apps.musicscale:", orgData.apps?.musicscale);
     } else {
        console.log("No active sub found in Stripe");
     }
  }
}
run().catch(console.error);
