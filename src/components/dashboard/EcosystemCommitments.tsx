import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Music2,
} from 'lucide-react';
import type { ReadOnlyHubCommitment } from '../../lib/commitmentCenter.js';

interface EcosystemCommitmentsProps {
  commitments: ReadOnlyHubCommitment[];
  onOpen: (commitment: ReadOnlyHubCommitment) => void;
}

function relativeLabel(
  startsAtMs: number,
  locale: string,
  t: (key: string, options?: any) => string
): string {
  const now = new Date();
  const target = new Date(startsAtMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  const diff = Math.round(
    (targetDay.getTime() - today.getTime()) / 86_400_000
  );

  if (diff === 0) return t('workspace.commitments.today');
  if (diff === 1) return t('workspace.commitments.tomorrow');
  if (diff > 1 && diff <= 7) {
    return t('workspace.commitments.in_days', { count: diff });
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(target);
}

export function EcosystemCommitments({
  commitments,
  onOpen,
}: EcosystemCommitmentsProps) {
  const { t, i18n } = useTranslation(['dashboard']);
  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';

  if (!commitments.length) return null;

  return (
    <section
      aria-labelledby="hub-commitments-title"
      className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.018] p-5 sm:p-6"
    >
      <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-48 w-48 rounded-full bg-[#2B85EB]/[0.08] blur-[80px]" />

      <div className="relative flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#86BEFF]">
            <CalendarDays className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {t('workspace.commitments.eyebrow')}
            </span>
          </div>
          <h3
            id="hub-commitments-title"
            className="text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl"
          >
            {t('workspace.commitments.title')}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8490A0] sm:text-sm">
            {t('workspace.commitments.subtitle')}
          </p>
        </div>
      </div>

      <div className="relative mt-5 space-y-2.5">
        {commitments.map(commitment => {
          const roles = commitment.functionNames.join(', ');
          const when = relativeLabel(
            commitment.startsAtMs,
            locale,
            t
          );

          return (
            <article
              key={commitment.id}
              className="grid gap-4 rounded-2xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10">
                <img
                  src="/LogoIconMusicScale-1.png"
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#86BEFF]">
                    MusicScale
                  </span>
                  <span className="rounded-full border border-[#2B85EB]/15 bg-[#2B85EB]/[0.06] px-2 py-0.5 text-[9px] font-semibold text-[#9CC8FF]">
                    {t('workspace.commitments.preparation_badge')}
                  </span>
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[9px] font-semibold text-[#A8B2C0]">
                    {when}
                  </span>
                  {commitment.time && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#788596]">
                      <Clock3 className="h-3 w-3" />
                      {commitment.time}
                    </span>
                  )}
                </div>

                <h4 className="text-[15px] font-semibold text-white sm:text-base">
                  {t('workspace.commitments.musicscale_title')}
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-[#8C98A7] sm:text-[13px]">
                  {roles
                    ? t('workspace.commitments.musicscale_with_role', {
                        roles,
                        count: commitment.songCount,
                      })
                    : t('workspace.commitments.musicscale_without_role', {
                        count: commitment.songCount,
                      })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpen(commitment)}
                className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-white px-4 py-2.5 text-xs font-semibold text-[#07090D] transition hover:bg-[#F2F5F8] active:scale-[0.985] sm:w-auto sm:min-w-[122px]"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Music2 className="h-3.5 w-3.5" />
                  {t('workspace.commitments.open')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </article>
          );
        })}
      </div>

      <p className="relative mt-4 text-[10px] leading-relaxed text-[#5E6978]">
        {t('workspace.commitments.note')}
      </p>
    </section>
  );
}
