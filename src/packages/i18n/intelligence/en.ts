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
