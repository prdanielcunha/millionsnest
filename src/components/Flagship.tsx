import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, CheckCircle2, LibraryBig, Radio, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { EscalasMockup } from "./EscalasMockup.js";
import { useTranslation, Trans } from 'react-i18next';

export function Flagship() {
  const { t } = useTranslation(['landing']);
  const features = [
    { icon: CalendarDays, title: t('flagship_feature2_title'), desc: t('flagship_feature2_desc') },
    { icon: LibraryBig, title: t('flagship_feature1_title'), desc: t('flagship_feature1_desc') },
    { icon: UsersRound, title: t('flagship_feature3_title'), desc: t('flagship_feature3_desc') },
    { icon: Radio, title: t('flagship_feature4_title'), desc: t('flagship_feature4_desc') },
  ];

  return (
    <section id="produto" className="overflow-hidden border-y border-white/[0.06] bg-[#070A10] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {t('flagship_tag')}
            </div>
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
              <Trans i18nKey="landing:flagship_title" components={{ 1: <span className="text-[#8E99A8]" /> }} />
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#8A95A5]">{t('flagship_desc')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link to="/musicscale" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5">
              {t('flagship_cta')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a href="/musicscale#pricing-section" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-medium text-[#E7EBF2] transition hover:bg-white/[0.06]">
              {t('flagship_secondary')}
            </a>
          </div>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#05070B] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-5">
          <div className="absolute left-1/2 top-0 h-52 w-2/3 -translate-x-1/2 rounded-full bg-[#2B85EB]/10 blur-[100px]" />
          <div className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#080B11]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#606A78]">MusicScale</div>
              <div className="text-[10px] font-medium text-[#7C8796]">{t('flagship_trial_note')}</div>
            </div>
            <div className="relative min-h-[310px] overflow-hidden p-4 sm:min-h-[420px] md:min-h-[520px]">
              <div className="absolute inset-x-0 top-4 flex justify-center">
                <div className="w-[1024px] origin-top scale-[0.38] sm:scale-[0.52] md:scale-[0.68] lg:scale-[0.82] xl:scale-[0.9]">
                  <EscalasMockup />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#080B11] to-transparent" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-[#6EAFFF]" />
                <CheckCircle2 className="h-4 w-4 text-emerald-300/70" />
              </div>
              <h3 className="mt-8 text-base font-semibold text-[#E9EDF3]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#7E8999]">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
