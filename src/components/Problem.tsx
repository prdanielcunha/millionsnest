import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";

export function Problem() {
  return (
    <section className="py-24 md:py-32 bg-[#fbfbfc]">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-brand-primary tracking-tight leading-tight"
          >
            A igreja deveria gastar tempo com pessoas.<br className="hidden md:block" /> 
            <span className="text-brand-primary/40">Não com caos operacional.</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 relative">
          
          {/* ANTES */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-8 md:p-10 border border-red-100 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500 opacity-20 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-lg font-semibold text-red-500 mb-6 uppercase tracking-wider flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Antes (O Caos)
            </h3>
            
            <ul className="space-y-5">
              {[
                "Escalas perdidas no WhatsApp",
                "PDFs de cifras espalhados sem versão",
                "Informações descentralizadas",
                "Visitantes esquecidos na recepção",
                "Comunicação confusa e ruidosa",
                "Processos engessados e muito manuais"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-brand-primary/70">
                  <span className="mt-1 text-red-400/50">—</span>
                  <span className="font-medium text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* DEPOIS */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-brand-primary rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-brand-secondary),_transparent_50%)] opacity-10" />
            <h3 className="text-lg font-semibold text-brand-secondary mb-6 uppercase tracking-wider flex items-center gap-2 relative z-10">
              <CheckCircle2 className="w-5 h-5" />
              Com MillionsNest
            </h3>
            
            <ul className="space-y-5 relative z-10">
              {[
                "Organização total",
                "Centralização de dados",
                "Automação inteligente",
                "Clareza e transparência",
                "Comunicação eficiente",
                "Acompanhamento em tempo real"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/90">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-brand-secondary flex-shrink-0" />
                  <span className="font-medium text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
