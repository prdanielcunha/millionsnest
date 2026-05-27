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
    description: 'Gestão inteligente de equipes, escalas e repertório para seu ministério de louvor.',
    icon: 'Music',
    url: 'https://musicscale.millionsnest.com',
    category: 'core',
    requiredPlan: 'free',
  },
  {
    id: 'people',
    name: 'Membros & Células',
    description: 'Acompanhamento pastoral, turmas, ensino e gestão de dados.',
    icon: 'Users',
    url: 'https://people.millionsnest.com',
    category: 'beta',
    requiredPlan: 'starter',
  },
  {
    id: 'checkin',
    name: 'Checkin Kids',
    description: 'Segurança absoluta e agilidade no credenciamento infantil.',
    icon: 'ShieldCheck',
    url: 'https://kids.millionsnest.com',
    category: 'beta',
    requiredPlan: 'pro',
  },
  {
    id: 'finance',
    name: 'Gestão Financeira',
    description: 'Tesouraria, recebimentos e relatórios contábeis da igreja local.',
    icon: 'CreditCard',
    url: 'https://finance.millionsnest.com',
    category: 'beta',
    requiredPlan: 'pro',
  }
];

export function getAvailableApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS;
}

export function getInstalledApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS.filter(app => installedAppIds.includes(app.id));
}
