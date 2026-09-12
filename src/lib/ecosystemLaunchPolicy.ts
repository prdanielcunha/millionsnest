import { getEcosystemAppDomain, getSafeLiveLaunchPaths } from './ecosystemAppDomains.js';

export function resolveSafeEcosystemPostLoginPath(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const next = params.get('next');
  if (!next) return null;
  return getSafeLiveLaunchPaths().includes(next) ? next : null;
}

export function buildEcosystemLoginPath(appId: string): string {
  const app = getEcosystemAppDomain(appId);
  if (!app?.hubLaunchPath || app.ssoStatus !== 'live') {
    throw new Error(`App ${appId} does not have a live direct-SSO launch path.`);
  }
  return `/login?next=${encodeURIComponent(app.hubLaunchPath)}`;
}

export function resolveCanonicalEcosystemOrganizationId(canonicalContext: any): string | null {
  const candidate = typeof canonicalContext?.activeOrganizationId === 'string'
    ? canonicalContext.activeOrganizationId.trim()
    : '';
  return candidate || null;
}
