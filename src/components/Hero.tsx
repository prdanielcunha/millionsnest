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
    <section className="relative overflow-hidden bg-[#030406] pb-24 pt-32 sm:pt-36 md:pb-32 md:pt-40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(ellipse_at_top,rgba(43,133,235,.22),rgba(5,5,5,0)_62%)]" />
        <div className="absolute left-[8%] top-40 h-72 w-72 rounded-full bg-[#6E56CF]/10 blur-[120px]" />
        <div className="absolute right-[6%] top-24 h-96 w-96 rounded-full bg-[#2B85EB]/10 blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '64px 64px', maskImage: 'linear-gradient(to bottom,black 0%,black 58%,transparent 88%)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#6EAFFF]/20 bg-[#6EAFFF]/[0.07] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#BFD9FF]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('hero_tag')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-7 max-w-5xl text-[3.35rem] font-semibold leading-[0.93] tracking-[-0.065em] text-white sm:text-7xl md:text-8xl lg:text-[6.5rem]"
          >
            <Trans
              i18nKey="landing:hero_title"
              components={{
                1: <span className="bg-gradient-to-r from-white via-[#C9DEFF] to-[#73B4FF] bg-clip-text text-transparent" />
              }}
            />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.13 }}
            className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-[#9FA9B8] sm:text-lg md:text-xl"
          >
            {t('hero_desc')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <button
              onClick={() => {
                trackHomeMusicScaleInterest('hero_primary');
                navigate('/musicscale#musicscale-demo');
              }}
              className="group inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-[#05070A] shadow-[0_18px_60px_rgba(255,255,255,.10)] transition hover:-translate-y-0.5 sm:w-auto"
            >
              {t('hero_cta_primary')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#action-os-demo"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-medium text-[#E8ECF2] backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] sm:w-auto"
            >
              {t('hero_cta_secondary')}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-[#758090]"
          >
            <span className="font-semibold text-[#A8B1BF]">{t('hero_tag_free')}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{t('hero_trial_note')}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{t('hero_scope_note')}</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-14 max-w-6xl md:mt-18"
        >
          <div className="absolute -inset-x-16 -inset-y-12 rounded-[4rem] bg-[#2B85EB]/12 blur-[110px]" />
          <div className="relative rounded-[34px] border border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.018] p-2.5 shadow-[0_50px_140px_rgba(0,0,0,.62)] sm:p-3.5">
            <div className="mb-2.5 flex items-center justify-between px-2 sm:px-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.07]" />
              </div>
              <div className="rounded-full border border-white/[0.07] bg-black/20 px-3 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-[#657182]">
                millionsnest.com
              </div>
              <div className="w-10" />
            </div>
            <div className="overflow-hidden rounded-[26px] border border-white/[0.06]">
              <ProductMotionStage />
            </div>
          </div>

          <div className="relative mx-auto mt-5 grid max-w-5xl gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex min-h-[62px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#07090D]/85 px-4 py-3 backdrop-blur-xl">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#6EAFFF]/15 bg-[#2B85EB]/[0.07]">
                  <Icon className="h-3.5 w-3.5 text-[#76B5FF]" />
                </div>
                <span className="text-[11px] font-medium leading-snug text-[#98A2B1]">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
