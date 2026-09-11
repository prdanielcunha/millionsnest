import type { EcosystemApp } from './apps.js';

export type HubAppState =
  | 'active'
  | 'trialing'
  | 'cancel_scheduled'
  | 'payment_issue'
  | 'administrative'
  | 'loading'
  | 'error'
  | 'available'
  | 'unavailable'
  | 'coming_soon'
  | 'development';

export interface HubAppExperience {
  app: EcosystemApp;
  installed: boolean;
  canOpen: boolean;
  state: HubAppState;
  plan: string | null;
  needsAttention: boolean;
  isOperational: boolean;
}

const ACTIVE_APP_STATES = new Set<HubAppState>([
  'active',
  'trialing',
  'cancel_scheduled',
  'administrative'
]);

const normalizeState = (value: unknown): HubAppState | null => {
  const state = String(value || '').toLowerCase();
  if (
    state === 'active' ||
    state === 'trialing' ||
    state === 'cancel_scheduled' ||
    state === 'payment_issue' ||
    state === 'administrative' ||
    state === 'loading' ||
    state === 'error' ||
    state === 'available' ||
    state === 'unavailable' ||
    state === 'coming_soon' ||
    state === 'development'
  ) {
    return state;
  }
  if (state === 'beta') return 'development';
  if (state === 'past_due' || state === 'unpaid' || state === 'incomplete') return 'payment_issue';
  return null;
};

export function resolveHubAppExperience(params: {
  app: EcosystemApp;
  organization: any;
  subscription?: any;
  musicScaleAccess?: {
    accessible?: boolean;
    catalogState?: string | null;
  } | null;
  isGlobalAdmin?: boolean;
}): HubAppExperience {
  const { app, organization, subscription, musicScaleAccess, isGlobalAdmin } = params;
  const appRecord = organization?.apps?.[app.id] || null;
  const enabledApps = Array.isArray(organization?.enabledApps) ? organization.enabledApps : [];
  const explicitlyEnabled = enabledApps.includes(app.id) || appRecord?.enabled === true;
  const catalogOperational = app.status === 'active';

  if (app.id === 'musicscale') {
    const accessState = normalizeState(musicScaleAccess?.catalogState) || 'unavailable';
    const accessible = musicScaleAccess?.accessible === true;
    const state = isGlobalAdmin && accessible
      ? 'administrative'
      : accessState;
    const installed = accessible && ACTIVE_APP_STATES.has(state);
    return {
      app,
      installed,
      canOpen: installed,
      state,
      plan:
        isGlobalAdmin && accessible
          ? 'pro'
          : appRecord?.plan || subscription?.plan || subscription?.tier || organization?.subscriptionPlan || null,
      needsAttention: state === 'payment_issue' || state === 'error',
      isOperational: app.status === 'active'
    };
  }

  if (
    app.id === 'connect' &&
    app.status === 'beta' &&
    isGlobalAdmin === true &&
    typeof app.url === 'string' &&
    app.url.trim().length > 0
  ) {
    return {
      app,
      installed: true,
      canOpen: true,
      state: 'administrative',
      plan: null,
      needsAttention: false,
      isOperational: true
    };
  }

  if (!catalogOperational) {
    const state: HubAppState = app.status === 'coming_soon' ? 'coming_soon' : 'development';
    return {
      app,
      installed: false,
      canOpen: false,
      state,
      plan: appRecord?.plan || null,
      needsAttention: false,
      isOperational: false
    };
  }

  const rawState = normalizeState(appRecord?.status);
  const state: HubAppState = rawState || (explicitlyEnabled ? 'active' : 'available');
  const installed = explicitlyEnabled && ACTIVE_APP_STATES.has(state);

  return {
    app,
    installed,
    canOpen: installed,
    state,
    plan: appRecord?.plan || null,
    needsAttention: state === 'payment_issue' || state === 'error',
    isOperational: true
  };
}

export function resolveInstalledHubApps(
  apps: EcosystemApp[],
  params: Omit<Parameters<typeof resolveHubAppExperience>[0], 'app'>
): HubAppExperience[] {
  return apps
    .map(app => resolveHubAppExperience({ ...params, app }))
    .filter(experience => experience.installed)
    .sort((a, b) => (a.app.order || 99) - (b.app.order || 99));
}

function projectAdministrativePilotIntoCurrentHubSession(
  experiences: HubAppExperience[],
  organization: any,
): void {
  if (!organization || typeof organization !== 'object') return;

  const connectExperience = experiences.find(experience => experience.app.id === 'connect');
  if (
    !connectExperience ||
    connectExperience.state !== 'administrative' ||
    connectExperience.canOpen !== true
  ) {
    return;
  }

  const enabledApps = Array.isArray(organization.enabledApps)
    ? organization.enabledApps.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  if (!enabledApps.includes('connect')) {
    organization.enabledApps = [...enabledApps, 'connect'];
  }
}

export function resolveHubAppCatalog(
  apps: EcosystemApp[],
  params: Omit<Parameters<typeof resolveHubAppExperience>[0], 'app'>
): HubAppExperience[] {
  const experiences = apps
    .map(app => resolveHubAppExperience({ ...params, app }))
    .sort((a, b) => (a.app.order || 99) - (b.app.order || 99));

  projectAdministrativePilotIntoCurrentHubSession(experiences, params.organization);
  return experiences;
}
