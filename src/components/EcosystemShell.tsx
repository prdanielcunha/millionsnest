import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutGrid, LayoutDashboard, Building2, ChevronDown, Check, LogOut, ArrowRight, Loader2, User, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';
import { ECOSYSTEM_APPS, EcosystemApp } from '../lib/apps.js';
import { ecosystemPlatform } from '../sdk/ecosystem.js';
import { eventBus } from '../packages/events/index.js';
import { Link, useNavigate } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { OperationalDiagnosticsUI } from './OperationalDiagnosticsUI.js';

interface EcosystemShellProps {
  children: ReactNode;
  activeAppId?: string; // e.g., 'core', 'musicscale'
}

export function EcosystemShell({ children, activeAppId = 'core' }: EcosystemShellProps) {
  const { user, profile, logout, switchOrganization } = useAuth();
  
  let organization: any = null;
  let currentUserPerms: any = {};
  try {
    const orgContext = useOrganization();
    organization = orgContext.organization;
    currentUserPerms = orgContext.currentUserPerms;
  } catch(e) {}

  const [launcherOpen, setLauncherOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  
  // Transition orchestrator state
  const [launchingApp, setLaunchingApp] = useState<EcosystemApp | null>(null);
  
  const [isDegraded, setIsDegraded] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDiagnosticsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const checkDegraded = setInterval(() => {
       setIsDegraded(window.navigator.onLine === false || (window as any)._mn_degraded_mode);
    }, 5000);

    return () => {
       window.removeEventListener('keydown', handleKeyDown);
       clearInterval(checkDegraded);
    };
  }, []);

  const handleLaunch = async (app: EcosystemApp) => {
    if (!profile || !organization) return;
    
    setLauncherOpen(false);
    
    // Core is local route
    if (app.id === 'core') {
       navigate('/dashboard');
       return;
    }

    setLaunchingApp(app);
    
    // Simulate orchestration loading context
    setTimeout(async () => {
      try {
        await ecosystemPlatform.launchModule(app.id, app.url, user, profile, organization, currentUserPerms);
      } catch (e: any) {
        console.error(e);
      }
      setLaunchingApp(null);
    }, 1200);
  };

  const openSearch = () => {
    eventBus.publish('ui.command_palette.open', {
      organizationId: profile?.organizationId || 'guest',
      userId: user?.uid || 'guest',
      appSource: activeAppId
    });
  };

  const activeApp = [
    { id: 'core', name: 'Painel Central', icon: 'LayoutDashboard' },
    ...ECOSYSTEM_APPS
  ].find(a => a.id === activeAppId) || { id: 'core', name: 'Painel Central' };

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA] font-sans flex flex-col">
      {/* Ecosystem Topbar - Persistent & OS-like */}
      <header className="h-14 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-4 lg:px-6">
        
        {/* Left: Ecosystem Identity & Context */}
        <div className="flex items-center gap-3 w-1/3">
          <div className="relative group">
            <button 
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#F5F7FA]" />
              </div>
              <span className="text-sm font-semibold truncate max-w-[120px] md:max-w-[200px]">
                {organization?.name || 'Carregando...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#A0A7B5] opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Org Switcher Menu */}
            <AnimatePresence>
              {orgMenuOpen && profile?.organizations && profile.organizations.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 left-0 w-64 bg-[#0B0F19] border border-white/10 shadow-2xl rounded-xl p-1 z-50 origin-top-left"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-[#A0A7B5] uppercase tracking-widest mb-1">
                    Selecionar Organização
                  </div>
                  {profile.organizations.map((orgId: string) => (
                    <button
                      key={orgId}
                      onClick={() => {
                        setOrgMenuOpen(false);
                        switchOrganization(orgId).then(() => window.location.reload());
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#F5F7FA] hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <span className="truncate">Org: {orgId.substring(0,8)}...</span>
                      {profile.organizationId === orgId && <Check className="w-4 h-4 text-[#2B85EB]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex border-l border-white/10 h-4 mx-1" />
          
          <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-2">
            <span className="text-[#A0A7B5]">Ecosystem</span>
            <span className="text-[#A0A7B5]">/</span>
            <span className="text-[#F5F7FA] bg-white/5 px-2 py-0.5 rounded-md border border-white/10">{activeApp.name}</span>
            {isDegraded && (
               <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded ml-2 border border-orange-500/20">
                  <AlertTriangle className="w-3 h-3" /> Degraded
               </span>
            )}
          </div>
        </div>

        {/* Center: Search / OS Commands */}
        <div className="flex-1 flex justify-center max-w-md w-full mx-4">
          <button 
            onClick={openSearch}
            className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-[#0B0F19] border border-white/10 hover:border-white/20 hover:bg-white/[0.02] rounded-lg transition-all text-[#A0A7B5] shadow-sm group"
          >
            <Search className="w-3.5 h-3.5 group-hover:text-[#F5F7FA] transition-colors" />
            <span className="text-sm font-medium flex-1 text-left">Buscar no ecossistema...</span>
            <kbd className="hidden md:inline-flex items-center gap-1 text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md font-mono font-bold tracking-wider">⌘K</kbd>
          </button>
        </div>

        {/* Right: Actions, Launcher, Profile */}
        <div className="flex items-center justify-end gap-2 w-1/3">
          
          {/* Main App Launcher */}
          <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
               <Tooltip.Trigger asChild>
                 <div className="relative">
                   <button 
                     onClick={() => setLauncherOpen(!launcherOpen)}
                     className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${launcherOpen ? 'bg-white/10 text-[#F5F7FA] shadow-inner' : 'bg-transparent text-[#A0A7B5] hover:bg-white/5 hover:text-[#F5F7FA]'}`}
                   >
                     <LayoutGrid className="w-4 h-4" />
                   </button>
                   
                   <AnimatePresence>
                     {launcherOpen && (
                       <motion.div
                         initial={{ opacity: 0, scale: 0.95, y: 5 }}
                         animate={{ opacity: 1, scale: 1, y: 0 }}
                         exit={{ opacity: 0, scale: 0.95, y: 5 }}
                         transition={{ duration: 0.15, ease: "easeOut" }}
                         className="absolute top-full mt-3 right-0 w-[340px] bg-[#050505]/95 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,1)] rounded-2xl p-2 origin-top-right z-50"
                       >
                         <div className="px-3 py-2 text-[10px] font-bold text-[#A0A7B5] uppercase tracking-widest border-b border-white/5 mb-2">
                           Módulos do Ecossistema
                         </div>
                         
                         <div className="grid grid-cols-3 gap-2">
                            {/* Central App */}
                            <button
                               onClick={() => handleLaunch({ id: 'core', name: 'Painel', description: '', icon: 'Dashboard', url: '', requiredPlan: 'free', category: 'core' } as EcosystemApp)}
                               className={`flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-all ${activeAppId === 'core' ? 'bg-[#2B85EB]/10' : 'hover:bg-white/5'}`}
                            >
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${activeAppId === 'core' ? 'bg-transparent border-transparent text-[#2B85EB]' : 'bg-white/5 border-white/10 text-[#A0A7B5]'}`}>
                                 <LayoutDashboard className="w-5 h-5" />
                               </div>
                               <span className={`text-[10px] font-semibold text-center ${activeAppId === 'core' ? 'text-[#2B85EB]' : 'text-[#F5F7FA]'}`}>Painel</span>
                            </button>

                            {ECOSYSTEM_APPS.map(app => {
                               // Safe check in case organization is not loaded yet
                               const isInstalled = organization?.enabledApps?.includes(app.id) || (app.id === 'musicscale' && profile?.products?.includes('musicscale'));
                               const isActiveApp = activeAppId === app.id;
                               
                               return (
                                 <button
                                   key={app.id}
                                   disabled={!isInstalled && !isActiveApp}
                                   onClick={() => handleLaunch(app)}
                                   className={`flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-all relative ${!isInstalled && !isActiveApp ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'} ${isActiveApp ? 'bg-white/5' : ''}`}
                                 >
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isActiveApp ? 'bg-transparent border-transparent text-[#F5F7FA]' : isInstalled ? 'bg-[#2B85EB]/10 border-[#2B85EB]/20 text-[#2B85EB]' : 'bg-white/5 border-white/10 text-[#A0A7B5]'}`}>
                                     {/* Render generic icon based on class if needed, here just fallback for ui mapping */}
                                     {app.id === 'musicscale' ? <LayoutGrid className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
                                   </div>
                                   <span className={`text-[10px] font-semibold text-center ${isActiveApp ? 'text-[#F5F7FA]' : 'text-[#A0A7B5]'}`}>{app.name}</span>
                                 </button>
                               );
                            })}
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               </Tooltip.Trigger>
               <Tooltip.Portal>
                  <Tooltip.Content sideOffset={5} className="bg-[#0B0F19] border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-[#F5F7FA] uppercase tracking-widest shadow-xl">
                    Launcher
                  </Tooltip.Content>
               </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* User Profile */}
          <div className="relative">
            <button 
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-8 h-8 rounded-full border border-white/10 overflow-hidden ml-1 hover:border-white/30 transition-colors"
            >
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#0B0F19] flex items-center justify-center text-xs font-bold text-[#F5F7FA]">
                   {profile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
            </button>
            
            <AnimatePresence>
               {profileMenuOpen && (
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95, y: 5 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 5 }}
                   transition={{ duration: 0.15, ease: "easeOut" }}
                   className="absolute top-full mt-3 right-0 w-[240px] bg-[#050505]/95 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,1)] rounded-xl p-1 origin-top-right z-50"
                 >
                   <div className="p-3 border-b border-white/5 mb-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {profile?.displayName?.charAt(0) || 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold truncate">{profile?.displayName || 'Usuário'}</p>
                        <p className="text-[10px] text-[#A0A7B5] truncate">{user?.email}</p>
                      </div>
                   </div>
                   
                   <Link to="/dashboard" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[#A0A7B5] hover:text-[#F5F7FA] hover:bg-white/5 rounded-lg transition-colors">
                     <User className="w-4 h-4" /> Minha Conta
                   </Link>
                   
                   <div className="h-px bg-white/5 my-1" />
                   
                   <button onClick={() => { logout(); setProfileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                     <LogOut className="w-4 h-4" /> Sair
                   </button>
                 </motion.div>
               )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      
      {/* App Launch Transition Orchestrator */}
      <AnimatePresence>
        {launchingApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center"
          >
             <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#2B85EB]/10 blur-[150px] rounded-full pointer-events-none animate-pulse" />
             <div className="relative z-10 flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100 }}
                  className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-[#F5F7FA] mb-6 shadow-2xl"
                >
                  <LayoutGrid className="w-8 h-8 opacity-50" />
                </motion.div>
                <motion.h2 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl font-semibold tracking-tight text-[#F5F7FA] mb-2"
                >
                  Iniciando {launchingApp.name}
                </motion.h2>
                <div className="flex items-center gap-3 text-[#A0A7B5] text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2B85EB]" /> 
                  Sincronizando contexto da organização...
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative">
        {children}
      </main>

      {/* Hidden Diagnostics Panel */}
      <AnimatePresence>
         {diagnosticsOpen && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
               <OperationalDiagnosticsUI onClose={() => setDiagnosticsOpen(false)} />
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
