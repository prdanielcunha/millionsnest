import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { Pricing } from "../components/Pricing.js";
import { Play, CheckCircle2, CalendarDays, Music, Bell, Library, Mic2, Instagram, ArrowRight, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.js";

export function MusicScaleLanding() {
  const { t } = useTranslation(["musicscale", "common"]);
  const navigate = useNavigate();
  const { user } = useAuth();

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
    <div className="min-h-screen font-sans overflow-x-hidden bg-[#050505] text-[#F5F7FA]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#2B85EB] opacity-[0.15] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center">
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#A0A7B5] text-xs font-semibold tracking-widest uppercase mb-8"
            >
              {t('musicscale:hero_badge', 'MusicScale by MillionsNest')}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <img src="/LogoMS_Horiz.png" alt="MusicScale" className="h-10 md:h-12 w-auto object-contain mx-auto" />
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-8 max-w-4xl"
            >
              <Trans i18nKey="musicscale:hero_title" components={{ 1: <span className="text-[#2B85EB]" /> }}>
                O fim das escalas perdidas no <span className="text-[#2B85EB]">WhatsApp</span>.
              </Trans>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-2xl text-[#A0A7B5] mb-12 max-w-2xl leading-relaxed"
            >
              {t('musicscale:hero_subtitle', 'Escalas, repertório, confirmações, notificações e preparação do culto em uma experiência premium para ministérios de louvor.')}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
            >
              <button 
                onClick={handleStartTrial}
                className="w-full sm:w-auto px-8 py-4 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-lg font-bold rounded-2xl shadow-[0_0_40px_rgba(43,133,235,0.4)] transition-all flex items-center justify-center gap-2"
              >
                {t('musicscale:hero_cta_primary', 'Começar teste grátis')}
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button 
                onClick={scrollToDemo}
                className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                {t('musicscale:hero_cta_secondary', 'Ver app em ação')}
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-[#A0A7B5] font-medium"
            >
              {[
                t('musicscale:hero_benefit_1', 'Escalas inteligentes'),
                t('musicscale:hero_benefit_2', 'Confirmação de presença'),
                t('musicscale:hero_benefit_3', 'Biblioteca Viva'),
                t('musicscale:hero_benefit_4', 'Performance Mode')
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2B85EB]" />
                  <span>{benefit}</span>
                </div>
              ))}
            </motion.div>

          </div>
        </div>

        {/* Hero Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-6xl mx-auto mt-20 relative z-10"
        >
          <div className="relative rounded-3xl md:rounded-[2.5rem] bg-gradient-to-b from-white/5 to-transparent p-1 md:p-2 border border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/10 to-transparent opacity-50 mix-blend-overlay" />
            <div className="relative rounded-2xl md:rounded-[2rem] overflow-hidden bg-[#0B0F19] border border-white/5 shadow-inner">
               <picture>
                 <source srcSet="/telas.png" type="image/png" />
                 {/* Fallback to a CSS mockup if telas.png fails or isn't perfect, but img should handle it */}
                 <img 
                    src="/telas.png" 
                    alt="MusicScale Interface" 
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      // Fallback visual if image doesn't exist
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                 />
                 <div className="hidden aspect-video w-full bg-[#050505] flex items-center justify-center p-8">
                    <div className="w-full h-full border border-white/10 rounded-xl bg-[#0B0F19] flex flex-col overflow-hidden">
                       <div className="h-12 border-b border-white/10 bg-white/5 flex items-center px-4 gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500/50" />
                       </div>
                       <div className="flex-1 flex items-center justify-center opacity-30">
                          <Music className="w-24 h-24 text-[#2B85EB]" />
                       </div>
                    </div>
                 </div>
               </picture>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Do Caos ao Controle */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:chaos_title', 'Do caos ao controle.')}
            </h2>
            <p className="text-xl text-[#A0A7B5]">
              {t('musicscale:chaos_subtitle', 'Substitua a desorganização por um fluxo claro e profissional.')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Antes */}
            <div className="p-8 rounded-3xl bg-[#050505] border border-white/5 flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-semibold w-fit mb-8">
                <XCircle className="w-4 h-4" /> {t('musicscale:chaos_before_tag', 'Como era antes')}
              </div>
              <ul className="space-y-6 flex-1">
                {[
                  t('musicscale:chaos_before_1', 'Escalas perdidas em grupos de WhatsApp.'),
                  t('musicscale:chaos_before_2', 'Cifras e tons espalhados ou desatualizados.'),
                  t('musicscale:chaos_before_3', 'Músicos esquecendo a escala ou não confirmando.'),
                  t('musicscale:chaos_before_4', 'Líder de louvor sobrecarregado no fim de semana.')
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 items-start text-[#A0A7B5]">
                    <XCircle className="w-6 h-6 text-red-500/50 shrink-0" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Depois */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-[#2B85EB]/10 to-[#050505] border border-[#2B85EB]/20 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/10 blur-3xl rounded-full" />
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2B85EB]/20 text-[#2B85EB] text-sm font-semibold w-fit mb-8 relative z-10">
                <CheckCircle2 className="w-4 h-4" /> {t('musicscale:chaos_after_tag', 'Com o MusicScale')}
              </div>
              <ul className="space-y-6 flex-1 relative z-10">
                {[
                  t('musicscale:chaos_after_1', 'Escala centralizada, visível para toda a equipe.'),
                  t('musicscale:chaos_after_2', 'Repertório organizado com guias e tons exatos.'),
                  t('musicscale:chaos_after_3', 'Presença confirmada com um clique no app.'),
                  t('musicscale:chaos_after_4', 'Culto preparado com paz, antecedência e excelência.')
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 items-start text-white">
                    <CheckCircle2 className="w-6 h-6 text-[#2B85EB] shrink-0" />
                    <span className="text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* App em Ação Demo */}
      <section id="musicscale-demo" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:demo_title', 'Veja como a escala deixa de ser caos e vira fluxo.')}
            </h2>
          </div>
          
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-8">
               {/* Video Placeholder Premium */}
               <div className="aspect-video rounded-3xl bg-[#0B0F19] border border-white/10 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#2B85EB]/20 to-transparent opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:bg-[#2B85EB] transition-all duration-300">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                    <p className="text-sm font-semibold tracking-widest uppercase text-[#A0A7B5] bg-[#050505]/80 px-4 py-2 rounded-full backdrop-blur-sm">
                      {t('musicscale:demo_placeholder', 'Vídeo de demonstração em breve')}
                    </p>
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-4 flex flex-col gap-8">
               {[
                 { step: "01", title: t('musicscale:demo_step1_title', 'Monte a escala'), desc: t('musicscale:demo_step1_desc', 'Arraste membros e distribua funções rapidamente.') },
                 { step: "02", title: t('musicscale:demo_step2_title', 'Defina repertório e tons'), desc: t('musicscale:demo_step2_desc', 'Adicione músicas da biblioteca com links e cifras.') },
                 { step: "03", title: t('musicscale:demo_step3_title', 'Equipe recebe e confirma'), desc: t('musicscale:demo_step3_desc', 'Notificações automáticas para confirmação de presença.') },
                 { step: "04", title: t('musicscale:demo_step4_title', 'Tudo pronto para o culto'), desc: t('musicscale:demo_step4_desc', 'Performance mode ligado, excelência garantida.') },
               ].map((item, i) => (
                 <div key={i} className="flex gap-4">
                   <div className="flex flex-col items-center">
                     <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-[#A0A7B5]">
                       {item.step}
                     </div>
                     {i !== 3 && <div className="w-px h-full bg-white/5 my-2" />}
                   </div>
                   <div className="pt-1 pb-4">
                     <h4 className="text-lg font-semibold text-white mb-1">{item.title}</h4>
                     <p className="text-[#A0A7B5] text-sm leading-relaxed">{item.desc}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Bento Grid */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:bento_title', 'Tudo no seu lugar.')}
            </h2>
            <p className="text-xl text-[#A0A7B5]">
              {t('musicscale:bento_subtitle', 'Funcionalidades desenhadas com precisão para a rotina da igreja.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(280px,auto)]">
            
            {/* Feature 1 */}
            <div className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-white/5 to-[#050505] border border-white/10 hover:border-[#2B85EB]/50 transition-all group overflow-hidden relative">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
               <CalendarDays className="w-10 h-10 text-[#2B85EB] mb-6 relative z-10" />
               <h3 className="text-2xl font-semibold mb-3 relative z-10">{t('musicscale:bento_feat1_title', 'Escalas Inteligentes')}</h3>
               <p className="text-[#A0A7B5] text-lg max-w-md relative z-10">{t('musicscale:bento_feat1_desc', 'Montagem visual e intuitiva da escala, evitando conflitos de agenda e garantindo a equipe completa.')}</p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-[#2B85EB]/50 transition-all group relative overflow-hidden">
               <Library className="w-10 h-10 text-white group-hover:text-[#2B85EB] transition-colors mb-6" />
               <h3 className="text-xl font-semibold mb-3">{t('musicscale:bento_feat2_title', 'Repertório e Cifras')}</h3>
               <p className="text-[#A0A7B5] text-sm leading-relaxed">{t('musicscale:bento_feat2_desc', 'Anexe cifras, links do YouTube ou áudios e defina o tom exato para o culto.')}</p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-[#2B85EB]/50 transition-all group relative overflow-hidden">
               <Music className="w-10 h-10 text-white group-hover:text-[#2B85EB] transition-colors mb-6" />
               <h3 className="text-xl font-semibold mb-3">{t('musicscale:bento_feat3_title', 'Biblioteca Viva')}</h3>
               <p className="text-[#A0A7B5] text-sm leading-relaxed">{t('musicscale:bento_feat3_desc', 'Acesse um acervo de canções padronizadas, alimentado constantemente pelo ecossistema.')}</p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-[#2B85EB]/50 transition-all group relative overflow-hidden">
               <Bell className="w-10 h-10 text-white group-hover:text-[#2B85EB] transition-colors mb-6" />
               <h3 className="text-xl font-semibold mb-3">{t('musicscale:bento_feat4_title', 'Notificações')}</h3>
               <p className="text-[#A0A7B5] text-sm leading-relaxed">{t('musicscale:bento_feat4_desc', 'Os membros são avisados e podem confirmar ou recusar a participação com um clique.')}</p>
            </div>

            {/* Feature 5 */}
            <div className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-white/5 to-[#050505] border border-white/10 hover:border-[#2B85EB]/50 transition-all group overflow-hidden relative">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
               <Mic2 className="w-10 h-10 text-[#2B85EB] mb-6 relative z-10" />
               <h3 className="text-2xl font-semibold mb-3 relative z-10">{t('musicscale:bento_feat5_title', 'Performance Mode')}</h3>
               <p className="text-[#A0A7B5] text-lg max-w-md relative z-10">{t('musicscale:bento_feat5_desc', 'No momento do culto, visualize o repertório, o tom e a equipe com um visual escuro, sem distrações.')}</p>
            </div>

          </div>
        </div>
      </section>

      {/* Brand Logo Section */}
      <section className="py-32 px-6 relative overflow-hidden bg-[#050505]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 pointer-events-none flex items-center justify-center">
          <img src="/LogoIconMusicScale-1.png" alt="" className="w-full h-full object-contain blur-sm" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <img src="/LogoMS_Horiz.png" alt="MusicScale" className="h-12 w-auto object-contain mx-auto mb-8" />
          <p className="text-2xl md:text-4xl font-semibold text-white tracking-tight leading-snug">
            {t('musicscale:brand_quote', 'Um produto MillionsNest para ministérios de louvor que querem servir com mais excelência, clareza e preparo.')}
          </p>
        </div>
      </section>

      {/* Target Audience Segmented */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              {t('musicscale:target_title', 'Para quem é o MusicScale?')}
            </h2>
            <p className="text-xl text-[#A0A7B5]">
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
              <div key={i} className="p-8 rounded-3xl bg-white/[0.02] border border-white/5">
                <h4 className="text-lg font-semibold text-white mb-3">{item.role}</h4>
                <p className="text-[#A0A7B5] text-sm leading-relaxed">{item.promise}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-32 px-6 bg-[#050505] text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#A0A7B5] text-xs font-semibold tracking-widest uppercase mb-8">
            {t('musicscale:proof_tag', 'Comunidade')}
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-8">
            {t('musicscale:proof_title', 'Histórias reais em construção.')}
          </h2>
          <p className="text-xl text-[#A0A7B5] font-light italic mb-12">
            {t('musicscale:proof_subtitle', 'Em breve, relatos de ministérios de louvor que transformaram sua organização com o MusicScale.')}
          </p>
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto opacity-20 grayscale pointer-events-none blur-sm">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Content Cards */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                   <Instagram className="w-5 h-5 text-white" />
                 </div>
                 <h2 className="text-3xl font-bold">{t('musicscale:instagram_title', 'Acompanhe no Instagram')}</h2>
              </div>
              <p className="text-[#A0A7B5]">{t('musicscale:instagram_subtitle', 'Siga nosso canal para atualizações e conteúdo exclusivo.')}</p>
            </div>
            <a href="https://instagram.com/musicscaleapp" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors font-medium text-white flex items-center gap-2 shrink-0">
              @musicscaleapp <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('musicscale:ig_cat_1', 'Bastidores'), color: 'from-blue-500/20' },
              { label: t('musicscale:ig_cat_2', 'Novidades'), color: 'from-purple-500/20' },
              { label: t('musicscale:ig_cat_3', 'Dicas para líderes'), color: 'from-green-500/20' },
              { label: t('musicscale:ig_cat_4', 'Demonstrações'), color: 'from-orange-500/20' }
            ].map((cat, i) => (
              <div key={i} className={`aspect-[4/5] rounded-2xl bg-gradient-to-b ${cat.color} to-[#050505] border border-white/10 p-6 flex flex-col justify-end relative overflow-hidden group`}>
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 <span className="font-semibold text-white relative z-10">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <div id="pricing-section" className="pt-24 bg-[#050505]">
        <div className="max-w-4xl mx-auto px-6 text-center mb-[-4rem] relative z-10">
           <p className="text-[#2B85EB] font-semibold text-sm tracking-widest uppercase mb-4">{t('musicscale:pricing_tag', 'Planos e Valores')}</p>
           <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
             {t('musicscale:pricing_title', 'Escolha o plano que combina com o momento do seu ministério.')}
           </h2>
        </div>
        <Pricing />
      </div>

      {/* Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden bg-[#0B0F19] border-t border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[400px] bg-[#2B85EB]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-bold mb-8 tracking-tight text-white">
            {t('musicscale:final_cta_title', 'Sua próxima escala pode ser organizada com clareza, beleza e paz.')}
          </h2>
          <p className="text-xl text-[#A0A7B5] mb-12">
            {t('musicscale:final_cta_subtitle', 'Comece hoje e veja sua equipe preparada antes do próximo culto.')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <button 
              onClick={handleStartTrial}
              className="w-full sm:w-auto px-10 py-5 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-lg font-bold rounded-2xl shadow-[0_0_40px_rgba(43,133,235,0.4)] transition-all flex items-center justify-center gap-2"
            >
              {t('musicscale:final_cta_button', 'Começar teste grátis')} <ArrowRight className="w-5 h-5" />
            </button>
            <a 
              href="#pricing-section"
              className="w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-bold rounded-2xl transition-all flex items-center justify-center"
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
