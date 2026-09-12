export const CONNECT_OFFICIAL_URL = 'https://connect.millionsnest.com';
export const CONNECT_HUB_LAUNCH_PATH = '/connect/launch';

const ECOSYSTEM_LAUNCH_PATH = /^\/apps\/(musicscale|nestfinance|nestjourney)\/launch$/;

function isSafeLaunchNext(next: string): boolean {
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return false;

  const questionMark = next.indexOf('?');
  const pathname = questionMark >= 0 ? next.slice(0, questionMark) : next;
  const search = questionMark >= 0 ? next.slice(questionMark) : '';

  if (pathname !== CONNECT_HUB_LAUNCH_PATH && !ECOSYSTEM_LAUNCH_PATH.test(pathname)) {
    return false;
  }

  if (!search) return true;

  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (key !== 'returnTo') return false;
  }

  const returnTo = params.get('returnTo');
  return !returnTo || (
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !returnTo.includes('://') &&
    !returnTo.includes('\\')
  );
}

export function resolveSafePostLoginPath(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const next = params.get('next');
  return next && isSafeLaunchNext(next) ? next : null;
}

export function buildConnectLoginPath(): string {
  return `/login?next=${encodeURIComponent(CONNECT_HUB_LAUNCH_PATH)}`;
}

export function buildEcosystemLoginPath(appId: string, returnTo?: string | null): string {
  const cleanAppId = String(appId || '').trim().toLowerCase();
  const launchPath = `/apps/${encodeURIComponent(cleanAppId)}/launch`;
  if (!ECOSYSTEM_LAUNCH_PATH.test(launchPath)) {
    return '/login';
  }

  const launchUrl = new URL(launchPath, 'https://www.millionsnest.com');
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://') && !returnTo.includes('\\')) {
    launchUrl.searchParams.set('returnTo', returnTo);
  }

  const next = `${launchUrl.pathname}${launchUrl.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

export function resolveCanonicalConnectOrganizationId(
  canonicalContext: any,
): string | null {
  const candidate = typeof canonicalContext?.activeOrganizationId === 'string'
    ? canonicalContext.activeOrganizationId.trim()
    : '';
  return candidate || null;
}
