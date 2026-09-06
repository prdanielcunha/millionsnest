import { motion } from "framer-motion";
import { ShieldCheck, Music, UsersRound } from "lucide-react";
import { useTranslation } from 'react-i18next';

export function SocialProof() {
  const { t } = useTranslation(['landing']);
  const facts = [
    { icon: <Music className="w-6 h-6 text-[#A0A7B5]" />, label: t('social_proof_focus') },
    { icon: <ShieldCheck className="w-6 h-6 text-[#A0A7B5]" />, label: t('social_proof_security') },
    { icon: <UsersRound className="w-6 h-6 text-[#A0A7B5]" />, label: t('social_proof_subscription') },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#050505] border-b border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="text-[#A0A7B5] font-medium text-sm md:text-base max-w-3xl mx-auto tracking-wide uppercase mb-12">{t('social_proof_title')}</motion.p>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: 0.1 }} className="flex flex-wrap justify-center gap-x-12 gap-y-8">
          {facts.map((fact) => <div key={fact.label} className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">{fact.icon}</div><span className="text-sm font-semibold text-[#F5F7FA]">{fact.label}</span></div>)}
        </motion.div>
      </div>
    </section>
  );
}
