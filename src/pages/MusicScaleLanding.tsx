import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { Pricing } from "../components/Pricing.js";
import { Play, CheckCircle2, CalendarDays, Music, Bell, Library, Mic2, Instagram, ArrowRight, XCircle, LayoutDashboard, ChevronRight, ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.js";

// Premium Brand Lockup Component to replace LogoMS_Horiz.png
const MusicScaleLogo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative flex-shrink-0">
      <div className="absolute inset-0 bg-[#2B85EB]/20 blur-md rounded-full" />
      <img src="/LogoIconMusicScale-1.png" alt="" className="w-10 h-10 md:w-12 md:h-12 object-contain relative z-10" />
    </div>
    <div className="flex flex-col items-start justify-center">
      <span className="text-xl md:text-2xl font-bold tracking-tight text-white leading-none mb-1">MusicScale</span>
      <span className="text-[10px] md:text-xs font-medium text-[#A0A7B5] tracking-widest uppercase leading-none">Menos caos. Mais propósito.</span>
    </div>
  </div>
);

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-2xl bg-[#0B0F19] overflow-hidden transition-colors hover:border-white/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
      >
        <span className="text-lg font-medium text-white pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-[#A0A7B5] transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        className="px-6 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '500px' : '0', opacity: isOpen ? 1 : 0, paddingBottom: isOpen ? '1.25rem' : '0' }}
      >
        <p className="text-[#A0A7B5] leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

export function MusicScaleLanding() {
  const { t } = useTranslation(["musicscale", "common"]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeBentoCard, setActiveBentoCard] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleStartTrial = () => {
    const intent = "musicscale_starter_monthly";
    sessionStorage.setItem("purchase_intent", intent);
    if (user) {
      navigate(`/checkout?plan=${intent}`);
    } else {
      navigate("/login");
    }
  };

  const scrollToDemo = () => {
    const el = document.getElementById('musicscale-demo');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden bg-[#050505] text-[#F5F7FA] selection:bg-[#2B85EB]/30 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] md:w-[1200px] h-[600px] bg-[#2B85EB] opacity-[0.12] blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2B85EB]/30 to-transparent opacity-50" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center">
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-xs font-semibold tracking-widest uppercase mb-10 shadow-[0_0_20px_rgba(43,133,235,0.1)] backdrop-blur-sm"
            >
              {t('musicscale:hero_badge', 'MusicScale by MillionsNest')}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <MusicScaleLogo className="scale-110" />
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 max-w-5xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70"
            >
              <Trans i18nKey="musicscale:hero_title" components={{ 1: <span className="text-[#2B85EB] drop-shadow-[0_0_20px_rgba(43,133,235,0.3)]" /> }}>
                O fim das escalas perdidas no <span className="text-[#2B85EB] drop-shadow-[0_0_20px_rgba(43,133,235,0.3)]">WhatsApp</span>.
              </Trans>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-2xl text-[#A0A7B5] mb-12 max-w-3xl leading-relaxed font-light"
            >
              {t('musicscale:hero_subtitle', 'Escalas, repertório, confirmações, notificações e preparação do culto em uma experiência premium para ministérios de louvor.')}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto z-20"
            >
              <button 
                onClick={handleStartTrial}
                className="group relative w-full sm:w-auto px-8 py-4 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_40px_rgba(43,133,235,0.4)] hover:shadow-[0_0_60px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                <div className="relative flex items-center justify-center gap-2">
                  {t('musicscale:hero_cta_primary', 'Começar teste grátis')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
              
              <button 
                onClick={scrollToDemo}
                className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-bold rounded-2xl transition-all flex items-center justify-center gap-2 backdrop-blur-md"
              >
                <Play className="w-5 h-5" />
                {t('musicscale:hero_cta_secondary', 'Ver app em ação')}
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-[#A0A7B5] font-medium"
            >
              {[
                t('musicscale:hero_benefit_1', 'Escalas inteligentes'),
                t('musicscale:hero_benefit_2', 'Confirmação de presença'),
                t('musicscale:hero_benefit_3', 'Biblioteca Viva'),
                t('musicscale:hero_benefit_4', 'Performance Mode')
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2B85EB] opacity-70" />
                  <span>{benefit}</span>
                </div>
              ))}
            </motion.div>

          </div>
        </div>

        {/* Hero Mockup Premium */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl mx-auto mt-24 relative z-10 perspective-1000"
        >
          {/* Background Grid Pattern */}
          <div className="absolute inset-[-100px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwem0yMCAyMGMwLTExLjA0NiA4Ljk1NC0yMCAyMC0yMHY0MGMtMTEuMDQ2IDAtMjAtOC45NTQtMjAtMjB6bS0yMCAwYzAtMTEuMDQ2IDguOTU0LTIwIDIwLTIwdjQwQzguOTU0IDQwIDAgMzEuMDQ2IDAgMjB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=')] opacity-30 pointer-events-none" />

          {/* Floating UI Elements */}
          <div className="hidden lg:block absolute -left-12 top-24 z-20 w-48 p-4 rounded-2xl bg-[#0B0F19]/90 backdrop-blur-xl border border-white/10 shadow-2xl animate-float">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#2B85EB]/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#2B85EB]" />
              </div>
              <div>
                <div className="text-xs text-[#A0A7B5]">Baterista</div>
                <div className="text-sm font-semibold text-white">Confirmado</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block absolute -right-12 bottom-24 z-20 w-48 p-4 rounded-2xl bg-[#0B0F19]/90 backdrop-blur-xl border border-white/10 shadow-2xl animate-float" style={{ animationDelay: '1.5s' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Music className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-[#A0A7B5]">Tom definido</div>
                <div className="text-sm font-semibold text-white">G maior</div>
              </div>
            </div>
          </div>

          <div className="relative rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent p-1 shadow-2xl shadow-[#2B85EB]/20 transform-gpu hover:scale-[1.01] transition-transform duration-500">
            <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/20 to-transparent opacity-50 mix-blend-overlay rounded-[2rem] md:rounded-[2.5rem]" />
            <div className="relative rounded-[1.8rem] md:rounded-[2.4rem] overflow-hidden bg-[#050505] border border-white/10">
               
               {/* Browser/Window Header */}
               <div className="h-10 md:h-12 bg-white/5 border-b border-white/10 flex items-center px-4 md:px-6 gap-2">
                  <div className="flex gap-1.5 md:gap-2">
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                  </div>
                  <div className="mx-auto flex items-center gap-2 px-3 py-1 bg-black/30 rounded-md text-[10px] md:text-xs text-[#A0A7B5] font-mono border border-white/5">
                    <LayoutDashboard className="w-3 h-3 opacity-50" />
                    app.millionsnest.com/musicscale
                  </div>
               </div>

               <picture>
                 <source srcSet="/telas.png" type="image/png" />
                 <img 
                    src="/telas.png" 
                    alt="MusicScale Interface" 
                    className="w-full h-auto object-cover relative z-10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                 />
                 <div className="hidden aspect-video w-full bg-[#050505] flex items-center justify-center p-8 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#2B85EB]/10 via-transparent to-transparent" />
                    <div className="text-center">
                       <MusicScaleLogo className="justify-center mb-6 scale-150 opacity-20" />
                       <p className="text-[#A0A7B5] tracking-widest uppercase text-sm font-semibold">Interface Premium Placeholder</p>
                    </div>
                 </div>
               </picture>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Do Caos ao Controle */}
      <section className="py-32 relative border-y border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[#0B0F19] z-0" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#2B85EB]/5 blur-[120px] rounded-full pointer-events-none z-0" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              {t('musicscale:chaos_title', 'Do caos ao controle.')}
            </h2>
            <p className="text-xl text-[#A0A7B5] max-w-2xl mx-auto">
              {t('musicscale:chaos_subtitle', 'Substitua a desorganização por um fluxo claro e profissional.')}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            {/* Antes */}
            <div className="p-1 rounded-3xl bg-gradient-to-br from-red-500/20 to-transparent">
              <div className="h-full p-8 md:p-12 rounded-[1.4rem] bg-[#050505] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full" />
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold w-fit mb-10 border border-red-500/20 shadow-inner">
                  <XCircle className="w-4 h-4" /> {t('musicscale:chaos_before_tag', 'Como era antes')}
                </div>
                <ul className="space-y-8 flex-1 relative z-10">
                  {[
                    t('musicscale:chaos_before_1', 'Escalas perdidas em grupos de WhatsApp.'),
                    t('musicscale:chaos_before_2', 'Cifras e tons espalhados ou desatualizados.'),
                    t('musicscale:chaos_before_3', 'Músicos esquecendo a escala ou não confirmando.'),
                    t('musicscale:chaos_before_4', 'Líder de louvor sobrecarregado no fim de semana.')
                  ].map((item, i) => (
                    <li key={i} className="flex gap-5 items-start text-[#A0A7B5] group">
                      <div className="w-10 h-10 rounded-full bg-red-500/5 border border-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/10 transition-colors">
                        <XCircle className="w-5 h-5 text-red-500/50" />
                      </div>
                      <span className="text-lg pt-1.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Depois */}
            <div className="p-1 rounded-3xl bg-gradient-to-br from-[#2B85EB]/30 via-[#2B85EB]/10 to-transparent shadow-[0_0_50px_rgba(43,133,235,0.1)] transform-gpu hover:scale-[1.02] transition-transform duration-500">
              <div className="h-full p-8 md:p-12 rounded-[1.4rem] bg-gradient-to-br from-[#0B0F19] to-[#050505] flex flex-col relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#2B85EB]/20 blur-[100px] rounded-full" />
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2B85EB]/20 text-[#2B85EB] text-sm font-semibold w-fit mb-10 relative z-10 border border-[#2B85EB]/30 backdrop-blur-md shadow-[0_0_20px_rgba(43,133,235,0.2)]">
                  <CheckCircle2 className="w-4 h-4" /> {t('musicscale:chaos_after_tag', 'Com o MusicScale')}
                </div>
                <ul className="space-y-8 flex-1 relative z-10">
                  {[
                    t('musicscale:chaos_after_1', 'Escala centralizada, visível para toda a equipe.'),
                    t('musicscale:chaos_after_2', 'Repertório organizado com guias e tons exatos.'),
                    t('musicscale:chaos_after_3', 'Presença confirmada com um clique no app.'),
                    t('musicscale:chaos_after_4', 'Culto preparado com paz, antecedência e excelência.')
                  ].map((item, i) => (
                    <li key={i} className="flex gap-5 items-start text-white group">
                      <div className="w-10 h-10 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 flex items-center justify-center shrink-0 group-hover:bg-[#2B85EB]/20 transition-colors shadow-[0_0_15px_rgba(43,133,235,0.1)]">
                        <CheckCircle2 className="w-5 h-5 text-[#2B85EB]" />
                      </div>
                      <span className="text-lg pt-1.5 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-20 flex justify-center">
             <button 
               onClick={handleStartTrial}
               className="group relative px-8 py-4 bg-white/5 border border-white/10 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)] flex items-center justify-center gap-3 backdrop-blur-md"
             >
               {t('musicscale:chaos_cta', 'Quero organizar minha próxima escala')}
               <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </div>
      </section>

      {/* App em Ação Demo */}
      <section id="musicscale-demo" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              {t('musicscale:demo_title', 'Veja em 60 segundos como o MusicScale organiza sua escala.')}
            </h2>
            <p className="text-xl text-[#A0A7B5] max-w-2xl mx-auto">
              {t('musicscale:demo_subtitle', 'Um fluxo simples: monte a escala, defina o repertório, envie para a equipe e acompanhe confirmações.')}
            </p>
          </div>
          
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-8">
               {/* Premium Mockup Guided Demo */}
               <div className="aspect-[4/3] sm:aspect-video rounded-[2rem] bg-[#0B0F19] border border-white/10 overflow-hidden relative group shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/20 via-transparent to-transparent opacity-60" />
                  <img src="/telas.png" alt="MusicScale em Ação" className="absolute inset-0 w-full h-full object-cover object-top opacity-80" />
                  
                  {/* Subtle overlay to make it look like an interactive demo */}
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center z-10 transition-colors group-hover:bg-black/20">
                    <button className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:bg-[#2B85EB] transition-all duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)] cursor-default">
                       <div className="w-8 h-8 flex items-center justify-center">
                         <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                       </div>
                    </button>
                    <div className="overflow-hidden rounded-full p-[1px] bg-gradient-to-r from-white/10 via-white/30 to-white/10">
                      <p className="text-xs font-bold tracking-widest uppercase text-white bg-[#050505]/90 px-6 py-2.5 rounded-full backdrop-blur-md">
                        {t('musicscale:demo_placeholder', 'Fluxo de Escala Inteligente')}
                      </p>
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-4 flex flex-col gap-8">
               {[
                 { step: "01", title: t('musicscale:demo_step1_title', 'Crie a escala'), desc: t('musicscale:demo_step1_desc', 'Arraste membros e distribua funções rapidamente.') },
                 { step: "02", title: t('musicscale:demo_step2_title', 'Adicione repertório e tons'), desc: t('musicscale:demo_step2_desc', 'Anexe músicas da biblioteca com links e cifras.') },
                 { step: "03", title: t('musicscale:demo_step3_title', 'Notifique a equipe'), desc: t('musicscale:demo_step3_desc', 'Dispare notificações automáticas para todos os envolvidos.') },
                 { step: "04", title: t('musicscale:demo_step4_title', 'Receba confirmações'), desc: t('musicscale:demo_step4_desc', 'Acompanhe quem confirmou presença no aplicativo.') },
                 { step: "05", title: t('musicscale:demo_step5_title', 'Use o Performance Mode'), desc: t('musicscale:demo_step5_desc', 'Visual escuro e focado para o momento do culto.') },
               ].map((item, i) => (
                 <div key={i} className="flex gap-6 group">
                   <div className="flex flex-col items-center">
                     <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-[#A0A7B5] group-hover:border-[#2B85EB] group-hover:text-[#2B85EB] transition-colors shadow-inner">
                       {item.step}
                     </div>
                     {i !== 4 && <div className="w-px h-full bg-gradient-to-b from-white/10 to-transparent my-2" />}
                   </div>
                   <div className="pt-1.5 pb-2">
                     <h4 className="text-lg font-semibold text-white mb-1.5 group-hover:text-[#2B85EB] transition-colors">{item.title}</h4>
                     <p className="text-sm text-[#A0A7B5] leading-relaxed">{item.desc}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Bento Grid Premium */}
      <section className="py-32 bg-[#0B0F19] border-y border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              {t('musicscale:bento_title', 'Tudo no seu lugar.')}
            </h2>
            <p className="text-xl text-[#A0A7B5] max-w-2xl mx-auto">
              {t('musicscale:bento_subtitle', 'Funcionalidades desenhadas com precisão para a rotina da igreja.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(320px,auto)]">
            
            {/* Feature 1 - Escalas Inteligentes (Large) */}
            <div 
              onMouseEnter={() => setActiveBentoCard(1)}
              onMouseLeave={() => setActiveBentoCard(null)}
              className="md:col-span-2 p-1 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent transition-all group overflow-hidden relative cursor-default"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem]" />
               <div className="h-full rounded-[1.8rem] bg-[#050505] p-10 flex flex-col relative overflow-hidden">
                 <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#2B85EB]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                 
                 <div className="flex-1 relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2B85EB]/20 to-transparent border border-[#2B85EB]/30 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                     <CalendarDays className="w-7 h-7 text-[#2B85EB]" />
                   </div>
                   <h3 className="text-3xl font-semibold mb-4 text-white">{t('musicscale:bento_feat1_title', 'Escalas Inteligentes')}</h3>
                   <p className="text-[#A0A7B5] text-lg max-w-md leading-relaxed">{t('musicscale:bento_feat1_desc', 'Montagem visual e intuitiva da escala, evitando conflitos de agenda e garantindo a equipe completa.')}</p>
                 </div>
                 
                 {/* Mini UI element */}
                 <div className={`hidden md:block absolute right-8 top-1/2 -translate-y-1/2 w-64 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-700 ${activeBentoCard === 1 ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-50'}`}>
                    <div className="h-3 w-20 bg-white/20 rounded mb-4" />
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                           <div className="w-8 h-8 rounded-full bg-white/10" />
                           <div className="flex-1">
                             <div className="h-2 w-16 bg-white/20 rounded mb-1.5" />
                             <div className="h-2 w-10 bg-white/10 rounded" />
                           </div>
                           <div className="w-4 h-4 rounded-full border border-white/20" />
                        </div>
                      ))}
                    </div>
                 </div>
               </div>
            </div>

            {/* Feature 2 - Repertório */}
            <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent group">
               <div className="h-full rounded-[1.8rem] bg-[#050505] p-10 relative overflow-hidden">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                   <Library className="w-6 h-6 text-white group-hover:text-[#2B85EB] transition-colors" />
                 </div>
                 <h3 className="text-2xl font-semibold mb-3 text-white">{t('musicscale:bento_feat2_title', 'Repertório e Cifras')}</h3>
                 <p className="text-[#A0A7B5] leading-relaxed">{t('musicscale:bento_feat2_desc', 'Anexe cifras, links do YouTube ou áudios e defina o tom exato para o culto.')}</p>
               </div>
            </div>

            {/* Feature 3 - Biblioteca */}
            <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent group">
               <div className="h-full rounded-[1.8rem] bg-[#050505] p-10 relative overflow-hidden">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                   <Music className="w-6 h-6 text-white group-hover:text-[#2B85EB] transition-colors" />
                 </div>
                 <h3 className="text-2xl font-semibold mb-3 text-white">{t('musicscale:bento_feat3_title', 'Biblioteca Viva')}</h3>
                 <p className="text-[#A0A7B5] leading-relaxed">{t('musicscale:bento_feat3_desc', 'Acesse um acervo de canções padronizadas, alimentado constantemente pelo ecossistema.')}</p>
               </div>
            </div>

            {/* Feature 4 - Notificações */}
            <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent group">
               <div className="h-full rounded-[1.8rem] bg-[#050505] p-10 relative overflow-hidden">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                   <Bell className="w-6 h-6 text-white group-hover:text-[#2B85EB] transition-colors" />
                 </div>
                 <h3 className="text-2xl font-semibold mb-3 text-white">{t('musicscale:bento_feat4_title', 'Notificações')}</h3>
                 <p className="text-[#A0A7B5] leading-relaxed">{t('musicscale:bento_feat4_desc', 'Os membros são avisados e podem confirmar ou recusar a participação com um clique.')}</p>
               </div>
            </div>

            {/* Feature 5 - Performance Mode (Large) */}
            <div 
              onMouseEnter={() => setActiveBentoCard(5)}
              onMouseLeave={() => setActiveBentoCard(null)}
              className="md:col-span-2 p-1 rounded-[2rem] bg-gradient-to-br from-[#2B85EB]/30 to-transparent transition-all group overflow-hidden relative cursor-default"
            >
               <div className="h-full rounded-[1.8rem] bg-gradient-to-br from-[#0B0F19] to-[#050505] p-10 flex flex-col relative overflow-hidden">
                 <div className="absolute inset-0 bg-[#2B85EB]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                 
                 <div className="flex-1 relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-[#2B85EB]/20 border border-[#2B85EB]/40 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(43,133,235,0.2)]">
                     <Mic2 className="w-7 h-7 text-[#2B85EB]" />
                   </div>
                   <h3 className="text-3xl font-semibold mb-4 text-white">{t('musicscale:bento_feat5_title', 'Performance Mode')}</h3>
                   <p className="text-[#A0A7B5] text-lg max-w-md leading-relaxed relative z-10">{t('musicscale:bento_feat5_desc', 'No momento do culto, visualize o repertório, o tom e a equipe com um visual escuro, sem distrações.')}</p>
                 </div>

                 {/* Mini UI element */}
                 <div className={`hidden md:block absolute right-12 bottom-12 w-64 p-6 rounded-2xl bg-black border border-[#2B85EB]/20 shadow-2xl transition-all duration-700 ${activeBentoCard === 5 ? 'scale-100 opacity-100' : 'scale-95 opacity-50'}`}>
                    <div className="text-center mb-4">
                      <div className="text-[10px] text-[#A0A7B5] uppercase tracking-widest mb-1">Tocando agora</div>
                      <div className="text-lg font-bold text-white">Lindo És</div>
                    </div>
                    <div className="w-16 h-16 mx-auto rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/30 flex items-center justify-center mb-4">
                       <span className="text-2xl font-bold text-[#2B85EB]">G</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full w-1/3 bg-[#2B85EB] rounded-full" />
                    </div>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* Brand Logo Section */}
      <section className="py-40 px-6 relative overflow-hidden bg-[#050505]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03] pointer-events-none flex items-center justify-center mix-blend-screen">
          <img src="/LogoIconMusicScale-1.png" alt="" className="w-full h-full object-contain blur-sm" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <MusicScaleLogo className="justify-center mb-12 scale-125" />
          <p className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-tight max-w-3xl mx-auto">
            {t('musicscale:brand_quote', 'Um produto MillionsNest para ministérios de louvor que querem servir com mais excelência, clareza e preparo.')}
          </p>
        </div>
      </section>

      {/* Target Audience Segmented */}
      <section className="py-32 bg-[#0B0F19] border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:target_title', 'Para quem é o MusicScale?')}
            </h2>
            <p className="text-xl text-[#A0A7B5] max-w-2xl mx-auto">
              {t('musicscale:target_subtitle', 'Desenvolvido para cada necessidade da equipe.')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { role: t('musicscale:role_1_title', 'Líderes de Louvor'), promise: t('musicscale:role_1_desc', 'Menos cobrança no WhatsApp, mais visão geral da equipe e escalas organizadas semanas antes.') },
              { role: t('musicscale:role_2_title', 'Pastores'), promise: t('musicscale:role_2_desc', 'Planejamento transparente. Saiba quem estará ministrando no próximo culto sem perguntar a ninguém.') },
              { role: t('musicscale:role_3_title', 'Músicos e Vocais'), promise: t('musicscale:role_3_desc', 'Chegue ao ensaio sabendo exatamente quais músicas tocar, em qual tom e com as cifras prontas.') },
              { role: t('musicscale:role_4_title', 'Igrejas Pequenas'), promise: t('musicscale:role_4_desc', 'Não importa se a equipe tem 3 pessoas. A organização profissional traz paz ao ministério.') },
              { role: t('musicscale:role_5_title', 'Igrejas em Crescimento'), promise: t('musicscale:role_5_desc', 'Escale sua equipe de dezenas para centenas de voluntários sem perder o controle das ministrações.') }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-3xl bg-[#050505] border border-white/5 hover:border-[#2B85EB]/30 transition-colors group">
                <h4 className="text-xl font-semibold text-white mb-4 group-hover:text-[#2B85EB] transition-colors">{item.role}</h4>
                <p className="text-[#A0A7B5] leading-relaxed">{item.promise}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof (Honest & Clean) */}
      <section className="py-40 px-6 bg-[#050505] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white/[0.03] via-[#050505] to-[#050505] pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[#A0A7B5] text-xs font-semibold tracking-widest uppercase mb-10">
            {t('musicscale:proof_tag', 'Arquitetura com Propósito')}
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
            {t('musicscale:proof_title', 'Desenhado para o líder que não tem tempo a perder.')}
          </h2>
          <p className="text-xl md:text-2xl text-[#A0A7B5] font-light mb-16 leading-relaxed max-w-2xl mx-auto">
            {t('musicscale:proof_subtitle', 'Deixamos de lado ferramentas genéricas para construir um fluxo de trabalho focado unicamente na realidade da sua equipe de louvor.')}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto border-t border-white/10 pt-16 mt-16">
             <div className="text-center group">
                <div className="text-3xl font-bold text-white mb-2 group-hover:text-[#2B85EB] transition-colors">Constante</div>
                <div className="text-sm text-[#A0A7B5] font-medium tracking-wide uppercase">Evolução do Produto</div>
             </div>
             <div className="text-center group">
                <div className="text-3xl font-bold text-white mb-2 group-hover:text-[#2B85EB] transition-colors">Foco 100%</div>
                <div className="text-sm text-[#A0A7B5] font-medium tracking-wide uppercase">Em Ministérios</div>
             </div>
             <div className="text-center group">
                <div className="text-3xl font-bold text-white mb-2 group-hover:text-[#2B85EB] transition-colors">Criado por</div>
                <div className="text-sm text-[#A0A7B5] font-medium tracking-wide uppercase">Líderes Reais</div>
             </div>
          </div>
        </div>
      </section>

      {/* Instagram Content Cards */}
      <section className="py-32 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-20 gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-4 mb-6">
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                   <Instagram className="w-6 h-6 text-white" />
                 </div>
                 <h2 className="text-4xl font-bold">{t('musicscale:instagram_title', 'Acompanhe no Instagram')}</h2>
              </div>
              <p className="text-xl text-[#A0A7B5] max-w-xl">{t('musicscale:instagram_subtitle', 'Siga nosso canal para atualizações e conteúdo exclusivo.')}</p>
            </div>
            <a href="https://instagram.com/musicscaleapp" target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-semibold text-white flex items-center gap-2 shrink-0 backdrop-blur-md">
              @musicscaleapp <ChevronRight className="w-5 h-5" />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: t('musicscale:ig_cat_1', 'Bastidores'), color: 'from-[#2B85EB]/20' },
              { label: t('musicscale:ig_cat_2', 'Novidades'), color: 'from-purple-500/20' },
              { label: t('musicscale:ig_cat_3', 'Dicas para líderes'), color: 'from-green-500/20' },
              { label: t('musicscale:ig_cat_4', 'Demonstrações'), color: 'from-orange-500/20' }
            ].map((cat, i) => (
              <div key={i} className={`aspect-[4/5] rounded-3xl bg-gradient-to-b ${cat.color} to-[#050505] border border-white/10 p-8 flex flex-col justify-end relative overflow-hidden group cursor-pointer hover:border-white/30 transition-all`}>
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                 <span className="text-lg font-semibold text-white relative z-10 transform group-hover:translate-x-2 transition-transform duration-300 flex items-center gap-2">
                   {cat.label} <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Específico */}
      <section className="py-32 bg-[#050505] relative border-t border-white/5">
        <div className="absolute top-0 right-1/4 w-[800px] h-[400px] bg-[#2B85EB]/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:faq_title', 'Perguntas frequentes')}
            </h2>
            <p className="text-xl text-[#A0A7B5]">
              {t('musicscale:faq_subtitle', 'Tudo que você precisa saber antes de organizar sua primeira escala.')}
            </p>
          </div>
          
          <div className="space-y-4">
            <FAQItem 
              question={t('musicscale:faq_q1', 'Minha igreja é pequena. Ainda faz sentido usar o MusicScale?')} 
              answer={t('musicscale:faq_a1', 'Sim. A falta de organização e o estresse afetam igrejas de todos os tamanhos. O MusicScale foi desenhado para ser simples e rápido, liberando o líder do retrabalho e ajudando a equipe a chegar mais preparada no domingo, independente se você tem 5 ou 50 músicos.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q2', 'Meus músicos vão precisar instalar algo complicado?')} 
              answer={t('musicscale:faq_a2', 'Não. O MusicScale funciona perfeitamente pelo navegador do celular. Os músicos acessam as escalas, cifras e confirmam presença de forma fluida, sem precisar baixar aplicativos pesados.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q3', 'O MusicScale substitui o WhatsApp?')} 
              answer={t('musicscale:faq_a3', 'O MusicScale substitui a bagunça do WhatsApp. Você ainda pode usar grupos para conversar, mas a informação oficial (quem toca, qual repertório, qual tom, quem confirmou) fica salva e sempre atualizada no MusicScale.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q4', 'Consigo organizar repertório, tons e cifras?')} 
              answer={t('musicscale:faq_a4', 'Exatamente! Ao montar a escala, você adiciona as músicas, define o tom para aquele culto e anexa links (YouTube/Spotify) e cifras. A equipe já abre o app e vê tudo pronto para ensaiar.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q5', 'Dá para confirmar presença na escala?')} 
              answer={t('musicscale:faq_a5', 'Sim. Assim que a escala é enviada, o músico recebe uma notificação e pode confirmar ou recusar a participação com um clique. Você, como líder, sabe quem estará lá sem precisar cobrar.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q6', 'O MusicScale é um sistema financeiro ou administrativo?')} 
              answer={t('musicscale:faq_a6', 'Não. O MusicScale é 100% focado no Ministério de Louvor. Se sua igreja precisar de gestão administrativa ou financeira no futuro, o ecossistema MillionsNest oferecerá outros aplicativos integrados para isso.')} 
            />
            <FAQItem 
              question={t('musicscale:faq_q7', 'Posso testar antes de pagar?')} 
              answer={t('musicscale:faq_a7', 'Com certeza. Todo plano inclui 7 dias de teste totalmente gratuito, com acesso a todos os recursos premium. Se achar que não ajudou sua equipe, você cancela antes de qualquer cobrança sem burocracia.')} 
            />
          </div>
        </div>
      </section>

      {/* Pricing Section with Premium Transition */}
      <div id="pricing-section" className="pt-32 pb-16 bg-[#050505] relative">
        <span id="precos" className="absolute -top-24" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0B0F19] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center mb-[-2rem] relative z-10">
           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-xs font-semibold tracking-widest uppercase mb-8">
             {t('musicscale:pricing_tag', 'Planos e Valores')}
           </div>
           <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
             {t('musicscale:pricing_title', 'Escolha o plano que combina com o momento do seu ministério.')}
           </h2>
        </div>
        <Pricing />
      </div>

      {/* Final CTA Premium */}
      <section className="py-40 px-6 relative overflow-hidden bg-[#050505] border-t border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-[#2B85EB]/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <MusicScaleLogo className="justify-center mb-12" />
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-10 tracking-tight text-white leading-tight">
            {t('musicscale:final_cta_title', 'Sua próxima escala pode ser organizada com clareza, beleza e paz.')}
          </h2>
          <p className="text-xl md:text-2xl text-[#A0A7B5] mb-16 font-light max-w-2xl mx-auto">
            {t('musicscale:final_cta_subtitle', 'Comece hoje e veja sua equipe preparada antes do próximo culto.')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto">
            <button 
              onClick={handleStartTrial}
              className="group relative w-full sm:w-auto px-10 py-5 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_50px_rgba(43,133,235,0.3)] hover:shadow-[0_0_80px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <div className="relative flex items-center justify-center gap-2">
                {t('musicscale:final_cta_button', 'Começar teste grátis')} 
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
            <a 
              href="#pricing-section"
              className="w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-bold rounded-2xl transition-all flex items-center justify-center backdrop-blur-md"
            >
              {t('musicscale:final_cta_secondary', 'Ver preços')}
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
