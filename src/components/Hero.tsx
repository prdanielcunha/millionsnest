import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { useTranslation, Trans } from 'react-i18next';

const DashboardMockup = lazy(() => import("./DashboardMockup.js").then((m) => ({ default: m.DashboardMockup })));

export function Hero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(['landing']);

  const handleCtaClick = () => {
    navigate('/musicscale');
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-[#050505] min-h-screen">
      {/* Premium Background Glow & Image - Hardware Accelerated */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen mix-blend-lighten">
        <img src="/M_fundo.png" alt="" className="w-full h-full object-cover object-top opacity-40" />
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none flex justify-center mt-20 opacity-10 md:opacity-20">
        <img src="/M_semfundo.png" alt="" className="w-[800px] max-w-none object-contain translate-y-10" />
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[300px] md:h-[400px] bg-[#2B85EB]/10 rounded-[100%] blur-[100px] md:blur-[120px] pointer-events-none transform-gpu z-0" />
      <div className="absolute top-40 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[250px] md:h-[300px] bg-[#F5F7FA]/5 rounded-[100%] blur-[80px] md:blur-[100px] pointer-events-none transform-gpu z-0" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A0A7B5] mb-8 hover:bg-white/10 transition-colors cursor-pointer group"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#2B85EB] opacity-100 shadow-[0_0_8px_rgba(43,133,235,0.8)]"></span>
          <span><Trans i18nKey="landing:hero_tag" components={{ 1: <span className="text-[#F5F7FA] font-bold" /> }} /> <span className="hidden sm:inline text-[#2B85EB]">{t('hero_tag_free')}</span></span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#F5F7FA] to-[#A0A7B5] max-w-5xl leading-[1.05] pb-2"
        >
          <Trans i18nKey="landing:hero_title" components={{ br: <br className="hidden md:block" /> }} />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-lg md:text-xl text-[#A0A7B5] max-w-2xl font-normal leading-relaxed"
        >
          <Trans i18nKey="landing:hero_desc" components={{ 1: <span className="text-[#F5F7FA] font-semibold underline decoration-[#2B85EB]/50 underline-offset-4" /> }} />
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <button 
            onClick={handleCtaClick}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#F5F7FA] text-[#050505] font-semibold hover:bg-white transition-all shadow-[0_0_20px_rgba(245,247,250,0.1)] hover:shadow-[0_0_30px_rgba(245,247,250,0.2)] active:scale-95 flex items-center justify-center gap-2 group"
          >
            {t('hero_cta_primary')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button onClick={() => navigate('/musicscale#musicscale-demo')} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#0B0F19] text-[#F5F7FA] font-medium border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2 group shadow-sm">
            <Play className="w-4 h-4 text-[#A0A7B5] group-hover:text-white transition-colors" />
            {t('hero_cta_secondary')}
          </button>
        </motion.div>

        {/* Dashboard Mockup Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 w-full relative max-w-5xl mx-auto"
        >
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent z-20 pointer-events-none translate-y-10" />
          
          <div className="relative z-10 mx-auto rounded-xl md:rounded-2xl border border-white/10 bg-[#0B0F19]/50 backdrop-blur-md p-1.5 md:p-2 premium-shadow overflow-hidden flex justify-center">
             <div className="w-full max-w-[1000px] relative rounded-lg md:rounded-xl overflow-hidden bg-[#050505] border border-white/5 flex justify-center">
                <Suspense fallback={<div className="w-full aspect-[16/9] animate-pulse bg-white/5" />}>
                  <DashboardMockup />
                </Suspense>
             </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
