import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { memoryEngine, MemoryContext } from '../packages/intelligence/memory.js';
import { useAuth } from '../contexts/AuthContext.js';
import { haptics } from '../packages/ui/haptics.js';

export function SmartResume() {
  const { user, profile } = useAuth();
  const { t } = useTranslation(['resume']);
  const location = useLocation();
  const navigate = useNavigate();
  const [resumableContext, setResumableContext] = useState<MemoryContext | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show Smart Resume on the dashboard after logging in or returning
    if (user && profile?.organizationId && location.pathname === '/dashboard' && !dismissed) {
      const ctx = memoryEngine.getResumableContext(user.uid, profile.organizationId);
      if (ctx) {
        setResumableContext(ctx);
      }
    } else {
      setResumableContext(null);
    }
  }, [user, profile?.organizationId, location.pathname, dismissed]);

  // Track navigation across the app
  useEffect(() => {
    if (user && profile?.organizationId) {
      memoryEngine.recordNavigation(user.uid, profile.organizationId, location.pathname);
    }
  }, [location.pathname, user, profile?.organizationId]);

  if (!resumableContext || dismissed) return null;

  const handleResume = () => {
    haptics.light();
    setDismissed(true);
    navigate(resumableContext.lastScreen);
  };

  const decodeContextName = (path: string) => {
    if (path.includes('/scales/')) return t('contexts.scale');
    if (path.includes('/songs/')) return t('contexts.song');
    if (path.includes('/teams/')) return t('contexts.team');
    if (path.includes('/cultos/')) return t('contexts.service');
    if (path.includes('/cells/')) return t('contexts.cell');
    return t('contexts.last_activity');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.5 }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex items-center gap-3 p-3 bg-[#111827]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl group cursor-pointer"
        onClick={handleResume}
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-[#A0A7B5] group-hover:bg-[#2B85EB]/20 group-hover:text-[#2B85EB] transition-colors">
          <Clock className="w-5 h-5" />
        </div>
        
        <div className="pr-4">
          <p className="text-[10px] text-[#A0A7B5] uppercase font-bold tracking-widest mb-0.5">{t('continue')}</p>
          <p className="text-sm font-semibold text-[#F5F7FA] flex items-center gap-2">
            {t('return_to', { context: decodeContextName(resumableContext.lastScreen) })}
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 transform" />
          </p>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); setDismissed(true); haptics.selection(); }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-[#1F2937] border border-white/10 rounded-full flex items-center justify-center text-[#A0A7B5] hover:text-white hover:bg-[#374151] transition-colors shadow-lg opacity-0 group-hover:opacity-100"
        >
          <X className="w-3 h-3" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
