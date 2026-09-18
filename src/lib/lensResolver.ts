import { resolveEcosystemPrivilegePolicy } from './permissionService.js';

export type HubLensId =
  | 'my_today'
  | 'pastoral'
  | 'journey'
  | 'worship'
  | 'finance'
  | 'administration';

export type HubResponsibility =
  | 'pastoral_care'
  | 'journey_leadership'
  | 'worship_leadership'
  | 'finance_operations'
  | 'organization_administration';

export type HubLensDomain = Exclude<HubLensId, 'my_today'>;

export interface HubLensAuthorizationProjection {
  pastoral?: boolean;
  journey?: boolean;
  worship?: boolean;
  finance?: boolean;
  administration?: boolean;
}

export interface HubLensResolverInput {
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  authorizedDomains?: HubLensAuthorizationProjection;
  entitledAppIds?: readonly string[];
}

export interface ResolvedHubLens {
  id: HubLensId;
  source: 'personal' | 'authorized_domain' | 'global_governance';
  preferred: boolean;
}

const LENS_ORDER: readonly HubLensId[] = [
  'my_today',
  'pastoral',
  'journey',
  'worship',
  'finance',
  'administration'
];

const RESPONSIBILITY_BY_LENS: Partial<Record<HubLensId, HubResponsibility>> = {
  pastoral: 'pastoral_care',
  journey: 'journey_leadership',
  worship: 'worship_leadership',
  finance: 'finance_operations',
  administration: 'organization_administration'
};

const REQUIRED_APP_BY_LENS: Partial<Record<HubLensId, string>> = {
  journey: 'nestjourney',
  worship: 'musicscale',
  finance: 'nestfinance'
};

function hasEntitledApp(
  lensId: HubLensId,
  entitledAppIds: ReadonlySet<string>
): boolean {
  const requiredApp = REQUIRED_APP_BY_LENS[lensId];
  return !requiredApp || entitledAppIds.has(requiredApp);
}

function isPreferred(
  lensId: HubLensId,
  responsibilities: ReadonlySet<HubResponsibility>
): boolean {
  const responsibility = RESPONSIBILITY_BY_LENS[lensId];
  return Boolean(responsibility && responsibilities.has(responsibility));
}

/**
 * Resolves presentation lenses from authorization decisions that were already
 * made by the authoritative RBAC/domain layers.
 *
 * A lens never grants access. Responsibilities can mark an already-authorized
 * lens as preferred, but responsibility alone is deliberately insufficient to
 * make sensitive domain data visible.
 *
 * Global governance grants the administrative lens only. It does not imply
 * pastoral, Journey, worship or finance content access.
 */
export function resolveAvailableHubLenses(
  input: HubLensResolverInput
): ResolvedHubLens[] {
  const responsibilities = new Set(input.responsibilities ?? []);
  const entitledAppIds = new Set(input.entitledAppIds ?? []);
  const authorizedDomains = input.authorizedDomains ?? {};
  const privilegePolicy = resolveEcosystemPrivilegePolicy(input.systemRole);

  const lenses: ResolvedHubLens[] = [
    {
      id: 'my_today',
      source: 'personal',
      preferred: true
    }
  ];

  const domainLensIds: readonly HubLensDomain[] = [
    'pastoral',
    'journey',
    'worship',
    'finance',
    'administration'
  ];

  for (const lensId of domainLensIds) {
    if (!hasEntitledApp(lensId, entitledAppIds)) continue;

    const authorizedByDomain = authorizedDomains[lensId] === true;
    const authorizedByGlobalGovernance =
      lensId === 'administration' && privilegePolicy.canManageGlobalGovernance;

    if (!authorizedByDomain && !authorizedByGlobalGovernance) continue;

    lenses.push({
      id: lensId,
      source: authorizedByGlobalGovernance ? 'global_governance' : 'authorized_domain',
      preferred: isPreferred(lensId, responsibilities)
    });
  }

  return lenses.sort(
    (a, b) => LENS_ORDER.indexOf(a.id) - LENS_ORDER.indexOf(b.id)
  );
}

export function resolveDefaultHubLens(lenses: readonly ResolvedHubLens[]): HubLensId {
  const preferredDomainLens = lenses.find(
    lens => lens.id !== 'my_today' && lens.preferred
  );

  return preferredDomainLens?.id ?? 'my_today';
}

/**
 * Reconciles a previously selected Lens with the current authorization set.
 * A stale persisted/UI selection can never keep a Lens alive after authority,
 * responsibility or product availability changes.
 */
export function resolveActiveHubLens(
  requestedLens: HubLensId | string | null | undefined,
  lenses: readonly ResolvedHubLens[]
): HubLensId {
  const available = new Set(lenses.map(lens => lens.id));

  if (requestedLens && available.has(requestedLens as HubLensId)) {
    return requestedLens as HubLensId;
  }

  return resolveDefaultHubLens(lenses);
}
