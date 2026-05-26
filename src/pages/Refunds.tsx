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
    title: "Políticas de Reembolso",
    tag: "Legal",
    updatedAt: "Última atualização: Maio de 2026",
    sections: [
      {
        h2: "1. Direito de Arrependimento",
        body: "Conforme o Código de Defesa do Consumidor (Art. 49), você tem o direito de arrependimento em até 7 (sete) dias civis após a primeira contratação da assinatura unificada dos produtos MillionsNest (que abrange o MusicScale e quaisquer outros apps inclusos). Caso solicite o cancelamento dentro deste período estipulado, o valor investido será reembolsado de forma integral. Como nossa plataforma oferece um Trial Gratuito inicial, a aplicabilidade em muitos casos está contida dentro do próprio uso antes da efetivação da cobrança."
      },
      {
        h2: "2. Regras para Planos Mensais",
        body: "Após o decurso do período legal de 7 dias ou de Trial Gratuito, não será fornecido reembolso da fatura de meses já cobrados ou em curso para os planos mensais. O cancelamento apenas assegura que você continuará com acesso aos serviços no período já pago, evitando cobranças futuras."
      },
      {
        h2: "3. Regras para Planos Anuais",
        body: "Em caso de desistência de Planos Anuais após o prazo legal de Direito de Arrependimento, será feita a rescisão proporcional, baseada na readequação e tarifação do nosso preço cobrado para faturamento mensal convencional - subtraindo do valor global pago -, podendo gerar um reembolso de parte do crédito, retendo de modo devido os descontos agressivos concedidos pelo compromisso contratual de um ano."
      },
      {
        h2: "4. Estornos em Casos de Instabilidade",
        body: "Reembolsos derivados de problemas de disponibilidade do servidor serão analisados caso a caso pela nossa equipe técnica a título de compensação ao ministério. Tais problemas em regra ativam compensações na forma de créditos de usabilidade estendendo-se os dias ao cliente, e raras vezes em pecúnia."
      },
      {
        h2: "5. Processamento dos Estornos",
        body: "Qualquer estorno aprovado será encaminhado à sua operadora de cartão de crédito no prazo de 5 a 10 dias úteis e estará refletido nas próximas faturas da sua fatura bancária (segundo tempo estipulado pela administradora do cartão)."
      },
      {
        h2: "6. Como Solicitar",
        body: "Para pedir arrependimentos e estornos legais, por favor direcione um e-mail com identificação da igreja (CNPJ e E-mail principal) para nossa central formal de suporte, informando as causas motivadoras."
      }
    ]
  },
  en: {
    title: "Refund Policy",
    tag: "Legal",
    updatedAt: "Last updated: May 2026",
    sections: [
      {
        h2: "1. Refund Eligibility & Trial Periods",
        body: "Under consumer regulation, you represent a right of change of mind within 7 calendar days after purchasing any unified MillionsNest subscription product (including MusicScale and all companion applications). If requested within this period, charges will be fully reversed. Since our platform grants an upfront 7-Day Free Trial, actual billing events only start post-trial."
      },
      {
        h2: "2. Monthly Subscription Rules",
        body: "Following the expiration of the 7-day trial or legal window, we do not provide refunds for active or past monthly invoices. Cancellation guarantees you keep premium benefits until the current term ends, stopping future bill events."
      },
      {
        h2: "3. Annual Subscription Guidelines",
        body: "For annual plans cancelled mid-cycle after the 7-day window, a proportional calculation based on standard monthly pricing is applied (subtracting elapsed months from the initial payment). This recovers the high discounts applied to annual packages while returning the remaining balance to the customer's billing source."
      },
      {
        h2: "4. Outages & Performance Credits",
        body: "If any severe workspace disruptions or cloud network crashes happen, our technical center inspects cases individually. True outages typically activate extended complimentary usage credits to compensate your band."
      },
      {
        h2: "5. Return Processing Timelines",
        body: "Once an adjustment is approved, it is batched to your credit card gateway within 5 to 10 business days. The actual appearance on physical logs depends on bank guidelines."
      },
      {
        h2: "6. How to Apply",
        body: "To request legal refunds, please transmit an email listing your church details, the registered lead email, and a reason for the refund to our support inbox."
      }
    ]
  },
  es: {
    title: "Políticas de Reembolso",
    tag: "Legal",
    updatedAt: "Última actualización: Mayo de 2026",
    sections: [
      {
        h2: "1. Derecho de Desistimiento",
        body: "De acuerdo con el código de protección al consumidor, usted posee el derecho de retractarse dentro de los 7 días naturales luego de su primer cobro de suscripción MillionsNest (que incluye MusicScale y otros servicios). Si efectúa la solicitud en este plazo, se reintegrará la totalidad de lo pagado. Dado que proveemos un Trial Gratuito de 7 días, las transacciones regulares solo se efectúan con su aprobación una vez terminado el trial."
      },
      {
        h2: "2. Reglas de Planes Mensuales",
        body: "Posterior al trial o al derecho de desistimiento de 7 días, no se emitirán reembolsos parciales o totales de mensualidades cursadas o facturadas. El proceso de cancelación solo evitará futuras renovaciones de cargos."
      },
      {
        h2: "3. Reglas de Planes Anuales",
        body: "Si decide suspender un Plan Anual antes de tiempo, se calculará el uso proporcional aplicando el valor del plan mensual sin descuentos por los meses devengados y deduciendo ese total del cobro anual original. El saldo restante se devolverá al método de cobro."
      },
      {
        h2: "4. Reembolsos por Inestabilidad",
        body: "Reclamos causados por fallos masivos en la infraestructura de red serán evaluados por soporte técnico. Usualmente compensamos estas variaciones otorgando días extra de servicio premium."
      },
      {
        h2: "5. Tiempos de Procesamiento",
        body: "Cualquier reembolso aprobado se enviará a la emisora de su tarjeta de crédito en un periodo de 5 a 10 días laborables, apareciendo reflejado en sus próximos periodos de estado bancario."
      },
      {
        h2: "6. Cómo Solicitar",
        body: "Para tramitar devoluciones, escriba un correo de soporte detallando el nombre de su iglesia, correo del administrador y los detalles correspondientes de su cuenta."
      }
    ]
  }
};

export function Refunds() {
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
