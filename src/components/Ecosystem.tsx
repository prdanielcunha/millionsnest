import { motion } from "framer-motion";
import { CalendarDays, Users, QrCode } from "lucide-react";

export function Ecosystem() {
  const futureApps = [
    {
      title: "Organização de Cultos",
      icon: <CalendarDays className="w-5 h-5" />,
      desc: "Planejamento e coordenação completa da liturgia, direção e equipes do culto.",
      features: ["Ordem do culto", "Cronograma", "Equipes", "Fluxo ao vivo"]
    },
    {
      title: "Gestão Ministerial",
      icon: <Users className="w-5 h-5" />,
      desc: "Gestão inteligente, centralizada e acompanhamento de equipes e coordenações.",
      features: ["Integração", "Líderes", "Membros", "Relatórios"]
    },
    {
      title: "Comunicação e Analytics",
      icon: <QrCode className="w-5 h-5" />,
      desc: "Plataforma de avisos e tomadas de decisão embasadas com detalhados.",
      features: ["Avisos", "Dashboards integrados", "Otimização"]
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
            A Visão MillionsNest
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight mb-6"
          >
            Expandindo o ecossistema.<br />
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-[#A0A7B5] font-normal leading-relaxed"
          >
            Estamos desenvolvendo a mais sofisticada infraestrutura digital para igrejas. Não apenas aplicativos isolados, mas um ecossistema nativo e integrado para as áreas vitais da gestão executiva do seu ministério.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {futureApps.map((app, idx) => (
            <motion.div
              key={app.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#0B0F19] rounded-2xl p-8 border border-white/5 relative overflow-hidden flex flex-col h-full group hover:border-[#2B85EB]/20 hover:shadow-[0_0_30px_rgba(43,133,235,0.05)] transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

              <div className="absolute top-8 right-8 text-[9px] font-bold px-2.5 py-1 rounded-md bg-white/5 text-[#A0A7B5] uppercase tracking-widest border border-white/5">
                Em Breve
              </div>
              
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F5F7FA] mb-6 group-hover:scale-110 group-hover:bg-[#2B85EB]/10 group-hover:text-[#2B85EB] group-hover:border-[#2B85EB]/20 transition-all duration-500">
                {app.icon}
              </div>
              
              <h3 className="text-xl font-semibold text-[#F5F7FA] mb-3 relative z-10">{app.title}</h3>
              <p className="text-[#A0A7B5] mb-8 flex-1 text-sm leading-relaxed relative z-10">{app.desc}</p>
              
              <ul className="space-y-4 relative z-10 border-t border-white/5 pt-6 mt-4">
                {app.features.map(f => (
                  <li key={f} className="text-sm text-[#A0A7B5] flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2B85EB]/40 flex-shrink-0" />
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
