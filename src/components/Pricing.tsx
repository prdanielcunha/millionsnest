import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="precos" className="py-24 md:py-32 bg-[#0B0F19] border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-[#2B85EB]/10 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
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
            <div className="bg-[#050505] p-1.5 rounded-xl border border-white/10 flex relative shadow-[0_0_20px_rgba(0,0,0,0.5)]">
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

        <div className="max-w-md mx-auto relative">
          {/* Decorative glow behind pricing card */}
          <div className="absolute -inset-1 bg-gradient-to-b from-[#2B85EB]/30 to-transparent rounded-[2.5rem] blur-xl opacity-30 pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-[#050505] rounded-[2rem] p-8 md:p-10 border border-[#2B85EB]/20 relative z-10 premium-shadow flex flex-col h-full"
          >
            {isAnnual && (
              <div className="absolute top-0 right-8 -translate-y-1/2 flex flex-col items-end gap-1.5">
                <div className="bg-[#0B0F19] border border-[#2B85EB]/30 text-[#2B85EB] text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-widest">Economize 30%</div>
                <div className="bg-[#2B85EB] text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm uppercase tracking-widest">Mais escolhido</div>
              </div>
            )}
            
            <h3 className="text-sm font-medium text-[#A0A7B5] mb-2 uppercase tracking-widest">Plano Music Scale</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-semibold text-[#F5F7FA] tracking-tight">R$ {isAnnual ? "14,08" : "19,90"}</span>
              <span className="text-[#A0A7B5] font-normal">/mês</span>
            </div>
            
            {isAnnual ? (
              <div className="flex items-center gap-3 mb-6 text-sm font-medium">
                <span className="text-[#A0A7B5]/50 line-through">R$ 238,80</span>
                <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-xs">R$ 169,00 /ano</span>
              </div>
            ) : (
              <div className="h-6 mb-6" />
            )}
            
            <Link 
              to="/login" 
              className="w-full py-4 px-6 rounded-xl bg-[#F5F7FA] text-[#050505] text-center font-semibold hover:bg-white transition-all shadow-sm active:scale-95 mt-2 mb-8 block"
            >
              Começar 7 dias grátis
            </Link>
            
            <ul className="space-y-4 flex-1 pt-6 border-t border-white/5">
              {[
                "Membros ilimitados",
                "Músicas ilimitadas na base",
                "Playlists de cultos",
                "App mobile para a equipe",
                "Transposição de tom",
                "Suporte prioritário",
                "Atualizações contínuas do app"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#A0A7B5]">
                  <Check className="w-4 h-4 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                  <span className="font-normal text-sm">{item}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-[10px] text-[#A0A7B5]/60 font-bold uppercase tracking-widest">Preço especial para igrejas pioneiras</p>
              <p className="text-xs text-[#A0A7B5] mt-2">Sem compromisso. Cancele quando quiser.</p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
