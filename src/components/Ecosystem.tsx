import { motion } from "framer-motion";
import { CalendarDays, Users, QrCode, Music, MessageSquare, BarChart3, Bot } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';
import { useNavigate } from "react-router-dom";

export function Ecosystem() {
  const { t } = useTranslation(['landing']);
  const navigate = useNavigate();

  const futureApps = [
    {
      title: t('eco_feat1_title'),
      icon: <Music className="w-5 h-5" />,
      desc: t('eco_feat1_desc'),
      features: [t('eco_app1_feat1', 'Disponível agora'), t('eco_app1_feat2', 'Revisão e integração ativa')],
      active: true,
      link: '/musicscale'
    },
    {
      title: t('eco_finance_title', 'NestFinance'),
      icon: <BarChart3 className="w-5 h-5" />,
      desc: t('eco_finance_desc', 'Gestão financeira clara, transparente e integrada, pensada para ministérios grandes.'),
      features: [t('eco_finance_feat1', 'Relatórios Inteligentes'), t('eco_finance_feat2', 'Dízimos e Ofertas')],
      active: false
    },
    {
      title: t('eco_feat2_title'),
      icon: <CalendarDays className="w-5 h-5" />,
      desc: t('eco_feat2_desc'),
      features: [t('eco_app2_feat1', 'Ordem de culto'), t('eco_app2_feat2', 'Gestão de voluntários')],
      active: false
    },
    {
      title: t('eco_feat3_title'),
      icon: <Users className="w-5 h-5" />,
      desc: t('eco_feat3_desc'),
      features: [t('eco_app3_feat1', 'Métricas avançadas'), t('eco_app3_feat2', 'Cuidado pastoral')],
      active: false
    },
    {
      title: t('eco_app4_title', 'Membros e Visitantes'),
      icon: <QrCode className="w-5 h-5" />,
      desc: t('eco_app4_desc', 'Experiência de check-in, mapeamento de novos visitantes e relatórios precisos.'),
      features: [t('eco_app4_feat1', 'Jornada do visitante'), t('eco_app4_feat2', 'Integração fluida')],
      active: false
    }
  ];

  return (
    <section id="ecossistema" className="py-24 md:py-32 bg-[#050505] border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-white/5 rounded-[100%] blur-[120px] pointer-events-none transform-gpu" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-[#A0A7B5] uppercase tracking-widest mb-6"
          >
            {t('eco_tag')}
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight mb-6"
          >
            <Trans i18nKey="landing:eco_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-[#A0A7B5] font-normal leading-relaxed"
          >
            {t('eco_desc')}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {futureApps.map((app, idx) => (
            <motion.div
              key={app.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => app.link && navigate(app.link)}
              className={`rounded-2xl p-6 border relative overflow-hidden flex flex-col h-full transition-all ${app.active ? 'bg-[#2B85EB]/5 border-[#2B85EB]/20 shadow-[0_0_30px_rgba(43,133,235,0.05)]' : 'bg-[#0B0F19] border-white/5 group hover:border-[#2B85EB]/20 hover:shadow-[0_0_30px_rgba(43,133,235,0.05)]'} ${app.link ? 'cursor-pointer hover:border-[#2B85EB]/40' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

              {!app.active && (
                <div className="absolute top-6 right-6 text-[9px] font-bold px-2 py-1.5 rounded-md bg-white/5 text-[#A0A7B5] uppercase tracking-widest border border-white/5">
                  {t('soon', 'Em Breve')}
                </div>
              )}
              {app.active && (
                <div className="absolute top-6 right-6 text-[9px] font-bold px-2 py-1.5 rounded-md bg-[#2B85EB]/10 text-[#2B85EB] uppercase tracking-widest border border-[#2B85EB]/20">
                  {t('live', 'Ao Vivo')}
                </div>
              )}
              
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-5 transition-all duration-500 ${app.active ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' : 'bg-white/5 text-[#F5F7FA] border-white/10 group-hover:bg-[#2B85EB]/10 group-hover:text-[#2B85EB] group-hover:border-[#2B85EB]/20'}`}>
                {app.icon}
              </div>
              
              <h3 className="text-lg font-semibold text-[#F5F7FA] mb-2 relative z-10">{app.title}</h3>
              <p className="text-[#A0A7B5] mb-6 flex-1 text-sm leading-relaxed relative z-10">{app.desc}</p>
              
              <ul className="space-y-3 relative z-10 border-t border-white/5 pt-5 mt-auto">
                {app.features.map(f => (
                  <li key={f} className="text-xs text-[#A0A7B5] flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${app.active ? 'bg-[#2B85EB]' : 'bg-[#2B85EB]/40'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
