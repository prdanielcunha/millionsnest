// Centralized Feature Flags system for the MillionsNest Ecosystem

export type FeatureFlag = 
  | 'ai_import'
  | 'multitrack'
  | 'analytics'
  | 'premium_theme';

export interface PlanFeatures {
  [planName: string]: FeatureFlag[];
}

// Plan definitions based on current products (example setup)
export const PLAN_FEATURES: PlanFeatures = {
  free: [],
  starter: [],
  advanced: ['analytics'],
  pro: ['ai_import', 'multitrack', 'analytics', 'premium_theme']
};

export function hasFeatureAccess(
  feature: FeatureFlag, 
  plan: string = 'free', 
  enabledApps: string[] = []
): boolean {
  // Can be expanded to check specific apps if features are app-specific
  const planFeatures = PLAN_FEATURES[plan] || [];
  return planFeatures.includes(feature);
}
