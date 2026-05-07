import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b',
        isScrolled
          ? 'bg-white/80 backdrop-blur-md border-brand-primary/10 shadow-sm py-3'
          : 'bg-transparent border-transparent py-5'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-brand-primary">MillionsNest</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#solucoes" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Soluções</a>
          <a href="#plataforma" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Plataforma</a>
          <a href="#precos" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Preços</a>
          <a href="#roadmap" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Roadmap</a>
          <a href="#faq" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">FAQ</a>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <a href="#" className="text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">Entrar</a>
          <a href="#" className="text-sm font-medium px-4 py-2 rounded-full bg-brand-primary text-white hover:bg-brand-primary/90 transition-all shadow-sm hover:shadow active:scale-95">
            Começar Grátis
          </a>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-brand-primary"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-white border-b border-brand-primary/10 shadow-lg p-6 flex flex-col gap-4 md:hidden"
          >
            <a href="#solucoes" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Soluções</a>
            <a href="#plataforma" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Plataforma</a>
            <a href="#precos" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Preços</a>
            <a href="#roadmap" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Roadmap</a>
            <hr className="border-brand-primary/10" />
            <a href="#" className="text-lg font-medium text-brand-primary/80">Entrar</a>
            <a href="#" className="text-lg font-medium bg-brand-primary text-white text-center py-3 rounded-xl">Começar Grátis</a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
