import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localeManager } from '../packages/i18n/index.js';
import { cn } from '../lib/utils.js';
import { haptics } from '../packages/ui/haptics.js';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language || 'pt';

  const languages = [
    { code: 'pt', label: 'Português' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
  ];

  const handleLanguageChange = (code: string) => {
    localeManager.setLanguage(code);
    setIsOpen(false);
    haptics.selection();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors"
        aria-label="Switch Language"
      >
        <Globe className="w-4 h-4" />
        <span className="text-xs font-medium uppercase">{currentLang.slice(0, 2)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-40 bg-[#111827] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {languages.map(lang => {
              const isSelected = currentLang.startsWith(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 text-sm text-left transition-colors",
                    isSelected 
                      ? "bg-[#2B85EB]/10 text-[#2B85EB] font-medium" 
                      : "text-[#A0A7B5] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span>{lang.label}</span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
