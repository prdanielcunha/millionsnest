import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from 'react-i18next';

export function Guarantee() {
  const { t } = useTranslation(['landing']);

  return (
    <section className="bg-[#050505] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#0A0E15] px-7 py-10 md:px-12 md:py-14">
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#2B85EB]/15 blur-[110px]" />
          <div className="absolute bottom-0 left-1/3 h-52 w-80 rounded-full bg-[#6E56CF]/10 blur-[100px]" />
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#78B6FF]">
                <ShieldCheck className="h-4 w-4" />
                {t('guarantee_tag')}
              </div>
              <h2 className="text-4xl font-semibold leading-[1.03] tracking-[-0.05em] text-white md:text-6xl">
                <Trans i18nKey="landing:guarantee_title" components={{ 1: <span className="text-[#96A1B0]" /> }} />
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#8994A4]">{t('guarantee_desc')}</p>

              <div className="mt-8 flex flex-col gap-3 text-sm text-[#B9C1CC] sm:flex-row sm:gap-6">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t('guarantee_sub1_title')}: {t('guarantee_sub1_desc')}</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t('guarantee_sub2_title')}: {t('guarantee_sub2_desc')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/musicscale" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5">
                {t('guarantee_cta')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="/musicscale#pricing-section" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-[#E4E8EE] transition hover:bg-white/[0.06]">
                {t('guarantee_secondary')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
