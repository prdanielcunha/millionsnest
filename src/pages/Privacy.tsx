import { useEffect } from "react";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { motion } from "framer-motion";

export function Privacy() {
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
              Política de Privacidade
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
            <h2>1. Nosso Compromisso com a Privacidade</h2>
            <p>
              A MillionsNest está comprometida em proteger a privacidade dos usuários e as informações pessoais e organizacionais coletadas de ministérios e igrejas (nossos Clientes) através de nosso ecossistema de plataformas SaaS, incluindo o MusicScale e todos os demais aplicativos atuais ou futuros. Esta Política de Privacidade está em total conformidade com a Lei Geral de Proteção de Dados (LGPD - nº 13.709/18).
            </p>

            <h2>2. Dados Coletados</h2>
            <p>Podemos coletar e processar os seguintes dados:</p>
            <ul>
              <li><strong>Dados Cadastrais de Administradores:</strong> Nome, e-mail, telefone, nome da instituição.</li>
              <li><strong>Dados de Usuários Finais (Membros da Igreja):</strong> Nomes, contatos e informações operacionais vinculadas (ex: histórico de escalas) inseridas pelos administradores.</li>
              <li><strong>Dados de Pagamento:</strong> Informações parciais para faturamento (processadas com segurança por gateways como Stripe/Pagar.me; não armazenamos dados de cartão completos).</li>
              <li><strong>Dados de Navegação:</strong> Endereços IP, tipo de navegador, sistema operacional e logs de acesso visando a manutenção e apropriação dos nossos serviços.</li>
            </ul>

            <h2>3. Qual a Finalidade do Tratamento de Dados?</h2>
            <p>
              Nós utilizamos as informações coletadas para:
            </p>
            <ul>
              <li>Prover, manter e melhorar nosso ecossistema de aplicativos (seja na organização de equipes no MusicScale ou no fluxo de dados de outras ferramentas do nosso portfólio).</li>
              <li>Aprimorar nosso banco de dados mestre, processando anonimamente letras, cifras, compassos e metadados musicais de forma isolada para enriquecer a qualidade das músicas em nossos sistemas (preservando o completo sigilo sobre que usuários, bandas ou igrejas tocaram tais músicas).</li>
              <li>Verificar a segurança, evitar spam e fraudes operacionais.</li>
              <li>Comunicar sobre novas funcionalidades, alertas do ecossistema de aplicativos ou questões relativas à  assinatura unificada.</li>
            </ul>

            <h2>4. Compartilhamento de Dados com Terceiros</h2>
            <p>
              Não vendemos seus dados a terceiros. As informações da sua instituição e seus membros são estritamente para o uso da própria equipe dentro da plataforma. O compartilhamento ocorre apenas de forma segura com fornecedores essenciais (ex: provedores de nuvem como AWS ou Google Cloud) ou sob requisição legal (ordens judiciais).
            </p>

            <h2>5. Segurança das Informações</h2>
            <p>
              A MillionsNest aplica práticas estritas de segurança corporativa moderna (criptografia em trânsito com TLS 1.2+ e dados em repouso), bem como monitoramento contínuo das rotinas em nossos servidores.
            </p>

            <h2>6. Seus Direitos (como Titular dos Dados)</h2>
            <p>De conformidade com a LGPD, garantimos a você (e aos usuários da sua instituição) o direito de:</p>
            <ul>
              <li>Confirmar o tratamento de seus dados e acessá-los.</li>
              <li>Corrigir dados incompletos ou inexatos.</li>
              <li>Excluir, bloquear ou anonimizar seus dados ou de sua conta. O cancelamento da assinatura levará ao expurgo sistemático dos dados sob solicitação.</li>
            </ul>

            <h2>7. Retenção de Dados</h2>
            <p>
              Seus dados serão retidos pelo tempo que durar sua assinatura conosco. Nos reservamos no direito de excluí-los permenentemente em até 90 dias após o cancelamento final de contrato.
            </p>

            <h2>8. Contato do Encarregado (DPO)</h2>
            <p>
              Para tratar de qualquer solicitação ou esclarecimento pertinente a esta política e à LGPD, o responsável pela instituição deve utilizar nosso suporte integrado em painel ou pelo e-mail geral de contato da MillionsNest.
            </p>
          </motion.article>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
