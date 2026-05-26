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
    title: "Políticas de Cancelamento",
    tag: "Legal",
    updatedAt: "Última atualização: Maio de 2026",
    sections: [
      {
        h2: "1. Como Cancelar sua Assinatura",
        body: "Prezando pela total transparência e facilidade, o cancelamento da sua assinatura unificada da MillionsNest (que inclui o MusicScale e aplicativos parceiros) pode ser feito de forma autônoma e a qualquer momento. Basta acessar as Configurações da Conta dentro do painel do seu aplicativo e selecionar a opção \"Cancelar Assinatura\" ou \"Gerenciar Faturamento\"."
      },
      {
        h2: "2. Efeitos do Cancelamento",
        body: "Ao realizar o cancelamento, a renovação automática da sua assinatura (seja ela mensal ou anual) será desativada. Isso significa que não haverá novas cobranças no seu cartão de crédito nas próximas faturas. Você e os membros da sua equipe continuarão a ter acesso total aos recursos premium do ecossistema MillionsNest até o último dia do ciclo de faturamento já pago. Após essa data, a conta será rebaixada e o acesso às ferramentas premium será suspendido."
      },
      {
        h2: "3. Cancelamento no Período de Teste (Trial)",
        body: "Se o cancelamento for efetuado antes do fim do período de teste gratuito de 7 dias (Trial), sua conta não sofrerá qualquer cobrança. O acesso aos recursos pagos poderá ser interrompido imediatamente após o cancelamento do período de teste, conforme o sistema."
      },
      {
        h2: "4. Retenção de Dados e Reativação",
        body: "Sabemos que muitos ministérios podem pausar as atividades ou o uso das ferramentas por um período. Por isso, após o fim do seu ciclo de faturamento cancelado, manteremos os dados operacionais da sua instituição, escalas e histórico salvos em nossos servidores por um prazo de 90 dias (ou conforme descrito na Política de Privacidade). Dentro deste período, você pode simplesmente reativar a assinatura e voltar a usar a plataforma exatamente de onde parou, sem perda de arquivos. Esgotado este prazo, os dados da instituição poderão ser excluídos de forma definitiva de nossa base."
      },
      {
        h2: "5. Diferença entre Cancelamento e Reembolso",
        body: "O cancelamento impede futuras cobranças. Para solicitações de devolução de pagamentos já efetuados (como arrependimento dentro de 7 dias da contratação ou estornos de planos anuais), por favor, consulte a nossa política de reembolsos."
      },
      {
        h2: "6. Exclusão Imediata da Conta",
        body: "Caso deseje que não apenas sua assinatura seja cancelada, mas que todos os dados do seu ministério sejam apagados imediatamente do nosso banco de dados, você deve solicitar a exclusão total através do suporte ou e-mail de atendimento da MillionsNest."
      }
    ]
  },
  en: {
    title: "Cancellation Policy",
    tag: "Legal",
    updatedAt: "Last updated: May 2026",
    sections: [
      {
        h2: "1. How to Cancel Your Subscription",
        body: "Valuing total transparency and ease of use, you can cancel your unified MillionsNest subscription (including MusicScale and partner applications) autonomously at any time. Simply navigate to the Account Settings panel in your app and choose \"Cancel Subscription\" or \"Manage Billing\"."
      },
      {
        h2: "2. Effects of Cancellation",
        body: "Upon cancellation, recursive pricing will be deactivated. Your credit card will not be charged for future billing terms. You and your team members will continue to possess premium features access for the duration of the current term. After this term expires, premium privileges will be paused and your workspace will revert to standard mode."
      },
      {
        h2: "3. Trial Period Cancellation",
        body: "If cancellation happens before the end of your 7-day free trial, no billing occurs. System structures may restrict paid features access immediately after trial cancellation."
      },
      {
        h2: "4. Data Retention and Reactivation",
        body: "Since we know ministries may temporarily freeze workflows, our system retains your scales, files, and rosters for up to 90 days following expiration. You can reactivate your subscription anytime within this window to pick up exactly where you left off. After 90 days, structures may be permanently purged."
      },
      {
        h2: "5. Cancellation vs. Refund",
        body: "Cancelling blocks future billing events. To request legal or proportional refunds on active charges, please inspect our Refund Policy."
      },
      {
        h2: "6. Immediate Account Elimination",
        body: "If you want all data, songs, and rosters wiped immediately from our workspace database upon cancellation, please launch an immediate account deletion service request via MillionsNest support."
      }
    ]
  },
  es: {
    title: "Políticas de Cancelación",
    tag: "Legal",
    updatedAt: "Última actualización: Mayo de 2026",
    sections: [
      {
        h2: "1. Cómo Cancelar su Suscripción",
        body: "Valorando la total transparencia y comodidad, el proceso de cancelación de su suscripción de MillionsNest (incluyendo MusicScale y aplicaciones del ecosistema) puede realizarse de forma autónoma a través del panel de Configuración de la Cuenta de su aplicación haciendo clic en \"Cancelar Suscripción\" o \"Administrar Facturación\"."
      },
      {
        h2: "2. Efectos de la Cancelación",
        body: "Al procesar su cancelación, se suspenderán los cargos periódicos. Su tarjeta de crédito no recibirá cargos posteriores. Su equipo mantendrá el acceso completo de nivel premium hasta completar el período actual vigente de facturación. Vencido este período, los privilegios se pausarán de forma automática."
      },
      {
        h2: "3. Cancelación durante el Período del Trial",
        body: "Si cancela su servicio antes del vencimiento de la prueba de acceso gratuita de 7 días, no se efectuará ninguna facturación. El acceso de nivel premium se desactivará de forma inmediata según el diseño del sistema."
      },
      {
        h2: "4. Retención de Datos y Reactivación",
        body: "Considerando que algunos ministerios congelan temporalmente sus actividades, nuestro sistema almacena sus repertorios, escalas e historial de asignaciones por 90 días naturales luego de expirar la cuenta. Puede reactivar la cuenta dentro de este ciclo sin pérdida de datos. Cumplidos los 90 días, la base de datos se depurará permanentemente."
      },
      {
        h2: "5. Cancelación vs. Reembolso",
        body: "La cancelación previene cargos futuros. Para tramitar devoluciones o compensaciones de cobros acumulados, consulte nuestra Política de Reembolso."
      },
      {
        h2: "6. Supresión Inmediata de Cuenta",
        body: "Si requiere la eliminación total e inmediata de los registros de su organización en nuestra base de datos, genere una solicitud de soporte al correo de atención de MillionsNest."
      }
    ]
  }
};

export function Cancellation() {
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
