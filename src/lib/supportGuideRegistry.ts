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
    titleKey: 'support.guides.musicscale_resources.title',
    introKey: 'support.guides.musicscale_resources.intro',
    sectionKeys: [
      'support.guides.musicscale_resources.sections.repertoire',
      'support.guides.musicscale_resources.sections.library',
      'support.guides.musicscale_resources.sections.chords',
      'support.guides.musicscale_resources.sections.members',
      'support.guides.musicscale_resources.sections.scales'
    ],
    tipKey: 'support.guides.musicscale_resources.tip',
    matches: ({ pathname, searchParams }) => {
      return pathname === '/dashboard/apps/musicscale' && searchParams.get('section') === 'resources';
    }
  },
  {
    id: 'musicscale_getting_started',
    titleKey: 'support.guides.musicscale_getting_started.title',
    introKey: 'support.guides.musicscale_getting_started.intro',
    sectionKeys: [
      'support.guides.musicscale_getting_started.sections.org',
      'support.guides.musicscale_getting_started.sections.team',
      'support.guides.musicscale_getting_started.sections.songs',
      'support.guides.musicscale_getting_started.sections.chords',
      'support.guides.musicscale_getting_started.sections.members',
      'support.guides.musicscale_getting_started.sections.scales'
    ],
    tipKey: 'support.guides.musicscale_getting_started.tip',
    matches: ({ pathname, searchParams }) => {
      return pathname === '/dashboard/apps/musicscale' && searchParams.get('section') === 'getting-started';
    }
  },
  {
    id: 'team_invitations',
    titleKey: 'support.guides.team.title',
    introKey: 'support.guides.team.intro',
    sectionKeys: [
      'support.guides.team.sections.active',
      'support.guides.team.sections.pending',
      'support.guides.team.sections.new',
      'support.guides.team.sections.seats',
      'support.guides.team.sections.roles'
    ],
    matches: ({ pathname }) => pathname === '/dashboard/organization/members'
  },
  {
    id: 'billing_subscription',
    titleKey: 'support.guides.billing.title',
    introKey: 'support.guides.billing.intro',
    sectionKeys: [
      'support.guides.billing.sections.plan',
      'support.guides.billing.sections.seats',
      'support.guides.billing.sections.status',
      'support.guides.billing.sections.payments',
      'support.guides.billing.sections.features'
    ],
    matches: ({ pathname }) => pathname === '/dashboard/billing'
  }
];

export function resolveSupportGuide(params: {
  pathname: string;
  searchParams: URLSearchParams;
  appId?: string;
}): SupportGuideDefinition | null {
  
  // Dashboard home should have NO guide
  if (params.pathname === '/dashboard' || params.pathname === '/dashboard/' || params.pathname === '/dashboard/overview') {
     return null;
  }

  for (const guide of registry) {
    if (guide.matches(params)) {
      return guide;
    }
  }
  return null;
}
