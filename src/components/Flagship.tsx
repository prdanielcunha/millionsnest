import { motion } from "framer-motion";
import { Music, LayoutGrid, Smartphone, Database, ArrowUpRight } from "lucide-react";

export function Flagship() {
  return (
    <section id="musicscale" className="py-24 md:py-32 bg-[#05050A] text-white relative overflow-hidden">
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
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-brand-secondary text-sm font-semibold mb-6 uppercase tracking-wider border border-white/10"
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
              O primeiro aplicativo <br /> da plataforma.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xl text-white/50 font-light"
            >
              Resolve uma das maiores dores dos ministérios de louvor: a organização impecável e acesso unificado.
            </motion.p>
          </div>
          
          <motion.a 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            href="#precos" 
            className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            Start App <ArrowUpRight className="w-4 h-4" />
          </motion.a>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[300px]">
          
          {/* Card 1: Escalas */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-[2rem] bg-white/5 border border-white/10 p-8 flex flex-col relative overflow-hidden group hover:border-white/20 transition-colors"
          >
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">Gestão de Escalas</h3>
              <p className="text-white/50 font-medium">Cronogramas limpos, sem confusão.</p>
            </div>
            
            {/* Visual element */}
            <div className="h-32 w-[120%] -ml-[10%] bg-white/5 border-t border-white/10 rounded-t-3xl mt-auto relative overflow-hidden">
               <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_1px,_rgba(255,255,255,0.05)_1px),_linear-gradient(to_bottom,transparent_1px,_rgba(255,255,255,0.05)_1px)] bg-[size:20px_20px]" />
               <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-3">
                  <div className="w-32 h-16 bg-white/10 rounded-lg border border-white/20" />
                  <div className="w-32 h-16 bg-brand-secondary/20 rounded-lg border border-brand-secondary/40" />
                  <div className="w-32 h-16 bg-white/10 rounded-lg border border-white/20" />
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
