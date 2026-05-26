import { motion } from "framer-motion";
import { Users, Heart, Lightbulb } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Vision() {
  const { t } = useTranslation(['landing']);
  const pillars = [
    {
      title: t('vision_p1_title', 'Pessoas'),
      icon: <Users className="w-6 h-6" />,
      desc: t('vision_p1_desc', 'Não construímos para instituições, construímos para quem as lidera. Tecnologia que liberta tempo para o cuidado focado em vidas.')
    },
    {
      title: t('vision_p2_title', 'Propósito'),
      icon: <Heart className="w-6 h-6" />,
      desc: t('vision_p2_desc', 'Nossa métrica de sucesso não é apenas retenção, mas a quantidade de igrejas que podem servir com mais excelência e foco.')
    },
    {
      title: t('vision_p3_title', 'Transformação'),
      icon: <Lightbulb className="w-6 h-6" />,
      desc: t('vision_p3_desc', 'Onde o mundo vê sistemas, nós vemos ferramentas fundamentais para expandir o alcance da igreja na próxima geração.')
    }
  ];

  return (
    <section className="py-24 md:py-32 bg-[#0B0F19] text-[#F5F7FA] relative overflow-hidden border-b border-white/5">
      <div className="absolute top-0 right-0 w-full h-[500px] bg-gradient-to-b from-[#2B85EB]/5 to-transparent pointer-events-none transform-gpu" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-20 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-[#A0A7B5] uppercase tracking-widest mb-6"
          >
            {t('vision_tag')}
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-loose md:leading-snug"
          >
            <Trans i18nKey="landing:vision_title" components={{ 1: <span className="text-[#A0A7B5]" /> }} />
          </motion.h2>
           <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-[#A0A7B5] font-normal leading-relaxed mt-4 max-w-2xl mx-auto"
          >
            {t('vision_desc')}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center text-[#2B85EB] mb-8 relative group-hover:border-[#2B85EB]/30 group-hover:bg-[#2B85EB]/5 transition-all duration-500">
                {pillar.icon}
                <div className="absolute inset-0 bg-[#2B85EB]/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              
              <h3 className="text-xl font-semibold text-[#F5F7FA] tracking-wide mb-4 relative z-10">{pillar.title}</h3>
              <p className="text-[#A0A7B5] font-normal leading-relaxed relative z-10 max-w-sm">
                {pillar.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
