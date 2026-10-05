import React, { useEffect } from "react";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface TranslationBlock {
  title: string;
  tag: string;
  updatedAt: string;
  intro: string;
  sections: {
    h2: string;
    body: string | React.ReactNode;
  }[];
}

const contentMap: Record<string, TranslationBlock> = {
  pt: {
    title: "Política de Privacidade",
    tag: "Legal · Privacidade",
    updatedAt: "Última atualização: 5 de outubro de 2026",
    intro: "Esta Política explica como a MillionsNest trata dados pessoais no Hub e nos aplicativos do ecossistema, incluindo MusicScale e MillionsNest Connect, inclusive quando o Connect opera por canais oficiais como a Plataforma do WhatsApp Business.",
    sections: [
      {
        h2: "1. Quem somos e alcance desta Política",
        body: "A MillionsNest oferece um ecossistema de software como serviço para organizações e equipes. Esta Política se aplica aos sites, aplicativos, APIs, integrações e canais oficiais operados pela MillionsNest. Cada aplicativo mantém seu próprio domínio funcional, enquanto o MillionsNest Hub governa identidade, organizações, permissões e acesso, e o MillionsNest Connect atua como camada de comunicação entre pessoas, canais e os aplicativos autorizados."
      },
      {
        h2: "2. Dados que podemos tratar",
        body: "Conforme o recurso utilizado, podemos tratar dados de cadastro e identidade (como nome, e-mail, telefone e identificadores de conta), vínculo com organizações e funções, dados operacionais inseridos pelos usuários, informações de assinatura e cobrança processadas por provedores especializados, dados técnicos de acesso e segurança (como IP, dispositivo, sessão e registros de auditoria) e dados necessários para comunicações em canais conectados."
      },
      {
        h2: "3. WhatsApp Business e MillionsNest Connect",
        body: "Quando uma organização habilita o WhatsApp no MillionsNest Connect, podemos tratar identificadores do canal, número de telefone, conteúdo e metadados das mensagens necessárias para entregar a conversa, status de entrega e leitura quando disponibilizados pela Meta, e referências de mídia quando aplicável. Esses dados são usados para receber e responder mensagens, resolver identidade e organização, executar ações autorizadas, prestar suporte, manter histórico e auditoria e proteger o serviço. O Connect utiliza integrações oficiais da Meta e não depende de scraping ou automação não autorizada do WhatsApp Web."
      },
      {
        h2: "4. Fontes pessoais e dados importados",
        body: "Quando o usuário optar por importar fontes pessoais permitidas, como uma exportação oficial de conversa do WhatsApp, esse conteúdo deve permanecer separado do contexto organizacional por padrão e vinculado ao proprietário da fonte. Importações pessoais não transformam automaticamente participantes em leads ou contatos comerciais, e o histórico bruto não deve ser exposto a outros membros da organização sem base e autorização adequadas."
      },
      {
        h2: "5. Finalidades do tratamento",
        body: "Tratamos dados para prestar e manter os Serviços; autenticar usuários; aplicar permissões e isolamento entre organizações; entregar funcionalidades solicitadas; processar cobranças; receber e responder comunicações; executar automações autorizadas; prestar suporte; prevenir fraude, abuso e incidentes; medir desempenho e confiabilidade; cumprir obrigações legais; e melhorar produtos de forma compatível com esta Política."
      },
      {
        h2: "6. Dados sensíveis e contexto religioso",
        body: "Alguns clientes da MillionsNest são igrejas e ministérios, e determinados dados podem revelar ou sugerir informações sensíveis, inclusive convicção religiosa. A MillionsNest adota uma postura conservadora para esse tipo de dado. Conteúdo de grupos, conversas ou fontes pessoais não deve ser usado para criar segmentação comercial automática baseada em crença, filiação religiosa ou outros atributos sensíveis."
      },
      {
        h2: "7. Compartilhamento e operadores",
        body: "A MillionsNest não vende dados pessoais. Podemos compartilhar os dados estritamente necessários com provedores que dão suporte à operação dos Serviços, como infraestrutura em nuvem, autenticação, pagamentos, comunicação e, quando habilitado, provedores de inteligência artificial. Exemplos incluem Google Cloud/Firebase, Stripe e Meta/WhatsApp, conforme o recurso utilizado. Também poderemos compartilhar dados quando houver obrigação legal, ordem válida de autoridade competente ou necessidade de proteger direitos e segurança."
      },
      {
        h2: "8. Inteligência artificial",
        body: "Recursos de IA são complementares e não são necessários para todo o funcionamento do ecossistema. Quando um recurso de IA autorizado for utilizado, a MillionsNest busca minimizar os dados enviados, manter credenciais apenas no servidor e limitar o contexto ao necessário para a tarefa. Dados pessoais ou sensíveis não devem ser enviados a provedores externos sem base, política e configuração adequadas."
      },
      {
        h2: "9. Segurança e isolamento",
        body: "Aplicamos controles de acesso, autenticação, autorização por função e capacidade, isolamento multi-tenant, criptografia em trânsito, armazenamento protegido, auditoria e validações server-side. Registros técnicos e de auditoria procuram evitar a inclusão desnecessária de conteúdo completo de mensagens ou outros dados pessoais."
      },
      {
        h2: "10. Retenção",
        body: "Mantemos os dados pelo período necessário para prestar os Serviços, atender às finalidades informadas, preservar segurança e auditoria e cumprir obrigações legais ou contratuais. Prazos podem variar conforme o tipo de dado e o produto. Quando uma exclusão válida é concluída, os dados deixam os ambientes ativos conforme o fluxo aplicável, ressalvados registros que precisem ser mantidos por obrigação legal, prevenção a fraude, resolução de disputas ou ciclos limitados de backup."
      },
      {
        h2: "11. Seus direitos e exclusão de dados",
        body: "Nos termos da legislação aplicável, inclusive a LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, informação sobre compartilhamento, revisão de consentimento quando aplicável e exclusão de dados nos casos previstos em lei. Para instruções específicas de exclusão, acesse https://www.millionsnest.com/data-deletion. Solicitações podem exigir verificação de identidade para evitar exclusão ou exposição indevida de dados."
      },
      {
        h2: "12. Alterações desta Política e contato",
        body: "Podemos atualizar esta Política para refletir mudanças de produto, segurança, integrações ou requisitos legais. A versão pública mais recente permanece disponível nesta página. Para dúvidas de privacidade ou solicitações relacionadas a dados, utilize os canais oficiais de suporte da MillionsNest disponibilizados no produto ou no site."
      }
    ]
  },
  en: {
    title: "Privacy Policy",
    tag: "Legal · Privacy",
    updatedAt: "Last updated: October 5, 2026",
    intro: "This Policy explains how MillionsNest processes personal data across the Hub and ecosystem applications, including MusicScale and MillionsNest Connect, including when Connect operates through official channels such as the WhatsApp Business Platform.",
    sections: [
      {
        h2: "1. Who we are and scope",
        body: "MillionsNest provides a software-as-a-service ecosystem for organizations and teams. This Policy applies to websites, applications, APIs, integrations and official channels operated by MillionsNest. Each application remains responsible for its own business domain, while MillionsNest Hub governs identity, organizations, permissions and access, and MillionsNest Connect acts as a communication layer between people, channels and authorized applications."
      },
      {
        h2: "2. Data we may process",
        body: "Depending on the feature used, we may process account and identity data (such as name, email, phone number and account identifiers), organization membership and roles, operational data submitted by users, subscription and billing information handled by specialized providers, technical access and security data (such as IP address, device, session and audit records), and data required to operate connected communication channels."
      },
      {
        h2: "3. WhatsApp Business and MillionsNest Connect",
        body: "When an organization enables WhatsApp in MillionsNest Connect, we may process channel identifiers, phone numbers, message content and metadata required to deliver the conversation, delivery and read status when provided by Meta, and media references when applicable. We use this data to receive and reply to messages, resolve identity and organization context, perform authorized actions, provide support, preserve conversation history and audit events, and protect the service. Connect uses Meta's official integrations and does not rely on scraping or unauthorized WhatsApp Web automation."
      },
      {
        h2: "4. Personal sources and imported data",
        body: "When a user chooses to import a permitted personal source, such as an official WhatsApp chat export, that content is designed to remain separated from organizational context by default and scoped to the source owner. Personal imports do not automatically convert participants into commercial leads, and raw personal history should not be exposed to other organization members without an appropriate basis and authorization."
      },
      {
        h2: "5. Purposes of processing",
        body: "We process data to provide and maintain the Services; authenticate users; enforce permissions and tenant isolation; deliver requested features; process billing; receive and respond to communications; execute authorized automations; provide support; prevent fraud, abuse and incidents; measure performance and reliability; comply with legal obligations; and improve products consistently with this Policy."
      },
      {
        h2: "6. Sensitive data and religious context",
        body: "Some MillionsNest customers are churches and ministries, and certain information may reveal or suggest sensitive characteristics, including religious beliefs. MillionsNest takes a conservative approach to this data. Group history, conversations or personal sources should not be used to create automated commercial targeting based on belief, religious affiliation or other sensitive attributes."
      },
      {
        h2: "7. Sharing and service providers",
        body: "MillionsNest does not sell personal data. We may share only the data necessary with providers that support the Services, including cloud infrastructure, authentication, payments, communications and, when enabled, artificial intelligence providers. Examples include Google Cloud/Firebase, Stripe and Meta/WhatsApp, depending on the feature used. We may also disclose data when required by law, valid authority requests, or to protect rights and security."
      },
      {
        h2: "8. Artificial intelligence",
        body: "AI features are supplemental and are not required for every core function. When an authorized AI feature is used, MillionsNest seeks to minimize the data transmitted, keep credentials server-side and limit context to what is required for the task. Personal or sensitive data should not be sent to external providers without an appropriate basis, policy and configuration."
      },
      {
        h2: "9. Security and isolation",
        body: "We apply access controls, authentication, role- and capability-based authorization, multi-tenant isolation, encryption in transit, protected storage, audit controls and server-side validation. Technical and audit logs are designed to avoid unnecessary inclusion of full message bodies or other personal data."
      },
      {
        h2: "10. Retention",
        body: "We retain data for as long as necessary to provide the Services, meet the purposes described here, preserve security and auditability, and comply with legal or contractual obligations. Retention may vary by data type and product. When a valid deletion is completed, data is removed from active systems according to the applicable flow, except where limited retention is required by law, fraud prevention, dispute resolution or backup cycles."
      },
      {
        h2: "11. Your rights and data deletion",
        body: "Subject to applicable law, users may request confirmation of processing, access, correction, information about sharing, withdrawal of consent where applicable, and deletion when legally available. For specific deletion instructions, visit https://www.millionsnest.com/data-deletion. We may verify identity before acting on a request to prevent unauthorized deletion or disclosure."
      },
      {
        h2: "12. Changes and contact",
        body: "We may update this Policy to reflect product, security, integration or legal changes. The latest public version remains available on this page. For privacy questions or data requests, use the official MillionsNest support channels available in the product or website."
      }
    ]
  },
  es: {
    title: "Política de Privacidad",
    tag: "Legal · Privacidad",
    updatedAt: "Última actualización: 5 de octubre de 2026",
    intro: "Esta Política explica cómo MillionsNest trata datos personales en el Hub y en las aplicaciones del ecosistema, incluyendo MusicScale y MillionsNest Connect, incluso cuando Connect opera mediante canales oficiales como la Plataforma de WhatsApp Business.",
    sections: [
      {
        h2: "1. Quiénes somos y alcance",
        body: "MillionsNest ofrece un ecosistema de software como servicio para organizaciones y equipos. Esta Política se aplica a sitios, aplicaciones, APIs, integraciones y canales oficiales operados por MillionsNest. Cada aplicación conserva su propio dominio funcional, mientras MillionsNest Hub gobierna identidad, organizaciones, permisos y acceso, y MillionsNest Connect actúa como capa de comunicación entre personas, canales y aplicaciones autorizadas."
      },
      {
        h2: "2. Datos que podemos tratar",
        body: "Según la función utilizada, podemos tratar datos de cuenta e identidad (como nombre, correo, teléfono e identificadores), vínculos y roles de organización, datos operativos enviados por usuarios, información de suscripción y cobro procesada por proveedores especializados, datos técnicos de acceso y seguridad (como IP, dispositivo, sesión y auditoría) y datos necesarios para operar canales de comunicación conectados."
      },
      {
        h2: "3. WhatsApp Business y MillionsNest Connect",
        body: "Cuando una organización habilita WhatsApp en MillionsNest Connect, podemos tratar identificadores del canal, números de teléfono, contenido y metadatos de mensajes necesarios para entregar la conversación, estados de entrega y lectura cuando Meta los proporciona y referencias de medios cuando corresponda. Usamos estos datos para recibir y responder mensajes, resolver identidad y organización, ejecutar acciones autorizadas, brindar soporte, conservar historial y auditoría y proteger el servicio. Connect usa integraciones oficiales de Meta y no depende de scraping ni automatización no autorizada de WhatsApp Web."
      },
      {
        h2: "4. Fuentes personales e importaciones",
        body: "Cuando un usuario decide importar una fuente personal permitida, como una exportación oficial de chat de WhatsApp, el contenido está diseñado para permanecer separado del contexto organizacional por defecto y vinculado al propietario de la fuente. Las importaciones personales no convierten automáticamente participantes en leads comerciales y el historial personal bruto no debe exponerse a otros miembros sin base y autorización adecuadas."
      },
      {
        h2: "5. Finalidades",
        body: "Tratamos datos para prestar y mantener los Servicios; autenticar usuarios; aplicar permisos y aislamiento entre organizaciones; entregar funciones solicitadas; procesar cobros; recibir y responder comunicaciones; ejecutar automatizaciones autorizadas; brindar soporte; prevenir fraude, abuso e incidentes; medir rendimiento y confiabilidad; cumplir obligaciones legales; y mejorar productos de forma compatible con esta Política."
      },
      {
        h2: "6. Datos sensibles y contexto religioso",
        body: "Algunos clientes de MillionsNest son iglesias y ministerios, y determinada información puede revelar o sugerir datos sensibles, incluidas creencias religiosas. MillionsNest adopta una postura conservadora respecto de esta información. Historiales de grupos, conversaciones o fuentes personales no deben utilizarse para crear segmentación comercial automática basada en creencia, afiliación religiosa u otros atributos sensibles."
      },
      {
        h2: "7. Compartición y proveedores",
        body: "MillionsNest no vende datos personales. Podemos compartir únicamente los datos necesarios con proveedores que soportan los Servicios, como infraestructura en la nube, autenticación, pagos, comunicación y, cuando esté habilitada, inteligencia artificial. Algunos ejemplos son Google Cloud/Firebase, Stripe y Meta/WhatsApp, según la función utilizada. También podremos divulgar información cuando exista obligación legal, requerimiento válido de autoridad o necesidad de proteger derechos y seguridad."
      },
      {
        h2: "8. Inteligencia artificial",
        body: "Las funciones de IA son complementarias y no son necesarias para todas las funciones centrales. Cuando se utiliza una función de IA autorizada, MillionsNest procura minimizar los datos enviados, mantener credenciales en el servidor y limitar el contexto a lo necesario para la tarea. Los datos personales o sensibles no deben enviarse a proveedores externos sin una base, política y configuración adecuadas."
      },
      {
        h2: "9. Seguridad y aislamiento",
        body: "Aplicamos controles de acceso, autenticación, autorización por rol y capacidad, aislamiento multi-tenant, cifrado en tránsito, almacenamiento protegido, auditoría y validaciones del lado del servidor. Los registros técnicos y de auditoría están diseñados para evitar la inclusión innecesaria del contenido completo de mensajes u otros datos personales."
      },
      {
        h2: "10. Retención",
        body: "Conservamos datos durante el tiempo necesario para prestar los Servicios, cumplir las finalidades descritas, preservar seguridad y auditoría y atender obligaciones legales o contractuales. Los plazos pueden variar según el tipo de dato y producto. Cuando se completa una eliminación válida, los datos se retiran de los sistemas activos según el flujo aplicable, salvo retención limitada exigida por ley, prevención de fraude, resolución de disputas o ciclos de respaldo."
      },
      {
        h2: "11. Derechos y eliminación de datos",
        body: "Conforme a la legislación aplicable, los titulares pueden solicitar confirmación de tratamiento, acceso, corrección, información sobre compartición, retiro del consentimiento cuando corresponda y eliminación cuando legalmente proceda. Para instrucciones específicas, visite https://www.millionsnest.com/data-deletion. Podemos verificar la identidad antes de procesar una solicitud para evitar eliminaciones o divulgaciones no autorizadas."
      },
      {
        h2: "12. Cambios y contacto",
        body: "Podemos actualizar esta Política para reflejar cambios de producto, seguridad, integración o requisitos legales. La versión pública más reciente permanecerá disponible en esta página. Para dudas de privacidad o solicitudes de datos, utilice los canales oficiales de soporte de MillionsNest disponibles en el producto o sitio."
      }
    ]
  }
};

export function Privacy() {
  const { i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy | MillionsNest";
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
            <p className="text-lg text-[#A0A7B5]">{activeContent.updatedAt}</p>
            <p className="mt-6 text-base md:text-lg text-[#C5CBD6] leading-relaxed max-w-3xl">
              {activeContent.intro}
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
                <p className="text-[#A0A7B5] leading-relaxed whitespace-pre-line">{sect.body}</p>
              </div>
            ))}
          </motion.article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
