export interface EcosystemApp {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  icon: string; // lucide class or identifier
  iconAsset?: string;
  url?: string;
  operationalUrl?: string;
  internalRoute?: string;
  status?: 'active' | 'coming_soon' | 'beta' | 'disabled';
  landingRoute?: string;
  badgeLabelKey?: string;
  primaryAction?: 'open' | 'learn' | 'disabled';
  featured?: boolean;
  order?: number;
  category: 'core' | 'community' | 'beta';
  requiredPlan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: 'musicscale',
    name: 'MusicScale',
    description: 'A excelência que seu ministério de louvor merece. Escalas, ensaios e repertório.',
    shortDescription: 'Excelência em louvor e escalas',
    icon: 'Music',
    url: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_MUSICSCALE_APP_URL : undefined) || 'https://musicscale.millionsnest.com/start',
    operationalUrl: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_MUSICSCALE_APP_URL : undefined) || 'https://musicscale.millionsnest.com/start',
    landingRoute: '/musicscale',
    internalRoute: undefined,
    status: 'active',
    primaryAction: 'open',
    featured: true,
    order: 1,
    category: 'core',
    requiredPlan: 'free',
  },
  {
    id: 'connect',
    name: 'MillionsNest Connect',
    description: 'MillionsNest Connect',
    shortDescription: 'MillionsNest Connect',
    icon: 'LayoutGrid',
    iconAsset: '/brand/connect/v2/connect-mark-color.svg',
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'footer_soon',
    order: 2,
    category: 'beta',
    requiredPlan: 'free',
  },
  {
    id: 'nestfinance',
    name: 'NestFinance',
    description: 'Gestão financeira, conciliação, relatórios e auditoria.',
    shortDescription: 'Gestão financeira transparente',
    icon: 'Wallet',
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'footer_soon',
    order: 3,
    category: 'beta',
  },
  {
    id: 'services',
    name: 'Cultos e Escalas',
    description: 'Planejamento e coordenação completa da liturgia, direção e equipes voluntárias.',
    shortDescription: 'Gestão completa da liturgia',
    icon: 'Calendar',
    url: '#',
    internalRoute: undefined,
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'footer_soon',
    order: 4,
    category: 'beta',
    requiredPlan: 'starter',
  },
  {
    id: 'cells',
    name: 'Células e Pequenos Grupos',
    description: 'Gerenciamento estratégico para células e relatórios sobre a saúde pastoral.',
    shortDescription: 'Saúde pastoral e relatórios',
    icon: 'Users',
    url: '#',
    internalRoute: undefined,
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'footer_soon',
    order: 5,
    category: 'beta',
    requiredPlan: 'starter',
  },
  {
    id: 'members',
    name: 'Membros e Visitantes',
    description: 'Experiência de check-in, mapeamento de novos visitantes e relatórios precisos.',
    shortDescription: 'Mapeamento e jornada de membros',
    icon: 'QrCode',
    url: '#',
    internalRoute: undefined,
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'footer_soon',
    order: 6,
    category: 'beta',
    requiredPlan: 'pro',
  }
];

export function getAvailableApps(installedAppIds: string[]): EcosystemApp[] {
  return [...ECOSYSTEM_APPS].sort((a, b) => (a.order || 99) - (b.order || 99));
}

export function getInstalledApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS.filter(app => installedAppIds.includes(app.id));
}
