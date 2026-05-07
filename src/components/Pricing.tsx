import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="precos" className="py-24 md:py-32 bg-[#fbfbfc]">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold tracking-tight text-brand-primary mb-6"
          >
            Simples, acessível e <br />pensado para igrejas.
          </motion.h2>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-center mt-10"
          >
            <div className="bg-white border border-brand-primary/10 p-1 rounded-full flex relative shadow-sm">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`relative z-10 px-6 py-2.5 text-sm font-semibold rounded-full transition-colors ${!isAnnual ? 'text-white' : 'text-brand-primary/60 hover:text-brand-primary'}`}
              >
                Mensal
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`relative z-10 px-6 py-2.5 text-sm font-semibold rounded-full transition-colors ${isAnnual ? 'text-white' : 'text-brand-primary/60 hover:text-brand-primary'}`}
              >
                Anual
              </button>
              <div 
                className="absolute top-1 bottom-1 w-1/2 bg-brand-primary rounded-full transition-transform duration-300 ease-in-out shadow-sm"
                style={{ transform: isAnnual ? 'translateX(100%)' : 'translateX(0)' }}
              />
            </div>
          </motion.div>
        </div>

        <div className="max-w-md mx-auto relative">
          {/* Decorative glow behind pricing card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-secondary to-brand-primary rounded-[2.5rem] blur opacity-20" />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white rounded-[2rem] p-8 md:p-10 border border-brand-primary/10 relative z-10 shadow-2xl flex flex-col h-full"
          >
            {isAnnual && (
              <div className="absolute top-0 right-8 -translate-y-1/2 flex flex-col items-end gap-1">
                <div className="bg-brand-secondary text-brand-primary text-xs font-bold px-3 py-1 rounded-full shadow-sm">Economize 30%</div>
                <div className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">Mais escolhido</div>
              </div>
            )}
            
            <h3 className="text-xl font-semibold text-brand-primary/60 mb-2">Plano Music Scale</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-5xl font-bold text-brand-primary tracking-tight">R$ {isAnnual ? "169" : "19,90"}</span>
              <span className="text-brand-primary/50 font-medium">/{isAnnual ? "ano" : "mês"}</span>
            </div>
            
            <a 
              href="#" 
              className="w-full py-4 px-6 rounded-xl bg-brand-primary text-white text-center font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 mt-2 mb-8"
            >
              Começar 7 dias grátis
            </a>
            
            <ul className="space-y-4 flex-1">
              {[
                "Membros ilimitados",
                "Músicas ilimitadas na base",
                "Playlists de cultos",
                "App mobile para a equipe",
                "Transposição de tom",
                "Suporte prioritário",
                "Atualizações contínuas do app"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-brand-primary/80">
                  <Check className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-0.5" />
                  <span className="font-medium text-sm">{item}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8 pt-6 border-t border-brand-primary/5 text-center">
              <p className="text-xs text-brand-primary/40 font-medium uppercase tracking-wider">Preço especial para igrejas pioneiras</p>
              <p className="text-xs text-brand-primary/50 mt-2">Sem compromisso. Cancele quando quiser.</p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
