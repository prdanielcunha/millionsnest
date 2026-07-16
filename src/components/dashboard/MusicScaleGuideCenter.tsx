import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  ArrowDown, 
  ListMusic, 
  FileText, 
  CalendarDays, 
  Link as LinkIcon, 
  Users, 
  ExternalLink, 
  CheckCircle2, 
  Settings, 
  ShieldAlert, 
  AlertCircle, 
  UserPlus, 
  Play,
  Info
} from 'lucide-react';

export interface MusicScaleGuideCenterProps {
  activeSection: 'overview' | 'resources' | 'getting-started';
  organizationReady: boolean;
  musicScaleReady?: boolean;
  teamStarted: boolean;
  canInvite: boolean;
  canManageTeam: boolean;
  canManageOrganization: boolean;
  canManageBilling: boolean;
  hasPaymentIssue: boolean;
  onSelectSection: (section: 'overview' | 'resources' | 'getting-started') => void;
  onOpenInviteModal: () => void;
  onManageTeam: () => void;
  onReviewOrganization: () => void;
  onOpenMusicScale: () => void;
  onNavigateToBilling: () => void;
  heroContent?: React.ReactNode;
  overviewContent?: React.ReactNode;
  memberCount: number;
  pendingInviteCount: number;
}

export function MusicScaleGuideCenter({ 
  activeSection,
  organizationReady,
  musicScaleReady = true,
  teamStarted,
  canInvite,
  canManageTeam,
  canManageOrganization,
  canManageBilling,
  hasPaymentIssue,
  onSelectSection,
  onOpenInviteModal,
  onManageTeam,
  onReviewOrganization,
  onOpenMusicScale,
  onNavigateToBilling,
  heroContent: externalHeroContent,
  overviewContent: externalOverviewContent,
  memberCount,
  pendingInviteCount
}: MusicScaleGuideCenterProps) {
  const { t } = useTranslation('dashboard');

  const renderTabs = () => (
    <div className="flex space-x-6 border-b border-white/10 mb-8" role="tablist">
      <button 
        type="button" 
        onClick={() => onSelectSection('overview')} 
        role="tab"
        aria-selected={activeSection === 'overview'}
        className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'overview' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
      >
        {t('musicscale.center.tabs.overview', 'Visão Geral')}
      </button>
      <button 
        type="button" 
        onClick={() => onSelectSection('resources')} 
        role="tab"
        aria-selected={activeSection === 'resources'}
        className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'resources' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
      >
        {t('musicscale.center.tabs.resources', 'Recursos')}
      </button>
      <button 
        type="button" 
        onClick={() => onSelectSection('getting-started')} 
        role="tab"
        aria-selected={activeSection === 'getting-started'}
        className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'getting-started' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
      >
        {t('musicscale.center.tabs.getting_started', 'Primeiros passos')}
      </button>
    </div>
  );

  const heroContent = externalHeroContent || (
    <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111111] border border-white/10 rounded-2xl p-8 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
        <ListMusic className="w-64 h-64 text-[#2B85EB]" />
      </div>
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-4">{t('musicscale.center.overview.title', 'Bem-vindo ao MusicScale')}</h1>
        <p className="text-[#A0A7B5] text-lg mb-8 leading-relaxed">
          {t('musicscale.center.overview.description', 'O MusicScale é o aplicativo de organização e preparação musical da sua organização.')}
        </p>
        <button type="button" onClick={onOpenMusicScale} className="px-6 py-3 bg-[#2B85EB] hover:bg-[#3B95FB] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px]">
          {t('musicscale.center.overview.primary_action', 'Abrir MusicScale')}
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const overviewContent = externalOverviewContent || null;

  const renderResources = () => {
    const resourceCards = [
      { key: 'repertoire', icon: ListMusic },
      { key: 'library', icon: Globe },
      { key: 'chords', icon: FileText },
      { key: 'lyrics', icon: FileText },
      { key: 'ai_import', icon: LinkIcon },
      { key: 'music_scales', icon: CalendarDays },
      { key: 'members', icon: Users },
      { key: 'band_scales', icon: CalendarDays }
    ];

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('musicscale.center.resources.description', 'Entenda onde ficam as músicas, cifras, letras, escalas e integrantes, e como cada área se conecta na preparação da equipe.')}
          </p>
        </div>

        {/* Visual Map */}
        <div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">
          <h3 className="text-lg font-bold text-white mb-6">
            {t('musicscale.center.resources.flow.notice_title', 'Como o Repertório funciona')}
          </h3>
          <p className="text-[#A0A7B5] text-sm mb-8 leading-relaxed">
            {t('musicscale.center.resources.flow.notice_text', 'No MusicScale, Repertório é o acervo de músicas da sua organização...')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 relative">
            <div className="flex flex-col gap-6">
              {/* Biblioteca Viva */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                <Globe className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-white">{t('musicscale.center.resources.flow.live_library', 'Biblioteca Viva')}</span>
              </div>
              
              <div className="flex items-center gap-2 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('musicscale.center.resources.flow.imports_to', 'importa para')}</span>
              </div>
              
              {/* Repertório */}
              <div className="flex items-center gap-3 bg-[#2B85EB]/10 p-4 rounded-xl border border-[#2B85EB]/20">
                <ListMusic className="w-5 h-5 text-[#2B85EB] shrink-0" />
                <span className="font-semibold text-white">{t('musicscale.center.resources.flow.repertoire', 'Repertório de músicas')}</span>
              </div>
              
              {/* Cifras / Letras */}
              <div className="pl-6 ml-6 border-l-2 border-white/10 py-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('musicscale.center.resources.flow.chords', 'Cifras')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('musicscale.center.resources.flow.lyrics', 'Letras')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('musicscale.center.resources.flow.supplies_songs_to', 'fornece músicas para')}</span>
              </div>
              
              {/* Escala de Músicas */}
              <div className="flex items-center gap-3 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <CalendarDays className="w-5 h-5 text-green-400 shrink-0" />
                <span className="font-semibold text-white">{t('musicscale.center.resources.flow.music_scale', 'Escala de Músicas')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Integrantes */}
              <div className="flex items-center gap-3 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <Users className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">{t('musicscale.center.resources.flow.members', 'Integrantes')}</span>
              </div>
              
              <div className="flex items-center gap-2 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('musicscale.center.resources.flow.forms', 'formam')}</span>
              </div>
              
              {/* Escala da Banda */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                <CalendarDays className="w-5 h-5 text-white shrink-0" />
                <span className="font-semibold text-white">{t('musicscale.center.resources.flow.band_scale', 'Escala da Banda')}</span>
              </div>

              {/* Connector */}
              <div className="mt-auto bg-white/5 border border-dashed border-white/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-[#A0A7B5]" />
                  <span className="text-xs text-[#A0A7B5]">{t('musicscale.center.resources.flow.can_link_to', 'pode ser vinculada')}</span>
                  <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('musicscale.center.resources.flow.optional_link', 'opcional')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Resource Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {resourceCards.map((card) => {
            const Icon = card.icon;
            const title = t(`musicscale.center.resources.${card.key}.title`, card.key);
            const desc = t(`musicscale.center.resources.${card.key}.desc`, '');
            const practice = card.key !== 'ai_import' ? t(`musicscale.center.resources.${card.key}.practice`, '') : null;
            const notice = card.key === 'ai_import' ? t('musicscale.center.resources.ai_import.notice', '') : null;

            return (
              <div key={card.key} className="bg-[#050505] border border-white/5 p-6 rounded-2xl flex flex-col justify-between transition-all hover:border-white/10">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white shrink-0">
                      <Icon className="w-5 h-5 text-[#2B85EB]" />
                    </div>
                    <h3 className="font-bold text-white text-lg">{title}</h3>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-4 leading-relaxed">{desc}</p>
                </div>
                {practice && (
                  <div className="mt-2 pt-3 border-t border-white/5">
                    <span className="text-xs uppercase font-bold text-[#2B85EB] block mb-1">
                      {t('musicscale.center.common.in_practice', 'Na prática')}
                    </span>
                    <p className="text-xs text-[#808795]">{practice}</p>
                  </div>
                )}
                {notice && (
                  <div className="mt-2 pt-3 border-t border-white/5">
                    <span className="text-xs uppercase font-bold text-amber-500 block mb-1">
                      {t('musicscale.center.common.important', 'Importante')}
                    </span>
                    <p className="text-xs text-[#808795]">{notice}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGettingStarted = () => {
    // 8 steps
    const steps = [
      { id: 'organization', key: 'organization', titleKey: 'musicscale.center.getting_started.steps.organization.title' },
      { id: 'team', key: 'team', titleKey: 'musicscale.center.getting_started.steps.team.title' },
      { id: 'songs', key: 'songs', titleKey: 'musicscale.center.getting_started.steps.songs.title' },
      { id: 'content', key: 'content', titleKey: 'musicscale.center.getting_started.steps.content.title' },
      { id: 'members', key: 'members', titleKey: 'musicscale.center.getting_started.steps.members.title' },
      { id: 'band_scale', key: 'band_scale', titleKey: 'musicscale.center.getting_started.steps.band_scale.title' },
      { id: 'music_scale', key: 'music_scale', titleKey: 'musicscale.center.getting_started.steps.music_scale.title' },
      { id: 'review', key: 'review', titleKey: 'musicscale.center.getting_started.steps.review.title' }
    ];

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('musicscale.center.getting_started.title', 'Primeiros passos')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('musicscale.center.getting_started.description', 'Siga esta ordem sugerida para preparar sua organização no MusicScale.')}
          </p>
        </div>

        <div className="space-y-12 ml-6 border-l-2 border-white/10 pl-8 py-4">
          {steps.map((step, index) => {
            const stepNum = index + 1;
            const title = t(step.titleKey, step.key);
            const what = t(`musicscale.center.getting_started.steps.${step.key}.what`, '');
            const why = t(`musicscale.center.getting_started.steps.${step.key}.why`, '');
            const how = t(`musicscale.center.getting_started.steps.${step.key}.how`, '');
            const result = t(`musicscale.center.getting_started.steps.${step.key}.result`, '');

            // Honest Progress Logic
            let stepStatus: 'completed' | 'pending_invite' | 'pending' = 'pending';
            let statusText = t('musicscale.center.getting_started.statuses.pending', 'Pendente');

            if (step.id === 'organization') {
              if (organizationReady) {
                stepStatus = 'completed';
                statusText = t('musicscale.center.getting_started.statuses.completed', 'Concluído');
              }
            } else if (step.id === 'team') {
              if (memberCount > 1) {
                stepStatus = 'completed';
                statusText = t('musicscale.center.getting_started.statuses.completed', 'Concluído');
              } else if (pendingInviteCount > 0) {
                stepStatus = 'pending_invite';
                statusText = t('musicscale.center.getting_started.statuses.pending_invite', 'Convite enviado');
              }
            } else {
              // Other steps happen inside MusicScale
              stepStatus = 'pending';
              statusText = t('musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale');
            }

            return (
              <div key={step.id} className="relative">
                {/* Circle step badge */}
                <div className={`absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border transition-colors ${
                  stepStatus === 'completed' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : stepStatus === 'pending_invite'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/10 text-[#A0A7B5] border-white/20'
                }`}>
                  {stepStatus === 'completed' ? '✓' : stepNum}
                </div>

                {/* Header */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    stepStatus === 'completed' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : stepStatus === 'pending_invite'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-white/5 text-[#A0A7B5] border border-white/5'
                  }`}>
                    {statusText}
                  </span>
                </div>

                {/* Educational Fields Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-3xl">
                  {what && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-white/5 text-sm">
                      <strong className="text-white block mb-1">
                        {t('musicscale.center.common.what_is', 'O que é')}
                      </strong>
                      <p className="text-[#808795] leading-relaxed">{what}</p>
                    </div>
                  )}
                  {why && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-white/5 text-sm">
                      <strong className="text-white block mb-1">
                        {t('musicscale.center.common.why_important', 'Por que é importante')}
                      </strong>
                      <p className="text-[#808795] leading-relaxed">{why}</p>
                    </div>
                  )}
                  {how && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-white/5 text-sm">
                      <strong className="text-white block mb-1">
                        {t('musicscale.center.common.how_to', 'Como fazer')}
                      </strong>
                      <p className="text-[#808795] leading-relaxed">{how}</p>
                    </div>
                  )}
                  {result && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-white/5 text-sm">
                      <strong className="text-white block mb-1">
                        {t('musicscale.center.common.expected_result', 'Resultado esperado')}
                      </strong>
                      <p className="text-[#808795] leading-relaxed">{result}</p>
                    </div>
                  )}
                </div>

                {/* Important notice for step 2 (team) */}
                {step.id === 'team' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm max-w-3xl mb-6 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[#A0A7B5] leading-relaxed">
                      {t('musicscale.center.getting_started.steps.team.important', 'A função Administrador ou Membro define o acesso ao MillionsNest. Funções ministeriais, como músico, vocal ou líder, são configuradas dentro do MusicScale.')}
                    </p>
                  </div>
                )}

                {/* Action Buttons & Permissions */}
                <div className="pt-2">
                  {step.id === 'organization' ? (
                    <>
                      <button 
                        type="button" 
                        onClick={onReviewOrganization} 
                        disabled={!canManageOrganization}
                        className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                      >
                        <Settings className="w-4 h-4" />
                        {t('musicscale.center.getting_started.steps.organization.action', 'Revisar organização')}
                      </button>
                      {!canManageOrganization && (
                        <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {t('musicscale.center.getting_started.steps.organization.admin_notice', 'Um administrador pode alterar esses dados.')}
                        </p>
                      )}
                    </>
                  ) : step.id === 'team' ? (
                    <>
                      <button 
                        type="button" 
                        onClick={onOpenInviteModal} 
                        disabled={!canInvite}
                        className="px-5 py-2.5 bg-white text-black hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                      >
                        <UserPlus className="w-4 h-4" />
                        {t('musicscale.center.getting_started.steps.team.action_invite', 'Convidar uma pessoa')}
                      </button>
                      {!canInvite && (
                        <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {t('musicscale.center.getting_started.steps.team.admin_notice', 'Peça a um administrador para enviar o convite.')}
                        </p>
                      )}
                    </>
                  ) : (
                    <button 
                      type="button" 
                      onClick={onOpenMusicScale} 
                      disabled={!musicScaleReady} 
                      className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                    >
                      {t(`musicscale.center.getting_started.steps.${step.key}.action`, 'Abrir MusicScale')}
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      {renderTabs()}
      
      {activeSection === 'overview' && (
        <div className="animate-in fade-in duration-300">
          {heroContent}
          {overviewContent}
        </div>
      )}
      
      {activeSection === 'resources' && renderResources()}
      
      {activeSection === 'getting-started' && renderGettingStarted()}
    </div>
  );
}
