import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  ListMusic, 
  CalendarDays, 
  Users, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MusicScaleGuideCenterProps {
  activeSection: 'overview' | 'resources' | 'getting-started';
  organizationReady: boolean;
  musicScaleReady: boolean;
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
  overviewContent?: React.ReactNode;
  heroContent?: React.ReactNode;
}

export function MusicScaleGuideCenter({
  activeSection,
  organizationReady,
  musicScaleReady,
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
  overviewContent,
  heroContent
}: MusicScaleGuideCenterProps) {
  const { t } = useTranslation();
  
  const millionsNestSetupReady = organizationReady && musicScaleReady && teamStarted;

  const renderTabs = () => {
    return (
      <div className="border-b border-white/5 mb-8">
        <div 
          className="flex items-center gap-8 overflow-x-auto no-scrollbar pb-1"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'overview'}
            onClick={() => onSelectSection('overview')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap outline-none min-h-[44px] ${
              activeSection === 'overview' 
                ? 'border-[#2B85EB] text-white' 
                : 'border-transparent text-[#A0A7B5] hover:text-white'
            }`}
          >
            {t('dashboard.musicscale.center.tabs.overview', 'Visão geral')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'resources'}
            onClick={() => onSelectSection('resources')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap outline-none min-h-[44px] ${
              activeSection === 'resources' 
                ? 'border-[#2B85EB] text-white' 
                : 'border-transparent text-[#A0A7B5] hover:text-white'
            }`}
          >
            {t('dashboard.musicscale.center.tabs.resources', 'Recursos')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'getting-started'}
            onClick={() => onSelectSection('getting-started')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap outline-none min-h-[44px] flex items-center gap-2 ${
              activeSection === 'getting-started' 
                ? 'border-[#2B85EB] text-white' 
                : 'border-transparent text-[#A0A7B5] hover:text-white'
            }`}
          >
            {t('dashboard.musicscale.center.tabs.getting_started', 'Primeiros passos')}
            {!millionsNestSetupReady ? (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold bg-[#2B85EB]/20 text-[#2B85EB]"
              >
                {t('dashboard.musicscale.center.badges.recommended', 'Recomendado')}
              </motion.span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold bg-white/5 text-[#A0A7B5]">
                {t('dashboard.musicscale.center.badges.guide', 'Guia')}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderOverviewHighlights = () => {
    return (
      <div className="bg-gradient-to-r from-[#0a0a0a] to-[#111] border border-white/5 rounded-2xl p-6 lg:p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#2B85EB]/5 rounded-full blur-3xl pointer-events-none" />
        
        <p className="text-[10px] text-[#2B85EB] font-bold uppercase tracking-widest mb-3">
          {t('dashboard.musicscale.center.overview.start_here', 'COMECE POR AQUI')}
        </p>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <h3 className="text-xl lg:text-2xl font-semibold text-white mb-2">
              {!teamStarted 
                ? t('dashboard.musicscale.center.overview.no_team_title', 'Prepare sua equipe para usar o MusicScale')
                : t('dashboard.musicscale.center.overview.team_title', 'Continue seus primeiros passos')
              }
            </h3>
            <p className="text-[#A0A7B5] text-sm lg:text-base mb-6">
              {!teamStarted 
                ? t('dashboard.musicscale.center.overview.no_team_desc', 'Convide as pessoas que participarão da organização e depois continue a configuração dentro do MusicScale.')
                : t('dashboard.musicscale.center.overview.team_desc', 'Aprenda a adicionar músicas, criar repertórios e montar sua primeira escala.')
              }
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onSelectSection('getting-started')}
                className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm min-h-[44px]"
              >
                {t('dashboard.musicscale.center.overview.btn_continue', 'Continuar primeiros passos')}
              </button>
              
              {!teamStarted && canInvite && (
                <button
                  type="button"
                  onClick={onOpenInviteModal}
                  className="px-6 py-3 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors border border-white/5 text-sm min-h-[44px]"
                >
                  {t('dashboard.musicscale.center.overview.btn_invite', 'Convidar uma pessoa')}
                </button>
              )}
            </div>
            
            {!teamStarted && !canInvite && (
              <p className="mt-4 text-xs text-[#A0A7B5]">
                {t('dashboard.musicscale.center.overview.ask_admin_invite', 'Peça a um administrador da organização para convidar a equipe.')}
              </p>
            )}
            
            {hasPaymentIssue && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">
                      Assinatura pendente
                    </h4>
                    {canManageBilling ? (
                      <button
                        onClick={onNavigateToBilling}
                        className="text-sm font-medium text-red-400 hover:text-red-300 min-h-[44px]"
                      >
                        {t('dashboard.musicscale.center.overview.resolve_payment', 'Regularizar assinatura')} &rarr;
                      </button>
                    ) : (
                      <p className="text-sm text-[#A0A7B5]">
                        {t('dashboard.musicscale.center.overview.ask_admin_payment', 'Peça ao responsável pela assinatura para regularizar o acesso.')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-xl p-5 lg:min-w-[280px]">
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                {organizationReady ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-[#A0A7B5] shrink-0" />}
                <span className={`text-sm font-medium ${organizationReady ? 'text-white' : 'text-[#A0A7B5]'}`}>
                  {t('dashboard.musicscale.center.overview.summary_org', 'Organização pronta')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                {musicScaleReady ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-[#A0A7B5] shrink-0" />}
                <span className={`text-sm font-medium ${musicScaleReady ? 'text-white' : 'text-[#A0A7B5]'}`}>
                  {t('dashboard.musicscale.center.overview.summary_ms', 'MusicScale ativo')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                {teamStarted ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-[#A0A7B5] shrink-0" />}
                <span className={`text-sm font-medium ${teamStarted ? 'text-white' : 'text-[#A0A7B5]'}`}>
                  {t('dashboard.musicscale.center.overview.summary_team', 'Equipe iniciada')}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderResources = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('dashboard.musicscale.center.resources.title', 'O que o MusicScale pode fazer?')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('dashboard.musicscale.center.resources.description', 'Explore as funcionalidades integradas.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Repertórios */}
          <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <ListMusic className="w-6 h-6 text-[#A0A7B5]" />
            </div>
            <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-widest mb-4">
              {t('dashboard.musicscale.center.resources.repertoire.title', 'REPERTÓRIOS')}
            </h3>
            <p className="text-base text-white font-medium mb-2">
              {t('dashboard.musicscale.center.resources.repertoire.desc', 'Organize as músicas de cultos, ensaios e eventos.')}
            </p>
            <p className="text-sm text-[#A0A7B5] mb-6">
              {t('dashboard.musicscale.center.resources.repertoire.why', 'Sua equipe encontra o que precisa preparar sem depender de mensagens espalhadas.')}
            </p>
            <div className="bg-white/5 rounded-xl p-4 mt-auto">
              <p className="text-xs text-[#A0A7B5] leading-relaxed">
                <strong className="text-white">Exemplo:</strong> {t('dashboard.musicscale.center.resources.repertoire.example', 'Crie um repertório chamado Culto de domingo e adicione as músicas da ministração.')}
              </p>
            </div>
          </div>

          {/* Escalas */}
          <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <CalendarDays className="w-6 h-6 text-[#A0A7B5]" />
            </div>
            <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-widest mb-4">
              {t('dashboard.musicscale.center.resources.scales.title', 'ESCALAS')}
            </h3>
            <p className="text-base text-white font-medium mb-2">
              {t('dashboard.musicscale.center.resources.scales.desc', 'Defina quem participará e qual será a função de cada pessoa.')}
            </p>
            <p className="text-sm text-[#A0A7B5] mb-6">
              {t('dashboard.musicscale.center.resources.scales.why', 'Todos sabem quando servirão e o que farão.')}
            </p>
            <div className="bg-white/5 rounded-xl p-4 mt-auto">
              <p className="text-xs text-[#A0A7B5] leading-relaxed">
                <strong className="text-white">Exemplo:</strong> {t('dashboard.musicscale.center.resources.scales.example', 'Escolha vocal principal, backing vocal, teclado, bateria, guitarra e liderança.')}
              </p>
            </div>
          </div>

          {/* Músicos */}
          <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-[#A0A7B5]" />
            </div>
            <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-widest mb-4">
              {t('dashboard.musicscale.center.resources.musicians.title', 'MÚSICOS')}
            </h3>
            <p className="text-base text-white font-medium mb-2">
              {t('dashboard.musicscale.center.resources.musicians.desc', 'Organize as pessoas e suas funções dentro do ministério.')}
            </p>
            <p className="text-sm text-[#A0A7B5] mb-6">
              {t('dashboard.musicscale.center.resources.musicians.why', 'Fica mais fácil montar equipes coerentes para cada culto.')}
            </p>
            <div className="bg-white/5 rounded-xl p-4 mt-auto">
              <p className="text-xs text-[#A0A7B5] leading-relaxed">
                <strong className="text-white">Exemplo:</strong> {t('dashboard.musicscale.center.resources.musicians.example', 'Cadastre quem toca bateria, teclado, guitarra ou participa do vocal.')}
              </p>
            </div>
          </div>

          {/* Preparação */}
          <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <FileText className="w-6 h-6 text-[#A0A7B5]" />
            </div>
            <h3 className="text-sm font-bold text-[#A0A7B5] uppercase tracking-widest mb-4">
              {t('dashboard.musicscale.center.resources.preparation.title', 'PREPARAÇÃO')}
            </h3>
            <p className="text-base text-white font-medium mb-2">
              {t('dashboard.musicscale.center.resources.preparation.desc', 'Reúna as informações que sua equipe precisa antes do culto.')}
            </p>
            <p className="text-sm text-[#A0A7B5] mb-6">
              {t('dashboard.musicscale.center.resources.preparation.why', 'Os participantes chegam mais preparados para o ensaio e a ministração.')}
            </p>
            <div className="bg-white/5 rounded-xl p-4 mt-auto">
              <p className="text-xs text-[#A0A7B5] leading-relaxed">
                <strong className="text-white">Exemplo:</strong> {t('dashboard.musicscale.center.resources.preparation.example', 'Compartilhe repertório, orientações e materiais de preparação.')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <button
            onClick={onOpenMusicScale}
            disabled={!musicScaleReady}
            className="px-8 py-4 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px]"
          >
            {t('dashboard.musicscale.center.resources.open_ms', 'Abrir MusicScale')}
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderGettingStarted = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('dashboard.musicscale.center.getting_started.title', 'Primeiros passos no MusicScale')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('dashboard.musicscale.center.getting_started.description', 'Vamos preparar sua organização, sua equipe e o primeiro fluxo de trabalho. Você pode concluir cada etapa no seu ritmo.')}
          </p>
        </div>

        <div className="bg-[#2B85EB]/10 border border-[#2B85EB]/20 rounded-xl p-4 mb-8 flex items-start gap-4">
          <div className="mt-0.5">
            <ExternalLink className="w-5 h-5 text-[#2B85EB]" />
          </div>
          <p className="text-sm text-[#A0A7B5]">
            {t('dashboard.musicscale.center.getting_started.operational_notice', 'As etapas de músicas, repertórios e escalas acontecem dentro do MusicScale. Abra o aplicativo e siga as orientações abaixo.')}
          </p>
        </div>

        <div className="relative border-l border-white/10 ml-6 pl-8 pb-12 space-y-16">
          {/* Step 1 */}
          <div className="relative">
            <div className={`absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${organizationReady ? 'bg-emerald-500 text-white' : 'bg-[#2B85EB] text-white'}`}>
              {organizationReady ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">
                {t('dashboard.musicscale.center.getting_started.steps.organization.title', 'Confira sua organização')}
              </h3>
              {organizationReady && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-md uppercase tracking-wider">
                  {t('dashboard.musicscale.center.getting_started.statuses.completed', 'Concluído')}
                </span>
              )}
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.organization.what', 'A organização representa sua igreja, ministério ou equipe dentro do MillionsNest.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.organization.why', 'É nela que ficam as pessoas, os aplicativos e a assinatura.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.organization.how', 'Confira se o nome e os dados da organização estão corretos.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.organization.result', 'Sua equipe reconhecerá facilmente o ambiente ao entrar.')}
                </p>
              </div>
              
              <div className="pt-2">
                {canManageOrganization ? (
                  <button
                    onClick={onReviewOrganization}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl border border-white/10 transition-colors min-h-[44px]"
                  >
                    {t('dashboard.musicscale.center.getting_started.steps.organization.action', 'Revisar organização')}
                  </button>
                ) : (
                  <p className="text-xs text-[#A0A7B5] italic">
                    {t('dashboard.musicscale.center.getting_started.steps.organization.admin_notice', 'Um administrador pode alterar esses dados.')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className={`absolute -left-[49px] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${teamStarted ? 'bg-emerald-500 text-white' : 'bg-[#2B85EB] text-white'}`}>
              {teamStarted ? <CheckCircle2 className="w-4 h-4" /> : '2'}
            </div>
            
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">
                {t('dashboard.musicscale.center.getting_started.steps.team.title', 'Convide sua equipe')}
              </h3>
              {teamStarted && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-md uppercase tracking-wider">
                  {t('dashboard.musicscale.center.getting_started.statuses.completed', 'Concluído')}
                </span>
              )}
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.team.what', 'Adicione as pessoas que utilizarão o MusicScale com você.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.team.why', 'Líderes, músicos e vocais poderão acessar a mesma organização.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.team.how', 'Informe o e-mail da pessoa, escolha o acesso à organização e compartilhe o convite.')}</p>
              </div>
              <div className="bg-[#2B85EB]/5 border border-[#2B85EB]/10 rounded-lg p-3">
                <p className="text-[#A0A7B5] text-xs">
                  <strong className="text-white">Importante: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.team.important', 'A função Administrador ou Membro define o acesso ao MillionsNest. Funções ministeriais, como músico, vocal ou líder, são configuradas dentro do MusicScale.')}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.team.result', 'A pessoa aparecerá na equipe depois que aceitar o convite.')}
                </p>
              </div>
              
              <div className="pt-2 flex flex-wrap gap-3">
                {!teamStarted && canInvite && (
                  <button
                    onClick={onOpenInviteModal}
                    className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
                  >
                    {t('dashboard.musicscale.center.getting_started.steps.team.action_invite', 'Convidar uma pessoa')}
                  </button>
                )}
                {canManageTeam && (
                  <button
                    onClick={onManageTeam}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl border border-white/10 transition-colors min-h-[44px]"
                  >
                    {t('dashboard.musicscale.center.getting_started.steps.team.action_manage', 'Ver equipe e convites')}
                  </button>
                )}
                {!canInvite && !canManageTeam && (
                  <p className="text-xs text-[#A0A7B5] italic">
                    {t('dashboard.musicscale.center.getting_started.steps.team.admin_notice', 'Peça a um administrador para enviar o convite.')}
                  </p>
                )}
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
                {t('dashboard.musicscale.center.getting_started.steps.songs.title', 'Adicione suas primeiras músicas')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.what', 'As músicas serão utilizadas nos repertórios e nas escalas.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.why', 'Sem músicas cadastradas, sua equipe não consegue preparar o repertório.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.how', 'Abra o MusicScale, entre na área de músicas e escolha a opção para adicionar uma música.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.songs.result', 'Suas primeiras músicas estarão disponíveis para os próximos repertórios.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
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
                {t('dashboard.musicscale.center.getting_started.steps.repertoire.title', 'Crie seu primeiro repertório')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.repertoire.what', 'O repertório reúne as músicas de um culto, ensaio ou evento.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.repertoire.why', 'A equipe consegue saber antecipadamente o que precisa estudar.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.repertoire.how', 'Abra a área de repertórios, crie um novo repertório e adicione as músicas.')}</p>
                <p className="text-[#A0A7B5] mt-1"><strong className="text-white">Exemplo: </strong>{t('dashboard.musicscale.center.getting_started.steps.repertoire.example', 'Culto de domingo, 19h.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.repertoire.result', 'O conjunto de músicas ficará organizado em um único lugar.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
                  {t('dashboard.musicscale.center.getting_started.steps.repertoire.action', 'Abrir MusicScale')}
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
                {t('dashboard.musicscale.center.getting_started.steps.scale.title', 'Monte sua primeira escala')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.scale.what', 'A escala define quem participará e qual será a função de cada pessoa.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.scale.why', 'Todos sabem quando servirão e o que precisam preparar.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.scale.how', 'Crie uma escala, escolha a data e adicione as pessoas e funções.')}</p>
                <p className="text-[#A0A7B5] mt-1"><strong className="text-white">Exemplo: </strong>{t('dashboard.musicscale.center.getting_started.steps.scale.example', 'liderança; vocal principal; backing vocal; teclado; guitarra; baixo; bateria.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.scale.result', 'A equipe ficará organizada para o culto.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
                  {t('dashboard.musicscale.center.getting_started.steps.scale.action', 'Abrir MusicScale')}
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
                {t('dashboard.musicscale.center.getting_started.steps.preparation.title', 'Prepare a equipe para o culto')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.preparation.what', 'Reúna as informações e orientações que todos precisam antes da ministração.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.preparation.why', 'Uma equipe bem informada chega mais preparada.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.preparation.how', 'Revise o repertório, a escala, os participantes e os materiais disponíveis.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.preparation.result', 'Todos conseguem visualizar o que precisam fazer.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
                  {t('dashboard.musicscale.center.getting_started.steps.preparation.action', 'Abrir MusicScale')}
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {renderTabs()}
      
      {activeSection === 'overview' && (
        <div className="animate-in fade-in duration-300">
          {heroContent}
          {renderOverviewHighlights()}
          {overviewContent}
        </div>
      )}
      
      {activeSection === 'resources' && renderResources()}
      
      {activeSection === 'getting-started' && renderGettingStarted()}
    </div>
  );
}
