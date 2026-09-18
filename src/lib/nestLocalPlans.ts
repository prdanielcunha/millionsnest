export type NestLocalPlan = 'essential' | 'growth' | 'pro';

export interface NestLocalPlanDefinition {
  id: NestLocalPlan;
  name: string;
  limits: {
    users: number;
    requestsPerMonth: number;
  };
  features: {
    publicStore: boolean;
    guidedQuotes: boolean;
    operationalAutomations: boolean;
    advancedFeatures: boolean;
  };
}

export const NESTLOCAL_PLANS: Record<NestLocalPlan, NestLocalPlanDefinition> = {
  essential: {
    id: 'essential',
    name: 'Essencial',
    limits: { users: 1, requestsPerMonth: 100 },
    features: {
      publicStore: true,
      guidedQuotes: true,
      operationalAutomations: false,
      advancedFeatures: false,
    },
  },
  growth: {
    id: 'growth',
    name: 'Crescimento',
    limits: { users: 3, requestsPerMonth: 500 },
    features: {
      publicStore: true,
      guidedQuotes: true,
      operationalAutomations: true,
      advancedFeatures: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    limits: { users: 10, requestsPerMonth: 5000 },
    features: {
      publicStore: true,
      guidedQuotes: true,
      operationalAutomations: true,
      advancedFeatures: true,
    },
  },
};

export function normalizeNestLocalPlan(value: unknown): NestLocalPlan {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/^nestlocal_/, '')
    .replace(/_monthly$/, '');
  if (normalized === 'growth' || normalized === 'pro') return normalized;
  return 'essential';
}
