import React from 'react';
import { motion } from 'framer-motion';

export const Shimmer = ({ className, delay = 0 }: { className?: string; delay?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.2 }}
      className={`relative overflow-hidden bg-white/5 rounded-lg ${className}`}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        animate={{ translateX: ['-100%', '200%'] }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
};

export const EcosystemPreloader = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-50 rounded-[2rem]"
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full blur-xl bg-[#2B85EB]/20 animate-pulse" />
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
          <motion.div
             className="w-full h-1 bg-gradient-to-r from-transparent via-[#2B85EB] to-transparent absolute bottom-0"
             animate={{ x: ['-100%', '100%'] }}
             transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <svg className="w-6 h-6 text-[#A0A7B5] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
      </div>
      <p className="mt-4 text-xs font-mono tracking-widest text-[#A0A7B5] uppercase">
        Iniciando Módulo...
      </p>
    </motion.div>
  );
};
