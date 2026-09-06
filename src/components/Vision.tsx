import { motion } from "framer-motion";
import { CreditCard, Gauge, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Vision() {
  const { t } = useTranslation(['landing']);
  const pillars = [
    { icon: ShieldCheck, title: t('vision_p1_title'), desc: t('vision_p1_desc') },
    { icon: KeyRound, title: t('vision_p2_title'), desc: t('vision_p2_desc') },
    { icon: CreditCard, title: t('vision_p3_title'), desc: t('vision_p3_desc') },
    { icon: Gauge, title: t('vision_p4_title'), desc: t('vision_p4_desc') },
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-[#050505] py-24 md:py-32">
      <div className="absolute right-0 top-0 h-[500px] w-[700px] rounded-full bg-[#2B85EB]/[0.055] blur-[140px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t('vision_tag')}</div>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
              <Trans i18nKey="landing:vision_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[#8792A1]">{t('vision_desc')}</p>
            <div className="mt-8 inline-flex rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-xs text-[#7E8999]">{t('vision_footer')}</div>
          </div>

          <div className="grid overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.06] sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, desc }, index) => (
              <motion.div key={title} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className={`min-h-[230px] bg-[#080B11] p-7 md:p-8 ${index % 2 === 1 ? 'sm:border-l sm:border-white/[0.07]' : ''} ${index > 1 ? 'border-t border-white/[0.07]' : index === 1 ? '' : ''}`}>
                <Icon className="h-5 w-5 text-[#6EAFFF]" />
                <h3 className="mt-12 text-xl font-semibold tracking-[-0.02em] text-[#EEF2F7]">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#7F8998]">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
