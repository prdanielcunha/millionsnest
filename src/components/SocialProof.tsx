import { motion } from "framer-motion";
import { Building2, Languages, Smartphone, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SocialProof() {
  const { t } = useTranslation(["landing"]);
  const facts = [
    {
      icon: Building2,
      eyebrow: t("proof_scope_eyebrow"),
      label: t("proof_scope_title"),
      desc: t("proof_scope_desc"),
    },
    {
      icon: Smartphone,
      eyebrow: t("proof_devices_eyebrow"),
      label: t("proof_devices_title"),
      desc: t("proof_devices_desc"),
    },
    {
      icon: Languages,
      eyebrow: t("proof_languages_eyebrow"),
      label: t("proof_languages_title"),
      desc: t("proof_languages_desc"),
    },
    {
      icon: Sparkles,
      eyebrow: t("proof_focus_eyebrow"),
      label: t("proof_focus_title"),
      desc: t("proof_focus_desc"),
    },
  ];

  return (
    <section className="border-b border-white/[0.06] bg-[#070A10] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6EAFFF]">
              {t("proof_tag")}
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-4 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.035em] text-white md:text-3xl"
            >
              {t("social_proof_title")}
            </motion.h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-[#7F8998] lg:justify-self-end lg:text-right">
            {t("proof_desc")}
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-[26px] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(({ icon: Icon, eyebrow, label, desc }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="min-h-[190px] bg-[#080B11] p-5 md:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <Icon className="h-4.5 w-4.5 text-[#6EAFFF]" />
              </div>
              <p className="mt-8 text-[9px] font-bold uppercase tracking-[0.18em] text-[#657080]">{eyebrow}</p>
              <div className="mt-2 text-sm font-semibold text-[#E1E6ED]">{label}</div>
              <p className="mt-2 text-xs leading-relaxed text-[#727D8C]">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
