import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';
import { BillingService } from './src/server/services/BillingService.js';

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

import compression from 'compression';

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

    app.use(compression({
      level: 6, // optimal default
      threshold: 10 * 1024, // only compress files over 10kb
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
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
          
          let userId = session.metadata?.uid || session.client_reference_id;
          const customerId = session.customer as string;

          if (!userId) {
             const customerEmail = session.customer_details?.email || session.customer_email;
             if (customerEmail) {
                console.log(`[STRIPE_WEBHOOK] Missing identification mapping, attempting to heal via email: ${customerEmail}`);
                const usersSnap = await db.collection('users').where('email', '==', customerEmail).get();
                if (!usersSnap.empty) {
                   userId = usersSnap.docs[0].id;
                   console.log(`[STRIPE_WEBHOOK] Successfully resolved userId via email fallback: ${userId}`);
                }
             }
          }

          if (!userId) {
             console.error('[STRIPE_WEBHOOK] Missing identification mapping and could not resolve via email', { email: session.customer_details?.email || session.customer_email });
             await auditRef.update({ status: 'error', error: 'Missing userId and email resolution failed' });
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
          const userDocSnap = await db.collection('users').doc(userId).get();
          const orgId = (userDocSnap.exists && userDocSnap.data()?.organizationId) ? userDocSnap.data()?.organizationId : userId;
          
          console.log('[STRIPE_WEBHOOK_DEBUG]', {
            metadata_recebida: session.metadata,
            organizationId_detectado: orgId,
            userId_detectado: userId,
            timestamp_da_sincronizacao: new Date().toISOString()
          });

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
            ownerId: userId,
            plan: plan,
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
          const subPayload = {
            schemaVersion: 1,
            organizationId: orgId,
            status: subscription.status,
            plan: plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd: currentPeriodEnd,
            trialEndsAt: trialEnd,
            lastStripeEventTs: eventCreatedTs,
            features: {
              globalLibrary: hasAccess,
              musicScale: hasAccess
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          console.log('[STRIPE_WEBHOOK_DEBUG_PAYLOAD]', {
            path_exato_salvo: `subscriptions/${orgId}`,
            payload_salvo: subPayload
          });

          batch.set(db.collection('subscriptions').doc(orgId), subPayload, { merge: true });

          // 4. User
          batch.set(db.collection('users').doc(userId), {
            organizationId: orgId,
            organizationRole: 'owner',
            lastStripeEventTs: eventCreatedTs,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          await batch.commit();
          
          console.log('[OWNERSHIP_SYNC]', {
            uid: userId,
            organizationId: orgId,
            role_anterior: 'unknown',
            role_nova: 'owner',
            motivo: 'checkout.session.completed'
          });

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

             for (const doc of subsQuery.docs) {
                 const docData = doc.data();
                 const userId = doc.id;

                 // IDEMPOTENCY CHECK: Only update if the event is newer than the last recorded event
                 if (docData.lastStripeEventTs && docData.lastStripeEventTs > eventCreatedTs) {
                   console.log(`[STRIPE_WEBHOOK] Skipping Outdated Event for user ${userId}: Incoming TS ${eventCreatedTs} is older than current TS ${docData.lastStripeEventTs}`);
                   continue;
                 }

                 const currentPeriodEnd = admin.firestore.Timestamp.fromMillis(currentPeriodEndTs * 1000);
                 const trialEnd = trialEndTs ? admin.firestore.Timestamp.fromMillis(trialEndTs * 1000) : null;
                 const hasAccess = ['active', 'trialing'].includes(status);

                 const userDocSnap = await db.collection('users').doc(userId).get();
                 const orgId = (userDocSnap.exists && userDocSnap.data()?.organizationId) ? userDocSnap.data()?.organizationId : userId;

                 batch.set(doc.ref, {
                    status: status,
                    currentPeriodEnd: currentPeriodEnd,
                    trialEndsAt: trialEnd,
                    lastStripeEventTs: eventCreatedTs,
                    features: {
                      globalLibrary: hasAccess,
                      musicScale: hasAccess
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 }, { merge: true });
                 
                 console.log('[STRIPE_WEBHOOK_DEBUG_PAYLOAD]', {
                   path: `subscriptions/${doc.id}`,
                   hasAccess
                 });
                 
                 batch.set(db.collection('organizations').doc(orgId), {
                    lastStripeEventTs: eventCreatedTs,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                 }, { merge: true });

                 batch.set(db.collection('users').doc(userId), {
                    lastStripeEventTs: eventCreatedTs,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                 }, { merge: true });
                 
                 processedCount++;
             }
             
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

      // Fetch user specific data first
      let orgId = uid;
      const userDoc = await db.collection('users').doc(uid).get();
      let appsAccess: any = {};
      let musicCredits = 0;
      
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        orgId = userData.organizationId || uid;
        appsAccess = userData.appsAccess || {};
        musicCredits = userData.musicCredits || 0;
      }

      // 1. Direct subscription check on OrgId
      const subDoc = await db.collection('subscriptions').doc(orgId).get();
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
            const mOrgId = memberDoc.data().organizationId;
            const orgDoc = await db.collection('organizations').doc(mOrgId).get();
            if (orgDoc.exists && ['active', 'trialing'].includes(orgDoc.data()?.subscriptionStatus)) {
              hasAccess = true;
              status = orgDoc.data()?.subscriptionStatus || 'active';
              plan = orgDoc.data()?.plan || 'monthly';
              if (orgDoc.data()?.trialEndsAt) {
                 trialEndsAt = new Date(orgDoc.data()?.trialEndsAt.seconds * 1000).toISOString();
              }
              if (orgDoc.data()?.currentPeriodEnd) {
                 currentPeriodEnd = new Date(orgDoc.data()?.currentPeriodEnd.seconds * 1000).toISOString();
              }
              console.log(`[API Access] Access granted via Org: ${mOrgId}`);
              break;
            }
          }
        }
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
      const { userId, sessionId } = req.body;
      if (!userId || !db) return res.status(400).json({ error: 'Missing uid or db' });

      console.log(`[Sync] Request for user: ${userId}`);
      const stripe = getStripe();
      const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live');

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
      
      const userData = userDoc.data()!;
      const userEmail = userData.email;
      let customerId = userData.stripeCustomerId;

      const orgIdBase = userData.organizationId || userId;
      const subDocBase = await db.collection('subscriptions').doc(orgIdBase).get();
      if (!customerId && subDocBase.exists) {
        customerId = subDocBase.data()?.stripeCustomerId;
      }

      let subscriptions: Stripe.ApiList<Stripe.Subscription> | null = null;
      
      try {
        if (sessionId) {
            console.log(`[Sync] Explicit sessionId provided: ${sessionId}. Retrieving session directly...`);
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.customer) {
                customerId = session.customer as string;
            }
            if (session.subscription) {
                const sessionSub = await stripe.subscriptions.retrieve(session.subscription as string);
                subscriptions = { data: [sessionSub], has_more: false, object: 'list', url: '' };
                console.log(`[Sync] Retrieved subscription ${sessionSub.id} directly from session.`);
            }
        }
      } catch (e) {
          console.error(`[Sync] Failed to retrieve session ${sessionId}:`, e);
      }

      try {
        if (customerId && !subscriptions) {
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
          const customers = await stripe.customers.list({ email: userEmail, limit: 100 });
          if (customers.data.length > 0) {
            let foundValidCustomer = false;
            for (const cust of customers.data) {
                const tempSubs = await stripe.subscriptions.list({ customer: cust.id, limit: 1, status: 'all' });
                if (tempSubs.data.length > 0) {
                    customerId = cust.id;
                    subscriptions = tempSubs;
                    foundValidCustomer = true;
                    console.log(`[Sync] Healing successful! Found valid customer ID with subscription: ${customerId}`);
                    break;
                }
            }
            if (!foundValidCustomer) {
                 // Fallback to the latest customer if none had subscriptions
                 customerId = customers.data[0].id;
                 console.log(`[Sync] No subscription found among customers. Kept latest customer ID: ${customerId}`);
            }
          } else {
            console.log(`[Sync] No customer found in current environment for email ${userEmail}.`);
          }
        }
      }

      if (!subscriptions || subscriptions.data.length === 0) {
        console.warn(`[Sync] No subscription found in current environment for user ${userId}. Resetting local status to avoid stale trial state.`);
        
        const userDocRef = await db.collection('users').doc(userId).get();
        const orgId = (userDocRef.exists && userDocRef.data()?.organizationId) ? userDocRef.data()?.organizationId : userId;

        const batch = db.batch();
        batch.set(db.collection('subscriptions').doc(orgId), {
          status: 'none',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          features: {
            globalLibrary: false,
            musicScale: false
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(db.collection('organizations').doc(orgId), {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(db.collection('users').doc(userId), {
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
      
      let discoveredPlan = 'monthly';
      let discoveredTier = 'pro';
      const firstItem = sub.items?.data?.[0];
      if (firstItem && firstItem.price?.lookup_key) {
         if (firstItem.price.lookup_key.includes('year') || firstItem.price.lookup_key.includes('annual')) {
             discoveredPlan = 'annual';
         }
         if (firstItem.price.lookup_key.includes('starter')) {
             discoveredTier = 'starter';
         }
      }

      console.log(`[Sync] Update successful. User: ${userId}, New Status: ${sub.status}, Plan: ${discoveredPlan}, Tier: ${discoveredTier}`);

      const userDocRef2 = await db.collection('users').doc(userId).get();
      const orgId2 = (userDocRef2.exists && userDocRef2.data()?.organizationId) ? userDocRef2.data()?.organizationId : userId;

      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(orgId2), {
        schemaVersion: 1,
        organizationId: orgId2,
        status: sub.status,
        plan: discoveredPlan,
        tier: discoveredTier,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: currentPeriodEnd,
        trialEndsAt: trialEnd,
        features: {
          globalLibrary: hasAccess,
          musicScale: hasAccess
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organizations').doc(orgId2), {
        ownerUid: userId,
        ownerId: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('users').doc(userId), {
        organizationRole: 'owner',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organization_members').doc(`${userId}_${orgId2}`), {
        uid: userId,
        organizationId: orgId2,
        role: 'owner'
      }, { merge: true });

      await batch.commit();

      console.log('[OWNERSHIP_SYNC]', {
        uid: userId,
        organizationId: orgId2,
        role_anterior: 'unknown',
        role_nova: 'owner',
        motivo: 'billing/sync'
      });

      if (hasAccess) {
        await db.collection('users').doc(userId).update({
          organizationId: orgId2,
          activeOrganizationId: orgId2
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

  app.get('/api/admin/repair/pastordaniel', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'DB not ready' });
      const stripe = getStripe();
      // Encontra a assinatura no Stripe do e-mail usado
      const customers = await stripe.customers.list({ email: 'danielcunhapastor@gmail.com', limit: 1 });
      if (customers.data.length === 0) return res.status(404).send('Not found in stripe');
      
      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
      if (subs.data.length === 0) return res.status(404).send('No sub found');
      
      const sub = subs.data[0];
      const hasAccess = ['active', 'trialing'].includes(sub.status);
      const cpEnd = admin.firestore.Timestamp.fromMillis((sub as any).current_period_end * 1000);
      const tEnd = sub.trial_end ? admin.firestore.Timestamp.fromMillis(sub.trial_end * 1000) : null;
      
      const userId = '7PUd8TAyXkT2CUkrcUtIGn5btch1';
      
      const userDocRef3 = await db.collection('users').doc(userId).get();
      const orgId3 = (userDocRef3.exists && userDocRef3.data()?.organizationId) ? userDocRef3.data()?.organizationId : userId;
      
      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(orgId3), {
        schemaVersion: 1,
        organizationId: orgId3,
        status: sub.status,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: cpEnd,
        trialEndsAt: tEnd,
        plan: 'annual',
        features: {
          globalLibrary: hasAccess,
          musicScale: hasAccess
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      batch.set(db.collection('users').doc(userId), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organizations').doc(userId), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organization_members').doc(`${userId}_${userId}`), {
        uid: userId,
        organizationId: userId,
        role: 'owner'
      }, { merge: true });

      await batch.commit();

      res.status(200).json({ success: true, repairedStatus: sub.status });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Repair Tool
  app.post('/api/repair/sync', express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação ausente ou inválido.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token', message: 'Falha na validação do seu token de acesso.' });
      }

      const uid = decodedToken.uid;
      const email = decodedToken.email;
      
      if (!db || !email) return res.status(400).json({ error: 'Missing params', message: 'Ocorreu um problema ao identificar os dados necessários para o sistema (email/uid).' });

      console.log(`[MUSICSCALE_REPAIR_REQUEST] request started for UID: ${uid}, Timestamp: ${new Date().toISOString()}`);

      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found', message: 'Usuário não localizado no banco de dados.' });
      
      const userData = userDoc.data()!;
      const orgId = userData.organizationId || uid;

      console.log(`[MUSICSCALE_REPAIR_REQUEST] resolved orgId: ${orgId}`);

      let legacyDocFound = false;
      let legacyPath = '';

      const legacySubDoc = await db.collection('subscriptions').doc(uid).get();
      if (legacySubDoc.exists && orgId !== uid) {
         legacyDocFound = true;
         legacyPath = `subscriptions/${uid}`;
      }

      const stripe = getStripe();
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
          return res.json({ success: false, message: 'Nenhuma assinatura ou cliente localizado no Stripe.', repaired: false });
      }

      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 10, status: 'all' });

      if (subs.data.length === 0) {
          return res.json({ success: false, message: 'Seu usuário foi localizado, mas não há assinaturas ativas no momento.', repaired: false });
      }

      const s = subs.data[0];
      const hasAccess = ['active', 'trialing'].includes(s.status);
      const cpEnd = admin.firestore.Timestamp.fromMillis((s as any).current_period_end * 1000);
      const tEnd = s.trial_end ? admin.firestore.Timestamp.fromMillis(s.trial_end * 1000) : null;
      const plan = s.metadata?.plan || 'monthly';

      const subPayload = {
          schemaVersion: 1,
          organizationId: orgId,
          status: s.status,
          plan: plan,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: s.id,
          currentPeriodEnd: cpEnd,
          trialEndsAt: tEnd,
          features: {
            globalLibrary: hasAccess,
            musicScale: hasAccess
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(orgId), subPayload, { merge: true });

      batch.set(db.collection('organizations').doc(orgId), {
          ownerUid: uid,
          ownerId: uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('users').doc(uid), {
          organizationId: orgId,
          organizationRole: 'owner',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organization_members').doc(`${uid}_${orgId}`), {
          uid: uid,
          organizationId: orgId,
          role: 'owner'
      }, { merge: true });

      await batch.commit();

      console.log('[OWNER_REPAIR]', {
        uid: uid,
        organizationId: orgId,
        motivo: 'repair/sync',
        assinaturaEncontrada: s.id,
        status: 'ownership_corrigido'
      });

      console.log(`[MILLIONSNEST_REPAIR_EXECUTION] Repair executado com sucesso:`);
      console.log(`- stripe customer: ${customer.id}`);
      console.log(`- assinatura: ${s.id} (${s.status})`);
      console.log(`- path legado encontrado: ${legacyDocFound ? legacyPath : 'Nenhum'}`);
      console.log(`- novo path salvo: subscriptions/${orgId}`);
      console.log(`- payload final:`, subPayload);

      return res.json({
         success: true,
         repaired: true,
         orgId,
         message: 'Assinatura sincronizada com sucesso.'
      });

    } catch (e: any) {
      console.error('[MILLIONSNEST_REPAIR_EXECUTION] Error:', e.message);
      res.status(500).json({ error: e.message, message: 'Não foi possível concluir o sync automático. Erro de servidor.' });
    }
  });

  app.get('/api/repair/check', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;
      const email = decodedToken.email;
      if (!db || !email) return res.status(400).json({ error: 'Missing params' });

      // Only checking Stripe here. If local is empty but Stripe has something -> requires repair.
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
          return res.json({ requiresRepair: false });
      }
      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' });
      
      if (subs.data.length > 0) {
          return res.json({ requiresRepair: true });
      }

      return res.json({ requiresRepair: false });
    } catch (e: any) {
      console.error('[MILLIONSNEST_REPAIR_CHECK] Error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/repair/:email', async (req, res) => {
    try {
      const { email } = req.params;
      if (!db || !email) return res.status(400).send('Missing params');

      console.log(`[REPAIR] Inciando análise para email: ${email}`);
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

      let orgId = userId;
      let legacyDocFound = false;
      let legacyPath = '';

      if (!usersQuery.empty) {
        orgId = usersQuery.docs[0].data()?.organizationId || userId;
      }

      // Check for legacy doc
      const legacySubDoc = await db.collection('subscriptions').doc(userId).get();
      if (legacySubDoc.exists && orgId !== userId) {
         legacyDocFound = true;
         legacyPath = `subscriptions/${userId}`;
         console.log(`[REPAIR_DEBUG] Documento legado encontrado no path antigo: ${legacyPath}`);
      }

      let stripeStatus = 'no_subscription';
      if (subs.data.length > 0) {
        const s = subs.data[0];
        stripeStatus = s.status;
        const hasAccess = ['active', 'trialing'].includes(s.status);
        const cpEnd = admin.firestore.Timestamp.fromMillis((s as any).current_period_end * 1000);
        const tEnd = s.trial_end ? admin.firestore.Timestamp.fromMillis(s.trial_end * 1000) : null;
        
        console.log(`[REPAIR_DEBUG] Assinatura encontrada no Stripe: ${s.id} com status: ${s.status}`);

        const batch = db.batch();
        const subRef = db.collection('subscriptions').doc(orgId);
        
        const subPayload = {
            schemaVersion: 1,
            organizationId: orgId,
            status: s.status,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: s.id,
            currentPeriodEnd: cpEnd,
            trialEndsAt: tEnd,
            plan: s.metadata?.plan || 'monthly',
            features: {
              globalLibrary: hasAccess,
              musicScale: hasAccess
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(subRef, subPayload, { merge: true });

        // Update organization
        batch.set(db.collection('organizations').doc(orgId), {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(db.collection('organization_members').doc(`${userId}_${orgId}`), {
            uid: userId,
            organizationId: orgId,
            role: 'owner'
        }, { merge: true });

        // Update user
        batch.set(db.collection('users').doc(userId), {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();
        
        console.log(`[REPAIR_DEBUG] Path novo da organização centralizada: subscriptions/${orgId}`);
        console.log(`[REPAIR_DEBUG] Repair executado com sucesso e salva a estrutura correta.`);
        console.log(`[REPAIR_DEBUG] Payload final salvo: `, subPayload);

        return res.json({
          success: true,
          email,
          userId,
          orgId,
          legacyDocFound,
          legacyPath,
          customerId: customer.id,
          stripeStatus,
          repaired: true,
          message: 'Assinatura migrada e/ou consertada com sucesso.'
        });
      }

      return res.json({
        success: true,
        email,
        userId,
        orgId,
        customerId: customer.id,
        stripeStatus,
        repaired: false,
        message: 'O usuário não possui assinaturas ativas no Stripe.'
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
      const userData: any = userSnap.empty ? null : { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      
      let subData = null;
      let orgData = null;
      if (userData) {
        const orgId = userData.organizationId || userData.id;
        const sDoc = await db.collection('subscriptions').doc(orgId).get();
        subData = sDoc.exists ? sDoc.data() : null;
        
        const oDoc = await db.collection('organizations').doc(orgId).get();
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

  app.post('/api/user/organization', express.json(), async (req, res) => {
    try {
      const { orgId, name } = req.body;
      if (!orgId || !name) {
        res.status(400).json({ error: 'Missing orgId or name' });
        return;
      }
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;
      const batch = admin.firestore().batch();

      batch.set(admin.firestore().collection('organizations').doc(orgId), { 
        name, 
        ownerUid: uid,
        ownerId: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

      batch.set(admin.firestore().collection('organization_members').doc(`${uid}_${orgId}`), {
        uid: uid,
        organizationId: orgId,
        role: 'owner'
      }, { merge: true });

      batch.set(admin.firestore().collection('users').doc(uid), {
        organizationRole: 'owner',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      console.log('[OWNERSHIP_SYNC]', {
        uid: uid,
        organizationId: orgId,
        role_anterior: 'unknown',
        role_nova: 'owner',
        motivo: 'criação/edição da organização'
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v1/billing/validate-coupon', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Code is required' });

      const isMock = process.env.STRIPE_SECRET_KEY === undefined;
      if (isMock) {
         return res.json({ valid: true, id: 'mock_promo', percentOff: 20 });
      }

      const stripe = getStripe();
      // list promotion codes by the code string
      const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
      
      if (promos.data.length === 0) {
          return res.status(404).json({ error: 'Cupom inválido ou expirado.' });
      }

      const promo = promos.data[0];
      const coupon = (promo as any).coupon;

      if (!coupon || !coupon.valid) {
          return res.status(400).json({ error: 'Este cupom não é mais válido.' });
      }

      res.json({
         valid: true,
         id: promo.id,
         percentOff: coupon.percent_off,
         amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
         currency: coupon.currency,
         duration: coupon.duration
      });
    } catch (e: any) {
      console.error('[Validate Coupon] Error:', e.message);
      res.status(500).json({ error: 'Erro ao validar cupom.' });
    }
  });

  app.post('/api/v1/billing/unified-checkout', async (req, res) => {
    try {
      const { userId, email, planLookupKey, addonLookupKeys, promoCodeId } = req.body;

      if (!userId || !email) {
        res.status(400).json({ error: 'Missing userId or email' });
        return;
      }

      console.log(`[Unified Checkout] Creating checkout session for user ${userId}`);

      const service = getBillingService();
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;

      if (isMock) {
         console.error('[Unified Checkout] STRIPE_SECRET_KEY env variable is missing');
         res.status(400).json({ error: 'A Chave do Stripe não está configurada (Modo Mock).' });
         return;
      }

      const stripe = getStripe();
      
      const line_items: any[] = [];

      // Find plan price
      if (planLookupKey) {
        const planPriceId = await service.getPriceByLookupKey(planLookupKey);
        if (planPriceId) {
          line_items.push({ price: planPriceId, quantity: 1 });
        } else {
          res.status(400).json({ error: `Plano ${planLookupKey} não encontrado no sistema.` });
          return;
        }
      }

      // Find addon prices
      if (addonLookupKeys && Array.isArray(addonLookupKeys)) {
        for (const addonKey of addonLookupKeys) {
          const addonPriceId = await service.getPriceByLookupKey(addonKey);
          if (addonPriceId) {
            line_items.push({ price: addonPriceId, quantity: 1 });
          } else {
            res.status(400).json({ error: `Addon ${addonKey} não encontrado.` });
            return;
          }
        }
      }

      if (line_items.length === 0) {
        res.status(400).json({ error: 'Nenhum item selecionado para o checkout.' });
        return;
      }

      // Find customer
      let customerId: string | undefined;
      let orgId = userId;
      if (db) {
         const userDoc = await db.collection('users').doc(userId).get();
         if (userDoc.exists) {
            customerId = userDoc.data()?.stripeCustomerId;
            orgId = userDoc.data()?.organizationId || userId;
         }
         
         if (!customerId) {
            const subDoc = await db.collection('subscriptions').doc(orgId).get();
            if (subDoc.exists) customerId = subDoc.data()?.stripeCustomerId;
         }
      }

      if (!customerId && email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data.length > 0) {
           customerId = customers.data[0].id;
        }
      }

      // We only pass subscription data if there's at least one recurring item. Check prices.
      let hasRecurring = false;
      const productsReq = await service.getProducts();
      const allProds = [...productsReq.plans, ...productsReq.addons];
      
      const sessionArgs: any = {
        payment_method_types: ['card'],
        line_items,
        client_reference_id: userId,
        success_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      };

      if (promoCodeId) {
        sessionArgs.discounts = [{ promotion_code: promoCodeId }];
        sessionArgs.allow_promotion_codes = undefined;
      } else {
        sessionArgs.allow_promotion_codes = true;
      }

      // Determine mode based on recurring vs one-time
      // Stripe requires 'subscription' mode if there is AT LEAST ONE recurring price.
      // If we mix one-time and recurring, it MUST be 'subscription' mode.
      const lookupKeys = [planLookupKey, ...(addonLookupKeys || [])].filter(Boolean);
      for (const key of lookupKeys) {
        const p = allProds.find(x => x.lookupKey === key);
        if (p && p.interval && p.interval !== 'one_time') {
          hasRecurring = true;
          break;
        }
      }

      if (hasRecurring) {
        sessionArgs.mode = 'subscription';
        sessionArgs.subscription_data = {
          trial_period_days: 7, // 7 days trial
          metadata: {
            uid: userId,
            plan: planLookupKey || 'unknown'
          }
        };
      } else {
        sessionArgs.mode = 'payment';
      }

      // Global metadata
      sessionArgs.metadata = {
        uid: userId,
        unified_checkout: 'true',
        plan: planLookupKey || 'none',
        addons: addonLookupKeys ? addonLookupKeys.join(',') : ''
      };

      if (customerId) {
         sessionArgs.customer = customerId;
      } else {
         sessionArgs.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionArgs);

      console.log(`[Unified Checkout] Session created successfully for user ${userId}`);
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[Unified Checkout] Error creating checkout session:', e);
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

      let customerId: string | undefined;
      let orgId = userId;
      if (db) {
         const userDoc = await db.collection('users').doc(userId).get();
         if (userDoc.exists) {
            customerId = userDoc.data()?.stripeCustomerId;
            orgId = userDoc.data()?.organizationId || userId;
         }
         
         if (!customerId) {
            const subDoc = await db.collection('subscriptions').doc(orgId).get();
            if (subDoc.exists) customerId = subDoc.data()?.stripeCustomerId;
         }
      }

      if (!customerId && email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data.length > 0) {
           customerId = customers.data[0].id;
        }
      }

      const sessionArgs: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true, // Permite uso de cupons de desconto para novos planos
        subscription_data: {
          trial_period_days: 7, // 7 days trial mandatory by requirements
        },
        client_reference_id: userId,
        metadata: {
          uid: userId,
          plan: planItem ? planItem.tier || planItem.feature : 'unknown',
          product: planItem ? planItem.app : 'musicscale'
        },
        success_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      };

      if (customerId) {
         sessionArgs.customer = customerId;
      } else {
         sessionArgs.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionArgs);

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
      let orgId = userId;
      if (db) {
         const userDoc = await db.collection('users').doc(userId).get();
         if (userDoc.exists) {
            customerId = userDoc.data()?.stripeCustomerId;
            orgId = userDoc.data()?.organizationId || userId;
         }
         
         if (!customerId) {
            const subDoc = await db.collection('subscriptions').doc(orgId).get();
            if (subDoc.exists) customerId = subDoc.data()?.stripeCustomerId;
         }
      }

      if (!customerId && email) {
        const stripe = getStripe();
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data.length > 0) {
           customerId = customers.data[0].id;
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
        allow_promotion_codes: true, // Permite uso de cupons de desconto para addons
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

      let customerId: string | undefined;
      let orgId = userId;
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        customerId = userDoc.data()?.stripeCustomerId;
        orgId = userDoc.data()?.organizationId || userId;
      }
      
      if (!customerId) {
         const subDoc = await db.collection('subscriptions').doc(orgId).get();
         if (subDoc.exists) {
            customerId = subDoc.data()?.stripeCustomerId;
         }
      }
          
      if (!customerId) {
         const email = userDoc.data()?.email;
         if (email) {
            const stripe = getStripe();
            const customers = await stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
               customerId = customers.data[0].id;
            }
         }
      }

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
      app.use(express.static(distPath, {
        setHeaders: (res, path) => {
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (path.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        }
      }));
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
