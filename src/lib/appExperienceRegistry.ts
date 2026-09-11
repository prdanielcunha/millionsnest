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
 * Canonical Hub -> app navigation contract.
 *
 * The Hub references semantic destination ids instead of scattering app routes
 * across UI components. When an app changes an internal route, only this
 * registry needs to change. Apps that are not operational yet intentionally
 * expose no destinations; their three-section experience becomes actionable
 * only when the app publishes its real route contract.
 */
export const APP_EXPERIENCE_REGISTRY: Readonly<Record<string, AppExperienceDefinition>> = {
  musicscale: {
    appId: 'musicscale',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {
      home: '/',
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
    destinations: {}
  },
  nestlocal: {
    appId: 'nestlocal',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {}
  },
  nestjourney: {
    appId: 'nestjourney',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {}
  },
  connect: {
    appId: 'connect',
    sections: APP_EXPERIENCE_SECTIONS,
    destinations: {
      home: '/'
    }
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
  if (!cleanPath.startsWith('/') || cleanPath.includes('://') || cleanPath.includes('\\')) return false;

  const staticPaths = Object.values(definition.destinations);
  if (staticPaths.some(path => cleanPath === path)) return true;

  const dynamicRoots = Object.values(definition.dynamicDestinations || {})
    .map(pattern => pattern.split('/:id')[0])
    .filter(Boolean);

  return dynamicRoots.some(root => cleanPath.startsWith(`${root}/`));
}
