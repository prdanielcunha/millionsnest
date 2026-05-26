import React, { useEffect } from "react";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface TranslationBlock {
  title: string;
  tag: string;
  updatedAt: string;
  sections: {
    h2: string;
    body: string | React.ReactNode;
  }[];
}

const contentMap: Record<string, TranslationBlock> = {
  pt: {
    title: "Termos de Uso",
    tag: "Legal",
    updatedAt: "Última atualização: Maio de 2026",
    sections: [
      {
        h2: "1. Aceitação dos Termos",
        body: "Ao acessar e usar os serviços e aplicativos da MillionsNest (incluindo o MusicScale e quaisquer outros softwares presentes ou futuros do nosso ecossistema), você concorda em cumprir e ficar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá acessar a plataforma."
      },
      {
        h2: "2. Descrição do Serviço",
        body: "A MillionsNest fornece um ecossistema de ferramentas de gestão no modelo SaaS (Software as a Service) voltadas para o nicho eclesiástico e ministérios. Nossa plataforma engloba múltiplos aplicativos acessíveis sob o mesmo modelo de assinatura. O serviço é oferecido \"no estado em que se encontra\", sendo atualizado e aprimorado constantemente. A adição de novos aplicativos à plataforma pode estar sujeita aos mesmos termos ou a condições complementares."
      },
      {
        h2: "3. Cadastro e Segurança",
        body: "Para usar nossas aplicações, você precisará criar uma conta. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem sob sua conta. A MillionsNest não será responsável por qualquer perda ou dano decorrente do não cumprimento desta obrigação de segurança."
      },
      {
        h2: "4. Assinaturas e Pagamentos",
        body: "O uso continuado de nossos serviços premium requer uma assinatura ativa. Os pagamentos são processados antecipadamente e não são reembolsáveis no caso de uso parcial dos meses. Os valores das assinaturas podem sofrer reajustes, mas você será notificado com pelo menos 30 dias de antecedência antes de qualquer mudança em seu plano ativo."
      },
      {
        h2: "5. Período de Teste Gratuito (Trial)",
        body: "Oferecemos um período de teste gratuito de 7 dias para que você possa avaliar as funcionalidades da nossa plataforma. Ao final deste período, caso não haja o cancelamento ou a confirmação da assinatura, o acesso às funcionalidades premium poderá ser restrito até a efetivação do pagamento."
      },
      {
        h2: "6. Propriedade Intelectual e Licença de Uso",
        body: "O código, design, arquitetura e inteligência de todos os softwares da MillionsNest (presentes e futuros) são de propriedade exclusiva da MillionsNest. Nós concedemos a você uma licença limitada, não exclusiva e intransferível para acessar e usar os Serviços com propósitos internos no seu ministério/igreja."
      },
      {
        h2: "7. Responsabilidade pelos Dados (User Content)",
        body: "Você retém todos os direitos sobre os dados operacionais, escalas, agendas e informações de membros que insere em nossa plataforma. Ao submetê-los, você nos concede licença apenas para hospedar e exibir esses dados a fim de prestar o Serviço adequadamente para sua instituição. Ao utilizar nossa plataforma e adicionar ou editar músicas, letras, cifras, tons e metadados musicais em geral, você concorda que a MillionsNest poderá utilizar essas informações puramente musicais de forma anonimizada para enriquecer o nosso banco de dados global de músicas."
      },
      {
        h2: "8. Proteção de Dados (LGPD)",
        body: "O armazenamento e tratamento das informações cadastradas segue de forma rigorosa as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Para mais detalhes sobre como coletamos, usamos e protegemos suas informações (como dados dos membros da sua igreja), consulte nossa Política de Privacidade."
      },
      {
        h2: "9. Limitação de Responsabilidade",
        body: "Na máxima extensão permitida pelas leis brasileiras, a MillionsNest não será responsabilizada por lucros cessantes, perda de dados ou danos indiretos, especiais ou incidentais decorrentes do uso de nossos serviços, interrupção de conectividade, ou instabilidade de servidores."
      },
      {
        h2: "10. Modificação dos Termos",
        body: "A MillionsNest pode revisar estes termos de uso para seu site a qualquer momento, sem aviso prévio caso sejam mudanças pequenas de usabilidade. Para mudanças materiais na forma como tratamos assinaturas, faturamento ou dados, notificaremos todos os usuários via e-mail."
      },
      {
        h2: "11. Contato",
        body: "Se você tiver dúvidas ou sugestões sobre estes Termos de Uso, entre em contato através dos canais de suporte providenciados dentro de nossa plataforma."
      }
    ]
  },
  en: {
    title: "Terms of Use",
    tag: "Legal",
    updatedAt: "Last updated: May 2026",
    sections: [
      {
        h2: "1. Terms Acceptance",
        body: "By accessing and using MillonsNest applications and backend servers (including MusicScale and all companion products), you agree to represent conformance to these Terms of Use. If you disagree with any segment, please terminate access immediately."
      },
      {
        h2: "2. Service Boundaries & SaaS Architecture",
        body: "MillionsNest acts as a multi-tenant SaaS provider offering software tools designed exclusively for worship assemblies, bands, and ministries. Our tools are delivered \"as-is\". We iteratively deploy code updates, features, and optimizations. Additional applications made available are regulated by these same statements unless supplementary agreements override."
      },
      {
        h2: "3. User Registration & Security Guidelines",
        body: "Leveraging our tools requires an authorized login. You remain strictly liable for caching passwords and monitoring physical access events. MillionsNest disclaims liability for credentials leaks originating from customer systems or weak access controls."
      },
      {
        h2: "4. Pricing Recurring Payments",
        body: "Continued premium tier utility dictates an active billing registration. Renewals are batched in advance of active cycles and are non-refundable in fractions. Pricing lists are subjected to variations following a strict 30-day prior notification window."
      },
      {
        h2: "5. Active Free Trial Policies",
        body: "We grant an upfront 7-Day Free Trial cycle to inspect performance, tools, rosters, and music. Unless cancelled before trial completion, recursive billing registers."
      },
      {
        h2: "6. Patent Intellect & License Permissions",
        body: "Source systems, design configurations, layout variables, and assets of MillionsNest apps remain intellectual variables. We yield a restricted, non-transferable, and revocable usage license strictly for internal church operations."
      },
      {
        h2: "7. User Data Owner Rules",
        body: "You maintain full intellectual claims over rosters, schedules, assets, and member profile metrics. We possess displaying licenses to execute operations. By submitting public song lyrics, transposition values, or chord arrangements, you yield non-exclusive permissions to consolidate music assets for database enrichment."
      },
      {
        h2: "8. Data Security and Regulations",
        body: "User data storage matches legal criteria like security frameworks and GDPR/LGPD regulations. To review metric processing, refer to our Privacy Policy block."
      },
      {
        h2: "9. Boundary of Liability",
        body: "To the maximum parameters supported by law, MillionsNest and hosting frameworks disclaim liabilities for interruptions of hosting clouds, server outages, lost databases, or collateral disruptions in workflow registers."
      },
      {
        h2: "10. Terms Adjustments",
        body: "We possess permissions to modify these terms. Minor modifications take effect instantly. Core pricing revisions or key metric treatments undergo e-mail broadcast notifications with 30-day warnings."
      },
      {
        h2: "11. Get in Touch",
        body: "If any points of these Terms demand inspection, please communicate with us via official support inboxes."
      }
    ]
  },
  es: {
    title: "Términos de Uso",
    tag: "Legal",
    updatedAt: "Última actualización: Mayo de 2026",
    sections: [
      {
        h2: "1. Aceptación de los Términos",
        body: "Al ingresar y utilizar los servicios de MillionsNest (incluyendo MusicScale y demás aplicaciones del ecosistema), usted declara conformidad expresa con estos Términos de Uso. De no alinearse con estas pautas, debe suspender su actividad de forma inmediata."
      },
      {
        h2: "2. Descripción del Servicio",
        body: "MillionsNest opera como un proveedor SaaS entregando recursos de administración para congregaciones. La plataforma se provee \"tal cual\" y recibe continuas optimizaciones. La inclusión de nuevas herramientas se regirá de igual manera bajo estos términos."
      },
      {
        h2: "3. Registro y Seguridad",
        body: "Se requiere de una cuenta autorizada para operar el ecosistema. Usted asume responsabilidad absoluta por la custodia de sus claves. MillionsNest declina reclamos derivados de vulnerabilidades de contraseña personales."
      },
      {
        h2: "4. Planes e Inversión",
        body: "Su permanencia Pro requiere renovar cobros mensuales o anuales prepagados. No emitimos devoluciones de flujos de cobro en uso parcial. Modificaciones tarifarias se anunciarán con mínimo 30 días de antelación."
      },
      {
        h2: "5. Pruebas Libres (Trial)",
        body: "Suministramos un periodo inicial de prueba de 7 días. De no mediar suspensión en este ciclo, el sistema procederá con la contratación de manera regular."
      },
      {
        h2: "6. Patentes de Propiedad",
        body: "Fuentes de código, marcos de diseño, algoritmos y material gráfico del ecosistema constituyen propiedad reservada de MillionsNest. Licenciamos su explotación con fines exclusivos del ministerio sin facultad de reventa."
      },
      {
        h2: "7. Datos e Historial de Usuario",
        body: "Usted retiene propiedad intelectual sobre sus agendas y listas. Al registrar o editar metadatos o acordes de carácter público, nos confiere derecho de anonimizar canciones para enriquecer la base global."
      },
      {
        h2: "8. Estatuto de Privacidad",
        body: "Procesamos la información en completa concordancia con leyes vigentes de datos (LGPD, etc.). Estudie nuestra Política de Privacidad para más explicaciones."
      },
      {
        h2: "9. Cláusula de Limitación",
        body: "Sustentado en leyes aplicables, MillionsNest y sus redes de servidores no responderán por caídas incidentales del sistema informático o interrupciones de conectividad."
      },
      {
        h2: "10. Ajustes de Términos",
        body: "Nos facultamos de acomodar estos estatutos. Cambios sustanciales de servicio o fianza de datos se comunicarán adecuadamente por correo."
      },
      {
        h2: "11. Canales de Enlace",
        body: "Para despejar dudas relacionadas, emplee los sistemas oficiales de chat dentro de la aplicación."
      }
    ]
  }
};

export function Terms() {
  const { i18n } = useTranslation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const locale = (i18n.language || "pt").split("-")[0];
  const activeContent = contentMap[locale] || contentMap.pt;

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
              {activeContent.tag}
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight mb-4">
              {activeContent.title}
            </h1>
            <p className="text-lg text-[#A0A7B5]">
              {activeContent.updatedAt}
            </p>
          </motion.div>

          <motion.article 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="prose prose-lg prose-invert prose-headings:text-[#F5F7FA] prose-a:text-[#2B85EB] hover:prose-a:text-[#2B85EB]/80 prose-p:text-[#A0A7B5] prose-strong:text-[#F5F7FA] max-w-none"
          >
            {activeContent.sections.map((sect, idx) => (
              <div key={idx} className="mb-8">
                <h2 className="text-2xl font-semibold text-[#F5F7FA] mt-6 mb-3">{sect.h2}</h2>
                <p className="text-[#A0A7B5] leading-relaxed">{sect.body}</p>
              </div>
            ))}
          </motion.article>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
