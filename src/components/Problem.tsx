import { motion } from "framer-motion";
import { ArrowRight, Layers3, Orbit, Waypoints } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Problem() {
  const { t } = useTranslation(['landing']);
  const frictions = [
    { n: '01', title: t('thesis_1_title'), desc: t('thesis_1_desc') },
    { n: '02', title: t('thesis_2_title'), desc: t('thesis_2_desc') },
    { n: '03', title: t('thesis_3_title'), desc: t('thesis_3_desc') },
  ];
  const model = [
    { icon: Layers3, title: t('thesis_model_1_title'), desc: t('thesis_model_1_desc') },
    { icon: Waypoints, title: t('thesis_model_2_title'), desc: t('thesis_model_2_desc') },
    { icon: Orbit, title: t('thesis_model_3_title'), desc: t('thesis_model_3_desc') },
  ];

  return (
    <section id="principios" className="relative overflow-hidden bg-[#050505] py-24 md:py-32">
      <div className="absolute left-1/2 top-20 h-72 w-[720px] -translate-x-1/2 rounded-full bg-[#2B85EB]/[0.055] blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid gap-14 lg:grid-cols-[.95fr_1.05fr] lg:gap-20">
          <div className="max-w-xl">
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t('problem_tag')}</div>
            <h2 className="text-4xl font-semibold leading-[1.03] tracking-[-0.045em] text-white md:text-6xl">
              <Trans i18nKey="landing:problem_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
            </h2>
            <p className="mt-7 text-lg leading-relaxed text-[#8D98A8]">{t('problem_desc')}</p>
          </div>

          <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {frictions.map((item) => (
              <motion.div key={item.n} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid gap-4 py-7 sm:grid-cols-[64px_1fr]">
                <div className="font-mono text-xs text-[#55606F]">{item.n}</div>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#EFF2F6]">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#7E8999] md:text-base">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-20 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#090D14]">
          <div className="grid lg:grid-cols-[.82fr_1.18fr]">
            <div className="border-b border-white/[0.07] p-7 md:p-10 lg:border-b-0 lg:border-r">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t('thesis_solution_tag')}</div>
              <h3 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white md:text-4xl">{t('thesis_solution_title')}</h3>
              <p className="mt-5 text-base leading-relaxed text-[#8994A4]">{t('thesis_solution_desc')}</p>
              <a href="#produto" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#BFD9FF] transition hover:text-white">
                {t('thesis_solution_cta')} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="grid md:grid-cols-3">
              {model.map(({ icon: Icon, title, desc }, index) => (
                <div key={title} className={`p-7 md:p-8 ${index > 0 ? 'border-t border-white/[0.07] md:border-l md:border-t-0' : ''}`}>
                  <Icon className="h-5 w-5 text-[#6EAFFF]" />
                  <h4 className="mt-10 text-lg font-semibold text-[#EDF1F6]">{title}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-[#7E8999]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
