import { motion } from "framer-motion";

export function Roadmap() {
  return (
    <section id="roadmap" className="py-24 md:py-32 bg-brand-primary text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
        >
          Estamos apenas começando.
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xl text-white/60 font-light max-w-2xl mx-auto mb-20"
        >
          A MillionsNest está construindo a próxima geração de ferramentas para igrejas modernas.
        </motion.p>
        
        {/* Abstract Roadmap Line */}
        <div className="relative max-w-4xl mx-auto">
          {/* Central Line */}
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-y-1/2 hidden md:block" />
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-4 flex-wrap relative">
            {[
              { label: "Louvor", status: "Live", current: true },
              { label: "Culto", status: "Em Breve" },
              { label: "Visitantes", status: "Q3 2026" },
              { label: "Células", status: "Q4 2026" },
              { label: "Financeiro", status: "Futuro" },
            ].map((step, idx) => (
              <motion.div 
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col items-center gap-4 relative group cursor-default"
              >
                {/* Node */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border backdrop-blur-sm transition-transform duration-500 group-hover:scale-110 shadow-xl ${step.current ? 'bg-brand-secondary/20 border-brand-secondary shadow-brand-secondary/20' : 'bg-white/5 border-white/10'}`}>
                   <div className={`w-3 h-3 rounded-full ${step.current ? 'bg-brand-secondary shadow-[0_0_15px_#29bec9]' : 'bg-white/30'}`} />
                </div>
                
                <div className="text-center">
                  <div className={`text-sm font-bold uppercase tracking-wider mb-1 ${step.current ? 'text-brand-secondary' : 'text-white'}`}>{step.label}</div>
                  <div className="text-xs font-semibold text-white/40">{step.status}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
