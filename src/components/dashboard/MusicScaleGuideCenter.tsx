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
  AlertCircle,
  Globe,
  ArrowDown,
  Info,
  Sparkles,
  Music,
  Map
} from 'lucide-react';
import { motion } from 'framer-motion';

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
                : t('dashboard.musicscale.center.overview.team_desc', 'Aprenda a adicionar músicas ao Repertório, consultar cifras e letras e montar suas primeiras escalas.')
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
            {t('dashboard.musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('dashboard.musicscale.center.resources.description', 'Entenda onde ficam as músicas, cifras, letras, escalas e integrantes, e como cada área se conecta na preparação da equipe.')}
          </p>
        </div>

        <div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col md:flex-row gap-12 md:gap-8 justify-between">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-400" />
                </div>
                <div className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.live_library', 'Biblioteca Viva')}</div>
              </div>
              <div className="ml-5 border-l-2 border-white/10 pl-6 py-2">
                <ArrowDown className="w-4 h-4 text-[#A0A7B5] mb-2 -ml-[35px] bg-[#050505]" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-[#2B85EB]" />
                  </div>
                  <div className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.repertoire', 'Repertório de músicas')}</div>
                </div>
                <div className="border-l-2 border-white/10 pl-6 space-y-6">
                  <div className="relative">
                    <div className="absolute w-6 border-b-2 border-white/10 top-1/2 -left-6" />
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#A0A7B5]" />
                      <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.chords', 'Cifras')}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute w-6 border-b-2 border-white/10 top-1/2 -left-6" />
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#A0A7B5]" />
                      <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.lyrics', 'Letras')}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute w-6 border-b-2 border-white/10 top-1/2 -left-6" />
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-[#2B85EB]" />
                      <span className="text-sm text-white font-medium">{t('dashboard.musicscale.center.resources.flow.music_scale', 'Escala de Músicas')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <div className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.members', 'Integrantes')}</div>
              </div>
              <div className="ml-5 border-l-2 border-white/10 pl-6 py-2">
                <ArrowDown className="w-4 h-4 text-[#A0A7B5] mb-2 -ml-[35px] bg-[#050505]" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.band_scale', 'Escala da Banda')}</div>
                </div>
                <div className="border-l-2 border-white/10 pl-6">
                  <ArrowDown className="w-4 h-4 text-[#A0A7B5] mb-2 -ml-[35px] bg-[#050505]" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-[#2B85EB]" />
                    </div>
                    <div className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.music_scale', 'Escala de Músicas')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-[#2B85EB]/10 border border-[#2B85EB]/20 rounded-xl p-4 flex flex-col sm:flex-row items-start gap-4">
            <div className="mt-0.5 shrink-0">
              <Info className="w-5 h-5 text-[#2B85EB]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">{t('dashboard.musicscale.center.resources.flow.notice_title', 'Como o Repertório funciona')}</h4>
              <p className="text-sm text-[#A0A7B5]">
                {t('dashboard.musicscale.center.resources.flow.notice_text', 'No MusicScale, Repertório é o acervo de músicas da sua organização. Você não cria um repertório separado para cada culto. Para uma data ou evento, crie uma Escala de Músicas e escolha nela as músicas do Repertório.')}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-6">Músicas e conteúdo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Repertório de músicas */}
              <div className="bg-[#2B85EB]/10 border border-[#2B85EB]/30 rounded-2xl p-6 lg:p-8 flex flex-col h-full md:col-span-2 lg:col-span-2 shadow-[0_0_30px_rgba(43,133,235,0.05)]">
                <div className="w-12 h-12 rounded-xl bg-[#2B85EB]/20 flex items-center justify-center mb-6">
                  <ListMusic className="w-6 h-6 text-[#2B85EB]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.repertoire.title', 'Repertório de músicas')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-6">
                  {t('dashboard.musicscale.center.resources.repertoire.desc', 'É o acervo de músicas da sua organização. Nele ficam todas as músicas cadastradas ou importadas para a equipe.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>pesquisar por título ou artista;</li>
                    <li>abrir os detalhes de cada música;</li>
                    <li>consultar letra, cifra e tom quando estiverem disponíveis;</li>
                    <li>organizar músicas com tags e informações;</li>
                    <li>escolher essas músicas ao criar uma Escala de Músicas.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-[#2B85EB]" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Repertório &rarr; Músicas</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.repertoire.practice', 'Abra uma música para conferir seus detalhes, letra ou cifra. Depois, escolha essa música ao montar a escala de um culto.')}
                  </p>
                </div>
              </div>

              {/* Biblioteca Viva */}
              <div className="bg-gradient-to-br from-purple-500/10 to-[#050505] border border-purple-500/20 rounded-2xl p-6 lg:p-8 flex flex-col h-full lg:col-span-1 shadow-[0_0_30px_rgba(168,85,247,0.05)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded">Acervo global</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.library.title', 'Biblioteca Viva')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-6">
                  {t('dashboard.musicscale.center.resources.library.desc', 'Um acervo global e atualizado de músicas prontas para importar para o Repertório da sua organização.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>pesquisar músicas;</li>
                    <li>visualizar músicas completas;</li>
                    <li>encontrar letras;</li>
                    <li>encontrar cifras;</li>
                    <li>conferir o tom e os detalhes disponíveis;</li>
                    <li>importar a música para sua organização;</li>
                    <li>identificar o que já foi importado.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Biblioteca Viva</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.library.practice', 'Encontre uma música pronta, confira seu conteúdo e importe-a para o Repertório da sua organização.')}
                  </p>
                </div>
              </div>

              {/* Cifras */}
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.chords.title', 'Cifras')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-4">
                  {t('dashboard.musicscale.center.resources.chords.desc', 'Consulte as cifras das músicas que fazem parte do Repertório da sua organização.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>pesquisar por título ou artista;</li>
                    <li>filtrar por tom;</li>
                    <li>filtrar por tags;</li>
                    <li>abrir a cifra;</li>
                    <li>adicionar ou atualizar cifras quando possuir permissão.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Repertório &rarr; Cifras</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.chords.practice', 'Encontre rapidamente a cifra e o tom que a banda precisa preparar.')}
                  </p>
                </div>
              </div>

              {/* Letras */}
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.lyrics.title', 'Letras')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-4">
                  {t('dashboard.musicscale.center.resources.lyrics.desc', 'Consulte as letras das músicas cadastradas no Repertório.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>pesquisar por título, artista ou trecho;</li>
                    <li>visualizar a letra completa;</li>
                    <li>filtrar e organizar as músicas;</li>
                    <li>usar a letra durante a preparação da equipe.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Repertório &rarr; Letras</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.lyrics.practice', 'Abra a letra completa para revisar a ordem e as partes da música.')}
                  </p>
                </div>
              </div>

              {/* Importação Inteligente */}
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.ai_import.title', 'Importação inteligente')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-4">
                  {t('dashboard.musicscale.center.resources.ai_import.desc', 'Transforme uma cifra ou letra desorganizada em conteúdo estruturado para o MusicScale.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>colar uma cifra;</li>
                    <li>colar uma letra;</li>
                    <li>organizar automaticamente o conteúdo;</li>
                    <li>revisar antes de salvar;</li>
                    <li>adicionar a música ao Repertório.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Repertório &rarr; Músicas &rarr; Importar com IA</p>
                  <p className="text-[11px] text-[#A0A7B5] italic">
                    {t('dashboard.musicscale.center.resources.ai_import.notice', 'A disponibilidade depende dos recursos incluídos no plano.')}
                  </p>
                </div>
              </div>
            </div>
        </div>

        <div className="mb-12">
            <h3 className="text-xl font-bold text-white mb-6">Equipe e escalas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Escalas de Músicas */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 lg:p-8 flex flex-col h-full md:col-span-2 lg:col-span-2 shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
                  <CalendarDays className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.music_scales.title', 'Escalas de Músicas')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-6">
                  {t('dashboard.musicscale.center.resources.music_scales.desc', 'Organize as músicas que serão cantadas e tocadas em uma data e tipo de evento.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>escolher a data, o horário, o local e o tipo de evento;</li>
                    <li>selecionar músicas do Repertório;</li>
                    <li>vincular uma Escala da Banda;</li>
                    <li>visualizar as músicas e os integrantes da ocasião.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Escalas &rarr; Escalas de Músicas</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.music_scales.practice', 'Crie a escala do culto de domingo, escolha as músicas e vincule a banda que participará.')}
                  </p>
                </div>
              </div>

              {/* Integrantes */}
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 flex flex-col h-full lg:col-span-1">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.members.title', 'Integrantes')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-4">
                  {t('dashboard.musicscale.center.resources.members.desc', 'Visualize as pessoas que participam do ministério e suas especialidades.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>localizar músicos, vocais e ministros;</li>
                    <li>visualizar funções, instrumentos e especialidades;</li>
                    <li>filtrar integrantes pela especialidade.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4 mt-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Integrantes</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.members.practice', 'Encontre quem toca bateria, teclado ou guitarra e quem participa dos vocais.')}
                  </p>
                </div>
              </div>

              {/* Escalas da Banda */}
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 flex flex-col h-full lg:col-span-1">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t('dashboard.musicscale.center.resources.band_scales.title', 'Escalas da Banda')}
                </h3>
                <p className="text-sm text-[#A0A7B5] mb-4">
                  {t('dashboard.musicscale.center.resources.band_scales.desc', 'Organize os músicos, vocais, ministros e funções que atuarão em uma data ou evento.')}
                </p>
                <div className="mb-6 flex-1">
                  <strong className="text-sm text-white block mb-2">Você pode:</strong>
                  <ul className="text-sm text-[#A0A7B5] space-y-1.5 list-disc pl-4">
                    <li>escolher os integrantes e definir funções;</li>
                    <li>visualizar quem está escalado e criar a composição da banda;</li>
                    <li>vincular a Escala da Banda a uma Escala de Músicas.</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4 mt-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Map className="w-4 h-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Onde encontrar</span>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-3">Escalas &rarr; Escalas da Banda</p>
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    <strong className="text-white">Na prática:</strong> {t('dashboard.musicscale.center.resources.band_scales.practice', 'Defina vocal principal, backing vocals, teclado, guitarra, baixo e bateria para o culto.')}
                  </p>
                </div>
              </div>
            </div>
        </div>

        <div className="bg-gradient-to-r from-[#0a0a0a] to-[#111] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center">
          <h3 className="text-xl font-bold text-white mb-4">{t('dashboard.musicscale.center.resources.preparation_result.title', 'Tudo conectado para preparar a equipe')}</h3>
          <p className="text-[#A0A7B5] max-w-2xl mb-8">
            {t('dashboard.musicscale.center.resources.preparation_result.text', 'O Repertório reúne as músicas. Cifras e Letras ajudam no estudo. Os Integrantes formam a Escala da Banda. A Escala de Músicas organiza o que será apresentado em cada data e pode receber a banda que atuará naquele evento.')}
          </p>
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
            {t('dashboard.musicscale.center.getting_started.operational_notice', 'As etapas de Repertório, cifras, letras, integrantes e escalas acontecem dentro do MusicScale. Abra o aplicativo e siga as orientações abaixo.')}
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
                {t('dashboard.musicscale.center.getting_started.steps.songs.title', 'Adicione músicas ao Repertório')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.what', 'O Repertório reúne todas as músicas da sua organização.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.why', 'As músicas do Repertório poderão ser escolhidas nas Escalas de Músicas.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.songs.how', 'No MusicScale, abra Repertório → Músicas. Adicione manualmente, use a importação inteligente ou importe pela Biblioteca Viva.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.songs.result', 'As músicas usadas pela organização estarão disponíveis em um único acervo.')}
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
                {t('dashboard.musicscale.center.getting_started.steps.content.title', 'Confira cifras e letras')}
              </h3>
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.content.what', 'Cifras e Letras são visualizações do conteúdo das músicas que já estão no Repertório.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.content.why', 'A equipe encontra rapidamente o material necessário para estudar.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.content.how', 'Abra Repertório → Cifras ou Repertório → Letras.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.content.result', 'Músicos e vocais terão acesso ao conteúdo necessário para a preparação.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
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
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.members.what', 'A área Integrantes reúne músicos, vocais, ministros, funções e especialidades.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.members.why', 'Essas informações ajudam a montar Escalas da Banda de forma mais clara.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.members.how', 'Abra Integrantes e confira se as funções e especialidades estão corretas.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.members.result', 'O MusicScale saberá quem pode atuar em cada instrumento ou função.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
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
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.band_scale.what', 'A Escala da Banda define quem atuará e qual será a função de cada pessoa.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.band_scale.why', 'A equipe entende quem participará e como será formada.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.band_scale.how', 'Abra Escalas → Escalas da Banda, escolha os integrantes e defina as funções.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.band_scale.result', 'A banda e os vocais da ocasião estarão organizados.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
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
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.music_scale.what', 'A Escala de Músicas reúne as músicas de uma data e tipo de evento.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.music_scale.why', 'A equipe sabe o que será cantado e tocado.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.music_scale.how', 'Abra Escalas → Escalas de Músicas, escolha a data, o tipo de evento, o local e as músicas do Repertório. Você também pode vincular a Escala da Banda.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.music_scale.result', 'As músicas e a equipe daquele evento estarão organizadas.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
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
              <span className="px-2 py-0.5 bg-white/10 text-[#A0A7B5] text-xs font-semibold rounded-md uppercase tracking-wider">
                {t('dashboard.musicscale.center.getting_started.statuses.continue_in_ms', 'Continue no MusicScale')}
              </span>
            </div>
            
            <div className="space-y-4 text-sm max-w-2xl">
              <div>
                <strong className="text-white block mb-1">O que é:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.review.what', 'Antes do culto, confira se músicas, letras, cifras e integrantes estão corretos.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Por que é importante:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.review.why', 'Uma equipe bem informada consegue se preparar melhor.')}</p>
              </div>
              <div>
                <strong className="text-white block mb-1">Como fazer:</strong>
                <p className="text-[#A0A7B5]">{t('dashboard.musicscale.center.getting_started.steps.review.how', 'Revise a Escala de Músicas e a Escala da Banda vinculada.')}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[#A0A7B5]">
                  <strong className="text-white">Resultado esperado: </strong>
                  {t('dashboard.musicscale.center.getting_started.steps.review.result', 'Todos terão clareza sobre o que preparar e quando participar.')}
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={onOpenMusicScale}
                  disabled={!musicScaleReady}
                  className="px-5 py-2.5 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/5 disabled:text-[#A0A7B5] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 min-h-[44px] w-fit"
                >
                  {t('dashboard.musicscale.center.getting_started.steps.review.action', 'Abrir MusicScale')}
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
