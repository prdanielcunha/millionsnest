import type {
  ActionDestination,
  EvidenceBackedReadOnlyHubAction
} from './actionCenter.js';
import type {
  FactEvidenceReference
} from '../packages/events/factContract.js';
import type {
  HubLensId,
  ResolvedHubLens
} from './lensResolver.js';
import type {
  EvidenceBackedMusicScaleDistributionSnapshot
} from './musicScaleDistributionFactProjection.js';

export type AskMillionsNestIntent =
  | 'attention'
  | 'personal_schedule'
  | 'worship_service'
  | 'worship_confirmations'
  | 'worship_repertoire'
  | 'worship_distribution'
  | 'journey_follow_up'
  | 'finance'
  | 'administration'
  | 'unknown';

export type AskMillionsNestStatus =
  | 'answered'
  | 'insufficient_data'
  | 'not_available'
  | 'unsupported';

export interface AskMillionsNestFactLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface AskMillionsNestAnswer {
  status: AskMillionsNestStatus;
  intent: AskMillionsNestIntent;
  titleKey: string;
  summaryKey: string;
  translationParams?: Record<string, string | number>;
  facts: AskMillionsNestFactLine[];
  evidence: readonly FactEvidenceReference[];
  whyKey: string;
  destination?: ActionDestination | null;
  eventStartsAtMs?: number | null;
}

export interface AskMillionsNestInput {
  organizationId: string;
  question: string;
  activeLens: HubLensId;
  lenses: readonly ResolvedHubLens[];
  actions: readonly EvidenceBackedReadOnlyHubAction[];
  musicScale: {
    ready: boolean;
    observedAtMs?: number | null;
    nextScale: null | {
      id: string;
      startsAtMs: number;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
      declinedResponses: number;
      repertoireSummaryAvailable: boolean;
      repertoireGapCount: number;
    };
    nextPersonalScale: null | {
      id: string;
      startsAtMs: number;
      pendingResponses: number;
      responseSummaryAvailable: boolean;
    };
  };
  worshipDistribution?: EvidenceBackedMusicScaleDistributionSnapshot | null;
  nowMs?: number;
}

const WORSHIP_SIGNAL_TYPES = new Set([
  'musicscale_pending_responses',
  'musicscale_declined_responses',
  'musicscale_repertoire_content_gaps',
  'musicscale_personal_confirmation'
]);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => value.includes(pattern));
}

function resolveIntent(
  question: string,
  activeLens: HubLensId
): AskMillionsNestIntent {
  const normalized = normalizeQuestion(question);
  if (!normalized) return 'unknown';

  if (
    includesAny(normalized, [
      'acompanhamento',
      'acompanhamentos',
      'visitante',
      'visitantes',
      'follow up',
      'followup',
      'seguimiento',
      'seguimientos'
    ])
  ) {
    return 'journey_follow_up';
  }

  if (
    includesAny(normalized, [
      'financeiro',
      'financeira',
      'financas',
      'saldo',
      'dizimo',
      'oferta',
      'finance',
      'financial',
      'giving',
      'balance',
      'finanzas',
      'financiero'
    ])
  ) {
    return 'finance';
  }

  if (
    includesAny(normalized, [
      'carga de servico',
      'sobrecarreg',
      'mais escalado',
      'mais escalada',
      'serviu mais',
      'workload',
      'overload',
      'service load',
      'carga de servicio',
      'sobrecarga'
    ])
  ) {
    return 'worship_distribution';
  }

  if (
    includesAny(normalized, [
      'repertorio',
      'repertoire',
      'cifra',
      'cifras',
      'letra',
      'letras',
      'song content',
      'songs ready',
      'cancion',
      'canciones'
    ])
  ) {
    return 'worship_repertoire';
  }

  if (
    includesAny(normalized, [
      'confirmacao',
      'confirmacoes',
      'nao respondeu',
      'nao responderam',
      'quem respondeu',
      'respostas',
      'pendente da escala',
      'pending response',
      'pending responses',
      'not responded',
      'has not responded',
      'confirmation',
      'confirmations',
      'sin responder',
      'no respondio',
      'confirmacion',
      'confirmaciones'
    ])
  ) {
    return 'worship_confirmations';
  }

  if (
    includesAny(normalized, [
      'minha escala',
      'minha proxima escala',
      'meu proximo culto',
      'my schedule',
      'my next schedule',
      'my next service',
      'mi escala',
      'mi proxima escala',
      'mi proximo servicio'
    ])
  ) {
    return 'personal_schedule';
  }

  if (
    includesAny(normalized, [
      'domingo',
      'sunday',
      'proximo culto',
      'proxima escala',
      'next service',
      'next schedule',
      'proximo servicio'
    ])
  ) {
    return 'worship_service';
  }

  if (
    includesAny(normalized, [
      'convite',
      'convites',
      'membro',
      'membros',
      'equipe',
      'organizacao',
      'invite',
      'invites',
      'member',
      'members',
      'team',
      'organization',
      'invitacion',
      'invitaciones',
      'miembro',
      'miembros',
      'equipo',
      'organizacion'
    ])
  ) {
    return 'administration';
  }

  if (
    includesAny(normalized, [
      'atencao',
      'pendencia',
      'pendencias',
      'o que preciso',
      'hoje',
      'attention',
      'pending',
      'what needs',
      'today',
      'atencion',
      'pendiente',
      'pendientes',
      'hoy'
    ])
  ) {
    return 'attention';
  }

  if (
    includesAny(normalized, ['como esta', 'status', 'resumo', 'summary', 'overview', 'como va'])
  ) {
    if (activeLens === 'worship') return 'worship_service';
    if (activeLens === 'administration') return 'administration';
    return 'attention';
  }

  return 'unknown';
}

function hasLens(
  lenses: readonly ResolvedHubLens[],
  lensId: HubLensId
): boolean {
  return lenses.some(lens => lens.id === lensId);
}

function evidenceKey(reference: FactEvidenceReference): string {
  return [
    reference.organizationId,
    reference.sourceApp,
    reference.sourceKind,
    reference.sourceRef,
    reference.entityType,
    reference.entityId
  ].join('|');
}

function sanitizeEvidence(
  organizationId: string,
  evidence: readonly FactEvidenceReference[]
): FactEvidenceReference[] {
  const seen = new Set<string>();
  const result: FactEvidenceReference[] = [];

  for (const reference of evidence) {
    if (reference.organizationId !== organizationId) continue;
    const key = evidenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reference);
  }

  return result;
}

function actionEvidence(
  input: AskMillionsNestInput,
  predicate: (action: EvidenceBackedReadOnlyHubAction) => boolean
): FactEvidenceReference[] {
  return sanitizeEvidence(
    input.organizationId,
    input.actions
      .filter(predicate)
      .flatMap(action => [...action.evidence])
  );
}

function projectionEvidence(input: {
  organizationId: string;
  sourceApp: 'hub' | 'musicscale';
  sourceRef: string;
  entityType: string;
  entityId: string;
  fieldPaths: readonly string[];
  observedAtMs?: number | null;
}): FactEvidenceReference {
  const observedAtMs =
    typeof input.observedAtMs === 'number' && Number.isFinite(input.observedAtMs)
      ? input.observedAtMs
      : null;

  return {
    organizationId: input.organizationId,
    sourceApp: input.sourceApp,
    sourceKind: 'runtime_projection',
    sourceRef: input.sourceRef,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldPaths: input.fieldPaths,
    ...(observedAtMs !== null ? { observedAtMs } : {})
  };
}

function notAvailable(
  intent: AskMillionsNestIntent
): AskMillionsNestAnswer {
  return {
    status: 'not_available',
    intent,
    titleKey: 'ask.answers.not_available.title',
    summaryKey: 'ask.answers.not_available.summary',
    facts: [],
    evidence: [],
    whyKey: 'ask.why.not_available',
    destination: null
  };
}

function insufficient(
  intent: AskMillionsNestIntent,
  evidence: readonly FactEvidenceReference[] = [],
  facts: AskMillionsNestFactLine[] = [],
  destination: ActionDestination | null = null
): AskMillionsNestAnswer {
  return {
    status: 'insufficient_data',
    intent,
    titleKey: 'ask.answers.insufficient.title',
    summaryKey: 'ask.answers.' + intent + '.insufficient',
    facts,
    evidence,
    whyKey: 'ask.why.insufficient',
    destination
  };
}

function answered(input: Omit<AskMillionsNestAnswer, 'status' | 'whyKey'>): AskMillionsNestAnswer {
  return {
    ...input,
    status: 'answered',
    whyKey: 'ask.why.answered'
  };
}

function sundayOnly(question: string): boolean {
  return includesAny(normalizeQuestion(question), ['domingo', 'sunday']);
}

function isSunday(timestampMs: number): boolean {
  return Number.isFinite(timestampMs) && new Date(timestampMs).getDay() === 0;
}

export function answerAskMillionsNest(
  input: AskMillionsNestInput
): AskMillionsNestAnswer {
  const organizationId = clean(input.organizationId);
  const question = clean(input.question);
  const intent = resolveIntent(question, input.activeLens);
  const nowMs =
    typeof input.nowMs === 'number' && Number.isFinite(input.nowMs)
      ? input.nowMs
      : Date.now();

  if (!organizationId || !question || intent === 'unknown') {
    return {
      status: 'unsupported',
      intent: 'unknown',
      titleKey: 'ask.answers.unsupported.title',
      summaryKey: 'ask.answers.unsupported.summary',
      facts: [],
      evidence: [],
      whyKey: 'ask.why.unsupported',
      destination: null
    };
  }

  if (intent === 'journey_follow_up') {
    if (!hasLens(input.lenses, 'journey')) return notAvailable(intent);

    const journeyActions = input.actions.filter(action =>
      action.sourceApp === 'nestjourney' &&
      (
        action.signalType === 'nestjourney_assigned_first_contacts' ||
        action.signalType === 'nestjourney_unassigned_first_contacts'
      )
    );

    if (journeyActions.length === 0) {
      return insufficient(intent);
    }

    const assignedAction = journeyActions.find(
      action => action.signalType === 'nestjourney_assigned_first_contacts'
    );
    const unassignedAction = journeyActions.find(
      action => action.signalType === 'nestjourney_unassigned_first_contacts'
    );

    const assigned = Number(assignedAction?.translationParams?.count || 0);
    const unassigned = Number(unassignedAction?.translationParams?.count || 0);
    const overdue =
      Number(assignedAction?.translationParams?.overdue || 0) +
      Number(unassignedAction?.translationParams?.overdue || 0);

    return answered({
      intent,
      titleKey: 'ask.answers.journey_follow_up.title',
      summaryKey: 'ask.answers.journey_follow_up.summary',
      translationParams: {
        assigned,
        unassigned,
        overdue
      },
      facts: [
        {
          key: 'ask.facts.journey_assigned',
          params: { count: assigned }
        },
        {
          key: 'ask.facts.journey_unassigned',
          params: { count: unassigned }
        },
        {
          key: 'ask.facts.journey_overdue',
          params: { count: overdue }
        }
      ],
      evidence: sanitizeEvidence(
        organizationId,
        journeyActions.flatMap(action => [...action.evidence])
      ),
      destination: journeyActions[0]?.destination ?? null
    });
  }

  if (intent === 'finance') {
    if (!hasLens(input.lenses, 'finance')) return notAvailable(intent);
    return insufficient(intent);
  }

  if (intent === 'personal_schedule') {
    const nextPersonalScale = input.musicScale.nextPersonalScale;
    if (!input.musicScale.ready || !nextPersonalScale) {
      return insufficient(intent);
    }

    const evidence = sanitizeEvidence(input.organizationId, [
      ...actionEvidence(
        input,
        action => action.signalType === 'musicscale_personal_confirmation'
      ),
      projectionEvidence({
        organizationId,
        sourceApp: 'musicscale',
        sourceRef: 'musicscale.read_model.next_personal_scale',
        entityType: 'scale',
        entityId: nextPersonalScale.id,
        fieldPaths: [
          'nextPersonalScale.id',
          'nextPersonalScale.startsAtMs',
          'nextPersonalScale.pendingResponses',
          'nextPersonalScale.responseSummaryAvailable'
        ],
        observedAtMs: input.musicScale.observedAtMs
      })
    ]);

    const personalResponseReady =
      nextPersonalScale.responseSummaryAvailable === true;

    return answered({
      intent,
      titleKey: 'ask.answers.personal_schedule.title',
      summaryKey: personalResponseReady
        ? 'ask.answers.personal_schedule.summary'
        : 'ask.answers.personal_schedule.summary_without_responses',
      ...(personalResponseReady
        ? {
            translationParams: {
              pending: nextPersonalScale.pendingResponses
            }
          }
        : {}),
      facts: personalResponseReady
        ? [
            {
              key: 'ask.facts.personal_pending',
              params: { count: nextPersonalScale.pendingResponses }
            }
          ]
        : [],
      evidence,
      destination: {
        kind: 'app',
        appId: 'musicscale',
        path: '/scales/' + nextPersonalScale.id
      },
      eventStartsAtMs: nextPersonalScale.startsAtMs
    });
  }

  if (
    intent === 'worship_service' ||
    intent === 'worship_confirmations' ||
    intent === 'worship_repertoire' ||
    intent === 'worship_distribution'
  ) {
    if (!hasLens(input.lenses, 'worship')) return notAvailable(intent);

    if (intent === 'worship_distribution') {
      const distribution = input.worshipDistribution;
      if (!distribution) return insufficient(intent);

      const evidence = sanitizeEvidence(
        organizationId,
        distribution.evidence
      );

      const highestFunctionSpread = distribution.byFunction
        .map(item => ({
          functionName: item.functionName,
          spread: item.maxAssignmentsPerPerson - item.minAssignmentsPerPerson,
          max: item.maxAssignmentsPerPerson,
          average: item.averageAssignmentsPerPerson
        }))
        .sort((a, b) => b.spread - a.spread)[0] ?? null;

      const facts: AskMillionsNestFactLine[] = [
        {
          key: 'ask.facts.distribution_window',
          params: {
            schedules: distribution.completedScheduleCount,
            assignments: distribution.assignmentCount,
            people: distribution.uniquePeople
          }
        }
      ];

      if (highestFunctionSpread) {
        facts.push({
          key: 'ask.facts.distribution_function',
          params: {
            function: highestFunctionSpread.functionName,
            max: highestFunctionSpread.max,
            average: highestFunctionSpread.average
          }
        });
      }

      return {
        status: 'insufficient_data',
        intent,
        titleKey: 'ask.answers.worship_distribution.title',
        summaryKey: 'ask.answers.worship_distribution.insufficient',
        facts,
        evidence,
        whyKey: 'ask.why.aggregate_only',
        destination: {
          kind: 'app',
          appId: 'musicscale',
          path: '/scales'
        }
      };
    }

    const nextScale = input.musicScale.nextScale;
    if (!input.musicScale.ready || !nextScale) {
      const readinessEvidence = sanitizeEvidence(organizationId, [
        projectionEvidence({
          organizationId,
          sourceApp: 'musicscale',
          sourceRef: 'musicscale.read_model.next_scale_summary',
          entityType: 'worship_schedule',
          entityId: organizationId,
          fieldPaths: ['nextScale'],
          observedAtMs: input.musicScale.observedAtMs ?? nowMs
        })
      ]);
      return insufficient(intent, readinessEvidence);
    }

    const nextScaleEvidence = sanitizeEvidence(organizationId, [
      ...actionEvidence(
        input,
        action =>
          action.sourceApp === 'musicscale' &&
          WORSHIP_SIGNAL_TYPES.has(action.signalType) &&
          action.destination.kind === 'app' &&
          action.destination.path === '/scales/' + nextScale.id
      ),
      projectionEvidence({
        organizationId,
        sourceApp: 'musicscale',
        sourceRef: 'musicscale.read_model.next_scale_summary',
        entityType: 'scale',
        entityId: nextScale.id,
        fieldPaths: [
          'nextScale.id',
          'nextScale.startsAtMs',
          'nextScale.responseSummaryAvailable',
          'nextScale.pendingResponses',
          'nextScale.declinedResponses',
          'nextScale.repertoireSummaryAvailable',
          'nextScale.repertoireGapCount'
        ],
        observedAtMs: input.musicScale.observedAtMs
      })
    ]);

    const destination: ActionDestination = {
      kind: 'app',
      appId: 'musicscale',
      path: '/scales/' + nextScale.id
    };

    if (intent === 'worship_service') {
      if (sundayOnly(question) && !isSunday(nextScale.startsAtMs)) {
        return insufficient(
          intent,
          nextScaleEvidence,
          [{ key: 'ask.facts.next_scale_is_not_sunday' }],
          destination
        );
      }

      const responseReady = nextScale.responseSummaryAvailable === true;
      const repertoireReady = nextScale.repertoireSummaryAvailable === true;

      if (!responseReady && !repertoireReady) {
        return insufficient(intent, nextScaleEvidence, [], destination);
      }

      const serviceFacts: AskMillionsNestFactLine[] = [];

      if (responseReady) {
        serviceFacts.push(
          {
            key: 'ask.facts.pending_confirmations',
            params: { count: nextScale.pendingResponses }
          },
          {
            key: 'ask.facts.declined_confirmations',
            params: { count: nextScale.declinedResponses }
          }
        );
      }

      if (repertoireReady) {
        serviceFacts.push({
          key: 'ask.facts.repertoire_gaps',
          params: { count: nextScale.repertoireGapCount }
        });
      }

      return answered({
        intent,
        titleKey: 'ask.answers.worship_service.title',
        summaryKey:
          responseReady && repertoireReady
            ? 'ask.answers.worship_service.summary'
            : responseReady
              ? 'ask.answers.worship_service.summary_responses_only'
              : 'ask.answers.worship_service.summary_repertoire_only',
        translationParams: {
          pending: nextScale.pendingResponses,
          declined: nextScale.declinedResponses,
          gaps: nextScale.repertoireGapCount
        },
        facts: serviceFacts,
        evidence: nextScaleEvidence,
        destination,
        eventStartsAtMs: nextScale.startsAtMs
      });
    }

    if (intent === 'worship_confirmations') {
      if (!nextScale.responseSummaryAvailable) {
        return insufficient(intent, nextScaleEvidence, [], destination);
      }

      return answered({
        intent,
        titleKey: 'ask.answers.worship_confirmations.title',
        summaryKey: 'ask.answers.worship_confirmations.summary',
        translationParams: {
          pending: nextScale.pendingResponses,
          declined: nextScale.declinedResponses
        },
        facts: [
          {
            key: 'ask.facts.pending_confirmations',
            params: { count: nextScale.pendingResponses }
          },
          {
            key: 'ask.facts.declined_confirmations',
            params: { count: nextScale.declinedResponses }
          }
        ],
        evidence: nextScaleEvidence,
        destination,
        eventStartsAtMs: nextScale.startsAtMs
      });
    }

    if (!nextScale.repertoireSummaryAvailable) {
      return insufficient(intent, nextScaleEvidence, [], destination);
    }

    return answered({
      intent,
      titleKey: 'ask.answers.worship_repertoire.title',
      summaryKey: 'ask.answers.worship_repertoire.summary',
      translationParams: {
        gaps: nextScale.repertoireGapCount
      },
      facts: [
        {
          key: 'ask.facts.repertoire_gaps',
          params: { count: nextScale.repertoireGapCount }
        }
      ],
      evidence: nextScaleEvidence,
      destination,
      eventStartsAtMs: nextScale.startsAtMs
    });
  }

  if (intent === 'administration') {
    if (!hasLens(input.lenses, 'administration')) return notAvailable(intent);

    const adminActions = input.actions.filter(action =>
      action.sourceApp === 'hub' &&
      (
        action.signalType === 'organization_incomplete' ||
        action.signalType === 'pending_invites'
      )
    );
    const evidence = sanitizeEvidence(organizationId, [
      ...adminActions.flatMap(action => [...action.evidence]),
      projectionEvidence({
        organizationId,
        sourceApp: 'hub',
        sourceRef: 'hub.read_model.adaptive_workspace_administration',
        entityType: 'organization',
        entityId: organizationId,
        fieldPaths: ['organization', 'pendingInvitesCount'],
        observedAtMs: nowMs
      })
    ]);

    return answered({
      intent,
      titleKey: 'ask.answers.administration.title',
      summaryKey:
        adminActions.length > 0
          ? 'ask.answers.administration.summary_attention'
          : 'ask.answers.administration.summary_clear',
      translationParams: {
        count: adminActions.length
      },
      facts: adminActions.map(action => ({
        key: 'ask.facts.action_item',
        params: {
          titleKey: action.titleKey
        }
      })),
      evidence,
      destination: adminActions[0]?.destination ?? {
        kind: 'hub',
        section: 'organization'
      }
    });
  }

  const visibleActions = input.actions.filter(action => {
    if (input.activeLens === 'my_today') return true;
    if (input.activeLens === 'administration') return action.sourceApp === 'hub';
    if (input.activeLens === 'worship') return action.sourceApp === 'musicscale';
    if (input.activeLens === 'journey') return action.sourceApp === 'nestjourney';
    return true;
  });

  const attentionEvidence = sanitizeEvidence(organizationId, [
    ...visibleActions.flatMap(action => [...action.evidence]),
    projectionEvidence({
      organizationId,
      sourceApp: 'hub',
      sourceRef: 'hub.read_model.adaptive_workspace_actions',
      entityType: 'adaptive_workspace',
      entityId: organizationId,
      fieldPaths: ['actions', 'activeLens'],
      observedAtMs: nowMs
    })
  ]);

  return answered({
    intent: 'attention',
    titleKey: 'ask.answers.attention.title',
    summaryKey:
      visibleActions.length > 0
        ? 'ask.answers.attention.summary'
        : 'ask.answers.attention.summary_clear',
    translationParams: {
      count: visibleActions.length
    },
    facts: visibleActions.slice(0, 3).map(action => ({
      key: 'ask.facts.action_item',
      params: {
        titleKey: action.titleKey
      }
    })),
    evidence: attentionEvidence,
    destination: visibleActions[0]?.destination ?? null
  });
}

export function getAskMillionsNestSuggestionKeys(
  lenses: readonly ResolvedHubLens[]
): string[] {
  const suggestions = ['ask.suggestions.attention'];

  if (hasLens(lenses, 'worship')) {
    suggestions.push(
      'ask.suggestions.sunday',
      'ask.suggestions.confirmations',
      'ask.suggestions.workload'
    );
  } else {
    suggestions.push('ask.suggestions.personal_schedule');
  }

  if (hasLens(lenses, 'journey')) {
    suggestions.push('ask.suggestions.follow_up');
  }

  if (hasLens(lenses, 'administration')) {
    suggestions.push('ask.suggestions.administration');
  }

  return suggestions.slice(0, 4);
}
