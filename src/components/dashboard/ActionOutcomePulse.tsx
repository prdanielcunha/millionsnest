import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ActionOutcomePulseSnapshot
} from '../../lib/actionOutcomePulse.js';

interface ActionOutcomePulseProps {
  snapshot: ActionOutcomePulseSnapshot;
}

export function ActionOutcomePulse({
  snapshot
}: ActionOutcomePulseProps) {
  const { t, i18n } = useTranslation([
    'dashboard'
  ]);

  const metricValue = (value: number) => {
    if (snapshot.complete) {
      return String(value);
    }

    return value > 0
      ? String(value) + '+'
      : '—';
  };

  const locale =
    i18n.resolvedLanguage ||
    i18n.language ||
    'pt-BR';
  const latestLabel =
    new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(
      new Date(snapshot.latestOutcomeAtMs)
    );

  return (
    <section
      aria-labelledby="action-outcome-pulse-title"
      className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-[#080A0F] p-5 shadow-[0_26px_80px_rgba(0,0,0,.2)] sm:p-6 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#2B85EB]/[0.08] blur-[95px]" />
        <div className="absolute -bottom-24 left-[22%] h-52 w-52 rounded-full bg-emerald-400/[0.05] blur-[90px]" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86BEFF]">
              {t(
                'workspace.outcome_pulse.eyebrow',
                {
                  days:
                    snapshot.windowDays
                }
              )}
            </p>
            <h3
              id="action-outcome-pulse-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl"
            >
              {t(
                'workspace.outcome_pulse.title'
              )}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8E99A8]">
              {t(
                'workspace.outcome_pulse.subtitle'
              )}
            </p>
          </div>

          <span
            className={
              'w-fit shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold ' +
              (
                snapshot.complete
                  ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300'
                  : 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300'
              )
            }
          >
            {snapshot.complete
              ? t(
                  'workspace.outcome_pulse.complete'
                )
              : t(
                  'workspace.outcome_pulse.partial'
                )}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {metricValue(
                snapshot.totalObservedCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.outcome_pulse.metrics.observed'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {metricValue(
                snapshot.resolvedCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.outcome_pulse.metrics.resolved'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {metricValue(
                snapshot.supersededCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.outcome_pulse.metrics.updated'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {metricValue(
                snapshot.noLongerActionableCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.outcome_pulse.metrics.left_window'
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] leading-relaxed text-[#748091]">
              {snapshot.complete
                ? t(
                    'workspace.outcome_pulse.evidence_note'
                  )
                : t(
                    'workspace.outcome_pulse.partial_note',
                    {
                      limit:
                        snapshot.readLimit
                    }
                  )}
            </p>
            <p className="mt-1 text-[10px] text-[#596575]">
              {t(
                'workspace.outcome_pulse.latest',
                {
                  date: latestLabel
                }
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {snapshot.nestJourneyCount > 0 && (
              <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-2.5 py-1 text-[9px] font-semibold text-emerald-300/90">
                {t(
                  'workspace.outcome_pulse.source_journey',
                  {
                    count:
                      snapshot.nestJourneyCount
                  }
                )}
              </span>
            )}

            {snapshot.musicScaleCount > 0 && (
              <span className="rounded-full border border-[#2B85EB]/15 bg-[#2B85EB]/[0.055] px-2.5 py-1 text-[9px] font-semibold text-[#9CC8FF]">
                {t(
                  'workspace.outcome_pulse.source_musicscale',
                  {
                    count:
                      snapshot.musicScaleCount
                  }
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
