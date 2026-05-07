import { motion } from "framer-motion";
import { Star } from "lucide-react";

export function SocialProof() {
  return (
    <section className="py-16 md:py-24 bg-white border-b border-brand-primary/5">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-brand-primary/60 font-medium text-sm md:text-base max-w-2xl mx-auto"
        >
          Líderes e equipes estão abandonando planilhas, PDFs e grupos confusos para centralizar tudo em um só lugar.
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
              <div key={i} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-brand-primary/10">
                <img src={src} alt="User avatar" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-5 h-5 fill-brand-secondary text-brand-secondary" />
              ))}
            </div>
            <p className="text-sm font-semibold text-brand-primary mt-1">
              Amado por +500 ministérios
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
