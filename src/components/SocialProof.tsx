import { motion } from "framer-motion";
import { CreditCard, KeyRound, Languages, Target } from "lucide-react";
import { useTranslation } from 'react-i18next';

export function SocialProof() {
  const { t } = useTranslation(['landing']);
  const facts = [
    { icon: Target, label: t('social_proof_focus') },
    { icon: KeyRound, label: t('social_proof_security') },
    { icon: CreditCard, label: t('social_proof_subscription') },
    { icon: Languages, label: t('social_proof_languages') },
  ];

  return (
    <section className="border-b border-white/[0.06] bg-[#070A10] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <motion.p initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl text-lg font-medium leading-relaxed tracking-[-0.02em] text-[#CED4DE] md:text-xl">
          {t('social_proof_title')}
        </motion.p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(({ icon: Icon, label }) => (
            <motion.div key={label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="flex min-h-28 items-end bg-[#080B11] p-5">
              <div>
                <Icon className="mb-6 h-5 w-5 text-[#6EAFFF]" />
                <div className="text-sm font-medium text-[#DDE2EA]">{label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
