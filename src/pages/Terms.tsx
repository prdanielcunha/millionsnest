import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { motion } from "framer-motion";

export function Terms() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen font-sans bg-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-brand-primary/5 text-sm font-semibold text-brand-primary mb-6">
              Legal
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-brand-primary tracking-tight mb-4">
              Termos de Uso
            </h1>
            <p className="text-lg text-brand-primary/60">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.article 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="prose prose-lg prose-headings:text-brand-primary prose-a:text-brand-secondary hover:prose-a:text-brand-primary prose-p:text-brand-primary/70 max-w-none"
          >
            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar os serviços e aplicativos da MillionsNest (incluindo o MusicScale e quaisquer outros softwares presentes ou futuros do nosso ecossistema), você concorda em cumprir e ficar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá acessar a plataforma.
            </p>

            <h2>2. Descrição do Serviço</h2>
            <p>
              A MillionsNest fornece um ecossistema de ferramentas de gestão no modelo SaaS (Software as a Service) voltadas para o nicho eclesiástico e ministérios. Nossa plataforma engloba múltiplos aplicativos acessíveis sob o mesmo modelo de assinatura. O serviço é oferecido "no estado em que se encontra", sendo atualizado e aprimorado constantemente. A adição de novos aplicativos à plataforma pode estar sujeita aos mesmos termos ou a condições complementares.
            </p>

            <h2>3. Cadastro e Segurança</h2>
            <p>
              Para usar nossas aplicações, você precisará criar uma conta. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem sob sua conta. A MillionsNest não será responsável por qualquer perda ou dano decorrente do não cumprimento desta obrigação de segurança.
            </p>

            <h2>4. Assinaturas e Pagamentos</h2>
            <p>
              O uso continuado de nossos serviços premium requer uma assinatura ativa. Os pagamentos são processados antecipadamente e não são reembolsáveis no caso de uso parcial dos meses. Os valores das assinaturas podem sofrer reajustes, mas você será notificado com pelo menos 30 dias de antecedência antes de qualquer mudança em seu plano ativo.
            </p>

            <h2>5. Período de Teste Gratuito (Trial)</h2>
            <p>
              Oferecemos um período de teste gratuito de 7 dias para que você possa avaliar as funcionalidades da nossa plataforma. Ao final deste período, caso não haja o cancelamento ou a confirmação da assinatura, o acesso às funcionalidades premium poderá ser restrito até a efetivação do pagamento.
            </p>

            <h2>6. Propriedade Intelectual e Licença de Uso</h2>
            <p>
              O código, design, arquitetura e inteligência de todos os softwares da MillionsNest (presentes e futuros) são de propriedade exclusiva da MillionsNest. Nós concedemos a você uma licença limitada, não exclusiva e intransferível para acessar e usar os Serviços com propósitos internos no seu ministério/igreja.
            </p>
            <p>
              É expressamente proibido:
            </p>
            <ul>
              <li>Copiar, modificar ou criar obras derivadas do Serviço.</li>
              <li>Tentar extrair o código-fonte do Software (engenharia reversa).</li>
              <li>Vender, revender, alugar ou compartilhar sua conta com instituições de terceiros.</li>
            </ul>

            <h2>7. Responsabilidade pelos Dados (User Content) e Banco Musical</h2>
            <p>
              Você retém todos os direitos sobre os dados operacionais, escalas, agendas e informações de membros (Conteúdo) que insere em nossa plataforma. Ao submetê-los, você nos concede licença apenas para hospedar e exibir esses dados a fim de prestar o Serviço adequadamente para sua instituição.
            </p>
            <p>
              <strong>Aprimoramento do Banco de Músicas:</strong> Ao utilizar nossa plataforma e adicionar ou editar músicas, letras, cifras, tons e metadados musicais em geral, você concorda que a MillionsNest poderá utilizar essas informações puramente musicais — que possuem caráter de execução pública — de forma anonimizada para criar, refinar, corrigir e enriquecer o nosso banco de dados global de músicas. Esta concessão permite construirmos um acervo melhor para todos os usuários. Reitera-se que <strong>nenhum</strong> dado pessoal (como quem tocou, onde ou quando) será associado a este uso.
            </p>

            <h2>8. Proteção de Dados (LGPD)</h2>
            <p>
              O armazenamento e tratamento das informações cadastradas segue de forma rigorosa as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Para mais detalhes sobre como coletamos, usamos e protegemos suas informações (como dados dos membros da sua igreja), consulte nossa Política de Privacidade.
            </p>

            <h2>9. Limitação de Responsabilidade</h2>
            <p>
              Na máxima extensão permitida pelas leis brasileiras, a MillionsNest não será responsabilizada por lucros cessantes, perda de dados ou danos indiretos, especiais ou incidentais decorrentes do uso de nossos serviços, interrupção de conectividade, ou instabilidade de servidores (AWS/GCP/Azure).
            </p>

            <h2>10. Modificação dos Termos</h2>
            <p>
              A MillionsNest pode revisar estes termos de uso para seu site a qualquer momento, sem aviso prévio caso sejam mudanças pequenas de usabilidade. Para mudanças materiais na forma como tratamos assinaturas, faturamento ou dados, notificaremos todos os usuários via e-mail.
            </p>

            <h2>11. Contato</h2>
            <p>
              Se você tiver dúvidas ou sugestões sobre estes Termos de Uso, entre em contato através dos canais de suporte providenciados dentro de nossa plataforma.
            </p>
          </motion.article>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
