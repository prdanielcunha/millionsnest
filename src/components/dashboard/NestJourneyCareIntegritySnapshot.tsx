import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  NestJourneyCareIntegritySnapshot as CareIntegritySnapshot
} from '../../lib/nestJourneyCareIntegrity.js';

interface NestJourneyCareIntegritySnapshotProps {
  snapshot: CareIntegritySnapshot;
  onOpen: () => void;
}

export function NestJourneyCareIntegritySnapshot({
  snapshot,
  onOpen
}: NestJourneyCareIntegritySnapshotProps) {
  const { t } = useTranslation(['dashboard']);

  const statusClass =
    snapshot.state === 'overdue'
      ? 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300'
      : snapshot.state === 'needs_assignment'
        ? 'border-[#2B85EB]/20 bg-[#2B85EB]/[0.08] text-[#9CC8FF]'
        : snapshot.state === 'due_soon'
          ? 'border-violet-400/20 bg-violet-400/[0.07] text-violet-300'
          : snapshot.state === 'clear'
            ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'
            : 'border-white/[0.08] bg-white/[0.035] text-[#B8C1CD]';

  const scopedValue = (
    available: boolean,
    complete: boolean,
    value: number
  ) => {
    if (!available) return '—';
    return complete
      ? String(value)
      : String(value) + '+';
  };

  const aggregateValue = (
    value: number
  ) => snapshot.countsComplete
    ? String(value)
    : String(value) + '+';

  const hasPartialScope =
    !snapshot.assignedAvailable ||
    !snapshot.unassignedAvailable;

  return (
    <section
      aria-labelledby="journey-care-integrity-title"
      className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-[#080A0F] p-5 shadow-[0_26px_80px_rgba(0,0,0,.22)] sm:p-6 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-400/[0.07] blur-[95px]" />
        <div className="absolute -bottom-24 left-[18%] h-56 w-56 rounded-full bg-[#2B85EB]/[0.06] blur-[95px]" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              {t(
                'workspace.care_integrity.eyebrow',
                'NestJourney · visão operacional'
              )}
            </p>
            <h3
              id="journey-care-integrity-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl"
            >
              {t(
                'workspace.care_integrity.title',
                'Integridade do cuidado'
              )}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8E99A8]">
              {t(
                'workspace.care_integrity.subtitle',
                'Um resumo agregado do que está aberto no seu recorte autorizado, sem expor pessoas ou notas pastorais.'
              )}
            </p>
          </div>

          <span
            className={
              'w-fit shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold ' +
              statusClass
            }
          >
            {t(
              'workspace.care_integrity.state.' +
                snapshot.state
            )}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {aggregateValue(
                snapshot.totalOpenCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.care_integrity.metrics.open',
                'Abertos no recorte'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {aggregateValue(
                snapshot.overdueCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.care_integrity.metrics.overdue',
                'Acima do prazo'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {aggregateValue(
                snapshot.dueSoonCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.care_integrity.metrics.due_soon',
                'Próximas 24h'
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">
              {scopedValue(
                snapshot.unassignedAvailable,
                snapshot.unassignedComplete,
                snapshot.unassignedCount
              )}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#748091]">
              {t(
                'workspace.care_integrity.metrics.unassigned',
                'Sem responsável'
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[11px] leading-relaxed text-[#748091]">
            {!snapshot.countsComplete
              ? t(
                  'workspace.care_integrity.bounded_scope',
                  'A fonte atingiu o limite seguro de leitura. Valores com + são mínimos observados, não totais exatos.'
                )
              : hasPartialScope
                ? t(
                    'workspace.care_integrity.partial_scope',
                    'Este resumo mostra apenas as filas que sua responsabilidade atual permite consultar.'
                  )
                : t(
                    'workspace.care_integrity.full_scope',
                    'Resumo calculado somente a partir das filas autorizadas e observadas agora.'
                  )}
          </p>

          <button
            type="button"
            onClick={onOpen}
            className="min-h-[42px] shrink-0 rounded-xl border border-white/[0.08] bg-white px-4 text-xs font-semibold text-[#07090D] transition hover:bg-[#F2F5F8] active:scale-[0.985]"
          >
            {t(
              'workspace.care_integrity.open_action',
              'Abrir Care Integrity'
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
