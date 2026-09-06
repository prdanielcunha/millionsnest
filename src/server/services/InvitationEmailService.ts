export type InvitationEmailDeliveryResult =
  | { success: true; provider: 'resend'; providerMessageId?: string }
  | { success: false; reasonCode: 'NOT_CONFIGURED' | 'DELIVERY_FAILED' };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character] || character));

export async function deliverInvitationEmail(params: {
  recipientEmail: string;
  organizationName: string;
  inviteUrl: string;
  roleLabel: string;
}): Promise<InvitationEmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITATION_FROM_EMAIL || process.env.SUPPORT_FROM_EMAIL;

  if (!apiKey || !from) {
    return { success: false, reasonCode: 'NOT_CONFIGURED' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const organizationName = escapeHtml(params.organizationName);
    const inviteUrl = escapeHtml(params.inviteUrl);
    const roleLabel = escapeHtml(params.roleLabel);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [params.recipientEmail],
        subject: `Convite para ${params.organizationName} no MillionsNest`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
            <h2 style="margin-bottom:12px">Você foi convidado para ${organizationName}</h2>
            <p style="line-height:1.6;color:#4b5563">
              Sua função inicial será <strong>${roleLabel}</strong>. Use o botão abaixo e entre com o mesmo e-mail que recebeu este convite.
            </p>
            <p style="margin:28px 0">
              <a href="${inviteUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">
                Aceitar convite
              </a>
            </p>
            <p style="font-size:12px;line-height:1.6;color:#6b7280">
              Por segurança, este link é individual e expira. Se você não esperava este convite, pode ignorar esta mensagem.
            </p>
          </div>
        `,
        text: `Você foi convidado para ${params.organizationName} no MillionsNest como ${params.roleLabel}. Acesse: ${params.inviteUrl}`
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { success: false, reasonCode: 'DELIVERY_FAILED' };
    }

    const payload = await response.json().catch(() => ({}));
    return {
      success: true,
      provider: 'resend',
      providerMessageId: typeof payload?.id === 'string' ? payload.id : undefined
    };
  } catch {
    return { success: false, reasonCode: 'DELIVERY_FAILED' };
  } finally {
    clearTimeout(timer);
  }
}
