import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  HubChangeCode,
  ReadOnlyHubChange,
} from '../../lib/changeCenter.js';

interface EcosystemChangesProps {
  changes: ReadOnlyHubChange[];
  onOpen: (change: ReadOnlyHubChange) => void;
}

function labelForCode(
  code: HubChangeCode,
  t: (key: string, options?: any) => string
): string {
  const keys: Record<HubChangeCode, string> = {
    song_added: 'workspace.changes.codes.repertoire',
    song_removed: 'workspace.changes.codes.repertoire',
    song_reordered: 'workspace.changes.codes.order',
    song_key_changed: 'workspace.changes.codes.key',
    song_bpm_changed: 'workspace.changes.codes.bpm',
    date_changed: 'workspace.changes.codes.date',
    time_changed: 'workspace.changes.codes.time',
    location_changed: 'workspace.changes.codes.location',
    event_changed: 'workspace.changes.codes.event',
    notes_changed: 'workspace.changes.codes.notes',
    duration_changed: 'workspace.changes.codes.duration',
    function_changed: 'workspace.changes.codes.function',
    scale_changed: 'workspace.changes.codes.general',
  };

  return t(keys[code]);
}

function relativeTime(
  occurredAtMs: number,
  locale: string,
  t: (key: string, options?: any) => string
): string {
  const diffMs = occurredAtMs - Date.now();
  const abs = Math.abs(diffMs);

  if (abs < 60_000) return t('workspace.changes.now');

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  });

  if (abs < 3_600_000) {
    return formatter.format(
      Math.round(diffMs / 60_000),
      'minute'
    );
  }

  if (abs < 86_400_000) {
    return formatter.format(
      Math.round(diffMs / 3_600_000),
      'hour'
    );
  }

  return formatter.format(
    Math.round(diffMs / 86_400_000),
    'day'
  );
}

export function EcosystemChanges({
  changes,
  onOpen,
}: EcosystemChangesProps) {
  const { t, i18n } = useTranslation(['dashboard']);
  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';

  if (!changes.length) return null;

  return (
    <section
      aria-labelledby="hub-changes-title"
      className="relative overflow-hidden rounded-[1.75rem] border border-violet-400/[0.12] bg-violet-400/[0.035] p-5 sm:p-6"
    >
      <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-48 w-48 rounded-full bg-violet-400/[0.08] blur-[80px]" />

      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-violet-300">
          <RefreshCw className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
            {t('workspace.changes.eyebrow')}
          </span>
        </div>

        <h3
          id="hub-changes-title"
          className="text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl"
        >
          {t('workspace.changes.title')}
        </h3>

        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8D95A6] sm:text-sm">
          {t('workspace.changes.subtitle')}
        </p>
      </div>

      <div className="relative mt-5 space-y-2.5">
        {changes.map(change => {
          const labels = Array.from(
            new Set(
              change.codes.map(code => labelForCode(code, t))
            )
          );

          return (
            <article
              key={change.id}
              className="grid gap-4 rounded-2xl border border-violet-300/[0.10] bg-black/[0.12] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/[0.14] bg-violet-300/[0.07]">
                <Sparkles className="h-4 w-4 text-violet-200" />
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                    MusicScale
                  </span>

                  {!change.isRead && (
                    <span className="rounded-full border border-violet-300/[0.14] bg-violet-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-violet-100">
                      {t('workspace.changes.new')}
                    </span>
                  )}

                  <span className="text-[10px] font-medium text-[#717B8B]">
                    {relativeTime(change.occurredAtMs, locale, t)}
                  </span>
                </div>

                <h4 className="text-[15px] font-semibold text-white sm:text-base">
                  {t('workspace.changes.item_title')}
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-[#929BAB] sm:text-[13px]">
                  {t('workspace.changes.summary', {
                    items: labels.join(' · '),
                  })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpen(change)}
                className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-white px-4 py-2.5 text-xs font-semibold text-[#07090D] transition hover:bg-[#F2F5F8] active:scale-[0.985] sm:w-auto sm:min-w-[132px]"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {t('workspace.changes.open')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </article>
          );
        })}
      </div>

      <p className="relative mt-4 text-[10px] leading-relaxed text-[#626B7C]">
        {t('workspace.changes.note')}
      </p>
    </section>
  );
}
