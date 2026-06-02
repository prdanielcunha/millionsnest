// Canonical source of truth for MusicScale plans, features, and limits
// Aligned with the MillionsNest Eco-system Architecture

export type MusicScalePlan = 'starter' | 'advanced' | 'pro';

export interface PlanLimits {
  users: number; // -1 for unlimited
  songs: number;
  scales: number;
  bandScales: number;
  libraryImportsPerMonth: number; // -1 for unlimited
}

export interface PlanFeatures {
  songsUnlimited: boolean;
  scalesUnlimited: boolean;
  basicSongFields: boolean;
  cloudSync: boolean;
  shareScales: boolean;
  libraryAccess: boolean;
  libraryLimited: boolean;
  libraryComplete: boolean;
  aiImport: boolean;
  aiStructuring: boolean;
  aiSuggestions: boolean;
  aiSetlistInsights: boolean;
  scaleCloning: boolean;
  fullHistory: boolean;
  advancedRepertoireCustomization: boolean;
  futurePremiumFeatures: boolean;
  priorityNewFeatures: boolean;
  supportTier: 'standard' | 'basic_priority' | 'priority';
}

export interface MusicScalePlanDefinition {
  id: MusicScalePlan;
  name: string;
  priceMonthly: number;
  currency: string;
  trialDays: number;
  launchPrice?: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
}

export const MUSIC_SCALE_PLANS: Record<MusicScalePlan, MusicScalePlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 19.9,
    currency: 'BRL',
    trialDays: 7,
    limits: {
      users: 10,
      songs: -1,
      scales: -1,
      bandScales: -1,
      libraryImportsPerMonth: 0,
    },
    features: {
      songsUnlimited: true,
      scalesUnlimited: true,
      basicSongFields: true,
      cloudSync: true,
      shareScales: true,
      libraryAccess: false,
      libraryLimited: false,
      libraryComplete: false,
      aiImport: false,
      aiStructuring: false,
      aiSuggestions: false,
      aiSetlistInsights: false,
      scaleCloning: false,
      fullHistory: false,
      advancedRepertoireCustomization: false,
      futurePremiumFeatures: false,
      priorityNewFeatures: false,
      supportTier: 'standard',
    },
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    priceMonthly: 29.9,
    currency: 'BRL',
    trialDays: 7,
    limits: {
      users: 20,
      songs: -1,
      scales: -1,
      bandScales: -1,
      libraryImportsPerMonth: 20,
    },
    features: {
      songsUnlimited: true,
      scalesUnlimited: true,
      basicSongFields: true,
      cloudSync: true,
      shareScales: true,
      libraryAccess: true,
      libraryLimited: true,
      libraryComplete: false,
      aiImport: false,
      aiStructuring: false,
      aiSuggestions: false,
      aiSetlistInsights: false,
      scaleCloning: false,
      fullHistory: true,
      advancedRepertoireCustomization: true,
      futurePremiumFeatures: false,
      priorityNewFeatures: false,
      supportTier: 'basic_priority',
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 34.9,
    currency: 'BRL',
    launchPrice: true,
    trialDays: 7,
    limits: {
      users: -1,
      songs: -1,
      scales: -1,
      bandScales: -1,
      libraryImportsPerMonth: -1,
    },
    features: {
      songsUnlimited: true,
      scalesUnlimited: true,
      basicSongFields: true,
      cloudSync: true,
      shareScales: true,
      libraryAccess: true,
      libraryLimited: true,
      libraryComplete: true,
      aiImport: true,
      aiStructuring: true,
      aiSuggestions: true,
      aiSetlistInsights: true,
      scaleCloning: true,
      fullHistory: true,
      advancedRepertoireCustomization: true,
      futurePremiumFeatures: true,
      priorityNewFeatures: true,
      supportTier: 'priority',
    },
  },
};

/**
 * Normalizes any string or plan identifier to a valid MusicScalePlan
 * Safe fallbacks ensure we never break existing data
 */
export function normalizeMusicScalePlan(input: string | null | undefined): MusicScalePlan {
  if (!input) return 'starter';
  const clean = input.toLowerCase().trim();

  if (
    clean.includes('pro') ||
    clean.includes('premium') ||
    clean.includes('complete') ||
    clean.includes('completo')
  ) {
    return 'pro';
  }

  if (
    clean.includes('advanced') ||
    clean.includes('advance') ||
    clean.includes('intermediate') ||
    clean.includes('intermediario') ||
    clean.includes('intermediário')
  ) {
    return 'advanced';
  }

  if (clean.includes('starter')) {
    return 'starter';
  }

  // Handle previous free or generic fallbacks
  return 'starter';
}

/**
 * Safe helper to fetch environment variables that works in both Node.js server
 * and Vite browser environments
 */
function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[`VITE_${name}`];
  }
  return undefined;
}

/**
 * Maps a Stripe Price ID to a canonical MusicScalePlan
 */
export function priceIdToMusicScalePlan(priceId: string | null | undefined): MusicScalePlan {
  if (!priceId) return 'starter';

  const starterMonthly = getEnvVar('STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY');
  const starterAnnual = getEnvVar('STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY');

  const advancedMonthly = getEnvVar('STRIPE_PRICE_MUSICSCALE_ADVANCED_MONTHLY');
  const advancedAnnual = getEnvVar('STRIPE_PRICE_MUSICSCALE_ADVANCED_YEARLY');

  const proMonthly =
    getEnvVar('STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY') ||
    getEnvVar('STRIPE_PRICE_ID_MONTHLY') ||
    getEnvVar('STRIPE_PRICE_MONTHLY');
  const proAnnual =
    getEnvVar('STRIPE_PRICE_MUSICSCALE_PRO_YEARLY') ||
    getEnvVar('STRIPE_PRICE_ID_ANNUAL') ||
    getEnvVar('STRIPE_PRICE_ANNUAL');

  if ((starterMonthly && priceId === starterMonthly) || (starterAnnual && priceId === starterAnnual)) {
    return 'starter';
  }
  if ((advancedMonthly && priceId === advancedMonthly) || (advancedAnnual && priceId === advancedAnnual)) {
    return 'advanced';
  }
  if ((proMonthly && priceId === proMonthly) || (proAnnual && priceId === proAnnual)) {
    return 'pro';
  }

  // Fallback checks using string pattern matching (excellent for development or mock systems)
  const idLower = priceId.toLowerCase();
  if (idLower.includes('pro') || idLower.includes('premium')) {
    return 'pro';
  }
  if (idLower.includes('advanced') || idLower.includes('intermediate')) {
    return 'advanced';
  }
  if (idLower.includes('starter')) {
    return 'starter';
  }

  return 'starter';
}

/**
 * Resolves the canonical MusicScalePlan for a tenant by executing the prioritized gate chain
 */
export function resolveMusicScalePlan(options: {
  subscription?: any;
  organization?: any;
}): MusicScalePlan {
  // 1. /subscriptions/{orgId}.plan
  if (options.subscription?.plan) {
    return normalizeMusicScalePlan(options.subscription.plan);
  }
  // 2. /subscriptions/{orgId}.productPlan
  if (options.subscription?.productPlan) {
    return normalizeMusicScalePlan(options.subscription.productPlan);
  }
  // 3. /subscriptions/{orgId}.musicScalePlan
  if (options.subscription?.musicScalePlan) {
    return normalizeMusicScalePlan(options.subscription.musicScalePlan);
  }
  // 4. /subscriptions/{orgId}.priceNickname
  if (options.subscription?.priceNickname) {
    return normalizeMusicScalePlan(options.subscription.priceNickname);
  }
  // 5. /organizations/{orgId}.apps.musicscale.plan
  if (options.organization?.apps?.musicscale?.plan) {
    return normalizeMusicScalePlan(options.organization.apps.musicscale.plan);
  }
  // 6. /organizations/{orgId}.subscriptionPlan
  if (options.organization?.subscriptionPlan) {
    return normalizeMusicScalePlan(options.organization.subscriptionPlan);
  }
  // 7. /organizations/{orgId}.plan
  if (options.organization?.plan) {
    return normalizeMusicScalePlan(options.organization.plan);
  }

  return 'starter';
}

/**
 * Resolves full feature entitlements and limits for a given subscription and organization combination
 */
export function resolveMusicScaleEntitlements(options: {
  subscription?: any;
  organization?: any;
}) {
  const plan = resolveMusicScalePlan(options);
  return MUSIC_SCALE_PLANS[plan];
}

/**
 * Calculates occupied slots for an organization based on system directives.
 * Count active/invited members and valid pending invites.
 */
export function calculateOccupiedSlots(members: any[], invites: any[]): number {
  const activeMembers = (members || []).filter(m => {
    const status = (m.status || 'active').toLowerCase();
    return status !== 'disabled' && status !== 'removed' && status !== 'revoked' && status !== 'expired' && status !== 'rejected';
  });

  const activeInvites = (invites || []).filter(i => {
    if (i.status !== 'pending') return false;

    // Check expiration securely
    const expiresAtMs = i.expiresAt
      ? (typeof i.expiresAt.toMillis === 'function'
          ? i.expiresAt.toMillis()
          : typeof i.expiresAt === 'object' && i.expiresAt.seconds
          ? i.expiresAt.seconds * 1000
          : new Date(i.expiresAt).getTime())
      : null;

    const isExpired = expiresAtMs !== null && expiresAtMs < Date.now();

    const createdAtMs = i.createdAt
      ? (typeof i.createdAt.toMillis === 'function'
          ? i.createdAt.toMillis()
          : typeof i.createdAt === 'object' && i.createdAt.seconds
          ? i.createdAt.seconds * 1000
          : new Date(i.createdAt).getTime())
      : null;

    const is7DaysOld = createdAtMs !== null && (Date.now() - createdAtMs) > 7 * 24 * 60 * 60 * 1000;

    return !isExpired && !is7DaysOld;
  });

  return activeMembers.length + activeInvites.length;
}

