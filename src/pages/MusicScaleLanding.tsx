import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { Pricing } from "../components/Pricing.js";
import { Play, CheckCircle2, LayoutDashboard, CalendarDays, Music, Bell, Library, Mic2, Instagram, ArrowRight } from "lucide-react";

export function MusicScaleLanding() {
  const { t } = useTranslation(["musicscale", "common"]);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleStartTrial = () => {
    sessionStorage.setItem("purchase_intent", "musicscale_starter_monthly");
    navigate("/login");
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden bg-[#050505] text-[#F5F7FA]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2B85EB]/20 via-[#050505]/0 to-[#050505]/0 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 flex flex-col items-start text-left">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-sm font-semibold mb-8"
              >
                {t('musicscale:hero_badge', 'MusicScale by MillionsNest')}
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
                dangerouslySetInnerHTML={{ __html: t('musicscale:hero_title', 'O fim das escalas perdidas no <span class="text-[#2B85EB]">WhatsApp.</span>') }}
              />
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-[#A0A7B5] mb-10 max-w-2xl leading-relaxed"
              >
                {t('musicscale:hero_subtitle', 'Organize repertório, músicos, escalas, notificações e preparação do culto em uma experiência simples, bonita e centralizada.')}
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
              >
                <button 
                  onClick={handleStartTrial}
                  className="w-full sm:w-auto px-8 py-4 bg-[#F5F7FA] hover:bg-white text-[#050505] text-base font-semibold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {t('musicscale:hero_cta', 'Começar teste grátis')} <ArrowRight className="w-5 h-5" />
                </button>
                <button className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-[#F5F7FA] text-base font-medium rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 group">
                  <Play className="w-5 h-5 group-hover:text-[#2B85EB] transition-colors" /> {t('musicscale:hero_video_cta', 'Ver o app em ação')}
                </button>
              </motion.div>
            </div>
            
            <div className="lg:w-1/2 w-full relative">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0B0F19] aspect-[4/3] flex items-center justify-center"
              >
                {/* Fallback mockup UI */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#121826] to-[#0B0F19] opacity-50" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <Music className="w-16 h-16 text-[#2B85EB]/50" />
                  <p className="text-[#A0A7B5] font-medium">{t('musicscale:mockup_placeholder', 'Dashboard MusicScale')}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('musicscale:pain_title', 'A realidade de quase todo ministério.')}</h2>
            <p className="text-[#A0A7B5] max-w-2xl mx-auto">{t('musicscale:pain_subtitle', 'Mas não precisa ser a sua.')}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: t('musicscale:pain_item1_title', 'Escalas perdidas no WhatsApp'), desc: t('musicscale:pain_item1_desc', 'Mensagens soterradas, ninguém sabe quem toca ou que horas chega.') },
              { title: t('musicscale:pain_item2_title', 'Cifras espalhadas'), desc: t('musicscale:pain_item2_desc', 'PDFs desatualizados no Drive, versões erradas e tons confusos.') },
              { title: t('musicscale:pain_item3_title', 'Líder sobrecarregado'), desc: t('musicscale:pain_item3_desc', 'Cobrando presença individualmente, sexta-feira à noite.') },
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-2xl bg-[#050505] border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#2B85EB]/50 group-hover:bg-[#2B85EB] transition-colors" />
                <h3 className="text-xl font-semibold mb-3 text-[#F5F7FA]">{item.title}</h3>
                <p className="text-[#A0A7B5] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Action / Video Section */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-12">{t('musicscale:action_title', 'Simples de usar. Difícil de viver sem.')}</h2>
          
          <div className="aspect-video bg-[#0B0F19] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative group cursor-pointer flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
            <div className="relative z-20 flex flex-col items-center transform group-hover:scale-105 transition-transform duration-500">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 group-hover:bg-[#2B85EB] transition-colors">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
              <p className="text-lg font-medium text-white tracking-wide">{t('musicscale:action_video_placeholder', 'Vídeo de demonstração em breve')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Gallery */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('musicscale:gallery_title', 'Tudo no seu lugar.')}</h2>
            <p className="text-[#A0A7B5]">{t('musicscale:gallery_subtitle', 'Funcionalidades pensadas para a rotina da igreja.')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: LayoutDashboard, title: t('musicscale:gallery_feat1_title', 'Dashboard'), desc: t('musicscale:gallery_feat1_desc', 'Visão geral das próximas escalas e atividades.') },
              { icon: CalendarDays, title: t('musicscale:gallery_feat2_title', 'Escalas'), desc: t('musicscale:gallery_feat2_desc', 'Montagem inteligente com confirmação de presença.') },
              { icon: Library, title: t('musicscale:gallery_feat3_title', 'Repertório'), desc: t('musicscale:gallery_feat3_desc', 'Letras, cifras, tons e guias em um único lugar.') },
              { icon: Music, title: t('musicscale:gallery_feat4_title', 'Biblioteca Viva'), desc: t('musicscale:gallery_feat4_desc', 'Acervo constantemente atualizado pela MillionsNest.') },
              { icon: Bell, title: t('musicscale:gallery_feat5_title', 'Notificações'), desc: t('musicscale:gallery_feat5_desc', 'Avisos automáticos de novas escalas e alterações.') },
              { icon: Mic2, title: t('musicscale:gallery_feat6_title', 'Performance Mode'), desc: t('musicscale:gallery_feat6_desc', 'Visualização otimizada para o momento do culto.') }
            ].map((feat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <feat.icon className="w-8 h-8 text-[#2B85EB] mb-6" />
                <h3 className="text-lg font-semibold mb-2">{feat.title}</h3>
                <p className="text-[#A0A7B5] text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2">
            <h2 className="text-3xl font-bold mb-6">{t('musicscale:target_title', 'Para quem é o MusicScale?')}</h2>
            <p className="text-[#A0A7B5] mb-8 text-lg">{t('musicscale:target_subtitle', 'Seja você de uma equipe de 3 ou 30 pessoas, a ferramenta se adapta ao tamanho do seu desafio.')}</p>
            
            <ul className="space-y-4">
              {[
                t('musicscale:target_item1', 'Líder de Louvor (Organização e paz mental)'), 
                t('musicscale:target_item2', 'Pastores (Visão de escalas e planejamento)'), 
                t('musicscale:target_item3', 'Músicos e Vocais (Acesso fácil a cifras e áudios)'), 
                t('musicscale:target_item4', 'Igrejas Pequenas (Estruturação profissional)'), 
                t('musicscale:target_item5', 'Igrejas em Crescimento (Escalabilidade da equipe)')
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#2B85EB]" />
                  <span className="text-[#F5F7FA] font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:w-1/2 w-full">
             <div className="aspect-square max-h-[500px] rounded-3xl bg-gradient-to-br from-[#121826] to-[#050505] border border-white/10 p-8 flex items-center justify-center">
                <div className="text-center opacity-30">
                  <Music className="w-24 h-24 mx-auto mb-4" />
                  <p className="font-mono text-sm tracking-widest uppercase">{t('musicscale:target_badge', 'MusicScale by MillionsNest')}</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[#0B0F19] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-16">{t('musicscale:how_title', 'Em 3 passos simples.')}</h2>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-white/10" />
            {[
              { step: "01", title: t('musicscale:how_step1_title', 'Cadastre sua equipe'), desc: t('musicscale:how_step1_desc', 'Convide músicos, cantores e operadores com acesso seguro.') },
              { step: "02", title: t('musicscale:how_step2_title', 'Monte a escala'), desc: t('musicscale:how_step2_desc', 'Selecione o repertório, defina os tons e monte o time.') },
              { step: "03", title: t('musicscale:how_step3_title', 'Compartilhe e prepare'), desc: t('musicscale:how_step3_desc', 'Todos são notificados, confirmam presença e ensaiam.') }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-[#050505] border-4 border-[#0B0F19] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center text-2xl font-bold text-[#2B85EB] mb-8">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-[#A0A7B5] leading-relaxed max-w-[260px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Placeholder */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">{t('musicscale:proof_title', 'Construindo histórias.')}</h2>
          <p className="text-xl text-[#A0A7B5] font-light italic">
            {t('musicscale:proof_subtitle', '"Em breve, histórias reais de ministérios transformados usando o MusicScale."')}
          </p>
        </div>
      </section>

      {/* Instagram */}
      <section className="py-24 bg-gradient-to-b from-[#0B0F19] to-[#050505] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 mb-8 shadow-xl">
            <Instagram className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">{t('musicscale:instagram_title', 'Acompanhe no Instagram')}</h2>
          <p className="text-[#A0A7B5] mb-8">{t('musicscale:instagram_subtitle', 'Dicas, novidades e bastidores do desenvolvimento.')}</p>
          
          <a href="https://instagram.com/musicscaleapp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors font-medium">
            @musicscaleapp <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Pricing - Using Existing Component */}
      <div id="pricing-section">
        <Pricing />
      </div>

      {/* Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#2B85EB]/5" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-bold mb-8 tracking-tight">
            {t('musicscale:final_cta_title', 'Sua próxima escala pode ser organizada com clareza, beleza e paz.')}
          </h2>
          <button 
            onClick={handleStartTrial}
            className="px-10 py-5 bg-[#F5F7FA] hover:bg-white text-[#050505] text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
          >
            {t('musicscale:final_cta_button', 'Começar teste grátis agora')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
