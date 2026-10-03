import { getEcosystemApp } from './apps.js';

export type InvitationTargetResolution =
  | { valid: true; targetAppId: string | null }
  | { valid: false; reasonCode: 'INVALID_INVITE_TARGET_APP' };

export function resolveInvitationTargetAppId(value: unknown): InvitationTargetResolution {
  if (value === undefined || value === null || value === '') {
    return { valid: true, targetAppId: null };
  }

  if (typeof value !== 'string') {
    return { valid: false, reasonCode: 'INVALID_INVITE_TARGET_APP' };
  }

  const targetAppId = value.trim().toLowerCase();
  if (!targetAppId || targetAppId.length > 64 || !/^[a-z0-9_-]+$/.test(targetAppId)) {
    return { valid: false, reasonCode: 'INVALID_INVITE_TARGET_APP' };
  }

  const app = getEcosystemApp(targetAppId);
  if (!app?.canonicalOrigin || !app.invitationJoinPath || !app.invitationJoinPath.includes(':organizationId')) {
    return { valid: false, reasonCode: 'INVALID_INVITE_TARGET_APP' };
  }

  return { valid: true, targetAppId };
}

export function buildInvitationTargetUrl(
  targetAppId: string,
  organizationId: string,
  token: string
): string | null {
  const resolved = resolveInvitationTargetAppId(targetAppId);
  if (!resolved.valid || !resolved.targetAppId) return null;

  const app = getEcosystemApp(resolved.targetAppId);
  if (!app?.canonicalOrigin || !app.invitationJoinPath) return null;

  const path = app.invitationJoinPath.replace(':organizationId', encodeURIComponent(organizationId));
  const url = new URL(path, app.canonicalOrigin);
  url.searchParams.set('token', token);
  return url.toString();
}

export function isExpectedInvitationTargetUrl(params: {
  targetAppId: string;
  organizationId: string;
  token: string;
  inviteUrl: string;
}): boolean {
  const expected = buildInvitationTargetUrl(params.targetAppId, params.organizationId, params.token);
  if (!expected) return false;
  try {
    return new URL(params.inviteUrl).toString() === expected;
  } catch {
    return false;
  }
}
