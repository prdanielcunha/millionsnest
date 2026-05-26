import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';

export function Testimonials() {
  const { t } = useTranslation(['landing']);
  
  const testimonials = [
    {
      name: t('test_1_name'),
      role: t('test_1_role'),
      content: t('test_1_quote'),
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&q=80"
  },
  {
    name: t('test_2_name'),
    role: t('test_2_role'),
    content: t('test_2_quote'),
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&q=80"
  },
  {
    name: t('test_3_name'),
    role: t('test_3_role'),
    content: t('test_3_quote'),
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&q=80"
  }
];

  return (
    <section id="depoimentos" className="py-24 bg-[#050505] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-xs font-semibold mb-6"
          >
            <Star className="w-3 h-3 fill-current" />
            {t('test_tag')}
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#F5F7FA] mb-6">
            <Trans i18nKey="landing:test_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
          </h2>
          <p className="text-[#A0A7B5] max-w-2xl mx-auto">
            {t('test_desc')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 rounded-2xl bg-[#0B0F19] border border-white/5 relative group hover:border-[#2B85EB]/30 transition-all"
            >
              <Quote className="absolute top-6 right-8 w-8 h-8 text-[#2B85EB]/10 group-hover:text-[#2B85EB]/20 transition-colors" />
              
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                ))}
              </div>

              <p className="text-[#F5F7FA] mb-8 leading-relaxed italic">
                "{t.content}"
              </p>

              <div className="flex items-center gap-4">
                <img 
                  src={t.avatar} 
                  alt={t.name}
                  className="w-12 h-12 rounded-full border-2 border-[#2B85EB]/20 object-cover"
                />
                <div>
                  <h4 className="text-[#F5F7FA] font-semibold text-sm">{t.name}</h4>
                  <p className="text-[#A0A7B5] text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
