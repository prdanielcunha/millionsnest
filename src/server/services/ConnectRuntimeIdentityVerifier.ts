import { OAuth2Client } from 'google-auth-library';

export type VerifiedConnectRuntimeIdentity = {
  email: string;
  subject: string;
};

const client = new OAuth2Client();

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Verifies a Google-signed Cloud Run service identity token.
 *
 * This is intentionally distinct from Firebase end-user authentication. The
 * endpoint using this verifier is service-to-service only and accepts exactly
 * the dedicated Connect runtime service account for the fixed audience.
 */
export async function verifyConnectRuntimeIdentityToken(params: {
  idToken: string;
  audience: string;
  expectedServiceAccountEmail: string;
}): Promise<VerifiedConnectRuntimeIdentity> {
  const idToken = clean(params.idToken);
  const audience = clean(params.audience);
  const expectedEmail = clean(params.expectedServiceAccountEmail).toLowerCase();

  if (!idToken || !audience || !expectedEmail) {
    throw new Error('CONNECT_RUNTIME_IDENTITY_CONFIGURATION_INVALID');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();
  const email = clean(payload?.email).toLowerCase();
  const subject = clean(payload?.sub);

  if (!email || email !== expectedEmail || payload?.email_verified !== true || !subject) {
    throw new Error('CONNECT_RUNTIME_IDENTITY_DENIED');
  }

  return { email, subject };
}
