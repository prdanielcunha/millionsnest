const DEFAULT_WHATSAPP_NUMBER = '5543999907071';

export function getSupportConfig() {
  const envProvider = process.env.SUPPORT_EMAIL_PROVIDER;
  const rawEmailTo = process.env.SUPPORT_EMAIL_TO;
  const fromEmail = process.env.SUPPORT_FROM_EMAIL || null;
  const resendApiKey = process.env.RESEND_API_KEY || null;

  // Simple email verification regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let recipientEmail = 'millionsnest@gmail.com';
  if (rawEmailTo && emailRegex.test(rawEmailTo.trim())) {
    recipientEmail = rawEmailTo.trim();
  }

  // If RESEND_API_KEY or SUPPORT_FROM_EMAIL are missing, provider is effectively disabled
  let provider: 'resend' | 'disabled' = 'disabled';
  if (envProvider === 'resend' && resendApiKey && fromEmail) {
    provider = 'resend';
  }

  // WhatsApp Configuration
  const normalizeNumber = (raw: string | undefined | null) => {
    if (!raw) return null;
    const normalized = raw.replace(/[\s\-\(\)\+]/g, '');
    if (/^\d{10,15}$/.test(normalized) && !normalized.startsWith('00') && !raw.includes('http')) {
      return normalized;
    }
    return null;
  };

  const rawSupportNumber = process.env.SUPPORT_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER;
  const rawSalesNumber = process.env.SALES_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER;

  const whatsappNumber = normalizeNumber(rawSupportNumber);
  const salesWhatsappNumber = normalizeNumber(rawSalesNumber);

  return {
    provider,
    recipientEmail,
    fromEmail,
    resendApiKey,
    whatsappNumber,
    isWhatsAppConfigured: !!whatsappNumber,
    salesWhatsappNumber,
    isSalesWhatsAppConfigured: !!salesWhatsappNumber
  };
}
