import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';
import { BillingService } from './src/server/services/BillingService.js';
import { getDefaultPermissions, CURRENT_PERMISSIONS_VERSION } from './src/lib/rbac.js';
import { 
  MUSIC_SCALE_PLANS, 
  priceIdToMusicScalePlan, 
  normalizeMusicScalePlan,
  resolveMusicScaleEntitlements,
  calculateOccupiedSlots
} from './src/lib/musicScalePlans.js';

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
      db.settings({ ignoreUndefinedProperties: true });
      console.log('[Firebase Admin] Firestore provider initialized successfully.');
    }
  } catch (error: any) {
    console.error('[Firebase Admin] Init CRASH:', error.message);
    if (error.stack) console.error(error.stack);
  }
  return db;
}

/**
 * Calculates occupied slots for an organization.
 * Counts active/invited members and valid pending invites.
 */
export async function getActiveAndReservedMemberCount(orgId: string): Promise<number> {
  const dbInstance = getDb();
  if (!dbInstance) return 0;

  // 1. Fetch members
  const membersSnap = await dbInstance.collection('organizations').doc(orgId).collection('members').get();
  const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. Fetch pending invites
  const invitesSnap = await dbInstance.collection('organizations').doc(orgId).collection('invites').where('status', '==', 'pending').get();
  const invites = invitesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return calculateOccupiedSlots(members, invites);
}

/**
 * Verifies if an organization has slot capacity to add a new member.
 */
export async function canAddOrganizationMember(orgId: string): Promise<{ allowed: boolean; current: number; limit: number; planName: string }> {
  try {
    const dbInstance = getDb();
    if (!dbInstance) {
      return { allowed: true, current: 0, limit: -1, planName: 'starter' };
    }

    // Load subscription and organization doc
    const subDoc = await dbInstance.collection('subscriptions').doc(orgId).get();
    const subscription = subDoc.exists ? subDoc.data() : null;

    const orgDoc = await dbInstance.collection('organizations').doc(orgId).get();
    const organization = orgDoc.exists ? orgDoc.data() : null;

    const entitlements = resolveMusicScaleEntitlements({ subscription, organization });
    const limit = entitlements?.limits?.users ?? 10;

    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1, planName: entitlements.name };
    }

    const current = await getActiveAndReservedMemberCount(orgId);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: entitlements.name
    };
  } catch (err) {
    console.error('[canAddOrganizationMember] Error:', err);
    return { allowed: true, current: 0, limit: -1, planName: 'starter' }; // Default safe fallback
  }
}

/**
 * Throws an error if adding a member exceeds capacity.
 */
export async function assertCanAddOrganizationMember(orgId: string): Promise<void> {
  const check = await canAddOrganizationMember(orgId);
  if (!check.allowed) {
    throw new Error(`Limite de usuários excedido! O plano atual (${check.planName}) permite no máximo ${check.limit} usuários, e a organização já possui ${check.current} vagas ocupadas.`);
  }
}

/**
 * Gets current month usage count for a given operation type (e.g., library_import)
 */
export async function getCurrentMonthUsage(orgId: string, type: string): Promise<number> {
  const dbInstance = getDb();
  if (!dbInstance) return 0;

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const monthId = `${year}-${month}`; // e.g. "2026-06"

  const docId = `${monthId}_${type}`;
  const docRef = dbInstance.collection('organizations').doc(orgId).collection('musicscale').doc('usage').collection('monthly').doc(docId);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    return docSnap.data()?.count ?? 0;
  }
  
  // Try alternative flat path if nested path doesn't exist
  const altRef = dbInstance.collection('organizations').doc(orgId).collection('musicscale_usage').doc(docId);
  const altSnap = await altRef.get();
  if (altSnap.exists) {
    return altSnap.data()?.count ?? 0;
  }

  return 0;
}

/**
 * Increments current month usage count for a given operation type and stores in both paths for compatibility
 */
export async function incrementMonthUsage(orgId: string, type: string, incrementBy: number = 1): Promise<number> {
  const dbInstance = getDb();
  if (!dbInstance) return 0;

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const monthId = `${year}-${month}`; // e.g. "2026-06"

  const docId = `${monthId}_${type}`;
  
  // Nested path
  const docRef = dbInstance.collection('organizations').doc(orgId).collection('musicscale').doc('usage').collection('monthly').doc(docId);
  
  // Flat fallback path
  const altRef = dbInstance.collection('organizations').doc(orgId).collection('musicscale_usage').doc(docId);

  let newCount = incrementBy;
  
  await dbInstance.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(docRef);
    if (docSnap.exists) {
      newCount = (docSnap.data()?.count ?? 0) + incrementBy;
    }
    
    transaction.set(docRef, {
      monthId,
      type,
      count: newCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(altRef, {
      monthId,
      type,
      count: newCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return newCount;
}

/**
 * Verifies if an organization has capacity for a monthly operation (e.g., library_import)
 */
export async function canPerformOperation(orgId: string, type: string, uid?: string): Promise<{ allowed: boolean; current: number; limit: number; planName: string }> {
  try {
    const dbInstance = getDb();
    if (!dbInstance) {
      return { allowed: true, current: 0, limit: -1, planName: 'starter' };
    }

    let userProfile = null;
    if (uid) {
      const userDoc = await dbInstance.collection('users').doc(uid).get();
      userProfile = userDoc.exists ? userDoc.data() : null;
    }

    // Load subscription and organization doc
    const subDoc = await dbInstance.collection('subscriptions').doc(orgId).get();
    const subscription = subDoc.exists ? subDoc.data() : null;

    const orgDoc = await dbInstance.collection('organizations').doc(orgId).get();
    const organization = orgDoc.exists ? orgDoc.data() : null;

    const entitlements = resolveMusicScaleEntitlements({ subscription, organization, userProfile });
    
    let limit = -1;
    if (type === 'library_import') {
      limit = entitlements?.limits?.libraryImportsPerMonth ?? 0;
    }

    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1, planName: entitlements.name };
    }

    const current = await getCurrentMonthUsage(orgId, type);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: entitlements.name
    };
  } catch (err) {
    console.error('[canPerformOperation] Error:', err);
    return { allowed: true, current: 0, limit: -1, planName: 'starter' };
  }
}

/**
 * Throws an error if the operational limit has been reached
 */
export async function assertCanPerformOperation(orgId: string, type: string, uid?: string): Promise<void> {
  const check = await canPerformOperation(orgId, type, uid);
  if (!check.allowed) {
    if (type === 'library_import') {
      throw new Error(`Você atingiu o limite de ${check.limit} importações da Biblioteca Viva neste mês. Faça upgrade para o Pro para liberar importações ilimitadas.`);
    }
    throw new Error(`Limite mensal excedido! O plano atual (${check.planName}) permite no máximo ${check.limit} operações do tipo "${type}" por mês, e a organização já consumiu ${check.current}.`);
  }
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

/**
 * Idempotently and resiliently upserts ecosystem subscription and auto-heals related organization documents
 */
export async function upsertEcosystemSubscription(params: {
  userId: string;
  orgId: string;
  subscription: Stripe.Subscription;
  eventCreatedTs: number;
  event_type: string;
  userEmail?: string | null;
}) {
  const { userId, orgId, subscription, eventCreatedTs, event_type } = params;
  const db = getDb();
  if (!db) {
    throw new Error('Database not initialized in upsertEcosystemSubscription');
  }

  const subRef = db.collection('subscriptions').doc(orgId);
  const orgRef = db.collection('organizations').doc(orgId);
  const legacyMemberRef = db.collection('organization_members').doc(`${userId}_${orgId}`);
  const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(userId);
  const userRef = db.collection('users').doc(userId);

  // Fetch all documents in parallel to check if any are missing (for self-healing)
  const [subDoc, orgDoc, legacyMemberDoc, memberDoc, userDoc] = await Promise.all([
    subRef.get(),
    orgRef.get(),
    legacyMemberRef.get(),
    memberRef.get(),
    userRef.get()
  ]);

  const anyMissing = !subDoc.exists || !orgDoc.exists || !memberDoc.exists || !userDoc.exists;

  // Idempotency: if all documents exist, check the incoming timestamp
  if (!anyMissing) {
    const existingTs = subDoc.data()?.lastStripeEventTs || orgDoc.data()?.lastStripeEventTs || 0;
    if (existingTs && existingTs > eventCreatedTs) {
      console.log(`[UPSERT_ECOSYSTEM_SUBSCRIPTION] Idempotency Skip for UID: ${userId}, Org: ${orgId}. Existing event TS ${existingTs} is newer than incoming ${eventCreatedTs} from ${event_type}.`);
      return {
        success: true,
        skipped: true,
        createdDocuments: [],
        updatedDocuments: [],
        resolvedPlan: subDoc.data()?.plan || 'starter',
        trialEndsAt: subDoc.data()?.trialEndsAt ? (subDoc.data()?.trialEndsAt instanceof admin.firestore.Timestamp ? subDoc.data()?.trialEndsAt.toDate() : new Date(subDoc.data()?.trialEndsAt)) : null
      };
    }
  }

  const createdDocuments: string[] = [];
  const updatedDocuments: string[] = [];

  if (!subDoc.exists) createdDocuments.push(`subscriptions/${orgId}`);
  else updatedDocuments.push(`subscriptions/${orgId}`);

  if (!orgDoc.exists) createdDocuments.push(`organizations/${orgId}`);
  else updatedDocuments.push(`organizations/${orgId}`);

  if (!memberDoc.exists) createdDocuments.push(`organization_members/${userId}_${orgId}`);
  else updatedDocuments.push(`organization_members/${userId}_${orgId}`);

  if (!userDoc.exists) createdDocuments.push(`users/${userId}`);
  else updatedDocuments.push(`users/${userId}`);

  // Resolve userEmail fallback
  let userEmail = params.userEmail;
  if (!userEmail && userDoc.exists) {
    userEmail = userDoc.data()?.email;
  }
  if (!userEmail && stripeInstance && subscription.customer) {
     try {
        const custObj = await stripeInstance.customers.retrieve(subscription.customer as string);
        if (custObj && !custObj.deleted && (custObj as any).email) {
           userEmail = (custObj as any).email;
        }
     } catch (err) {
        console.warn('[UPSERT_ECOSYSTEM_SUBSCRIPTION] Failed to retrieve customer email:', err);
     }
  }

  const currentPeriodEnd = admin.firestore.Timestamp.fromMillis((subscription as any).current_period_end * 1000);
  const trialEnd = (subscription as any).trial_end ? admin.firestore.Timestamp.fromMillis((subscription as any).trial_end * 1000) : null;
  const hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(subscription.status);

  const priceId = (subscription as any).items?.data?.[0]?.price?.id || null;
  const metadataPlan = (subscription as any).metadata?.plan || 'starter';
  const resolvedPlan = priceIdToMusicScalePlan(priceId) || normalizeMusicScalePlan(metadataPlan);
  const planDetails = MUSIC_SCALE_PLANS[resolvedPlan] || MUSIC_SCALE_PLANS['starter'];
  const cancelAtPeriodEnd = (subscription as any).cancel_at_period_end || false;

  const batch = db.batch();

  // 1. subscriptions/{orgId}
  batch.set(subRef, {
    schemaVersion: 2,
    organizationId: orgId,
    app: 'musicscale',
    status: subscription.status,
    plan: resolvedPlan,
    priceId: priceId,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    trialEndsAt: trialEnd,
    currentPeriodEnd: currentPeriodEnd,
    cancelAtPeriodEnd: cancelAtPeriodEnd,
    limits: planDetails.limits,
    features: {
      globalLibrary: hasAccess,
      musicScale: hasAccess,
      ...planDetails.features
    },
    supportTier: planDetails.features?.supportTier || 'basic',
    lastStripeEventTs: eventCreatedTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 2. organizations/{orgId}
  const orgName = orgDoc.exists ? (orgDoc.data()?.name || `Organização de ${userEmail || userId}`) : `Organização de ${userEmail || userId}`;
  const orgPayload: any = {
    name: orgName,
    ownerUid: userId,
    ownerUserId: userId,
    ownerId: userId,
    plan: resolvedPlan,
    subscriptionPlan: resolvedPlan,
    subscriptionStatus: subscription.status,
    status: subscription.status,
    enabledApps: admin.firestore.FieldValue.arrayUnion('musicscale'),
    
    // Nested app cache object
    'apps.musicscale.access': hasAccess,
    'apps.musicscale.status': subscription.status,
    'apps.musicscale.plan': resolvedPlan,
    'apps.musicscale.features': planDetails.features,
    'apps.musicscale.limits': planDetails.limits,
    'apps.musicscale.supportTier': planDetails.features?.supportTier || 'basic',
    'apps.musicscale.currentPeriodEnd': currentPeriodEnd,
    'apps.musicscale.trialEndsAt': trialEnd,
    'apps.musicscale.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    'apps.musicscale.planUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
    
    planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    entitlementsVersion: 2,
    
    lastStripeEventTs: eventCreatedTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (!orgDoc.exists) {
     orgPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  batch.set(orgRef, orgPayload, { merge: true });

  // 3. New Architecture member doc: organizations/{orgId}/members/{userId}
  const memberData: any = {
     uid: userId,
     email: userEmail || '',
     organizationId: orgId,
     role: 'owner',
     organizationRole: 'owner',
     appRole: 'Administrador',
     status: 'active',
     permissionsVersion: CURRENT_PERMISSIONS_VERSION,
     permissions: getDefaultPermissions('owner'),
     updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (!memberDoc.exists) {
     memberData.createdAt = admin.firestore.FieldValue.serverTimestamp();
     memberData.joinedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  
  batch.set(memberRef, memberData, { merge: true });

  // 3.1. organization_members/{userId}_{orgId} (Legacy)
  batch.set(legacyMemberRef, memberData, { merge: true });

  // 4. users/{userId}
  const userPayload: any = {
     organizationId: orgId,
     activeOrganizationId: orgId,
     primaryOrganizationId: orgId,
     defaultOrganizationId: orgId,
     stripeCustomerId: subscription.customer,
     stripeSubscriptionId: subscription.id,
     subscriptionStatus: subscription.status,
     trialEndsAt: trialEnd,
     currentPeriodEnd: currentPeriodEnd,
     cancelAtPeriodEnd: cancelAtPeriodEnd,
     updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (userEmail && (!userDoc.exists || !userDoc.data()?.email)) {
     userPayload.email = userEmail;
  }
  if (!userDoc.exists || !userDoc.data()?.displayName) {
     userPayload.displayName = userEmail ? userEmail.split('@')[0] : 'Usuário ' + userId.substring(0, 5);
  }
  if (!userDoc.exists || !userDoc.data()?.systemRole) {
     userPayload.systemRole = 'user';
  }
  if (!userDoc.exists || !userDoc.data()?.createdAt) {
     userPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (!userDoc.exists || !userDoc.data()?.products) {
     userPayload.products = ['musicscale'];
  }
  if (!userDoc.exists || !userDoc.data()?.permissions) {
     userPayload.permissions = { musicscale: true };
  }
  if (!userDoc.exists || !userDoc.data()?.appsAccess) {
     userPayload['appsAccess'] = { musicscale: true };
  }

  batch.set(userRef, userPayload, { merge: true });

  await batch.commit();

  console.log('[UPSERT_ECOSYSTEM_SUBSCRIPTION] Complete:', {
    orgId,
    uid: userId,
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    plan: resolvedPlan,
    trialEndsAt: trialEnd ? trialEnd.toDate().toISOString() : null,
    createdDocuments,
    updatedDocuments
  });

  return {
    success: true,
    skipped: false,
    createdDocuments,
    updatedDocuments,
    resolvedPlan,
    trialEndsAt: trialEnd ? trialEnd.toDate() : null
  };
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
          
          let userId = session.metadata?.userId || session.metadata?.uid || session.client_reference_id;
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
          const orgContext = await resolveUserOrganizationContext(userId);
          let orgId = session.metadata?.organizationId 
            || orgContext.primaryOrganizationId 
            || orgContext.activeOrganizationId;

          if (!orgId) {
             const userDoc = userDocSnap.exists ? userDocSnap.data() : null;
             if (userDoc && userDoc.organizationId && userDoc.organizationId !== userId) {
                orgId = userDoc.organizationId;
             } else {
                orgId = db.collection('organizations').doc().id;
             }
          }
          
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

          const result = await upsertEcosystemSubscription({
             userId,
             orgId,
             subscription,
             eventCreatedTs,
             event_type: event.type,
             userEmail: session.customer_details?.email || session.customer_email || (userDocSnap.exists ? userDocSnap.data()?.email : null)
          });

          await auditRef.update({ 
             status: result.skipped ? 'skipped' : 'success', 
             processedUserId: userId,
             orgId,
             createdDocuments: result.createdDocuments,
             updatedDocuments: result.updatedDocuments,
             stripeDetails: {
               subscriptionId,
               customerId,
               status: subscription.status,
               plan: result.resolvedPlan,
               trialEndsAt: result.trialEndsAt ? result.trialEndsAt.toISOString() : null
             }
          });
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
          let stripeSubObj: any = null;

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
            stripeSubObj = sub;
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
            stripeSubObj = sub;
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

          let targetsToProcess: Array<{ ref: any, docData: any, targetUserId: string, targetOrgId: string }> = [];

          if (!subsQuery.empty) {
             for (const doc of subsQuery.docs) {
                 const docData = doc.data();
                 const orgIdFromDoc = doc.id;
                 let userIdFromDoc = docData.userId || docData.uid || stripeSubObj?.metadata?.userId || stripeSubObj?.metadata?.uid;
                 if (!userIdFromDoc) {
                     const usersSnap = await db.collection('users').where('organizationId', '==', orgIdFromDoc).get();
                     if (!usersSnap.empty) {
                         userIdFromDoc = usersSnap.docs[0].id;
                     } else if (customerId) {
                         const usersByCustomer = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
                         if (!usersByCustomer.empty) {
                             userIdFromDoc = usersByCustomer.docs[0].id;
                         }
                     }
                 }
                 const finalUserId = userIdFromDoc || orgIdFromDoc;
                 targetsToProcess.push({
                     ref: doc.ref,
                     docData,
                     targetUserId: finalUserId,
                     targetOrgId: orgIdFromDoc
                 });
             }
          } else {
             // Self-Healing logic to find and provision the subscriber user & org
             let resolvedUserId = stripeSubObj?.metadata?.userId || stripeSubObj?.metadata?.uid;
             let resolvedOrgId = stripeSubObj?.metadata?.organizationId;

             if (!resolvedUserId && customerId) {
                const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
                if (!usersSnap.empty) {
                   resolvedUserId = usersSnap.docs[0].id;
                   resolvedOrgId = usersSnap.docs[0].data()?.organizationId || resolvedUserId;
                }
             }

             if (!resolvedUserId && customerId) {
                try {
                   const stripeObj = getStripe();
                   const custObj = await stripeObj.customers.retrieve(customerId);
                   if (custObj && !custObj.deleted && (custObj as any).email) {
                      const usersSnap = await db.collection('users').where('email', '==', (custObj as any).email).get();
                      if (!usersSnap.empty) {
                         resolvedUserId = usersSnap.docs[0].id;
                         resolvedOrgId = usersSnap.docs[0].data()?.organizationId || resolvedUserId;
                      }
                   }
                } catch (err) {
                   console.warn('[STRIPE_WEBHOOK] Failed to self-heal customer email lookup:', err);
                }
             }

             if (resolvedUserId) {
                const orgContext = await resolveUserOrganizationContext(resolvedUserId);
                resolvedOrgId = resolvedOrgId || orgContext.primaryOrganizationId || orgContext.activeOrganizationId;
                
                if (!resolvedOrgId) {
                   const userDocSnap = await db.collection('users').doc(resolvedUserId).get();
                   const userDoc = userDocSnap.exists ? userDocSnap.data() : null;
                   if (userDoc && userDoc.organizationId && userDoc.organizationId !== resolvedUserId) {
                      resolvedOrgId = userDoc.organizationId;
                   } else {
                      resolvedOrgId = db.collection('organizations').doc().id;
                   }
                }
                
                console.log('[STRIPE_WEBHOOK_HEAL] Creating virtual subscription target for org:', resolvedOrgId);
                targetsToProcess.push({
                   ref: db.collection('subscriptions').doc(resolvedOrgId),
                   docData: {},
                   targetUserId: resolvedUserId,
                   targetOrgId: resolvedOrgId
                });
             }
          }

          if (targetsToProcess.length > 0) {
             let processedCount = 0;
             const allCreatedDocs: string[] = [];
             const allUpdatedDocs: string[] = [];

             for (const target of targetsToProcess) {
                 const userId = target.targetUserId;
                 const orgId = target.targetOrgId;

                 const result = await upsertEcosystemSubscription({
                   userId,
                   orgId,
                   subscription: stripeSubObj,
                   eventCreatedTs,
                   event_type: event.type
                 });

                 if (result && !result.skipped) {
                   allCreatedDocs.push(...result.createdDocuments);
                   allUpdatedDocs.push(...result.updatedDocuments);
                   processedCount++;
                 }
             }
             
             if (processedCount > 0) {
               console.log(`[STRIPE_WEBHOOK] Batch sync successful via upsertEcosystemSubscription for ${processedCount} targets.`);
               await auditRef.update({ 
                  status: 'success', 
                  targetsFound: processedCount,
                  createdDocuments: allCreatedDocs,
                  updatedDocuments: allUpdatedDocs
               });
             } else {
               await auditRef.update({ status: 'skipped', reason: 'All targets skipped or outdated' });
             }
          } else {
             console.log(`[STRIPE_WEBHOOK] NO target documents found or resolved for sub: ${subscriptionId}`);
             await auditRef.update({ status: 'error', error: 'Subscription document not found and auto-provisioning failed' });
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

  // --- ENDPOINTS PÚBLICOS DE ORGANIZAÇÃO ---
  app.get('/api/public/organizations/by-slug/:slug', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Database not initialized' });
      const slug = req.params.slug;
      if (!slug || slug.trim() === '') return res.status(400).json({ error: 'Slug is required' });

      let qs = await db.collection('organizations').where('slug', '==', slug).limit(1).get();
      let orgDoc: any = qs.empty ? null : qs.docs[0];

      if (!orgDoc) {
         // Check redirects
         const redirectDoc = await db.collection('organizationSlugRedirects').doc(slug).get();
         if (redirectDoc.exists) {
            const redirectData = redirectDoc.data();
            if (redirectData?.organizationId) {
               orgDoc = await db.collection('organizations').doc(redirectData.organizationId).get();
               if (!orgDoc.exists) orgDoc = null;
            }
         }
      }

      if (!orgDoc) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const data = orgDoc.data();

      return res.json({
        id: orgDoc.id,
        name: data.name,
        slug: data.slug,
        logo: data.logo || null,
        description: data.description || null,
        city: data.city || null,
        state: data.state || null,
        enabledApps: data.enabledApps || [],
        createdAt: data.createdAt ? data.createdAt.toDate() : null
      });
    } catch (err: any) {
      console.error('[API Public Org]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/public/organizations/:orgId/members', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Database not initialized' });
      const orgId = req.params.orgId;
      if (!orgId) return res.status(400).json({ error: 'Organization ID is required' });

      const membersMap = new Map<string, any>();

      // 1. Busca da collection nova: organizations/{orgId}/members
      const qs1 = await db.collection('organizations').doc(orgId).collection('members').get();
      qs1.docs.forEach(doc => {
        const m = doc.data();
        membersMap.set(doc.id, {
          uid: m.uid || doc.id,
          displayName: m.displayName || m.name || 'Membro',
          photoURL: m.photoURL || m.avatar || null,
          role: m.role || 'member'
        });
      });

      // 2. Busca da collection legada: organization_members
      const qs2 = await db.collection('organization_members').where('organizationId', '==', orgId).get();
      for (const doc of qs2.docs) {
        const m = doc.data();
        const mUid = m.uid || m.user_id;
        if (mUid && !membersMap.has(mUid)) {
           // We might need to fetch the user's name and photo from the users collection
           const userDoc = await db.collection('users').doc(mUid).get();
           const uData = userDoc.exists ? userDoc.data() : {};
           
           membersMap.set(mUid, {
             uid: mUid,
             displayName: m.displayName || m.name || uData?.displayName || uData?.name || 'Membro',
             photoURL: m.photoURL || m.avatar || uData?.photoURL || uData?.avatar || null,
             role: m.role || 'member'
           });
        }
      }

      return res.json({ members: Array.from(membersMap.values()) });
    } catch (err: any) {
      console.error('[API Public Members]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/users/:userId/role', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const actorUid = decodedToken.uid;
      
      const targetUserId = req.params.userId;
      const { newRole } = req.body; // 'ceo', 'admin', 'global_admin', or null/undefined/'user'
      
      if (!db) return res.status(500).json({ error: 'Database not initialized' });

      // Fetch actor
      const actorDoc = await db.collection('users').doc(actorUid).get();
      if (!actorDoc.exists) return res.status(403).json({ error: 'Forbidden' });
      const actorSystemRole = actorDoc.data()?.systemRole;

      // Import the helper dynamically or statically. For node, we'll just implement the rules to be safe.
      const actorRank = actorSystemRole === 'ceo' ? 100 : (actorSystemRole === 'admin' || actorSystemRole === 'global_admin' ? 80 : 0);
      
      if (actorRank === 0) return res.status(403).json({ error: 'Acesso restrito', message: 'Você não tem permissão para alterar cargos globais.' });

      // Fetch target
      const targetDoc = await db.collection('users').doc(targetUserId).get();
      if (!targetDoc.exists) return res.status(404).json({ error: 'Not found', message: 'Usuário alvo não encontrado.' });
      const targetSystemRole = targetDoc.data()?.systemRole;
      const targetRank = targetSystemRole === 'ceo' ? 100 : (targetSystemRole === 'admin' || targetSystemRole === 'global_admin' ? 80 : 0);

      const targetNewRole = newRole === 'user' ? null : newRole;
      const newRank = targetNewRole === 'ceo' ? 100 : (targetNewRole === 'admin' || targetNewRole === 'global_admin' ? 80 : 0);
      const isSelfDemotion = actorUid === targetUserId;

      // Count CEOs if demoting CEO
      let activeCeosCount = 0;
      if (isSelfDemotion && actorRank === 100) {
        const ceosSnap = await db.collection('users').where('systemRole', '==', 'ceo').get();
        activeCeosCount = ceosSnap.docs.length;
      }

      // CEO Rules
      if (actorRank === 100) {
         if (isSelfDemotion) {
            if (activeCeosCount <= 1) return res.status(400).json({ error: 'Não é possível remover o último CEO do ecossistema.' });
         } else if (targetRank === 100) {
            return res.status(400).json({ error: 'Você não pode rebaixar, remover ou alterar o cargo de outro CEO do ecossistema.' });
         }
      } 
      // Admin Rules
      else if (actorRank === 80) {
         if (newRank > actorRank) return res.status(400).json({ error: 'Você não pode conceder um cargo acima do seu nível de acesso.' });
         if (targetRank >= actorRank && !isSelfDemotion) return res.status(400).json({ error: 'Você não pode alterar o cargo de um usuário com o mesmo ou maior nível de acesso.' });
      }

      await db.collection('users').doc(targetUserId).update({ systemRole: targetNewRole });

      // Audit Log
      await db.collection('audit_logs').add({
        actorUid,
        actorEmail: decodedToken.email,
        actorSystemRole,
        targetUid: targetUserId,
        targetEmail: targetDoc.data()?.email,
        targetPreviousRole: targetSystemRole || 'user',
        targetNewRole: targetNewRole || 'user',
        scope: 'ecosystem',
        action: isSelfDemotion ? 'role.self_downgraded' : 'role.updated',
        source: 'role_management',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API Update System Role]', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  app.post('/api/organizations/:orgId/members/:memberId/role', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const actorUid = decodedToken.uid;
      
      const { orgId, memberId } = req.params;
      const { newRole } = req.body;
      
      if (!db) return res.status(500).json({ error: 'Database not initialized' });

      // Actor global role
      const actorUserDoc = await db.collection('users').doc(actorUid).get();
      const actorSystemRole = actorUserDoc.data()?.systemRole;
      const isGlobalAdmin = actorSystemRole === 'ceo' || actorSystemRole === 'admin' || actorSystemRole === 'global_admin';

      // Actor local role
      const actorMemberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(actorUid).get();
      const actorMemberRole = actorMemberDoc.exists ? actorMemberDoc.data()?.role : 'member';
      
      // Target local role
      const targetMemberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(memberId).get();
      if (!targetMemberDoc.exists) return res.status(404).json({ error: 'Member not found' });
      const targetMemberRole = targetMemberDoc.data()?.role;

      const ORG_RANK: Record<string, number> = { guest: 5, member: 10, secretary: 20, leader: 30, admin: 70, owner: 100 };
      const actorRank = ORG_RANK[actorMemberRole || 'member'] || 0;
      const targetRank = ORG_RANK[targetMemberRole || 'member'] || 0;
      const newRank = ORG_RANK[newRole || 'member'] || 0;
      const isSelfDemotion = actorUid === memberId;

      if (!isGlobalAdmin) {
        if (actorRank < 70) return res.status(403).json({ error: 'Você não tem permissão para gerenciar funções neste nível.' });
        
        // Owner rules
        if (actorRank === 100) {
          if (isSelfDemotion) {
            const ownersSnap = await db.collection('organizations').doc(orgId).collection('members').where('role', '==', 'owner').get();
            if (ownersSnap.docs.length <= 1) return res.status(400).json({ error: 'Não é possível remover o último dono da organização.' });
          } else if (targetRank === 100) {
            return res.status(400).json({ error: 'Você não pode rebaixar ou alterar outro dono. Apenas o próprio usuário pode se rebaixar.' });
          }
        }
        // Admin rules
        else if (actorRank === 70) {
          if (newRank >= 100) return res.status(400).json({ error: 'Você não pode conceder ou alterar um cargo acima do seu nível na organização.' });
          if (targetRank >= 70 && !isSelfDemotion) return res.status(400).json({ error: 'Você não pode alterar outro administrador ou dono. Apenas donos podem alterar administradores.' });
        }
      }

      // Update Member
      const defaultPerms = newRole === 'owner' ? { "organization.manage": true, "organization.billing.manage": true, "organization.apps.manage": true, "organization.members.manage": true, "organization.audit.view": true } : 
                          (newRole === 'admin' ? { "organization.apps.manage": true, "organization.members.manage": true, "organization.audit.view": true } : {});
                          
      await db.collection('organizations').doc(orgId).collection('members').doc(memberId).set({
        role: newRole,
        organizationRole: newRole,
        permissions: defaultPerms,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION || 2
      }, { merge: true });

      // Update Legacy collection compat
      await db.collection('organization_members').doc(`${memberId}_${orgId}`).set({
        role: newRole,
        organizationRole: newRole,
        permissions: defaultPerms,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION || 2
      }, { merge: true });

      // Audit Log
      await db.collection('audit_logs').add({
        actorUid,
        actorEmail: decodedToken.email,
        actorSystemRole,
        actorOrganizationRole: actorMemberRole,
        targetUid: memberId,
        targetPreviousRole: targetMemberRole || 'member',
        targetNewRole: newRole,
        scope: 'organization',
        organizationId: orgId,
        action: isSelfDemotion ? 'role.self_downgraded' : 'role.updated',
        source: 'role_management',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API Update Org Role]', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  app.get('/api/admin/organizations', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token', message: 'Falha na validação.' });
      }

      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      if (!userRef.exists) return res.status(403).json({ error: 'Forbidden' });
      const userData = userRef.data();
      const isSystemAdmin = ['ceo', 'admin', 'global_admin'].includes(userData?.systemRole);
      if (!isSystemAdmin) {
         return res.status(403).json({ error: 'Acesso restrito' });
      }

      const orgsQuery = await db!.collection('organizations').orderBy('createdAt', 'desc').limit(200).get();
      const organizations = orgsQuery.docs.map(doc => ({
         id: doc.id,
         name: doc.data().name || 'Sem nome',
         slug: doc.data().slug || null,
         ownerUserId: doc.data().ownerUserId || doc.data().ownerUid || doc.data().ownerId || null,
         ownerEmail: doc.data().ownerEmail || null,
         ownerName: doc.data().ownerName || null,
         subscriptionPlan: doc.data().subscriptionPlan || doc.data().plan || 'free',
         subscriptionStatus: doc.data().subscriptionStatus || doc.data().status || 'none',
         createdAt: doc.data().createdAt,
         updatedAt: doc.data().updatedAt,
         apps: doc.data().apps
      }));

      return res.json({ organizations });
    } catch (err) {
      console.error('[API Admin Orgs]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Diagnósticos e Reparo Central - MillionsNest
  app.post('/api/admin/organizations/:orgId/link-owner', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decoded.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const { selectedOwnerUid, selectedOwnerEmail, selectedOwnerName } = req.body;
      if (!selectedOwnerUid || !selectedOwnerEmail) return res.status(400).json({ error: 'Missing owner details' });

      const batch = db!.batch();
      
      // Update Organization
      const orgRef = db!.collection('organizations').doc(orgId);
      batch.set(orgRef, {
        ownerUserId: selectedOwnerUid,
        ownerEmail: selectedOwnerEmail,
        ownerName: selectedOwnerName || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedBy: decoded.uid
      }, { merge: true });

      // Add to members subcollection
      const memberRef = orgRef.collection('members').doc(selectedOwnerUid);
      batch.set(memberRef, {
        uid: selectedOwnerUid,
        email: selectedOwnerEmail,
        displayName: selectedOwnerName || null,
        organizationRole: 'owner',
        role: 'owner', // legacy
        status: 'active',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedBy: decoded.uid
      }, { merge: true });

      // Update User
      const targetUserRef = db!.collection('users').doc(selectedOwnerUid);
      batch.set(targetUserRef, {
        organizationId: orgId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Audit log
      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: 'system.organization.repair.link_owner',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        targetUserId: selectedOwnerUid,
        before: {},
        after: { ownerUserId: selectedOwnerUid, ownerEmail: selectedOwnerEmail },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return res.json({ success: true });
    } catch (err) {
      console.error('[API Link Owner]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/organizations/:orgId/create-musicscale-structure', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decoded.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const batch = db!.batch();
      
      const orgRef = db!.collection('organizations').doc(orgId);
      
      // Settings
      const settingsRef = orgRef.collection('musicscale').doc('settings');
      batch.set(settingsRef, {
        repairedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedBy: decoded.uid,
        isSetupComplete: true
      }, { merge: true });

      // Default Role
      const rolesRef = orgRef.collection('musicscale').doc('settings').collection('roles').doc('default_member');
      batch.set(rolesRef, {
        id: 'default_member',
        name: 'Membro',
        permissions: ['musicscale.songs.view', 'musicscale.scales.view'],
        isDefault: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Audit log
      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: 'system.organization.repair.create_musicscale_structure',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return res.json({ success: true });
    } catch (err) {
      console.error('[API Create Structure]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/admin/debug-final-check', async (req, res) => {
     try {
         const db = admin.firestore();
         const email = req.query.email || 'pastordanielpcunha@gmail.com';
         const p = await db.collection('users').where('email', '==', email).get();
         if(p.empty) return res.json({error: "Not found"});
         const uid = p.docs[0].id;
         const userData = p.docs[0].data();

         const m = await db.collection('organization_members').where('uid', '==', uid).get();
         const legacyMemberships = m.docs.map(d => ({id: d.id, data: d.data()}));

         const context = await resolveUserOrganizationContext(uid);

         return res.json({
            uid,
            userData,
            legacyMemberships,
            context
         });
     } catch(e: any) {
         return res.status(500).json({error: e.message});
     }
  });

  app.post('/api/admin/users/:uid/create-organization', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decoded.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { uid } = req.params;
      const { organizationName, confirmCreateAdditional } = req.body;
      const targetUserRef = await db!.collection('users').doc(uid).get();
      if (!targetUserRef.exists) return res.status(404).json({ error: 'Usuário não encontrado' });
      const targetUser = targetUserRef.data() || {};
      
      // Validate existing organization context using canonical resolver to prevent duplicates
      const context = await resolveUserOrganizationContext(uid);
      
      // 1. If user has database or membership inconsistencies, force "Resolver Vínculos" route first
      if (context.needsRepair) {
         return res.status(400).json({
            error: 'inconsistency_detected',
            message: 'Inconsistências foram detectadas nos vínculos de organização deste usuário. Por favor, utilize a ferramenta "Resolver vínculos" para alinhar o usuário e suas organizações antes de efetuar qualquer criação.',
            inconsistencies: context.inconsistencies
         });
      }

      // 2. If user already has a valid organization context, block unless they explicitly confirm creating an additional one
      if (context.hasOrganization && !confirmCreateAdditional) {
         const primaryOrgId = context.primaryOrganizationId;
         const primaryOrg = context.organizations.find((o: any) => o.id === primaryOrgId);
         return res.status(400).json({
            error: 'has_organization',
            message: 'Este usuário já possui uma organização ativa e válida no MillionsNest. Para prosseguir com uma organização extra, é necessária uma confirmação explícita de "Criar organização adicional".',
            primaryOrganization: primaryOrg || null,
            requiresExplicitConfirmation: true
         });
      }

      // 3. Create the organization
      const orgRef = db!.collection('organizations').doc();
      const orgId = orgRef.id;
      const batch = db!.batch();

      const finalName = organizationName?.trim() || `Minha Organização (${targetUser.displayName || targetUser.email || 'Usuário'})`;

      batch.set(orgRef, {
        id: orgId,
        name: finalName,
        slug: `org-${orgId.substring(0, 8)}`,
        ownerUid: uid,
        ownerId: uid, // legacy compatibility
        ownerUserId: uid, // legacy compatibility
        ownerEmail: targetUser.email || null,
        ownerName: targetUser.displayName || null,
        plan: 'starter',
        subscriptionPlan: 'starter',
        status: 'active',
        subscriptionStatus: 'active',
        enabledApps: ['musicscale'],
        apps: { musicscale: { access: true, roles: ['owner'] } },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Assign Membership (canonical subcollection)
      const memberRef = orgRef.collection('members').doc(uid);
      const memberData = {
        uid: uid,
        email: targetUser.email || null,
        displayName: targetUser.displayName || null,
        organizationRole: 'owner',
        role: 'owner',
        status: 'active',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(memberRef, memberData);

      // 5. Assign Membership (legacy organization_members collection compatibility)
      const legacyMemberRef = db!.collection('organization_members').doc(`${uid}_${orgId}`);
      batch.set(legacyMemberRef, {
        uid: uid,
        organizationId: orgId,
        role: 'owner',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions('owner'),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Update User credentials and organizational tracking list
      const userUpdates: any = {
        organizations: admin.firestore.FieldValue.arrayUnion(orgId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const isAdditional = context.hasOrganization === true;
      if (!isAdditional) {
        // If it's their very first organization, define the defaults
        userUpdates.organizationId = orgId;
        userUpdates.activeOrganizationId = orgId;
        userUpdates.primaryOrganizationId = orgId;
      }
      batch.update(db!.collection('users').doc(uid), userUpdates);

      // 7. Initialize minimal contracted application structure (MusicScale)
      const settingsRef = orgRef.collection('musicscale').doc('settings');
      batch.set(settingsRef, {
        isSetupComplete: true,
        repairedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 8. Log administrative action details in server-authoritative audit logs
      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: isAdditional ? 'system.user.repair.create_additional_organization' : 'system.user.repair.create_organization',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: userData?.systemRole,
        targetUserId: uid,
        createdOrganizationId: orgId,
        isAdditionalOrganization: isAdditional,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return res.json({ success: true, organizationId: orgId, isAdditional });
    } catch (err) {
      console.error('[API Create Org for User]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/organizations/:orgId/normalize-plan', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decoded.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const orgRef = db!.collection('organizations').doc(orgId);
      const orgData = (await orgRef.get()).data() || {};
      
      // Look for a subscription to grab the proper priceId if possible
      const subRef = await db!.collection('subscriptions').doc(orgId).get();
      const sub = subRef.exists ? subRef.data() : null;
      const priceId = sub?.stripePriceId || orgData.stripePriceId || Object.keys(MUSIC_SCALE_PLANS).find(k => MUSIC_SCALE_PLANS[k].name === orgData.plan);

      const targetPlan = priceIdToMusicScalePlan(priceId);

      const updateData: any = {};
      
      updateData.subscriptionPlan = targetPlan;
      updateData.billingInterval = Object.keys(MUSIC_SCALE_PLANS).find(k => k === priceId)?.includes('yearly') ? 'yearly' : 'monthly';
      if (orgData.plan === 'MONTHLY' || orgData.plan === 'YEARLY') {
         updateData.plan = admin.firestore.FieldValue.delete();
      }

      await orgRef.update({
        ...updateData,
        repairedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedBy: decoded.uid
      });

      // Audit log
      const auditRef = db!.collection('audit_logs').doc();
      await auditRef.set({
        action: 'system.organization.repair.normalize_plan',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        before: { plan: orgData.plan || null, subscriptionPlan: orgData.subscriptionPlan || null },
        after: { subscriptionPlan: targetPlan, billingInterval: updateData.billingInterval },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true, plan: targetPlan });
    } catch (err) {
      console.error('[API Normalize Plan]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

async function repairUserIdentity(uid: string, fallback?: {
  email?: string;
  displayName?: string;
  photoURL?: string | null;
  source?: string;
}) {
  const db = getDb();
  if (!db) return;
  
  let authUser: admin.auth.UserRecord | null = null;
  try {
    authUser = await admin.auth().getUser(uid);
  } catch(e) {
    //
  }

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  let currentData = userDoc.exists ? userDoc.data()! : {};
  let changed = false;
  let updates: any = {};

  const targetEmail = authUser?.email || fallback?.email || currentData.email;
  const targetDisplayName = authUser?.displayName || fallback?.displayName || currentData.displayName || currentData.name || (targetEmail ? targetEmail.split('@')[0] : `Sem nome`);
  const targetPhoto = authUser?.photoURL || fallback?.photoURL || currentData.photoURL;

  if (targetEmail && currentData.email !== targetEmail) {
    updates.email = targetEmail;
    changed = true;
  }
  
  if (targetDisplayName && currentData.displayName !== targetDisplayName && currentData.displayName !== `Sem nome`) {
     if (!currentData.displayName || currentData.displayName === 'Sem nome' || currentData.displayName === 'Usuário') {
         updates.displayName = targetDisplayName;
         changed = true;
     }
  } else if (!currentData.displayName || currentData.displayName === 'Sem nome') {
     updates.displayName = targetDisplayName;
     changed = true;
  }

  if (targetPhoto && currentData.photoURL !== targetPhoto) {
    updates.photoURL = targetPhoto;
    changed = true;
  }

  if (!userDoc.exists) {
    updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
    updates.systemRole = 'user';
    changed = true;
  }

  if (changed) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(updates, { merge: true });
    
    // Auto-update in memberships
    if (updates.email || updates.displayName) {
       try {
          const orgsContext = await resolveUserOrganizationContext(uid);
          for (const org of orgsContext.organizations) {
             const mRef = db.collection('organizations').doc(org.id).collection('members').doc(uid);
             const mDoc = await mRef.get();
             if (mDoc.exists) {
                const dupDates: any = {};
                if (updates.email) dupDates.email = updates.email;
                if (updates.displayName) dupDates.displayName = updates.displayName;
                dupDates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                await mRef.update(dupDates);
             }
          }
       } catch(e) {
          console.error('[REPAIR_USER_MEMBERSHIPS_ERROR]', e);
       }
    }
  }
}

async function autoRepairSingleOrganizationUser(uid: string) {
    const db = getDb();
    if (!db) return;
    const context = await resolveUserOrganizationContext(uid);
    if (context.organizations.length === 1 && context.hasOrganization) {
        const orgId = context.organizations[0].id;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
           const userData = userDoc.data()!;
           const updates: any = {};
           if (userData.primaryOrganizationId !== orgId) updates.primaryOrganizationId = orgId;
           if (userData.activeOrganizationId !== orgId) updates.activeOrganizationId = orgId;
           if (userData.organizationId !== orgId) updates.organizationId = orgId; // update legacy
           if (Object.keys(updates).length > 0) {
              updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
              await userRef.update(updates);
           }
        }
    }
}

  // CANONICAL RESOLVER - MillionsNest Ecosystem Organization Context
  async function resolveUserOrganizationContext(uid: string) {
    if (!uid) {
      return {
        activeOrganizationId: null,
        primaryOrganizationId: null,
        organizations: [],
        ownedOrganizations: [],
        memberships: [],
        hasOrganization: false,
        needsRepair: false,
        inconsistencies: []
      };
    }

    const userDoc = await db!.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // 1. Fetch organizations where fluid user uid is marked as owner/creator
    const ownedQuery1 = await db!.collection('organizations').where('ownerUserId', '==', uid).get();
    const ownedQuery2 = await db!.collection('organizations').where('ownerUid', '==', uid).get();
    const ownedQuery3 = await db!.collection('organizations').where('ownerId', '==', uid).get();

    const potentialOrgIds = new Set<string>();

    if (userData) {
      if (userData.activeOrganizationId) potentialOrgIds.add(userData.activeOrganizationId);
      if (userData.primaryOrganizationId) potentialOrgIds.add(userData.primaryOrganizationId);
      if (userData.organizationId) potentialOrgIds.add(userData.organizationId);

      if (Array.isArray(userData.organizations)) {
        userData.organizations.forEach((id: any) => { if (typeof id === 'string') potentialOrgIds.add(id); });
      }
      if (Array.isArray(userData.organizationIds)) {
        userData.organizationIds.forEach((id: any) => { if (typeof id === 'string') potentialOrgIds.add(id); });
      }
      if (Array.isArray(userData.memberships)) {
        userData.memberships.forEach((m: any) => {
          if (typeof m === 'string') potentialOrgIds.add(m);
          else if (m && typeof m === 'object' && typeof m.organizationId === 'string') potentialOrgIds.add(m.organizationId);
        });
      }
    }

    // Include any legacy organization_members links the user has
    try {
      const legacyMembersSnap = await db!.collection('organization_members').where('uid', '==', uid).get();
      legacyMembersSnap.docs.forEach(doc => {
        const oId = doc.data()?.organizationId;
        if (oId && typeof oId === 'string') potentialOrgIds.add(oId);
      });
    } catch (legErr) {
      console.warn('[resolveUserOrganizationContext] Legacy members lookup bypassed:', legErr);
    }

    ownedQuery1.docs.forEach(doc => potentialOrgIds.add(doc.id));
    ownedQuery2.docs.forEach(doc => potentialOrgIds.add(doc.id));
    ownedQuery3.docs.forEach(doc => potentialOrgIds.add(doc.id));

    const organizationsMap: { [id: string]: any } = {};
    const membershipsMap: { [id: string]: any } = {};

    const orgIdsList = Array.from(potentialOrgIds);
    if (orgIdsList.length > 0) {
      const orgChunks = [];
      for (let i = 0; i < orgIdsList.length; i += 10) {
        orgChunks.push(orgIdsList.slice(i, i + 10));
      }

      for (const chunk of orgChunks) {
        const qs = await db!.collection('organizations').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        qs.docs.forEach(doc => {
          organizationsMap[doc.id] = { id: doc.id, ...doc.data() };
        });
      }
    }

    // Concurrent membership lookup directly on resolved potential organizations subcollections
    if (Object.keys(organizationsMap).length > 0) {
      const lookupPromises = Object.keys(organizationsMap).map(async (orgId) => {
        try {
          const mDoc = await db!.collection('organizations').doc(orgId).collection('members').doc(uid).get();
          if (mDoc.exists) {
            membershipsMap[orgId] = { id: uid, ...mDoc.data() };
          }
        } catch (mErr) {
          console.warn(`[resolveUserOrganizationContext] Standalone member lookup failed for org ${orgId}:`, mErr);
        }
      });
      await Promise.all(lookupPromises);
    }

    const finalOrganizations: any[] = [];
    const ownedOrganizations: any[] = [];
    let inconsistencies: string[] = [];
    let needsRepair = false;

    for (const orgId of Object.keys(organizationsMap)) {
      const org = organizationsMap[orgId];
      if (!membershipsMap[orgId]) {
        const isOwner = org.ownerUserId === uid || org.ownerUid === uid || org.ownerId === uid;
        if (isOwner) {
          needsRepair = true;
          inconsistencies.push(`Usuário é dono da organização ${org.name || 'Sem nome'} (${orgId}) mas não possui documento de membro.`);
        }
      }
    }

    for (const orgId of Object.keys(organizationsMap)) {
      const org = organizationsMap[orgId];
      const membership = membershipsMap[orgId];
      const isOwner = org.ownerUserId === uid || org.ownerUid === uid || org.ownerId === uid || membership?.role === 'owner' || membership?.organizationRole === 'owner';

      const orgItem = {
        id: orgId,
        name: org.name || 'Sem nome',
        slug: org.slug || null,
        ownerUserId: org.ownerUserId || org.ownerUid || org.ownerId || null,
        ownerEmail: org.ownerEmail || null,
        ownerName: org.ownerName || null,
        subscriptionPlan: org.subscriptionPlan || org.plan || 'free',
        subscriptionStatus: org.subscriptionStatus || org.status || 'none',
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        apps: org.apps,
        userRole: membership?.role || membership?.organizationRole || (isOwner ? 'owner' : null),
        status: org.status || 'active',
        membership: membership || null
      };

      finalOrganizations.push(orgItem);
      if (isOwner) {
        ownedOrganizations.push(orgItem);
      }
    }

    const activeOrgsList = finalOrganizations.filter(o => o.status !== 'archived');

    finalOrganizations.sort((a, b) => {
      const roleWeight = (r: string | null) => r === 'owner' ? 3 : r === 'admin' ? 2 : r === 'member' ? 1 : 0;
      const diff = roleWeight(b.userRole) - roleWeight(a.userRole);
      if (diff !== 0) return diff;
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    let activeOrganizationId: string | null = null;
    let primaryOrganizationId: string | null = null;

    let uidUsedAsOrganizationIdSuspected = false;
    if (organizationsMap[uid] && organizationsMap[uid].status !== 'archived' && !organizationsMap[uid].archived) {
      uidUsedAsOrganizationIdSuspected = true;
      inconsistencies.push('SUSPEITA: Organização com ID igual ao UID do usuário identificada.');
    }

    if (userData) {
      // Prioridade 1: activeOrganizationId, se existir e não arquivada
      if (userData.activeOrganizationId && organizationsMap[userData.activeOrganizationId] && organizationsMap[userData.activeOrganizationId].status !== 'archived') {
        activeOrganizationId = userData.activeOrganizationId;
      }
      
      // Prioridade 2: primaryOrganizationId, se existir e não arquivada
      if (userData.primaryOrganizationId && organizationsMap[userData.primaryOrganizationId] && organizationsMap[userData.primaryOrganizationId].status !== 'archived') {
        primaryOrganizationId = userData.primaryOrganizationId;
      }

      // Se a ativa não é válida mas a primária é, fallback para a primária
      if (!activeOrganizationId && primaryOrganizationId) {
        activeOrganizationId = primaryOrganizationId;
      }

      // Fallback legado apenas se não houver ativo/primário ainda
      if (!activeOrganizationId && !primaryOrganizationId && userData.organizationId && organizationsMap[userData.organizationId] && organizationsMap[userData.organizationId].status !== 'archived') {
        activeOrganizationId = userData.organizationId;
        primaryOrganizationId = userData.organizationId;
        needsRepair = true;
        inconsistencies.push('Usando organizationId legado como fallback.');
      }
    }

    if (activeOrgsList.length > 0) {
      if (!primaryOrganizationId) {
        // Fallbacks se usuário tem organizações mas não tem primária definida
        const ownerOrg = activeOrgsList.find(o => o.userRole === 'owner');
        const memberOrg = activeOrgsList.find(o => o.membership != null);
        
        primaryOrganizationId = (ownerOrg || memberOrg || activeOrgsList[0]).id;
        activeOrganizationId = primaryOrganizationId;
        needsRepair = true;
        if (!uidUsedAsOrganizationIdSuspected) {
           inconsistencies.push('Vínculo primário canonical ausente. Fallback provisório assumido base nas organizações ativas.');
        }
      }
    } else {
      // Nenhuma organização ativa/acessível -> contexto vazio e pedir reparo
      primaryOrganizationId = null;
      activeOrganizationId = null;
    }

    if (userData) {
      if (activeOrganizationId && userData.organizationId !== activeOrganizationId) {
        needsRepair = true;
        inconsistencies.push('userData.organizationId legado está desalinhado.');
      }
      if (activeOrganizationId && !userData.activeOrganizationId) {
        needsRepair = true;
      }
      if (primaryOrganizationId && !userData.primaryOrganizationId) {
        needsRepair = true;
      }
    }

    const hasOrganization = activeOrganizationId !== null;

    let currentOrganizationId = activeOrganizationId;
    let currentOrganization = null;
    let roleInCurrentOrganization = null;
    if (currentOrganizationId) {
       currentOrganization = finalOrganizations.find(o => o.id === currentOrganizationId) || null;
       roleInCurrentOrganization = currentOrganization?.userRole || null;
    }

    // AUTO-HEAL: If exactly one active organization exists and primary/active is missing or need repair
    let canAutoRepair = false;
    let autoRepaired = false;
    if (finalOrganizations.length === 1 && !uidUsedAsOrganizationIdSuspected && hasOrganization) {
       canAutoRepair = true;
       // We can trigger background fix
       const fixedOrgId = finalOrganizations[0].id;
       const userDocRef = db.collection('users').doc(uid);
       if (needsRepair && userData) {
          try {
             const updates: any = {};
             if (userData.primaryOrganizationId !== fixedOrgId) updates.primaryOrganizationId = fixedOrgId;
             if (userData.activeOrganizationId !== fixedOrgId) updates.activeOrganizationId = fixedOrgId;
             if (userData.organizationId !== fixedOrgId) updates.organizationId = fixedOrgId;
             
             if (Object.keys(updates).length > 0) {
                 await userDocRef.update({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                 console.log(`[AUTO-HEAL] Fixed single organization context for user ${uid}.`);
                 
                 // Update local state to reflect fix immediately
                 primaryOrganizationId = fixedOrgId;
                 activeOrganizationId = fixedOrgId;
                 
                 // Re-check inconsistencies
                 inconsistencies = inconsistencies.filter(i => !i.includes('primário canonical ausente'));
                 inconsistencies = inconsistencies.filter(i => !i.includes('desalinhado'));
                 needsRepair = inconsistencies.length > 0;
                 autoRepaired = true;
             }
          } catch(e) {
             console.error('[AUTO-HEAL ERROR]', e);
          }
       }
    }

    return {
      uid,
      activeOrganizationId,
      primaryOrganizationId,
      currentOrganizationId,
      currentOrganization,
      organizations: activeOrgsList,
      ownedOrganizations: ownedOrganizations.filter((o: any) => o.status !== 'archived' && o.archived !== true),
      memberships: Object.values(membershipsMap),
      roleInCurrentOrganization,
      hasOrganization,
      hasMultipleOrganizations: activeOrgsList.length > 1,
      needsRepair,
      inconsistencies,
      uidUsedAsOrganizationIdSuspected,
      rawContext: {
         primaryOrganizationId: userData?.primaryOrganizationId || null,
         activeOrganizationId: userData?.activeOrganizationId || null,
         legacyOrganizationId: userData?.organizationId || null
      }
    };
  }

  // 1. Get detailed user diagnostics
  app.get('/api/admin/users/:uid/diagnostics', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const userSnap = await db!.collection('users').doc(decoded.uid).get();
      const userDataCheck = userSnap.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userDataCheck?.systemRole || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { uid } = req.params;
      
      // Auto-heal operations BEFORE context resolution
      await repairUserIdentity(uid);
      await autoRepairSingleOrganizationUser(uid);

      const context = await resolveUserOrganizationContext(uid);
      const userSnapResolved = await db!.collection('users').doc(uid).get();
      const userData = userSnapResolved.data() || {};

      const enhancedOrgs = await Promise.all(context.organizations.map(async (org: any) => {
        const songsCountSnap = await db!.collection('songs').where('organizationId', '==', org.id).get();
        const scalesCountSnap = await db!.collection('scales').where('organizationId', '==', org.id).get();
        const membersCountSnap = await db!.collection('organizations').doc(org.id).collection('members').get();
        const invitesCountSnap = await db!.collection('organizations').doc(org.id).collection('invites').get();

        return {
          ...org,
          songsCount: songsCountSnap.size,
          scalesCount: scalesCountSnap.size,
          membersCount: membersCountSnap.size,
          invitesCount: invitesCountSnap.size
        };
      }));

      // Fetch Audit Logs for this user
      const auditLogsSnap = await db!.collection('audit_logs').where('targetUserUid', '==', uid).orderBy('timestamp', 'desc').limit(20).get();
      const auditLogs = auditLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch Pending Invites via collectionGroup
      let pendingInvites: any[] = [];
      if (userData.email) {
        const invitesSnap = await db!.collectionGroup('invites').where('email', '==', userData.email).where('status', '==', 'pending').get();
        pendingInvites = invitesSnap.docs.map(doc => {
           // We can get organizationId from document reference path: organizations/{orgId}/invites/{inviteId}
           const orgId = doc.ref.parent.parent?.id;
           return { id: doc.id, organizationId: orgId, ...doc.data() };
        });
      }

      return res.json({
        ...context,
        user: { ...userData, uid },
        organizations: enhancedOrgs,
        auditLogs,
        pendingInvites
      });
    } catch (e: any) {
      console.error('[API User Diagnostics]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 2. Define primary organization
  app.post('/api/admin/users/:uid/set-primary-organization', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const actorSnap = await db!.collection('users').doc(decoded.uid).get();
      const actorData = actorSnap.data();
      if (!['ceo', 'admin', 'global_admin'].includes(actorData?.systemRole || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { uid } = req.params;
      const { organizationId } = req.body;
      if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

      const targetUserRef = db!.collection('users').doc(uid);
      const targetUserSnap = await targetUserRef.get();
      if (!targetUserSnap.exists) return res.status(404).json({ error: 'User not found' });
      const targetUser = targetUserSnap.data() || {};

      const orgRef = db!.collection('organizations').doc(organizationId);
      const orgSnap = await orgRef.get();
      if (!orgSnap.exists) return res.status(404).json({ error: 'Organization not found' });
      const orgData = orgSnap.data() || {};

      const beforeUser = {
        organizationId: targetUser.organizationId || null,
        activeOrganizationId: targetUser.activeOrganizationId || null,
        primaryOrganizationId: targetUser.primaryOrganizationId || null
      };

      const beforeOrg = {
        ownerUserId: orgData.ownerUserId || null,
        ownerEmail: orgData.ownerEmail || null,
        ownerName: orgData.ownerName || null
      };

      const batch = db!.batch();

      batch.update(targetUserRef, {
        organizationId: organizationId,
        activeOrganizationId: organizationId,
        primaryOrganizationId: organizationId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const orgUpdate: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      let isOwner = false;
      if (orgData.ownerUid === uid || orgData.ownerUserId === uid || orgData.ownerId === uid) {
         isOwner = true;
      } else if (!orgData.ownerUid && !orgData.ownerUserId && !orgData.ownerId) {
        orgUpdate.ownerUserId = uid;
        orgUpdate.ownerUid = uid;
        orgUpdate.ownerId = uid;
        orgUpdate.ownerEmail = targetUser.email || null;
        orgUpdate.ownerName = targetUser.displayName || null;
        isOwner = true;
      }
      
      if (Object.keys(orgUpdate).length > 1) {
         batch.set(orgRef, orgUpdate, { merge: true });
      }

      const memberRef = orgRef.collection('members').doc(uid);
      batch.set(memberRef, {
        uid: uid,
        email: targetUser.email || null,
        displayName: targetUser.displayName || null,
        organizationRole: isOwner ? 'owner' : 'member',
        role: isOwner ? 'owner' : 'member',
        status: 'active',
        joinedAt: orgData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const legacyMemberRef = db!.collection('organization_members').doc(`${uid}_${organizationId}`);
      batch.set(legacyMemberRef, {
        uid: uid,
        role: isOwner ? 'owner' : 'member',
        status: 'active'
      }, { merge: true });

      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: 'system.user.set_primary_organization',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: actorData?.systemRole,
        targetUserId: uid,
        organizationId: organizationId,
        before: { user: beforeUser, org: beforeOrg },
        after: {
          user: {
            organizationId,
            activeOrganizationId: organizationId,
            primaryOrganizationId: organizationId
          },
          org: {
            ownerUserId: uid,
            ownerEmail: targetUser.email || null,
            ownerName: targetUser.displayName || null
          }
        },
        source: "millionsnest_ecosystem_console",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return res.json({ success: true, activeOrganizationId: organizationId });
    } catch (e: any) {
      console.error('[API Set Primary Org]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  app.post('/api/admin/ecosystem/backfill-users', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      const actorRole = actorDoc.data()?.systemRole;
      if (!['ceo', 'global_admin'].includes(actorRole)) {
        return res.status(403).json({ error: 'Forbidden. Required ceo/global_admin' });
      }

      console.log('[BACKFILL START] Triggered by', decoded.uid);
      const results = {
         totalChecked: 0,
         missingEmailInAuth: 0,
         identitiesRepaired: 0,
         contextsPersisted: 0,
         legacyRemoved: 0,
         membershipsRepaired: 0,
         needsOrgIdMigration: 0,
         errors: [] as string[]
      };

      const usersSnap = await db!.collection('users').get();
      results.totalChecked = usersSnap.size;

      for (const uDoc of usersSnap.docs) {
         try {
            const uid = uDoc.id;
            let userData = uDoc.data();
            
            // 1. Identity
            let authUser = await admin.auth().getUser(uid).catch(() => null);
            if (!authUser || !authUser.email) {
                results.missingEmailInAuth++;
            }
            if (authUser && (!userData.email || !userData.displayName || userData.displayName === 'Sem nome')) {
                await repairUserIdentity(uid);
                results.identitiesRepaired++;
                userData = (await db!.collection('users').doc(uid).get()).data() || userData;
            }

            // Resolve context to find repairs needed
            const context = await resolveUserOrganizationContext(uid);
            
            // Org ID = UID check
            if (context.uidUsedAsOrganizationIdSuspected) {
               results.needsOrgIdMigration++;
            }

            if (context.hasOrganization && context.organizations.length === 1) {
               const orgId = context.organizations[0].id;
               
               // Persist primary
               if (userData.primaryOrganizationId !== orgId) {
                   await db!.collection('users').doc(uid).update({ primaryOrganizationId: orgId, activeOrganizationId: orgId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                   results.contextsPersisted++;
               }

               // Remove Legacy field
               if (userData.organizationId === orgId) {
                   await db!.collection('users').doc(uid).update({ organizationId: admin.firestore.FieldValue.delete() });
                   results.legacyRemoved++;
               }

               // Repair Membership
               const memberRef = db!.collection('organizations').doc(orgId).collection('members').doc(uid);
               const memberDoc = await memberRef.get();
               if (!memberDoc.exists || !memberDoc.data()?.email || !memberDoc.data()?.displayName || memberDoc.data()?.displayName === 'Sem nome') {
                   await memberRef.set({
                       uid,
                       email: authUser?.email || userData.email || null,
                       displayName: authUser?.displayName || userData.displayName || 'Usuário Sem Nome',
                       role: "owner",
                       organizationRole: "owner",
                       status: "active",
                       joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                       updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                       permissions: getDefaultPermissions("owner"),
                       permissionsVersion: CURRENT_PERMISSIONS_VERSION
                   }, { merge: true });
                   results.membershipsRepaired++;
               }
            }
         } catch(e: any) {
            results.errors.push(`UID ${uDoc.id}: ${e.message}`);
         }
      }

      console.log('[BACKFILL END]', results);
      return res.json({ success: true, results });
    } catch (e: any) {
      console.error('[API Ecosystem Backfill]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  app.post('/api/admin/users/:uid/repair-identity', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      
      const authUser = await admin.auth().getUser(uid).catch(() => null);
      if (!authUser) return res.status(404).json({ error: 'User not found in Auth' });

      const userRef = db!.collection('users').doc(uid);
      const userDocBefore = await userRef.get();
      const beforeData = userDocBefore.data() || {};

      const email = authUser.email || beforeData.email;
      const displayName = authUser.displayName || beforeData.displayName || beforeData.name || (email ? email.split('@')[0] : 'Usuário Sem Nome');
      const photoURL = authUser.photoURL || beforeData.photoURL || null;

      await userRef.set({
        email,
        displayName,
        name: displayName,
        photoURL,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        identityRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
        identityRepairSource: "firebase_auth_admin"
      }, { merge: true });

      // Update memberships explicitly via resolved orgs (no collectionGroup index needed)
      const context = await resolveUserOrganizationContext(uid);
      for (const org of context.organizations) {
          const mRef = db!.collection('organizations').doc(org.id).collection('members').doc(uid);
          await mRef.set({ email, displayName, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }

      const userDocAfter = await userRef.get();
      const afterData = userDocAfter.data() || {};

      const didChange = beforeData.email !== afterData.email || beforeData.displayName !== afterData.displayName;

      return res.json({ success: true, changed: didChange, steps: { identity: { success: true, changed: didChange, before: beforeData, after: afterData } } });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/persist-primary-organization', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      const { organizationId } = req.body;
      if (!organizationId) return res.status(400).json({ error: 'organizationId required'});

      const userRef = db!.collection('users').doc(uid);
      const userDocBefore = await userRef.get();
      const beforePrimary = userDocBefore.data()?.primaryOrganizationId;

      await userRef.set({
        primaryOrganizationId: organizationId,
        activeOrganizationId: organizationId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        primaryOrganizationRepairedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const userDocAfter = await userRef.get();
      const afterPrimary = userDocAfter.data()?.primaryOrganizationId;

      return res.json({ success: true, changed: beforePrimary !== afterPrimary });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/remove-legacy-organization-field', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      const userRef = db!.collection('users').doc(uid);
      
      const beforeData = (await userRef.get()).data() || {};
      const beforeLegacy = beforeData.organizationId;

      if (beforeLegacy === uid) {
         return res.json({ success: true, changed: false, message: 'Cannot remove legacy when OrgID=UID. Migrate first.' });
      }

      if (beforeLegacy) {
         await userRef.update({
            organizationId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
         });
      }

      const afterData = (await userRef.get()).data() || {};
      
      return res.json({ success: true, changed: !!beforeLegacy && !afterData.organizationId });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/repair-membership', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      const { organizationId } = req.body;
      if (!organizationId) return res.status(400).json({ error: 'organizationId required'});

      const userDoc = await db!.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};
      const email = userData.email || null;
      const displayName = userData.displayName || 'Usuário Sem Nome';

      const memberRef = db!.collection('organizations').doc(organizationId).collection('members').doc(uid);
      const beforeDoc = await memberRef.get();
      const beforeExists = beforeDoc.exists;

      await memberRef.set({
        uid,
        email,
        displayName,
        role: beforeDoc.data()?.role || "owner",
        organizationRole: beforeDoc.data()?.organizationRole || "owner",
        status: "active",
        joinedAt: beforeDoc.data()?.joinedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        permissions: beforeDoc.data()?.permissions || getDefaultPermissions("owner"),
        permissionsVersion: beforeDoc.data()?.permissionsVersion || CURRENT_PERMISSIONS_VERSION
      }, { merge: true });

      const afterDoc = await memberRef.get();

      return res.json({ success: true, changed: !beforeExists || beforeDoc.data()?.displayName !== afterDoc.data()?.displayName });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/change-active-org', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      const { organizationId } = req.body;
      if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

      const orgRef = db!.collection('organizations').doc(organizationId);
      const orgDoc = await orgRef.get();
      if (!orgDoc.exists) {
         return res.status(404).json({ error: 'Organization does not exist.' });
      }

      const userRef = db!.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User does not exist.' });

      const oldContext = userDoc.data()!;
      
      const updates = {
         activeOrganizationId: organizationId,
         primaryOrganizationId: typeof oldContext.primaryOrganizationId === 'string' ? oldContext.primaryOrganizationId : organizationId,
         organizationId: organizationId, // legacy fallback safety
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userRef.update(updates);

      // Audit Log
      await db!.collection('audit_logs').add({
         action: 'system.tenant.change_active',
         adminUid: decoded.uid,
         targetUserUid: uid,
         oldOrganizationId: oldContext.activeOrganizationId || null,
         newOrganizationId: organizationId,
         timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true, message: 'Current Active Organization successfully changed.' });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Global Migration Endpoint for Roles and Permissions
  app.post('/api/admin/roles-migration', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const batchLimit = 300;
      let migratedCount = 0;
      
      const orgsSnap = await db!.collection('organizations').get();
      const orgIds = orgsSnap.docs.map(d => d.id);

      for (const orgId of orgIds) {
         let currentBatch = db!.batch();
         let operationsCount = 0;

         const membersSnap = await db!.collection('organizations').doc(orgId).collection('members').get();
         
         for (const docSnap of membersSnap.docs) {
             const data = docSnap.data();
             let needsUpdate = false;
             const updates: any = {};

             // Identifica estrutura de papel antiga no campo role (as vezes preenchido com ministry_function)
             const validOrgRoles = ['owner', 'admin', 'leader', 'secretary', 'member', 'guest', 'visitor'];
             const oldRoleStr = (data.role || 'member').toLowerCase();
             
             let resolvedOrgRole = validOrgRoles.includes(oldRoleStr) ? oldRoleStr : 'member';
             
             // Se o role antigo não era uma das orgRoles validas, era ministry function (ex: 'guitar')
             if (!validOrgRoles.includes(oldRoleStr)) {
                 updates.ministryFunction = data.ministryFunction || oldRoleStr;
             }

             if (data.organizationRole !== resolvedOrgRole) {
                 updates.organizationRole = resolvedOrgRole;
                 needsUpdate = true;
             }

             if (data.role !== resolvedOrgRole) {
                 updates.role = resolvedOrgRole;
                 needsUpdate = true;
             }

             // Initialize MusicScale specific role
             if (!data.musicscaleRole) {
                 let msRole = 'member';
                 if (['owner', 'admin'].includes(resolvedOrgRole)) msRole = 'admin';
                 else if (resolvedOrgRole === 'leader') msRole = 'leader';
                 else if (resolvedOrgRole === 'guest' || resolvedOrgRole === 'visitor') msRole = 'viewer';
                 
                 updates.musicscaleRole = msRole;
                 needsUpdate = true;
             }

             if (needsUpdate) {
                 currentBatch.update(docSnap.ref, updates);
                 
                 const legacyRef = db!.collection('organization_members').doc(`${docSnap.id}_${orgId}`);
                 currentBatch.set(legacyRef, updates, { merge: true });

                 operationsCount += 2;
                 migratedCount++;

                 if (operationsCount >= batchLimit) {
                     await currentBatch.commit();
                     currentBatch = db!.batch();
                     operationsCount = 0;
                 }
             }
         }

         if (operationsCount > 0) {
             await currentBatch.commit();
         }
      }

      await db!.collection('audit_logs').add({
         action: 'system.roles.migration',
         adminUid: decoded.uid,
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
         details: `Migrated ${migratedCount} members to new role structure.`
      });

      return res.json({ success: true, migratedCount });
    } catch (e: any) {
      console.error('Migration failed:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/remove-membership', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

      const { uid } = req.params;
      const { organizationId } = req.body;
      if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

      const batch = db!.batch();

      const memberRef = db!.collection('organizations').doc(organizationId).collection('members').doc(uid);
      batch.delete(memberRef);

      const legacyMemberRef = db!.collection('organization_members').doc(`${uid}_${organizationId}`);
      batch.delete(legacyMemberRef);

      await batch.commit();

      // Audit Log
      await db!.collection('audit_logs').add({
         action: 'system.tenant.remove_membership',
         adminUid: decoded.uid,
         targetUserUid: uid,
         organizationId: organizationId,
         timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true, message: 'Membership removed successfully.' });
    } catch(e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:uid/auto-repair', express.json(), async (req: any, res) => {
     try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
        const actorDoc = await db!.collection('users').doc(decoded.uid).get();
        if (!['ceo', 'global_admin'].includes(actorDoc.data()?.systemRole)) return res.status(403).json({ error: 'Forbidden' });

        const { uid } = req.params;
        const { organizationId: inputOrgId } = req.body;

        const results = {
           success: false,
           changed: false,
           steps: {} as any
        };

        const userRef = db!.collection('users').doc(uid);
        const beforeUserDoc = await userRef.get();
        const beforeUserData = beforeUserDoc.data() || {};
        const beforePrimary = beforeUserData.primaryOrganizationId;
        const beforeLegacy = beforeUserData.organizationId;
        
        // 1. Repair Identity manually
        const authUser = await admin.auth().getUser(uid).catch(() => null);
        const email = authUser?.email || beforeUserData.email;
        const displayName = authUser?.displayName || beforeUserData.displayName || beforeUserData.name || (email ? email.split('@')[0] : 'Usuário Sem Nome');
        
        await userRef.set({
           email,
           displayName,
           name: displayName,
           photoURL: authUser?.photoURL || beforeUserData.photoURL || null,
           identityRepairedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const midUserData = (await userRef.get()).data() || {};
        results.steps.identity = { 
           success: true, 
           changed: beforeUserData.email !== midUserData.email || beforeUserData.displayName !== midUserData.displayName,
           before: { email: beforeUserData.email, displayName: beforeUserData.displayName },
           after: { email: midUserData.email, displayName: midUserData.displayName }
        };

        // 2. Persist Primary Org
        let workingOrgId = inputOrgId;
        if (!workingOrgId) {
            const context = await resolveUserOrganizationContext(uid);
            if (context.hasOrganization && context.organizations.length === 1) {
                workingOrgId = context.organizations[0].id;
            } else if (midUserData.activeOrganizationId) {
                workingOrgId = midUserData.activeOrganizationId;
            }
        }

        if (workingOrgId) {
           await userRef.set({
               primaryOrganizationId: workingOrgId,
               activeOrganizationId: workingOrgId,
               primaryOrganizationRepairedAt: admin.firestore.FieldValue.serverTimestamp()
           }, { merge: true });
           
           results.steps.primaryOrganization = {
               success: true,
               changed: beforePrimary !== workingOrgId,
               before: beforePrimary,
               after: workingOrgId
           };

           // 3. Repair Membership
           const memRef = db!.collection('organizations').doc(workingOrgId).collection('members').doc(uid);
           const beforeMemDoc = await memRef.get();
           const beforeMemExists = beforeMemDoc.exists;

           await memRef.set({
               uid,
               email,
               displayName,
               role: beforeMemDoc.data()?.role || "owner",
               organizationRole: beforeMemDoc.data()?.organizationRole || "owner",
               status: "active",
               joinedAt: beforeMemDoc.data()?.joinedAt || admin.firestore.FieldValue.serverTimestamp(),
               updatedAt: admin.firestore.FieldValue.serverTimestamp(),
               permissions: beforeMemDoc.data()?.permissions || getDefaultPermissions("owner"),
               permissionsVersion: beforeMemDoc.data()?.permissionsVersion || CURRENT_PERMISSIONS_VERSION
           }, { merge: true });

           results.steps.membership = {
               success: true,
               changed: !beforeMemExists || beforeMemDoc.data()?.email !== email,
               beforeExists: beforeMemExists,
               afterExists: true
           };
        } else {
           results.steps.primaryOrganization = { success: false, error: 'No orgId resolvable' };
           results.steps.membership = { success: false, error: 'No orgId resolvable' };
        }

        // 4. Remove Legacy
        if (beforeLegacy) {
           if (beforeLegacy === uid) {
               results.steps.legacyOrganizationId = { success: true, changed: false, error: 'Cannot remove when legacy=uid' };
           } else {
               await userRef.update({
                   organizationId: admin.firestore.FieldValue.delete(),
                   updatedAt: admin.firestore.FieldValue.serverTimestamp()
               });
               results.steps.legacyOrganizationId = { success: true, changed: true, before: beforeLegacy, after: null };
           }
        } else {
           results.steps.legacyOrganizationId = { success: true, changed: false, before: null, after: null };
        }

        const afterUserDoc = await userRef.get();
        const afterUserData = afterUserDoc.data() || {};
        
        results.changed = JSON.stringify(beforeUserData) !== JSON.stringify(afterUserData);
        results.success = true;

        return res.json(results);
     } catch(e: any) {
        return res.status(500).json({ error: e.message });
     }
  });

  app.post('/api/admin/organizations/:orgId/migrate-uid-id', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const actorDoc = await db!.collection('users').doc(decoded.uid).get();
      const actorRole = actorDoc.data()?.systemRole;
      if (!['ceo', 'global_admin'].includes(actorRole)) {
        return res.status(403).json({ error: 'Forbidden. Required ceo/global_admin' });
      }

      const originalOrgId = req.params.orgId;
      const orgRef = db!.collection('organizations').doc(originalOrgId);
      const orgDoc = await orgRef.get();

      if (!orgDoc.exists) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const orgData = orgDoc.data();
      const ownerUid = orgData?.ownerUid || orgData?.ownerUserId || orgData?.ownerId;
      
      if (!ownerUid) {
         return res.status(400).json({ error: 'Cannot migrate org without owner defined.' });
      }

      // ONLY allow if original org ID strictly equals the owner's UID
      if (originalOrgId !== ownerUid) {
        return res.status(400).json({ error: 'Org ID does not match owner UID. Migration strictly prohibited.' });
      }

      const newOrgRef = db!.collection('organizations').doc();
      const newOrgId = newOrgRef.id;

      const subRef = db!.collection('subscriptions').doc(originalOrgId);
      const subDoc = await subRef.get();
      const newSubRef = db!.collection('subscriptions').doc(newOrgId);

      const batch = db!.batch();

      // Duplicate org doc
      const newOrgData = { ...orgData, id: newOrgId, slug: newOrgId, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      batch.set(newOrgRef, newOrgData);
      
      // Duplicate subscription if exists
      if (subDoc.exists) {
         batch.set(newSubRef, { ...subDoc.data(), organizationId: newOrgId });
      }

      // Update the user's document contexts
      const userRef = db!.collection('users').doc(ownerUid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const u = userDoc.data()!;
        const updates: any = {};
        if (u.organizationId === originalOrgId) updates.organizationId = newOrgId;
        if (u.primaryOrganizationId === originalOrgId) updates.primaryOrganizationId = newOrgId;
        if (u.activeOrganizationId === originalOrgId) updates.activeOrganizationId = newOrgId;
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.update(userRef, updates);
      }

      // Archive old organization
      batch.update(orgRef, {
        status: 'archived',
        archived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedTo: newOrgId
      });

      // Archive old subscription if it exists
      if (subDoc.exists) {
         batch.update(subRef, { status: 'canceled', archived: true });
      }

      // Re-create the membership
      const newMemberRef = newOrgRef.collection('members').doc(ownerUid);
      batch.set(newMemberRef, {
        uid: ownerUid,
        email: userDoc.data()?.email || null,
        displayName: userDoc.data()?.displayName || null,
        organizationRole: 'owner',
        role: 'owner',
        status: 'active',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION || 2,
        permissions: getDefaultPermissions('owner'),
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Legacy member
      batch.set(db!.collection('organization_members').doc(`${ownerUid}_${newOrgId}`), {
        uid: ownerUid,
        organizationId: newOrgId,
        role: 'owner',
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Delete the old org and sub to strictly avoid multi-tenant collision
      // Instead, we archive it
      batch.update(orgRef, {
         status: 'archived',
         archived: true,
         archivedAt: admin.firestore.FieldValue.serverTimestamp(),
         migratedToOrgId: newOrgId
      });
      if (subDoc.exists) batch.update(subRef, {
         status: 'migrated',
         migratedToOrgId: newOrgId,
         archivedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const aliasRef = db!.collection('organization_aliases').doc(originalOrgId);
      batch.set(aliasRef, {
         oldOrgId: originalOrgId,
         newOrgId: newOrgId,
         reason: "UID_EQUALS_ORG_ID",
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: 'system.organization.migrate_uid_clash',
        actorUid: decoded.uid,
        targetUserId: ownerUid,
        oldOrganizationId: originalOrgId,
        newOrganizationId: newOrgId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // --- 2. MIGRATE DATA (SONGS, SCALES) ---
      let batch2 = db!.batch();
      let operationCount = 0;
      
      const commitBatchIfFull = async () => {
          if (operationCount >= 400) {
              await batch2.commit();
              batch2 = db!.batch();
              operationCount = 0;
          }
      };

      const songsSnap = await db!.collection('songs').where('organizationId', '==', originalOrgId).get();
      for (const doc of songsSnap.docs) {
          batch2.update(doc.ref, { organizationId: newOrgId, migratedFromOrg: originalOrgId });
          operationCount++;
          await commitBatchIfFull();
      }

      const scalesSnap = await db!.collection('scales').where('organizationId', '==', originalOrgId).get();
      for (const doc of scalesSnap.docs) {
          batch2.update(doc.ref, { organizationId: newOrgId, migratedFromOrg: originalOrgId });
          operationCount++;
          await commitBatchIfFull();
      }

      // --- 3. MIGRATE SUBCOLLECTIONS (MEMBERS, INVITES) ---
      const membersSnap = await orgRef.collection('members').get();
      for (const doc of membersSnap.docs) {
          if (doc.id === ownerUid) continue; // already created owner
          const newMemRef = newOrgRef.collection('members').doc(doc.id);
          batch2.set(newMemRef, doc.data());
          batch2.delete(doc.ref);
          operationCount += 2;
          await commitBatchIfFull();
      }

      const invitesSnap = await orgRef.collection('invites').get();
      for (const doc of invitesSnap.docs) {
          const newInvRef = newOrgRef.collection('invites').doc(doc.id);
          batch2.set(newInvRef, { ...doc.data(), organizationId: newOrgId });
          batch2.delete(doc.ref);
          operationCount += 2;
          await commitBatchIfFull();
      }

      if (operationCount > 0) {
          await batch2.commit();
      }

      return res.json({ success: true, migratedTo: newOrgId });
    } catch (e: any) {
      console.error('[API Migrate Org UID Clash]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 3. Check emptiness
  app.get('/api/admin/organizations/:orgId/check-empty', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const userSnap = await db!.collection('users').doc(decoded.uid).get();
      const userData = userSnap.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const songsCountSnap = await db!.collection('songs').where('organizationId', '==', orgId).get();
      const scalesCountSnap = await db!.collection('scales').where('organizationId', '==', orgId).get();
      const membersCountSnap = await db!.collection('organizations').doc(orgId).collection('members').get();
      const invitesCountSnap = await db!.collection('organizations').doc(orgId).collection('invites').get();

      const orgDoc = await db!.collection('organizations').doc(orgId).get();
      const orgData = orgDoc.exists ? orgDoc.data() : null;

      const subDoc = await db!.collection('subscriptions').doc(orgId).get();
      const subData = subDoc.exists ? subDoc.data() : null;

      const songsCount = songsCountSnap.size;
      const scalesCount = scalesCountSnap.size;
      const membersCount = membersCountSnap.size;
      const invitesCount = invitesCountSnap.size;

      const hasActiveSubscription = (subData?.status === 'active' || (orgData?.subscriptionStatus === 'active') && (orgData?.plan !== 'free'));
      const isSafeToArchive = (songsCount === 0 && scalesCount === 0 && membersCount <= 1);

      return res.json({
        songsCount,
        scalesCount,
        membersCount,
        invitesCount,
        hasActiveSubscription,
        isSafeToArchive,
        orgName: orgData?.name || 'Sem nome'
      });
    } catch (e: any) {
      console.error('[API Check Empty]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 4. Archive/delete
  app.post('/api/admin/organizations/:orgId/archive-or-delete', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const actorSnap = await db!.collection('users').doc(decoded.uid).get();
      const actorData = actorSnap.data();
      if (!['ceo', 'admin', 'global_admin'].includes(actorData?.systemRole || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const { action } = req.body; 
      if (!['archive', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

      const orgRef = db!.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      if (!orgSnap.exists) return res.status(404).json({ error: 'Organization not found' });
      const orgData = orgSnap.data() || {};

      const batch = db!.batch();

      if (action === 'archive') {
        batch.update(orgRef, {
          status: 'archived',
          archived: true,
          subscriptionStatus: 'archived',
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          archivedBy: decoded.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // TAREFA 6: Limpar usuário de ter essa org como ativa/primária
        const usersToUpdate = new Set<string>();
        
        const q1 = await db!.collection('users').where('activeOrganizationId', '==', orgId).get();
        q1.docs.forEach(d => usersToUpdate.add(d.id));
        
        const q2 = await db!.collection('users').where('primaryOrganizationId', '==', orgId).get();
        q2.docs.forEach(d => usersToUpdate.add(d.id));

        const q3 = await db!.collection('users').where('organizationId', '==', orgId).get();
        q3.docs.forEach(d => usersToUpdate.add(d.id));

        for (const uid of Array.from(usersToUpdate)) {
          const userRef = db!.collection('users').doc(uid);
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            const updateObj: any = {};
            if (uData.activeOrganizationId === orgId) updateObj.activeOrganizationId = admin.firestore.FieldValue.delete();
            if (uData.primaryOrganizationId === orgId) updateObj.primaryOrganizationId = admin.firestore.FieldValue.delete();
            if (uData.organizationId === orgId) updateObj.organizationId = admin.firestore.FieldValue.delete();
            
            if (Object.keys(updateObj).length > 0) {
               batch.update(userRef, updateObj);
            }
          }
        }

      } else {
        batch.delete(orgRef);
      }

      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: action === 'archive' ? 'system.organization.archive' : 'system.organization.delete',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: actorData?.systemRole,
        organizationId: orgId,
        before: orgData,
        after: action === 'archive' ? { status: 'archived' } : null,
        source: "millionsnest_ecosystem_console",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return res.json({ success: true });
    } catch (e: any) {
      console.error('[API Archive/Delete]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 5. Move data
  app.post('/api/admin/organizations/:fromOrgId/move-data', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const actorSnap = await db!.collection('users').doc(decoded.uid).get();
      const actorData = actorSnap.data();
      if (!['ceo', 'admin', 'global_admin'].includes(actorData?.systemRole || '')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { fromOrgId } = req.params;
      const { toOrgId } = req.body;
      if (!toOrgId) return res.status(400).json({ error: 'toOrgId is required' });

      const songsSnap = await db!.collection('songs').where('organizationId', '==', fromOrgId).get();
      const songsBatch = db!.batch();
      songsSnap.docs.forEach(doc => {
        songsBatch.update(doc.ref, {
          organizationId: toOrgId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      if (!songsSnap.empty) await songsBatch.commit();

      const scalesSnap = await db!.collection('scales').where('organizationId', '==', fromOrgId).get();
      const scalesBatch = db!.batch();
      scalesSnap.docs.forEach(doc => {
        scalesBatch.update(doc.ref, {
          organizationId: toOrgId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      if (!scalesSnap.empty) await scalesBatch.commit();

      const membersSnap = await db!.collection('organizations').doc(fromOrgId).collection('members').get();
      const membersBatch = db!.batch();
      membersSnap.docs.forEach(doc => {
        const data = doc.data();
        const mRef = db!.collection('organizations').doc(toOrgId).collection('members').doc(doc.id);
        membersBatch.set(mRef, {
           ...data,
           organizationId: toOrgId,
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Update user canonical context if needed (safe update)
        const userRef = db!.collection('users').doc(doc.id);
        const legacyRef = db!.collection('organization_members').doc(`${doc.id}_${toOrgId}`);
        membersBatch.set(legacyRef, {
           uid: doc.id,
           organizationId: toOrgId,
           role: data.role,
           status: 'active',
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      if (!membersSnap.empty) await membersBatch.commit();

      const auditRef = db!.collection('audit_logs').doc();
      await auditRef.set({
        action: 'system.organization.move_data',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: actorData?.systemRole,
        organizationId: fromOrgId,
        before: { fromOrgId, toOrgId },
        after: { movedSongs: songsSnap.size, movedScales: scalesSnap.size },
        source: "millionsnest_ecosystem_console",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        success: true,
        movedSongs: songsSnap.size,
        movedScales: scalesSnap.size
      });
    } catch (e: any) {
      console.error('[API Move Data]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 6. User canonical context endpoint
  app.get('/api/user/organization-context', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);

      const context = await resolveUserOrganizationContext(decoded.uid);
      return res.json(context);
    } catch (e: any) {
      console.error('[API User Org Context]', e);
      return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  app.post('/api/admin/organizations/:orgId/rename', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decoded.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const { newName } = req.body;
      if (!newName?.trim()) return res.status(400).json({ error: 'Novo nome é obrigatório' });

      const orgRef = db!.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      if (!orgSnap.exists) return res.status(404).json({ error: 'Organização não encontrada' });
      const orgData = orgSnap.data() || {};

      const oldName = orgData.name;

      await orgRef.update({
        name: newName.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit log
      const auditRef = db!.collection('audit_logs').doc();
      await auditRef.set({
        action: 'system.organization.rename',
        actorUid: decoded.uid,
        actorEmail: decoded.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        before: { name: oldName },
        after: { name: newName.trim() },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true, newName: newName.trim() });
    } catch (err) {
      console.error('[API Rename Organization]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/admin/organizations/:orgId/members', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);

      const userSnap = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userSnap.data();
      if (userData?.systemRole !== 'ceo' && userData?.systemRole !== 'admin' && userData?.systemRole !== 'global_admin') {
         return res.status(403).json({ error: 'Acesso restrito' });
      }

      const { orgId } = req.params;
      const membersSnap = await db!.collection(`organizations/${orgId}/members`).get();
      
      const members = await Promise.all(membersSnap.docs.map(async doc => {
        const data = doc.data();
        let uData = {};
        try {
          const userDoc = await db!.collection('users').doc(doc.id).get();
          if (userDoc.exists) uData = userDoc.data() || {};
        } catch (e) {}
        return { id: doc.id, ...data, ...uData };
      }));

      return res.json({ members });
    } catch (err) {
      console.error('[API Admin Org Members]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // ==========================================
  // ECOSYSTEM DATA CONSOLE ENDPOINTS
  // ==========================================

  app.get('/api/admin/database/organizations', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);

      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      if (!userRef.exists) return res.status(403).json({ error: 'Forbidden' });
      const userData = userRef.data();
      const isSystemAdmin = ['ceo', 'admin', 'global_admin'].includes(userData?.systemRole);
      if (!isSystemAdmin) {
         return res.status(403).json({ error: 'Acesso restrito' });
      }

      const orgsQuery = await db!.collection('organizations').orderBy('createdAt', 'desc').limit(200).get();
      
      const organizations = await Promise.all(orgsQuery.docs.map(async doc => {
        const orgData = doc.data();
        const orgId = doc.id;
        
        let memberCount = 0;
        let songCount = 0;
        let scaleCount = 0;
        
        try {
          const membersSnap = await db!.collection('organizations').doc(orgId).collection('members').count().get();
          memberCount = membersSnap.data().count;
        } catch (e) {}

        try {
          const songsSnap = await db!.collection('songs').where('organizationId', '==', orgId).count().get();
          songCount = songsSnap.data().count;
        } catch (e) {}

        try {
          const scalesSnap = await db!.collection('scales').where('organizationId', '==', orgId).count().get();
          scaleCount = scalesSnap.data().count;
        } catch (e) {}
        
        // Compute health status
        let healthStatus = 'Saudável';
        if (!orgData.ownerUid && !orgData.ownerUserId && !orgData.ownerId) {
          healthStatus = 'Crítica';
        } else if (!orgData.apps?.musicscale?.access) {
          healthStatus = 'Atenção';
        }

        return {
          id: orgId,
          name: orgData.name || 'Sem nome',
          slug: orgData.slug || null,
          ownerUserId: orgData.ownerUserId || orgData.ownerUid || orgData.ownerId || null,
          ownerEmail: orgData.ownerEmail || null,
          ownerName: orgData.ownerName || null,
          subscriptionPlan: orgData.subscriptionPlan || orgData.plan || 'free',
          subscriptionStatus: orgData.subscriptionStatus || orgData.status || 'none',
          createdAt: orgData.createdAt,
          updatedAt: orgData.updatedAt,
          apps: orgData.apps,
          memberCount,
          songCount,
          scaleCount,
          healthStatus
        };
      }));

      return res.json({ organizations });
    } catch (err: any) {
      console.error('[API Admin Database Orgs]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  app.get('/api/admin/database/organizations/:orgId/songs', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const songsSnap = await db!.collection('songs').where('organizationId', '==', orgId).orderBy('title', 'asc').limit(500).get();
      const songs = songsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ songs });
    } catch (err: any) {
      console.error('[API Get MS Songs]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/database/organizations/:orgId/songs', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const { title, artist, key, bpms, lyrics } = req.body;
      
      if (!title?.trim()) {
        return res.status(400).json({ error: 'O título da música é obrigatório.' });
      }

      const newSong = {
        title: title.trim(),
        artist: artist?.trim() || '',
        key: key?.trim() || '',
        bpms: Number(bpms) || 0,
        lyrics: lyrics?.trim() || '',
        organizationId: orgId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const songRef = await db!.collection('songs').add(newSong);

      // Log in audit_logs
      await db!.collection('audit_logs').add({
        action: 'musicscale.song.created',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        targetEntityType: 'song',
        targetEntityId: songRef.id,
        after: { title: title.trim(), artist: artist?.trim() },
        source: 'millionsnest_admin_console',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true, id: songRef.id });
    } catch (err: any) {
      console.error('[API Post MS Song]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.put('/api/admin/database/organizations/:orgId/songs/:songId', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId, songId } = req.params;
      const { title, artist, key, bpms, lyrics } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ error: 'O título da música é obrigatório.' });
      }

      const songRef = db!.collection('songs').doc(songId);
      const songSnap = await songRef.get();
      if (!songSnap.exists || songSnap.data()?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Música não encontrada nesta organização.' });
      }

      const oldData = songSnap.data() || {};
      const updateData = {
        title: title.trim(),
        artist: artist?.trim() || '',
        key: key?.trim() || '',
        bpms: Number(bpms) || 0,
        lyrics: lyrics?.trim() || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await songRef.update(updateData);

      // Log in audit_logs
      await db!.collection('audit_logs').add({
        action: 'musicscale.song.updated',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        targetEntityType: 'song',
        targetEntityId: songId,
        before: { title: oldData.title, artist: oldData.artist },
        after: { title: title.trim(), artist: artist?.trim() },
        source: 'millionsnest_admin_console',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API Put MS Song]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/admin/database/organizations/:orgId/songs/:songId', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId, songId } = req.params;

      const songRef = db!.collection('songs').doc(songId);
      const songSnap = await songRef.get();
      if (!songSnap.exists || songSnap.data()?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Música não encontrada nesta organização.' });
      }

      const oldData = songSnap.data() || {};
      await songRef.delete();

      // Log in audit_logs
      await db!.collection('audit_logs').add({
        action: 'musicscale.song.deleted',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        targetEntityType: 'song',
        targetEntityId: songId,
        before: { title: oldData.title, artist: oldData.artist },
        source: 'millionsnest_admin_console',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API Delete MS Song]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/admin/database/organizations/:orgId/scales', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const scalesSnap = await db!.collection('scales').where('organizationId', '==', orgId).orderBy('createdAt', 'desc').limit(200).get();
      const scales = scalesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ scales });
    } catch (err: any) {
      console.error('[API Get MS Scales]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.put('/api/admin/database/organizations/:orgId/update-fields', express.json(), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { orgId } = req.params;
      const { name, slug, subscriptionPlan, subscriptionStatus } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ error: 'O nome da organização não pode ficar vazio.' });
      }

      const orgRef = db!.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();
      if (!orgSnap.exists) {
        return res.status(404).json({ error: 'Organização não encontrada.' });
      }

      const oldData = orgSnap.data() || {};
      const batch = db!.batch();

      // Prepare organization updates
      const orgUpdate: any = {
        name: name.trim(),
        slug: slug?.trim() || oldData.slug || '',
        subscriptionPlan: subscriptionPlan || oldData.subscriptionPlan || 'free',
        subscriptionStatus: subscriptionStatus || oldData.subscriptionStatus || 'none',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.update(orgRef, orgUpdate);

      // Prepare subscription updates
      const subRef = db!.collection('subscriptions').doc(orgId);
      const subUpdate: any = {
        plan: subscriptionPlan || 'free',
        status: subscriptionStatus || 'none',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Use set with merge
      batch.set(subRef, subUpdate, { merge: true });

      // Create Audit Log
      const auditRef = db!.collection('audit_logs').doc();
      batch.set(auditRef, {
        action: 'system.organization.database_update',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email,
        actorSystemRole: userData?.systemRole,
        organizationId: orgId,
        targetEntityType: 'organization',
        targetEntityId: orgId,
        before: {
          name: oldData.name,
          slug: oldData.slug,
          subscriptionPlan: oldData.subscriptionPlan,
          subscriptionStatus: oldData.subscriptionStatus
        },
        after: {
          name: name.trim(),
          slug: slug?.trim() || '',
          subscriptionPlan,
          subscriptionStatus
        },
        source: 'millionsnest_admin_console',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API Put Org Fields]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  app.get('/api/admin/database/audit-logs', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const userRef = await db!.collection('users').doc(decodedToken.uid).get();
      const userData = userRef.data();
      if (!['ceo', 'admin', 'global_admin'].includes(userData?.systemRole)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const logsSnap = await db!.collection('audit_logs').orderBy('createdAt', 'desc').limit(150).get();
      const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ logs });
    } catch (err: any) {
      console.error('[API Get Audit Logs]', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/v1/organizations/:orgId/limits', async (req, res) => {
    try {
      const { orgId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação ausente.' });
      }

      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token', message: 'Falha na validação do token.' });
      }

      const dbInstance = getDb();
      if (!dbInstance) return res.status(500).json({ error: 'Database not initialized' });

      // Verificação de associação multi-tenant ou admin de sistema
      let hasAccess = false;
      const userSnap = await dbInstance.collection('users').doc(decodedToken.uid).get();
      const userData = userSnap.data();
      if (userData?.systemRole === 'ceo' || userData?.systemRole === 'admin' || userData?.systemRole === 'global_admin') {
        hasAccess = true;
      } else {
        const memberSnap = await dbInstance.collection('organizations').doc(orgId).collection('members').doc(decodedToken.uid).get();
        if (memberSnap.exists) {
          hasAccess = true;
        } else {
          const legacyMemberSnap = await dbInstance.collection('organization_members').doc(`${decodedToken.uid}_${orgId}`).get();
          if (legacyMemberSnap.exists) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden', message: 'Você não tem acesso a esta organização.' });
      }

      // Fetch limits
      const subDoc = await dbInstance.collection('subscriptions').doc(orgId).get();
      const subscription = subDoc.exists ? subDoc.data() : null;

      const orgDoc = await dbInstance.collection('organizations').doc(orgId).get();
      const organization = orgDoc.exists ? orgDoc.data() : null;

      const entitlements = resolveMusicScaleEntitlements({ subscription, organization });
      
      const maxUsersLimit = entitlements?.limits?.users ?? 10;
      const occupiedSlots = await getActiveAndReservedMemberCount(orgId);

      const maxImportsLimit = entitlements?.limits?.libraryImportsPerMonth ?? 0;
      const currentImportsCount = await getCurrentMonthUsage(orgId, 'library_import');

      return res.json({
        success: true,
        plan: {
          id: entitlements.id,
          name: entitlements.name,
          priceMonthly: entitlements.priceMonthly,
          limits: {
            users: maxUsersLimit,
            libraryImportsPerMonth: maxImportsLimit
          },
          features: entitlements.features
        },
        usage: {
          users: {
            current: occupiedSlots,
            limit: maxUsersLimit,
            allowed: maxUsersLimit === -1 || occupiedSlots < maxUsersLimit
          },
          library_import: {
            current: currentImportsCount,
            limit: maxImportsLimit,
            allowed: maxImportsLimit === -1 || currentImportsCount < maxImportsLimit
          }
        }
      });
    } catch (err: any) {
      console.error('[API Limits]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  app.post('/api/v1/organizations/:orgId/musicscale/usage/increment', express.json(), async (req, res) => {
    try {
      const { orgId } = req.params;
      const { type, incrementBy = 1, metadata = {} } = req.body;
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação ausente.' });
      }

      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token', message: 'Falha na validação do token.' });
      }

      const dbInstance = getDb();
      if (!dbInstance) return res.status(500).json({ error: 'Database not initialized' });

      // Verificação de associação multi-tenant ou admin de sistema
      let hasAccess = false;
      const userSnap = await dbInstance.collection('users').doc(decodedToken.uid).get();
      const userData = userSnap.data();
      if (userData?.systemRole === 'ceo' || userData?.systemRole === 'admin' || userData?.systemRole === 'global_admin') {
        hasAccess = true;
      } else {
        const memberSnap = await dbInstance.collection('organizations').doc(orgId).collection('members').doc(decodedToken.uid).get();
        if (memberSnap.exists) {
          hasAccess = true;
        } else {
          const legacyMemberSnap = await dbInstance.collection('organization_members').doc(`${decodedToken.uid}_${orgId}`).get();
          if (legacyMemberSnap.exists) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden', message: 'Você não tem acesso a esta organização.' });
      }

      if (!type) {
        return res.status(400).json({ error: 'Missing type' });
      }

      const isSystemAdmin = ['ceo', 'admin', 'global_admin'].includes(userData?.systemRole);
      const isSupportMode = decodedToken.supportMode === true;
      const shouldConsumeLibraryImport = !isSystemAdmin && !isSupportMode;

      // Realizar registro de auditoria, preferencialmente para admin/supportMode import
      if (type === 'library_import') {
        try {
          await dbInstance.collection('audit_logs').add({
            action: "musicscale.library.import",
            organizationId: orgId,
            actorUid: decodedToken.uid,
            actorEmail: decodedToken.email || userData?.email || '',
            actorDisplayName: userData?.displayName || '',
            actorSystemRole: userData?.systemRole || 'user',
            supportMode: isSupportMode,
            targetOrganizationId: orgId,
            consumedUsage: shouldConsumeLibraryImport,
            source: isSupportMode || isSystemAdmin ? "support_admin" : "user",
            globalSongId: metadata.globalSongId || null,
            songTitle: metadata.songTitle || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (auditErr) {
          console.warn('[Audit Log Failed]', auditErr);
        }
      }

      if (type === 'library_import' && !shouldConsumeLibraryImport) {
        // Bypass limit assertions and do NOT increment. 
        return res.json({
          success: true,
          type,
          monthId: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          newCount: await getCurrentMonthUsage(orgId, type),
          supportModeBypassed: true
        });
      }

      // Assert operation limits
      try {
        await assertCanPerformOperation(orgId, type, decodedToken.uid);
      } catch (err: any) {
        return res.status(403).json({ error: 'Limit Exceeded', message: err.message });
      }

      // Increment
      const newCount = await incrementMonthUsage(orgId, type, incrementBy);

      return res.json({
        success: true,
        type,
        monthId: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        newCount
      });
    } catch (err: any) {
      console.error('[API Increment Usage]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  app.get('/api/slug/check', async (req, res) => {
      try {
          const { slug, orgId } = req.query;
          if (!slug || typeof slug !== 'string') {
              return res.status(400).json({ error: 'Slug is required' });
          }

          const RESERVED_PUBLIC_ROUTES = [
             'login', 'dashboard', 'pricing', 'checkout', 'invite', 'join', 
             'start', 'admin', 'api', 'support', 'billing', 'apps', 'settings',
             'termos-de-uso', 'politica-de-privacidade', 'politicas-de-reembolso', 'politicas-de-cancelamento',
             'upgrade', 'org', 'organizations', 'musicscale', 'millionsnest', 'api'
          ];
          
          if (RESERVED_PUBLIC_ROUTES.includes(slug)) {
              return res.json({ available: false, reason: 'reserved' });
          }

          const indexDoc = await db.collection('organizationSlugs').doc(slug).get();
          if (indexDoc.exists) {
              const data = indexDoc.data();
              if (data?.organizationId === orgId) {
                 return res.json({ available: true, reason: 'current_org' });
              }
              return res.json({ available: false, reason: 'taken' });
          }

          // Fallback to legacy organizations search
          const qs = await db.collection('organizations').where('slug', '==', slug).get();
          if (!qs.empty) {
              const existingDoc = qs.docs[0];
              if (existingDoc.id === orgId) {
                  return res.json({ available: true, reason: 'current_org' }); // already belongs to this org
              }
              return res.json({ available: false, reason: 'taken' });
          }
          
          return res.json({ available: true });
      } catch (err: any) {
          console.error('[API Slug Check]', err);
          return res.status(500).json({ error: 'Internal Server Error' });
      }
  });

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
        hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(status);
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
            if (orgDoc.exists && ['active', 'trialing', 'trial', 'pro'].includes(orgDoc.data()?.subscriptionStatus)) {
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

  app.post('/api/ecosystem/create-handoff', express.json(), async (req, res) => {
    let logUid: string | null = null;
    let logOrgId: string | null = null;
    let logSubscriptionFound = false;
    let logSubscriptionStatus: string | null = null;
    let logStripeLookupPerformed = false;
    let logSelfHealingExecuted = false;
    let logAccessGranted = false;

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      logUid = decoded.uid;
      
      const { appId, orgId, supportMode } = req.body;
      if (appId !== 'musicscale') {
        return res.status(400).json({ error: 'Invalid app' });
      }

      if (!db) {
        console.error('[HANDOFF_ERROR] Database not initialized');
        return res.status(500).json({ error: 'Database not initialized' });
      }
      
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const systemRole = userData?.systemRole;
      const isGlobalAdmin = systemRole === 'ceo' || systemRole === 'admin' || systemRole === 'global_admin';
      
      let verifiedSupportMode = false;
      if (supportMode === true) {
        if (!isGlobalAdmin) {
           return res.status(403).json({ error: 'Forbidden: only global admins can use support mode' });
        }
        verifiedSupportMode = true;
      }

      // PASSO 1: Resolver organizationId do usuário usando Canonical Resolver
      const orgContext = await resolveUserOrganizationContext(decoded.uid);
      const candidateOrgs = new Set<string>();

      // A. Apenas permitimos orgId arbitrário se for Global Admin
      if (orgId && typeof orgId === 'string' && orgId.trim() !== '') {
        if (isGlobalAdmin) {
           candidateOrgs.add(orgId.trim());
        }
      }

      // Validação Crítica de Segurança: Se o usuário (não-admin) mandou um orgId específico para handoff
      if (!isGlobalAdmin && orgId && typeof orgId === 'string' && orgId.trim() !== '') {
         const cleanOrgId = orgId.trim();
         // Verify if cleanOrgId is in the user's canonical context active list
         const isLegit = orgContext.organizations.some(o => o.id === cleanOrgId && o.status !== 'archived');
         
         if (isLegit) {
            candidateOrgs.add(cleanOrgId);
         } else {
            console.error(`[HANDOFF_SECURITY_VIOLATION] User ${decoded.uid} attempted to access unowned/unassociated orgId: ${cleanOrgId}`);
            return res.status(403).json({ error: 'Forbidden: You do not have access to this organization.' });
         }
      }

      // Adiciona o current active do context
      if (orgContext.activeOrganizationId) candidateOrgs.add(orgContext.activeOrganizationId);
      if (orgContext.primaryOrganizationId) candidateOrgs.add(orgContext.primaryOrganizationId);
      orgContext.organizations.filter(o => o.status !== 'archived').forEach(o => candidateOrgs.add(o.id));

      const candidateOrgsList = Array.from(candidateOrgs);
      const validStatuses = ['active', 'trialing', 'trial', 'past_due', 'pro'];

      let chosenOrgId: string | null = null;
      let subscriptionFound = false;
      let subscriptionStatus: string | null = null;
      let existingSubData: any = null;

      // PASSO 2: Buscar subscriptions/{organizationId} em Firestore
      for (const oId of candidateOrgsList) {
        const subDoc = await db.collection('subscriptions').doc(oId).get();
        if (subDoc.exists) {
          existingSubData = subDoc.data();
          const status = existingSubData?.status;
          if (status && validStatuses.includes(status)) {
            chosenOrgId = oId;
            subscriptionFound = true;
            subscriptionStatus = status;
            break;
          }
        }
      }

      logSubscriptionFound = subscriptionFound;
      logSubscriptionStatus = subscriptionStatus;

      // PASSO 3: Se NÃO for global admin, SEMPRE consultamos o Stripe em tempo real
      if (!isGlobalAdmin) {
        logStripeLookupPerformed = true;
        const stripe = getStripe();
        if (stripe) {
          let stripeSubObj: any = null;
          const email = decoded.email || userData?.email;
          const stripeCustomerId = userData?.stripeCustomerId || userData?.subscription?.stripeCustomerId || existingSubData?.stripeCustomerId;
          const stripeSubscriptionId = existingSubData?.stripeSubscriptionId;

          // A. Tentar recuperar diretamente pelo ID de assinatura (super veloz!)
          if (stripeSubscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              if (validStatuses.includes(sub.status)) {
                stripeSubObj = sub;
              }
            } catch (err) {
              console.warn('[HANDOFF_STRIPE_ALWAYS_CHECK] Direct Retrieve failed:', err);
            }
          }

          // B. Se não encontrou por ID de assinatura, tentar por customerId
          if (!stripeSubObj && stripeCustomerId) {
            try {
              const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 10, status: 'all' });
              const validSub = subs.data.find((s: any) => validStatuses.includes(s.status));
              if (validSub) {
                stripeSubObj = validSub;
              }
            } catch (err) {
              console.warn('[HANDOFF_STRIPE_ALWAYS_CHECK] Stripe list by customerId failed:', err);
            }
          }

          // C. Se ainda não encontrou, buscar por e-mail do usuário
          if (!stripeSubObj && email) {
            try {
              const customers = await stripe.customers.list({ email: email, limit: 10 });
              for (const cust of customers.data) {
                const subs = await stripe.subscriptions.list({ customer: cust.id, limit: 10, status: 'all' });
                const validSub = subs.data.find((s: any) => validStatuses.includes(s.status));
                if (validSub) {
                  stripeSubObj = validSub;
                  break;
                }
              }
            } catch (err) {
              console.warn('[HANDOFF_STRIPE_ALWAYS_CHECK] Stripe lookup by email failed:', err);
            }
          }

          // D. Se ainda não encontrou, tentar por checkout sessions
          if (!stripeSubObj && stripeCustomerId) {
            try {
              const checkouts = await stripe.checkout.sessions.list({ customer: stripeCustomerId, limit: 10 });
              const completedSession = checkouts.data.find((s: any) => s.status === 'complete' && s.subscription);
              if (completedSession) {
                const subId = completedSession.subscription as string;
                const sub = await stripe.subscriptions.retrieve(subId);
                if (validStatuses.includes(sub.status)) {
                  stripeSubObj = sub;
                }
              }
            } catch (err) {
              console.warn('[HANDOFF_STRIPE_ALWAYS_CHECK] Stripe lookup by checkout sessions failed:', err);
            }
          }

          if (stripeSubObj) {
            let targetOrgId = chosenOrgId;
            if (!targetOrgId && candidateOrgsList.length > 0) {
               targetOrgId = candidateOrgsList[0];
            }
            if (!targetOrgId) {
               const userDocSnap = await db.collection('users').doc(decoded.uid).get();
               const userDoc = userDocSnap.exists ? userDocSnap.data() : null;
               if (userDoc && userDoc.organizationId && userDoc.organizationId !== decoded.uid) {
                  targetOrgId = userDoc.organizationId;
               } else {
                  targetOrgId = db.collection('organizations').doc().id;
               }
            }
            
            console.log(`[HANDOFF_STRIPE_ALWAYS_CHECK] Active Stripe subscription verified. Syncing dynamically for uid: ${decoded.uid}, org: ${targetOrgId}`);
            
            await upsertEcosystemSubscription({
              userId: decoded.uid,
              orgId: targetOrgId,
              subscription: stripeSubObj,
              eventCreatedTs: Math.floor(Date.now() / 1000),
              event_type: 'handoff_always_check',
              userEmail: email
            });

            logSelfHealingExecuted = true;
            chosenOrgId = targetOrgId;
            subscriptionFound = true;
            subscriptionStatus = stripeSubObj.status;
            logSubscriptionFound = true;
            logSubscriptionStatus = stripeSubObj.status;
          } else {
            console.log(`[HANDOFF_STRIPE_ALWAYS_CHECK] No active subscription found on Stripe for user: ${decoded.uid}`);
            
            // Se existia uma assinatura localmente, removemos ou cancelamos no Firestore
            const targetOrgId = chosenOrgId || (candidateOrgsList.length > 0 ? candidateOrgsList[0] : decoded.uid);
            const batch = db.batch();
            batch.set(db.collection('subscriptions').doc(targetOrgId), {
              status: 'canceled',
              features: {
                globalLibrary: false,
                musicScale: false
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            batch.set(db.collection('organizations').doc(targetOrgId), {
              subscriptionStatus: 'canceled',
              status: 'canceled',
              'apps.musicscale.access': false,
              'apps.musicscale.status': 'canceled',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            batch.set(db.collection('users').doc(decoded.uid), {
              subscriptionStatus: 'canceled',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();

            subscriptionFound = false;
            subscriptionStatus = 'canceled';
            logSubscriptionFound = false;
            logSubscriptionStatus = 'canceled';
          }
        }
      }

      // Determinar o orgId definitivo para usar no Custom Token
      const finalOrgId = chosenOrgId || (candidateOrgsList.length > 0 ? candidateOrgsList[0] : (orgId || decoded.uid));
      logOrgId = finalOrgId;

      // PASSO 4 & PASSO 5: Validação final (somente falha se não for global_admin e não encontrarmos assinatura)
      if (!isGlobalAdmin && !subscriptionFound) {
        const errMessage = 'Access denied: Subscription missing. Reason: No active subscription found in Firestore or Stripe for users organizations.';
        console.error(`[HANDOFF_DENIED] uid: ${decoded.uid}, org: ${finalOrgId}. details: ${errMessage}`);
        
        // Print clean handover logger
        console.log('[HANDOFF]', {
           uid: decoded.uid,
           organizationId: finalOrgId,
           subscriptionFound: false,
           subscriptionStatus: null,
           stripeLookupPerformed: logStripeLookupPerformed,
           selfHealingExecuted: logSelfHealingExecuted,
           accessGranted: false
        });

        return res.status(403).json({ error: errMessage });
      }

      logAccessGranted = true;

      // Print clean handover logger
      console.log('[HANDOFF]', {
         uid: decoded.uid,
         organizationId: finalOrgId,
         subscriptionFound: subscriptionFound,
         subscriptionStatus: subscriptionStatus,
         stripeLookupPerformed: logStripeLookupPerformed,
         selfHealingExecuted: logSelfHealingExecuted,
         accessGranted: true
      });

      const customToken = await admin.auth().createCustomToken(decoded.uid, {
        orgId: finalOrgId,
        appId: appId,
        supportMode: verifiedSupportMode,
      });

      return res.json({
        customToken,
        orgId: finalOrgId,
        uid: decoded.uid,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
    } catch (e: any) {
      console.error('[API Handoff Fatal Error]', e);
      // Print clean handoff logger even on failure
      console.log('[HANDOFF]', {
         uid: logUid,
         organizationId: logOrgId,
         subscriptionFound: logSubscriptionFound,
         subscriptionStatus: logSubscriptionStatus,
         stripeLookupPerformed: logStripeLookupPerformed,
         selfHealingExecuted: logSelfHealingExecuted,
         accessGranted: logAccessGranted
      });
      return res.status(500).json({ error: `Internal Error: ${e?.message || e}` });
    }
  });

  // Forçar sincronização com Stripe
  app.post('/api/v1/billing/sync', async (req, res) => {
    try {
      const { userId, sessionId } = req.body;
      if (!userId || !db) {
        console.error('[SYNC_FATAL_ERROR]', { error: 'Missing params', dbReady: !!db });
        return res.status(400).json({ error: 'Missing uid or db' });
      }

      console.log('[SYNC_START]', {
        userId: userId,
        sessionId: sessionId || null,
        timestamp: new Date().toISOString()
      });

      const stripe = getStripe();
      const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live');

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.error('[SYNC_FATAL_ERROR]', { error: 'User not found' });
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userData = userDoc.data()!;
      const userEmail = userData.email;
      let customerId = userData.stripeCustomerId;

      const orgIdBase = userData.organizationId || userId;
      
      console.log('[SYNC_FIREBASE_USER]', {
        found: true,
        uid: userId,
        organizationId: orgIdBase,
        hasEmail: !!userEmail,
        stripeCustomerId: customerId || null
      });

      const subDocBase = await db.collection('subscriptions').doc(orgIdBase).get();
      if (!customerId && subDocBase.exists) {
        customerId = subDocBase.data()?.stripeCustomerId;
      }

      let subscriptions: Stripe.ApiList<Stripe.Subscription> | null = null;
      
      try {
        if (sessionId) {
            console.log('[SYNC_STRIPE_SESSION_LOOKUP]', { sessionId });
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.customer) {
                customerId = session.customer as string;
            }
            if (session.subscription) {
                const sessionSub = await stripe.subscriptions.retrieve(session.subscription as string);
                subscriptions = { data: [sessionSub], has_more: false, object: 'list', url: '' };
                console.log('[SYNC_STRIPE_SESSION_FOUND]', { subscriptionId: sessionSub.id });
            }
        }
      } catch (e) {
          console.error('[SYNC_STRIPE_SESSION_ERROR]', { sessionId, error: e });
      }

      try {
        if (customerId && !subscriptions) {
          // Detect mismatch before calling Stripe if possible
          if (isLiveKey && customerId.includes('test')) {
             console.warn('[SYNC_ENV_MISMATCH]', { customerId, environment: 'live' });
             customerId = null; 
          } else {
            // Attempt to list by ID
            subscriptions = await stripe.subscriptions.list({
              customer: customerId,
              limit: 1,
              status: 'all'
            });
            console.log('[SYNC_STRIPE_CUSTOMER_LOOKUP]', {
              customerId,
              subscriptionsFound: subscriptions.data.length
            });
          }
        }
      } catch (stripeErr: any) {
        // Handle Environment Mismatch at runtime
        if (stripeErr.type === 'StripeInvalidRequestError' && (stripeErr.message.includes('No such customer') || stripeErr.message.includes('test mode') || stripeErr.message.includes('live mode'))) {
          console.warn('[SYNC_ENV_MISMATCH]', { error: stripeErr.message, email: userEmail });
          customerId = null; 
        } else {
          throw stripeErr;
        }
      }

      // Self-Healing Logic: Use Email to find the correct customer ID in the CURRENT environment
      if (!customerId || (subscriptions && subscriptions.data.length === 0)) {
        if (userEmail) {
          console.log('[SYNC_HEALING_START]', { userEmail });
          const customers = await stripe.customers.list({ email: userEmail, limit: 100 });
          if (customers.data.length > 0) {
            let foundValidCustomer = false;
            for (const cust of customers.data) {
                const tempSubs = await stripe.subscriptions.list({ customer: cust.id, limit: 1, status: 'all' });
                if (tempSubs.data.length > 0) {
                    customerId = cust.id;
                    subscriptions = tempSubs;
                    foundValidCustomer = true;
                    console.log('[SYNC_HEALING_SUCCESS]', { customerId });
                    break;
                }
            }
            if (!foundValidCustomer) {
                 // Fallback to the latest customer if none had subscriptions
                 customerId = customers.data[0].id;
                 console.log('[SYNC_HEALING_FALLBACK]', { customerId });
            }
          } else {
            console.log('[SYNC_HEALING_FAILED]', { reason: 'No customer found for email' });
          }
        }
      }

      if (!subscriptions || subscriptions.data.length === 0) {
        console.warn('[SYNC_NO_SUBSCRIPTION]', { userId });
        
        const userDocRef = await db.collection('users').doc(userId).get();
        const orgId = (userDocRef.exists && userDocRef.data()?.organizationId) ? userDocRef.data()?.organizationId : userId;

        console.log('[SYNC_FIRESTORE_WRITE]', {
           path: `subscriptions/${orgId}`,
           operation: 'reset'
        });

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
      const hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(sub.status);
      const currentPeriodEnd = admin.firestore.Timestamp.fromMillis((sub as any).current_period_end * 1000);
      const trialEnd = sub.trial_end ? admin.firestore.Timestamp.fromMillis(sub.trial_end * 1000) : null;
      
      const priceId = sub.items?.data?.[0]?.price?.id || null;
      const metadataPlan = sub.metadata?.plan || 'starter';
      const resolvedPlan = priceIdToMusicScalePlan(priceId) || normalizeMusicScalePlan(metadataPlan);
      const planDetails = MUSIC_SCALE_PLANS[resolvedPlan];
      const cancelAtPeriodEnd = sub.cancel_at_period_end || false;

      console.log('[SYNC_SUCCESS_PREP]', {
        userId,
        status: sub.status,
        plan: resolvedPlan
      });

      const userDocRef2 = await db.collection('users').doc(userId).get();
      const orgId2 = (userDocRef2.exists && userDocRef2.data()?.organizationId) ? userDocRef2.data()?.organizationId : userId;

      const subPayload = {
        schemaVersion: 2,
        organizationId: orgId2,
        app: 'musicscale',
        status: sub.status,
        plan: resolvedPlan,
        priceId: priceId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        trialEndsAt: trialEnd,
        currentPeriodEnd: currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        limits: planDetails.limits,
        supportTier: planDetails.features.supportTier,
        features: {
          globalLibrary: hasAccess,
          musicScale: hasAccess,
          ...planDetails.features
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      console.log('[SYNC_FIRESTORE_WRITE]', {
        path: `subscriptions/${orgId2}`,
        payload: subPayload,
        operation: 'set (merge)'
      });

      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(orgId2), subPayload, { merge: true });

      batch.set(db.collection('organizations').doc(orgId2), {
        plan: resolvedPlan,
        subscriptionPlan: resolvedPlan,
        subscriptionStatus: sub.status,
        enabledApps: admin.firestore.FieldValue.arrayUnion('musicscale'),
        
        'apps.musicscale.access': hasAccess,
        'apps.musicscale.status': sub.status,
        'apps.musicscale.plan': resolvedPlan,
        'apps.musicscale.features': planDetails.features,
        'apps.musicscale.limits': planDetails.limits,
        'apps.musicscale.supportTier': planDetails.features.supportTier,
        'apps.musicscale.currentPeriodEnd': currentPeriodEnd,
        'apps.musicscale.trialEndsAt': trialEnd,
        'apps.musicscale.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'apps.musicscale.planUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
        
        planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        entitlementsVersion: 2,

        ownerUid: userId,
        ownerId: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('users').doc(userId), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('organization_members').doc(`${userId}_${orgId2}`), {
        uid: userId,
        organizationId: orgId2,
        role: 'owner',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions('owner')
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
      console.error('[SYNC_FATAL_ERROR]', {
        error: err.message,
        stack: err.stack,
        code: err.code || 'unknown'
      });
      res.status(500).json({ 
        error: 'Erro na sincronização com Stripe.',
        details: err.message 
      });
    }
  });

  app.get('/api/admin/repair/pastordaniel', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      const adminUid = decodedToken.uid;
      const adminDoc = await db!.collection('users').doc(adminUid).get();
      if (!adminDoc.exists) return res.status(403).json({ error: 'Forbidden' });
      const adminRole = adminDoc.data()?.systemRole;
      if (adminRole !== 'ceo' && adminRole !== 'admin' && adminRole !== 'global_admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Acesso restrito.' });
      }

      if (!db) return res.status(500).json({ error: 'DB not ready' });
      const stripe = getStripe();
      // Encontra a assinatura no Stripe do e-mail usado
      const customers = await stripe.customers.list({ email: 'danielcunhapastor@gmail.com', limit: 1 });
      if (customers.data.length === 0) return res.status(404).send('Not found in stripe');
      
      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
      if (subs.data.length === 0) return res.status(404).send('No sub found');
      
      const sub = subs.data[0];
      const hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(sub.status);
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
        role: 'owner',
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        permissions: getDefaultPermissions('owner')
      }, { merge: true });

      await batch.commit();

      res.status(200).json({ success: true, repairedStatus: sub.status });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Repair Tool
  const repairSyncHandler = async (req: express.Request, res: express.Response) => {
    try {
      console.log('[REPAIR_ROUTE_HIT]', {
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      });

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
      
      if (!db || !email) {
        console.error('[REPAIR_FATAL_ERROR]', { error: 'Missing params', dbReady: !!db, email });
        return res.status(400).json({ error: 'Missing params', message: 'Ocorreu um problema ao identificar os dados necessários para o sistema (email/uid).' });
      }

      console.log('[REPAIR_START]', {
        email: email,
        uid: uid,
        timestamp: new Date().toISOString()
      });

      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        console.error('[REPAIR_FATAL_ERROR]', { error: 'User not found' });
        return res.status(404).json({ error: 'User not found', message: 'Usuário não localizado no banco de dados.' });
      }
      
      const userData = userDoc.data()!;
      const orgId = userData.organizationId || uid;

      console.log('[REPAIR_FIREBASE_USER]', {
        found: true,
        uid: uid,
        organizationId: orgId,
        organizationRole: userData.organizationRole || 'unknown',
        userDocPreview: Object.keys(userData)
      });

      console.log('[REPAIR_ORG_RESOLUTION]', {
        resolvedOrgId: orgId,
        fallbackApplied: !userData.organizationId,
        expectedPath: `subscriptions/${orgId}`
      });

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
          console.log('[REPAIR_STRIPE_LOOKUP]', { foundCustomer: false, email });
          return res.json({ success: false, message: 'Nenhuma assinatura ou cliente localizado no Stripe.', repaired: false });
      }

      const customer = customers.data[0];
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 10, status: 'all' });

      console.log('[REPAIR_STRIPE_LOOKUP]', {
          foundCustomer: true,
          customerId: customer.id,
          subscriptionsCount: subs.data.length,
          status: subs.data.length > 0 ? subs.data[0].status : 'none',
          plan: subs.data.length > 0 ? subs.data[0].metadata?.plan : 'none',
          trialing: subs.data.length > 0 ? subs.data[0].status === 'trialing' : false,
          active: subs.data.length > 0 ? ['active', 'trialing', 'trial', 'pro'].includes(subs.data[0].status) : false
      });

      if (subs.data.length === 0) {
          return res.json({ success: false, message: 'Seu usuário foi localizado, mas não há assinaturas ativas no momento.', repaired: false });
      }

      const s = subs.data[0];
      const hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(s.status);
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

      console.log('[REPAIR_FIRESTORE_WRITE]', {
        path: `subscriptions/${orgId}`,
        payload: subPayload,
        operation: 'set (merge)',
        success: 'pending'
      });

      const batch = db.batch();
      batch.set(db.collection('subscriptions').doc(orgId), subPayload, { merge: true });

      batch.set(db.collection('organizations').doc(orgId), {
          ownerUid: uid,
          ownerId: uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(db.collection('users').doc(uid), {
          organizationId: orgId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const memberData = {
          uid: uid,
          organizationId: orgId,
          role: 'owner',
          organizationRole: 'owner',
          permissionsVersion: CURRENT_PERMISSIONS_VERSION,
          permissions: getDefaultPermissions('owner'),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.set(db.collection('organization_members').doc(`${uid}_${orgId}`), memberData, { merge: true });
      batch.set(db.collection('organizations').doc(orgId).collection('members').doc(uid), memberData, { merge: true });

      await batch.commit();

      console.log('[REPAIR_SUCCESS]', {
        organizationId: orgId,
        subscriptionStatus: s.status,
        features: subPayload.features,
        ownershipCorrected: true,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION
      });

      return res.json({
         success: true,
         repaired: true,
         orgId,
         message: 'Assinatura sincronizada com sucesso.'
      });

    } catch (e: any) {
      console.error('[REPAIR_FATAL_ERROR]', {
        error: e.message,
        stack: e.stack,
        code: e.code || 'unknown'
      });
      res.status(500).json({ success: false, error: 'REPAIR_FAILED', message: e.message, code: e.code || 'unknown', step: 'sync_execution' });
    }
  };

  app.post('/api/repair/sync', express.json(), repairSyncHandler);
  app.post('/api/admin/repair-by-token', express.json(), repairSyncHandler);
  app.options('/api/admin/repair-by-token', cors()); // Ensure preflight explicit
  app.options('/api/repair/sync', cors());

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
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Token ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      const adminUid = decodedToken.uid;
      const adminDoc = await db!.collection('users').doc(adminUid).get();
      if (!adminDoc.exists) return res.status(403).json({ error: 'Forbidden' });
      
      const adminRole = adminDoc.data()?.systemRole;
      if (adminRole !== 'ceo' && adminRole !== 'admin' && adminRole !== 'global_admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Acesso restrito.' });
      }

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
        const hasAccess = ['active', 'trialing', 'trial', 'pro'].includes(s.status);
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
            role: 'owner',
            permissionsVersion: CURRENT_PERMISSIONS_VERSION,
            permissions: getDefaultPermissions('owner')
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
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('Content-Type', 'application/json');
      
      const service = getBillingService();
      const result = await service.getProducts();
      
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
      const { orgId, name, slug } = req.body;
      if (!orgId) {
        res.status(400).json({ error: 'Missing orgId' });
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
      
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (name) {
        updateData.name = name;
        updateData.ownerUid = uid;
        updateData.ownerId = uid;
      }

      let oldSlug: string | null = null;
      if (slug !== undefined) {
         const orgDocRes = await admin.firestore().collection('organizations').doc(orgId).get();
         if (orgDocRes.exists) {
            oldSlug = orgDocRes.data()?.slug || null;
         }

         if (!slug || slug.trim() === '') {
            updateData.slug = null;
         } else {
            const slugRegex = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
            if (!slugRegex.test(slug) || slug.includes('--')) {
                return res.status(400).json({ error: 'Formato de link inválido.' });
            }

            const RESERVED_PUBLIC_ROUTES = [
              'login', 'dashboard', 'pricing', 'checkout', 'invite', 'join', 
              'start', 'admin', 'api', 'support', 'billing', 'apps', 'settings',
              'termos-de-uso', 'politica-de-privacidade', 'politicas-de-reembolso', 'politicas-de-cancelamento',
              'upgrade', 'org', 'organizations', 'musicscale', 'millionsnest', 'api'
            ];

            if (RESERVED_PUBLIC_ROUTES.includes(slug)) {
               return res.status(400).json({ error: 'Palavra reservada, escolha outra.' });
            }

            // Transaction-like constraint using a dedicated collection index
            const indexRef = admin.firestore().collection('organizationSlugs').doc(slug);
            const indexDoc = await indexRef.get();
            if (indexDoc.exists) {
                const existingData = indexDoc.data();
                if (existingData?.organizationId !== orgId) {
                    return res.status(400).json({ error: 'Este link já está em uso.' });
                }
            } else {
                // Not in index, double check organizations just in case legacy data exists
                const slugQuery = await admin.firestore().collection('organizations').where('slug', '==', slug).get();
                if (!slugQuery.empty) {
                   const existingDoc = slugQuery.docs[0];
                   if (existingDoc.id !== orgId) {
                      return res.status(400).json({ error: 'Este link já está em uso (legado).' });
                   }
                }
            }
            updateData.slug = slug;
         }
      }

      batch.set(admin.firestore().collection('organizations').doc(orgId), updateData, { merge: true });
      
      if (slug !== undefined && updateData.slug) {
          batch.set(admin.firestore().collection('organizationSlugs').doc(updateData.slug), {
              organizationId: orgId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
      }

      if (oldSlug && slug !== undefined && updateData.slug !== oldSlug) {
         batch.set(admin.firestore().collection('organizationSlugRedirects').doc(oldSlug), {
             organizationId: orgId,
             currentSlug: updateData.slug,
             createdAt: admin.firestore.FieldValue.serverTimestamp()
         });
         // Also we should free up the old slug in the organizationSlugs index, or keep it reserved.
         // Let's delete the old index document so another org can use it, but keeping the redirect.
         batch.delete(admin.firestore().collection('organizationSlugs').doc(oldSlug));
      }

      if (name) {
        batch.set(admin.firestore().collection('organization_members').doc(`${uid}_${orgId}`), {
          uid: uid,
          organizationId: orgId,
          role: 'owner',
          permissionsVersion: CURRENT_PERMISSIONS_VERSION,
          permissions: getDefaultPermissions('owner')
        }, { merge: true });

        batch.set(admin.firestore().collection('users').doc(uid), {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

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

  app.get('/api/admin/stripe/validate-catalog', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
         return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
         const decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
         if (!decodedToken.email || !['pastordanielpcunha@gmail.com', 'danielcunhapastor@gmail.com'].includes(decodedToken.email)) {
             return res.status(403).json({ error: 'Forbidden. Admin/CEO only.' });
         }
      } catch (e) {
         return res.status(401).json({ error: 'Invalid token' });
      }

      console.log(`[Stripe Validation] Running validation against Stripe...`);
      const { PRODUCT_CATALOG } = await import('./src/lib/pricingCatalog.js');
      const stripe = getStripe();
      
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;
      if (isMock) {
         return res.json({ error: "No STRIPE_SECRET_KEY" });
      }

      const results = [];

      for (const item of PRODUCT_CATALOG) {
         const envVal = process.env[item.envKey];
         let status = 'OK';
         let valid = true;
         let stripePrice = null;

         if (!envVal || envVal.startsWith('mock_')) {
            status = 'MISSING_STRIPE_PRICE';
            valid = false;
         } else {
            try {
               stripePrice = await stripe.prices.retrieve(envVal, { expand: ['product'] });
               
               if (!stripePrice.active) {
                 status = 'INACTIVE_PRICE';
                 valid = false;
               } else if (stripePrice.currency.toLowerCase() !== 'brl') {
                 status = 'CURRENCY_MISMATCH';
                 valid = false;
               } else if (item.type === 'plan' && stripePrice.type !== 'recurring') {
                 status = 'INTERVAL_MISMATCH';
                 valid = false;
               } else if (item.type === 'addon' && stripePrice.type === 'recurring') {
                 status = 'INTERVAL_MISMATCH';
                 valid = false;
               } else if (item.priceInCents !== stripePrice.unit_amount) {
                 status = 'PRICE_MISMATCH';
                 valid = false;
               } else if (stripePrice.product && typeof stripePrice.product !== 'string') {
                  const prod = stripePrice.product as Stripe.Product;
                  if (!prod.active) {
                     status = 'INACTIVE_PRODUCT';
                     valid = false;
                  }
               }

            } catch (err: any) {
               status = 'NOT_FOUND_IN_STRIPE';
               valid = false;
            }
         }

         results.push({
            name: item.name,
            lookupKey: item.lookupKey,
            envKey: item.envKey,
            stripePriceId: envVal ? `${envVal.substring(0, 8)}...` : null,
            stripeProductId: stripePrice && typeof stripePrice.product !== 'string' ? `${stripePrice.product.id.substring(0, 8)}...` : null,
            expectedPriceInCents: item.priceInCents,
            stripePriceInCents: stripePrice ? stripePrice.unit_amount : null,
            interval: item.interval,
            status,
            valid
         });
      }

      const mode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';

      return res.json({
         environment: mode,
         totalItems: PRODUCT_CATALOG.length,
         results
      });

    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message });
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
         const orgContext = await resolveUserOrganizationContext(userId);
         const userDoc = await db.collection('users').doc(userId).get();
         if (userDoc.exists) {
            customerId = userDoc.data()?.stripeCustomerId;
         }
         orgId = orgContext.primaryOrganizationId || orgContext.activeOrganizationId || (userDoc.exists ? userDoc.data()?.organizationId : null) || userId;
         
         const subDoc = await db.collection('subscriptions').doc(orgId).get();
         if (subDoc.exists) {
            if (!customerId) customerId = subDoc.data()?.stripeCustomerId;
            const subData = subDoc.data();
            if (planLookupKey) {
                const existingPlan = subData?.plan || subData?.tier || 'starter';
                const status = (subData?.status || '').toLowerCase();
                const currentPeriodEnd = subData?.currentPeriodEnd;
                
                let isValid = false;
                if (status === 'active' || status === 'trialing') isValid = true;
                if (status === 'canceled' && currentPeriodEnd) {
                   const endMs = currentPeriodEnd._seconds ? currentPeriodEnd._seconds * 1000 : (currentPeriodEnd._nanoseconds ? currentPeriodEnd.toMillis?.() : new Date(currentPeriodEnd).getTime());
                   if (Date.now() < endMs) isValid = true;
                }
                
                if (isValid) {
                   const normalizedDesired = planLookupKey.replace('musicscale_', '').replace('_monthly', '').replace('_yearly', '');
                   if (normalizedDesired.includes(existingPlan.toLowerCase()) || existingPlan.toLowerCase().includes(normalizedDesired)) {
                       return res.status(400).json({ code: 'PLAN_ALREADY_ACTIVE', error: 'Você já possui este plano ativo. Para alterar sua assinatura, acesse a área de assinatura.' });
                   } else {
                       return res.status(400).json({ code: 'DIFFERENT_PLAN_ACTIVE', error: 'Você já possui um plano ativo. Para alterar sua assinatura, acesse a área de assinatura.' });
                   }
                }
            }
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
            userId: userId,
            organizationId: orgId,
            plan: planLookupKey || 'unknown',
            app: 'musicscale',
            productId: planLookupKey || 'unknown',
            source: 'millionsnest_site'
          }
        };
      } else {
        sessionArgs.mode = 'payment';
      }

      // Global metadata
      sessionArgs.metadata = {
        uid: userId,
        userId: userId,
        organizationId: orgId,
        unified_checkout: 'true',
        plan: planLookupKey || 'none',
        app: 'musicscale',
        source: 'millionsnest_site',
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
         const orgContext = await resolveUserOrganizationContext(userId);
         const userDoc = await db.collection('users').doc(userId).get();
         if (userDoc.exists) {
            customerId = userDoc.data()?.stripeCustomerId;
         }
         orgId = orgContext.primaryOrganizationId || orgContext.activeOrganizationId || (userDoc.exists ? userDoc.data()?.organizationId : null) || userId;
         
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
          metadata: {
            uid: userId,
            userId: userId,
            organizationId: orgId,
            plan: planItem ? planItem.lookupKey : 'unknown',
            app: 'musicscale',
            productId: planItem ? planItem.lookupKey : 'unknown',
            source: 'millionsnest_site'
          }
        },
        client_reference_id: userId,
        metadata: {
          uid: userId,
          userId: userId,
          organizationId: orgId,
          plan: planItem ? planItem.lookupKey : 'none',
          app: 'musicscale',
          productId: planItem ? planItem.lookupKey : 'none',
          source: 'millionsnest_site'
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

  // API Fallback mechanism to prevent 405 issues from express.static
  app.all('/api/*', (req, res) => {
    // Se a requisição chegou aqui é porque bateu no endpoint /api/ mas não deu match em router de method nenhum
    res.status(404).json({
      success: false,
      error: 'API_ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} não foi encontrado no backend.`,
    });
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
