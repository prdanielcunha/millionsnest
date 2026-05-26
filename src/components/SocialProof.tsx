import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useTranslation } from 'react-i18next';

export function SocialProof() {
  const { t } = useTranslation(['landing']);
  return (
    <section className="py-16 md:py-24 bg-[#050505] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-[#A0A7B5] font-normal text-sm md:text-base max-w-2xl mx-auto"
        >
          {t('social_proof_title')}
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1 }}
          className="mt-8 flex flex-col md:flex-row items-center justify-center gap-6"
        >
          {/* Avatar Group */}
          <div className="flex -space-x-3">
            {[
              "https://i.pravatar.cc/100?img=11",
              "https://i.pravatar.cc/100?img=32",
              "https://i.pravatar.cc/100?img=43",
              "https://i.pravatar.cc/100?img=54",
              "https://i.pravatar.cc/100?img=25"
            ].map((src, i) => (
              <div key={i} className="w-12 h-12 rounded-full border-2 border-[#050505] overflow-hidden bg-[#0B0F19]">
                <img src={src} alt="User avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-4 h-4 fill-[#A0A7B5] text-[#A0A7B5]" />
              ))}
            </div>
            <p className="text-sm font-semibold text-[#F5F7FA] mt-2">
              {t('social_proof_loved')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
