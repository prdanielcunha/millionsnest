import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { HubAppExperience } from '../../lib/hubAppExperience.js';
import { EcosystemAppIcon } from '../apps/EcosystemAppIcon.js';

interface HubAppLaunchpadProps {
  appExperiences: readonly HubAppExperience[];
  onOpenApp: (experience: HubAppExperience) => void;
  onViewApp: (experience: HubAppExperience) => void;
}

export function HubAppLaunchpad({
  appExperiences,
  onOpenApp,
  onViewApp
}: HubAppLaunchpadProps) {
  const { t } = useTranslation(['intelligence']);
  const operational = appExperiences.filter(experience =>
    experience.installed === true &&
    experience.canOpen === true &&
    experience.isOperational === true
  );

  if (operational.length === 0) return null;

  const single = operational.length === 1 ? operational[0] : null;

  return (
    <section
      aria-label={t('onboarding.kicker')}
      className="relative overflow-hidden rounded-[1.9rem] border border-[#2B85EB]/20 bg-[#07101B] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-6 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(43,133,235,.18),transparent_42%)]" />

      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86BEFF]">
          {t('onboarding.kicker')}
        </p>

        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl">
              {single
                ? t('onboarding.single_title', { app: single.app.name })
                : t('onboarding.multiple_title')}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#93A0B0]">
              {single
                ? t('onboarding.single_description', { app: single.app.name })
                : t('onboarding.multiple_description')}
            </p>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[#667487]">
              {t('onboarding.access_note')}
            </p>
          </div>

          {single && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => onViewApp(single)}
                className="min-h-[46px] rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                {t('onboarding.view_start')}
              </button>
              <button
                type="button"
                onClick={() => onOpenApp(single)}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#050505] transition hover:bg-[#F5F7FA]"
              >
                {t('onboarding.open_app', { app: single.app.name })}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {!single && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {operational.map(experience => (
              <div
                key={experience.app.id}
                className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20">
                  {experience.app.id === 'musicscale' ? (
                    <img src="/LogoIconMusicScale-1.png" alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <EcosystemAppIcon
                      app={experience.app}
                      iconClassName="h-5 w-5"
                      assetClassName="h-8 w-8"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{experience.app.name}</p>
                  <button
                    type="button"
                    onClick={() => onViewApp(experience)}
                    className="mt-1 text-[11px] font-medium text-[#8FA1B5] hover:text-white"
                  >
                    {t('onboarding.view_start')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenApp(experience)}
                  aria-label={t('onboarding.open_app', { app: experience.app.name })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#050505] transition hover:bg-[#F5F7FA]"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
