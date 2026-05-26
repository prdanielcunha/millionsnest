import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Problem() {
  const { t } = useTranslation(['landing']);
  return (
    <section className="py-24 md:py-32 bg-[#0B0F19] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EF4444]/5 border border-[#EF4444]/10 text-xs font-medium text-[#EF4444] uppercase tracking-widest mb-6"
          >
            {t('problem_tag')}
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight leading-tight"
          >
            <Trans i18nKey="landing:problem_title" components={{ br: <br className="hidden md:block" />, 1: <span className="text-[#A0A7B5]" /> }} />
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 relative">
          
          {/* ANTES */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#050505] rounded-3xl p-8 md:p-10 border border-white/5 relative overflow-hidden group hover:border-[#EF4444]/20 transition-colors"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#EF4444]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-sm font-semibold text-[#EF4444] mb-8 uppercase tracking-widest flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {t('problem_chaos')}
            </h3>
            
            <ul className="space-y-6">
              {[
                "problem_chaos_1",
                "problem_chaos_2",
                "problem_chaos_3",
                "problem_chaos_4",
                "problem_chaos_5",
                "problem_chaos_6"
              ].map((key, i) => (
                <li key={i} className="flex items-center gap-4 text-[#A0A7B5]">
                  <span className="text-[#EF4444]/40 text-sm">—</span>
                  <span className="font-normal text-base leading-relaxed">{t(key)}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* DEPOIS */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#050505] rounded-3xl p-8 md:p-10 border border-[#2B85EB]/20 relative overflow-hidden shadow-[0_0_40px_rgba(43,133,235,0.05)]"
          >
            <div className="absolute inset-0 bg-[#2B85EB]/[0.02] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(43,133,235,0.1),_transparent_60%)] pointer-events-none" />
            <h3 className="text-sm font-semibold text-[#2B85EB] mb-8 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <CheckCircle2 className="w-4 h-4" />
              {t('problem_solution')}
            </h3>
            
            <ul className="space-y-6 relative z-10">
              {[
                "problem_solution_1",
                "problem_solution_2",
                "problem_solution_3",
                "problem_solution_4",
                "problem_solution_5",
                "problem_solution_6"
              ].map((key, i) => (
                <li key={i} className="flex items-center gap-4 text-[#F5F7FA]">
                  <CheckCircle2 className="w-5 h-5 text-[#2B85EB] flex-shrink-0" />
                  <span className="font-normal text-base leading-relaxed">{t(key)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
