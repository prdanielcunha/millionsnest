import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";

export function Problem() {
  return (
    <section className="py-24 md:py-32 bg-[#0B0F19] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight leading-tight"
          >
            Você não foi chamado para ser<br className="hidden md:block" /> 
            <span className="text-[#A0A7B5]"> administrador de planilha.</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 relative">
          
          {/* ANTES */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#050505] rounded-3xl p-8 md:p-10 border border-white/5 relative overflow-hidden group hover:border-[#EF4444]/20 transition-colors"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#EF4444]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-sm font-semibold text-[#EF4444] mb-8 uppercase tracking-widest flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              O Jeito Antigo
            </h3>
            
            <ul className="space-y-6">
              {[
                "Escalas perdidas no meio de mensagens do WhatsApp",
                "Músicos tocando no tom errado da cantora",
                "PDFs de cifras espalhados e sem versão atualizada",
                "Passar madrugadas arrumando repertório de domingo",
                "Integrantes esquecendo o dia da própria escala"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[#A0A7B5]">
                  <span className="mt-1 text-[#EF4444]/40 text-sm">—</span>
                  <span className="font-normal text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* DEPOIS */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#050505] rounded-3xl p-8 md:p-10 border border-[#2B85EB]/20 relative overflow-hidden shadow-[0_0_40px_rgba(43,133,235,0.05)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(43,133,235,0.15),_transparent_60%)] pointer-events-none" />
            <h3 className="text-sm font-semibold text-[#2B85EB] mb-8 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <CheckCircle2 className="w-4 h-4" />
              Com MillionsNest
            </h3>
            
            <ul className="space-y-6 relative z-10">
              {[
                "Escalas automáticas com notificação visual",
                "Transposição de tom em 1 clique",
                "Banco Master de cifras na palma da mão",
                "Playlists prontas e unificadas para a equipe",
                "Dashboard claro de quem toca no próximo culto"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[#F5F7FA]">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-[#2B85EB] flex-shrink-0" />
                  <span className="font-normal text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
