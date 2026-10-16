import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { authorizeQueuedJourneyEvent } from './NestJourneyDueOutbox.js';

/** Machine-only proof; never accepts user Bearer/roles or returns pastoral data. */
export function createJourneyQueuedEventAuthority(deps: {
  enabled: () => boolean; secret: () => string | undefined;
  targets: () => string | undefined; db: () => Firestore | null; now?: () => number;
}) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control','private, no-store');
    const now=(deps.now??Date.now)(), secret=deps.secret(), timestamp=req.headers['x-connect-timestamp'],
      signature=req.headers['x-connect-signature'], raw=req.body;
    if (!deps.enabled() || !secret || secret.length<32 || secret.length>4096 || !Buffer.isBuffer(raw) ||
        raw.length>4096 || typeof timestamp!=='string' || !/^\d{13}$/.test(timestamp) ||
        Math.abs(now-Number(timestamp))>300000 || typeof signature!=='string' || !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(createHmac('sha256',secret).update('nestjourney-authority\n'+timestamp+'\n').update(raw).digest(),
          Buffer.from(signature,'hex'))) {
      res.status(401).json({code:'SOURCE_AUTHORITY_AUTH_REQUIRED'});return;
    }
    let event: Record<string,unknown>;
    try {
      event=JSON.parse(raw.toString('utf8'));
      const keys=['schemaVersion','sourceApp','eventId','organizationId','conversationId','occurredAt','trigger','recipientUid'];
      if (!event || typeof event!=='object' || Array.isArray(event) || Object.keys(event).length!==keys.length ||
          Object.keys(event).some(k=>!keys.includes(k))) throw Error();
    } catch {res.status(400).json({code:'INVALID_SOURCE_AUTHORITY_EVENT'});return;}
    try {
      const db=deps.db();
      if (!db) throw Error();
      res.json({authorized:await authorizeQueuedJourneyEvent({db,event,operatorTargetsJson:deps.targets(),now:deps.now})});
    } catch {res.status(503).json({code:'SOURCE_AUTHORITY_UNAVAILABLE'});}
  };
}
