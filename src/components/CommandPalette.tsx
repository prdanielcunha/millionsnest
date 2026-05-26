import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Users, Calendar, Music, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchEngine, SearchResult } from '../packages/intelligence/search.js';
import { eventBus } from '../packages/events/index.js';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
      // Load initial quick actions if query is empty
      handleSearch('');
    } else {
      document.body.style.overflow = 'unset';
      setQuery('');
    }
  }, [isOpen]);

  const handleSearch = async (term: string) => {
    setQuery(term);
    setSelectedIndex(0);

    if (term.trim() === '') {
      // Default actions when empty
      setResults([
        { id: 'action_scale', type: 'scale', title: 'Criar Nova Escala', subtitle: 'CultoFlow', appSource: 'cultoflow', routingDetails: '/scales/new', relevanceScore: 1 },
        { id: 'action_song', type: 'song', title: 'Adicionar Música', subtitle: 'MusicScale', appSource: 'musicscale', routingDetails: '/songs/new', relevanceScore: 1 },
        { id: 'action_invite', type: 'person', title: 'Convidar Voluntário', subtitle: 'Core', appSource: 'core', routingDetails: '/team/invite', relevanceScore: 1 }
      ]);
      return;
    }

    const orgStr = localStorage.getItem('mn_org_context');
    const orgId = orgStr ? JSON.parse(orgStr).orgId : 'unknown';
    
    const searchResults = await searchEngine.query(term, orgId);
    setResults(searchResults);
  };

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    
    // Publish semantic telemetry
    eventBus.publish('system.search.executed', {
      organizationId: 'unknown',
      userId: 'unknown',
      appSource: 'core',
      metadata: { targetType: item.type, title: item.title, action: 'select_from_palette' }
    });

    navigate(item.routingDetails);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Minimalist Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-2xl bg-[#111827] border border-white/10 rounded-[1rem] shadow-2xl overflow-hidden mx-4"
          >
            {/* Context/Input Area */}
            <div className="flex items-center px-4 py-4 border-b border-white/5">
              <Search className="w-5 h-5 text-[#A0A7B5]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Busque escalas, pessoas, músicas ou comandos..."
                className="flex-1 bg-transparent border-none outline-none px-4 text-[#F5F7FA] placeholder:text-[#6B7280] text-lg font-medium"
                autoComplete="off"
                spellCheck="false"
              />
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[#A0A7B5] text-[10px] uppercase font-bold tracking-wider font-mono">
                <Command className="w-3 h-3" /> Esc
              </div>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <div className="py-12 text-center text-[#A0A7B5] text-sm">
                  Nenhum resultado encontrado para "{query}"
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
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isSelected ? 'bg-[#2B85EB]/20 text-[#2B85EB]' : 'bg-white/5 text-[#A0A7B5]'}`}>
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
                        
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="text-[10px] text-[#A0A7B5] uppercase font-bold px-2 py-1 bg-white/5 rounded-md">
                             {item.appSource}
                           </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Metadata */}
            <div className="px-4 py-2 border-t border-white/5 bg-[#0B0F19] flex items-center justify-between">
               <span className="text-[10px] text-[#6B7280] uppercase tracking-widest font-mono">MillionsNest OS</span>
               <div className="flex items-center gap-3 text-[10px] text-[#6B7280] font-mono">
                 <span className="flex items-center gap-1">↑↓ Mover</span>
                 <span className="flex items-center gap-1">↵ Selecionar</span>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
