export interface EcosystemApp {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  icon: string;
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
    description: 'Escalas, repertório, cifras, confirmações e condução para equipes de louvor.',
    shortDescription: 'Operação completa para equipes de louvor',
    icon: 'Music',
    url: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_MUSICSCALE_APP_URL : undefined) || 'https://musicscale.millionsnest.com/start',
    operationalUrl: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_MUSICSCALE_APP_URL : undefined) || 'https://musicscale.millionsnest.com/start',
    landingRoute: '/musicscale',
    status: 'active',
    primaryAction: 'open',
    featured: true,
    order: 1,
    category: 'core',
    requiredPlan: 'free',
  },
  {
    id: 'nestfinance',
    name: 'NestFinance',
    iconAsset: '/brand/nestfinance/nest-flow-signature/v1/symbols/nestfinance-symbol-vector-gradient-compact.svg',
    description: 'Gestão financeira, contagem, conciliação, relatórios e auditoria para igrejas.',
    shortDescription: 'Finanças claras e auditáveis',
    icon: 'Wallet',
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'ecosystem_status_soon',
    order: 2,
    category: 'beta',
    requiredPlan: 'free',
  },
  {
    id: 'nestlocal',
    name: 'NestLocal',
    description: 'Presença digital, aquisição e operação local para negócios e organizações crescerem com mais clareza.',
    shortDescription: 'Crescimento e operação local',
    icon: 'MapPin',
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'ecosystem_status_soon',
    order: 3,
    category: 'beta',
    requiredPlan: 'free',
  },
  {
    id: 'nestjourney',
    name: 'NestJourney',
    description: 'Jornadas de visitantes, cuidado, grupos e discipulado com visão pastoral e arquitetura multi-igreja.',
    shortDescription: 'Jornadas de pessoas e cuidado',
    icon: 'Route',
    status: 'coming_soon',
    primaryAction: 'disabled',
    badgeLabelKey: 'ecosystem_status_development',
    order: 4,
    category: 'beta',
    requiredPlan: 'free',
  },
  {
    id: 'connect',
    name: 'MillionsNest Connect',
    description: 'Camada de integração, contexto e automação que conecta os produtos do ecossistema.',
    shortDescription: 'Infraestrutura de integração do ecossistema',
    icon: 'Network',
    iconAsset: '/brand/connect/v2/connect-mark-color.svg',
    url: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://connect.millionsnest.com',
    operationalUrl: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://connect.millionsnest.com',
    status: 'beta',
    primaryAction: 'open',
    badgeLabelKey: 'ecosystem_status_infrastructure',
    order: 5,
    category: 'beta',
    requiredPlan: 'free',
  }
];

export function getAvailableApps(_installedAppIds: string[]): EcosystemApp[] {
  return [...ECOSYSTEM_APPS].sort((a, b) => (a.order || 99) - (b.order || 99));
}

export function getInstalledApps(installedAppIds: string[]): EcosystemApp[] {
  return ECOSYSTEM_APPS.filter(app => installedAppIds.includes(app.id));
}
