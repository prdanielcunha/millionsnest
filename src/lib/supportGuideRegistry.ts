export interface SupportGuideDefinition {
  id: string;
  titleKey: string;
  introKey: string;
  sectionKeys: string[];
  tipKey?: string;
  matches: (params: { pathname: string; searchParams: URLSearchParams; appId?: string }) => boolean;
}

const registry: SupportGuideDefinition[] = [
  {
    id: 'musicscale_resources',
    titleKey: 'dashboard.support.guides.musicscale_resources.title',
    introKey: 'dashboard.support.guides.musicscale_resources.intro',
    sectionKeys: [
      'dashboard.support.guides.musicscale_resources.sections.repertoire',
      'dashboard.support.guides.musicscale_resources.sections.library',
      'dashboard.support.guides.musicscale_resources.sections.chords',
      'dashboard.support.guides.musicscale_resources.sections.members',
      'dashboard.support.guides.musicscale_resources.sections.scales'
    ],
    tipKey: 'dashboard.support.guides.musicscale_resources.tip',
    matches: ({ pathname, appId }) => {
      // Must be precisely MusicScale resources view or the nested routes.
      // Easiest is to check if it's the resources tab.
      if (appId !== 'musicscale') return false;
      return pathname.includes('/musicscale/resources');
    }
  },
  {
    id: 'musicscale_getting_started',
    titleKey: 'dashboard.support.guides.musicscale_getting_started.title',
    introKey: 'dashboard.support.guides.musicscale_getting_started.intro',
    sectionKeys: [
      'dashboard.support.guides.musicscale_getting_started.sections.org',
      'dashboard.support.guides.musicscale_getting_started.sections.team',
      'dashboard.support.guides.musicscale_getting_started.sections.songs',
      'dashboard.support.guides.musicscale_getting_started.sections.chords',
      'dashboard.support.guides.musicscale_getting_started.sections.members',
      'dashboard.support.guides.musicscale_getting_started.sections.scales'
    ],
    tipKey: 'dashboard.support.guides.musicscale_getting_started.tip',
    matches: ({ pathname, appId }) => {
      if (appId !== 'musicscale') return false;
      return pathname.includes('/musicscale') && !pathname.includes('/musicscale/resources');
    }
  },
  {
    id: 'team_invitations',
    titleKey: 'dashboard.support.guides.team.title',
    introKey: 'dashboard.support.guides.team.intro',
    sectionKeys: [
      'dashboard.support.guides.team.sections.active',
      'dashboard.support.guides.team.sections.pending',
      'dashboard.support.guides.team.sections.new',
      'dashboard.support.guides.team.sections.seats',
      'dashboard.support.guides.team.sections.roles'
    ],
    matches: ({ pathname }) => pathname.includes('/settings/team')
  },
  {
    id: 'billing_subscription',
    titleKey: 'dashboard.support.guides.billing.title',
    introKey: 'dashboard.support.guides.billing.intro',
    sectionKeys: [
      'dashboard.support.guides.billing.sections.plan',
      'dashboard.support.guides.billing.sections.seats',
      'dashboard.support.guides.billing.sections.status',
      'dashboard.support.guides.billing.sections.payments',
      'dashboard.support.guides.billing.sections.features'
    ],
    matches: ({ pathname }) => pathname.includes('/settings/billing')
  }
];

export function resolveSupportGuide(params: {
  pathname: string;
  searchParams: URLSearchParams;
  appId?: string;
}): SupportGuideDefinition | null {
  
  // Dashboard home should have NO guide
  if (params.pathname === '/dashboard' || params.pathname === '/dashboard/') {
     return null;
  }

  for (const guide of registry) {
    if (guide.matches(params)) {
      return guide;
    }
  }
  return null;
}
