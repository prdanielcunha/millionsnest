import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { useAuth } from '../contexts/AuthContext.js';
import { eventBus } from '../packages/events/index.js';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openSearch = () => {
    eventBus.publish('ui.command_palette.open', {
      organizationId: profile?.organizationId || 'guest',
      userId: user?.uid || 'guest',
      appSource: 'core'
    });
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b',
        isScrolled
          ? 'bg-[#050505]/80 backdrop-blur-xl border-white/5 shadow-lg py-3'
          : 'bg-transparent border-transparent py-5'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/logo02.png" alt="MillionsNest Logo" className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
          <span className="font-semibold text-lg tracking-tight text-[#F5F7FA]">MillionsNest</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <a href="/#musicscale" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">MusicScale</a>
          <a href="/#funcionalidades" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">Funcionalidades</a>
          <a href="/#ecossistema" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">Ecossistema</a>
          <a href="/#precos" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">Valores</a>
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <>
              <button onClick={openSearch} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors">
                <Search className="w-4 h-4" />
                <span className="text-xs font-medium">Buscar...</span>
                <kbd className="hidden md:inline-flex items-center gap-1 text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider ml-2">⌘K</kbd>
              </button>
              
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                 <span className="text-sm font-medium text-[#A0A7B5]">{profile?.displayName || user.email}</span>
                 <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#0B0F19] text-white border border-white/10 hover:bg-white/5 transition-colors shadow-sm">
                    <LayoutDashboard className="w-4 h-4" />
                    Painel
                 </Link>
                 <button onClick={logout} className="p-2 text-[#A0A7B5] hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <LogOut className="w-4 h-4" />
                 </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">Entrar</Link>
              <Link to="/login" className="text-sm font-medium px-5 py-2.5 rounded-lg bg-[#F5F7FA] text-[#050505] hover:bg-white transition-all shadow-sm hover:shadow active:scale-95">
                Teste grátis
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle & Search */}
        <div className="lg:hidden flex items-center gap-3">
          <LanguageSwitcher />
          {user && (
            <button 
              className="text-[#A0A7B5] hover:text-white transition-colors bg-white/5 p-2 rounded-lg"
              onClick={openSearch}
            >
              <Search size={20} />
            </button>
          )}
          <button 
            className="text-[#A0A7B5] hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-[#0B0F19] border-b border-white/10 shadow-2xl p-6 flex flex-col gap-4 lg:hidden"
          >
            <a href="/#musicscale" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>MusicScale</a>
            <a href="/#funcionalidades" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>Funcionalidades</a>
            <a href="/#ecossistema" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>Ecossistema</a>
            <a href="/#precos" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>Preços</a>
            <hr className="border-white/10" />
            {user ? (
               <>
                 <div className="flex items-center justify-between text-[#F5F7FA] font-medium">
                   <span className="truncate">{profile?.displayName || user.email}</span>
                   <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="p-2 text-[#A0A7B5] hover:text-white"><LogOut className="w-5 h-5"/></button>
                 </div>
                 <Link to="/dashboard" className="text-lg font-medium bg-[#F5F7FA] text-[#050505] text-center py-3 rounded-lg flex items-center justify-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                   <LayoutDashboard className="w-5 h-5" /> Painel Central
                 </Link>
               </>
            ) : (
               <>
                <Link to="/login" className="text-lg font-medium text-[#A0A7B5] hover:text-white" onClick={() => setMobileMenuOpen(false)}>Entrar</Link>
                <Link to="/login" className="text-lg font-medium bg-[#F5F7FA] text-[#050505] hover:bg-white text-center py-3 rounded-lg" onClick={() => setMobileMenuOpen(false)}>Teste Grátis de 7 Dias</Link>
               </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
