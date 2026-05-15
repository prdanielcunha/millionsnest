import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Star, Zap, Headphones, Settings, Video } from "lucide-react";
import { Link } from "react-router-dom";

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [prices, setPrices] = useState({ monthly: 19.90, annual: 189.90 });

  useEffect(() => {
    fetch('/api/stripe/prices')
      .then(res => res.json())
      .then(data => {
        if (data.monthly && data.annual && data.monthly.price > 0) {
           setPrices({
             monthly: data.monthly.price,
             annual: data.annual.price,
           });
         }
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
            className="bg-[#0B0F19] rounded-[2rem] p-8 md:p-10 border border-white/5 relative z-10 flex flex-col h-full hover:border-white/10 transition-colors"
          >
            <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Starter</h3>
            <p className="text-[#A0A7B5] text-sm mb-6 min-h-[60px]">
              Ideal para igrejas e equipes que desejam organizar o ministério de louvor com simplicidade, velocidade e excelência.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-semibold text-[#F5F7FA] tracking-tight">
                R$ {isAnnual ? (prices.annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[#A0A7B5] font-normal">/mês</span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-3 mb-6 text-sm font-medium">
                <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-xs">20% OFF</span>
              </div>
            ) : (
              <div className="h-6 mb-6" />
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
                "Equipe de ministério",
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
            className="bg-[#050505] rounded-[2rem] p-8 md:p-10 border border-[#2B85EB]/30 relative z-10 flex flex-col h-full premium-shadow overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/5 to-transparent pointer-events-none" />
            
            <div className="absolute top-0 right-8 -translate-y-1/2">
               <div className="bg-[#2B85EB] text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-widest flex items-center gap-1">
                 <Star className="w-3 h-3" /> Mais Popular
               </div>
            </div>

            <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest relative z-10">Pro</h3>
            <p className="text-[#A0A7B5] text-sm mb-6 min-h-[60px] relative z-10">
              Para ministérios que desejam automação, organização avançada e máxima produtividade.
            </p>
            
            <div className="flex items-baseline gap-1 mb-1 relative z-10">
              <span className="text-5xl font-semibold text-[#F5F7FA] tracking-tight">
                R$ {isAnnual ? "23,90" : "29,90"}
              </span>
              <span className="text-[#A0A7B5] font-normal">/mês</span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-3 mb-6 text-sm font-medium relative z-10">
                <span className="text-[#A0A7B5]/50 line-through">R$ {(29.90 * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-xs">Cobrado R$ 286,90 /ano</span>
              </div>
            ) : (
              <div className="h-6 mb-6 relative z-10" />
            )}
            
            <Link 
              to="/login" 
              className="w-full py-4 px-6 rounded-xl bg-[#F5F7FA] text-[#050505] text-center font-semibold hover:bg-white transition-all shadow-[0_0_20px_rgba(245,247,250,0.1)] hover:shadow-[0_0_30px_rgba(245,247,250,0.2)] active:scale-95 mt-2 mb-8 block relative z-10"
            >
              Desbloquear Pro
            </Link>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5 relative z-10">
              {[
                "Tudo do plano Starter",
                "Automações avançadas",
                "Templates inteligentes",
                "Histórico completo",
                "Analytics e insights",
                "Permissões avançadas",
                "Colaboração otimizada",
                "Organização avançada",
                "Experiência premium",
                "Futuras funções inteligentes",
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

          <div className="grid md:grid-cols-3 gap-6">
            
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
              <div className="text-[#2B85EB] font-mono text-sm mb-4">R$ 97 <span className="text-[#A0A7B5] text-xs font-sans">/único</span></div>
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
              <div className="text-[#2B85EB] font-mono text-sm mb-4">R$ 29,90 <span className="text-[#A0A7B5] text-xs font-sans">/único</span></div>
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
                <Headphones className="w-5 h-5 text-[#A0A7B5]" />
              </div>
              <h4 className="text-[#F5F7FA] font-semibold text-lg mb-1">Music Assist 10</h4>
              <div className="text-[#2B85EB] font-mono text-sm mb-4">R$ 29,90 <span className="text-[#A0A7B5] text-xs font-sans">/mês</span></div>
              <p className="text-[#A0A7B5] text-sm mb-6 flex-1">
                Assistência operacional leve para auxiliar sua equipe no dia a dia.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Até 10 assistências mensais</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Suporte rápido</li>
                <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Canal prioritário</li>
              </ul>
              <Link to="/login" className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-white/10 transition-colors">
                Assinar Assistência
              </Link>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}

