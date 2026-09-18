const intelligence = {
  lenses: {
    selector_label: 'View',
    selector_aria: 'Switch MillionsNest view',
    my_today: 'My Today',
    pastoral: 'Pastoral',
    journey: 'Journey',
    worship: 'Worship',
    finance: 'Finance',
    administration: 'Administration',
    descriptions: {
      my_today: 'What you need to know or resolve right now.',
      pastoral: 'Authorized care, follow-up, and pastoral decisions.',
      journey: 'Visitors, journeys, follow-ups, and care commitments.',
      worship: 'Schedules, confirmations, pending items, and ministry preparation.',
      finance: 'Financial operations within your permissions.',
      administration: 'Organizations, people, access, and ecosystem operations.'
    }
  },
  onboarding: {
    kicker: 'Start here',
    single_title: 'Your {{app}} is ready to use',
    single_description: 'You do not need to figure out where to go. Open the app here and MillionsNest will keep showing the next step for your team.',
    multiple_title: 'Your apps are ready',
    multiple_description: 'Choose the app you need right now. The Hub organizes access and shows the next step so you do not have to memorize where things live.',
    open_app: 'Open {{app}}',
    view_start: 'See how to start',
    access_note: 'Whenever you need to come back, open the Hub and use My apps. Your access stays available here.'
  },
  evidence: {
    source_label: 'Source',
    verified_fact: 'Verified fact',
    unavailable: 'Source unavailable',
    no_source_no_claim: 'No source, no claim.'
  },
  sections: {
    needs_attention: 'Needs your attention',
    today: 'Today',
    this_week: 'This week',
    status: 'Status',
    insights: 'Insights and trends'
  }
} as const;

export default intelligence;
