import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

/**
 * Intentionally contains no synthetic testimonials.
 * Publish customer stories here only after the person or organization grants permission.
 */
export function Testimonials() {
  const { t } = useTranslation(['landing']);
  return (
    <section id="depoimentos" className="py-24 bg-[#050505] relative">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#A0A7B5] text-xs font-semibold mb-6"><BadgeCheck className="w-3.5 h-3.5 text-[#2B85EB]" />{t('test_tag')}</motion.div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#F5F7FA] mb-6"><Trans i18nKey="landing:test_title" components={{ 1: <span className="text-[#2B85EB]" /> }} /></h2>
        <p className="text-[#A0A7B5] max-w-2xl mx-auto leading-relaxed">{t('test_desc')}</p>
      </div>
    </section>
  );
}
