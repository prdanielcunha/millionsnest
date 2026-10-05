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
    title: "Termos de Uso",
    tag: "Legal · Termos",
    updatedAt: "Última atualização: 5 de outubro de 2026",
    intro: "Estes Termos regulam o uso dos sites, aplicativos, APIs e integrações da MillionsNest, incluindo MusicScale, MillionsNest Hub, MillionsNest Connect e demais produtos do ecossistema.",
    sections: [
      {
        h2: "1. Aceitação e elegibilidade",
        body: "Ao acessar ou utilizar os Serviços, você concorda com estes Termos e com as políticas aplicáveis. Quando utiliza os Serviços em nome de uma organização, igreja, ministério ou empresa, você declara possuir autorização suficiente para agir em nome dessa organização."
      },
      {
        h2: "2. Estrutura do ecossistema",
        body: "A MillionsNest oferece aplicativos especializados que compartilham identidade, organizações e determinados serviços de plataforma. O Hub governa identidade, memberships, permissões, acesso e faturamento; cada aplicativo mantém suas próprias regras de negócio; e o MillionsNest Connect fornece comunicação, atendimento, automações e integração segura entre canais e aplicativos autorizados."
      },
      {
        h2: "3. Conta, organização e segurança",
        body: "Você é responsável por manter o acesso à sua conta protegido, usar informações verdadeiras e manter os membros e permissões da sua organização atualizados. Contas, tokens, links de convite e credenciais não devem ser compartilhados de forma que contorne controles de acesso ou permita uso indevido."
      },
      {
        h2: "4. Conteúdo e dados da organização",
        body: "Você mantém os direitos que possuir sobre os dados e conteúdos que inserir nos Serviços. Você concede à MillionsNest as permissões técnicas necessárias para armazenar, processar, transmitir e exibir esse conteúdo exclusivamente para operar os Serviços, executar solicitações autorizadas, manter segurança e cumprir obrigações legais."
      },
      {
        h2: "5. Uso do MillionsNest Connect e canais de mensagem",
        body: "Ao conectar WhatsApp ou outro canal ao MillionsNest Connect, a organização deve possuir autorização para operar esse canal e cumprir as regras do respectivo provedor. O Connect não deve ser usado para scraping, automação não autorizada, envio abusivo, spam ou comunicação que viole consentimentos, opt-out, janelas de atendimento, templates, políticas de conteúdo ou demais regras aplicáveis da Meta/WhatsApp ou de outros provedores."
      },
      {
        h2: "6. Mensagens, consentimento e templates",
        body: "A organização é responsável por assegurar base adequada para iniciar comunicações e respeitar pedidos de interrupção. Mensagens iniciadas pela empresa podem depender de templates aprovados, categorias e regras de cobrança definidas pelo provedor do canal. A MillionsNest poderá bloquear ou limitar automações quando necessário para preservar segurança, conformidade, reputação do canal ou integridade do serviço."
      },
      {
        h2: "7. Inteligência artificial e automações",
        body: "Recursos de IA e automação podem sugerir textos, classificar solicitações, resumir conversas ou executar ações autorizadas. Sugestões de IA devem ser revisadas quando o contexto exigir julgamento humano. Ações de maior risco podem exigir confirmação. A MillionsNest não garante que uma saída gerada por IA seja sempre completa, correta ou adequada a todos os contextos."
      },
      {
        h2: "8. Assinaturas, testes e pagamentos",
        body: "Planos, limites, período de teste, preços e condições de cobrança são aqueles exibidos na fonte de verdade vigente no momento da contratação. Pagamentos podem ser processados por provedores especializados. Alterações relevantes de preço ou condições serão tratadas conforme a legislação aplicável e os termos comerciais apresentados ao cliente."
      },
      {
        h2: "9. Propriedade intelectual",
        body: "O software, código, design, marcas, arquitetura, documentação e demais ativos próprios da MillionsNest permanecem de propriedade de seus respectivos titulares. O usuário recebe uma licença limitada, revogável, não exclusiva e não transferível para usar os Serviços conforme estes Termos e o plano contratado."
      },
      {
        h2: "10. Uso aceitável",
        body: "É proibido tentar invadir, explorar vulnerabilidades, contornar limites ou permissões, acessar dados de outra organização sem autorização, interferir na disponibilidade do serviço, introduzir malware, usar os Serviços para atividade ilegal, violar direitos de terceiros ou automatizar canais de forma proibida por seus provedores."
      },
      {
        h2: "11. Disponibilidade e mudanças no serviço",
        body: "A MillionsNest trabalha para manter os Serviços disponíveis e seguros, mas não garante operação ininterrupta. Funcionalidades podem evoluir, ser substituídas, suspensas ou ajustadas por razões técnicas, legais, de segurança, custo ou políticas de terceiros. Sempre que razoável, mudanças materiais serão comunicadas aos usuários afetados."
      },
      {
        h2: "12. Privacidade e proteção de dados",
        body: "O tratamento de dados pessoais é descrito na Política de Privacidade da MillionsNest. Ao utilizar integrações como WhatsApp Business, você também está sujeito aos termos e políticas do provedor do canal. A organização deve utilizar dados pessoais apenas para finalidades legítimas e compatíveis com suas autorizações."
      },
      {
        h2: "13. Suspensão e encerramento",
        body: "A MillionsNest poderá restringir ou suspender acesso em caso de risco de segurança, fraude, abuso, violação material destes Termos, obrigação legal ou violação de políticas de provedores essenciais. O usuário pode encerrar sua conta ou solicitar exclusão de dados conforme os fluxos disponibilizados e a legislação aplicável."
      },
      {
        h2: "14. Limitação de responsabilidade",
        body: "Na extensão permitida pela legislação aplicável, a MillionsNest não responde por perdas indiretas ou consequenciais decorrentes de falhas fora de seu controle razoável, indisponibilidade de terceiros, uso indevido por usuários ou decisões tomadas exclusivamente com base em sugestões automatizadas."
      },
      {
        h2: "15. Alterações e contato",
        body: "Podemos atualizar estes Termos para refletir mudanças de produto, integração, segurança ou exigências legais. A versão pública vigente permanecerá disponível nesta página. Dúvidas podem ser encaminhadas pelos canais oficiais de suporte da MillionsNest."
      }
    ]
  },
  en: {
    title: "Terms of Use",
    tag: "Legal · Terms",
    updatedAt: "Last updated: October 5, 2026",
    intro: "These Terms govern use of MillionsNest websites, applications, APIs and integrations, including MusicScale, MillionsNest Hub, MillionsNest Connect and other ecosystem products.",
    sections: [
      {
        h2: "1. Acceptance and eligibility",
        body: "By accessing or using the Services, you agree to these Terms and applicable policies. If you use the Services on behalf of an organization, church, ministry or business, you represent that you have sufficient authority to act for that organization."
      },
      {
        h2: "2. Ecosystem structure",
        body: "MillionsNest provides specialized applications that share identity, organization and selected platform services. Hub governs identity, memberships, permissions, access and billing; each application keeps its own business rules; and MillionsNest Connect provides communication, support, automations and secure integration between channels and authorized applications."
      },
      {
        h2: "3. Accounts, organizations and security",
        body: "You are responsible for protecting your account, providing accurate information and keeping organization members and permissions current. Accounts, tokens, invitation links and credentials must not be shared in ways that bypass access controls or enable misuse."
      },
      {
        h2: "4. Organization content and data",
        body: "You retain the rights you hold in data and content submitted to the Services. You grant MillionsNest the technical permissions necessary to store, process, transmit and display that content solely to operate the Services, perform authorized requests, maintain security and comply with legal obligations."
      },
      {
        h2: "5. MillionsNest Connect and messaging channels",
        body: "When connecting WhatsApp or another channel to MillionsNest Connect, the organization must be authorized to operate that channel and comply with the channel provider's rules. Connect must not be used for scraping, unauthorized automation, abusive sending, spam, or communications that violate consent, opt-out, service windows, templates, content policies or other applicable Meta/WhatsApp or provider requirements."
      },
      {
        h2: "6. Messages, consent and templates",
        body: "The organization is responsible for having an appropriate basis to initiate communications and for honoring opt-out requests. Business-initiated messages may depend on approved templates, categories and pricing rules established by the channel provider. MillionsNest may block or limit automations when necessary to protect security, compliance, channel reputation or service integrity."
      },
      {
        h2: "7. Artificial intelligence and automations",
        body: "AI and automation features may suggest text, classify requests, summarize conversations or execute authorized actions. AI suggestions should be reviewed when context requires human judgment. Higher-risk actions may require confirmation. MillionsNest does not guarantee that AI-generated output will always be complete, correct or suitable for every context."
      },
      {
        h2: "8. Subscriptions, trials and payments",
        body: "Plans, limits, trial periods, prices and billing conditions are those displayed by the current source of truth at the time of purchase. Payments may be processed by specialized providers. Material pricing or commercial changes will be handled under applicable law and the terms presented to the customer."
      },
      {
        h2: "9. Intellectual property",
        body: "MillionsNest software, code, design, brands, architecture, documentation and proprietary assets remain the property of their respective owners. Users receive a limited, revocable, non-exclusive and non-transferable license to use the Services under these Terms and their subscribed plan."
      },
      {
        h2: "10. Acceptable use",
        body: "You may not attempt to breach security, exploit vulnerabilities, bypass limits or permissions, access another organization's data without authorization, interfere with service availability, introduce malware, use the Services for unlawful activity, infringe third-party rights or automate channels in ways prohibited by their providers."
      },
      {
        h2: "11. Availability and service changes",
        body: "MillionsNest works to keep the Services available and secure but does not guarantee uninterrupted operation. Features may evolve, be replaced, suspended or adjusted for technical, legal, security, cost or third-party policy reasons. Where reasonable, material changes will be communicated to affected users."
      },
      {
        h2: "12. Privacy and data protection",
        body: "Personal data processing is described in the MillionsNest Privacy Policy. When using integrations such as WhatsApp Business, you are also subject to the channel provider's terms and policies. Organizations must use personal data only for legitimate purposes compatible with their authorizations."
      },
      {
        h2: "13. Suspension and termination",
        body: "MillionsNest may restrict or suspend access in cases involving security risk, fraud, abuse, material violation of these Terms, legal obligations or violations of essential provider policies. Users may close their account or request deletion according to available flows and applicable law."
      },
      {
        h2: "14. Limitation of liability",
        body: "To the extent permitted by applicable law, MillionsNest is not liable for indirect or consequential losses arising from failures outside its reasonable control, third-party outages, user misuse or decisions made solely on automated suggestions."
      },
      {
        h2: "15. Changes and contact",
        body: "We may update these Terms to reflect product, integration, security or legal changes. The current public version will remain available on this page. Questions may be sent through official MillionsNest support channels."
      }
    ]
  },
  es: {
    title: "Términos de Uso",
    tag: "Legal · Términos",
    updatedAt: "Última actualización: 5 de octubre de 2026",
    intro: "Estos Términos regulan el uso de sitios, aplicaciones, APIs e integraciones de MillionsNest, incluyendo MusicScale, MillionsNest Hub, MillionsNest Connect y otros productos del ecosistema.",
    sections: [
      {
        h2: "1. Aceptación y elegibilidad",
        body: "Al acceder o utilizar los Servicios, usted acepta estos Términos y las políticas aplicables. Si utiliza los Servicios en nombre de una organización, iglesia, ministerio o empresa, declara que posee autoridad suficiente para actuar en nombre de esa organización."
      },
      {
        h2: "2. Estructura del ecosistema",
        body: "MillionsNest ofrece aplicaciones especializadas que comparten identidad, organizaciones y determinados servicios de plataforma. Hub gobierna identidad, membresías, permisos, acceso y facturación; cada aplicación mantiene sus propias reglas de negocio; y MillionsNest Connect proporciona comunicación, soporte, automatizaciones e integración segura entre canales y aplicaciones autorizadas."
      },
      {
        h2: "3. Cuenta, organización y seguridad",
        body: "Usted es responsable de proteger su cuenta, proporcionar información correcta y mantener actualizados los miembros y permisos de su organización. Cuentas, tokens, enlaces de invitación y credenciales no deben compartirse de forma que eluda controles de acceso o permita uso indebido."
      },
      {
        h2: "4. Contenido y datos de la organización",
        body: "Usted conserva los derechos que posea sobre los datos y contenidos enviados a los Servicios. Concede a MillionsNest los permisos técnicos necesarios para almacenar, procesar, transmitir y mostrar ese contenido únicamente para operar los Servicios, ejecutar solicitudes autorizadas, mantener seguridad y cumplir obligaciones legales."
      },
      {
        h2: "5. MillionsNest Connect y canales de mensajería",
        body: "Al conectar WhatsApp u otro canal a MillionsNest Connect, la organización debe estar autorizada para operar ese canal y cumplir las reglas de su proveedor. Connect no debe utilizarse para scraping, automatización no autorizada, envíos abusivos, spam o comunicaciones que violen consentimiento, opt-out, ventanas de servicio, templates, políticas de contenido u otras reglas aplicables de Meta/WhatsApp u otros proveedores."
      },
      {
        h2: "6. Mensajes, consentimiento y templates",
        body: "La organización es responsable de contar con una base adecuada para iniciar comunicaciones y respetar solicitudes de interrupción. Los mensajes iniciados por la empresa pueden depender de templates aprobados, categorías y reglas de cobro establecidas por el proveedor del canal. MillionsNest podrá bloquear o limitar automatizaciones cuando sea necesario para proteger seguridad, cumplimiento, reputación del canal o integridad del servicio."
      },
      {
        h2: "7. Inteligencia artificial y automatizaciones",
        body: "Las funciones de IA y automatización pueden sugerir textos, clasificar solicitudes, resumir conversaciones o ejecutar acciones autorizadas. Las sugerencias de IA deben revisarse cuando el contexto requiera juicio humano. Las acciones de mayor riesgo pueden exigir confirmación. MillionsNest no garantiza que una salida generada por IA sea siempre completa, correcta o adecuada para cada contexto."
      },
      {
        h2: "8. Suscripciones, pruebas y pagos",
        body: "Planes, límites, períodos de prueba, precios y condiciones de cobro son los mostrados por la fuente de verdad vigente al momento de la contratación. Los pagos pueden ser procesados por proveedores especializados. Los cambios materiales de precio o condiciones comerciales se manejarán conforme a la legislación aplicable y a los términos presentados al cliente."
      },
      {
        h2: "9. Propiedad intelectual",
        body: "El software, código, diseño, marcas, arquitectura, documentación y otros activos propios de MillionsNest permanecen bajo propiedad de sus respectivos titulares. El usuario recibe una licencia limitada, revocable, no exclusiva e intransferible para usar los Servicios conforme a estos Términos y al plan contratado."
      },
      {
        h2: "10. Uso aceptable",
        body: "Está prohibido intentar vulnerar la seguridad, explotar fallas, eludir límites o permisos, acceder sin autorización a datos de otra organización, interferir con la disponibilidad, introducir malware, utilizar los Servicios para actividades ilegales, infringir derechos de terceros o automatizar canales de formas prohibidas por sus proveedores."
      },
      {
        h2: "11. Disponibilidad y cambios",
        body: "MillionsNest trabaja para mantener los Servicios disponibles y seguros, pero no garantiza operación ininterrumpida. Las funciones pueden evolucionar, ser reemplazadas, suspendidas o ajustadas por razones técnicas, legales, de seguridad, costo o políticas de terceros. Cuando sea razonable, los cambios materiales serán comunicados a los usuarios afectados."
      },
      {
        h2: "12. Privacidad y protección de datos",
        body: "El tratamiento de datos personales se describe en la Política de Privacidad de MillionsNest. Al utilizar integraciones como WhatsApp Business, usted también está sujeto a los términos y políticas del proveedor del canal. La organización debe utilizar datos personales únicamente para fines legítimos y compatibles con sus autorizaciones."
      },
      {
        h2: "13. Suspensión y terminación",
        body: "MillionsNest podrá restringir o suspender acceso ante riesgo de seguridad, fraude, abuso, incumplimiento material de estos Términos, obligación legal o violación de políticas de proveedores esenciales. El usuario puede cerrar su cuenta o solicitar eliminación de datos conforme a los flujos disponibles y la legislación aplicable."
      },
      {
        h2: "14. Limitación de responsabilidad",
        body: "En la medida permitida por la legislación aplicable, MillionsNest no responde por pérdidas indirectas o consecuenciales derivadas de fallas fuera de su control razonable, indisponibilidad de terceros, uso indebido por usuarios o decisiones tomadas exclusivamente con base en sugerencias automatizadas."
      },
      {
        h2: "15. Cambios y contacto",
        body: "Podemos actualizar estos Términos para reflejar cambios de producto, integración, seguridad o exigencias legales. La versión pública vigente permanecerá disponible en esta página. Las consultas pueden enviarse mediante los canales oficiales de soporte de MillionsNest."
      }
    ]
  }
};

export function Terms() {
  const { i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Terms of Use | MillionsNest";
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
