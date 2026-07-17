import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { planSupportTicketRequest } from './SupportTicketPlanner.js';
import { getSupportConfig } from '../config/supportConfig.js';
import { deliverSupportTicketEmail } from './SupportEmailAdapter.js';
import { resolveEcosystemPrivilegePolicy, resolveEffectiveSupportAccess } from '../../lib/permissionService.js';

export async function createSupportTicket(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
    }

    const uid = decodedToken.uid;
    const userEmail = decodedToken.email || '';

    const nowMs = Date.now();
    const plannerResult = planSupportTicketRequest(req.body, nowMs);

    if (!plannerResult.success || !plannerResult.normalized) {
      return res.status(400).json({ success: false, reasonCode: plannerResult.reasonCode });
    }

    const { normalized } = plannerResult;

    const db = admin.firestore();

    // Check organization existence
    const orgDoc = await db.collection('organizations').doc(normalized.organizationId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' });
    }
    const orgData = orgDoc.data() || {};

    // Load user doc for system role and active organization
    const userDoc = await db.collection('users').doc(uid).get();
    const userDocData = userDoc.exists ? userDoc.data() : null;

    const systemRole = userDocData?.systemRole || 'user';
    const privilegePolicy = resolveEcosystemPrivilegePolicy(systemRole);

    if (!privilegePolicy.canBypassSupportMembership) {
      const userActiveOrgId = userDocData?.activeOrganizationId || userDocData?.organizationId;
      if (normalized.organizationId !== userActiveOrgId) {
        return res.status(409).json({ success: false, reasonCode: 'ORGANIZATION_CONTEXT_MISMATCH' });
      }

      // Check membership
      const memberDoc = await db.collection('organizations').doc(normalized.organizationId).collection('members').doc(uid).get();
      if (!memberDoc.exists) {
        return res.status(403).json({ success: false, reasonCode: 'MEMBERSHIP_REQUIRED' });
      }
      const memberData = memberDoc.data();
      const memberStatus = memberData?.status;
      if (memberStatus && memberStatus !== 'active') {
        return res.status(403).json({ success: false, reasonCode: 'MEMBERSHIP_INACTIVE' });
      }
    }

    // Resolve support tier and access source
    const subDoc = await db.collection('subscriptions').doc(normalized.organizationId).get();
    const subData = subDoc.exists ? subDoc.data() : null;

    const resolvedAccess = resolveEffectiveSupportAccess({
      systemRole,
      subscription: subData,
      organization: orgData
    });

    const { supportTier, accessSource } = resolvedAccess;

    // Derive display name
    let displayName = decodedToken.name || '';
    if (!displayName && userDocData?.displayName) {
      displayName = userDocData.displayName;
    }
    if (!displayName) {
      displayName = userEmail ? userEmail.split('@')[0] : `Usuário ${uid.substring(0, 5)}`;
    }

    // Config details
    const config = getSupportConfig();

    const hash = crypto.createHash('sha256').update(`${uid}:${normalized.requestId}`).digest('hex');
    const ticketId = hash.substring(0, 40);
    const reference = `MN-${hash.substring(0, 8).toUpperCase()}`;

    const ticketRef = db.collection('support_tickets').doc(ticketId);
    const rateLimitRef = db.collection('support_ticket_rate_limits').doc(uid);

    const result = await db.runTransaction(async (transaction) => {
      const ticketDocSnap = await transaction.get(ticketRef);
      if (ticketDocSnap.exists) {
        return {
          alreadyExists: true,
          ticketId,
          reference
        };
      }

      // Verify rate limit
      const rateLimitDoc = await transaction.get(rateLimitRef);
      let count = 0;
      let windowStartedAtMs = nowMs;

      if (rateLimitDoc.exists) {
        const data = rateLimitDoc.data();
        const lastWindow = data?.windowStartedAtMs || nowMs;
        if (nowMs - lastWindow < 15 * 60 * 1000) {
          count = data?.count || 0;
          windowStartedAtMs = lastWindow;
        } else {
          count = 0;
          windowStartedAtMs = nowMs;
        }
      }

      if (count >= 5) {
        return {
          rateLimited: true
        };
      }

      // Create Ticket Payload
      const ticketPayload = {
        schemaVersion: 1,
        id: ticketId,
        reference,
        status: 'open',
        channel: 'form',

        organizationId: normalized.organizationId,
        organizationName: orgData.name || '',

        userId: uid,
        userName: displayName,
        userEmail,

        whatsapp: normalized.whatsapp || null,
        category: normalized.category,
        message: normalized.message,

        appId: normalized.appId || null,
        pagePath: normalized.pagePath || null,
        locale: normalized.locale,

        supportTier,
        supportAccessSource: accessSource,

        emailDelivery: {
          provider: config.provider,
          status: config.provider === 'disabled' ? 'not_configured' : 'pending',
          attemptedAt: null,
          sentAt: null,
          errorCode: null
        },

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(ticketRef, ticketPayload);

      // Update Rate Limit
      transaction.set(rateLimitRef, {
        windowStartedAtMs,
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Create Audit Log in organizations/{organizationId}/audit_logs/{auditId}
      const auditId = db.collection('organizations').doc(normalized.organizationId).collection('audit_logs').doc().id;
      const auditRef = db.collection('organizations').doc(normalized.organizationId).collection('audit_logs').doc(auditId);
      transaction.set(auditRef, {
        action: 'support.ticket.created',
        actorUid: uid,
        ticketId,
        ticketReference: reference,
        supportTier,
        supportAccessSource: accessSource,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        alreadyExists: false,
        ticketId,
        reference,
        ticketPayload
      };
    });

    if (result.rateLimited) {
      return res.status(429).json({ success: false, reasonCode: 'RATE_LIMITED' });
    }

    if (!result.alreadyExists && result.ticketPayload && config.provider === 'resend') {
      deliverSupportTicketEmail(result.ticketPayload).catch(err => {
        console.error('[SupportTicketService] Background email delivery error:', err);
      });
    }

    return res.status(200).json({
      success: true,
      ticketId: result.ticketId,
      reference: result.reference,
      status: 'open'
    });
  } catch (error: any) {
    console.error('[SupportTicketService] CRITICAL ERROR:', error.message);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
