export const CONNECT_OFFICIAL_URL = 'https://connect.millionsnest.com';
export const CONNECT_HUB_LAUNCH_PATH = '/connect/launch';

const ECOSYSTEM_LAUNCH_PATH = /^\/apps\/(musicscale|nestfinance|nestjourney)\/launch$/;
const MUSICSCALE_MAIN_PREVIEW_HOST = /^mn-musicscale-555464791734--main-review-[a-z0-9-]+\.web\.app$/;

export function resolveTrustedEcosystemReturnOrigin(
  appId: string,
  candidate?: string | null,
): string | null {
  if (String(appId || '').trim().toLowerCase() !== 'musicscale' || !candidate) return null;

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !MUSICSCALE_MAIN_PREVIEW_HOST.test(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isSafeLaunchNext(next: string): boolean {
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return false;

  const questionMark = next.indexOf('?');
  const pathname = questionMark >= 0 ? next.slice(0, questionMark) : next;
  const search = questionMark >= 0 ? next.slice(questionMark) : '';
  const ecosystemMatch = pathname.match(ECOSYSTEM_LAUNCH_PATH);

  if (pathname !== CONNECT_HUB_LAUNCH_PATH && !ecosystemMatch) {
    return false;
  }

  if (!search) return true;

  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (key !== 'returnTo' && key !== 'returnOrigin') return false;
  }

  const returnTo = params.get('returnTo');
  if (returnTo && !(
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !returnTo.includes('://') &&
    !returnTo.includes('\\')
  )) {
    return false;
  }

  const returnOrigin = params.get('returnOrigin');
  if (returnOrigin) {
    const appId = ecosystemMatch?.[1] || '';
    if (!resolveTrustedEcosystemReturnOrigin(appId, returnOrigin)) return false;
  }

  return true;
}

export function resolveSafePostLoginPath(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const next = params.get('next');
  return next && isSafeLaunchNext(next) ? next : null;
}

export function buildConnectLoginPath(): string {
  return `/login?next=${encodeURIComponent(CONNECT_HUB_LAUNCH_PATH)}`;
}

export function buildEcosystemLoginPath(
  appId: string,
  returnTo?: string | null,
  returnOrigin?: string | null,
): string {
  const cleanAppId = String(appId || '').trim().toLowerCase();
  const launchPath = `/apps/${encodeURIComponent(cleanAppId)}/launch`;
  if (!ECOSYSTEM_LAUNCH_PATH.test(launchPath)) {
    return '/login';
  }

  const launchUrl = new URL(launchPath, 'https://www.millionsnest.com');
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://') && !returnTo.includes('\\')) {
    launchUrl.searchParams.set('returnTo', returnTo);
  }

  const trustedReturnOrigin = resolveTrustedEcosystemReturnOrigin(cleanAppId, returnOrigin);
  if (trustedReturnOrigin) {
    launchUrl.searchParams.set('returnOrigin', trustedReturnOrigin);
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
