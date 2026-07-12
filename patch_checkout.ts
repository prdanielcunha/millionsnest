import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('server.ts', 'utf8');

const regex2 = /app\.post\('\/api\/v1\/billing\/checkout', async \(req, res\) => \{\s*try \{\s*const \{ userId, email, lookupKey \} = req\.body;/m;

const replacement2 = `app.post('/api/v1/billing/checkout', async (req: any, res) => {
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

      const { lookupKey } = req.body;
      const userId = decodedToken.uid;
      const email = decodedToken.email || req.body.email;`;

content = content.replace(regex2, replacement2);

writeFileSync('server.ts', content);
