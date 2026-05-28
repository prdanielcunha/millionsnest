import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, LogOut, LayoutDashboard, LayoutGrid, Building, User, ChevronDown, Music, Users, ShieldCheck, CreditCard, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils.js';
import { useTranslation, Trans } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';
import { eventBus } from '../packages/events/index.js';
import { ECOSYSTEM_APPS, EcosystemApp } from '../lib/apps.js';
import { ecosystemPlatform } from '../sdk/ecosystem.js';
import { MillionsNestLogo } from './MillionsNestLogo.js';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const { user, profile, logout } = useAuth();
  // Safe default object for organization context incase it throws if not within provider
  let organization: any = null;
  let currentUserPerms: any = {};
  
  try {
    const orgContext = useOrganization();
    organization = orgContext.organization;
    currentUserPerms = orgContext.currentUserPerms;
  } catch(e) {
    // If not wrapped in OrgProvider, ignore
  }

  const { t } = useTranslation(['common']);
  const navigate = useNavigate();

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
  
  const handleLaunch = async (app: EcosystemApp) => {
    setLauncherOpen(false);
    if (!profile || !organization) return;
    await ecosystemPlatform.launchModule(app.id, app.url, user, profile, organization, currentUserPerms);
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
          <MillionsNestLogo className="h-10 md:h-12 w-auto transition-transform group-hover:scale-105" />
          <span className="font-semibold text-lg tracking-tight text-[#F5F7FA]">MillionsNest</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {!user && (
            <>
              <a href="/#musicscale" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:nav_musicscale', 'MusicScale')}</a>
              <a href="/#funcionalidades" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:nav_features', 'Funcionalidades')}</a>
              <a href="/#ecossistema" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:nav_ecosystem', 'Ecossistema')}</a>
              <a href="/#precos" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:nav_pricing', 'Valores')}</a>
            </>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-[#A0A7B5] text-sm">Painel Central</span>
              <span className="text-[#A0A7B5]/50">/</span>
              <span className="text-[#F5F7FA] text-sm font-medium">{organization?.name || profile?.displayName || 'Minha Organização'}</span>
            </div>
          )}
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={openSearch} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors"
                title="Buscar (Cmd+K)"
              >
                <Search className="w-4 h-4" />
                <span className="text-xs font-medium opacity-50">⌘K</span>
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setLauncherOpen(!launcherOpen)}
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center text-[#A0A7B5] hover:text-[#F5F7FA] transition-all"
                  title="App Launcher"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                
                <AnimatePresence>
                  {launcherOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-3 w-80 bg-[#0B0F19] border border-white/10 shadow-2xl rounded-2xl overflow-hidden p-2 grid grid-cols-2 gap-2"
                    >
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-[#A0A7B5] uppercase tracking-widest border-b border-white/5 mb-1">
                        Módulos Ativos
                      </div>
                      
                      {ECOSYSTEM_APPS.map(app => {
                         const isInstalled = organization?.enabledApps?.includes(app.id) || (app.id === 'musicscale' && (profile?.products?.includes('musicscale') || false));
                         
                         const Icon = app.icon === 'Music' ? Music : 
                                      app.icon === 'Users' ? Users : 
                                      app.icon === 'ShieldCheck' ? ShieldCheck : 
                                      app.icon === 'CreditCard' ? CreditCard : LayoutGrid;
                         
                         return (
                           <button
                             key={app.id}
                             disabled={!isInstalled}
                             onClick={() => handleLaunch(app)}
                             className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all ${isInstalled ? 'hover:bg-white/5 cursor-pointer text-[#F5F7FA]' : 'opacity-40 cursor-not-allowed text-[#A0A7B5]'}`}
                           >
                             <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${isInstalled ? 'bg-[#2B85EB]/10 text-[#2B85EB]' : 'bg-white/5 text-[#A0A7B5]'}`}>
                               <Icon className="w-5 h-5" />
                             </div>
                             <span className="text-xs font-medium text-center">{app.name}</span>
                           </button>
                         );
                      })}
                      
                      <div className="col-span-2 p-2 mt-2">
                        <Link 
                           to="/dashboard"
                           onClick={() => setLauncherOpen(false)}
                           className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-[#F5F7FA] flex items-center justify-center transition-colors"
                        >
                           Gerenciar Painel
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link to="/dashboard" className="px-4 py-2 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-sm font-semibold rounded-lg shadow-lg flex items-center gap-2 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                Painel
              </Link>
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                 <button onClick={logout} className="p-2 text-[#A0A7B5] hover:text-white transition-colors rounded-lg hover:bg-white/5" title={t('common:logout')}>
                    <LogOut className="w-4 h-4" />
                 </button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:login', 'Entrar')}</Link>
              <button onClick={() => {
                sessionStorage.setItem('purchase_intent', 'musicscale_starter_monthly');
                navigate('/login');
              }} className="text-sm font-medium px-5 py-2.5 rounded-lg bg-[#F5F7FA] text-[#050505] hover:bg-white transition-all shadow-sm hover:shadow active:scale-95">
                {t('common:free_trial', 'Teste grátis')}
              </button>
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
            <a href="/#musicscale" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_musicscale', 'MusicScale')}</a>
            <a href="/#funcionalidades" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_features', 'Funcionalidades')}</a>
            <a href="/#ecossistema" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_ecosystem', 'Ecossistema')}</a>
            <a href="/#precos" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_pricing', 'Preços')}</a>
            <hr className="border-white/10" />
            {user ? (
               <>
                 <div className="flex items-center justify-between text-[#F5F7FA] font-medium">
                   <span className="truncate">{profile?.displayName || user.email}</span>
                   <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="p-2 text-[#A0A7B5] hover:text-white" title={t('common:logout')}><LogOut className="w-5 h-5"/></button>
                 </div>
                 <Link to="/dashboard" className="text-lg font-medium bg-[#F5F7FA] text-[#050505] text-center py-3 rounded-lg flex items-center justify-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                   <LayoutDashboard className="w-5 h-5" /> {t('common:dashboard', 'Painel Central')}
                 </Link>
               </>
            ) : (
               <>
                <Link to="/login" className="text-lg font-medium text-[#A0A7B5] hover:text-white" onClick={() => setMobileMenuOpen(false)}>{t('common:login', 'Entrar')}</Link>
                <button onClick={() => { 
                  sessionStorage.setItem('purchase_intent', 'musicscale_starter_monthly');
                  setMobileMenuOpen(false);
                  navigate('/login');
                }} className="text-lg font-medium w-full bg-[#F5F7FA] text-[#050505] hover:bg-white text-center py-3 rounded-lg">{t('common:free_trial_full', 'Teste Grátis de 7 Dias')}</button>
               </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
