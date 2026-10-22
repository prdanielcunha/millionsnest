import { ArrowRight, BookOpenText, CheckCircle2, LifeBuoy, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function CustomerSuccess() {
  const { t } = useTranslation(["landing"]);
  const steps = [
    { icon: BookOpenText, title: t("success_step1_title"), desc: t("success_step1_desc") },
    { icon: UsersRound, title: t("success_step2_title"), desc: t("success_step2_desc") },
    { icon: LifeBuoy, title: t("success_step3_title"), desc: t("success_step3_desc") },
  ];

  return (
    <section id="como-comecar" aria-labelledby="customer-success-heading" className="border-b border-white/[0.06] bg-[#05070B] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#78B6FF]">{t("success_eyebrow")}</span>
          <h2 id="customer-success-heading" className="mt-5 text-4xl font-semibold leading-[1.07] tracking-[-0.045em] text-white md:text-6xl">
            {t("success_title")}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#9AA6B6] md:text-lg">{t("success_desc")}</p>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-6 md:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#6EAFFF]/20 bg-[#2B85EB]/10">
                <Icon className="h-5 w-5 text-[#8BC1FF]" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[#F3F7FE]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#94A0B0]">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 flex flex-col gap-5 rounded-2xl border border-[#6EAFFF]/20 bg-[#2B85EB]/[0.055] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-[#8BC1FF]" aria-hidden="true" />{t("success_trial_title")}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#A8B4C4]">{t("success_trial_desc")}</p>
          </div>
          <Link to="/musicscale" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#05070A] transition hover:bg-[#E8F2FF]">
            {t("success_cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#778596]">{t("success_service_note")}</p>
      </div>
    </section>
  );
}
