import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const app = admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString()))
});
const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function repair() {
  const userId = 'EPymQj34Tof3smPuNd3Z8yM4Cw13';
  // customer email used in Stripe: danielcunhapastor@gmail.com
  const customers = await stripe.customers.list({ email: 'danielcunhapastor@gmail.com', limit: 1 });
  if (customers.data.length > 0) {
    const customer = customers.data[0];
    const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1 });
    if (subs.data.length > 0) {
      const sub = subs.data[0];
      const hasAccess = ['active', 'trialing'].includes(sub.status);
      console.log('Found sub:', sub.id, sub.status);
      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(userId), {
        status: sub.status,
        plan: 'annual',
        stripeCustomerId: customer.id,
        stripeSubscriptionId: sub.id,
        appsAccess: { musicscale: hasAccess },
      }, { merge: true });
      batch.set(db.collection('users').doc(userId), {
        subscriptionStatus: sub.status,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: sub.id,
        appsAccess: { musicscale: hasAccess },
      }, { merge: true });
      await batch.commit();
      console.log('REPAIRED DANIEL ACCOUNT successfully!');
    }
  }
}
repair().catch(console.error);
