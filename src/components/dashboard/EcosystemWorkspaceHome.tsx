import React from 'react';
import { useTranslation } from 'react-i18next';
import { MusicScaleGuideCenter } from './MusicScaleGuideCenter.js';
import { EcosystemApp } from '../../lib/apps.js';
import { 
  Music, Check, Users, ShieldCheck, User, Settings, ArrowRight, Play, ExternalLink, Mail, Clock, LayoutGrid, Info
, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupportHub } from '../support/SupportHubContext.js';

interface EcosystemWorkspaceHomeProps {
  selectedWorkspace: string;
  installedApps: EcosystemApp[];
  organization: any;
  subscription: any;
  members: any[];
  pendingInvites: any[];
  currentUserPerms: Record<string, boolean>;
  isGlobalAdmin: boolean;
  msIsInstalled: boolean;
  msCatalogState: string;
  musicScaleApp?: EcosystemApp;
  occupiedSlots: number;
  maxUsersLimit: number;
  onSelectWorkspace: (workspaceId: string) => void;
  onLaunchApp: (app: EcosystemApp) => void;
  onOpenInviteModal: () => void;
  onNavigateToOrganizationMembers: () => void;
  onNavigateToBilling: () => void;
  onNavigateToOrganizationSettings: () => void;
  activeSection: 'overview' | 'resources' | 'getting-started';
  onSelectMusicScaleSection: (section: 'overview' | 'resources' | 'getting-started') => void;
}

export function EcosystemWorkspaceHome({
  selectedWorkspace,
  installedApps,
  organization,
  subscription,
  members,
  pendingInvites,
  currentUserPerms,
  isGlobalAdmin,
  msIsInstalled,
  msCatalogState,
  musicScaleApp,
  occupiedSlots,
  maxUsersLimit,
  onSelectWorkspace,
  onLaunchApp,
  onOpenInviteModal,
  onNavigateToOrganizationMembers,
  onNavigateToBilling,
  onNavigateToOrganizationSettings,
  activeSection,
  onSelectMusicScaleSection
}: EcosystemWorkspaceHomeProps) {
  const { t } = useTranslation(['dashboard']);
  const { openRequest } = useSupportHub();

  // Selector UI
  const renderWorkspaceSelector = () => {
    return (
      <div className="mb-8 border-b border-white/5 pb-4 overflow-x-auto no-scrollbar">
        <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-wider mb-4">{t('workspace.spaces_title', 'Seus espaços')}</h3>
        <div className="flex items-center gap-4 min-w-max">
          <button
            type="button"
            onClick={() => onSelectWorkspace('home')}
            role="tab"
            aria-selected={selectedWorkspace === 'home'}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 border ${
              selectedWorkspace === 'home' 
                ? 'bg-white/10 border-white/10 text-white shadow-lg' 
                : 'bg-transparent border-transparent text-[#A0A7B5] hover:bg-white/5'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedWorkspace === 'home' ? 'bg-[#2B85EB]/20 text-[#2B85EB]' : 'bg-white/5'}`}>
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">{t('navigation.home', 'Início')}</p>
            </div>
          </button>

          {installedApps.map(app => {
            const isSelected = selectedWorkspace === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => onSelectWorkspace(app.id)}
                role="tab"
                aria-selected={isSelected}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 border ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#2B85EB]/10 to-[#1e5b9f]/10 border-[#2B85EB]/30 text-white shadow-[0_0_20px_rgba(43,133,235,0.15)]' 
                    : 'bg-transparent border-transparent text-[#A0A7B5] hover:bg-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#2B85EB] text-white shadow-md' : 'bg-white/5'}`}>
                   {app.id === 'musicscale' ? <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-5 h-5 object-contain" /> : <LayoutGrid className="w-4 h-4" />}
                </div>
                <div className="text-left pr-2">
                  <p className="text-sm font-semibold">{app.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHomeWorkspace = () => {
    return (
      <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <h2 className="text-2xl font-bold text-white mb-2">{t('workspace.intro', 'Seus aplicativos, organização e equipe em um só lugar')}</h2>
        
        {installedApps.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold text-white mb-4">{t('workspace.apps_title', 'Seus aplicativos')}</h3>
            <div className={`grid gap-4 ${installedApps.length === 1 ? 'grid-cols-1 max-w-[480px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {installedApps.map(app => {
                if (app.id === 'musicscale') {
                  const isLoading = msCatalogState === "loading";
                  const hasPaymentIssue = msCatalogState === "payment_issue";
                  
                  const isReadyToOpen = msIsInstalled && !isLoading && !hasPaymentIssue;
                  const teamStarted = members.length > 1 || pendingInvites.length > 0;

                  return (
                    <div key={app.id} className="bg-[#050505] border border-white/10 hover:border-white/20 transition-all rounded-2xl p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                            <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-7 h-7 object-contain" />
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            msCatalogState === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            msCatalogState === 'trialing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            hasPaymentIssue ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            isLoading ? 'bg-white/10 text-white border border-white/20' :
                            'bg-white/10 text-[#A0A7B5]'
                          }`}>
                            {isLoading 
                              ? t('workspace.loading', 'Carregando')
                              : hasPaymentIssue 
                                ? t('workspace.payment_pending', 'Pagamento pendente')
                                : t(`musicscale.status.${msCatalogState}`, msCatalogState)
                            }
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">MusicScale</h4>
                        <p className="text-sm text-[#A0A7B5] mb-6 line-clamp-2">{app.shortDescription || app.description}</p>
                      </div>
                      
                      <button
                        type="button"
                        aria-label={app.name}
                        onClick={() => {
                          if (hasPaymentIssue) onNavigateToBilling();
                          else onLaunchApp(app);
                        }}
                        disabled={isLoading || (!isReadyToOpen && !hasPaymentIssue)}
                        className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 ${
                          hasPaymentIssue ? 'bg-red-500 hover:bg-red-600 text-white' :
                          isReadyToOpen ? 'bg-[#2B85EB] hover:bg-[#3B95FB] text-white shadow-lg shadow-[#2B85EB]/20' :
                          'bg-white/5 text-[#A0A7B5] cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (hasPaymentIssue ? <Settings className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />)}
                        {hasPaymentIssue ? t('workspace.resolve_payment', 'Regularizar pagamento') : t('workspace.open_app', `Abrir ${app.name}`, { appName: app.name })}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectWorkspace('musicscale');
                          onSelectMusicScaleSection('resources');
                        }}
                        className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 bg-white/5 hover:bg-white/10 text-white border border-white/10 mt-3 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t('musicscale.hero.learn_more', 'Conhecer recursos')}
                      </button>
                      
                      <div className="mt-4 text-center">
                        {(!teamStarted) ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectWorkspace('musicscale');
                              onSelectMusicScaleSection('getting-started');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-[#2B85EB] hover:text-[#3B95FB] font-medium transition-colors"
                          >
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#2B85EB]/20 text-[#2B85EB] font-bold uppercase tracking-wider text-[9px] mr-1">
                              {t('musicscale.center.badges.recommended', 'Recomendado')}
                            </span>
                            {t('musicscale.home.new_here', 'Novo por aqui? Veja os primeiros passos')} &rarr;
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectWorkspace('musicscale');
                              onSelectMusicScaleSection('getting-started');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-[#A0A7B5] hover:text-white font-medium transition-colors"
                          >
                            {t('musicscale.home.review_steps', 'Rever primeiros passos')} &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // Generic App
                return (
                  <div key={app.id} className="bg-[#050505] border border-white/10 hover:border-white/20 transition-all rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                          <LayoutGrid className="w-6 h-6 text-white" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                          {t('workspace.available', 'Disponível')}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">{app.name}</h4>
                      <p className="text-sm text-[#A0A7B5] mb-6 line-clamp-2">{app.shortDescription || app.description}</p>
                    </div>
                    
                    <button
                      type="button"
                      aria-label={app.name}
                      onClick={() => onLaunchApp(app)}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {t('workspace.open_app', `Abrir ${app.name}`, { appName: app.name })}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

    const renderMusicScaleWorkspace = () => {
    const isLoading = msCatalogState === "loading";
    const hasPaymentIssue = msCatalogState === "payment_issue";
    
    const isReadyToOpen = msIsInstalled && !isLoading && !hasPaymentIssue;
    
    const orgActive = !!organization;
    const msActive = msIsInstalled;
    const teamStarted = members.length > 1 || pendingInvites.length > 0;

    const heroContent = (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-white/10 rounded-3xl p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2B85EB]/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex-1 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-8 h-8" />
              <h2 className="text-xl font-bold text-white tracking-tight">MusicScale</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ 
                msCatalogState === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                msCatalogState === 'trialing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                msCatalogState === 'payment_issue' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                'bg-white/10 text-[#A0A7B5]'
              }`}> 
                {t(`musicscale.status.${msCatalogState}`, msCatalogState)}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
              {t('musicscale.hero.title', 'Seu ministério organizado em um só lugar')}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#A0A7B5] mb-8"> 
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#2B85EB]"/> {t('musicscale.features.repertoire', 'Repertórios')}</span> 
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#2B85EB]"/> {t('musicscale.features.scales', 'Escalas')}</span> 
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#2B85EB]"/> {t('musicscale.features.musicians', 'Músicos')}</span> 
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#2B85EB]"/> {t('musicscale.features.preparation', 'Preparação')}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!hasPaymentIssue ? (
              <button 
                type="button"
                onClick={() => { if(musicScaleApp) onLaunchApp(musicScaleApp); }}
                className="px-6 py-3 bg-[#2B85EB] text-white font-semibold rounded-xl hover:bg-[#3B95FB] transition-all flex items-center gap-2"
              >
                Abrir MusicScale
                <ExternalLink className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4" />
                Assinatura pendente
              </div>
            )}
            <button type="button" onClick={() => onSelectMusicScaleSection('getting-started')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">Primeiros passos</button>
            <button type="button" onClick={() => onSelectMusicScaleSection('resources')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">Conhecer recursos</button>
          </div>
          </div>
        </div>
    );

    const overviewContent = (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* FEATURES */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">{t('musicscale.features.title', 'Recursos do MusicScale')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 flex gap-4 items-start"> 
                  <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] flex items-center justify-center shrink-0"> 
                    <Music className="w-5 h-5" /> 
                  </div> 
                  <div> 
                    <h4 className="font-semibold text-white mb-1">{t('musicscale.features.repertoire', 'Repertórios')}</h4> 
                    <p className="text-xs text-[#A0A7B5]">{t('musicscale.features.repertoire_desc', 'Gerencie o acervo da igreja')}</p> 
                  </div>
                </div>
                <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 flex gap-4 items-start"> 
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0"> 
                    <LayoutGrid className="w-5 h-5" /> 
                  </div> 
                  <div> 
                    <h4 className="font-semibold text-white mb-1">{t('musicscale.features.scales', 'Escalas')}</h4> 
                    <p className="text-xs text-[#A0A7B5]">{t('musicscale.features.scales_desc', 'Organize as ministrações')}</p> 
                  </div>
                </div>
                <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 flex gap-4 items-start"> 
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#2B85EB] flex items-center justify-center shrink-0"> 
                    <Users className="w-5 h-5" /> 
                  </div> 
                  <div> 
                    <h4 className="font-semibold text-white mb-1">{t('musicscale.features.musicians', 'Músicos')}</h4> 
                    <p className="text-xs text-[#A0A7B5]">{t('musicscale.features.musicians_desc', 'Gerencie perfis e funções')}</p> 
                  </div>
                </div>
                <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 flex gap-4 items-start"> 
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0"> 
                    <Check className="w-5 h-5" /> 
                  </div> 
                  <div> 
                    <h4 className="font-semibold text-white mb-1">{t('musicscale.features.preparation', 'Preparação')}</h4> 
                    <p className="text-xs text-[#A0A7B5]">{t('musicscale.features.preparation_desc', 'Arquivos e ensaios')}</p> 
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* ACTIONS */}
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-wider mb-4">{t('musicscale.actions.title', 'Ações Rápidas')}</h3>
              <div className="space-y-2"> 
                <button type="button"  
                  onClick={() => { if (musicScaleApp) onLaunchApp(musicScaleApp); }}
                  disabled={!isReadyToOpen}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"> 
                  <span className="flex items-center gap-3"><Play className="w-4 h-4 text-[#A0A7B5]" /> {t('musicscale.actions.open_app', 'Abrir sistema')}</span> 
                </button>
                
                {(currentUserPerms['organization.members.invite'] || isGlobalAdmin) && (
                  <button 
                    type="button"
                    onClick={onOpenInviteModal}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group"
                  > 
                    <span className="flex items-center gap-3"><User className="w-4 h-4 text-[#A0A7B5]" /> {t('musicscale.actions.invite', 'Convidar pessoas')}</span> 
                  </button>
                )}
                
                {(currentUserPerms['organization.members.manage'] || isGlobalAdmin) && (
                  <button 
                    type="button"
                    onClick={onNavigateToOrganizationMembers}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group"
                  > 
                    <span className="flex items-center gap-3"><Users className="w-4 h-4 text-[#A0A7B5]" /> {t('musicscale.actions.manage_team', 'Gerenciar equipe')}</span> 
                  </button>
                )}
                
                {(currentUserPerms['organization.billing.manage'] || isGlobalAdmin) && (
                  <button 
                    type="button"
                    onClick={onNavigateToBilling}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group"
                  > 
                    <span className="flex items-center gap-3"><Settings className="w-4 h-4 text-[#A0A7B5]" /> {t('musicscale.actions.view_sub', 'Ver assinatura')}</span> 
                  </button>
                )}
                
                <button type="button"  
                  onClick={() => onSelectMusicScaleSection('resources')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group min-h-[44px]"> 
                  <span className="flex items-center gap-3"><ExternalLink className="w-4 h-4 text-[#A0A7B5]" /> {t('musicscale.actions.learn_more', 'Conhecer recursos')}</span> 
                </button>
                
                <button  
                  type="button"
                  onClick={openRequest}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-white transition-colors group min-h-[44px]"> 
                  <span className="flex items-center gap-3"><Mail className="w-4 h-4 text-[#A0A7B5]" /> {t('support.actions.need_help', t('musicscale.actions.need_help', 'Preciso de ajuda'))}</span> 
                </button>
              </div>
            </div>

            {/* TEAM SUMMARY */}
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4"> 
                <div className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center shrink-0"> 
                  <Users className="w-4 h-4" /> 
                </div> 
                <h3 className="font-bold text-white">{t('musicscale.team.title', 'Equipe')}</h3>
              </div>
              <p className="text-sm text-[#A0A7B5] mb-6">
                {t('musicscale.team.desc', 'Convide líderes, músicos e vocais para trabalharem na mesma organização.')}
              </p>
              
              <div className="flex flex-col gap-2 mb-6"> 
                <div className="flex justify-between items-center text-sm"> 
                  <span className="text-[#A0A7B5]">{t('musicscale.team.members', `${members.length} membros`, { count: members.length })}</span> 
                  <span className="text-white font-medium">{members.length}</span> 
                </div> 
                <div className="flex justify-between items-center text-sm"> 
                  <span className="text-[#A0A7B5]">{t('musicscale.team.invites', `${pendingInvites.length} convites`, { count: pendingInvites.length })}</span> 
                  <span className="text-white font-medium">{pendingInvites.length}</span> 
                </div> 
                <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center text-sm font-semibold"> 
                  <span className="text-white">Total</span> 
                  <span className="text-[#2B85EB]"> 
                    {maxUsersLimit === -1 
                      ? t('musicscale.team.slots_unlimited', `${occupiedSlots} vagas (ilimitado)`, { used: occupiedSlots })
                      : t('musicscale.team.slots', `${occupiedSlots}/${maxUsersLimit} vagas`, { used: occupiedSlots, total: maxUsersLimit })
                    }
                  </span> 
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                {(currentUserPerms['organization.members.invite'] || isGlobalAdmin) && (
                  <button 
                    type="button"
                    onClick={onOpenInviteModal}
                    className="w-full py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    {t('musicscale.actions.invite_person', 'Convidar pessoa')}
                  </button>
                )}
                {(currentUserPerms['organization.members.manage'] || isGlobalAdmin) && (
                  <button 
                    type="button"
                    onClick={onNavigateToOrganizationMembers}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-colors text-sm border border-white/5"
                  >
                    {t('musicscale.actions.view_team_and_invites', 'Ver equipe e convites')}
                  </button>
                )}
              </div>
            </div>

            {/* HELP INFO */}
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-6"> 
              <h3 className="text-sm font-bold text-white mb-2">Não sabe por onde começar?</h3> 
              <p className="text-xs text-[#A0A7B5] mb-4">Veja o passo a passo para preparar sua equipe, adicionar músicas e criar sua primeira escala.</p> 
              <div className="space-y-2"> 
                <button type="button"  onClick={() => onSelectMusicScaleSection('getting-started')} className="text-sm text-[#2B85EB] hover:text-[#3B95FB] font-medium block min-h-[44px]"> 
                  Aprender a usar &rarr;
                </button> 
                <button 
                  type="button"
                  onClick={openRequest}
                  className="text-sm text-[#A0A7B5] hover:text-white font-medium block min-h-[44px] text-left"
                > 
                  {t('support.actions.contact_support', t('musicscale.help.contact_support', 'Falar com suporte'))}
                </button> 
              </div>
            </div>
          </div>
        </div>
    );

    return (
      <MusicScaleGuideCenter
        activeSection={activeSection}
        organizationReady={orgActive}
        musicScaleReady={msActive}
        teamStarted={teamStarted}
        canInvite={Boolean(currentUserPerms['organization.members.invite'] || isGlobalAdmin)}
        canManageTeam={Boolean(currentUserPerms['organization.members.manage'] || isGlobalAdmin)}
        canManageOrganization={Boolean(currentUserPerms['organization.settings.update'] || isGlobalAdmin)}
        canManageBilling={Boolean(currentUserPerms['organization.billing.manage'] || isGlobalAdmin)}
        hasPaymentIssue={hasPaymentIssue}
        onSelectSection={onSelectMusicScaleSection}
        onOpenInviteModal={onOpenInviteModal}
        onManageTeam={onNavigateToOrganizationMembers}
        onReviewOrganization={onNavigateToOrganizationSettings}
        onOpenMusicScale={() => {
          if (musicScaleApp) onLaunchApp(musicScaleApp);
        }}
        onNavigateToBilling={onNavigateToBilling}
        heroContent={heroContent}
        overviewContent={overviewContent}
        memberCount={members.length}
        pendingInviteCount={pendingInvites.length}
      />
    );
  };
const renderGenericAppWorkspace = (app: EcosystemApp) => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-2xl">
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-8">
           <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
             <LayoutGrid className="w-6 h-6 text-[#A0A7B5]" />
           </div>
           <h2 className="text-2xl font-bold text-white mb-2">{app.name}</h2>
           <p className="text-[#A0A7B5] mb-8">{app.description}</p>
           
           <div className="flex items-center gap-4">
             {app.primaryAction === 'open' && (
               <button 
                 type="button"
                 onClick={() => onLaunchApp(app)}
                 className="px-6 py-3 bg-[#2B85EB] text-white font-semibold rounded-xl hover:bg-[#3B95FB] transition-all"
               >
                 {t('genericApp.open', 'Abrir App')}
               </button>
             )}
             {app.status === 'coming_soon' && (
               <span className="px-4 py-2 bg-white/5 text-[#A0A7B5] rounded-xl text-sm font-medium border border-white/5">
                 Em breve
               </span>
             )}
           </div>
        </div>
      </div>
    );
  };

  const currentApp = installedApps.find(a => a.id === selectedWorkspace);

  return (
    <div className="w-full">
      {renderWorkspaceSelector()}
      
      {selectedWorkspace === 'home' && renderHomeWorkspace()}
      {selectedWorkspace === 'musicscale' && renderMusicScaleWorkspace()}
      {selectedWorkspace !== 'home' && selectedWorkspace !== 'musicscale' && currentApp && renderGenericAppWorkspace(currentApp)}
    </div>
  );
}
