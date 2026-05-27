import React from 'react';
import { motion } from 'framer-motion';
import { framerTokens } from './motion.js';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export const PremiumEmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <motion.div
      variants={framerTokens.scale}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col items-center justify-center p-12 text-center relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, ...framerTokens.scale.transition }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 flex items-center justify-center text-[#A0A7B5] mb-6 shadow-2xl relative"
      >
        <div className="absolute inset-0 rounded-2xl bg-[#2B85EB]/10 blur-xl opacity-50" />
        {icon}
      </motion.div>
      
      <motion.h3 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, ...framerTokens.scale.transition }}
        className="text-lg font-semibold tracking-tight text-[#F5F7FA] mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, ...framerTokens.scale.transition }}
        className="text-sm text-[#A0A7B5] max-w-sm leading-relaxed mb-8"
      >
        {description}
      </motion.p>
      
      {action && (
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ delay: 0.4, ...framerTokens.scale.transition }}
          onClick={action.onClick}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#F5F7FA] text-[#0B0F19] rounded-xl font-semibold text-sm shadow-[0_0_20px_rgba(245,247,250,0.1)] hover:shadow-[0_0_30px_rgba(245,247,250,0.2)] transition-shadow"
        >
          {action.icon} {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};
