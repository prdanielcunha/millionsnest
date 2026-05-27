import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Users, Calendar, Music, Command, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { searchEngine, SearchResult, SearchContext } from '../packages/intelligence/search.js';
import { eventBus } from '../packages/events/index.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';
import { haptics } from '../packages/ui/haptics.js';

export function CommandPalette() {
  const { profile, user } = useAuth();
  const { organization } = useOrganization();
  const { t } = useTranslation(['commandPalette']);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveApp = (): string => {
    const p = location.pathname;
    if (p.includes('/scales') || p.includes('/songs')) return 'musicscale';
    if (p.includes('/cells')) return 'cells';
    if (p.includes('/cultos') || p.includes('/services')) return 'cultoflow';
    return 'core';
  };

  const currentContext: SearchContext = {
    orgId: profile?.organizationId || 'guest',
    activeApp: getActiveApp(),
    enabledApps: organization?.enabledApps || [], 
  };

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleBusOpen = () => setIsOpen(true);
    const handleBusClose = () => setIsOpen(false);

    window.addEventListener('keydown', handleKeyDown);
    eventBus.subscribe('ui.command_palette.open', handleBusOpen);
    eventBus.subscribe('ui.command_palette.close', handleBusClose);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      eventBus.unsubscribe('ui.command_palette.open', handleBusOpen);
      eventBus.unsubscribe('ui.command_palette.close', handleBusClose);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
      // Load initial contextual quick actions
      handleSearch('');
      haptics.light();
    } else {
      document.body.style.overflow = 'unset';
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSearch = async (term: string) => {
    setQuery(term);
    setSelectedIndex(0);
    const searchResults = await searchEngine.query(term, currentContext);
    setResults(searchResults);
  };

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    haptics.light();
    
    // Publish semantic telemetry
    eventBus.publish('system.search.executed', {
      organizationId: currentContext.orgId,
      userId: profile?.uid || 'guest',
      appSource: currentContext.activeApp,
      metadata: { targetType: item.type, title: item.title, action: 'select_from_palette' }
    });

    if (item.routingDetails.startsWith('ACTION:')) {
      // Dispatch contextual action via event bus instead of routing
      const actionName = item.routingDetails.split(':')[1];
      eventBus.publish(`action.contextual.${actionName}` as any, {
        organizationId: currentContext.orgId,
        userId: profile?.uid || 'guest',
        appSource: currentContext.activeApp
      });
      console.log(`[Command Palette] Executing Contextual Action: ${actionName}`);
    } else {
      navigate(item.routingDetails);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        if (prev < results.length - 1) haptics.selection();
        return prev < results.length - 1 ? prev + 1 : prev;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        if (prev > 0) haptics.selection();
        return prev > 0 ? prev - 1 : 0;
      });
    }
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-4 md:pt-[15vh]">
          {/* Minimalist Backdrop using Premium Easing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette Container: Smooth Motion, Deep Elevation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-2xl bg-[#111827] border border-white/10 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden mx-4 md:mx-0 flex flex-col max-h-[85vh] md:max-h-[70vh]"
          >
            {/* Context/Input Area */}
            <div className="flex items-center px-4 py-4 border-b border-white/5 shrink-0">
              <Search className="w-5 h-5 text-[#A0A7B5]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={currentContext.activeApp === 'musicscale' ? t('musicscale_placeholder') : t('placeholder')}
                className="flex-1 bg-transparent border-none outline-none px-4 text-[#F5F7FA] placeholder:text-[#6B7280] text-lg font-medium"
                autoComplete="off"
                spellCheck="false"
              />
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[#A0A7B5] text-[10px] uppercase font-bold tracking-wider font-mono">
                <Command className="w-3 h-3" /> Esc
              </div>
            </div>

            {/* Results Area */}
            <div className="overflow-y-auto p-2 scrollbar-thin flex-1">
              {results.length === 0 ? (
                <div className="py-12 text-center text-[#A0A7B5] text-sm">
                  {t('no_results', { query })}
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    
                    let Icon = FileText;
                    if (item.type === 'person') Icon = Users;
                    if (item.type === 'scale') Icon = Calendar;
                    if (item.type === 'song') Icon = Music;
                    if (item.type === 'ministry') Icon = Users;
                    if (item.type === 'action') Icon = Zap;

                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => handleSelect(item)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors duration-150 ${
                          isSelected ? 'bg-[#2B85EB]/10' : 'hover:bg-white/5 bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                            isSelected && item.type === 'action' ? 'bg-[#10B981]/20 text-[#10B981]' 
                            : isSelected ? 'bg-[#2B85EB]/20 text-[#2B85EB]' 
                            : 'bg-white/5 text-[#A0A7B5]'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col items-start px-2">
                            <span className={`text-sm font-medium ${isSelected ? 'text-[#F5F7FA]' : 'text-[#A0A7B5]'}`}>
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="text-xs text-[#6B7280] mt-0.5">{item.subtitle}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className={`flex items-center gap-3 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                           {item.type === 'action' ? (
                             <span className="text-[10px] text-[#10B981] uppercase font-bold px-2 py-1 bg-[#10B981]/10 rounded-md ring-1 ring-[#10B981]/20">
                               Ação Rápida
                             </span>
                           ) : (
                             <span className="text-[10px] text-[#A0A7B5] uppercase font-bold px-2 py-1 bg-white/5 rounded-md">
                               {item.appSource}
                             </span>
                           )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Metadata */}
            <div className="px-4 py-2 border-t border-white/5 bg-[#0B0F19] flex items-center justify-between shrink-0">
               <span className="text-[10px] text-[#6B7280] uppercase tracking-widest font-mono">MillionsNest OS</span>
               <div className="flex items-center gap-4 text-[10px] text-[#6B7280] font-mono">
                 <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white/10 flex items-center justify-center text-[8px]">↑</div><div className="w-3 h-3 rounded bg-white/10 flex items-center justify-center text-[8px]">↓</div> Navegar</span>
                 <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white/10 flex items-center justify-center text-[8px]">↵</div> Selecionar</span>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
