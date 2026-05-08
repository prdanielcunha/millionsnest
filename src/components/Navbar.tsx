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
          <img src="/logo.png" alt="MillionsNest Logo" className="h-8 md:h-10 w-auto" />
          <span className="font-bold text-xl tracking-tight text-brand-primary">MillionsNest</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <a href="#musicscale" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">MusicScale</a>
          <a href="#funcionalidades" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Funcionalidades</a>
          <a href="#ecossistema" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Ecossistema</a>
          <a href="#precos" className="text-sm font-medium text-brand-primary/80 hover:text-brand-primary transition-colors">Preços</a>
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <a href="#" className="text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors">Entrar</a>
          <a href="#precos" className="text-sm font-medium px-5 py-2.5 rounded-full bg-brand-primary text-white hover:bg-brand-primary/90 transition-all shadow-sm hover:shadow active:scale-95">
            Teste Grátis de 7 Dias
          </a>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="lg:hidden text-brand-primary"
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
            className="absolute top-full left-0 right-0 bg-white border-b border-brand-primary/10 shadow-lg p-6 flex flex-col gap-4 lg:hidden"
          >
            <a href="#musicscale" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>MusicScale</a>
            <a href="#funcionalidades" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Funcionalidades</a>
            <a href="#ecossistema" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Ecossistema</a>
            <a href="#precos" className="text-lg font-medium text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Preços</a>
            <hr className="border-brand-primary/10" />
            <a href="#" className="text-lg font-medium text-brand-primary/80">Entrar</a>
            <a href="#precos" className="text-lg font-medium bg-brand-primary text-white text-center py-3 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Teste Grátis de 7 Dias</a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
