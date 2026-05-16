import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

const faqs = [
  {
    q: "Preciso cadastrar cartão para testar?",
    a: "Sim. Para liberar seu período de 7 dias grátis, pedimos os dados do seu cartão. Mas fique tranquilo: nenhuma cobrança será feita caso você cancele antes do final do teste de 7 dias."
  },
  {
    q: "Qual a diferença entre os planos Starter e Pro?",
    a: "O Starter atende equipes de até 10 pessoas e conta com todas as funções de gestão. O Pro remove as barreiras numéricas, permitindo equipe ilimitada, e dá acesso ininterrupto à Biblioteca Viva MusicScale com atualizações constantes."
  },
  {
    q: "O plano Starter tem limite de músicas que eu mesmo posso adicionar?",
    a: "Não! O cadastro manual de músicas, letras e cifras é 100% ilimitado em todos os planos do MusicScale. A diferença é que no plano Pro você não gasta todo esse tempo, pois ele já te dá acesso contínuo ao nosso acervo alimentado pela nossa equipe."
  },
  {
    q: "O que acontece se eu ultrapassar os 10 membros no plano Starter?",
    a: "O sistema impedirá novos convites quando você atingir as 10 vagas do seu plano. Para adicionar a 11ª pessoa da sua equipe de louvor e técnica, você precisará fazer o upgrade para o plano Pro, e então terá membros ilimitados."
  },
  {
    q: "O que é a Biblioteca Viva MusicScale que vem no plano Pro?",
    a: "É o nosso vasto acervo premium de cifras e letras, focado para equipes de louvor e atualizado frequentemente. Você terá as músicas (como baterias, hits e lançamentos que as igrejas cantam) já formatadas, cadastradas e prontas para você apenas arrastar para sua escala."
  },
  {
    q: "O que são esses Serviços Premium (Setup, Treinamento e Acervo Inicial)?",
    a: "São serviços pagos à parte para acelerar processos do seu ministério. Eles englobam o 'Setup Premium' e o 'Treinamento Express' nos quais nós ou um de nossos especialistas treinamos você. Também possuímos atalhos como o 'Acervo Inicial Worship' que já cadastra logo de cara 100 músicas populares e o 'Music Pack 10'."
  },
  {
    q: "Posso comprar os Serviços Premium mais de uma vez?",
    a: "Com certeza! Enquanto o 'Acervo Inicial Worship' costuma ser comprado apenas na largada, pacotes auxiliares como o 'Music Pack 10' podem (e costumam) ser comprados toda vez que sua igreja decide colocar um lote de músicas novas e prefere terceirizar a formatação conosco."
  },
  {
    q: "Os membros da minha equipe (baterista, cantores) precisam pagar?",
    a: "Não, eles acessam tudo de graça! A assinatura do plano (Starter ou Pro) é paga pela Igreja/Organização. Os membros convidados baixam o app, leem suas cifras e confirmam escalações sem custo nenhum, limitados apenas por qual plano a igreja tem ativado."
  },
  {
    q: "Como funciona o contato com o Suporte?",
    a: "Ambos os planos (Starter e Pro) contam com suporte padrão ágil com a nossa equipe via sistema de chamados (tickets) para esclarecimentos de dúvidas e resolução de qualquer obstáculo."
  },
  {
    q: "Posso alterar meu plano para anual ou cancelar no meio?",
    a: "Sim. A sua conta tem controle total. Você pode entrar e fazer o upgrade de Starter para Pro, mudar o pagamento de Mensal para Anual, e também cancelar sua assinatura a qualquer momento que desejar, sem medo de tarifas extras ou contratos predatórios que o obriguem a ficar."
  },
  {
    q: "O leitor de cifras e letras funciona bem no culto? É fácil ver no celular?",
    a: "Sim! Pensamos nossa aplicação inteira numa filosofia 'Mobile-first', ou seja, o ponto principal foi construir uma visualização limpa e focada no celular em cima do palco. O resultado é ótimo para leitura durante a execução, mesmo perante luzes fortes do altar."
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
          <p className="text-[#A0A7B5]">Tudo o que você precisa saber sobre o MusicScale.</p>
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
