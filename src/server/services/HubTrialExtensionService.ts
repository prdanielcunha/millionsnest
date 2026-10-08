/** Hub-authorized trial extension policy for NestLocal and MusicScale. */
export type TrialApp = 'musicscale' | 'nestlocal';
export const TRIAL_BASE_DAYS: Record<TrialApp,number> = { musicscale:14, nestlocal:7 };
export const MAX_TRIAL_EXTENSION_DAYS = 7;
