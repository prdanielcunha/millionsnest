export type EcosystemDomainStatus = 'live' | 'planned' | 'repo_missing';
export type EcosystemSsoStatus = 'live' | 'consumer_ready' | 'planned';

export interface EcosystemAppDomainDefinition {
  id: 'hub' | 'musicscale' | 'connect' | 'nestfinance' | 'nestjourney' | 'nestlocal';
  name: string;
  canonicalOrigin: string;
  entryPath: string;
  hubLaunchPath: string | null;
  repository: string | null;
  domainStatus: EcosystemDomainStatus;
  ssoStatus: EcosystemSsoStatus;
  firebaseHosting: boolean;
  notes: string;
}

/**
 * Desired-state source of truth for public MillionsNest app origins.
 *
 * Rules:
 * - never promote a *.web.app address as the product URL;
 * - an app may be present here before DNS is live, but it must remain `planned`;
 * - direct app entry must go through a Hub launch bridge before `ssoStatus` becomes `live`;
 * - exact DNS records are never hard-coded here: Firebase Hosting generates them per site.
 *
 * Operational runbook: docs/ECOSYSTEM_APP_DOMAINS_AND_SSO.md
 */
export const ECOSYSTEM_APP_DOMAINS: readonly EcosystemAppDomainDefinition[] = [
  {
    id: 'hub',
    name: 'MillionsNest',
    canonicalOrigin: 'https://www.millionsnest.com',
    entryPath: '/',
    hubLaunchPath: null,
    repository: 'prdanielcunha/millionsnest',
    domainStatus: 'live',
    ssoStatus: 'live',
    firebaseHosting: true,
    notes: 'Central identity, organization, RBAC, billing and app launch authority.',
  },
  {
    id: 'musicscale',
    name: 'MusicScale',
    canonicalOrigin: 'https://musicscale.millionsnest.com',
    entryPath: '/start',
    hubLaunchPath: '/musicscale/launch',
    repository: 'prdanielcunha/musicscale_millionsnest',
    domainStatus: 'live',
    ssoStatus: 'live',
    firebaseHosting: true,
    notes: 'Canonical handoff already exists; direct-entry bridge is the required entry contract.',
  },
  {
    id: 'connect',
    name: 'MillionsNest Connect',
    canonicalOrigin: 'https://connect.millionsnest.com',
    entryPath: '/',
    hubLaunchPath: '/connect/launch',
    repository: 'prdanielcunha/millionsnest-connect',
    domainStatus: 'live',
    ssoStatus: 'live',
    firebaseHosting: true,
    notes: 'Certified direct-entry SSO through the Hub.',
  },
  {
    id: 'nestfinance',
    name: 'NestFinance',
    canonicalOrigin: 'https://nestfinance.millionsnest.com',
    entryPath: '/',
    hubLaunchPath: '/nestfinance/launch',
    repository: 'prdanielcunha/nestfinance_millionsnest',
    domainStatus: 'planned',
    ssoStatus: 'consumer_ready',
    firebaseHosting: true,
    notes: 'App already consumes a secure handoff code; Hub issuer/domain cutover must be certified before activation.',
  },
  {
    id: 'nestjourney',
    name: 'NestJourney',
    canonicalOrigin: 'https://nestjourney.millionsnest.com',
    entryPath: '/',
    hubLaunchPath: '/nestjourney/launch',
    repository: 'prdanielcunha/nestjourney',
    domainStatus: 'planned',
    ssoStatus: 'planned',
    firebaseHosting: true,
    notes: 'Firebase Hosting exists in the repo; production SSO must be promoted only after the paused integration branch is reviewed/certified.',
  },
  {
    id: 'nestlocal',
    name: 'NestLocal',
    canonicalOrigin: 'https://nestlocal.millionsnest.com',
    entryPath: '/',
    hubLaunchPath: '/nestlocal/launch',
    repository: null,
    domainStatus: 'repo_missing',
    ssoStatus: 'planned',
    firebaseHosting: true,
    notes: 'Reserve the official origin now; create/link the canonical repository before provisioning Hosting or SSO.',
  },
] as const;

export function getEcosystemAppDomain(appId: string): EcosystemAppDomainDefinition | null {
  return ECOSYSTEM_APP_DOMAINS.find((entry) => entry.id === appId) || null;
}

export function getSafeLiveLaunchPaths(): readonly string[] {
  return ECOSYSTEM_APP_DOMAINS
    .filter((entry) => entry.id !== 'hub' && entry.ssoStatus === 'live' && entry.hubLaunchPath)
    .map((entry) => entry.hubLaunchPath as string);
}
