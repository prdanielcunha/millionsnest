import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('server.ts', 'utf8');

const repairEndpoint = `
  app.post('/api/internal/repair-subscription', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const dbInstance = db;
      if (!dbInstance) return res.status(500).json({ error: 'DB not initialized' });

      const userDoc = await dbInstance.collection('users').doc(decodedToken.uid).get();
      const systemRole = userDoc.data()?.systemRole;
      if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin') {
         return res.status(403).json({ error: 'Forbidden. Admin only.' });
      }

      const { orgId, dryRun = false } = req.body;
      if (!orgId) return res.status(400).json({ error: 'Missing orgId' });

      console.log(\`[Repair] Starting repair for orgId: \${orgId} (dryRun: \${dryRun})\`);
      const logs: string[] = [];
      const orgDoc = await dbInstance.collection('organizations').doc(orgId).get();
      const subDoc = await dbInstance.collection('subscriptions').doc(orgId).get();

      if (!orgDoc.exists) {
        return res.status(404).json({ error: 'Organization not found', logs });
      }

      const orgData = orgDoc.data()!;
      const subData = subDoc.exists ? subDoc.data() : null;

      let customerId = subData?.stripeCustomerId || orgData.stripeCustomerId;
      let subscriptionId = subData?.stripeSubscriptionId || orgData.stripeSubscriptionId;
      
      const stripe = getStripe();
      const isMock = process.env.STRIPE_SECRET_KEY === undefined;
      if (isMock) {
         return res.status(400).json({ error: 'Stripe is mocked' });
      }

      if (!customerId && orgData.ownerUid) {
         const ownerDoc = await dbInstance.collection('users').doc(orgData.ownerUid).get();
         if (ownerDoc.exists && ownerDoc.data()?.stripeCustomerId) {
           customerId = ownerDoc.data()?.stripeCustomerId;
           logs.push(\`Found customerId \${customerId} from ownerUid \${orgData.ownerUid}\`);
         }
      }

      if (!customerId) {
         return res.status(404).json({ error: 'Stripe customer not found', logs });
      }

      const stripeSubscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 5 });
      const activeSub = stripeSubscriptions.data.find(s => s.status === 'active' || s.status === 'trialing');

      if (!activeSub) {
         logs.push('No active subscription found in Stripe for customer');
         return res.json({ success: false, logs, error: 'No active subscription found' });
      }

      subscriptionId = activeSub.id;
      logs.push(\`Active subscription \${subscriptionId} found with status \${activeSub.status}\`);

      let planId = '';
      if (activeSub.items.data.length > 0) {
        planId = activeSub.items.data[0].price.id;
      }
      const app = 'musicscale'; 
      // Upsert using the existing robust logic
      if (!dryRun) {
         await upsertEcosystemSubscription(
           dbInstance,
           orgData.ownerUid || decodedToken.uid,
           orgId,
           customerId,
           activeSub,
           planId,
           app
         );
         logs.push(\`upsertEcosystemSubscription completed\`);
         
         await dbInstance.collection('audit_logs').add({
           action: 'repair_subscription',
           orgId,
           userId: decodedToken.uid,
           timestamp: admin.firestore.FieldValue.serverTimestamp(),
           logs
         });
      }

      return res.json({ success: true, dryRun, orgId, customerId, subscriptionId, logs });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

`;

content = content.replace(/app\.post\('\/api\/v1\/billing\/webhook'/g, repairEndpoint + "\n  app.post('/api/v1/billing/webhook'");
content = content.replace(/app\.post\('\/api\/stripe\/webhook'/g, repairEndpoint + "\n  app.post('/api/stripe/webhook'");

writeFileSync('server.ts', content);
