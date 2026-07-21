export type InvitationRedirectData = {
  organizationId: string;
  token: string;
  path: string;
};

export type InvitationRedirectFailureReason =
  | 'MISSING_VALUE'
  | 'INVALID_FORMAT'
  | 'INVALID_PATH'
  | 'INVALID_ORGANIZATION_ID'
  | 'INVALID_TOKEN'
  | 'UNEXPECTED_PARAMETER';

export type InvitationRedirectParseResult =
  | {
      valid: true;
      data: InvitationRedirectData;
    }
  | {
      valid: false;
      reasonCode: InvitationRedirectFailureReason;
    };

export function isValidInvitationOrganizationId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 1 || value.length > 128) return false;
  const regex = /^[A-Za-z0-9_-]+$/;
  return regex.test(value);
}

export function isValidInvitationRedirectToken(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 16 || value.length > 2048) return false;
  const regex = /^[A-Za-z0-9_\-.~]+$/;
  return regex.test(value);
}

export function buildInvitationRedirectPath(
  organizationId: unknown,
  token: unknown
): InvitationRedirectParseResult {
  if (!isValidInvitationOrganizationId(organizationId)) {
    return { valid: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }
  if (!isValidInvitationRedirectToken(token)) {
    return { valid: false, reasonCode: 'INVALID_TOKEN' };
  }

  return {
    valid: true,
    data: {
      organizationId,
      token,
      path: `/join/${organizationId}?token=${token}`,
    },
  };
}

export function parseInvitationRedirectPath(value: unknown): InvitationRedirectParseResult {
  if (typeof value !== 'string') return { valid: false, reasonCode: 'MISSING_VALUE' };
  if (!value) return { valid: false, reasonCode: 'MISSING_VALUE' };

  if (value.startsWith('//') || value.startsWith('http://') || value.startsWith('https://')) {
    return { valid: false, reasonCode: 'INVALID_PATH' };
  }

  if (value.includes('#')) {
    return { valid: false, reasonCode: 'INVALID_FORMAT' };
  }

  if (value.endsWith('/')) {
    return { valid: false, reasonCode: 'INVALID_PATH' };
  }

  const questionMarkIndex = value.indexOf('?');
  if (questionMarkIndex === -1) {
    return { valid: false, reasonCode: 'INVALID_FORMAT' };
  }

  const pathPart = value.substring(0, questionMarkIndex);
  const queryPart = value.substring(questionMarkIndex + 1);

  const pathSegments = pathPart.split('/');
  if (pathSegments.length !== 3) {
    return { valid: false, reasonCode: 'INVALID_PATH' };
  }
  if (pathSegments[0] !== '') {
    return { valid: false, reasonCode: 'INVALID_PATH' };
  }
  if (pathSegments[1] !== 'join') {
    return { valid: false, reasonCode: 'INVALID_PATH' };
  }

  const organizationId = pathSegments[2];
  if (!organizationId) {
    return { valid: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }

  const queryPairs = queryPart.split('&');
  if (queryPairs.length !== 1) {
    return { valid: false, reasonCode: 'UNEXPECTED_PARAMETER' };
  }

  const tokenPair = queryPairs[0];
  if (tokenPair === undefined) {
    return { valid: false, reasonCode: 'INVALID_FORMAT' };
  }
  const eqIndex = tokenPair.indexOf('=');
  if (eqIndex === -1) {
    return { valid: false, reasonCode: 'INVALID_FORMAT' };
  }

  const paramName = tokenPair.substring(0, eqIndex);
  const paramValue = tokenPair.substring(eqIndex + 1);

  if (paramName !== 'token') {
    return { valid: false, reasonCode: 'UNEXPECTED_PARAMETER' };
  }

  if (!paramValue) {
    return { valid: false, reasonCode: 'INVALID_TOKEN' };
  }

  const token = paramValue;

  if (!isValidInvitationOrganizationId(organizationId)) {
    return { valid: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }

  if (!isValidInvitationRedirectToken(token)) {
    return { valid: false, reasonCode: 'INVALID_TOKEN' };
  }

  const expectedPath = `/join/${organizationId}?token=${token}`;
  if (value !== expectedPath) {
    return { valid: false, reasonCode: 'INVALID_FORMAT' };
  }

  return {
    valid: true,
    data: {
      organizationId,
      token,
      path: value,
    },
  };
}
