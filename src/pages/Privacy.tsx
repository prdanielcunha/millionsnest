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
    title: "Política de Privacidade",
    tag: "Legal",
    updatedAt: "Última atualização: Maio de 2026",
    sections: [
      {
        h2: "1. Nosso Compromisso com a Privacidade",
        body: "A MillionsNest está comprometida em proteger a privacidade dos usuários e as informações pessoais e organizacionais coletadas de ministérios e igrejas através de nosso ecossistema de plataformas SaaS, incluindo o MusicScale e todos os demais aplicativos atuais ou futuros. Esta Política de Privacidade está em total conformidade com a Lei Geral de Proteção de Dados (LGPD - nº 13.709/18)."
      },
      {
        h2: "2. Dados Coletados",
        body: "Podemos coletar e processar dados cadastrais de administradores (nome, e-mail, telefone), dados de membros inseridos pelos administradores (nomes, contatos, tarefas operacionais e escalas), dados parciais de pagamento (processados de forma segura por gateways licenciados como Stripe; não salvamos números de cartão) e dados de navegação/uso (IP, cookies de sessão, logs operacionais)."
      },
      {
        h2: "3. Qual a Finalidade do Tratamento de Dados?",
        body: "Nós utilizamos as informações coletadas para prover, manter e melhorar nosso ecossistema de aplicativos, aprimorar nosso banco de dados mestre de músicas (processando anonimamente cifras e metadados sem revelar detalhes sobre as igrejas ou pessoas vinculadas), garantir a segurança das transações e emitir alertas operacionais ou novidades sobre a assinatura."
      },
      {
        h2: "4. Compartilhamento de Dados com Terceiros",
        body: "Não vendemos seus dados para terceiros. As informações da sua instituição e seus membros são mantidas estritamente confidenciais. O compartilhamento ocorre apenas de forma segura com provedores de nuvem (como AWS/GCP) ou sob demanda judicial legal."
      },
      {
        h2: "5. Segurança das Informações",
        body: "A MillionsNest aplica práticas estritas de segurança corporativa moderna, como criptografia em trânsito com TLS 1.2+ e dados armazenados em repouso de forma isolada (multi-tenant) em bancos de dados protegidos."
      },
      {
        h2: "6. Seus Direitos",
        body: "Garantimos o direito de confirmar o processamento, acessar, corrigir informações parciais ou desatualizadas, revogar consentimentos e exigir a exclusão de registros sob encerramento das operações no nosso ecossistema."
      },
      {
        h2: "7. Retenção de Dados",
        body: "Seus dados permanecerão salvos pelo ciclo da sua assinatura ativa. Reservamos o direito de expurgar definitivamente registros após um período de tolerância de 90 dias úteis depois do encerramento oficial da sua conta."
      },
      {
        h2: "8. Contato do Encarregado (DPO)",
        body: "Para sanar quaisquer discussões sobre dados e conformidades com a privacidade, acione nossos canais de suporte integrado disponibilizados no painel MillionsNest."
      }
    ]
  },
  en: {
    title: "Privacy Policy",
    tag: "Legal",
    updatedAt: "Last updated: May 2026",
    sections: [
      {
        h2: "1. Privacy Commitment",
        body: "MillionsNest remains committed to safeguarding user privacy and organizational metadata gathered from churches and ministries across our SaaS ecosystem, including MusicScale and all companion products. This policy structures compliance under modern global data protection acts."
      },
      {
        h2: "2. Collected Metrics & Information",
        body: "We process administrative identifiers (names, emails, phone numbers), localized team metrics registered by admins (member names, roles, team groupings, schedules), payment identifiers (securely routed via checkout gateways like Stripe; we never store card numbers directly), and telemetry parameters (IPs, browser details, session tokens)."
      },
      {
        h2: "3. Purposes of Data Processing",
        body: "We utilize processed variables to operate and secure our workspace products, enhance our master song library matching chord sheets and meta values anonymously (with direct dissociation from any church identity), prevent malicious activity, and transmit alerts concerning system configurations."
      },
      {
        h2: "4. Third-Party Disclosures",
        body: "We do not sell user data. Church layouts and band details are kept within the account limits. Transmissions happen securely to standard hosting services (e.g. AWS, GCP) or under authorized judicial decrees."
      },
      {
        h2: "5. Information Safeguarding Guidelines",
        body: "MillionsNest handles data security using advanced protocols, including TLS 1.2+ encryption for transit vectors, and strict database isolation mechanisms separating organization metrics (multi-tenancy)."
      },
      {
        h2: "6. User Rights",
        body: "Under frameworks, you possess the entitlement to browse, adjust, migrate, or instruct the elimination of active records by lodging requests to support centers."
      },
      {
        h2: "7. Storage Lifecycle",
        body: "System elements are preserved for the length of your active plan. We possess the right to permanently purge metrics 90 days following formal account termination."
      },
      {
        h2: "8. Data Protection Officer Contacts",
        body: "To raise privacy inquiries, please open a direct contact ticket through the dashboard channels of MillionsNest."
      }
    ]
  },
  es: {
    title: "Política de Privacidad",
    tag: "Legal",
    updatedAt: "Última actualización: Mayo de 2026",
    sections: [
      {
        h2: "1. Compromiso de Privacidad",
        body: "MillionsNest asume el compromiso inequívoco de proteger la privacidad de los usuarios y congregaciones en nuestro sistema SaaS (incluyendo MusicScale y demás aplicaciones del ecosistema) en cumplimiento estricto con las normativas internacionales de protección de datos."
      },
      {
        h2: "2. Datos Recabados",
        body: "Procesamos información de registro de administradores (nombre, correo), información de congregantes provista por líderes (nombres, roles, calendarios, asignaciones), datos de fianza virtuales (procesados de forma segura mediante Stripe; no almacenamos tarjetas) y metadatos de sesión (dirección IP, cookies esenciales y registros técnicos)."
      },
      {
        h2: "3. Destino de los Datos",
        body: "Los datos recopilados apoyan al mantenimiento y refinamiento de nuestras herramientas, corrección anónima de transposiciones o tonalidades de canciones del catálogo global, prevención de ataques informáticos y envío de notificaciones sobre renovaciones de licencia."
      },
      {
        h2: "4. Transmisión a Terceros",
        body: "No comercializamos bases de datos. Los registros de su iglesia son estrictamente destinados a la operación de su equipo. Se transfieren únicamente al hosting web (AWS/GCP) o por mandamientos de autoridades competentes."
      },
      {
        h2: "5. Métodos de Seguridad",
        body: "MillionsNest instituye codificación cifrada TLS 1.2+ durante el tránsito, bases de datos aisladas con particionado multi-tenant y procesos rigurosos de control de accesos perimetrales."
      },
      {
        h2: "6. Sus Derechos de Titular",
        body: "Usted goza de derecho de confirmación de tratamiento, consulta, rectificación, anonimización o retirada de datos solicitándola en nuestro soporte."
      },
      {
        h2: "7. Tiempo de Resguardo",
        body: "Resguardamos sus métricas durante el ciclo de vida del plan anual/mensual contratado. Efectuamos el vaciado total pasados 90 días del cese del contrato."
      },
      {
        h2: "8. Oficial de Protección de Datos",
        body: "Para plantear debates en torno a estas cláusulas, comuníquese empleando el sistema de mensajería Pro de su cuenta."
      }
    ]
  }
};

export function Privacy() {
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
