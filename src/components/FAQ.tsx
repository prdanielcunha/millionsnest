import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function FAQ() {
  const { t } = useTranslation(['landing']);
  const faqs = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`faq_q${n}`),
    answer: t(`faq_a${n}`)
  }));
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="border-b border-white/[0.06] bg-[#070A10] py-24 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t('faq_tag')}</div>
            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] text-white md:text-5xl">
              <Trans i18nKey="landing:faq_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
            </h2>
          </div>

          <div className="border-t border-white/[0.07]">
            {faqs.map((faq, i) => (
              <motion.div key={i} className="border-b border-white/[0.07]">
                <button onClick={() => setOpenIndex(openIndex === i ? null : i)} className="group flex w-full items-start justify-between gap-5 py-6 text-left">
                  <span className="text-base font-medium leading-relaxed text-[#E8ECF2] transition group-hover:text-white md:text-lg">{faq.question}</span>
                  {openIndex === i ? <Minus className="mt-1 h-4 w-4 shrink-0 text-[#6EAFFF]" /> : <Plus className="mt-1 h-4 w-4 shrink-0 text-[#687384]" />}
                </button>
                <AnimatePresence initial={false}>
                  {openIndex === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="max-w-2xl pb-6 text-sm leading-relaxed text-[#7F8998] md:text-base">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
