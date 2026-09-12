export type AppExperienceSection = 'overview' | 'getting-started' | 'resources';

export const APP_EXPERIENCE_SECTIONS: readonly AppExperienceSection[] = [
  'overview',
  'getting-started',
  'resources'
] as const;

export interface AppExperienceDefinition {
  appId: string;
  sections: readonly AppExperienceSection[];
  destinations: Readonly<Record<string, string>>;
  dynamicDestinations?: Readonly<Record<string, string>>;
}

/**
 * Canonical Hub -> app navigation contract. The same allowlist is also used by
 * direct-entry SSO so a return path can never become an open redirect.
 */
export const APP_EXPERIENCE_REGISTRY: Readonly<Record<string, AppExperienceDefinition>> = {
  musicscale: {
    appId: 'musicscale',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {
      home: '/',
      start: '/start',
      repertoire: '/songs',
      songs: '/songs',
      chords: '/songs',
      lyrics: '/songs',
      ai_import: '/songs',
      library: '/library',
      music_scales: '/scales',
      members: '/users',
      band_scales: '/band-scales',
      roles: '/roles',
      profile: '/profile',
      plan_usage: '/plan-usage',
      notifications: '/notifications'
    },
    dynamicDestinations: {
      music_scale: '/scales/:id'
    }
  },
  nestfinance: {
    appId: 'nestfinance',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {
      home: '/',
      finance: '/finance',
      setup: '/finance/setup',
      settings: '/finance/settings',
      accounts: '/finance/settings/accounts',
      entities: '/finance/settings/entities',
      funds: '/finance/settings/funds',
      categories: '/finance/settings/categories',
      count: '/finance/count',
      count_forms: '/finance/count/forms',
      capture: '/finance/capture',
      balance: '/finance/balance',
      inbox: '/finance/inbox',
      reports: '/finance/reports',
      audit: '/finance/audit',
      more: '/finance/more',
      transactions: '/finance/transactions',
      transaction_new: '/finance/transactions/new',
      review: '/finance/review'
    },
    dynamicDestinations: {
      count_session: '/finance/count/:id',
      count_form: '/finance/count/forms/:id',
      capture_review: '/finance/count/captures/:id',
      inbox_evidence: '/finance/inbox/:id',
      transaction: '/finance/transactions/:id',
      review_transaction: '/finance/review/:id'
    }
  },
  nestlocal: {
    appId: 'nestlocal',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {}
  },
  nestjourney: {
    appId: 'nestjourney',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: { home: '/' }
  },
  connect: {
    appId: 'connect',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: { home: '/' }
  }
};

export function getAppExperienceDefinition(appId: string): AppExperienceDefinition | null {
  return APP_EXPERIENCE_REGISTRY[appId] || null;
}

export function resolveAppDestination(appId: string, destinationId: string): string | null {
  const definition = getAppExperienceDefinition(appId);
  const path = definition?.destinations?.[destinationId];
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}

export function resolveAppEntityDestination(
  appId: string,
  destinationId: string,
  entityId: string
): string | null {
  const definition = getAppExperienceDefinition(appId);
  const pattern = definition?.dynamicDestinations?.[destinationId];
  const cleanEntityId = String(entityId || '').trim();

  if (!pattern || !cleanEntityId || !pattern.includes(':id')) return null;

  return pattern.replace(':id', encodeURIComponent(cleanEntityId));
}

export function isAllowedAppDestinationPath(appId: string, candidatePath: string): boolean {
  const definition = getAppExperienceDefinition(appId);
  if (!definition) return false;

  const cleanPath = String(candidatePath || '').trim();
  if (!cleanPath.startsWith('/') || cleanPath.startsWith('//') || cleanPath.includes('://') || cleanPath.includes('\\')) return false;

  const staticPaths = Object.values(definition.destinations);
  if (staticPaths.some(path => cleanPath === path)) return true;

  const dynamicRoots = Object.values(definition.dynamicDestinations || {})
    .map(pattern => pattern.split('/:id')[0])
    .filter(Boolean);

  return dynamicRoots.some(root => cleanPath.startsWith(`${root}/`));
}
