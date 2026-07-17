import { getSupportConfig } from '../config/supportConfig.js';
import admin from 'firebase-admin';

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function deliverSupportTicketEmail(ticket: any): Promise<{
  status: 'sent' | 'failed' | 'not_configured';
  errorCode?: string | null;
  sentAt?: Date;
}> {
  const config = getSupportConfig();

  if (config.provider === 'disabled' || !config.resendApiKey || !config.fromEmail) {
    return { status: 'not_configured' };
  }

  const subject = `[MillionsNest] ${ticket.reference} · ${ticket.category} · ${ticket.organizationName}`;

  const escapedName = escapeHtml(ticket.userName);
  const escapedEmail = escapeHtml(ticket.userEmail);
  const escapedOrgName = escapeHtml(ticket.organizationName);
  const escapedWp = ticket.whatsapp ? escapeHtml(ticket.whatsapp) : 'N/A';
  const escapedMsg = escapeHtml(ticket.message).replace(/\n/g, '<br />');
  const escapedAppId = ticket.appId ? escapeHtml(ticket.appId) : 'N/A';
  const escapedPagePath = ticket.pagePath ? escapeHtml(ticket.pagePath) : 'N/A';

  const htmlBody = `
    <h2>Solicitação de Suporte</h2>
    <p><strong>Referência:</strong> ${ticket.reference}</p>
    <p><strong>Categoria:</strong> ${ticket.category}</p>
    <p><strong>Nome:</strong> ${escapedName}</p>
    <p><strong>E-mail:</strong> ${escapedEmail}</p>
    <p><strong>WhatsApp:</strong> ${escapedWp}</p>
    <p><strong>Organização:</strong> ${escapedOrgName} (${ticket.organizationId})</p>
    <p><strong>Support Tier:</strong> ${ticket.supportTier}</p>
    <p><strong>Aplicativo:</strong> ${escapedAppId}</p>
    <p><strong>Página:</strong> ${escapedPagePath}</p>
    <p><strong>Idioma:</strong> ${ticket.locale}</p>
    <p><strong>Data:</strong> ${new Date().toISOString()}</p>
    <hr />
    <p><strong>Mensagem:</strong></p>
    <p style="white-space: pre-wrap; font-family: sans-serif;">${escapedMsg}</p>
  `;

  const textBody = `
Solicitação de Suporte
----------------------
Referência: ${ticket.reference}
Categoria: ${ticket.category}
Nome: ${ticket.userName}
E-mail: ${ticket.userEmail}
WhatsApp: ${ticket.whatsapp || 'N/A'}
Organização: ${ticket.organizationName} (${ticket.organizationId})
Support Tier: ${ticket.supportTier}
Aplicativo: ${ticket.appId || 'N/A'}
Página: ${ticket.pagePath || 'N/A'}
Idioma: ${ticket.locale}
Data: ${new Date().toISOString()}

Mensagem:
---------
${ticket.message}
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [config.recipientEmail],
        subject,
        html: htmlBody,
        text: textBody
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const now = new Date();
      try {
        const db = admin.firestore();
        await db.collection('support_tickets').doc(ticket.id).update({
          'emailDelivery.status': 'sent',
          'emailDelivery.attemptedAt': admin.firestore.FieldValue.serverTimestamp(),
          'emailDelivery.sentAt': admin.firestore.FieldValue.serverTimestamp(),
          'emailDelivery.errorCode': null
        });
      } catch (err: any) {
        // Do not fail or throw
      }

      return { status: 'sent', sentAt: now };
    } else {
      const errorCode = `HTTP_${response.status}`;
      try {
        const db = admin.firestore();
        await db.collection('support_tickets').doc(ticket.id).update({
          'emailDelivery.status': 'failed',
          'emailDelivery.attemptedAt': admin.firestore.FieldValue.serverTimestamp(),
          'emailDelivery.errorCode': errorCode
        });
      } catch (err: any) {
        // Do not fail or throw
      }

      return { status: 'failed', errorCode };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    let errorCode = 'UNKNOWN_ERROR';
    if (error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
    } else if (error.code) {
      errorCode = error.code;
    }

    try {
      const db = admin.firestore();
      await db.collection('support_tickets').doc(ticket.id).update({
        'emailDelivery.status': 'failed',
        'emailDelivery.attemptedAt': admin.firestore.FieldValue.serverTimestamp(),
        'emailDelivery.errorCode': errorCode
      });
    } catch (err: any) {
      // Do not fail or throw
    }

    return { status: 'failed', errorCode };
  }
}
