import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Star, Zap, Headphones, Settings, Video, ListMusic } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useTranslation, Trans } from 'react-i18next';

export function Pricing() {
  const { t } = useTranslation(['landing']);
  const [isAnnual, setIsAnnual] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Dynamic prices state
  const [plansData, setPlansData] = useState<any[]>([]);
  const [addonsData, setAddonsData] = useState<any[]>([]);
  
  const [prices, setPrices] = useState({
    starter_monthly: 19.90,
    starter_annual: 191.04,
    advanced_monthly: 29.90,
    advanced_annual: 287.04,
    pro_monthly: 34.90,
    pro_annual: 335.04,
    setup_premium: 54.90,
    training_express: 29.90,
    worship_100: 97.00,
    music_pack_10: 29.90
  });

  useEffect(() => {
    fetch('/api/v1/billing/products')
      .then(res => res.json())
      .then(data => {
         if (data.plans) setPlansData(data.plans);
         if (data.addons) setAddonsData(data.addons);
         
         setPrices(prev => {
           const newPrices = { ...prev };
           
           // Extract plans (strictly by lookupKey)
           const starterMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_monthly');
           const starterAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_yearly');
           const advancedMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_advanced_monthly');
           const advancedAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_advanced_yearly');
           const proMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_monthly');
           const proAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_yearly');
           
           if (starterMonthly) newPrices.starter_monthly = starterMonthly.price;
           if (starterAnnual) newPrices.starter_annual = starterAnnual.price;
           if (advancedMonthly) newPrices.advanced_monthly = advancedMonthly.price;
           if (advancedAnnual) newPrices.advanced_annual = advancedAnnual.price;
           if (proMonthly) newPrices.pro_monthly = proMonthly.price;
           if (proAnnual) newPrices.pro_annual = proAnnual.price;
           
           // Extract addons (strictly by lookupKey)
           data.addons?.forEach((addon: any) => {
             if (addon.lookupKey === 'musicscale_setup_premium') newPrices.setup_premium = addon.price;
             if (addon.lookupKey === 'musicscale_training_express') newPrices.training_express = addon.price;
             if (addon.lookupKey === 'musicscale_worship_100') newPrices.worship_100 = addon.price;
             if (addon.lookupKey === 'musicscale_music_pack_10') newPrices.music_pack_10 = addon.price;
           });
           
           return newPrices;
         });
      })
      .catch(err => console.error(err));
  }, []);

  const handlePurchase = (lookupKey: string) => {
    // Analytics/UX: Guardar a intenção imediata de compra
    sessionStorage.setItem('purchase_intent', lookupKey);
    
    if (user) {
      // Se logado, vai direto pro checkout com o plano selecionado
      navigate(`/checkout?plan=${lookupKey}`);
    } else {
      // Se deslogado, vai pro login. O Login.tsx cuidará do redirect inteligente.
      navigate('/login');
    }
  };

  return (
    <section id="precos" className="py-24 md:py-32 bg-[#050505] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-[#2B85EB]/5 rounded-[100%] blur-[100px] md:blur-[120px] pointer-events-none transform-gpu" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A0A7B5] uppercase tracking-widest mb-6"
          >
            {t('pricing_tag')}
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-semibold tracking-tight text-[#F5F7FA] mb-6"
          >
            {t('pricing_title')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#A0A7B5] text-lg"
          >
            <Trans i18nKey="landing:pricing_desc" components={{ 1: <br />, 2: <span className="text-[#2B85EB] font-medium" /> }} />
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-center mt-10"
          >
            <div className="bg-[#0B0F19] p-1.5 rounded-xl border border-white/10 flex relative shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`relative z-10 px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors ${!isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
              >
                {t('pricing_monthly_tab', 'Mensal')}
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`relative z-10 px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
              >
                {t('pricing_yearly_tab', 'Anual')}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${isAnnual ? 'bg-[#2B85EB]/20 text-[#050505]' : 'bg-[#2B85EB]/10 text-[#2B85EB] border border-[#2B85EB]/20'}`}>
                  -20%
                </span>
              </button>
              <div 
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#F5F7FA] rounded-lg transition-transform duration-300 ease-in-out"
                style={{ transform: isAnnual ? 'translateX(calc(100% + 6px))' : 'translateX(6px)' }}
              />
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto relative mb-32">
          {/* STARTER */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-[#0B0F19] rounded-[2rem] p-6 md:p-8 border border-white/5 relative z-10 flex flex-col h-full hover:border-white/10 transition-colors"
          >
            <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Starter</h3>
            <p className="text-[#A0A7B5] text-sm mb-6 min-h-[60px]">
              Para ministérios que querem começar a organizar o louvor com simplicidade.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                 R$ {prices.starter_monthly > 0 ? (isAnnual ? (prices.starter_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.starter_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "19,90"}
              </span>
              <span className="text-[#A0A7B5] font-normal text-sm">{t('pricing_period')}</span>
            </div>
            
            <div className="mt-2 mb-6">
               <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#2B85EB]/10 text-[#2B85EB] rounded-md border border-[#2B85EB]/20">
                 {t('pricing_free_trial', '7 dias grátis')}
               </span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                 {prices.starter_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.starter_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                 {prices.starter_monthly > 0 && prices.starter_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.starter_annual / (prices.starter_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
              </div>
            ) : (
              <div className="h-5 mb-6" />
            )}
            
            <button 
              onClick={() => handlePurchase(isAnnual ? 'musicscale_starter_yearly' : 'musicscale_starter_monthly')}
              className="w-full py-3.5 px-6 rounded-xl bg-transparent border border-[#2B85EB]/30 text-[#A0A7B5] hover:text-[#F5F7FA] text-center font-semibold text-sm hover:bg-[#2B85EB]/10 transition-all active:scale-95 mt-2 mb-8 block select-none"
            >
              Começar no Starter
            </button>
            <p className="text-[10px] text-center text-[#A0A7B5]/60 mb-6 -mt-4 uppercase tracking-widest">Ideal para começar</p>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5">
              {[
                'Até 10 usuários por organização',
                'Escalas ilimitadas',
                'Músicas ilimitadas',
                'Cadastro de letras, cifras, tom e BPM',
                'Compartilhamento de escalas',
                'Organização por cultos e eventos',
                'Acesso pelo celular, tablet e computador',
                'Sincronização em nuvem',
                'Suporte padrão'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#A0A7B5]">
                  <Check className="w-4 h-4 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                  <span className="font-normal text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ADVANCED */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="bg-[#0B0F19] rounded-[2rem] p-6 md:p-8 border border-white/5 relative z-10 flex flex-col h-full hover:border-white/10 transition-colors"
          >
            <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Advanced</h3>
            <p className="text-[#A0A7B5] text-sm mb-6 min-h-[60px]">
              Para ministérios em crescimento que precisam de mais controle e repertório.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                 R$ {prices.advanced_monthly > 0 ? (isAnnual ? (prices.advanced_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.advanced_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "29,90"}
              </span>
              <span className="text-[#A0A7B5] font-normal text-sm">{t('pricing_period')}</span>
            </div>
            
            <div className="mt-2 mb-6">
               <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#2B85EB]/10 text-[#2B85EB] rounded-md border border-[#2B85EB]/20">
                 {t('pricing_free_trial', '7 dias grátis')}
               </span>
            </div>
            
            {isAnnual && prices.advanced_monthly > 0 ? (
              <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                 {prices.advanced_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.advanced_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                 {prices.advanced_monthly > 0 && prices.advanced_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.advanced_annual / (prices.advanced_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
              </div>
            ) : (
              <div className="h-5 mb-6" />
            )}
            
            <button 
              onClick={() => handlePurchase(isAnnual ? 'musicscale_advanced_yearly' : 'musicscale_advanced_monthly')}
              className="w-full py-3.5 px-6 rounded-xl bg-transparent border border-[#2B85EB]/30 text-[#A0A7B5] hover:text-[#F5F7FA] text-center font-semibold text-sm hover:bg-[#2B85EB]/10 transition-all active:scale-95 mt-2 mb-8 block select-none"
            >
              Escolher Advanced
            </button>
            <p className="text-[10px] text-center text-[#A0A7B5]/60 mb-6 -mt-4 uppercase tracking-widest">Para equipes em crescimento</p>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5">
              {[
                'Tudo do Starter',
                'Até 20 usuários por organização',
                'Biblioteca Viva limitada',
                '20 importações da Biblioteca Viva /mês',
                'Histórico completo de repertório',
                'Recursos intermediários de organização',
                'Personalização avançada de repertório',
                'Suporte prioritário básico'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#A0A7B5]">
                  <Check className="w-4 h-4 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                  <span className="font-normal text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* PRO */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-[#050505] rounded-[2rem] p-6 md:p-8 border-2 border-[#2B85EB]/50 relative z-10 flex flex-col h-full premium-shadow transform md:-translate-y-4 shadow-[0_0_40px_rgba(43,133,235,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/10 to-transparent pointer-events-none rounded-[2rem]" />
            
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-max">
              <div className="bg-[#2B85EB] text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex items-center gap-1.5 border border-white/10">
                <Star className="w-3 h-3" /> ⭐ Mais Escolhido
              </div>
            </div>

            <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest relative z-10 mt-6 mt-4">Pro</h3>
            <p className="text-[#A0A7B5] text-sm mb-4 min-h-[60px] relative z-10">
              Para ministérios que querem a experiência completa do MusicScale.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1 relative z-10">
              <span className="text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                 R$ {prices.pro_monthly > 0 ? (isAnnual ? (prices.pro_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.pro_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "34,90"}
              </span>
              <span className="text-[#A0A7B5] font-normal text-sm">{t('pricing_period')}</span>
            </div>

            <div className="mt-2 mb-6 relative z-10">
               <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#2B85EB] text-white rounded-md shadow-[0_0_15px_rgba(43,133,235,0.4)]">
                 {t('pricing_free_trial', '7 dias grátis')}
               </span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-2 mb-6 text-xs font-medium relative z-10">
                 {prices.pro_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.pro_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                 {prices.pro_monthly > 0 && prices.pro_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.pro_annual / (prices.pro_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-6 text-xs font-medium relative z-10">
                 <span className="text-[#A0A7B5]/50 line-through">R$ 39,90</span>
                 <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest">Lançamento</span>
              </div>
            )}
            
            <button 
              onClick={() => handlePurchase(isAnnual ? 'musicscale_pro_yearly' : 'musicscale_pro_monthly')}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#2B85EB]/90 to-[#2B85EB] text-[#F5F7FA] border border-[#2B85EB] text-center font-bold text-sm hover:from-[#2B85EB] hover:to-[#4ca4ff] transition-all shadow-[0_0_20px_rgba(43,133,235,0.3)] hover:shadow-[0_0_30px_rgba(43,133,235,0.5)] active:scale-95 mt-2 mb-8 block relative z-10 select-none"
            >
              Começar com o Pro
            </button>
            <p className="text-[10px] text-center text-[#2B85EB] mb-6 -mt-4 uppercase tracking-widest relative z-10 font-bold">Experiência completa</p>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5 relative z-10">
              {[
                'Tudo do Advanced',
                'Usuários ilimitados por organização',
                'Biblioteca Viva completa',
                'Importações ilimitadas da Biblioteca',
                'Importação inteligente de músicas (IA)',
                'Estruturação automática (letra, tom, BPM)',
                'Sugestões inteligentes para repertório e escalas',
                'Clonagem de escalas em um toque',
                'Recursos futuros premium inclusos',
                'Prioridade em novos recursos',
                'Suporte prioritário',
                'Experiência premium completa'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#F5F7FA]">
                  <Zap className="w-4 h-4 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                  <span className="font-normal text-sm opacity-90">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* COMPARAÇÃO DETALHADA */}
        <div className="max-w-5xl mx-auto mt-20 pt-20 border-t border-white/5 relative z-10 hidden md:block">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#F5F7FA] mb-4">
              Compare os Planos
            </h3>
            <p className="text-[#A0A7B5] text-base">
              Veja em detalhes as diferenças estruturais de cada plano.
            </p>
          </div>
          
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0B0F19]/50 backdrop-blur-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 relative">
                  <th className="py-5 px-6 text-[#A0A7B5] font-semibold w-2/5 text-xs uppercase tracking-widest">Recursos Principais</th>
                  <th className="py-5 px-6 text-[#A0A7B5] font-semibold text-center text-xs uppercase tracking-widest border-l border-white/5">Starter</th>
                  <th className="py-5 px-6 text-[#A0A7B5] font-semibold text-center text-xs uppercase tracking-widest border-l border-white/5">Advanced</th>
                  <th className="py-5 px-6 text-[#2B85EB] font-semibold text-center text-xs uppercase tracking-widest bg-[#2B85EB]/5 border-l border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/10 to-transparent pointer-events-none" />
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {[
                  { name: 'Pessoas por organização', s: 'Até 10', a: 'Até 20', p: 'Ilimitado' },
                  { name: 'Músicas e Escalas', s: 'Ilimitadas', a: 'Ilimitadas', p: 'Ilimitadas' },
                  { name: 'Letras, Cifras, Tom e BPM', s: 'Sim', a: 'Sim', p: 'Sim' },
                  { name: 'Biblioteca Viva', s: 'Não', a: 'Limitada', p: 'Completa' },
                  { name: 'Importações da Biblioteca', s: 'Nenhuma', a: '20/mês', p: 'Ilimitadas' },
                  { name: 'Histórico de repertório', s: 'Básico', a: 'Completo', p: 'Completo' },
                  { name: 'Importação inteligente com IA', s: 'Não', a: 'Não', p: 'Sim' },
                  { name: 'Sugestões Inteligentes (IA)', s: 'Não', a: 'Não', p: 'Sim' },
                  { name: 'Clonagem de escalas em um toque', s: 'Não', a: 'Não', p: 'Sim' },
                  { name: 'Acesso prioritário a novos recursos', s: 'Não', a: 'Não', p: 'Sim' },
                  { name: 'Suporte', s: 'Padrão', a: 'Básico Prioritário', p: 'Prioridade Alta' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 text-[#F5F7FA] font-medium">{row.name}</td>
                    <td className="py-4 px-6 text-[#A0A7B5] text-center text-xs border-l border-white/5">{row.s}</td>
                    <td className="py-4 px-6 text-[#A0A7B5] text-center text-xs border-l border-white/5">{row.a}</td>
                    <td className="py-4 px-6 text-[#F5F7FA] text-center font-medium bg-[#2B85EB]/[0.02] text-xs border-l border-white/5 relative">
                      {row.p === 'Sim' ? <Check className="w-4 h-4 mx-auto text-[#2B85EB]" /> : row.p === 'Não' ? <span className="text-white/20">-</span> : row.p}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PREMIUM SERVICES */}
        <div className="max-w-5xl mx-auto mt-20 pt-20 border-t border-white/5 relative">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-semibold tracking-tight text-[#F5F7FA] mb-4"
            >
              {t('pricing_premium_services_title', 'Serviços Premium')}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[#A0A7B5] text-base"
            >
              {t('pricing_premium_services_desc', 'Complementos operacionais para acelerar a estruturação do seu ministério.')}
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* SERVIÇO 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-[#0B0F19] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="w-10 h-10 bg-[#050505] rounded-xl border border-white/5 flex items-center justify-center mb-6">
                <Settings className="w-5 h-5 text-[#A0A7B5]" />
              </div>
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">{t('addon_setup_title', 'Setup Premium')}</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.setup_premium > 0 ? prices.setup_premium.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">{t('pricing_one_time', '/único')}</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                {t('addon_setup_desc', 'Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.')}
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f1', 'Configuração inicial')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f2', 'Onboarding assistido')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f3', 'Organização da equipe')}</li>
              </ul>
              <button onClick={() => handlePurchase('musicscale_setup_premium')} className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors select-none">
                {t('addon_setup_cta', 'Solicitar Setup')}
              </button>
            </motion.div>

            {/* SERVIÇO 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-[#0B0F19] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="w-10 h-10 bg-[#050505] rounded-xl border border-white/5 flex items-center justify-center mb-6">
                <Video className="w-5 h-5 text-[#A0A7B5]" />
              </div>
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">{t('addon_training_title', 'Treinamento Express')}</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.training_express > 0 ? prices.training_express.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">{t('pricing_one_time', '/único')}</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                {t('addon_training_desc', 'Treinamento online prático para aprender rapidamente o fluxo do MusicScale.')}
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f1', 'Treinamento em grupo')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f2', 'Boas práticas')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f3', 'Gravação disponível')}</li>
              </ul>
              <button onClick={() => handlePurchase('musicscale_training_express')} className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors select-none">
                {t('addon_training_cta', 'Quero Participar')}
              </button>
            </motion.div>

            {/* SERVIÇO 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-[#0B0F19] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="w-10 h-10 bg-[#050505] rounded-xl border border-white/5 flex items-center justify-center mb-6">
                <ListMusic className="w-5 h-5 text-[#A0A7B5]" />
              </div>
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">{t('addon_worship_title', 'Acervo Inicial Worship')}</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.worship_100 > 0 ? prices.worship_100.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">{t('pricing_one_time', '/único')}</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                {t('addon_worship_desc', 'Comece mais rápido com um acervo pronto de 100 músicas já organizadas no MusicScale, incluindo cifra e letra integradas.')}
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f1', '100 músicas já cadastradas')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f2', 'Cifra integrada')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f3', 'Letras organizadas')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f4', 'Estrutura pronta no MusicScale')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f5', 'Implantação imediata')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f6', 'Economia de tempo para sua equipe')}</li>
              </ul>
              <button onClick={() => handlePurchase('musicscale_worship_100')} className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors select-none">
                {t('addon_worship_cta', 'Comprar Acervo')}
              </button>
            </motion.div>

            {/* SERVIÇO 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-[#0B0F19] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="w-10 h-10 bg-[#050505] rounded-xl border border-white/5 flex items-center justify-center mb-6">
                <Headphones className="w-5 h-5 text-[#A0A7B5]" />
              </div>
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">{t('addon_pack_title', 'Music Pack +10')}</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.music_pack_10 > 0 ? prices.music_pack_10.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">{t('pricing_one_time', '/único')}</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                {t('addon_pack_desc', 'Pacote avulso para adicionar até 10 novas músicas ao acervo da sua organização.')}
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f1', 'Até 10 novas músicas')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f2', 'Organização no acervo')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f3', 'Com letra e cifra')}</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f4', 'Atualização rápida')}</li>
              </ul>
              <button onClick={() => handlePurchase('musicscale_music_pack_10')} className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors select-none">
                {t('addon_pack_cta', 'Comprar Pacote')}
              </button>
            </motion.div>

          </div>
        </div>

        {/* CONCLUSÃO */}
        <div className="max-w-3xl mx-auto mt-32 text-center relative z-10 pb-16">
           <h3 className="text-xl md:text-2xl font-light tracking-tight text-[#F5F7FA] mb-4">
             MusicScale ajuda sua equipe a chegar mais preparada, mais alinhada, e mais livre para focar no que realmente importa: <span className="font-semibold text-white">o ministério.</span>
           </h3>
           <p className="text-[#A0A7B5] text-sm">Organização de ministério de louvor elevada à excelência.</p>
        </div>

      </div>
    </section>
  );
}

