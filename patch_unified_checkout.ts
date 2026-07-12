import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('server.ts', 'utf8');

const regex = /app\.post\('\/api\/v1\/billing\/unified-checkout', async \(req, res\) => \{\s*try \{\s*const \{ userId, email, planLookupKey, addonLookupKeys, promoCodeId \} = req\.body;/m;

const replacement = `app.post('/api/v1/billing/unified-checkout', async (req: any, res) => {
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
      
      const { planLookupKey, addonLookupKeys, promoCodeId } = req.body;
      const userId = decodedToken.uid;
      const email = decodedToken.email || req.body.email;`;

content = content.replace(regex, replacement);
writeFileSync('server.ts', content);
