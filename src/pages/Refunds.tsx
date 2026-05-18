import { useEffect } from "react";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { motion } from "framer-motion";

export function Refunds() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen font-sans bg-[#050505] text-[#F5F7FA] flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A0A7B5] uppercase tracking-widest mb-6">
              Legal
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight mb-4">
              Políticas de Reembolso
            </h1>
            <p className="text-lg text-[#A0A7B5]">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.article 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="prose prose-lg prose-invert prose-headings:text-[#F5F7FA] prose-a:text-[#2B85EB] hover:prose-a:text-[#2B85EB]/80 prose-p:text-[#A0A7B5] prose-strong:text-[#F5F7FA] max-w-none"
          >
            <h2>1. Direito de Arrependimento</h2>
            <p>
              Conforme o Código de Defesa do Consumidor (Art. 49), você tem o direito de arrependimento em até 7 (sete) dias civis após a primeira contratação da assinatura unificada dos produtos MillionsNest (que abrange o MusicScale e quaisquer outros apps inclusos). Caso solicite o cancelamento dentro deste período estipulado, o valor investido será reembolsado de forma integral. Como nossa plataforma oferece um Trial Gratuito inicial, a aplicabilidade em muitos casos está contida dentro do próprio uso antes da efetivação da cobrança.
            </p>

            <h2>2. Regras para Planos Mensais</h2>
            <p>
              Após o decurso do período legal de 7 dias ou de Trial Gratuito, não será fornecido reembolso da fatura de meses já cobrados ou em curso para os planos mensais. O cancelamento apenas assegura que você continuará com acesso aos serviços no período já pago, evitando cobranças futuras.
            </p>

            <h2>3. Regras para Planos Anuais</h2>
            <p>
              Em caso de desistência de Planos Anuais após o prazo legal de Direito de Arrependimento, será feita a rescisão proporcional, baseada na readequação e tarifação do nosso preço cobrado para faturamento mensal convencional - subtraindo do valor global pago -, podendo gerar um reembolso de parte do crédito, retendo de modo devido os descontos agressivos concedidos pelo compromisso contratual de um ano.
            </p>

            <h2>4. Estornos em Casos de Instabilidade</h2>
            <p>
              Reembolsos derivados de problemas de disponibilidade do servidor (ex: indisponibilidade da plataforma inteira na AWS durante longos trechos) serão analisados caso a caso pela nossa equipe técnica a título de compensação ao ministério. Tais problemas em regra ativam compensações na forma de créditos de usabilidade estendendo-se os dias ao cliente, e raras vezes em pecúnia.
            </p>

            <h2>5. Processamento dos Estornos</h2>
            <p>
              Qualquer estorno aprovado será encaminhado à sua operadora de cartão de crédito no prazo de 5 a 10 dias úteis e estará refletido nas próximas faturas da sua fatura bancária (segundo tempo estipulado pela administradora do cartão).
            </p>

            <h2>6. Como Solicitar</h2>
            <p>
              Para pedir arrependimentos e estornos legais, por favor direcione um e-mail com identificação da igreja (CNPJ e E-mail principal) para nossa central formal de suporte, informando as causas motivadoras.
            </p>
          </motion.article>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
