import { createHash, randomBytes } from 'node:crypto';
import { isValidInvitationRedirectToken } from '../../lib/InvitationRedirectPolicy.js';

export const INVITATION_TOKEN_ENTROPY_BYTES = 32;
export const INVITATION_TOKEN_HASH_ALGORITHM = 'sha256';
export const INVITATION_TOKEN_HASH_HEX_LENGTH = 64;

export type InvitationTokenMaterial = {
  rawToken: string;
  tokenHash: string;
};

export type InvitationTokenFailureReason =
  | 'INVALID_ENTROPY'
  | 'TOKEN_GENERATION_FAILED'
  | 'TOKEN_STATE_INCONSISTENT';

export type InvitationTokenResult =
  | {
      success: true;
      material: InvitationTokenMaterial;
    }
  | {
      success: false;
      reasonCode: InvitationTokenFailureReason;
    };

export function deriveInvitationTokenMaterial(entropy: unknown): InvitationTokenResult {
  if (!(entropy instanceof Uint8Array)) {
    return { success: false, reasonCode: 'INVALID_ENTROPY' };
  }

  if (entropy.length !== INVITATION_TOKEN_ENTROPY_BYTES) {
    return { success: false, reasonCode: 'INVALID_ENTROPY' };
  }

  try {
    const rawToken = Buffer.from(entropy).toString('base64url');

    if (rawToken.length !== 43) {
      return { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' };
    }

    if (!isValidInvitationRedirectToken(rawToken)) {
      return { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' };
    }

    const tokenHash = createHash(INVITATION_TOKEN_HASH_ALGORITHM)
      .update(rawToken, 'utf8')
      .digest('hex');

    if (
      tokenHash.length !== INVITATION_TOKEN_HASH_HEX_LENGTH ||
      !/^[a-f0-9]{64}$/.test(tokenHash)
    ) {
      return { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' };
    }

    return {
      success: true,
      material: {
        rawToken,
        tokenHash
      }
    };
  } catch {
    return { success: false, reasonCode: 'TOKEN_STATE_INCONSISTENT' };
  }
}

export function generateInvitationTokenMaterial(): InvitationTokenResult {
  try {
    const entropy = randomBytes(INVITATION_TOKEN_ENTROPY_BYTES);
    return deriveInvitationTokenMaterial(entropy);
  } catch {
    return { success: false, reasonCode: 'TOKEN_GENERATION_FAILED' };
  }
}
