import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';
import { BillingService } from './src/server/services/BillingService';

dotenv.config();

// Configurar Firebase Admin
let db: admin.firestore.Firestore | null = null;
function getDb() {
  if (db) return db;
  try {
    console.log('[BOOTSTRAP] Checking Firebase environment variables...');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    
    console.log(`[BOOTSTRAP] FIREBASE_PROJECT_ID exists: ${!!projectId}`);
    console.log(`[BOOTSTRAP] FIREBASE_CLIENT_EMAIL exists: ${!!clientEmail}`);
    console.log(`[BOOTSTRAP] FIREBASE_PRIVATE_KEY exists: ${!!privateKey}`);
    console.log(`[BOOTSTRAP] FIREBASE_SERVICE_ACCOUNT_BASE64 exists: ${!!saBase64}`);

    if (saBase64 && !admin.apps.length) {
      const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] Initialize via base64: SUCCESS');
    } else if (projectId && clientEmail && privateKey && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        })
      });
      console.log('[Firebase Admin] Initialize via explicit cert config: SUCCESS');
    } else if (projectId && !admin.apps.length) {
      console.log('[Firebase Admin] Trying ADC with Project ID:', projectId);
      admin.initializeApp({
        projectId: projectId,
      });
      console.log('[Firebase Admin] Initialize via FIREBASE_PROJECT_ID: SUCCESS');
    } else if (!admin.apps.length) {
      console.warn('[Firebase Admin] No valid Firebase credentials found in environment.');
    }

    if (admin.apps.length > 0) {
      db = admin.firestore();
      console.log('[Firebase Admin] Firestore provider initialized successfully.');
    }
  } catch (error: any) {
    console.error('[Firebase Admin] Init CRASH:', error.message);
    if (error.stack) console.error(error.stack);
  }
  return db;
}

// Centralizer for Stripe access to avoid environment mismatch and provide better logging
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('[STRIPE_ENV] WARNING: STRIPE_SECRET_KEY is missing. Using mock key.');
      stripeInstance = new Stripe('sk_test_mock', { apiVersion: '2024-06-20' } as any);
    } else {
      const isLive = key.startsWith('sk_live');
      console.log(`[STRIPE_ENV] Initialized in ${isLive ? 'LIVE' : 'TEST'} mode.`);
      stripeInstance = new Stripe(key, { apiVersion: '2024-06-20' } as any);
    }
  }
  return stripeInstance;
}

// Billing Service Instance
let billingService: BillingService | null = null;
function getBillingService(): BillingService {
  if (!billingService) {
    const isMock = process.env.STRIPE_SECRET_KEY === undefined;
    billingService = new BillingService(getStripe(), getDb(), isMock);
  }
  return billingService;
}

async function startServer() {
  try {
    console.log('[SERVER] Bootstrapping...');
    // Initialize DB to ensure we print the logs and catch errors early
    getDb();
    
    const app = express();
    const PORT = 3000;

    app.use(cors());

  // Webhook Stripe tem que usar express.raw
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('[Webhook] Missing Stripe Webhook Secret');
      res.status(400).send('Webhook secret missing');
      return;
    }

    let event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
      console.log(`[STRIPE_WEBHOOK] Signature Verified: ${event.id} (${event.type})`);
    } catch (err: any) {
      console.error('[STRIPE_WEBHOOK] Signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Processar o evento
    if (!db) {
      console.error('[STRIPE_WEBHOOK] Firestore Admin not initialized. Cannot process webhook.');
      res.status(500).send('Database error');
      return;
    }

    // Audit Log Entry
    const auditRef = db.collection('stripe_webhook_logs').doc(event.id);
    const eventCreatedTs = event.created;

    try {
      // Save initial log
      await auditRef.set({
        eventId: event.id,
        type: event.type,
        created: admin.firestore.Timestamp.fromMillis(eventCreatedTs * 1000),
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'processing',
        payload: event.data.object
      });

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('[STRIPE_WEBHOOK] Processing checkout.session.completed', {
            id: session.id,
            mode: session.mode,
            customer: session.customer,
            subscription: session.subscription
          });
          
          const userId = session.metadata?.uid || session.client_reference_id;
          const customerId = session.customer as string;

          if (!userId) {
             console.error('[STRIPE_WEBHOOK] Missing identification mapping', { userId });
             await auditRef.update({ status: 'error', error: 'Missing userId' });
             break;
          }

          if (session.mode === 'payment') {
            const feature = session.metadata?.feature;
            if (!feature) {
              console.error('[STRIPE_WEBHOOK] Payment mode completed but missing feature metadata');
              await auditRef.update({ status: 'error', error: 'Missing feature metadata' });
              break;
            }

            console.log(`[STRIPE_WEBHOOK] Processing payment for feature: ${feature} / user: ${userId}`);
            const batch = db.batch();

            // Store purchase history
            const purchaseRef = db.collection('purchases').doc(session.id);
            batch.set(purchaseRef, {
              uid: userId,
              stripeCustomerId: customerId,
              stripeSessionId: session.id,
              feature: feature,
              amountTotal: session.amount_total,
              currency: session.currency,
              status: session.payment_status,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update user features access
            const userRef = db.collection('users').doc(userId);
            const updateData: any = {
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Music pack increments counter, others flip to true
            if (feature === 'music_pack_10') {
               updateData['musicCredits'] = admin.firestore.FieldValue.increment(10);
            } else {
               updateData[`appsAccess.${feature}`] = true;
               updateData[`permissions.${feature}`] = true;
               updateData[`addons.${feature}`] = true;
            }

            batch.set(userRef, updateData, { merge: true });

            // Apply to org as well to keep in sync if needed
            const orgRef = db.collection('organizations').doc(userId);
            batch.set(orgRef, updateData, { merge: true });

            await batch.commit();
            console.log(`[STRIPE_WEBHOOK] Successfully provisioned addon ${feature} for user: ${userId}`);
            await auditRef.update({ status: 'success', processedUserId: userId, feature: feature });
            break;
          }

          // Handle 'subscription' mode
          const plan = session.metadata?.plan || 'monthly';
          const subscriptionId = session.subscription as string;

          if (!subscriptionId) {
             console.error('[STRIPE_WEBHOOK] Missing subscriptionId in subscription mode', { userId, subscriptionId });
             await auditRef.update({ status: 'error', error: 'Missing subscriptionId' });
             break;
          }

          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['discount', 'discount.promotion_code', 'discount.coupon']
          });
          const orgId = userId; 

          if (subscription.discounts && subscription.discounts.length > 0) {
             const discount = subscription.discounts[0] as any;
             console.log('[STRIPE_WEBHOOK] 🏷️ Coupon applied in Checkout!', {
               coupon: discount.coupon?.id,
               promotion_code: discount.promotion_code?.code || 'N/A',
               discount_amount_off: discount.coupon?.amount_off,
               discount_percent_off: discount.coupon?.percent_off
             });
             await auditRef.update({ 
               discountApplied: true,
               couponId: discount.coupon?.id,
               promotionCode: discount.promotion_code?.code || null
             });
          }

          const batch = db.batch();
          const currentPeriodEnd = admin.firestore.Timestamp.fromMillis((subscription as any).current_period_end * 1000);
          const trialEnd = (subscription as any).trial_end ? admin.firestore.Timestamp.fromMillis((subscription as any).trial_end * 1000) : null;
          const hasAccess = ['active', 'trialing'].includes(subscription.status);

          // 1. Organization
          batch.set(db.collection('organizations').doc(orgId), {
            name: `Organização de ${session.customer_email || userId}`,
            ownerUid: userId,
            plan: plan,
            subscriptionStatus: subscription.status,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            lastStripeEventTs: eventCreatedTs,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // 2. Membership
          batch.set(db.collection('organization_members').doc(`${userId}_${orgId}`), {
             uid: userId,
             organizationId: orgId,
             role: 'owner'
          }, { merge: true });

          // 3. Subscription
          batch.set(db.collection('subscriptions').doc(userId), {
            product: 'musicscale',
            status: subscription.status,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan: plan,
            currentPeriodEnd: currentPeriodEnd,
            trialEndsAt: trialEnd,
            lastStripeEventTs: eventCreatedTs,
            appsAccess: { musicscale: hasAccess },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // 4. User
          batch.set(db.collection('users').doc(userId), {
            organizationId: orgId,
            products: admin.firestore.FieldValue.arrayUnion('musicscale'),
            subscriptionStatus: subscription.status,
            trialEndsAt: trialEnd,
            currentPeriodEnd: currentPeriodEnd,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan: plan,
            lastStripeEventTs: eventCreatedTs,
            appsAccess: { musicscale: hasAccess },
            subscription: {
              status: subscription.status,
              plan: plan,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              trialEndsAt: trialEnd,
              currentPeriodEnd: currentPeriodEnd,
              lastStripeEventTs: eventCreatedTs,
            },
            permissions: {
              musicscale: hasAccess
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          await batch.commit();
          console.log(`[STRIPE_WEBHOOK] Successfully provisioned architecture for user: ${userId}`);
          await auditRef.update({ status: 'success', processedUserId: userId });
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
        case 'invoice.paid':
        case 'invoice.payment_failed': {
          console.log(`[STRIPE_WEBHOOK] Syncing Event: ${event.type}`);
          
          let subscriptionId: string;
          let status: string;
          let customerId: string;
          let currentPeriodEndTs: number;
          let trialEndTs: number | null;

          let discountApplied = false;
          let couponId = null;
          let promotionCode = null;

          if (event.type.startsWith('invoice.')) {
            const invoice = event.data.object as any;
            if (!invoice.subscription) break;
            subscriptionId = invoice.subscription as string;
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['discount', 'discount.promotion_code', 'discount.coupon']
            });
            status = sub.status;
            customerId = sub.customer as string;
            currentPeriodEndTs = (sub as any).current_period_end;
            trialEndTs = sub.trial_end;

            if ((sub as any).discounts && (sub as any).discounts.length > 0) {
               const discount = (sub as any).discounts[0] as any;
               discountApplied = true;
               couponId = discount.coupon?.id;
               promotionCode = discount.promotion_code?.code || null;
            }
          } else {
            const sub = event.data.object as Stripe.Subscription;
            subscriptionId = sub.id;
            status = sub.status;
            customerId = sub.customer as string;
            currentPeriodEndTs = (sub as any).current_period_end;
            trialEndTs = sub.trial_end;

            if ((sub as any).discounts && (sub as any).discounts.length > 0) {
               const discount = (sub as any).discounts[0] as any;
               discountApplied = true;
               couponId = discount.coupon?.id;
               // Object is not expanded here, but we can log the coupon
               console.log('[STRIPE_WEBHOOK] 🏷️ Discount detected in event:', discount.coupon?.id);
            }
          }

          if (discountApplied) {
            console.log(`[STRIPE_WEBHOOK] 🏷️ Coupon applied/updated! Coupon: ${couponId}, PromoCode: ${promotionCode || 'N/A'}`);
            await auditRef.update({ 
               discountApplied: true,
               couponId: couponId,
               promotionCode: promotionCode
            });
          }
          
          let subsQuery = await db.collection('subscriptions').where('stripeSubscriptionId', '==', subscriptionId).get();
          if (subsQuery.empty && customerId) {
             subsQuery = await db.collection('subscriptions').where('stripeCustomerId', '==', customerId).get();
          }

          if (!subsQuery.empty) {
             const batch = db.batch();
             let processedCount = 0;

             subsQuery.forEach(doc => {
                 const docData = doc.data();
                 const userId = doc.id;

                 // IDEMPOTENCY CHECK: Only update if the event is newer than the last recorded event
                 if (docData.lastStripeEventTs && docData.lastStripeEventTs > eventCreatedTs) {
                   console.log(`[STRIPE_WEBHOOK] Skipping Outdated Event for user ${userId}: Incoming TS ${eventCreatedTs} is older than current TS ${docData.lastStripeEventTs}`);
                   return;
                 }

                 const currentPeriodEnd = admin.firestore.Timestamp.fromMillis(currentPeriodEndTs * 1000);
                 const trialEnd = trialEndTs ? admin.firestore.Timestamp.fromMillis(trialEndTs * 1000) : null;
                 const hasAccess = ['active', 'trialing'].includes(status);

                 batch.set(doc.ref, {
                    status: status,
                    currentPeriodEnd: currentPeriodEnd,
                    trialEndsAt: trialEnd,
                    lastStripeEventTs: eventCreatedTs,
                    appsAccess: { musicscale: hasAccess },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 }, { merge: true });
                 
                 batch.set(db.collection('organizations').doc(userId), {
                    subscriptionStatus: status,
                    lastStripeEventTs: eventCreatedTs,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                 }, { merge: true });

                 batch.set(db.collection('users').doc(userId), {
                    subscriptionStatus: status,
                    trialEndsAt: trialEnd,
                    currentPeriodEnd: currentPeriodEnd,
                    lastStripeEventTs: eventCreatedTs,
                    appsAccess: { musicscale: hasAccess },
                    subscription: {
                      status: status,
                      trialEndsAt: trialEnd,
                      currentPeriodEnd: currentPeriodEnd,
                      lastStripeEventTs: eventCreatedTs,
                    },
                    permissions: {
                      musicscale: hasAccess
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                 }, { merge: true });
                 
                 processedCount++;
             });
             
             if (processedCount > 0) {
               await batch.commit();
               console.log(`[STRIPE_WEBHOOK] Batch sync successful for ${processedCount} users.`);
               await auditRef.update({ status: 'success', targetsFound: processedCount });
             } else {
               await auditRef.update({ status: 'skipped', reason: 'Outdated event' });
             }
          } else {
             console.log(`[STRIPE_WEBHOOK] NO target documents found for sub: ${subscriptionId}`);
             await auditRef.update({ status: 'error', error: 'Subscription document not found in Firestore' });
          }
          break;
        }
        default:
          console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
          await auditRef.update({ status: 'unhandled' });
      }

      res.status(200).json({ received: true });
    } catch (e: any) {
      console.error('[STRIPE_WEBHOOK] Fatal Processing Error:', e);
      await auditRef.set({ status: 'failed', error: e.message, stack: e.stack }, { merge: true });
      res.status(500).send('Error processing webhook');
    }
  });

  // Outras rotas da API usam JSON
  app.use(express.json());

  // Novo endpoint de acesso robusto com suporte a Multi-Org
  app.get('/api/access', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Database not initialized' });

      const uid = req.query.uid as string;
      if (!uid) return res.status(400).json({ error: 'uid parameter is required' });

      console.log(`[API Access] Checking access for UID: ${uid}`);

      // 1. Direct subscription check (Personal/Legacy)
      const subDoc = await db.collection('subscriptions').doc(uid).get();
      let hasAccess = false;
      let status = "none";
      let plan = "none";
      let trialEndsAt = null;
      let currentPeriodEnd = null;

      if (subDoc.exists) {
        const data = subDoc.data()!;
        status = data.status;
        plan = data.plan;
        hasAccess = ['active', 'trialing'].includes(status);
        trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt.seconds * 1000).toISOString() : null;
        currentPeriodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd.seconds * 1000).toISOString() : null;
      }

      // 2. Multi-Org check if not already granted
      if (!hasAccess) {
        const memberships = await db.collection('organization_members').where('uid', '==', uid).get();
        if (!memberships.empty) {
          for (const memberDoc of memberships.docs) {
            const orgId = memberDoc.data().organizationId;
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists && ['active', 'trialing'].includes(orgDoc.data()?.subscriptionStatus)) {
              hasAccess = true;
              status = orgDoc.data()?.subscriptionStatus;
              console.log(`[API Access] Access granted via Org: ${orgId}`);
              break;
            }
          }
        }
      }

      // Fetch user specific data for addons
      const userDoc = await db.collection('users').doc(uid).get();
      let appsAccess: any = {};
      let musicCredits = 0;
      
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        appsAccess = userData.appsAccess || {};
        musicCredits = userData.musicCredits || 0;
      }

      return res.json({
        apps: {
          musicscale: {
            access: hasAccess,
            status: status,
            plan: plan,
            trialEndsAt: trialEndsAt,
            currentPeriodEnd: currentPeriodEnd,
          }
        },
        addons: {
          setup_premium: appsAccess.setup_premium || false,
          training_express: appsAccess.training_express || false,
          worship_100: appsAccess.worship_100 || false
        },
        credits: {
          music: musicCredits
        }
      });
    } catch (err: any) {
      console.error('[API Access]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Forçar sincronização com Stripe
  app.post('/api/v1/billing/sync', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId || !db) return res.status(400).json({ error: 'Missing uid or db' });

      console.log(`[Sync] Request for user: ${userId}`);
      const stripe = getStripe();
      const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live');

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
      
      const userData = userDoc.data()!;
      const userEmail = userData.email;
      let customerId = userData.stripeCustomerId;

      const subDocBase = await db.collection('subscriptions').doc(userId).get();
      if (!customerId && subDocBase.exists) {
        customerId = subDocBase.data()?.stripeCustomerId;
      }

      let subscriptions: Stripe.ApiList<Stripe.Subscription> | null = null;

      try {
        if (customerId) {
          // Detect mismatch before calling Stripe if possible
          if (isLiveKey && customerId.includes('test')) {
             console.warn(`[Sync] Local ID ${customerId} is from TEST mode, but currently using LIVE key. Triggering self-healing...`);
             customerId = null; 
          } else {
            // Attempt to list by ID
            subscriptions = await stripe.subscriptions.list({
              customer: customerId,
              limit: 1,
              status: 'all'
            });
          }
        }
      } catch (stripeErr: any) {
        // Handle Environment Mismatch at runtime
        if (stripeErr.type === 'StripeInvalidRequestError' && (stripeErr.message.includes('No such customer') || stripeErr.message.includes('test mode') || stripeErr.message.includes('live mode'))) {
          console.warn(`[Sync] Environment mismatch error for ${userId} (ID: ${customerId}). Attempting healing via email: ${userEmail}`);
          customerId = null; 
        } else {
          throw stripeErr;
        }
      }

      // Self-Healing Logic: Use Email to find the correct customer ID in the CURRENT environment
      if (!customerId || (subscriptions && subscriptions.data.length === 0)) {
        if (userEmail) {
          console.log(`[Sync] Searching for customer by email ${userEmail} in the current environment...`);
          const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
          if (customers.data.length > 0) {
            const newCustomer = customers.data[0];
            customerId = newCustomer.id;
            console.log(`[Sync] Healing successful! Found valid customer ID: ${customerId}`);
            subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
          } else {
            console.log(`[Sync] No customer found in current environment for email ${userEmail}.`);
          }
        }
      }

      if (!subscriptions || subscriptions.data.length === 0) {
        console.warn(`[Sync] No subscription found in current environment for user ${userId}. Resetting local status to avoid stale trial state.`);
        
        const batch = db.batch();
        batch.set(db.collection('subscriptions').doc(userId), {
          status: 'none',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          appsAccess: { musicscale: false },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(db.collection('organizations').doc(userId), {
          subscriptionStatus: 'none',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(db.collection('users').doc(userId), {
          subscriptionStatus: 'none',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          appsAccess: { musicscale: false },
          subscription: {
             status: 'none',
             stripeCustomerId: null,
             stripeSubscriptionId: null,
             trialEndsAt: null,
             currentPeriodEnd: null,
          },
          permissions: { musicscale: false },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        const envName = isLiveKey ? 'LIVE (Produção)' : 'TEST (Testes)';
        return res.status(200).json({ 
          status: 'reset',
          message: 'Local state reset because no subscription was found in Stripe.',
          details: `Você está no modo ${envName}. Como não encontramos assinatura neste modo, resetamos seu status para você poder assinar novamente.`,
          currentMode: isLiveKey ? 'live' : 'test'
        });
      }

      const sub = subscriptions.data[0];
      const hasAccess = ['active', 'trialing'].includes(sub.status);
      const currentPeriodEnd = admin.firestore.Timestamp.fromMillis((sub as any).current_period_end * 1000);
      const trialEnd = sub.trial_end ? admin.firestore.Timestamp.fromMillis(sub.trial_end * 1000) : null;

      console.log(`[Sync] Update successful. User: ${userId}, New Status: ${sub.status}`);

      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(userId), {
        status: sub.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: currentPeriodEnd,
        trialEndsAt: trialEnd,
        appsAccess: { musicscale: hasAccess },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organizations').doc(userId), {
        subscriptionStatus: sub.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('users').doc(userId), {
        subscriptionStatus: sub.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        trialEndsAt: trialEnd,
        currentPeriodEnd: currentPeriodEnd,
        appsAccess: { musicscale: hasAccess },
        subscription: {
          status: sub.status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          trialEndsAt: trialEnd,
          currentPeriodEnd: currentPeriodEnd,
        },
        permissions: { musicscale: hasAccess },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      if (hasAccess) {
        await db.collection('users').doc(userId).update({
          organizationId: userId,
          activeOrganizationId: userId
        });
      }

      return res.json({ status: 'synced', stripeStatus: sub.status, hasAccess, customerId, environment: isLiveKey ? 'live' : 'test' });

    } catch (err: any) {
      console.error('[Sync Error]', err);
      res.status(500).json({ 
        error: 'Erro na sincronização com Stripe.',
        details: err.message 
      });
    }
  });

  // Admin Repair Tool
  app.get('/api/admin/repair/:email', async (req, res) => {
    try {
      const { email } = req.params;
      if (!db || !email) return res.status(400).send('Missing params');

      console.log(`[REPAIR] Locating user for email: ${email}`);
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) return res.status(404).send('Customer not found in Stripe');

      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' });
      
      const usersQuery = await db.collection('users').where('email', '==', email).limit(1).get();
      let userId = usersQuery.empty ? null : usersQuery.docs[0].id;

      if (!userId && subs.data.length > 0 && subs.data[0].metadata?.uid) {
         userId = subs.data[0].metadata.uid;
      }

      if (!userId) return res.status(404).send('User ID not found in Firestore or Stripe metadata. Please log in once.');

      let stripeStatus = 'no_subscription';
      if (subs.data.length > 0) {
        const s = subs.data[0];
        stripeStatus = s.status;
        const hasAccess = ['active', 'trialing'].includes(s.status);
        const cpEnd = admin.firestore.Timestamp.fromMillis((s as any).current_period_end * 1000);
        const tEnd = s.trial_end ? admin.firestore.Timestamp.fromMillis(s.trial_end * 1000) : null;

        const batch = db.batch();
        const subRef = db.collection('subscriptions').doc(userId);
        batch.set(subRef, {
            status: s.status,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: s.id,
            currentPeriodEnd: cpEnd,
            trialEndsAt: tEnd,
            plan: s.metadata?.plan || 'monthly',
            appsAccess: { musicscale: hasAccess },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update organization
        batch.set(db.collection('organizations').doc(userId), {
            subscriptionStatus: s.status,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: s.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update user
        batch.update(db.collection('users').doc(userId), {
            subscriptionStatus: s.status,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: s.id,
            trialEndsAt: tEnd,
            currentPeriodEnd: cpEnd,
            appsAccess: { musicscale: hasAccess },
            subscription: {
              status: s.status,
              stripeCustomerId: customer.id,
              stripeSubscriptionId: s.id,
              trialEndsAt: tEnd,
              currentPeriodEnd: cpEnd,
            },
            permissions: { musicscale: hasAccess },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[REPAIR] User ${userId} successfully synchronized with Stripe status: ${s.status}`);
      }

      return res.json({
        success: true,
        email,
        userId,
        customerId: customer.id,
        stripeStatus,
        repaired: true
      });

    } catch (err: any) {
      console.error('[Repair Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Debug Endpoint
  app.get('/api/debug/subscription-status', async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!db || !email) return res.status(400).json({ error: 'Missing email' });

      console.log(`[DEBUG] Investigating status for ${email}`);
      
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) return res.json({ error: 'Customer not found in Stripe' });

      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 10, status: 'all' });
      
      const userSnap = await db.collection('users').where('email', '==', email).get();
      const userData = userSnap.empty ? null : { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      
      let subData = null;
      let orgData = null;
      if (userData) {
        const sDoc = await db.collection('subscriptions').doc(userData.id).get();
        subData = sDoc.exists ? sDoc.data() : null;
        
        const oDoc = await db.collection('organizations').doc(userData.id).get();
        orgData = oDoc.exists ? oDoc.data() : null;
      }

      return res.json({
        stripe: {
          customerId: customer.id,
          subscriptions: subs.data.map(s => ({
            id: s.id,
            status: s.status,
            current_period_end: new Date((s as any).current_period_end * 1000).toISOString(),
            trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
            metadata: s.metadata
          }))
        },
        firestore: {
          user: userData,
          subscription: subData,
          organization: orgData
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/internal/sync-stripe-products', async (req, res) => {
    try {
      const service = getBillingService();
      const result = await service.syncStripeToFirestore();
      res.json(result);
    } catch (e: any) {
      console.error('[Billing Sync] Fatal error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v1/billing/products', async (req, res, next) => {
    try {
      console.log(`[Billing API] Hit endpoint: ${req.url}`);
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('Content-Type', 'application/json');
      
      console.log(`[Billing API] Getting BillingService...`);
      const service = getBillingService();
      
      console.log(`[Billing API] Calling getProducts()...`);
      const result = await service.getProducts();
      
      console.log(`[Billing API] Serialization and sending response...`);
      const serialized = JSON.stringify(result);
      return res.status(200).send(serialized);
    } catch (e: any) {
      console.error('[Billing API] CRASH:', e.message);
      console.error(e.stack);
      try {
        const errPayload = JSON.stringify({
          success: false,
          error: e.message || 'Unknown error',
          details: e.stack ? String(e.stack) : ''
        });
        return res.status(500).type('application/json').send(errPayload);
      } catch (innerErr) {
        return res.status(500).type('application/json').send('{"success":false,"error":"Fatal JSON JSON Error"}');
      }
    }
  });

  app.get('/api/v1/billing/debug', async (req, res) => {
    try {
      const service = getBillingService();
      
      // Try a direct firestore read to validate connection
      let firestoreStatus = 'unknown';
      let docCount = 0;
      if (db) {
        try {
          const testSnap = await db.collection('billing_products').limit(1).get();
          firestoreStatus = 'connected - query successful';
          const fullSnap = await db.collection('billing_products').get();
          docCount = fullSnap.size;
        } catch(fsError: any) {
          firestoreStatus = `error: ${fsError.message}`;
        }
      } else {
        firestoreStatus = 'No db instance initialized';
      }

      const result = await service.getDebugInfo();
      res.json({
         ...result,
         firestore_diagnostic: {
           status: firestoreStatus,
           docCount,
           projectId: process.env.FIREBASE_PROJECT_ID || 'not_set',
           hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
         }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v1/billing/checkout', async (req, res) => {
    try {
      const { userId, email, lookupKey } = req.body;

      if (!userId || !email || !lookupKey) {
        res.status(400).json({ error: 'Missing userId, email, or lookupKey' });
        return;
      }

      console.log(`[Checkout] Creating checkout session for user ${userId} with lookupKey ${lookupKey}`);

      const service = getBillingService();
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;

      if (isMock) {
         console.error('[Checkout] STRIPE_SECRET_KEY env variable is missing');
         res.status(400).json({ error: 'A Chave do Stripe não está configurada no Vercel (Modo Mock).' });
         return;
      }

      const priceId = await service.getPriceByLookupKey(lookupKey);
      
      if (!priceId) {
         console.error(`[Checkout] Preço com lookup_key ${lookupKey} não encontrado no Stripe.`);
         res.status(400).json({ error: `Plano não encontrado no sistema.` });
         return;
      }

      const stripe = getStripe();

      // Buscamos qual app ou plano é pelo cache pra mandar no metadata
      const products = await service.getProducts();
      const planItem = products.plans.find(p => p.lookupKey === lookupKey);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 7, // 7 days trial mandatory by requirements
        },
        client_reference_id: userId,
        customer_email: email,
        metadata: {
          uid: userId,
          plan: planItem ? planItem.tier || planItem.feature : 'unknown',
          product: planItem ? planItem.app : 'musicscale'
        },
        success_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      });

      console.log(`[Checkout] Session created successfully for user ${userId}`);
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[Checkout] Error creating checkout session:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v1/billing/addons', async (req, res) => {
    try {
      const { userId, email, lookupKey } = req.body;

      if (!userId || !email || !lookupKey) {
        res.status(400).json({ error: 'Missing userId, email or lookupKey' });
        return;
      }

      console.log(`[Checkout Addon] Creating checkout session for user ${userId} with lookupKey ${lookupKey}`);

      const service = getBillingService();
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;

      if (isMock) {
         console.error('[Checkout Addon] STRIPE_SECRET_KEY env variable is missing');
         res.status(400).json({ error: 'A Chave do Stripe não está configurada (Modo Mock).' });
         return;
      }

      const priceId = await service.getPriceByLookupKey(lookupKey);
      
      if (!priceId) {
         console.error(`[Checkout Addon] Preço com lookup_key ${lookupKey} não encontrado no Stripe.`);
         res.status(400).json({ error: `Addon não encontrado no sistema.` });
         return;
      }

      // Check if user has a customer ID in firestore to link it to the same customer
      let customerId: string | undefined;
      if (db) {
         const subDoc = await db.collection('subscriptions').doc(userId).get();
         if (subDoc.exists) {
            customerId = subDoc.data()?.stripeCustomerId;
         }
      }

      const stripe = getStripe();
      
      const products = await service.getProducts();
      const addonItem = products.addons.find(p => p.lookupKey === lookupKey);
      const feature = addonItem ? addonItem.feature : 'unknown';

      const sessionArgs: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        allow_promotion_codes: true,
        client_reference_id: userId,
        metadata: {
          uid: userId,
          feature: feature,
          type: addonItem ? addonItem.type : 'addon',
          app: addonItem ? addonItem.app : 'musicscale'
        },
        success_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard?addon_success=${feature}`,
        cancel_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      };

      if (customerId) {
        sessionArgs.customer = customerId;
      } else {
        sessionArgs.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionArgs);

      console.log(`[Checkout Addon] Session created successfully for user ${userId}`);
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[Checkout Addon] Error creating checkout session:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v1/billing/portal', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      if (!db) {
         return res.status(500).json({ error: 'Database error' });
      }

      const subDoc = await db.collection('subscriptions').doc(userId).get();
      if (!subDoc.exists) {
         return res.status(404).json({ error: "Sua assinatura ainda não foi processada." });
      }

      const customerId = subDoc.data()?.stripeCustomerId;
      if (!customerId) {
         return res.status(404).json({ error: "ID de cliente Stripe não encontrado." });
      }

      const stripe = getStripe();
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;

      if (isMock) {
         console.error('[Portal] STRIPE_SECRET_KEY env variable is missing');
         return res.status(400).json({ error: 'A variável STRIPE_SECRET_KEY não está configurada no Vercel.' });
      }

      console.log(`[Portal] Creating billing portal for user ${userId}`);
      
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[Portal] Error creating portal session:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development (Só roda localmente)
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const vitePath = 'vite'; // Trick Vercel's NFT static analyzer
        const viteModule = await import(vitePath);
        const vite = await viteModule.createServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (err: any) {
        console.warn('[Server] Vite middleware bypassed:', err.message);
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  // Global error handler to prevent HTML responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  return app;
  } catch (err: any) {
    console.error('[SERVER BOOTSTRAP FATAL ERROR]', err.message);
    console.error(err.stack);
    
    // Return a dummy express app that always returns 500 JSON to prevent serverless crashes and HTML responses
    const fallbackApp = express();
    fallbackApp.all('*', (req, res) => {
      res.status(500).json({ success: false, error: 'Server unavailable due to initialization crash', details: err.message });
    });
    return fallbackApp;
  }
}

const appPromise = startServer();

export default async function (req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
