import { motion } from "framer-motion";
import { ArrowRight, CreditCard, Languages, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from 'react-i18next';
import { DashboardMockup } from "./DashboardMockup.js";

export function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation(['landing']);

  const trustItems = [
    { icon: ShieldCheck, label: t('hero_trust_identity') },
    { icon: CreditCard, label: t('hero_trust_billing') },
    { icon: Languages, label: t('hero_trust_languages') },
    { icon: Workflow, label: t('hero_trust_release') },
  ];

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050505] pt-28 md:pt-36 pb-20 md:pb-28">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
        <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#2B85EB]/12 blur-[150px]" />
        <div className="absolute -right-32 top-72 h-[420px] w-[420px] rounded-full bg-[#6E56CF]/10 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-14 xl:grid-cols-[1.08fr_.92fr] xl:gap-16">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8B0BE]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#66A8FF]" />
              {t('hero_tag')}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#F7F9FC] sm:text-6xl md:text-7xl xl:text-[84px]"
            >
              <Trans i18nKey="landing:hero_title" components={{ 1: <span className="bg-gradient-to-r from-white via-[#BFD9FF] to-[#66A8FF] bg-clip-text text-transparent" /> }} />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-8 max-w-2xl text-lg leading-relaxed text-[#9CA5B4] md:text-xl"
            >
              {t('hero_desc')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <button
                onClick={() => navigate('/musicscale')}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#F7F9FC] px-6 py-3.5 text-sm font-semibold text-[#06080D] shadow-[0_18px_50px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
              >
                {t('hero_cta_primary')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#principios"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-6 py-3.5 text-sm font-medium text-[#E5E9F0] transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                {t('hero_cta_secondary')}
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7F8998]"
            >
              <span className="font-medium text-[#B8C0CC]">{t('hero_tag_free')}</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
              <span>{t('hero_trial_note')}</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-12 rounded-[3rem] bg-[#2B85EB]/10 blur-[90px]" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090D14]/95 shadow-[0_45px_120px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{t('hero_canvas_label')}</div>
                  <div className="mt-1 text-sm font-semibold text-white">MillionsNest</div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {t('hero_canvas_live')}
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#2B85EB]/25 bg-[#2B85EB]/[0.08] p-4">
                  <div className="mb-6 flex items-center justify-between">
                    <img src="/LogoIconMusicScale-1.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
                    <span className="rounded-md border border-[#2B85EB]/20 bg-[#2B85EB]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#79B6FF]">{t('ecosystem_status_live')}</span>
                  </div>
                  <div className="text-base font-semibold text-white">MusicScale</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#8490A1]">{t('ecosystem_musicscale_desc')}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['NestFinance', '/brand/nestfinance/nest-flow-signature/v1/symbols/nestfinance-symbol-vector-gradient-compact.svg'],
                    ['NestLocal', null],
                    ['NestJourney', null],
                    ['Connect', '/brand/connect/v2/connect-mark-color.svg'],
                  ].map(([name, asset]) => (
                    <div key={name} className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-[9px] font-bold text-[#9DA7B5]">
                        {asset ? <img src={asset} alt="" aria-hidden="true" className="h-5 w-5 object-contain" /> : name?.slice(0, 1)}
                      </div>
                      <div>
                        <div className="truncate text-[11px] font-semibold text-[#D9DEE7]">{name}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-[#606A78]">{t('hero_canvas_next')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] bg-[#070A10] p-3">
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
                  <DashboardMockup />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
                <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#596372]">{t('hero_canvas_foundation')}</span>
                {[t('hero_canvas_identity'), t('hero_canvas_billing'), t('hero_canvas_access'), t('hero_canvas_quality')].map(item => (
                  <span key={item} className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] text-[#8994A4]">{item}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-16 grid border-y border-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(({ icon: Icon, label }, index) => (
            <div key={label} className={`flex items-center gap-3 py-5 ${index > 0 ? 'lg:border-l lg:border-white/[0.07] lg:pl-6' : ''}`}>
              <Icon className="h-4 w-4 text-[#6EAFFF]" />
              <span className="text-xs font-medium text-[#929CAA]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
