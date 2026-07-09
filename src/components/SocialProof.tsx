import { motion } from "framer-motion";
import { ShieldCheck, Music, CheckCircle2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

export function SocialProof() {
  const { t } = useTranslation(['landing']);

  return (
    <section className="py-16 md:py-24 bg-[#050505] border-b border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-[#A0A7B5] font-medium text-sm md:text-base max-w-2xl mx-auto tracking-wide uppercase mb-12"
        >
          {t('social_proof_title', 'Criado por ministros. Feito para a Igreja.')}
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-x-12 gap-y-8"
        >
           <div className="flex flex-col items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Music className="w-6 h-6 text-[#A0A7B5]" />
             </div>
             <span className="text-sm font-semibold text-[#F5F7FA]">Foco no Louvor</span>
           </div>
           
           <div className="flex flex-col items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#A0A7B5]" />
             </div>
             <span className="text-sm font-semibold text-[#F5F7FA]">Plataforma Segura</span>
           </div>

           <div className="flex flex-col items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#A0A7B5]" />
             </div>
             <span className="text-sm font-semibold text-[#F5F7FA]">Escalas Organizadas</span>
           </div>
        </motion.div>
      </div>
    </section>
  );
}
