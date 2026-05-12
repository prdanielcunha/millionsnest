import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { motion } from "framer-motion";

export function Cancellation() {
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
              Políticas de Cancelamento
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
            <h2>1. Como Cancelar sua Assinatura</h2>
            <p>
              Prezando pela total transparência e facilidade, o cancelamento da sua assinatura unificada da MillionsNest (que inclui o MusicScale e aplicativos parceiros) pode ser feito de forma autônoma e a qualquer momento. Basta acessar as <strong>Configurações da Conta</strong> dentro do painel do seu aplicativo e selecionar a opção <strong>"Cancelar Assinatura"</strong> ou <strong>"Gerenciar Faturamento"</strong>.
            </p>

            <h2>2. Efeitos do Cancelamento</h2>
            <p>
              Ao realizar o cancelamento, a renovação automática da sua assinatura (seja ela mensal ou anual) será desativada. Isso significa que <strong>não haverá novas cobranças</strong> no seu cartão de crédito nas próximas faturas.
            </p>
            <p>
              Você e os membros da sua equipe <strong>continuarão a ter acesso total</strong> aos recursos premium do ecossistema MillionsNest até o último dia do ciclo de faturamento já pago. Após essa data, a conta será rebaixada e o acesso às ferramentas premium será suspendido.
            </p>

            <h2>3. Cancelamento no Período de Teste (Trial)</h2>
            <p>
              Se o cancelamento for efetuado antes do fim do período de teste gratuito de 7 dias (Trial), sua conta não sofrerá qualquer cobrança. O acesso aos recursos pagos poderá ser interrompido imediatamente após o cancelamento do período de teste, conforme o sistema.
            </p>

            <h2>4. Retenção de Dados e Reativação</h2>
            <p>
              Sabemos que muitos ministérios podem pausar as atividades ou o uso das ferramentas por um período. Por isso, após o fim do seu ciclo de faturamento cancelado, manteremos os dados operacionais da sua instituição, escalas e histórico salvos em nossos servidores por um <strong>prazo de 90 dias</strong> (ou conforme descrito na Política de Privacidade). 
            </p>
            <p>
              Dentro deste período, você pode simplesmente reativar a assinatura e voltar a usar a plataforma exatamente de onde parou, sem perda de arquivos. Esgotado este prazo, os dados da instituição poderão ser excluídos de forma definitiva de nossa base.
            </p>

            <h2>5. Diferença entre Cancelamento e Reembolso</h2>
            <p>
              O <strong>cancelamento</strong> impede futuras cobranças. Para solicitações de devolução de pagamentos já efetuados (como arrependimento dentro de 7 dias da contratação ou estornos de planos anuais), por favor, consulte a nossa <a href="/politicas-de-reembolso">Política de Reembolsos</a>.
            </p>

            <h2>6. Exclusão Imediata da Conta</h2>
            <p>
              Caso deseje que não apenas sua assinatura seja cancelada, mas que todos os dados do seu ministério sejam apagados <strong>imediatamente</strong> do nosso banco de dados, você deve solicitar a exclusão total através do suporte ou e-mail de atendimento da MillionsNest.
            </p>
          </motion.article>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
