import { motion } from "framer-motion";
import { Sparkles, CalendarDays, Users, QrCode, ArrowRight } from "lucide-react";

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
    <section id="plataforma" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-3 py-1 rounded-full bg-brand-primary/5 text-sm font-semibold text-brand-primary mb-6"
          >
            O Ecossistema
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-brand-primary tracking-tight mb-6"
          >
            Uma plataforma.<br />Diversas soluções.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-brand-primary/60 font-light"
          >
            A MillionsNest está construindo um ecossistema completo de ferramentas interligadas para igrejas e ministérios.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 - Disponível */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="col-span-1 md:col-span-2 lg:col-span-3 rounded-[2rem] bg-brand-primary p-8 md:p-12 relative overflow-hidden group shadow-2xl flex flex-col md:flex-row gap-8 items-center justify-between"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-brand-secondary),_transparent_70%)] opacity-20 group-hover:opacity-30 transition-opacity duration-1000" />
            
            <div className="relative z-10 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-brand-secondary text-brand-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Disponível Agora</div>
                <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
                  <Sparkles className="w-4 h-4 text-brand-secondary" />
                  Flagship App
                </div>
              </div>
              
              <h3 className="text-3xl md:text-5xl font-bold text-white mb-6">MusicScale</h3>
              <p className="text-white/80 text-lg md:text-xl font-light mb-8">
                Gestão moderna para ministérios de louvor, criando repertórios, escalas de datas e organização de equipes em minutos.
              </p>
              
              <div className="flex flex-wrap gap-2 mb-10">
                {["Escalas Inteligentes", "Banco de Músicas", "Cifras e Letras", "Playlists", "Transposição", "App Mobile"].map(feature => (
                  <span key={feature} className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/90 text-sm backdrop-blur-sm">
                    {feature}
                  </span>
                ))}
              </div>
              
              <a href="#musicscale" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-brand-primary font-semibold hover:bg-brand-accent transition-colors">
                Conhecer MusicScale
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="relative z-10 w-full max-w-md h-64 md:h-auto bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm self-stretch flex items-center justify-center -rotate-2 group-hover:rotate-0 transition-transform duration-500">
              <div className="text-white/40 font-mono text-sm">Dashboard Analytics</div>
            </div>
          </motion.div>

          {/* Cards Em Desenvolvimento */}
          {futureApps.map((app, idx) => (
            <motion.div
              key={app.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#fbfbfc] rounded-3xl p-8 border border-brand-primary/10 relative overflow-hidden flex flex-col h-full group"
            >
              <div className="absolute top-8 right-8 text-xs font-semibold px-3 py-1 rounded-full bg-brand-primary/5 text-brand-primary/40 uppercase tracking-wide">
                Em Breve
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
