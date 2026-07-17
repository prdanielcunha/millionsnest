import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, Info } from 'lucide-react';
import { SupportGuideDefinition } from '../../lib/supportGuideRegistry.js';

interface SupportGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  guide: SupportGuideDefinition | null;
}

export function SupportGuideModal({ isOpen, onClose, guide }: SupportGuideModalProps) {
  const { t } = useTranslation(['dashboard']);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Close safely if guide is null but modal is open
  useEffect(() => {
    if (isOpen && !guide) {
      onClose();
    }
  }, [isOpen, guide, onClose]);

  // Focus trap & Escape key
  useEffect(() => {
    if (isOpen && guide) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, guide, onClose]);

  // Scroll lock handled by provider

  if (!isOpen || !guide) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-reduce:animate-none animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-intro"
        tabIndex={-1}
        className="relative w-full max-w-md bg-[#1C1C1F] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-32px)] motion-reduce:animate-none animate-in zoom-in-95 duration-200 focus:outline-none"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <h2 id="guide-title" className="text-xl font-bold text-white tracking-tight">
            {t(guide.titleKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 -mr-3 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={t('support.guides.close_aria', 'Fechar guia')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 overscroll-contain">
          <p id="guide-intro" className="text-[#E1E4EB] text-sm leading-relaxed">
            {t(guide.introKey)}
          </p>

          <ul className="space-y-4">
            {guide.sectionKeys.map((key, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-white/90 leading-relaxed">
                  {t(key)}
                </span>
              </li>
            ))}
          </ul>

          {guide.tipKey && (
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-100">
                {t(guide.tipKey)}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-[#161618] rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1C1C1F] outline-none"
          >
            {t('support.guides.understood', 'Entendi')}
          </button>
        </div>
      </div>
    </div>
  );
}
