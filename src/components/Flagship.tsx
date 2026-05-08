import { motion } from "framer-motion";
import { Music, LayoutGrid, Smartphone, Database, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EscalasMockup } from "./EscalasMockup";

export function Flagship() {
  return (
    <section id="funcionalidades" className="py-24 md:py-32 bg-[#05050A] text-white relative overflow-hidden">
      {/* Dark mode glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-primary/40 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 md:mb-24 gap-8">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-secondary/10 text-brand-secondary text-sm font-semibold mb-6 uppercase tracking-wider border border-brand-secondary/20"
            >
              <Music className="w-4 h-4" />
              MusicScale
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
            >
              Tudo o que seu ministério <br /> realmente precisa.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xl text-white/50 font-light"
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
              className="px-8 py-4 rounded-full bg-brand-secondary text-[#0a0a0a] font-bold hover:bg-brand-secondary/90 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(41,190,201,0.3)] w-full sm:w-auto"
            >
              Quero ter no meu Ministério
            </Link>
          </motion.div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[300px]">
          
          {/* Card 1: Escalas */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-[2rem] bg-white/5 border border-white/10 p-0 flex flex-col relative overflow-hidden group hover:border-white/20 transition-colors h-full"
          >
            <div className="p-8 pb-4">
              <h3 className="text-2xl font-bold mb-2">Gestão de Escalas</h3>
              <p className="text-white/50 font-medium">Cronogramas limpos, sem confusão.</p>
            </div>
            
            {/* Visual element */}
            <div className="w-full mt-2 flex-1 relative overflow-hidden flex justify-center items-start pt-2">
               <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_-20px_20px_-20px_rgba(0,0,0,0.5)]" />
               <div className="w-[600px] md:w-[850px] origin-top scale-[0.55] md:scale-[0.65] lg:scale-[0.7] transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-[0.57] md:group-hover:scale-[0.67] lg:group-hover:scale-[0.72]">
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
            className="md:col-span-1 rounded-[2rem] bg-[#00171a] border border-[#29bec9]/20 p-8 flex flex-col relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--color-brand-secondary),_transparent_80%)] opacity-20" />
            <Smartphone className="w-8 h-8 text-brand-secondary mb-4" />
            <h3 className="text-2xl font-bold mb-2 text-white">Mobile-First</h3>
            <p className="text-brand-secondary/70 font-medium">Perfeito para visualizar na hora do culto.</p>
          </motion.div>

          {/* Card 3: Banco */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="md:col-span-1 rounded-[2rem] bg-white/5 border border-white/10 p-8 flex flex-col relative overflow-hidden group"
          >
            <Database className="w-8 h-8 text-white/70 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Banco de Músicas</h3>
            <p className="text-white/50 font-medium">Repertório oficial sempre atualizado.</p>
          </motion.div>

          {/* Card 4: Funcionalidades Extra */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 rounded-[2rem] bg-white/5 border border-white/10 p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group relative overflow-hidden"
          >
             <div className="flex-1 w-full relative z-10">
               <h3 className="text-2xl font-bold mb-2">Transposição em 1 clique</h3>
               <p className="text-white/50 font-medium mb-6">Mude o tom da cifra instantaneamente. Crie playlists para cada culto com as cifras exatas.</p>
               <div className="flex gap-2">
                 <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-bold font-mono">C</div>
                 <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-bold font-mono">{"->"}</div>
                 <div className="px-4 py-2 bg-brand-secondary/20 text-brand-secondary rounded-lg border border-brand-secondary/30 text-sm font-bold font-mono">D</div>
               </div>
             </div>
             <LayoutGrid className="w-32 h-32 text-white/5 absolute -bottom-8 -right-8 -rotate-12" />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
