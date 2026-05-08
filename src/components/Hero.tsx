import { motion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardMockup } from "./DashboardMockup";

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
          Conheça o Plataforma MillionsNest
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-brand-primary max-w-5xl leading-[1.1]"
        >
          Organize seu Ministério de Louvor em <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">Minutos, Não em Horas.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg md:text-xl text-brand-primary/60 max-w-3xl font-light leading-relaxed"
        >
          Chega de escalas no WhatsApp e cifras perdidas. O <b>MusicScale</b> é a ferramenta definitiva para conectar músicos, organizar repertórios e focar no que importa: a adoração.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-full bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 flex items-center justify-center gap-2 group">
            Começar Teste Grátis de 7 Dias
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#funcionalidades" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-brand-primary font-medium border border-brand-primary/10 hover:bg-brand-primary/5 transition-all flex items-center justify-center gap-2">
            <Play className="w-4 h-4 fill-brand-primary" />
            Ver Demonstração
          </a>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 w-full relative max-w-5xl mx-auto"
        >
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fbfbfc]/80 to-transparent z-20 pointer-events-none translate-y-10" />
          
          <div className="relative z-10 mx-auto rounded-xl md:rounded-2xl border border-brand-primary/10 bg-white/50 backdrop-blur-sm p-1.5 md:p-2 shadow-2xl shadow-brand-primary/10 overflow-hidden flex justify-center">
             <div className="w-full max-w-[1000px] h-[400px] sm:h-[500px] md:h-[600px] relative rounded-lg md:rounded-xl overflow-hidden bg-[#0a0a0a]">
                <div className="absolute inset-0 origin-top scale-[0.6] sm:scale-[0.8] md:scale-100 flex justify-center w-[800px] max-w-none left-1/2 -translate-x-1/2 md:w-full md:left-0 md:translate-x-0">
                  <DashboardMockup />
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
