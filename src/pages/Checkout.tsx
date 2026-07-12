import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ShieldCheck, CreditCard, ChevronLeft, Briefcase, Zap, Layers, Tag, X, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getProductByLookupKey } from '../lib/pricingCatalog.js';
import { MillionsNestLogo } from '../components/MillionsNestLogo.js';

interface NormalizedProduct {
  id: string; // Stripe Price ID
  lookupKey: string | null;
  app: string;
  type: string;
  tier?: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  feature: string;
  featured: boolean;
  recommended: boolean;
  metadata: Record<string, string>;
}

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(['checkout']);

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [plans, setPlans] = useState<NormalizedProduct[]>([]);
  const [addons, setAddons] = useState<NormalizedProduct[]>([]);
  
  // Selections
  const [selectedPlanLookup, setSelectedPlanLookup] = useState<string | null>(null);
  const [selectedAddonsLookup, setSelectedAddonsLookup] = useState<string[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string, percentOff?: number | null, amountOff?: number | null, duration?: string } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  // Checkout Error State
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutAction, setCheckoutAction] = useState<{ code: string, label: string, url?: string } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    fetch('/api/v1/billing/products')
      .then(res => res.json())
      .then(data => {
         if (data.plans) setPlans(data.plans);
         if (data.addons) setAddons(data.addons);
         
         // UX Optimized: Prioritize plan from URL or Session
         const params = new URLSearchParams(window.location.search);
         const planParam = params.get('plan');
         
         if (planParam) {
           setSelectedPlanLookup(planParam);
           // If it's an addon, also select it
           if (data.addons?.some((a: any) => a.lookupKey === planParam)) {
             setSelectedAddonsLookup([planParam]);
             // If we only selected an addon, we still need a base plan usually, but we'll let the user decide
           }
         } else if (data.plans) {
             const proMonthly = data.plans.find((p: any) => p.lookupKey === 'musicscale_pro_monthly');
             if (proMonthly) {
                 setSelectedPlanLookup(proMonthly.lookupKey);
             }
         }
         
         setLoading(false);
      })
      .catch(err => {
         console.error('Error fetching catalog:', err);
         setLoading(false);
      });
  }, [user, navigate]);

  const availablePlans = useMemo(() => {
     return plans.filter(p => billingCycle === 'yearly' ? p.interval === 'year' : p.interval === 'month');
  }, [plans, billingCycle]);

  // When billing cycle changes, auto-switch selected plan tier
  useEffect(() => {
      if (selectedPlanLookup && availablePlans.length > 0) {
         const currentPlan = plans.find(p => p.lookupKey === selectedPlanLookup);
         if (currentPlan) {
            const corresponding = availablePlans.find(p => p.tier === currentPlan.tier);
            if (corresponding) {
               setSelectedPlanLookup(corresponding.lookupKey);
            } else {
               setSelectedPlanLookup(availablePlans[0].lookupKey);
            }
         }
      }
  }, [billingCycle, availablePlans]);

  const toggleAddon = (lookupKey: string) => {
      setSelectedAddonsLookup(prev => 
         prev.includes(lookupKey) ? prev.filter(k => k !== lookupKey) : [...prev, lookupKey]
      );
  };

  const selectedPlanItem = plans.find(p => p.lookupKey === selectedPlanLookup);
  const selectedAddonsItems = addons.filter(a => a.lookupKey && selectedAddonsLookup.includes(a.lookupKey));

  const totalMonthly = useMemo(() => {
      let sum = 0;
      if (selectedPlanItem) {
         sum += selectedPlanItem.price;
      }
      for (const a of selectedAddonsItems) {
         if (a.interval !== 'one_time') {
             sum += (a.interval === 'year' ? a.price / 12 : a.price); // roughly
         }
      }
      return sum;
  }, [selectedPlanItem, selectedAddonsItems]);

  const totalOneTime = useMemo(() => {
      let sum = 0;
      for (const a of selectedAddonsItems) {
         if (a.interval === 'one_time') sum += a.price;
      }
      return sum;
  }, [selectedAddonsItems]);

  let discountedMonthly = totalMonthly;
  let discountedOneTime = totalOneTime;
  let savingsMonthly = 0;
  let savingsOneTime = 0;

  if (appliedCoupon) {
      if (appliedCoupon.percentOff) {
          savingsMonthly = totalMonthly * (appliedCoupon.percentOff / 100);
          discountedMonthly -= savingsMonthly;
          
          savingsOneTime = totalOneTime * (appliedCoupon.percentOff / 100);
          discountedOneTime -= savingsOneTime;
      } else if (appliedCoupon.amountOff) {
          // Stripe coupons usually apply to the total invoice amount. 
          // For simplicity in display, we subtract from monthly first, then one-time.
          const discountVal = appliedCoupon.amountOff;
          if (discountVal <= totalMonthly) {
              savingsMonthly = discountVal;
              discountedMonthly -= discountVal;
          } else {
              savingsMonthly = totalMonthly;
              discountedMonthly = 0;
              const remainingVal = discountVal - totalMonthly;
              savingsOneTime = Math.min(remainingVal, totalOneTime);
              discountedOneTime -= savingsOneTime;
          }
      }
  }

  const handleApplyCoupon = async () => {
     if (!couponCode.trim()) return;
     setCouponLoading(true);
     setCouponError('');
     try {
        const res = await fetch('/api/v1/billing/validate-coupon', {
           method: 'POST',
           headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken(true)}`
        },
           body: JSON.stringify({ code: couponCode.trim() })
        });
        const data = await res.json();
        if (data.valid) {
            setAppliedCoupon({ id: data.id, percentOff: data.percentOff, amountOff: data.amountOff, duration: data.duration });
            setCouponCode('');
        } else {
            setCouponError(data.error || t('invalid_coupon', 'Cupom inválido'));
        }
     } catch(e) {
        setCouponError(t('validate_error', 'Erro ao validar.'));
     } finally {
        setCouponLoading(false);
     }
  };

  const removeCoupon = () => {
      setAppliedCoupon(null);
      setCouponError('');
  };

  const handleCheckout = async () => {
    if (!user || checkoutLoading) return;
    
    setCheckoutError('');
    setCheckoutAction(null);

    if (!selectedPlanLookup) {
        setCheckoutError(t('error_plan', 'Por favor, selecione um plano principal.'));
        return;
    }
    
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/v1/billing/unified-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken(true)}`
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          planLookupKey: selectedPlanLookup,
          addonLookupKeys: selectedAddonsLookup,
          promoCodeId: appliedCoupon ? appliedCoupon.id : undefined
        })
      });
      if (res.status === 401) {
        setCheckoutError('Sua sessão expirou. Atualize a página e tente novamente.');
        setCheckoutLoading(false);
        return;
      }
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        const { decision, reason, managementUrl, accessUntil, repairRequired, error, code } = data;
        
        let errorMessage = error || t('checkout_error', 'Erro ao iniciar checkout');
        let actionLabel = '';
        let actionUrl = (managementUrl && managementUrl.startsWith('/')) ? managementUrl : '/dashboard/billing';

        if (decision === 'block_duplicate' || reason === 'active_subscription_exists') {
           errorMessage = t('active_subscription_msg', 'Você já possui uma assinatura ativa.');
           actionLabel = t('manage_subscription', 'Gerenciar assinatura');
        } else if (decision === 'resume_existing' || reason === 'cancel_scheduled' || reason === 'canceled_with_residual_access') {
           errorMessage = accessUntil ? t('subscription_active_until', 'Sua assinatura continua ativa até {{date}}').replace('{{date}}', new Date(accessUntil).toLocaleDateString()) : t('subscription_active_until_unknown', 'Sua assinatura continua ativa.');
           actionLabel = t('manage_subscription', 'Gerenciar assinatura');
        } else if (decision === 'regularize_existing' || ['past_due', 'unpaid', 'incomplete', 'paused'].includes(reason)) {
           errorMessage = t('payment_issue_msg', 'Há uma pendência de pagamento na sua assinatura.');
           actionLabel = t('resolve_payment', 'Regularizar pagamento');
        } else if (reason === 'multiple_subscriptions_conflict' || repairRequired) {
           errorMessage = t('inconsistency_msg', 'Encontramos uma inconsistência na assinatura.');
           actionLabel = t('update_status', 'Atualize o status da assinatura');
        } else if (code === 'ACTIVE_SUBSCRIPTION_EXISTS' || code === 'SUBSCRIPTION_CANCEL_SCHEDULED' || code === 'SUBSCRIPTION_REQUIRES_PAYMENT') {
           actionLabel = t('portal_access', 'Acessar Portal do Cliente');
        }

        setCheckoutError(errorMessage);
        if (actionLabel) {
           setCheckoutAction({
             code: decision || code || 'error',
             label: actionLabel,
             url: actionUrl
           });
        }
      }
    } catch (e: any) {
      setCheckoutError(t('checkout_error_retry', 'Erro ao iniciar checkout. Tente novamente.'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1015] flex items-center justify-center font-sans">
        <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-[#A0A7B5] font-medium tracking-wide flex items-center gap-3"
        >
            <div className="w-5 h-5 border-2 border-[#2B85EB]/30 border-t-[#2B85EB] rounded-full animate-spin" />
            {t('loading', 'Carregando catálogo premium...')}
        </motion.div>
      </div>
    );
  }

  // Tiers sorting: Starter, Advanced, then Pro
  const sortedPlans = [...availablePlans].sort((a, b) => {
    const order: Record<string, number> = { starter: 1, advanced: 2, pro: 3 };
    const oA = order[a.tier || ''] || 99;
    const oB = order[b.tier || ''] || 99;
    return oA - oB;
  });

  return (
    <div className="min-h-screen bg-[#0B0D11] text-[#F5F7FA] font-sans selection:bg-[#2B85EB]/30 overflow-x-hidden">
        {/* Top Navbar */}
        <nav className="w-full h-20 flex items-center px-8 border-b border-white/5 bg-[#0b0d11]/80 backdrop-blur-md sticky top-0 z-50">
            <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-[#A0A7B5] hover:text-white transition-colors text-sm font-medium tracking-wide"
            >
                <ChevronLeft className="w-4 h-4" />
                {t('back', 'Voltar ao Dashboard')}
            </button>
            <div className="mx-auto flex items-center gap-3">
                <MillionsNestLogo className="h-8 w-auto" />
                <span className="font-semibold tracking-tight text-lg text-[#F5F7FA]">MillionsNest</span>
            </div>
            <div className="w-32" /> {/* Spacer */}
        </nav>

        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-16 relative">
            
            {/* Background Glow */}
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#2B85EB]/5 rounded-full blur-[150px] pointer-events-none" />

            {/* LEFT COLUMN: Plans & Addons */}
            <div className="flex flex-col gap-12 relative z-10 w-full max-w-4xl mx-auto lg:mx-0">
                {/* Header */}
                <div className="space-y-4">
                    <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
                        {t('title', 'Evolua com o plano ideal para você.')}
                    </h1>
                    <p className="text-[#A0A7B5] text-lg font-light max-w-xl">
                        {t('subtitle', 'Acesso total às ferramentas MusicScale. Teste por 7 dias grátis, cancele quando quiser com 1 clique no painel.')}
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="bg-white/5 p-1 rounded-full flex w-max border border-white/10 shadow-sm relative">
                   <button 
                       onClick={() => setBillingCycle('monthly')}
                       className={`px-8 py-2.5 rounded-full text-sm font-medium transition-all relative z-10 ${billingCycle === 'monthly' ? 'text-white' : 'text-[#A0A7B5] hover:text-white'}`}
                   >
                       {t('monthly', 'Mensal')}
                   </button>
                   <button 
                       onClick={() => setBillingCycle('yearly')}
                       className={`px-8 py-2.5 rounded-full text-sm font-medium transition-all relative z-10 ${billingCycle === 'yearly' ? 'text-white' : 'text-[#A0A7B5] hover:text-white'}`}
                   >
                       {t('yearly', 'Anual')} <span className="ml-1 text-[10px] bg-[#2B85EB] text-white px-2 py-0.5 rounded-full tracking-widest uppercase font-bold">-20%</span>
                   </button>
                   <motion.div 
                       className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white/10 border border-white/10"
                       animate={{ x: billingCycle === 'monthly' ? 4 : '100%' }}
                       transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                   />
                </div>

                {/* Unified Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 pb-4">
                   {sortedPlans.map(plan => {
                       const isSelected = selectedPlanLookup === plan.lookupKey;
                       const isPro = plan.tier === 'pro';
                       const isAdvanced = plan.tier === 'advanced';
                       const isStarter = plan.tier === 'starter';
                       
                       return (
                           <div 
                               key={plan.id}
                               onClick={() => plan.lookupKey && setSelectedPlanLookup(plan.lookupKey)}
                               className={isPro 
                                   ? `group relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border-2 flex flex-col h-full bg-[#050505] ${isSelected ? 'border-[#2B85EB] shadow-[0_0_40px_rgba(43,133,235,0.3)]' : 'border-[#2B85EB]/50 shadow-[0_0_40px_rgba(43,133,235,0.15)] hover:border-[#2B85EB]/80 hover:shadow-[0_0_40px_rgba(43,133,235,0.25)]'}`
                                   : `group relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border flex flex-col h-full ${isSelected ? 'bg-[#181C25] border-[#2B85EB]/50 shadow-[0_0_40px_-10px_rgba(43,133,235,0.2)]' : 'bg-[#101217] border-white/5 hover:border-white/20 hover:bg-[#13151A]'}`
                               }
                           >
                               {!isPro && isSelected && (
                                   <div className="absolute top-0 left-0 w-full h-full rounded-3xl border-2 border-[#2B85EB]/20 pointer-events-none" />
                               )}
                               
                               {isPro && (
                                   <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/10 to-transparent pointer-events-none rounded-3xl" />
                               )}
                               
                               {isPro && (
                                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-max z-20">
                                     <div className="bg-[#2B85EB] text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex items-center gap-1.5 border border-white/10">
                                       <Star className="w-3 h-3 text-yellow-400 fill-current" /> MAIS ESCOLHIDO
                                     </div>
                                   </div>
                               )}
                               
                               <div className="flex justify-between items-start mb-6 relative z-10">
                                   <div>
                                       <h3 className="text-xl md:text-2xl font-medium text-white mb-1 uppercase tracking-widest">{isPro ? 'Pro' : plan.name}</h3>
                                       <p className="text-[#A0A7B5] text-xs font-light min-h-[36px]">{plan.description || (isPro ? "Para ministérios que desejam a experiência premium completa." : isAdvanced ? "Para ministérios em crescimento." : "Ideal para começar com simplicidade.")}</p>
                                   </div>
                                   <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'bg-[#2B85EB] border-[#2B85EB]' : 'border-white/20 group-hover:border-white/40'}`}>
                                       {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                   </div>
                               </div>

                               <div className="mb-8 relative z-10">
                                   <div className="flex items-baseline gap-1">
                                       <span className="text-4xl font-semibold tracking-tighter text-white">
                                           R${plan.price.toFixed(2).replace('.',',')}
                                       </span>
                                       <span className="text-[#A0A7B5] text-sm">
                                           / {billingCycle === 'yearly' ? t('yearly_period', 'ano') : t('monthly_period', 'mês')}
                                       </span>
                                   </div>
                                   {isPro && (
                                       <div className="mt-2">
                                           <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#2B85EB] text-white rounded-md shadow-[0_0_15px_rgba(43,133,235,0.4)]">
                                             {t('pricing_free_trial', '7 dias grátis')}
                                           </span>
                                       </div>
                                   )}
                                   {isPro && billingCycle === 'yearly' ? (
                                       <div className="flex items-center gap-2 mt-4 mb-2 text-xs font-medium relative z-10">
                                            <span className="text-[#A0A7B5]/50 line-through">R$ {(34.90 * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">20% OFF</span>
                                       </div>
                                   ) : isPro && billingCycle === 'monthly' ? (
                                       <div className="flex items-center gap-2 mt-4 mb-2 text-xs font-medium relative z-10">
                                            <span className="text-[#A0A7B5]/50 line-through">R$ {getProductByLookupKey(plan.lookupKey || '')?.compareAtPriceInCents ? (getProductByLookupKey(plan.lookupKey || '')!.compareAtPriceInCents! / 100).toFixed(2).replace('.',',') : "44,90"}</span>
                                            <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest">{getProductByLookupKey(plan.lookupKey || '')?.promotionLabel || 'Lançamento'}</span>
                                       </div>
                                   ) : null}
                               </div>

                               <ul className="space-y-4 pt-6 border-t border-white/5 relative z-10 w-full text-left mt-0 flex-1">
                                   {isPro ? (
                                       <>
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
                                       </>
                                   ) : isAdvanced ? (
                                       <>
                                         <FeatureItem text="Tudo do Starter" />
                                         <FeatureItem text="Até 20 usuários por organização" />
                                         <FeatureItem text="Biblioteca Viva limitada" />
                                         <FeatureItem text="10 importações da Biblioteca Viva /mês" />
                                         <FeatureItem text="Histórico completo de repertório" />
                                         <FeatureItem text="Recursos intermediários de organização" />
                                         <FeatureItem text="Personalização avançada de repertório" />
                                         <FeatureItem text="Suporte prioritário básico" />
                                       </>
                                   ) : (
                                       <>
                                         <FeatureItem text="Até 10 usuários por organização" />
                                         <FeatureItem text="Escalas ilimitadas" />
                                         <FeatureItem text="Músicas ilimitadas" />
                                         <FeatureItem text="Cadastro de letras, cifras, tom e BPM" />
                                         <FeatureItem text="Compartilhamento de escalas" />
                                         <FeatureItem text="Organização por cultos e eventos" />
                                         <FeatureItem text="Acesso pelo celular, tablet e computador" />
                                         <FeatureItem text="Sincronização em nuvem" />
                                         <FeatureItem text="Suporte padrão" />
                                       </>
                                   )}
                               </ul>
                           </div>
                       );
                   })}
                </div>

                <hr className="border-white/5" />

                {/* Addons Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-5 h-5 text-[#A0A7B5]" />
                        <h2 className="text-xl font-medium text-white tracking-tight">{t('addons_title', 'Melhorias adicionais')}</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {addons.map(addon => {
                            const isSelected = addon.lookupKey ? selectedAddonsLookup.includes(addon.lookupKey) : false;
                            
                            const fallbackDescriptions: Record<string, string> = {
                              'musicscale_setup_premium': t('addon_setup_desc', 'Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.'),
                              'musicscale_training_express': t('addon_training_desc', 'Treinamento online prático para aprender rapidamente o fluxo do MusicScale.'),
                              'musicscale_worship_100': t('addon_worship_desc', 'Acervo pronto de 100 músicas já organizadas, incluindo cifra e letra integradas.'),
                              'musicscale_music_pack_10': t('addon_pack_desc', 'Pacote avulso para adicionar até 10 novas músicas ao acervo da sua organização.')
                            };
                            const description = addon.description || (addon.lookupKey ? fallbackDescriptions[addon.lookupKey] : null) || '';

                            return (
                                <div 
                                    key={addon.id}
                                    onClick={() => addon.lookupKey && toggleAddon(addon.lookupKey)}
                                    className={`group flex flex-col p-5 rounded-2xl cursor-pointer border transition-all duration-300 ${isSelected ? 'bg-[#181C25] border-[#2B85EB]/30' : 'bg-[#101217] border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-4 items-center">
                                           <div className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#2B85EB] border-[#2B85EB]' : 'border-white/20 group-hover:border-white/40 bg-white/5'}`}>
                                               {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                           </div>
                                           <div>
                                               <h4 className="text-base font-medium text-white flex items-center gap-2">
                                                  {addon.name}
                                                  {addon.interval === 'one_time' && (
                                                    <span className="text-[9px] uppercase tracking-wider font-bold bg-white/10 text-white px-2 py-0.5 rounded">{t('pricing_one_time', 'Pagamento Único')}</span>
                                                  )}
                                               </h4>
                                           </div>
                                        </div>
                                        <div className="font-medium text-white tracking-tight">
                                            + R${addon.price.toFixed(2).replace('.',',')}
                                            {addon.interval !== 'one_time' && <span className="text-[#A0A7B5] text-xs font-normal">/{addon.interval === 'year' ? 'ano' : 'mês'}</span>}
                                        </div>
                                    </div>
                                    <div className="mt-4 ml-9">
                                        <p className="text-[#A0A7B5] text-sm mb-3">{description}</p>
                                        <ul className="space-y-2">
                                            {addon.lookupKey === 'musicscale_setup_premium' && (
                                                <>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f1', 'Configuração inicial')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f2', 'Onboarding assistido')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_setup_f3', 'Organização da equipe')}</li>
                                                </>
                                            )}
                                            {addon.lookupKey === 'musicscale_training_express' && (
                                                <>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f1', 'Sessão ao vivo de 2h')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f2', 'Tira-dúvidas prático')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_training_f3', 'Gravação disponível')}</li>
                                                </>
                                            )}
                                            {addon.lookupKey === 'musicscale_worship_100' && (
                                                <>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f1', '100 músicas top Brasil')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f2', 'Letras e cifras prontas')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_worship_f3', 'BPM e tons originais')}</li>
                                                </>
                                            )}
                                            {addon.lookupKey === 'musicscale_music_pack_10' && (
                                                <>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f1', '10 músicas à sua escolha')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f2', 'Estruturação completa')}</li>
                                                    <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> {t('addon_pack_f3', 'Entrega em até 48h')}</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                        {addons.length === 0 && (
                            <p className="text-[#A0A7B5] text-sm">{t('no_addons', 'Nenhuma melhoria disponível no momento.')}</p>
                        )}
                    </div>
                </div>
                <div className="h-20 lg:hidden" /> {/* Mobile padding */}
            </div>

            {/* RIGHT COLUMN: Sticky Summary */}
            <div className="relative">
                <div className="sticky top-28 bg-[#101217] border border-white/5 pt-8 p-8 rounded-[2rem] shadow-2xl flex flex-col gap-8">
                    
                    <div>
                        <h3 className="text-xl font-medium tracking-tight text-white mb-6">{t('summary_title', 'Resumo da Assinatura')}</h3>
                        
                        <div className="space-y-4 mb-6">
                            {selectedPlanItem && (
                                <div className="flex justify-between items-baseline">
                                   <div className="flex items-center gap-2 text-white font-medium">
                                       <Briefcase className="w-4 h-4 text-[#A0A7B5]" />
                                       {selectedPlanItem.name} 
                                   </div>
                                   <span className="text-white">R${selectedPlanItem.price.toFixed(2).replace('.',',')}</span>
                                </div>
                            )}

                            {selectedAddonsItems.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    {selectedAddonsItems.map(a => (
                                       <div key={a.id} className="flex justify-between items-baseline text-[#A0A7B5] text-sm">
                                          <span>{a.name} {a.interval === 'one_time' && <span className="text-xs opacity-50">({t('lifetime', 'Vitalício')})</span>}</span>
                                          <span className="text-white">+ R${a.price.toFixed(2).replace('.',',')}</span>
                                       </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Coupon Section */}
                        <div className="pt-4 border-t border-white/5 mb-2">
                           <AnimatePresence mode="popLayout">
                               {appliedCoupon ? (
                                   <motion.div 
                                       initial={{ opacity: 0, y: 10 }}
                                       animate={{ opacity: 1, y: 0 }}
                                       exit={{ opacity: 0, scale: 0.95 }}
                                       className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between"
                                   >
                                       <div className="flex items-center gap-2 text-emerald-400">
                                           <Check className="w-4 h-4" />
                                           <span className="text-sm font-medium">
                                               {t('coupon_applied', 'Cupom Aplicado')}
                                           </span>
                                       </div>
                                       <button 
                                           onClick={removeCoupon}
                                           className="p-1 hover:bg-emerald-500/20 rounded-md transition-colors text-emerald-400/80 hover:text-emerald-400"
                                       >
                                           <X className="w-4 h-4" />
                                       </button>
                                   </motion.div>
                               ) : (
                                   <motion.div 
                                       initial={{ opacity: 0 }}
                                       animate={{ opacity: 1 }}
                                       exit={{ opacity: 0 }}
                                       className="space-y-2"
                                   >
                                       <div className="flex gap-2">
                                           <div className="relative flex-1">
                                               <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B5]" />
                                               <input 
                                                   type="text" 
                                                   placeholder={t('coupon_placeholder', 'Cupom de desconto')}
                                                   value={couponCode}
                                                   onChange={(e) => setCouponCode(e.target.value)}
                                                   className="w-full bg-[#181C25] border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-[#A0A7B5] focus:outline-none focus:border-[#2B85EB]/50 focus:ring-1 focus:ring-[#2B85EB]/50 transition-all font-mono uppercase"
                                                   onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                                               />
                                           </div>
                                           <button 
                                               onClick={handleApplyCoupon}
                                               disabled={couponLoading || !couponCode.trim()}
                                               className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                                           >
                                               {couponLoading ? (
                                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                               ) : t('apply', 'Aplicar')}
                                           </button>
                                       </div>
                                       {couponError && (
                                           <p className="text-red-400 text-xs px-1">{couponError}</p>
                                       )}
                                   </motion.div>
                               )}
                           </AnimatePresence>
                        </div>
                    </div>

                    <div className="bg-[#181C25] rounded-2xl p-6 border border-white/5 space-y-4 relative overflow-hidden">
                       <div className="absolute right-0 top-0 w-32 h-32 bg-[#2B85EB] opacity-5 blur-[80px]" />
                       
                       {totalOneTime > 0 && (
                           <div className="flex justify-between items-baseline mb-2">
                               <span className="text-[#A0A7B5] text-sm font-medium">{t('charge_today', 'Cobrança Hoje (Módulos Opcionais)')}</span>
                               <span className="text-xl font-semibold text-white tracking-tight flex flex-col items-end">
                                   {savingsOneTime > 0 && (
                                       <span className="text-xs text-[#A0A7B5] line-through font-normal">R${totalOneTime.toFixed(2).replace('.',',')}</span>
                                   )}
                                   <span>R${discountedOneTime.toFixed(2).replace('.',',')}</span>
                               </span>
                           </div>
                       )}

                       <div className="flex justify-between items-baseline border-t border-white/5 pt-4 mt-2">
                          <div>
                              <span className="font-semibold text-white block">{t('regular_sub', 'Assinatura Regular')}</span>
                              <span className="text-[#A0A7B5] text-xs mt-1 block">{t('starts_after_trial', 'Inicia após o período de 7 dias grátis.')}</span>
                          </div>
                          <div className="text-right">
                              {savingsMonthly > 0 && (
                                  <div className="text-xs text-[#A0A7B5] line-through font-normal mb-1">R${totalMonthly.toFixed(2).replace('.',',')}</div>
                              )}
                              <span className="text-2xl font-bold tracking-tight text-white">R${discountedMonthly.toFixed(2).replace('.',',')}</span>
                          </div>
                       </div>
                       
                       {appliedCoupon && (savingsMonthly > 0 || savingsOneTime > 0) && (
                           <motion.div 
                               initial={{ opacity: 0, height: 0 }}
                               animate={{ opacity: 1, height: 'auto' }}
                               className="text-emerald-400 text-xs text-right font-medium"
                           >
                               {t('savings', 'Você economiza')} R${(savingsMonthly + savingsOneTime).toFixed(2).replace('.',',')}{savingsMonthly > 0 && typeof billingCycle === 'string' ? `/${billingCycle === 'monthly' ? t('monthly_period', 'mês') : t('yearly_period', 'ano')}` : ''}
                           </motion.div>
                       )}
                    </div>

                    {checkoutError && (
                       <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col gap-3">
                           <div className="text-red-400 text-sm font-medium">
                               {checkoutError}
                           </div>
                           {checkoutAction && (
                               <button
                                   onClick={() => navigate(checkoutAction.url || '/dashboard/billing')}
                                   className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 px-3 rounded-lg transition-colors font-semibold self-start"
                               >
                                   {checkoutAction.label}
                               </button>
                           )}
                       </div>
                    )}

                    <button 
                       onClick={handleCheckout}
                       disabled={checkoutLoading || !selectedPlanLookup}
                       className="w-full py-4 px-6 bg-[#E8ECEF] hover:bg-white text-black transition-all rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                       {checkoutLoading ? (
                           <>
                               <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                               {t('processing', 'Processando...')}
                           </>
                       ) : (
                           <>
                              {t('cta', 'Iniciar Teste de 7 Dias')} 
                              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                           </>
                       )}
                    </button>

                    <div className="flex items-center justify-center gap-2 text-xs text-[#A0A7B5]">
                        <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
                        <span>{t('encrypted', 'Transação criptografada by Stripe')}</span>
                    </div>

                    <div className="text-center">
                        <p className="text-[11px] text-[#A0A7B5]/60 font-light max-w-[200px] mx-auto leading-relaxed">
                            {t('cancel_info', 'Cancele a qualquer momento antes do trial acabar e não seja cobrado.')}
                        </p>
                    </div>

                </div>
            </div>

        </main>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <li className="flex items-center gap-3 text-sm text-[#A0A7B5] font-light">
           <Check className="w-4 h-4 text-[#2B85EB]" />
           {text}
        </li>
    );
}
