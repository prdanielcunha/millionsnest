import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "Como funciona o teste de 7 dias grátis?",
    answer: "Ao assinar qualquer plano, você tem 7 dias de acesso total sem cobrança. Você pode cancelar a qualquer momento dentro desse período pelo painel e nada será debitado do seu cartão."
  },
  {
    question: "Preciso cadastrar cartão de crédito para testar?",
    answer: "Sim, solicitamos o cadastro para garantir que a transição para a assinatura oficial seja perfeita caso você decida continuar, mas o primeiro débito só ocorre após os 7 dias."
  },
  {
    question: "Posso mudar de plano depois?",
    answer: "Com certeza! Você pode fazer o upgrade ou downgrade do seu plano diretamente nas configurações da sua conta a qualquer momento."
  },
  {
    question: "O MusicScale funciona offline?",
    answer: "As cifras que você visualizou recentemente ficam salvas no cache do seu navegador para consulta rápida, mas para sincronização completa e novas músicas, é necessária conexão com a internet."
  },
  {
    question: "O que acontece se eu cancelar?",
    answer: "Se você cancelar, manterá o acesso até o final do período já pago (ou período de teste). Após isso, sua conta voltará para o nível gratuito com limitações."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-[#050505]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-xs font-semibold mb-6">
            <HelpCircle className="w-3 h-3" />
            Suporte
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#F5F7FA] mb-6">
            Dúvidas <span className="text-[#2B85EB]">Frequentes</span>
          </h2>
          <p className="text-[#A0A7B5]">
            Tudo o que você precisa saber antes de profissionalizar seu time.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="border-b border-white/5"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full py-6 flex items-center justify-between text-left group"
              >
                <span className={`text-lg font-medium transition-colors ${openIndex === i ? 'text-[#2B85EB]' : 'text-[#F5F7FA] group-hover:text-[#2B85EB]'}`}>
                  {faq.question}
                </span>
                {openIndex === i ? (
                  <Minus className="w-5 h-5 text-[#2B85EB] flex-shrink-0" />
                ) : (
                  <Plus className="w-5 h-5 text-[#A0A7B5] flex-shrink-0" />
                )}
              </button>
              
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="text-[#A0A7B5] pb-6 leading-relaxed">
                      {faq.answer}
                    </p>
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
