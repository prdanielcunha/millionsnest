import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HubLensId, ResolvedHubLens } from '../../lib/lensResolver.js';

interface HubLensSwitcherProps {
  lenses: readonly ResolvedHubLens[];
  activeLens: HubLensId;
  onChange: (lensId: HubLensId) => void;
  className?: string;
}

function labelKey(lensId: HubLensId): string {
  return `lenses.${lensId}`;
}

function descriptionKey(lensId: HubLensId): string {
  return `lenses.descriptions.${lensId}`;
}

/**
 * Presentation-only Lens selector.
 *
 * The caller must pass only Lenses already resolved by the authoritative
 * workspace model. This component never evaluates or grants permissions.
 */
export function HubLensSwitcher({
  lenses,
  activeLens,
  onChange,
  className = ''
}: HubLensSwitcherProps) {
  const { t } = useTranslation(['intelligence']);

  if (lenses.length <= 1) return null;

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#717B8B]">
          {t('lenses.selector_label')}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t('lenses.selector_aria')}
        className="flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/[0.16] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lenses.map(lens => {
          const selected = lens.id === activeLens;
          const label = t(labelKey(lens.id));
          const description = t(descriptionKey(lens.id));

          return (
            <button
              key={lens.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${label}. ${description}`}
              title={description}
              onClick={() => onChange(lens.id)}
              className={[
                'min-h-[42px] shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 sm:px-4',
                selected
                  ? 'border border-white/[0.10] bg-white text-[#080A0F] shadow-[0_8px_28px_rgba(0,0,0,0.22)]'
                  : 'border border-transparent text-[#9AA3B4] hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-white'
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
