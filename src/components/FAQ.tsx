import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function FAQ() {
  const { t } = useTranslation(['landing']);
  const faqs = [
    {
      question: t('faq_q1'),
      answer: t('faq_a1')
    },
    {
      question: t('faq_q2'),
      answer: t('faq_a2')
    },
    {
      question: t('faq_q3'),
      answer: t('faq_a3')
    },
    {
      question: t('faq_q4'),
      answer: t('faq_a4')
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-[#050505]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-xs font-semibold mb-6">
            <HelpCircle className="w-3 h-3" />
            {t('faq_tag')}
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#F5F7FA] mb-6">
            <Trans i18nKey="landing:faq_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="border-b border-white/5"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full py-6 flex items-center justify-between text-left group"
              >
                <span className={`text-lg font-medium transition-colors ${openIndex === i ? 'text-[#2B85EB]' : 'text-[#F5F7FA] group-hover:text-[#2B85EB]'}`}>
                  {faq.question}
                </span>
                {openIndex === i ? (
                  <Minus className="w-5 h-5 text-[#2B85EB] flex-shrink-0" />
                ) : (
                  <Plus className="w-5 h-5 text-[#A0A7B5] flex-shrink-0" />
                )}
              </button>
              
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="text-[#A0A7B5] pb-6 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
