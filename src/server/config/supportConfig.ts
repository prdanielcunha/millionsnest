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

  return {
    provider,
    recipientEmail,
    fromEmail,
    resendApiKey
  };
}
