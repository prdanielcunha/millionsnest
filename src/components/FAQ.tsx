import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

const faqs = [
  {
    q: "Preciso cadastrar cartão agora?",
    a: "Não. Você pode testar todas as funcionalidades do MusicScale gratuitamente por 7 dias sem inserir nenhum dado de pagamento. Só pedimos o cartão se você decidir assinar."
  },
  {
    q: "Funciona no celular na hora do culto?",
    a: "Sim, o aplicativo foi desenhado com o conceito 'Mobile-first'. Ele fica perfeito na tela do celular, com visualização limpa de cifras e letras, mesmo em ambientes com pouca luz."
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Absolutamente. Nossa assinatura não tem fidelidade ou multas escondidas. Você pode cancelar a qualquer momento direto pelo painel de configurações."
  },
  {
    q: "Os membros da equipe também precisam pagar?",
    a: "Não. A assinatura é cobrada apenas por ministério. Todos os membros do seu ministério de louvor podem baixar o app e acessar as escalas gratuitamente."
  },
  {
    q: "Os próximos aplicativos estarão inclusos?",
    a: "Os próximos aplicativos do ecossistema de gestão ministerial terão planos próprios, mas assinantes pioneiros do MusicScale terão descontos exclusivos para assinar os novos módulos."
  },
  {
    q: "Posso usar em múltiplos ministérios?",
    a: "Cada assinatura é correspondente a um Espaço de Trabalho (Workspace) que atende a uma igreja ou campus."
  }
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 md:py-32 bg-[#050505] border-b border-white/5 relative">
      <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-[#2B85EB]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#F5F7FA] mb-4">Dúvidas Frequentes</h2>
          <p className="text-[#A0A7B5]">Tudo o que você precisa saber sobre a Plataforma MillionsNest.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className={clsx(
                "border rounded-2xl overflow-hidden transition-colors duration-300",
                openIdx === idx ? "bg-[#0B0F19] border-[#2B85EB]/20" : "bg-[#0B0F19]/50 border-white/5 hover:border-white/10"
              )}
            >
              <button 
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full px-6 py-6 flex items-center justify-between text-left"
              >
                <span className={clsx("font-medium text-base transition-colors", openIdx === idx ? "text-[#F5F7FA]" : "text-[#A0A7B5]")}>{faq.q}</span>
                <motion.div 
                  animate={{ rotate: openIdx === idx ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-4 transition-colors", openIdx === idx ? "bg-[#2B85EB]/10 text-[#2B85EB]" : "bg-white/5 text-[#A0A7B5]")}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-6 text-[#A0A7B5] leading-relaxed font-normal text-sm">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
