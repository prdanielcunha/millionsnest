import { motion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-primary/5 border border-brand-primary/10 text-xs font-semibold text-brand-primary uppercase tracking-wider mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-brand-secondary opacity-80 animate-pulse"></span>
          A nova era da gestão
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-brand-primary max-w-4xl leading-[1.1]"
        >
          Ferramentas modernas para <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">igrejas organizadas.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg md:text-xl text-brand-primary/60 max-w-2xl font-light leading-relaxed"
        >
          Centralize ministérios, equipes, cultos, escalas e processos em uma plataforma criada para a realidade das igrejas modernas.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <a href="#precos" className="w-full sm:w-auto px-8 py-4 rounded-full bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 flex items-center justify-center gap-2 group">
            Começar teste grátis
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#musicscale" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-brand-primary font-medium border border-brand-primary/10 hover:bg-brand-primary/5 transition-all flex items-center justify-center gap-2">
            <Play className="w-4 h-4 fill-brand-primary" />
            Conhecer o MusicScale
          </a>
        </motion.div>


      </div>
    </section>
  );
}
