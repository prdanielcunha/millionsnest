import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronDown,
  Database,
  Search,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type {
  ActionDestination,
  EvidenceBackedReadOnlyHubAction
} from '../../lib/actionCenter.js';
import {
  answerAskMillionsNest,
  getAskMillionsNestSuggestionKeys
} from '../../lib/askMillionsNest.js';
import type {
  HubLensId,
  ResolvedHubLens
} from '../../lib/lensResolver.js';
import type {
  EvidenceBackedMusicScaleDistributionSnapshot
} from '../../lib/musicScaleDistributionFactProjection.js';
import type {
  NestJourneyCareIntegritySnapshot
} from '../../lib/nestJourneyCareIntegrity.js';
import type {
  ActionOutcomePulseSnapshot
} from '../../lib/actionOutcomePulse.js';

interface AskMillionsNestProps {
  organizationId: string;
  activeLens: HubLensId;
  lenses: readonly ResolvedHubLens[];
  sourceActions: readonly EvidenceBackedReadOnlyHubAction[];
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
  journey?: NestJourneyCareIntegritySnapshot | null;
  outcomePulse?: ActionOutcomePulseSnapshot | null;
  onOpenDestination: (destination: ActionDestination) => void;
}

function sourceEntityKey(entityType: string): string {
  if (entityType === 'scale') return 'ask.sources.scale';
  if (entityType === 'worship_team') return 'ask.sources.worship_team';
  if (entityType === 'worship_schedule') return 'ask.sources.worship_schedule';
  if (entityType === 'organization') return 'ask.sources.organization';
  if (entityType === 'adaptive_workspace') return 'ask.sources.workspace';
  if (entityType === 'followup_queue') return 'ask.sources.followup_queue';
  return 'ask.sources.verified_record';
}

export function AskMillionsNest({
  organizationId,
  activeLens,
  lenses,
  sourceActions,
  musicScale,
  worshipDistribution,
  journey,
  outcomePulse,
  onOpenDestination
}: AskMillionsNestProps) {
  const { t, i18n } = useTranslation(['intelligence', 'dashboard']);
  const [question, setQuestion] = React.useState('');
  const [submittedQuestion, setSubmittedQuestion] = React.useState('');
  const [showWhy, setShowWhy] = React.useState(false);

  React.useEffect(() => {
    setQuestion('');
    setSubmittedQuestion('');
    setShowWhy(false);
  }, [organizationId]);

  const suggestionKeys = React.useMemo(
    () => getAskMillionsNestSuggestionKeys(lenses),
    [lenses]
  );

  const answer = React.useMemo(() => {
    if (!submittedQuestion.trim()) return null;

    return answerAskMillionsNest({
      organizationId,
      question: submittedQuestion,
      activeLens,
      lenses,
      actions: sourceActions,
      musicScale,
      worshipDistribution,
      journey,
      outcomePulse
    });
  }, [
    organizationId,
    submittedQuestion,
    activeLens,
    lenses,
    sourceActions,
    musicScale,
    worshipDistribution,
    journey,
    outcomePulse
  ]);

  const locale =
    i18n.resolvedLanguage ||
    i18n.language ||
    'pt-BR';

  const formatDateTime = (timestampMs: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestampMs));

  const submitQuestion = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setQuestion(normalized);
    setSubmittedQuestion(normalized);
    setShowWhy(false);
  };

  const statusLabel = answer
    ? answer.status === 'answered'
      ? t('ask.status.evidence_backed', { ns: 'intelligence' })
      : answer.status === 'insufficient_data'
        ? t('ask.status.insufficient', { ns: 'intelligence' })
        : answer.status === 'not_available'
          ? t('ask.status.not_available', { ns: 'intelligence' })
          : t('ask.status.unsupported', { ns: 'intelligence' })
    : null;

  const statusClass = answer?.status === 'answered'
    ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300'
    : answer?.status === 'insufficient_data'
      ? 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'
      : 'border-white/[0.08] bg-white/[0.035] text-[#AAB4C2]';

  return (
    <section
      aria-labelledby="ask-millionsnest-title"
      className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-[#07090D] p-5 shadow-[0_26px_80px_rgba(0,0,0,.2)] sm:p-6 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#2B85EB]/12 blur-[95px]" />
        <div className="absolute -bottom-28 right-[12%] h-56 w-56 rounded-full bg-violet-400/[0.07] blur-[95px]" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#2B85EB]/20 bg-[#2B85EB]/10">
                <Sparkles className="h-3.5 w-3.5 text-[#8EC5FF]" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86BEFF]">
                {t('ask.eyebrow', { ns: 'intelligence' })}
              </p>
            </div>
            <h3
              id="ask-millionsnest-title"
              className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl"
            >
              {t('ask.title', { ns: 'intelligence' })}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8E99A8]">
              {t('ask.subtitle', { ns: 'intelligence' })}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] font-semibold text-[#A8B2C0]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            {t('ask.evidence_promise', { ns: 'intelligence' })}
          </div>
        </div>

        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          onSubmit={event => {
            event.preventDefault();
            submitQuestion(question);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              {t('ask.input_label', { ns: 'intelligence' })}
            </span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F7B8A]" />
            <input
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder={t('ask.placeholder', { ns: 'intelligence' })}
              className="min-h-[48px] w-full rounded-2xl border border-white/[0.09] bg-white/[0.035] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#5E6977] focus:border-[#2B85EB]/45 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#2B85EB]/10"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={!question.trim()}
            className="min-h-[48px] shrink-0 rounded-2xl bg-white px-5 text-sm font-semibold text-[#07090D] transition hover:bg-[#F2F5F8] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {t('ask.ask_action', { ns: 'intelligence' })}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {suggestionKeys.map(key => {
            const label = t(key, { ns: 'intelligence' });
            return (
              <button
                key={key}
                type="button"
                onClick={() => submitQuestion(label)}
                className="min-h-[36px] rounded-full border border-white/[0.07] bg-white/[0.02] px-3 text-[11px] font-medium text-[#9BA6B5] transition hover:border-white/[0.13] hover:bg-white/[0.045] hover:text-white"
              >
                {label}
              </button>
            );
          })}
        </div>

        {answer && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#687486]">
                    {t('ask.answer_label', { ns: 'intelligence' })}
                  </p>
                  <h4 className="mt-1.5 text-base font-semibold text-white sm:text-lg">
                    {t(answer.titleKey, {
                      ns: 'intelligence',
                      ...(answer.translationParams ?? {})
                    })}
                  </h4>
                </div>
                <span className={'w-fit shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold ' + statusClass}>
                  {statusLabel}
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#A3ADBA]">
                {t(answer.summaryKey, {
                  ns: 'intelligence',
                  ...(answer.translationParams ?? {})
                })}
              </p>

              {answer.eventStartsAtMs && (
                <div className="mt-3 inline-flex items-center rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-xs font-medium text-white/85">
                  {formatDateTime(answer.eventStartsAtMs)}
                </div>
              )}

              {answer.facts.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {answer.facts.map((fact, index) => {
                    const params = fact.params ?? {};
                    const factText = fact.key === 'ask.facts.action_item'
                      ? t(String(params.titleKey || ''), { ns: 'dashboard' })
                      : t(fact.key, {
                          ns: 'intelligence',
                          ...params
                        });

                    return (
                      <div
                        key={fact.key + '-' + index}
                        className="rounded-xl border border-white/[0.065] bg-black/20 px-3.5 py-3 text-xs leading-relaxed text-[#B3BCC8]"
                      >
                        {factText}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setShowWhy(current => !current)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-xs font-semibold text-[#C0C8D2] transition hover:bg-white/[0.055] hover:text-white"
                  aria-expanded={showWhy}
                >
                  <Database className="h-3.5 w-3.5 text-[#86BEFF]" />
                  {t('ask.why_action', { ns: 'intelligence' })}
                  <ChevronDown className={'h-3.5 w-3.5 transition ' + (showWhy ? 'rotate-180' : '')} />
                </button>

                {answer.destination && (
                  <button
                    type="button"
                    onClick={() => onOpenDestination(answer.destination as ActionDestination)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#2B85EB]/20 bg-[#2B85EB]/10 px-3.5 text-xs font-semibold text-[#9CC8FF] transition hover:bg-[#2B85EB]/15"
                  >
                    {t('ask.open_source', { ns: 'intelligence' })}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {showWhy && (
              <div className="border-t border-white/[0.07] bg-black/20 p-4 sm:p-5">
                <p className="text-xs leading-relaxed text-[#96A2B1]">
                  {t(answer.whyKey, { ns: 'intelligence' })}
                </p>

                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#657182]">
                    {t('ask.sources_title', { ns: 'intelligence' })}
                  </p>

                  {answer.evidence.length > 0 ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {answer.evidence.map((source, index) => (
                        <div
                          key={source.sourceApp + '-' + source.entityType + '-' + source.entityId + '-' + index}
                          className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                            <Database className="h-3.5 w-3.5 text-[#86BEFF]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white">
                              {source.sourceApp === 'musicscale'
                                ? 'MusicScale'
                                : source.sourceApp === 'nestjourney'
                                  ? 'NestJourney'
                                  : t('ask.sources.hub', { ns: 'intelligence' })}
                              <span className="px-1.5 text-[#4F5968]">·</span>
                              {t(sourceEntityKey(source.entityType), { ns: 'intelligence' })}
                            </p>
                            <p className="mt-1 text-[10px] leading-relaxed text-[#748090]">
                              {source.observedAtMs
                                ? t('ask.sources.observed_at', {
                                    ns: 'intelligence',
                                    date: formatDateTime(source.observedAtMs)
                                  })
                                : t('ask.sources.authorized_projection', { ns: 'intelligence' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#7E8998]">
                      {t('evidence.no_source_no_claim', { ns: 'intelligence' })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
