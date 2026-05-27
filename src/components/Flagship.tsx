import { motion } from "framer-motion";
import { Music, LayoutGrid, Smartphone, Database, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EscalasMockup } from "./EscalasMockup.js";
import { useTranslation, Trans } from 'react-i18next';

export function Flagship() {
  const { t } = useTranslation(['landing']);
  return (
    <section id="funcionalidades" className="py-24 md:py-32 bg-[#050505] text-[#F5F7FA] relative overflow-hidden border-b border-white/5">
      {/* Dark mode glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#2B85EB]/10 blur-[120px] rounded-full pointer-events-none transform-gpu" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-white/5 blur-[140px] rounded-full pointer-events-none transform-gpu" />

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
              {t('flagship_tag')}
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-semibold tracking-tight mb-6"
            >
              <Trans i18nKey="landing:flagship_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-[#A0A7B5] font-normal leading-relaxed"
            >
              {t('flagship_desc')}
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4 w-full md:w-auto"
          >
            <Link 
              to="/login" 
              className="px-8 py-4 rounded-xl bg-[#F5F7FA] text-[#050505] font-semibold hover:bg-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {t('flagship_cta')}
            </Link>
          </motion.div>
        </div>

        {/* Video Placeholder Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full h-[250px] sm:h-[400px] md:h-[500px] bg-[#0B0F19] rounded-[2rem] border border-white/5 mb-24 relative overflow-hidden flex items-center justify-center group cursor-pointer hover:border-white/10 transition-colors"
          onClick={() => alert(t('flagship_demo_alert', 'Vídeo prático demonstrando o uso do app na igreja será adicionado aqui em breve!'))}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent pointer-events-none" />
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-white/10 transition-all backdrop-blur-sm z-10 shadow-lg">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#F5F7FA]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="absolute bottom-6 text-[#A0A7B5] text-sm font-medium z-10 flex items-center gap-2">
            {t('flagship_watch_action', 'Ver aplicativo em ação')} <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/10">{t('soon', 'Em breve')}</span>
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Escalas & Setlists */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-[2rem] bg-[#0B0F19]/50 backdrop-blur-sm border border-white/5 p-0 flex flex-col relative overflow-hidden group hover:border-[#2B85EB]/20 hover:shadow-[0_0_30px_rgba(43,133,235,0.05)] transition-all h-full"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className="p-8 pb-4 relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <LayoutGrid className="w-5 h-5 text-[#2B85EB]" />
                <h3 className="text-2xl font-semibold text-[#F5F7FA]">{t('flagship_feature2_title')}</h3>
              </div>
              <p className="text-[#A0A7B5] font-normal"><Trans i18nKey="landing:flagship_feature2_desc" components={{ 1: <strong /> }} /></p>
            </div>
            
            {/* Visual element */}
            <div className="w-full mt-2 relative overflow-hidden flex justify-center pt-2 min-h-[200px] sm:min-h-[250px] md:min-h-[280px]">
               <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-transparent to-[#0B0F19]" />
               <div className="absolute inset-x-0 top-2 flex justify-center">
                 <div className="w-[1024px] origin-top scale-[0.35] sm:scale-[0.5] md:scale-[0.55] lg:scale-[0.65] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:scale-[0.37] sm:group-hover:scale-[0.52] md:group-hover:scale-[0.57] lg:group-hover:scale-[0.67]">
                   <EscalasMockup />
                 </div>
               </div>
            </div>
          </motion.div>

          {/* Card 2: Sharing & Team */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="md:col-span-1 rounded-[2rem] bg-[#0B0F19] border border-white/5 p-8 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-colors"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(43,133,235,0.1),_transparent_80%)] opacity-50" />
            <div className="flex items-center justify-between relative z-10">
              <Users className="w-8 h-8 text-[#2B85EB]" />
              <div className="px-2 py-1 rounded bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[10px] font-bold text-[#2B85EB] uppercase tracking-tighter">WhatsApp ready</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">{t('flagship_feature3_title')}</h3>
              <p className="text-[#A0A7B5] font-normal leading-snug"><Trans i18nKey="landing:flagship_feature3_desc" components={{ 1: <strong /> }} /></p>
            </div>
          </motion.div>

          {/* Card 3: Transposição */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="md:col-span-1 rounded-[2rem] bg-[#0B0F19] border border-white/5 p-8 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-colors"
          >
            <div className="flex gap-3 relative z-10">
              <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-sm font-semibold font-mono text-[#F5F7FA] shadow-sm">C</div>
              <div className="w-12 h-12 flex items-center justify-center bg-transparent text-sm font-semibold font-mono text-[#A0A7B5]">→</div>
              <div className="w-12 h-12 flex items-center justify-center bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl border border-[#2B85EB]/20 text-sm font-bold font-mono shadow-sm">D</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-semibold mb-2 text-[#F5F7FA]">{t('flagship_feature4_title')}</h3>
              <p className="text-[#A0A7B5] font-normal leading-snug">
                <Trans i18nKey="landing:flagship_feature4_desc" components={{ 1: <strong /> }} />
              </p>
            </div>
          </motion.div>

          {/* Card 4: Biblioteca Viva MusicScale */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 rounded-[2rem] bg-gradient-to-br from-[#0B0F19] to-[#060912] border border-[#2B85EB]/30 p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:border-[#2B85EB]/60 hover:shadow-[0_0_50px_rgba(43,133,235,0.15)] transition-all duration-500 h-auto md:h-full"
          >
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/5 blur-[80px] rounded-full pointer-events-none transform-gpu" />
             <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2B85EB]/3 blur-[60px] rounded-full pointer-events-none transform-gpu" />

             <div className="flex-1 w-full relative z-10">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/30 flex items-center justify-center">
                   <Database className="w-5 h-5 text-[#2B85EB]" />
                 </div>
                 <span className="text-[10px] font-bold text-[#2B85EB] uppercase tracking-widest bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-3 py-1 rounded-full">
                   Acesso Premium
                 </span>
               </div>
               <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
                 {t('flagship_feature1_title')}
               </h3>
               <p className="text-[#A0A7B5] font-normal leading-relaxed text-sm md:text-base max-w-md">
                 <Trans i18nKey="landing:flagship_feature1_desc" components={{ 1: <strong /> }} />
               </p>
             </div>

             {/* Live interactive-looking floating library mockup */}
             <div className="flex-1 w-full h-[220px] relative flex items-center justify-center select-none mt-4 md:mt-0">
               {/* Inner glow backdrop */}
               <div className="absolute w-44 h-44 bg-[#2B85EB]/10 blur-[40px] rounded-full" />
               
               {/* Card A: Outer Back Floating Card */}
               <div className="absolute left-2 sm:left-4 top-4 w-[170px] bg-[#0E1321]/80 border border-white/5 rounded-2xl p-4 shadow-xl transform -rotate-6 transition-transform duration-500 group-hover:-rotate-12 group-hover:-translate-x-2 backdrop-blur-md">
                 <div className="flex items-center gap-2 mb-1.5">
                   <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                   <span className="text-[9px] text-[#10B981] font-bold uppercase tracking-wider">Acervo Ativo</span>
                 </div>
                 <h4 className="text-xs font-semibold text-[#F5F7FA] truncate">Agnus Dei</h4>
                 <p className="text-[9px] text-[#A0A7B5]">Michael W. Smith — G</p>
                 <div className="flex gap-1 mt-2 text-[8px] font-mono text-[#2B85EB]">
                   <span className="bg-[#2B85EB]/10 px-1 py-0.5 rounded font-bold">G</span>
                   <span className="bg-[#2B85EB]/10 px-1 py-0.5 rounded font-bold">C9</span>
                   <span className="bg-[#2B85EB]/10 px-1 py-0.5 rounded font-bold">Dsus</span>
                 </div>
               </div>

               {/* Card B: Main Premium Floating Card */}
               <div className="absolute right-2 sm:right-4 bottom-2 w-[210px] bg-[#121A2E]/95 border border-[#2B85EB]/30 rounded-2xl p-5 shadow-2xl transform rotate-3 transition-transform duration-500 group-hover:rotate-6 group-hover:translate-x-2 group-hover:-translate-y-1 backdrop-blur-md z-10">
                 <div className="flex items-center justify-between mb-2.5">
                   <span className="text-[8px] font-bold uppercase tracking-wider bg-[#2B85EB]/20 text-[#2B85EB] px-2 py-0.5 rounded border border-[#2B85EB]/30">
                     Biblioteca Viva
                   </span>
                   <span className="text-[9px] text-[#A0A7B5] font-semibold">120 BPM</span>
                 </div>
                 <h4 className="text-base font-bold text-white truncate">Rei da Glória</h4>
                 <p className="text-xs text-[#A0A7B5] mb-4">Worship — Tom: G</p>
                 <div className="space-y-2">
                   <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                     <span className="opacity-60">Intro:</span>
                     <span className="text-[#2B85EB] font-bold">Em7 · C9 · G · D4</span>
                   </div>
                   <div className="h-[1px] bg-white/5 w-full" />
                   <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                     <span className="opacity-60">Verso:</span>
                     <span className="text-[#2B85EB] font-bold">G · D/F# · Em7</span>
                   </div>
                 </div>
               </div>
               
               {/* Star burst particle graphics */}
               <div className="absolute right-0 top-8 w-1.5 h-1.5 bg-[#2B85EB] rounded-full opacity-60 animate-ping" />
               <div className="absolute left-12 bottom-4 w-1 h-1 bg-[#2B85EB] rounded-full opacity-40" />
             </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
