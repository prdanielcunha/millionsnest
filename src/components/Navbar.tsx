import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';
import { MillionsNestLogo } from './MillionsNestLogo.js';
import { LayoutDashboard, LogOut, Menu, X, Search, LayoutGrid, Music, Users, ShieldCheck, CreditCard, Wallet, Calendar, QrCode } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils.js';
import { useTranslation } from 'react-i18next';
import { ECOSYSTEM_APPS, type EcosystemApp } from '../lib/apps.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';

export function Navbar() {
  const { user, profile, logout } = useAuth();
  const { organization, currentUserPerms } = useOrganization();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation(['common']);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close launcher when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (launcherOpen && !target.closest('.command-center-container')) {
        setLauncherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [launcherOpen]);

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true
    }));
  };

  const handleLaunch = async (app: EcosystemApp) => {
    setLauncherOpen(false);
    if (!profile || !organization) return;
    try {
      await openEcosystemModule(app.id, user, profile, organization, currentUserPerms);
    } catch (e: any) {
      alert(e.message || 'Erro ao abrir app');
    }
  };

  const renderCommandCenter = () => {
    const myApps = ECOSYSTEM_APPS.filter(app => {
      const isInstalled = organization?.enabledApps?.includes(app.id) || (app.id === 'musicscale' && (profile?.products?.includes('musicscale') || false));
      return isInstalled || app.status === 'active';
    }).map(app => {
      const isInstalled = organization?.enabledApps?.includes(app.id) || (app.id === 'musicscale' && (profile?.products?.includes('musicscale') || false));
      return { ...app, isInstalled };
    }).filter(app => app.isInstalled || app.id === 'musicscale'); // ensure we show installed or flagship

    const discoverApps = ECOSYSTEM_APPS.filter(app => {
      const isInstalled = organization?.enabledApps?.includes(app.id) || (app.id === 'musicscale' && (profile?.products?.includes('musicscale') || false));
      return !isInstalled && app.status !== 'active';
    });

    return (
      <AnimatePresence>
        {launcherOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 md:right-0 -right-[4.5rem] top-full mt-4 w-[90vw] max-w-[400px] bg-[#050505] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col z-50 text-left origin-top-right ring-1 ring-white/5"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#2B85EB]/10 blur-2xl rounded-full" />
              <div className="relative z-10">
                <span className="text-lg font-bold text-white tracking-tight">Command Center</span>
                <p className="text-xs text-[#A0A7B5] mt-0.5">{t('common:nav_ecosystem_subtitle', 'Seu ecossistema de apps')}</p>
              </div>
            </div>
            
            <div className="p-3 overflow-y-auto max-h-[60vh] custom-scrollbar bg-[#0B0F19]/50">
              {/* My Apps Section */}
              {myApps.length > 0 && (
                <div className="mb-6">
                  <div className="px-3 py-2 text-[10px] font-bold text-[#A0A7B5] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {t('common:nav_my_apps', 'Meus apps')}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {myApps.map(app => {
                      const Icon = app.icon === 'Music' ? Music :
                                   app.icon === 'Users' ? Users :
                                   app.icon === 'ShieldCheck' ? ShieldCheck :
                                   app.icon === 'CreditCard' ? CreditCard :
                                   app.icon === 'Wallet' ? Wallet :
                                   app.icon === 'Calendar' ? Calendar :
                                   app.icon === 'QrCode' ? QrCode : LayoutGrid;
                      
                      return (
                        <div key={`active-${app.id}`} className="group relative flex flex-col p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all">
                          <div className="flex items-start gap-4">
                            <button
                              onClick={() => app.isInstalled ? handleLaunch(app) : null}
                              className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-[10px] transition-all shadow-inner ${app.isInstalled ? 'bg-gradient-to-br from-[#2B85EB]/20 to-[#2B85EB]/5 text-[#2B85EB] border border-[#2B85EB]/20 cursor-pointer group-hover:scale-105' : 'bg-white/5 text-[#A0A7B5] cursor-default'}`}
                            >
                              <Icon className="w-6 h-6" />
                            </button>
                            <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                              <span className="text-sm font-semibold text-white truncate group-hover:text-[#2B85EB] transition-colors">{app.name}</span>
                              <span className="text-[11px] text-[#A0A7B5] line-clamp-2 mt-1 leading-relaxed">{app.shortDescription || app.description}</span>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-2 pl-[4rem]">
                            {app.isInstalled && (
                              <button
                                onClick={() => handleLaunch(app)}
                                className="px-4 py-1.5 bg-[#2B85EB] text-white text-xs font-semibold rounded-lg hover:bg-[#3B95FB] transition-all shadow-md active:scale-95"
                              >
                                {t('common:nav_open', 'Abrir')}
                              </button>
                            )}
                            {app.landingRoute && (
                              <Link
                                to={app.landingRoute}
                                onClick={() => setLauncherOpen(false)}
                                className="px-4 py-1.5 bg-white/5 text-white text-xs font-semibold rounded-lg hover:bg-white/10 border border-white/5 transition-all"
                              >
                                {t('common:nav_learn', 'Conhecer')}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discover Section */}
              {discoverApps.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold text-[#A0A7B5] uppercase tracking-widest mb-2 flex items-center gap-2 border-t border-white/5 pt-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {t('common:nav_discover', 'Descobrir')}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {discoverApps.map(app => {
                      const Icon = app.icon === 'Music' ? Music :
                                   app.icon === 'Users' ? Users :
                                   app.icon === 'ShieldCheck' ? ShieldCheck :
                                   app.icon === 'CreditCard' ? CreditCard :
                                   app.icon === 'Wallet' ? Wallet :
                                   app.icon === 'Calendar' ? Calendar :
                                   app.icon === 'QrCode' ? QrCode : LayoutGrid;
                      
                      return (
                        <div key={`soon-${app.id}`} className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] opacity-70 hover:opacity-100 transition-opacity">
                          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-[10px] bg-white/5 text-[#A0A7B5] border border-white/5">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#F5F7FA] truncate">{app.name}</span>
                              <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-[#F5F7FA] uppercase tracking-wider font-bold shrink-0">{t('common:nav_coming_soon', 'Em breve')}</span>
                            </div>
                            <span className="text-[11px] text-[#A0A7B5] line-clamp-2 mt-1 leading-relaxed">{app.shortDescription || app.description}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Footer gradient */}
            <div className="h-4 bg-gradient-to-t from-[#0B0F19] to-transparent shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 shadow-lg py-3'
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
              <Link to="/musicscale" className="text-sm font-medium text-[#A0A7B5] hover:text-white transition-colors">{t('common:nav_musicscale', 'MusicScale')}</Link>
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
              
              <div className="relative command-center-container">
                <button 
                  onClick={() => setLauncherOpen(!launcherOpen)}
                  className={cn(
                    "w-10 h-10 rounded-lg border flex items-center justify-center transition-all",
                    launcherOpen 
                      ? "bg-white/10 border-white/20 text-white shadow-inner" 
                      : "bg-white/5 border-white/5 hover:bg-white/10 text-[#A0A7B5] hover:text-[#F5F7FA]"
                  )}
                  title="Command Center"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                {renderCommandCenter()}
              </div>

              <Link to="/dashboard" className="px-5 py-2 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-sm font-semibold rounded-lg shadow-lg flex items-center gap-2 transition-colors active:scale-95">
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
              }} className="text-sm font-medium px-6 py-2.5 rounded-lg bg-white text-black hover:bg-gray-100 transition-all shadow-md hover:shadow-lg active:scale-95">
                {t('common:free_trial', 'Teste grátis')}
              </button>
            </>
          )}
        </div>

        {/* Mobile Toggle & Search */}
        <div className="lg:hidden flex items-center gap-3">
          <LanguageSwitcher />
          {user && (
            <>
              <button 
                className="text-[#A0A7B5] hover:text-white transition-colors bg-white/5 p-2 rounded-lg"
                onClick={openSearch}
              >
                <Search size={20} />
              </button>
              <div className="relative command-center-container">
                <button 
                  onClick={() => setLauncherOpen(!launcherOpen)}
                  className={cn(
                    "text-[#A0A7B5] hover:text-[#F5F7FA] transition-colors p-2 rounded-lg flex items-center justify-center border",
                    launcherOpen ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/5"
                  )}
                >
                  <LayoutGrid size={20} />
                </button>
                {renderCommandCenter()}
              </div>
            </>
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
            className="absolute top-full left-0 right-0 bg-[#050505] border-b border-white/10 shadow-2xl p-6 flex flex-col gap-5 lg:hidden"
          >
            <Link to="/musicscale" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_musicscale', 'MusicScale')}</Link>
            <a href="/#funcionalidades" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_features', 'Funcionalidades')}</a>
            <a href="/#ecossistema" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_ecosystem', 'Ecossistema')}</a>
            <a href="/#precos" className="text-lg font-medium text-[#F5F7FA]" onClick={() => setMobileMenuOpen(false)}>{t('common:nav_pricing', 'Preços')}</a>
            <hr className="border-white/10 my-2" />
            {user ? (
               <>
                 <div className="flex items-center justify-between text-[#F5F7FA] font-medium px-2">
                   <span className="truncate max-w-[200px]">{profile?.displayName || user.email}</span>
                   <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="p-2 text-[#A0A7B5] hover:text-red-400 bg-white/5 rounded-lg transition-colors" title={t('common:logout')}>
                     <LogOut className="w-5 h-5"/>
                   </button>
                 </div>
                 <Link to="/dashboard" className="text-lg font-semibold bg-[#2B85EB] text-white text-center py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all" onClick={() => setMobileMenuOpen(false)}>
                   <LayoutDashboard className="w-5 h-5" /> {t('common:dashboard', 'Painel Central')}
                 </Link>
               </>
            ) : (
               <>
                <Link to="/login" className="text-lg font-medium text-[#A0A7B5] hover:text-white text-center py-2" onClick={() => setMobileMenuOpen(false)}>{t('common:login', 'Entrar')}</Link>
                <button onClick={() => { 
                  sessionStorage.setItem('purchase_intent', 'musicscale_starter_monthly');
                  setMobileMenuOpen(false);
                  navigate('/login');
                }} className="text-lg font-bold w-full bg-white text-black hover:bg-gray-100 text-center py-4 rounded-xl shadow-lg active:scale-95 transition-all">
                  {t('common:free_trial_full', 'Teste Grátis de 7 Dias')}
                </button>
               </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
