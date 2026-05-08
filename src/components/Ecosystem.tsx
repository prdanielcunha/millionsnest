import { motion } from "framer-motion";
import { CalendarDays, Users, QrCode } from "lucide-react";

export function Ecosystem() {
  const futureApps = [
    {
      title: "CultoFlow",
      icon: <CalendarDays className="w-6 h-6" />,
      desc: "Planejamento e organização completa da liturgia e direção do culto.",
      features: ["Ordem do culto", "Cronograma", "Equipes", "Fluxo ao vivo"]
    },
    {
      title: "CellHub",
      icon: <Users className="w-6 h-6" />,
      desc: "Gestão inteligente e acompanhamento de células e pequenos grupos.",
      features: ["Presença", "Líderes", "Acompanhamento", "Relatórios"]
    },
    {
      title: "VisitTrack",
      icon: <QrCode className="w-6 h-6" />,
      desc: "Gestão moderna de visitantes com check-in inteligente e integração.",
      features: ["QR Code", "Formulários", "Follow-up automático"]
    }
  ];

  return (
    <section id="ecossistema" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-3 py-1 rounded-full bg-brand-primary/5 text-sm font-semibold text-brand-primary mb-6"
          >
            A Visão MillionsNest
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-brand-primary tracking-tight mb-6"
          >
            O MusicScale é apenas o começo.<br />
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-brand-primary/60 font-light"
          >
            A MillionsNest está construindo um ecossistema completo de gestão para igrejas. Ao entrar no MusicScale hoje, você garante seu passaporte para a próxima geração da organização ministerial.
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
              className="bg-[#fbfbfc] rounded-3xl p-8 border border-brand-primary/10 relative overflow-hidden flex flex-col h-full group"
            >
              <div className="absolute top-8 right-8 text-[10px] font-bold px-3 py-1 rounded-full bg-brand-secondary/10 text-brand-secondary uppercase tracking-wider">
                Em Desenvolvimento
              </div>
              
              <div className="w-14 h-14 rounded-2xl bg-white border border-brand-primary/10 flex items-center justify-center text-brand-primary shadow-sm mb-6 group-hover:scale-110 transition-transform">
                {app.icon}
              </div>
              
              <h3 className="text-2xl font-bold text-brand-primary mb-3">{app.title}</h3>
              <p className="text-brand-primary/60 mb-8 flex-1">{app.desc}</p>
              
              <ul className="space-y-3">
                {app.features.map(f => (
                  <li key={f} className="text-sm font-medium text-brand-primary flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/20" />
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
