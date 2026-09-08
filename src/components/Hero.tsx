import { motion } from "framer-motion";
import { ArrowRight, CreditCard, Languages, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from 'react-i18next';
import { ProductMotionStage } from "./ProductMotionStage.js";
import { trackHomeMusicScaleInterest } from "../lib/publicFunnelAnalytics.js";

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
                onClick={() => {
                  trackHomeMusicScaleInterest('hero_primary');
                  navigate('/musicscale#musicscale-demo');
                }}
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
              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
              <span>{t('hero_scope_note')}</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-10 rounded-[3rem] bg-[#2B85EB]/10 blur-[90px]" />
            <div className="relative">
              <ProductMotionStage />
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
