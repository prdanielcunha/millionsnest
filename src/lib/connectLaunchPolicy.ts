export const CONNECT_OFFICIAL_URL = 'https://connect.millionsnest.com';
export const CONNECT_HUB_LAUNCH_PATH = '/connect/launch';

export function resolveSafePostLoginPath(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const next = params.get('next');
  return next === CONNECT_HUB_LAUNCH_PATH ? CONNECT_HUB_LAUNCH_PATH : null;
}

export function buildConnectLoginPath(): string {
  return `/login?next=${encodeURIComponent(CONNECT_HUB_LAUNCH_PATH)}`;
}

export function resolveCanonicalConnectOrganizationId(
  canonicalContext: any,
): string | null {
  const candidate = typeof canonicalContext?.activeOrganizationId === 'string'
    ? canonicalContext.activeOrganizationId.trim()
    : '';
  return candidate || null;
}
