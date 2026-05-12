import { motion } from "framer-motion";
import { Music, LayoutGrid, Smartphone, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { EscalasMockup } from "./EscalasMockup";

export function Flagship() {
  return (
    <section id="funcionalidades" className="py-24 md:py-32 bg-[#050505] text-[#F5F7FA] relative overflow-hidden border-b border-white/5">
      {/* Dark mode glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#2B85EB]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-white/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 md:mb-24 gap-8">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B85EB]/10 text-[#2B85EB] text-xs font-semibold mb-6 uppercase tracking-widest border border-[#2B85EB]/20"
            >
              <Music className="w-3.5 h-3.5" />
              MusicScale
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-semibold tracking-tight mb-6"
            >
              Tudo o que seu ministério <br className="hidden md:block" /> realmente precisa.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-[#A0A7B5] font-normal leading-relaxed"
            >
              O MusicScale centraliza suas músicas, escalas e arquivos em uma experiência de software premium, rápida e desenhada especificamente para músicos.
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link 
              to="/login" 
              className="px-8 py-4 rounded-xl bg-[#F5F7FA] text-[#050505] font-semibold hover:bg-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              Quero no meu Ministério
            </Link>
          </motion.div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
          
          {/* Card 1: Escalas */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-[2rem] bg-[#0B0F19]/50 backdrop-blur-sm border border-white/5 p-0 flex flex-col relative overflow-hidden group hover:border-[#2B85EB]/20 hover:shadow-[0_0_30px_rgba(43,133,235,0.05)] transition-all h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className="p-8 pb-4 relative z-10">
              <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">Gestão de Escalas</h3>
              <p className="text-[#A0A7B5] font-normal">Cronogramas limpos, sem confusão.</p>
            </div>
            
            {/* Visual element */}
            <div className="w-full mt-2 flex-1 relative overflow-hidden flex justify-center items-start pt-2">
               <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-transparent to-[#0B0F19]" />
               <div className="w-[600px] md:w-[850px] origin-top scale-[0.55] md:scale-[0.65] lg:scale-[0.7] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:scale-[0.57] md:group-hover:scale-[0.67] lg:group-hover:scale-[0.72]">
                 <EscalasMockup />
               </div>
            </div>
          </motion.div>

          {/* Card 2: Mobile */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="md:col-span-1 rounded-[2rem] bg-[#0B0F19] border border-white/5 p-8 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-colors"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(43,133,235,0.1),_transparent_80%)] opacity-50" />
            <Smartphone className="w-8 h-8 text-[#2B85EB] relative z-10" />
            <div className="relative z-10">
              <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">Mobile-First</h3>
              <p className="text-[#A0A7B5] font-normal">Perfeito para visualizar na hora do culto.</p>
            </div>
          </motion.div>

          {/* Card 3: Banco */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="md:col-span-1 rounded-[2rem] bg-[#0B0F19] border border-white/5 p-8 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-colors"
          >
            <Database className="w-8 h-8 text-[#F5F7FA]/70 relative z-10" />
            <div className="relative z-10">
              <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">Banco Oficial</h3>
              <p className="text-[#A0A7B5] font-normal">Repertório oficial sempre atualizado.</p>
            </div>
          </motion.div>

          {/* Card 4: Funcionalidades Extra */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 rounded-[2rem] bg-[#0B0F19] border border-white/5 p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:border-white/10 transition-colors"
          >
             <div className="flex-1 w-full relative z-10">
               <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">Transposição em 1 clique</h3>
               <p className="text-[#A0A7B5] font-normal mb-8">Mude o tom da cifra instantaneamente. Crie playlists para cada culto com as cifras exatas.</p>
               <div className="flex gap-3">
                 <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-sm font-semibold font-mono text-[#F5F7FA] shadow-sm">C</div>
                 <div className="w-12 h-12 flex items-center justify-center bg-transparent text-sm font-semibold font-mono text-[#A0A7B5]">→</div>
                 <div className="w-12 h-12 flex items-center justify-center bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl border border-[#2B85EB]/20 text-sm font-bold font-mono shadow-sm">D</div>
               </div>
             </div>
             <LayoutGrid className="w-32 h-32 text-white/[0.03] absolute -bottom-8 -right-8 -rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
