import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';

dotenv.config();

// Configurar Firebase Admin
let db: admin.firestore.Firestore | null = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] Initialize via FIREBASE_SERVICE_ACCOUNT_BASE64: SUCCESS');
    }
  } else if (process.env.FIREBASE_PROJECT_ID && !admin.apps.length) {
    console.log('[Firebase Admin] Trying ADC with Project ID:', process.env.FIREBASE_PROJECT_ID);
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('[Firebase Admin] Initialize via FIREBASE_PROJECT_ID: SUCCESS');
  } else if (!admin.apps.length) {
    console.warn('[Firebase Admin] Nenhum FIREBASE_SERVICE_ACCOUNT_BASE64 ou FIREBASE_PROJECT_ID encontrado no ambiente.');
  }

  if (admin.apps.length > 0) {
    db = admin.firestore();
    console.log('[Firebase Admin] Firestore provider initialized successfully.');
  }
} catch (error) {
  console.error('[Firebase Admin] Init Error:', error);
}

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' } as any);

// Cache inteligente para preços do Stripe
let cachedPrices: { monthly: any, annual: any, timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de TTL

async function startServer() {
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
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Processar o evento
    if (!db) {
      console.error('[Webhook] Firestore Admin not initialized. Cannot process webhook.');
      res.status(500).send('Database error');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          console.log('[Webhook] Received checkout.session.completed');
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.uid || session.client_reference_id;
          const plan = session.metadata?.plan || 'monthly';
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;

          if (!userId || !subscriptionId) {
             console.log('[Webhook] Missing userId or subscriptionId in session', { 
               userId, 
               subscriptionId, 
               metadata: session.metadata,
               client_reference_id: session.client_reference_id
             });
             break;
          }

          console.log(`[Webhook] Processing subscription for user: ${userId} with plan: ${plan}`);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          const orgId = userId; // Create a 1:1 org organization for this SaaS user

          console.log(`[Webhook] Writing data to Firestore for user: ${userId}`);

          try {
            // 1. Create Organization
            await db.collection('organizations').doc(orgId).set({
              name: `Organização de ${session.customer_email || userId}`,
              ownerUid: userId,
              plan: plan,
              subscriptionStatus: subscription.status,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // 2. Create Membership (Global Source of Truth)
            await db.collection('organization_members').doc(`${userId}_${orgId}`).set({
               uid: userId,
               organizationId: orgId,
               role: 'owner'
            }, { merge: true });

            // 3. Create/Update Subscription (Official Struct: subscriptions/{uid})
            await db.collection('subscriptions').doc(userId).set({
              product: 'musicscale',
              status: subscription.status,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: plan,
              currentPeriodEnd: admin.firestore.Timestamp.fromMillis((subscription as any).current_period_end * 1000),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            // 4. Update User Profile
            await db.collection('users').doc(userId).update({
              organizationId: orgId,
              products: admin.firestore.FieldValue.arrayUnion('musicscale'),
              name: session.customer_email ? session.customer_email.split('@')[0] : 'Usuário'
            });

            console.log(`[Webhook] Successfully provisioned complete SaaS architecture for user: ${userId}`);
          } catch (firestoreErr: any) {
            console.error(`[Webhook] Firestore write failed for user: ${userId}:`, firestoreErr);
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          console.log(`[Webhook] Received ${event.type}`);
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          
          console.log(`[Webhook] Updating subscription status for Stripe sub: ${subscriptionId} to ${subscription.status}`);
          
          // Query to find the matching subscription document by stripe ID
          const subsQuery = await db.collection('subscriptions').where('stripeSubscriptionId', '==', subscriptionId).get();
          
          if (!subsQuery.empty) {
             const batch = db.batch();
             subsQuery.forEach(doc => {
                 // Update subscription
                 batch.update(doc.ref, {
                    status: subscription.status,
                    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 });
                 
                 // Also update the related organization status! (Assuming orgId == userId because we set orgId = userId in checkout)
                 const orgRef = db!.collection('organizations').doc(doc.id);
                 batch.update(orgRef, {
                    subscriptionStatus: subscription.status,
                 });
             });
             await batch.commit();
             console.log(`[Webhook] Successfully updated ${subsQuery.size} subscription document(s).`);
          } else {
             console.log(`[Webhook] No subscription found in Firestore for stripeSubscriptionId: ${subscriptionId}`);
          }
          break;
        }
      }

      res.status(200).json({ received: true });
    } catch (e: any) {
      console.error('[Webhook] Error processing webhook:', e);
      res.status(500).send('Error processing webhook');
    }
  });

  // Outras rotas da API usam JSON
  app.use(express.json());

  app.get('/api/stripe/prices', async (req, res) => {
    try {
      if (stripeKey === 'sk_test_mock') {
        return res.json({ monthly: { price: 19.90, currency: 'brl' }, annual: { price: 191.04, currency: 'brl' } });
      }

      const now = Date.now();
      // Verificar se o cache é válido
      if (cachedPrices && (now - cachedPrices.timestamp) < CACHE_TTL_MS) {
        console.log('[Prices] Serving from local cache');
        return res.json({ monthly: cachedPrices.monthly, annual: cachedPrices.annual });
      }

      const monthlyId = process.env.STRIPE_PRICE_ID_MONTHLY;
      const annualId = process.env.STRIPE_PRICE_ID_ANNUAL;
      
      let monthlyPriceInfo = { price: 19.90, currency: 'brl' }; // Default fallbacks
      let annualPriceInfo = { price: 191.04, currency: 'brl' }; // Default fallbacks

      try {
        if (monthlyId) {
          const p = await stripe.prices.retrieve(monthlyId);
          monthlyPriceInfo = { price: (p.unit_amount || 0) / 100, currency: p.currency };
        }
        
        if (annualId) {
          const p = await stripe.prices.retrieve(annualId);
          annualPriceInfo = { price: (p.unit_amount || 0) / 100, currency: p.currency };
        }
        
        // Atualizar cache com dados frescos
        cachedPrices = {
          monthly: monthlyPriceInfo,
          annual: annualPriceInfo,
          timestamp: now
        };
        console.log('[Prices] Cache updated from Stripe');
        
        return res.json({ monthly: monthlyPriceInfo, annual: annualPriceInfo });
        
      } catch (stripeErr: any) {
        console.error('[Prices] Error retrieving from Stripe, attempting fallback:', stripeErr.message);
        
        // Estratégia de Fallback Seguro
        if (cachedPrices) {
           console.log('[Prices] Fallback: Serving stale cache due to Stripe error');
           return res.json({ monthly: cachedPrices.monthly, annual: cachedPrices.annual });
        } else {
           console.log('[Prices] Fallback: Serving default values due to Stripe error');
           return res.json({ monthly: monthlyPriceInfo, annual: annualPriceInfo }); // Uses the constants defined above
        }
      }
    } catch (e: any) {
      console.error('[Prices] Fatal error fetching prices:', e);
      if (cachedPrices) {
        return res.json({ monthly: cachedPrices.monthly, annual: cachedPrices.annual });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      const { userId, email, plan = 'monthly' } = req.body;

      if (!userId || !email) {
        res.status(400).json({ error: 'Missing userId or email' });
        return;
      }

      console.log(`[Checkout] Creating checkout session for user ${userId} with plan ${plan}`);

      if (stripeKey === 'sk_test_mock') {
         console.error('[Checkout] STRIPE_SECRET_KEY env variable is missing');
         res.status(400).json({ error: 'A Chave do Stripe (STRIPE_SECRET_KEY) não está configurada no Vercel.' });
         return;
      }

      const priceId = plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY; 
      if (!priceId) {
         console.error(`[Checkout] STRIPE_PRICE_ID_${plan.toUpperCase()} env variable is missing`);
         res.status(400).json({ error: `A variável STRIPE_PRICE_ID_${plan.toUpperCase()} não está configurada no Vercel.` });
         return;
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: 7, // 7 days trial mandatory by requirements
        },
        client_reference_id: userId,
        customer_email: email,
        metadata: {
          uid: userId,
          plan: plan,
          product: 'musicscale'
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

  app.post('/api/stripe/create-portal-session', async (req, res) => {
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

      if (stripeKey === 'sk_test_mock') {
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
}

const appPromise = startServer();

export default async function (req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
