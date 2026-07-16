import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowDown, ListMusic, FileText, CalendarDays, Link as LinkIcon, Users, ExternalLink, CheckCircle2, Settings, ShieldAlert, AlertCircle, UserPlus, Play } from 'lucide-react';

export function MusicScaleGuideCenter({ 
  activeSection: externalActiveSection,
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
  overviewContent: externalOverviewContent
}: any) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState(externalActiveSection || 'overview');

  const renderTabs = () => (
    <div className="flex space-x-6 border-b border-white/10 mb-8">
      <button type="button" onClick={() => setActiveSection('overview')} className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'overview' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}>
        {t('dashboard.musicscale.center.tabs.overview', 'Visão Geral')}
      </button>
      <button type="button" onClick={() => setActiveSection('resources')} className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'resources' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}>
        {t('dashboard.musicscale.center.tabs.resources', 'Recursos')}
      </button>
      <button type="button" onClick={() => setActiveSection('getting-started')} className={`pb-3 border-b-2 transition-colors font-medium ${activeSection === 'getting-started' ? 'border-[#2B85EB] text-white' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}>
        {t('dashboard.musicscale.center.tabs.getting_started', 'Primeiros passos')}
      </button>
    </div>
  );

  const heroContent = externalHeroContent || (
    <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111111] border border-white/10 rounded-2xl p-8 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
        <ListMusic className="w-64 h-64 text-[#2B85EB]" />
      </div>
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-4">{t('dashboard.musicscale.center.overview.title', 'Bem-vindo ao MusicScale')}</h1>
        <p className="text-[#A0A7B5] text-lg mb-8 leading-relaxed">
          {t('dashboard.musicscale.center.overview.description', 'O MusicScale é o aplicativo de organização e preparação musical da sua organização.')}
        </p>
        <button type="button" onClick={onOpenMusicScale} className="px-6 py-3 bg-[#2B85EB] hover:bg-[#3B95FB] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px]">
          {t('dashboard.musicscale.center.overview.primary_action', 'Abrir MusicScale')}
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );


  const overviewContent = externalOverviewContent || null;

  const renderFAQ = () => null;

  const renderResources = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('dashboard.musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('dashboard.musicscale.center.resources.description', 'Entenda onde ficam as músicas, cifras, letras, escalas e integrantes, e como cada área se conecta na preparação da equipe.')}
          </p>
        </div>

        <div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col md:flex-row gap-8 justify-between">
            <div className="flex-1 flex flex-col">
              {/* Biblioteca Viva */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                <Globe className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.live_library', 'Biblioteca Viva')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.imports_to', 'Importa para')}</span>
              </div>
              
              {/* Repertório */}
              <div className="flex items-center gap-3 bg-[#2B85EB]/10 p-4 rounded-xl border border-[#2B85EB]/20">
                <ListMusic className="w-5 h-5 text-[#2B85EB] shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.repertoire', 'Repertório')}</span>
              </div>
              
              {/* Cifras / Letras */}
              <div className="pl-6 ml-6 border-l-2 border-white/10 py-3 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.chords', 'Cifras')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.lyrics', 'Letras')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.supplies_songs_to', 'Fornece músicas para')}</span>
              </div>
              
              {/* Escala de Músicas */}
              <div className="flex items-center gap-3 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <CalendarDays className="w-5 h-5 text-green-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.music_scale', 'Escala de Músicas')}</span>
              </div>
            </div>
            
            <div className="hidden md:flex flex-col items-center justify-end pb-6 px-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                  <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                  <span className="text-xs text-[#A0A7B5] whitespace-nowrap">{t('dashboard.musicscale.center.resources.flow.can_link_to', 'Pode vincular à')}</span>
                  <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link', 'Opcional')}</span>
                </div>
                <div className="w-full border-b border-dashed border-white/20" />
              </div>
            </div>
            
            <div className="md:hidden flex flex-col items-center py-2">
              <div className="h-6 border-l border-dashed border-white/20 mb-3" />
              <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                <span className="text-xs text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.can_link_to')}</span>
                <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link')}</span>
              </div>
              <div className="h-6 border-l border-dashed border-white/20 mt-3" />
            </div>

            <div className="flex-1 flex flex-col">
              {/* Integrantes */}
              <div className="flex items-center gap-3 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <Users className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.members')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.forms', 'Forma a')}</span>
              </div>
              
              {/* Escala da Banda */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 md:mt-auto">
                <CalendarDays className="w-5 h-5 text-white shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.band_scale')}</span>
              </div>
            </div>
          </div>
        </div>
        
        {renderFAQ()}
    </div>
  );

  const renderGettingStarted = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-3xl mb-12">
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('dashboard.musicscale.center.getting_started.title', 'Primeiros passos')}
        </h2>
        <p className="text-[#A0A7B5]">
          {t('dashboard.musicscale.center.getting_started.description', 'Siga esta ordem sugerida para preparar sua organização no MusicScale.')}
        </p>
      </div>

      <div className="space-y-12 ml-6 border-l-2 border-white/10 pl-8 py-4">
        
        {/* Step 1 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[#2B85EB] text-white">
            1
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.organization.title', 'Confirme os dados da organização')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to', 'Como fazer')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.organization.how', 'Confira se o nome e os dados da organização estão corretos.')}</p>
            </div>
            
            <div className="pt-2 flex flex-col gap-2">
              <button type="button" onClick={onReviewOrganization} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                <Settings className="w-4 h-4" />
                {t('dashboard.musicscale.center.getting_started.steps.organization.action', 'Revisar organização')}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[#2B85EB] text-white">
            2
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.team.title', 'Traga as primeiras pessoas')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.team.how', 'Informe o e-mail da pessoa, escolha o acesso à organização e compartilhe o convite.')}</p>
            </div>
            
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex gap-3">
                <button type="button" onClick={onOpenInviteModal} className="px-5 py-2.5 bg-white text-black hover:bg-gray-100 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                  <UserPlus className="w-4 h-4" />
                  {t('dashboard.musicscale.center.getting_started.steps.team.action_invite', 'Convidar uma pessoa')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            3
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.songs.title', 'Alimente o Repertório')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.how', 'No MusicScale, abra Repertório → Músicas.')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.songs.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            4
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.content.title', 'Confira cifras e letras')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.content.how')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.content.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            5
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.members.title', 'Organize os integrantes')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.members.how', 'Abra Integrantes e confira se as funções estão corretas.')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.members.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Step 6 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            6
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.band_scale.title', 'Monte uma Escala da Banda')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.band_scale.how')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.band_scale.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Step 7 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            7
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.music_scale.title', 'Crie uma Escala de Músicas')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.music_scale.how')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.music_scale.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Step 8 */}
        <div className="relative">
          <div className="absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-white/10 text-white border border-white/20">
            8
          </div>
          
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">
              {t('dashboard.musicscale.center.getting_started.steps.review.title', 'Revise a preparação')}
            </h3>
          </div>
          
          <div className="space-y-4 text-sm max-w-2xl">
            <div>
              <strong className="text-white block mb-1">{t('dashboard.musicscale.center.common.how_to')}:</strong>
              <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.review.how')}</p>
            </div>
            
            <div className="pt-2">
              <button type="button" onClick={onOpenMusicScale} disabled={!musicScaleReady} className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit">
                {t('dashboard.musicscale.center.getting_started.steps.review.action', 'Abrir MusicScale')}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
