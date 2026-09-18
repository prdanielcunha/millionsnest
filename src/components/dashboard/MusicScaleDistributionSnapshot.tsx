import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  UsersRound
} from 'lucide-react';
import type {
  EvidenceBackedMusicScaleDistributionSnapshot
} from '../../lib/musicScaleDistributionFactProjection.js';

interface MusicScaleDistributionSnapshotProps {
  snapshot: EvidenceBackedMusicScaleDistributionSnapshot;
  onOpen: () => void;
}

export function MusicScaleDistributionSnapshot({
  snapshot,
  onOpen
}: MusicScaleDistributionSnapshotProps) {
  const { t, i18n } = useTranslation(['dashboard']);
  const locale =
    i18n.resolvedLanguage ||
    i18n.language ||
    'pt-BR';

  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1
  });

  return (
    <section
      aria-labelledby="worship-distribution-title"
      className="relative overflow-hidden rounded-[1.9rem] border border-[#2B85EB]/15 bg-[#07101B] p-5 sm:p-6 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_0%,rgba(43,133,235,.16),transparent_38%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-[#86BEFF]">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {t('workspace.worship_distribution.eyebrow')}
            </span>
          </div>

          <h3
            id="worship-distribution-title"
            className="text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl"
          >
            {t('workspace.worship_distribution.title')}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-[#8C98A7] sm:text-sm">
            {t('workspace.worship_distribution.subtitle', {
              days: snapshot.windowDays
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] shrink-0 rounded-xl border border-white/[0.08] bg-white px-4 py-2.5 text-xs font-semibold text-[#07090D] transition hover:bg-[#F2F5F8] active:scale-[0.985]"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {t('workspace.worship_distribution.open')}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>

      <div className="relative mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4">
          <CalendarCheck2 className="mb-3 h-4 w-4 text-[#86BEFF]" />
          <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
            {number.format(snapshot.completedScheduleCount)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#798596]">
            {t('workspace.worship_distribution.completed_schedules', {
              count: snapshot.completedScheduleCount
            })}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4">
          <BarChart3 className="mb-3 h-4 w-4 text-[#86BEFF]" />
          <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
            {number.format(snapshot.assignmentCount)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#798596]">
            {t('workspace.worship_distribution.assignments', {
              count: snapshot.assignmentCount
            })}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4">
          <UsersRound className="mb-3 h-4 w-4 text-[#86BEFF]" />
          <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
            {number.format(snapshot.uniquePeople)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#798596]">
            {t('workspace.worship_distribution.people', {
              count: snapshot.uniquePeople
            })}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-2.5 md:grid-cols-2">
        {snapshot.byFunction.map(item => (
          <article
            key={item.functionName}
            className="rounded-2xl border border-white/[0.065] bg-black/[0.12] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="truncate text-sm font-semibold text-white">
                {item.functionName}
              </h4>
              <span className="shrink-0 rounded-full border border-[#2B85EB]/15 bg-[#2B85EB]/[0.07] px-2 py-0.5 text-[9px] font-semibold text-[#9CC8FF]">
                {t('workspace.worship_distribution.assignment_badge', {
                  count: item.assignmentCount
                })}
              </span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-[#8995A5]">
              {t('workspace.worship_distribution.function_summary', {
                people: item.uniquePeople,
                min: item.minAssignmentsPerPerson,
                max: item.maxAssignmentsPerPerson,
                average: number.format(item.averageAssignmentsPerPerson)
              })}
            </p>
          </article>
        ))}
      </div>

      <p className="relative mt-4 text-[10px] leading-relaxed text-[#5F6B7C]">
        {t('workspace.worship_distribution.evidence_note')}
      </p>
    </section>
  );
}
