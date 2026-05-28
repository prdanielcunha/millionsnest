export interface EcosystemApp {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide class or identifier
  url: string;
  internalRoute?: string;
  category: 'core' | 'community' | 'beta';
  requiredPlan: 'free' | 'starter' | 'pro' | 'enterprise';
}

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: 'musicscale',
    name: 'MusicScale',
    description: 'A excelência que seu ministério de louvor merece. Escalas, ensaios e repertório.',
    icon: 'Music',
    url: import.meta.env.VITE_MUSICSCALE_APP_URL || 'https://musicscale.millionsnest.com/start',
    internalRoute: undefined,
    category: 'core',
    requiredPlan: 'free',
  }
];

export function getAvailableApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS;
}

export function getInstalledApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS.filter(app => installedAppIds.includes(app.id));
}
