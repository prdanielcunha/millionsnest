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
      follow_up: 'What is pending in follow-up?',
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
  ask: {
    eyebrow: 'Ask MillionsNest',
    title: 'Ask your ecosystem',
    subtitle: 'Ask in natural language. The Hub answers only with authorized data and sources it can substantiate.',
    evidence_promise: 'No source, no claim',
    input_label: 'Question for MillionsNest',
    placeholder: 'Example: How is Sunday looking?',
    ask_action: 'Ask',
    answer_label: 'Answer',
    why_action: 'Why am I seeing this?',
    open_source: 'Open in source system',
    sources_title: 'Sources supporting this answer',
    status: {
      evidence_backed: 'Evidence-backed',
      insufficient: 'Insufficient data',
      not_available: 'Outside your context',
      unsupported: 'Unsupported question'
    },
    suggestions: {
      attention: 'What needs my attention?',
      sunday: 'How is Sunday looking?',
      confirmations: 'Who has not responded to the schedule yet?',
      workload: 'Who is above the service load?',
      personal_schedule: 'What is my next schedule?',
      administration: 'Is anything pending with the team?'
    },
    why: {
      answered: 'This answer was assembled only from projections authorized in your current context. The sources below support the facts shown; MillionsNest did not fill gaps with assumptions.',
      insufficient: 'There is context related to the question, but the currently authorized source does not contain enough detail to support the requested conclusion.',
      aggregate_only: 'MusicScale currently has an aggregate view of schedule distribution. It can reveal function-level imbalance, but it is not enough evidence to label a person as overloaded.',
      not_available: 'This domain is not available in your current authorized context. The Hub does not use generic administrative access to expose ministry, pastoral, or financial data.',
      unsupported: 'The question falls outside the set of queries the Hub can currently answer with sufficient evidence.'
    },
    sources: {
      hub: 'MillionsNest Hub',
      scale: 'Schedule',
      worship_team: 'Worship team',
      worship_schedule: 'Worship schedule',
      organization: 'Organization',
      workspace: 'Adaptive command center',
      followup_queue: 'Follow-up queue',
      verified_record: 'Verified record',
      observed_at: 'Observed on {{date}}',
      authorized_projection: 'Authorized projection of the current context'
    },
    facts: {
      personal_pending: '{{count}} pending response(s) on your next schedule.',
      pending_confirmations: '{{count}} confirmation(s) still pending.',
      declined_confirmations: '{{count}} decline(s) recorded.',
      repertoire_gaps: '{{count}} repertoire content gap(s).',
      distribution_window: '{{schedules}} completed schedule(s), {{assignments}} assignment(s), and {{people}} person(s) in the 30-day window.',
      distribution_function: 'For {{function}}, the highest individual record was {{max}} schedule(s), with an average of {{average}}.',
      next_scale_is_not_sunday: 'The next schedule available in the current projection is not on Sunday.',
      journey_assigned: '{{count}} first-contact follow-up(s) assigned to you and awaiting completion.',
      journey_unassigned: '{{count}} first-contact follow-up(s) without an owner in your authorized scope.',
      journey_overdue: '{{count}} first-contact commitment(s) past the agreed deadline.',
      journey_total_open: '{{count}} open first-contact follow-up(s) in your authorized scope.',
      journey_due_soon: '{{count}} first-contact commitment(s) due within the next 24 hours.',
      action_item: 'Authorized action'
    },
    answers: {
      attention: {
        title: 'What deserves attention now',
        summary: 'There are {{count}} evidence-backed action(s) in the authorized scope of this view.',
        summary_clear: 'There are no open actions in the authorized scope of this view right now. This does not imply inactivity in domains that are not connected or authorized yet.'
      },
      personal_schedule: {
        title: 'Your next schedule',
        summary: 'I found your next MusicScale assignment. There are {{pending}} pending response(s) associated with the available context.',
        summary_without_responses: 'I found your next MusicScale assignment. The response summary is not available for this schedule yet.',
        insufficient: 'I could not find a next personal schedule in an authorized source that is ready for querying right now.'
      },
      worship_service: {
        title: 'Next worship schedule',
        summary: 'The next authorized schedule has {{pending}} pending confirmation(s), {{declined}} decline(s), and {{gaps}} repertoire content gap(s).',
        summary_responses_only: 'The next authorized schedule has {{pending}} pending confirmation(s) and {{declined}} decline(s). The repertoire projection is not ready yet.',
        summary_repertoire_only: 'The next authorized schedule has {{gaps}} verifiable repertoire content gap(s). The response summary is not ready yet.',
        insufficient: 'The current authorized scope does not contain enough information to state how the requested Sunday is looking.'
      },
      worship_confirmations: {
        title: 'Next schedule confirmations',
        summary: 'The next schedule has {{pending}} pending response(s) and {{declined}} recorded decline(s).',
        insufficient: 'The next schedule exists, but its response summary is not available with enough quality to answer yet.'
      },
      worship_repertoire: {
        title: 'Repertoire readiness',
        summary: 'The next schedule has {{gaps}} verifiable repertoire content gap(s).',
        insufficient: 'There is no next schedule with enough repertoire projection to answer safely.'
      },
      worship_distribution: {
        title: 'Service distribution',
        insufficient: 'I can show the aggregate distribution, but the current data does not support identifying who is “above the load” as an individual conclusion.'
      },
      journey_follow_up: {
        title: 'Journey follow-ups',
        summary: 'In your authorized scope there are {{total}} open follow-up(s), {{overdue}} past deadline, and {{dueSoon}} due within the next 24 hours.',
        summary_clear: 'In the authorized scope observed now, there are no open first-contact follow-ups.',
        insufficient: 'The Journey Lens is available, but the authorized follow-up projection is not ready enough to support that answer yet.'
      },
      finance: {
        insufficient: 'The Hub does not yet have an authorized, structured financial source in this context that supports answering that question.'
      },
      administration: {
        title: 'Administrative status',
        summary_attention: 'There are {{count}} open administrative action(s) supported by Hub data.',
        summary_clear: 'There are no open administrative actions in the current authorized scope.'
      },
      not_available: {
        title: 'That context is not available here',
        summary: 'MillionsNest will not broaden permissions or infer data from another domain just to answer the question.'
      },
      insufficient: {
        title: 'There is not enough evidence yet'
      },
      unsupported: {
        title: 'I cannot answer that safely yet',
        summary: 'Try asking about current attention, your next schedule, confirmations, repertoire, worship distribution, or administrative status.'
      }
    }
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
