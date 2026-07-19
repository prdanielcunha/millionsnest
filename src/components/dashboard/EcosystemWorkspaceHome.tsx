import React from 'react';
import { useTranslation } from 'react-i18next';
import { MusicScaleGuideCenter } from './MusicScaleGuideCenter.js';
import { EcosystemApp } from '../../lib/apps.js';
import { 
  Music, Check, Users, ShieldCheck, User, Settings, ArrowRight, Play, ExternalLink, Mail, Clock, LayoutGrid, Info,
  AlertCircle, CircleHelp
} from 'lucide-react';
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
  const { openHub, openRequest } = useSupportHub();

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
    const musicScaleApp = installedApps.find(app => app.id === 'musicscale');
    const isLoading = msCatalogState === "loading";
    const hasPaymentIssue = msCatalogState === "payment_issue";
    const isReadyToOpen = msIsInstalled && !isLoading && !hasPaymentIssue;
    const progressPercent = maxUsersLimit > 0 ? Math.min(100, (occupiedSlots / maxUsersLimit) * 100) : 0;

    return (
      <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-12">
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{t('workspace.intro', 'Sua Central de Gerenciamento')}</h2>
          <p className="text-[#A0A7B5] text-sm leading-relaxed max-w-xl">
            {t('workspace.sub_intro', 'Gerencie a preparação do seu ministério de louvor e controle os acessos de segurança da sua equipe.')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT/MAIN COLUMN: MusicScale (Louvor e Ministério) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-6 bg-[#2B85EB] rounded-full"></span>
              <h3 className="text-lg font-bold text-white tracking-tight">{t('workspace.musicscale_group_title', 'MusicScale — Excelência no Louvor')}</h3>
            </div>

            {musicScaleApp ? (
              <div className="bg-[#050505] border border-white/10 hover:border-white/20 transition-all rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-[#2B85EB]/10 transition-colors" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-sm">
                      <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-8 h-8 object-contain" />
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

                  <h4 className="text-xl font-bold text-white mb-2">MusicScale</h4>
                  <p className="text-sm text-[#A0A7B5] mb-8 leading-relaxed">
                    {musicScaleApp.shortDescription || musicScaleApp.description || t('musicscale.description_default', 'A ferramenta definitiva para organização de repertórios, escalas de músicos e preparação fluida do ministério.')}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#A0A7B5] mb-8"> 
                    <span className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg"><Music className="w-3.5 h-3.5 text-[#2B85EB]"/> {t('musicscale.features.repertoire', 'Repertórios')}</span> 
                    <span className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg"><Clock className="w-3.5 h-3.5 text-[#2B85EB]"/> {t('musicscale.features.scales', 'Escalas')}</span> 
                    <span className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg"><Users className="w-3.5 h-3.5 text-[#2B85EB]"/> {t('musicscale.features.musicians', 'Músicos')}</span> 
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasPaymentIssue) onNavigateToBilling();
                      else onLaunchApp(musicScaleApp);
                    }}
                    disabled={isLoading || (!isReadyToOpen && !hasPaymentIssue)}
                    className={`flex-1 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 text-sm ${
                      hasPaymentIssue ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' :
                      isReadyToOpen ? 'bg-[#2B85EB] hover:bg-[#3B95FB] text-white shadow-lg shadow-[#2B85EB]/20' :
                      'bg-white/5 text-[#A0A7B5] cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (hasPaymentIssue ? <Settings className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />)}
                    {hasPaymentIssue ? t('workspace.resolve_payment', 'Regularizar pagamento') : t('workspace.open_app', `Abrir ${musicScaleApp.name}`, { appName: musicScaleApp.name })}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectWorkspace('musicscale');
                      onSelectMusicScaleSection('getting-started');
                    }}
                    className="py-3.5 px-5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-sm"
                  >
                    <Info className="w-4 h-4" />
                    {t('musicscale.hero.getting_started', 'Primeiros passos')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectWorkspace('musicscale');
                      onSelectMusicScaleSection('resources');
                    }}
                    className="py-3.5 px-5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('musicscale.hero.learn_more', 'Conhecer recursos')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#050505] border border-white/5 rounded-3xl p-8 text-center">
                <Music className="w-10 h-10 text-white/20 mx-auto mb-4" />
                <p className="text-sm text-[#A0A7B5]">{t('workspace.no_apps_found', 'Nenhum aplicativo habilitado no momento.')}</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Organization, Team, Access and Limits */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
              <h3 className="text-lg font-bold text-white tracking-tight">{t('workspace.org_group_title', 'Organização e Acesso')}</h3>
            </div>

            {/* ORGANIZATION CARD */}
            <div className="bg-[#050505] border border-white/10 hover:border-white/20 transition-all rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-base">{organization?.name || t('workspace.organization_unnamed', 'Sua Organização')}</h4>
                  <p className="text-xs text-[#A0A7B5] mt-1 font-mono">slug: {organization?.slug || '...'}</p>
                </div>
                {(currentUserPerms['organization.settings.update'] || isGlobalAdmin) && (
                  <button 
                    onClick={onNavigateToOrganizationSettings}
                    className="p-2 hover:bg-white/5 rounded-xl text-[#A0A7B5] hover:text-white transition-all border border-transparent hover:border-white/5"
                    title={t('workspace.org_settings_title', 'Ajustes da Organização')}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 flex items-center justify-between text-sm">
                <span className="text-[#A0A7B5]">{t('workspace.plan_label', 'Plano atual:')}</span>
                <span className="font-semibold text-purple-400 capitalize bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 text-xs">
                  {organization?.apps?.musicscale?.plan || subscription?.planId || t('workspace.plan_starter', 'Starter')}
                </span>
              </div>

              {(currentUserPerms['organization.billing.manage'] || isGlobalAdmin) && (
                <button
                  type="button"
                  onClick={onNavigateToBilling}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all"
                >
                  {t('workspace.billing_action', 'Gerenciar Assinatura')}
                </button>
              )}
            </div>

            {/* TEAM AND MEMBERSHIP CARD */}
            <div className="bg-[#050505] border border-white/10 hover:border-white/20 transition-all rounded-3xl p-6 space-y-6">
              <div>
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#A0A7B5]" />
                  {t('workspace.team_title', 'Membros e Equipe')}
                </h4>
                <p className="text-xs text-[#A0A7B5] mt-1">
                  {t('workspace.team_desc', 'Administre quem tem acesso à organização e segurança do painel.')}
                </p>
              </div>

              {/* Slots progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#A0A7B5]">{t('workspace.slots_allocated', 'Vagas preenchidas')}</span>
                  <span className="text-white">
                    {maxUsersLimit === -1 ? `${occupiedSlots} / ∞` : `${occupiedSlots} / ${maxUsersLimit}`}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-[#2B85EB] to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${maxUsersLimit === -1 ? 100 : progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {(currentUserPerms['organization.members.invite'] || isGlobalAdmin) && (
                  <button
                    type="button"
                    onClick={onOpenInviteModal}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#2B85EB] hover:bg-[#3B95FB] text-white transition-all"
                  >
                    {t('workspace.invite_action', 'Convidar Membro')}
                  </button>
                )}
                {(currentUserPerms['organization.members.manage'] || isGlobalAdmin) && (
                  <button
                    type="button"
                    onClick={onNavigateToOrganizationMembers}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all"
                  >
                    {t('workspace.manage_team_action', 'Ver Equipe')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-6 bg-green-500 rounded-full"></span>
            <h3 className="text-lg font-bold text-white tracking-tight">{t('workspace.help_group_title', 'Ajuda e Suporte')}</h3>
          </div>
          <button
            type="button"
            onClick={openHub}
            aria-label={t('support.hub.central_action.aria', 'Abrir a Central de Ajuda e suporte')}
            className="w-full md:max-w-xl min-h-[44px] flex items-center gap-4 bg-[#050505] border border-white/10 hover:border-[#2B85EB]/50 rounded-3xl p-5 text-left transition-colors group focus:outline-none focus:ring-2 focus:ring-[#2B85EB]"
          >
            <div className="w-12 h-12 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] flex items-center justify-center shrink-0 group-hover:bg-[#2B85EB]/20 transition-colors">
              <CircleHelp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-white group-hover:text-[#2B85EB] transition-colors">{t('support.hub.central_action.title', 'Central de Ajuda & Suporte')}</h4>
              <p className="text-xs text-[#A0A7B5] mt-1 leading-relaxed">{t('support.hub.central_action.description', 'Envie uma solicitação, fale pelo WhatsApp ou consulte guias rápidos do ecossistema.')}</p>
            </div>
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white/5 text-white/50 group-hover:bg-[#2B85EB] group-hover:text-white transition-colors">
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
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
