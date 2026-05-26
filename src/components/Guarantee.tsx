import { motion } from "framer-motion";
import { ShieldCheck, Calendar, RotateCcw } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Guarantee() {
  const { t } = useTranslation(['landing']);
  return (
    <section className="py-16 bg-[#050505] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-gradient-to-br from-[#0B0F19] to-[#050505] rounded-[2.5rem] border border-white/5 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/5 blur-[100px] pointer-events-none" />
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold mb-6">
                <ShieldCheck className="w-3 h-3" />
                {t('guarantee_tag')}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F5F7FA] mb-6">
                <Trans i18nKey="landing:guarantee_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
              </h2>
              <p className="text-[#A0A7B5] text-lg leading-relaxed mb-8">
                {t('guarantee_desc')}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-[#2B85EB]" />
                  </div>
                  <div>
                    <h4 className="text-[#F5F7FA] font-semibold text-sm">7 Dias de Teste</h4>
                    <p className="text-[#A0A7B5] text-xs">Acesso premium liberado</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="w-5 h-5 text-[#2B85EB]" />
                  </div>
                  <div>
                    <h4 className="text-[#F5F7FA] font-semibold text-sm">{t('guarantee_cta')}</h4>
                    <p className="text-[#A0A7B5] text-xs">Um clique e está feito</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center md:justify-end">
              <motion.div 
                initial={{ rotate: -5, scale: 0.9 }}
                whileInView={{ rotate: 0, scale: 1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute inset-0 bg-[#2B85EB]/20 blur-3xl rounded-full" />
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border-[12px] border-[#2B85EB]/20 bg-[#0B0F19] flex flex-col items-center justify-center text-center p-6 relative bg-clip-padding backdrop-blur-xl">
                  <span className="text-[#2B85EB] font-black text-5xl md:text-7xl leading-none">7</span>
                  <span className="text-[#F5F7FA] font-bold text-lg md:text-xl uppercase tracking-tighter">Dias de</span>
                  <span className="text-[#A0A7B5] font-medium text-xs md:text-sm uppercase tracking-widest">Garantia</span>
                  <ShieldCheck className="absolute -top-2 -right-2 w-12 h-12 text-[#2B85EB] fill-[#0B0F19]" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
