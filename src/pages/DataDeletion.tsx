import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Trash2, UserCheck, Clock3 } from "lucide-react";

type LocaleContent = {
  title: string;
  tag: string;
  updatedAt: string;
  intro: string;
  stepsTitle: string;
  steps: { title: string; body: string }[];
  scopeTitle: string;
  scope: string[];
  retentionTitle: string;
  retention: string;
  whatsappTitle: string;
  whatsapp: string;
  verifyTitle: string;
  verify: string;
  footerNote: string;
  privacyLabel: string;
};

const contentMap: Record<string, LocaleContent> = {
  pt: {
    title: "Exclusão de Dados",
    tag: "Legal · Privacidade",
    updatedAt: "Última atualização: 5 de outubro de 2026",
    intro: "Você pode solicitar a exclusão de dados pessoais tratados pela MillionsNest. Esta página descreve o caminho oficial para solicitações relacionadas ao Hub, MusicScale, MillionsNest Connect e demais aplicativos do ecossistema.",
    stepsTitle: "Como solicitar a exclusão",
    steps: [
      {
        title: "1. Pela sua conta",
        body: "Se você ainda consegue acessar a MillionsNest, abra os canais oficiais de suporte dentro do produto e informe que deseja solicitar exclusão de dados. Indique a conta e a organização relacionadas ao pedido."
      },
      {
        title: "2. Sem acesso à conta",
        body: "Se você não consegue entrar, use o canal de Contato disponível no rodapé público do site MillionsNest e informe que o assunto é “Exclusão de dados”. Para sua segurança, não envie senhas, tokens, códigos de autenticação ou segredos de API."
      },
      {
        title: "3. Verificação",
        body: "Podemos solicitar informações adicionais para confirmar que você é o titular dos dados ou possui autoridade para agir pela organização. Essa verificação evita exclusões indevidas ou exposição de dados de terceiros."
      },
      {
        title: "4. Conclusão",
        body: "Após a validação, a solicitação será tratada conforme a legislação aplicável e o escopo dos dados. Informaremos quando a ação principal estiver concluída ou quando houver alguma obrigação legítima de retenção."
      }
    ],
    scopeTitle: "O que pode ser incluído na exclusão",
    scope: [
      "dados de perfil e identidade mantidos pela MillionsNest, quando legalmente elegíveis para exclusão;",
      "vínculos e preferências associadas à conta;",
      "dados pessoais armazenados em módulos e aplicativos do ecossistema, conforme permissões e responsabilidade da organização;",
      "identificadores e dados de canal do MillionsNest Connect, inclusive vínculos com WhatsApp, quando aplicável;",
      "fontes pessoais importadas pelo próprio usuário e seus derivados, conforme o fluxo do recurso."
    ],
    retentionTitle: "O que pode precisar ser mantido",
    retention: "Determinados registros podem ser preservados por período limitado quando necessários para cumprir obrigação legal ou contratual, proteger segurança e antifraude, resolver disputas, manter integridade de auditoria ou completar ciclos técnicos de backup. Nesses casos, o uso permanece restrito à finalidade que justificou a retenção.",
    whatsappTitle: "WhatsApp e MillionsNest Connect",
    whatsapp: "Se a solicitação envolver conversas ou identificadores tratados pelo Connect por meio da Plataforma do WhatsApp Business, informe isso no pedido. A exclusão no MillionsNest não apaga automaticamente dados mantidos independentemente pela Meta ou pelo próprio usuário em seu dispositivo; para esses dados, aplicam-se também os controles e políticas do respectivo serviço.",
    verifyTitle: "Proteção contra exclusão indevida",
    verify: "Não processamos pedidos de exclusão baseados apenas em conhecimento público de um número de telefone, nome ou organização. Sempre que necessário, exigimos confirmação suficiente de identidade e escopo antes de remover dados.",
    footerNote: "Para entender como os dados são coletados e utilizados, consulte também a Política de Privacidade da MillionsNest.",
    privacyLabel: "Ver Política de Privacidade"
  },
  en: {
    title: "Data Deletion",
    tag: "Legal · Privacy",
    updatedAt: "Last updated: October 5, 2026",
    intro: "You may request deletion of personal data processed by MillionsNest. This page explains the official path for requests related to Hub, MusicScale, MillionsNest Connect and other ecosystem applications.",
    stepsTitle: "How to request deletion",
    steps: [
      {
        title: "1. From your account",
        body: "If you can still access MillionsNest, open the official support channels inside the product and state that you want to request data deletion. Identify the account and organization related to the request."
      },
      {
        title: "2. Without account access",
        body: "If you cannot sign in, use the Contact channel available in the public MillionsNest website footer and state that the subject is “Data deletion”. For your security, never send passwords, tokens, authentication codes or API secrets."
      },
      {
        title: "3. Verification",
        body: "We may request additional information to confirm that you are the data subject or are authorized to act for the organization. This verification helps prevent unauthorized deletion or disclosure of third-party data."
      },
      {
        title: "4. Completion",
        body: "After validation, the request will be handled under applicable law and the relevant data scope. We will communicate when the primary action is complete or when a legitimate retention obligation applies."
      }
    ],
    scopeTitle: "Data that may be included",
    scope: [
      "profile and identity data held by MillionsNest when legally eligible for deletion;",
      "account-linked memberships and preferences;",
      "personal data stored by ecosystem modules and applications, subject to permissions and organization responsibilities;",
      "MillionsNest Connect channel identifiers and data, including WhatsApp mappings when applicable;",
      "personal sources imported by the user and their derived data, according to the feature's deletion flow."
    ],
    retentionTitle: "Data that may need to be retained",
    retention: "Certain records may be retained for a limited period when necessary to comply with legal or contractual obligations, protect security and fraud prevention, resolve disputes, preserve audit integrity or complete technical backup cycles. In those cases, use remains restricted to the purpose supporting the retention.",
    whatsappTitle: "WhatsApp and MillionsNest Connect",
    whatsapp: "If your request involves conversations or identifiers processed by Connect through the WhatsApp Business Platform, mention this in the request. Deletion from MillionsNest does not automatically delete data independently maintained by Meta or by the user on their device; those records are also subject to the controls and policies of the relevant service.",
    verifyTitle: "Protection against unauthorized deletion",
    verify: "We do not process deletion requests based only on public knowledge of a phone number, name or organization. Where necessary, we require sufficient identity and scope confirmation before removing data.",
    footerNote: "For details on how data is collected and used, also review the MillionsNest Privacy Policy.",
    privacyLabel: "View Privacy Policy"
  },
  es: {
    title: "Eliminación de Datos",
    tag: "Legal · Privacidad",
    updatedAt: "Última actualización: 5 de octubre de 2026",
    intro: "Puede solicitar la eliminación de datos personales tratados por MillionsNest. Esta página explica el camino oficial para solicitudes relacionadas con Hub, MusicScale, MillionsNest Connect y otras aplicaciones del ecosistema.",
    stepsTitle: "Cómo solicitar la eliminación",
    steps: [
      {
        title: "1. Desde su cuenta",
        body: "Si todavía puede acceder a MillionsNest, abra los canales oficiales de soporte dentro del producto e indique que desea solicitar la eliminación de datos. Identifique la cuenta y la organización relacionadas con la solicitud."
      },
      {
        title: "2. Sin acceso a la cuenta",
        body: "Si no puede iniciar sesión, use el canal de Contacto disponible en el pie de página público del sitio MillionsNest e indique que el asunto es “Eliminación de datos”. Por seguridad, no envíe contraseñas, tokens, códigos de autenticación ni secretos de API."
      },
      {
        title: "3. Verificación",
        body: "Podemos solicitar información adicional para confirmar que usted es el titular o que está autorizado para actuar en nombre de la organización. Esta verificación evita eliminaciones indebidas o exposición de datos de terceros."
      },
      {
        title: "4. Finalización",
        body: "Después de la validación, la solicitud se tratará conforme a la legislación aplicable y al alcance de los datos. Informaremos cuando la acción principal se haya completado o cuando exista una obligación legítima de retención."
      }
    ],
    scopeTitle: "Datos que pueden incluirse",
    scope: [
      "datos de perfil e identidad mantenidos por MillionsNest cuando sean legalmente elegibles para eliminación;",
      "vínculos y preferencias asociados a la cuenta;",
      "datos personales almacenados en módulos y aplicaciones del ecosistema, según permisos y responsabilidades de la organización;",
      "identificadores y datos de canal de MillionsNest Connect, incluidos vínculos con WhatsApp cuando corresponda;",
      "fuentes personales importadas por el usuario y sus datos derivados, conforme al flujo de eliminación de la función."
    ],
    retentionTitle: "Datos que pueden requerir retención",
    retention: "Determinados registros pueden conservarse por un período limitado cuando sea necesario para cumplir obligaciones legales o contractuales, proteger seguridad y prevención de fraude, resolver disputas, preservar integridad de auditoría o completar ciclos técnicos de respaldo. En esos casos, el uso permanece restringido a la finalidad que justifica la retención.",
    whatsappTitle: "WhatsApp y MillionsNest Connect",
    whatsapp: "Si la solicitud incluye conversaciones o identificadores tratados por Connect mediante la Plataforma de WhatsApp Business, indíquelo en el pedido. La eliminación en MillionsNest no borra automáticamente datos mantenidos de forma independiente por Meta o por el usuario en su dispositivo; esos registros también están sujetos a los controles y políticas del servicio correspondiente.",
    verifyTitle: "Protección contra eliminación no autorizada",
    verify: "No procesamos solicitudes de eliminación basadas únicamente en conocimiento público de un número de teléfono, nombre u organización. Cuando sea necesario, exigimos confirmación suficiente de identidad y alcance antes de eliminar datos.",
    footerNote: "Para entender cómo se recopilan y utilizan los datos, consulte también la Política de Privacidad de MillionsNest.",
    privacyLabel: "Ver Política de Privacidad"
  }
};

export function DataDeletion() {
  const { i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Data Deletion | MillionsNest";
  }, []);

  const locale = (i18n.language || "pt").split("-")[0];
  const active = contentMap[locale] || contentMap.pt;

  return (
    <div className="min-h-screen font-sans bg-[#050505] text-[#F5F7FA] flex flex-col">
      <Navbar />

      <main className="flex-grow pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#A0A7B5] uppercase tracking-widest mb-6">
              <Trash2 className="w-3.5 h-3.5" />
              {active.tag}
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">{active.title}</h1>
            <p className="text-lg text-[#A0A7B5]">{active.updatedAt}</p>
            <p className="mt-6 text-base md:text-lg text-[#C5CBD6] leading-relaxed max-w-3xl">{active.intro}</p>
          </motion.header>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-5">{active.stepsTitle}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {active.steps.map((step, index) => (
                <motion.article
                  key={step.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * index }}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm leading-6 text-[#A0A7B5]">{step.body}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-[#2B85EB]" />
                <h2 className="text-xl font-semibold">{active.scopeTitle}</h2>
              </div>
              <ul className="space-y-3 text-[#A0A7B5]">
                {active.scope.map((item) => (
                  <li key={item} className="flex gap-3 leading-6">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2B85EB] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-5 h-5 text-[#2B85EB]" />
                <h2 className="text-xl font-semibold">{active.retentionTitle}</h2>
              </div>
              <p className="text-[#A0A7B5] leading-7">{active.retention}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">{active.whatsappTitle}</h2>
              <p className="text-[#A0A7B5] leading-7">{active.whatsapp}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-5 h-5 text-[#2B85EB]" />
                <h2 className="text-xl font-semibold">{active.verifyTitle}</h2>
              </div>
              <p className="text-[#A0A7B5] leading-7">{active.verify}</p>
            </div>

            <div className="rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/[0.06] p-6">
              <p className="text-sm md:text-base text-[#C5CBD6] leading-7">{active.footerNote}</p>
              <Link
                to="/privacy"
                className="inline-flex mt-4 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
              >
                {active.privacyLabel}
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
