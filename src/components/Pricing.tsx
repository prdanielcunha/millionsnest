import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Star, Zap, Headphones, Settings, Video, ListMusic } from "lucide-react";
import { Link } from "react-router-dom";

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);
  
  // Dynamic prices state
  const [plansData, setPlansData] = useState<any[]>([]);
  const [addonsData, setAddonsData] = useState<any[]>([]);
  
  const [prices, setPrices] = useState({
    monthly: 0,
    annual: 0,
    setup_premium: 0,
    training_express: 0,
    worship_100: 0,
    music_pack_10: 0
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
           const monthlyPlan = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_monthly');
           const annualPlan = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_yearly');
           
           if (monthlyPlan) newPrices.monthly = monthlyPlan.price;
           if (annualPlan) newPrices.annual = annualPlan.price;
           
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

  return (
    <section id="precos" className="py-24 md:py-32 bg-[#050505] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-[#2B85EB]/5 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A0A7B5] uppercase tracking-widest mb-6"
          >
            Investimento
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-semibold tracking-tight text-[#F5F7FA] mb-6"
          >
            Acessível. Escalável. Premium.
          </motion.h2>
          
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
                Mensal
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`relative z-10 px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors ${isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
              >
                Anual
              </button>
              <div 
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#F5F7FA] rounded-lg transition-transform duration-300 ease-in-out"
                style={{ transform: isAnnual ? 'translateX(calc(100% + 6px))' : 'translateX(6px)' }}
              />
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto relative mb-32">
          {/* STARTER */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-[#0B0F19] rounded-[2rem] p-6 md:p-10 border border-white/5 relative z-10 flex flex-col h-full hover:border-white/10 transition-colors"
          >
            <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Starter</h3>
            <p className="text-[#A0A7B5] text-sm mb-6 min-h-[60px]">
              Ideal para equipes e igrejas que desejam organizar o ministério de louvor com simplicidade e excelência.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight">
                 R$ {prices.monthly > 0 ? (isAnnual ? (prices.annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "..."}
              </span>
              <span className="text-[#A0A7B5] font-normal text-sm md:text-base">/mês</span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-2 md:gap-3 mb-6 text-xs md:text-sm font-medium">
                 {prices.monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                 {prices.monthly > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px] md:text-xs">{(100 - (prices.annual / (prices.monthly * 12)) * 100).toFixed(0)}% OFF</span>}
              </div>
            ) : (
              <div className="h-5 md:h-6 mb-6" />
            )}
            
            <Link 
              to="/login" 
              className="w-full py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-[#F5F7FA] text-center font-semibold hover:bg-white/10 transition-all shadow-sm active:scale-95 mt-2 mb-8 block"
            >
              Começar Agora
            </Link>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5">
              {[
                "Músicas ilimitadas",
                "Escalas ilimitadas",
                "Até 10 pessoas por organização",
                "Compartilhamento de escalas",
                "Organização por cultos e eventos",
                "Personalização básica",
                "Acesso mobile",
                "Sincronização em nuvem",
                "Suporte padrão",
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
            className="bg-[#050505] rounded-[2rem] p-6 md:p-10 border border-[#2B85EB]/30 relative z-10 flex flex-col h-full premium-shadow"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/5 to-transparent pointer-events-none rounded-[2rem]" />
            
            {plansData?.find(p => p.lookupKey === 'musicscale_pro_monthly')?.featured && (
              <div className="absolute top-4 right-4 md:top-6 md:right-8">
                <div className="bg-[#2B85EB] text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-widest flex items-center gap-1">
                  <Star className="w-3 h-3" /> Mais Popular
                </div>
              </div>
            )}

            <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest relative z-10 mt-4 md:mt-0">Pro</h3>
            <p className="text-[#A0A7B5] text-sm mb-4 min-h-[60px] relative z-10">
              Para ministérios que desejam mais liberdade, crescimento e acesso contínuo aos recursos premium do MusicScale.
            </p>
            <div className="bg-[#2B85EB]/10 border border-[#2B85EB]/20 rounded-xl p-4 mb-6 relative z-10">
              <h4 className="text-[#2B85EB] font-bold text-[11px] md:text-xs mb-1.5 uppercase tracking-widest break-words leading-tight">Biblioteca Viva MusicScale</h4>
              <p className="text-[#A0A7B5] text-[11px] md:text-xs leading-relaxed">Acesso contínuo ao acervo atualizado do MusicScale, com novas músicas adicionadas regularmente para sua equipe ter o melhor repertório.</p>
            </div>
            
            <div className="flex items-baseline gap-1 mb-1 relative z-10">
              <span className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight">
                 R$ {prices.monthly > 0 ? (isAnnual ? (prices.annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "..."}
              </span>
              <span className="text-[#A0A7B5] font-normal text-sm md:text-base">/mês</span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-2 md:gap-3 mb-6 text-xs md:text-sm font-medium relative z-10">
                 {prices.monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                 {prices.monthly > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px] md:text-xs">{(100 - (prices.annual / (prices.monthly * 12)) * 100).toFixed(0)}% OFF</span>}
              </div>
            ) : (
              <div className="h-5 md:h-6 mb-6 relative z-10" />
            )}
            
            <Link 
              to="/login" 
              className="w-full py-4 px-3 md:px-6 rounded-xl bg-[#F5F7FA] text-[#050505] text-center font-semibold text-sm md:text-base hover:bg-white transition-all shadow-[0_0_20px_rgba(245,247,250,0.1)] hover:shadow-[0_0_30px_rgba(245,247,250,0.2)] active:scale-95 mt-2 mb-8 block relative z-10"
            >
              Desbloquear Pro
            </Link>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5 relative z-10">
              {[
                "Tudo do Starter",
                "Pessoas ilimitadas por organização",
                "Acesso à Biblioteca Viva MusicScale",
                "Novas músicas adicionadas continuamente",
                "Atualização constante do acervo",
                "Experiência premium",
                "Prioridade em novos recursos"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#F5F7FA]">
                  <Zap className="w-4 h-4 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                  <span className="font-normal text-sm opacity-90">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
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
              Serviços Premium
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[#A0A7B5] text-base"
            >
              Complementos operacionais para acelerar a estruturação do seu ministério.
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
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">Setup Premium</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.setup_premium > 0 ? prices.setup_premium.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Configuração inicial</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Onboarding assistido</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Organização da equipe</li>
              </ul>
              <Link to="/login" className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors">
                Solicitar Setup
              </Link>
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
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">Treinamento Express</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.training_express > 0 ? prices.training_express.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                Treinamento online prático para aprender rapidamente o fluxo do MusicScale.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Treinamento em grupo</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Boas práticas</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Gravação disponível</li>
              </ul>
              <Link to="/login" className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors">
                Quero Participar
              </Link>
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
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">Acervo Inicial Worship</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.worship_100 > 0 ? prices.worship_100.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                Comece mais rápido com um acervo pronto de 100 músicas já organizadas no MusicScale, incluindo cifra e letra integradas.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> 100 músicas já cadastradas</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Cifra integrada</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Letras organizadas</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Estrutura pronta no MusicScale</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Implantação imediata</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Economia de tempo para sua equipe</li>
              </ul>
              <Link to="/login" className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors">
                Comprar Acervo
              </Link>
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
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">Music Pack +10</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">
                 R$ {prices.music_pack_10 > 0 ? prices.music_pack_10.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
              </div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                Pacote avulso para adicionar até 10 novas músicas ao acervo da sua organização.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Até 10 novas músicas</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Organização no acervo</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Com letra e cifra</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Atualização rápida</li>
              </ul>
              <Link to="/login" className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors">
                Comprar Pacote
              </Link>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}

