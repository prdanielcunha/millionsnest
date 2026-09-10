import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  Globe,
  Info,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  ListMusic,
  Settings,
  ShieldAlert,
  UserPlus,
  Users
} from 'lucide-react';
import {
  resolveAppDestination,
  resolveAppEntityDestination
} from '../../lib/appExperienceRegistry.js';

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
  onOpenMusicScale: (destinationPath?: string) => void;
  onNavigateToBilling: () => void;
  heroContent?: React.ReactNode;
  overviewContent?: React.ReactNode;
  memberCount: number;
  pendingInviteCount: number;
  musicScaleSummary: {
    songsCount: number;
    songsWithContentCount: number;
    configuredMembersCount: number;
    scalesCount: number;
    bandScalesCount: number;
    nextScale: null | {
      id: string;
      date?: string;
      time?: string | null;
      songCount: number;
      assignmentCount: number;
      responseSummaryAvailable?: boolean;
      responseCounts: {
        pending: number;
        accepted: number;
        maybe: number;
        declined: number;
      };
    };
    updatedAtMs: number;
  };
}

type GuideStep = {
  id: 'organization' | 'team' | 'songs' | 'content' | 'members' | 'band_scale' | 'music_scale' | 'review';
  key: string;
  destinationId?: string;
};

const GUIDE_STEPS: GuideStep[] = [
  { id: 'organization', key: 'organization' },
  { id: 'team', key: 'team' },
  { id: 'songs', key: 'songs', destinationId: 'songs' },
  { id: 'content', key: 'content', destinationId: 'songs' },
  { id: 'members', key: 'members', destinationId: 'members' },
  { id: 'band_scale', key: 'band_scale', destinationId: 'band_scales' },
  { id: 'music_scale', key: 'music_scale', destinationId: 'music_scales' },
  { id: 'review', key: 'review', destinationId: 'music_scales' }
];

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
  heroContent: externalHeroContent,
  memberCount,
  pendingInviteCount,
  musicScaleSummary
}: MusicScaleGuideCenterProps) {
  const { t } = useTranslation('dashboard');

  const appSummaryReady = musicScaleSummary.updatedAtMs > 0;
  const completedByStep: Record<GuideStep['id'], boolean> = {
    organization: organizationReady,
    team: memberCount > 1,
    songs: appSummaryReady && musicScaleSummary.songsCount > 0,
    content: appSummaryReady && musicScaleSummary.songsWithContentCount > 0,
    members: appSummaryReady && musicScaleSummary.configuredMembersCount > 0,
    band_scale: appSummaryReady && musicScaleSummary.bandScalesCount > 0,
    music_scale: appSummaryReady && musicScaleSummary.scalesCount > 0,
    review:
      appSummaryReady &&
      musicScaleSummary.scalesCount > 0 &&
      (!musicScaleSummary.nextScale ||
        (musicScaleSummary.nextScale.songCount > 0 && musicScaleSummary.nextScale.assignmentCount > 0))
  };

  const completedCount = GUIDE_STEPS.filter(step => completedByStep[step.id]).length;
  const progressPercent = Math.round((completedCount / GUIDE_STEPS.length) * 100);
  const nextStep = GUIDE_STEPS.find(step => !completedByStep[step.id]) || null;
  const [expandedStep, setExpandedStep] = React.useState<string | null>(nextStep?.id || null);

  React.useEffect(() => {
    if (nextStep?.id) {
      setExpandedStep(current => current || nextStep.id);
    }
  }, [nextStep?.id]);

  const pathFor = (destinationId: string): string =>
    resolveAppDestination('musicscale', destinationId) || '/';

  const pathForStep = (step: GuideStep): string => {
    if (step.id === 'review' && musicScaleSummary.nextScale?.id) {
      return (
        resolveAppEntityDestination('musicscale', 'music_scale', musicScaleSummary.nextScale.id) ||
        pathFor('music_scales')
      );
    }
    return pathFor(step.destinationId || 'home');
  };

  const appActionDisabled = hasPaymentIssue ? !canManageBilling : !musicScaleReady;

  const openDestination = (destinationId: string) => {
    if (hasPaymentIssue) {
      if (canManageBilling) onNavigateToBilling();
      return;
    }
    if (!musicScaleReady) return;
    onOpenMusicScale(pathFor(destinationId));
  };

  const renderTabs = () => {
    const tabs = [
      {
        id: 'overview' as const,
        icon: LayoutDashboard,
        label: t('musicscale.center.tabs.overview', 'Visão geral')
      },
      {
        id: 'getting-started' as const,
        icon: ListChecks,
        label: t('musicscale.center.tabs.getting_started', 'Primeiros passos')
      },
      {
        id: 'resources' as const,
        icon: ListMusic,
        label: t('musicscale.center.tabs.resources', 'Recursos')
      }
    ];

    return (
      <div className="sticky top-0 z-20 mb-7 -mx-2 px-2 py-2 bg-[#050505]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/65">
        <div
          className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,.22)]"
          role="tablist"
          aria-label={t('musicscale.center.overview.title', 'MusicScale')}
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            const selected = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectSection(tab.id)}
                className={`min-h-[46px] rounded-xl px-2 sm:px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-[#2B85EB]/70 ${
                  selected
                    ? 'bg-white/[0.10] text-white shadow-[0_8px_30px_rgba(0,0,0,.20)] border border-white/[0.08]'
                    : 'text-[#8F98A8] hover:text-white hover:bg-white/[0.045] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-[#2B85EB]' : ''}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const nextOperationalStep = nextStep && !['organization', 'team'].includes(nextStep.id) ? nextStep : null;
    const nextOperationalTitle = nextOperationalStep
      ? t(`musicscale.center.getting_started.steps.${nextOperationalStep.key}.title`, t('musicscale.center.fallback.guide_step', 'Etapa do guia'))
      : '';
    const nextOperationalDescription = nextOperationalStep
      ? t(`musicscale.center.getting_started.steps.${nextOperationalStep.key}.what`, '')
      : '';

    let nextTitle = t('musicscale.summary.title', 'Resumo do MusicScale');
    let nextDescription = t('musicscale.center.overview.description', 'Acompanhe sua preparação e abra cada área exatamente onde precisa trabalhar.');
    let nextAction = t('musicscale.center.overview.primary_action', 'Abrir MusicScale');
    let nextActionDisabled = false;
    let handleNextAction = () => onOpenMusicScale(pathFor('home'));

    if (hasPaymentIssue) {
      nextTitle = t('musicscale.center.resources.regularize_subscription', 'Regularizar assinatura');
      nextDescription = canManageBilling
        ? t('musicscale.center.resources.billing_aria', 'Regularize a assinatura para voltar a acessar o MusicScale.', { resource: 'MusicScale' })
        : t('musicscale.center.resources.ask_billing_owner', 'Peça ao responsável pela assinatura para regularizar o acesso.');
      nextAction = t('musicscale.center.resources.regularize_subscription', 'Regularizar assinatura');
      nextActionDisabled = !canManageBilling;
      handleNextAction = onNavigateToBilling;
    } else if (!organizationReady) {
      nextTitle = t('musicscale.center.getting_started.organization.attention_title', 'Confira sua organização');
      nextDescription = t('musicscale.center.getting_started.organization.attention_description', 'Confirme os dados da igreja ou organização antes de continuar.');
      nextAction = t('musicscale.center.getting_started.organization.check_action', 'Conferir dados');
      nextActionDisabled = !canManageOrganization;
      handleNextAction = onReviewOrganization;
    } else if (!teamStarted) {
      nextTitle = t('musicscale.center.getting_started.team.invite_title', 'Convide sua equipe');
      nextDescription = t('musicscale.center.getting_started.team.empty_description', 'Convide as primeiras pessoas que utilizarão o MusicScale com você.');
      nextAction = canInvite
        ? t('musicscale.center.getting_started.team.invite_action', 'Convidar uma pessoa')
        : t('musicscale.center.getting_started.team.manage_action', 'Ver equipe e convites');
      nextActionDisabled = !canInvite && !canManageTeam;
      handleNextAction = canInvite ? onOpenInviteModal : onManageTeam;
    } else if (nextOperationalStep) {
      nextTitle = nextOperationalTitle;
      nextDescription = nextOperationalDescription;
      nextAction = t(`musicscale.center.getting_started.steps.${nextOperationalStep.key}.action`, t('musicscale.center.overview.primary_action', 'Abrir MusicScale'));
      nextActionDisabled = !musicScaleReady;
      handleNextAction = () => onOpenMusicScale(pathForStep(nextOperationalStep));
    } else if (completedCount === GUIDE_STEPS.length) {
      nextTitle = t('musicscale.center.getting_started.statuses.completed', 'Concluído');
      nextDescription = t('musicscale.summary.synced', 'Sua operação está sincronizada com o MusicScale.');
      nextAction = t('musicscale.center.overview.primary_action', 'Abrir MusicScale');
      nextActionDisabled = !musicScaleReady;
      handleNextAction = () => onOpenMusicScale(pathFor('home'));
    }

    const metrics = [
      {
        key: 'repertoire',
        label: t('musicscale.summary.repertoire', 'Repertório'),
        value: musicScaleSummary.songsCount,
        destination: 'repertoire',
        icon: ListMusic
      },
      {
        key: 'content',
        label: t('musicscale.center.getting_started.steps.content.title', 'Cifras e letras'),
        value: musicScaleSummary.songsCount > 0
          ? `${Math.round((musicScaleSummary.songsWithContentCount / musicScaleSummary.songsCount) * 100)}%`
          : '0%',
        destination: 'repertoire',
        icon: FileText
      },
      {
        key: 'members',
        label: t('musicscale.summary.configured_members', 'Integrantes configurados'),
        value: musicScaleSummary.configuredMembersCount,
        destination: 'members',
        icon: Users
      },
      {
        key: 'scales',
        label: t('musicscale.summary.music_scales', 'Escalas de músicas'),
        value: musicScaleSummary.scalesCount,
        destination: 'music_scales',
        icon: CalendarDays
      }
    ];

    const nextScale = musicScaleSummary.nextScale;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
        {externalHeroContent}

        <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-[#2B85EB]/20 bg-[radial-gradient(circle_at_10%_0%,rgba(43,133,235,.18),transparent_42%),linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.015))] p-5 sm:p-7">
            <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#2B85EB]/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B85EB]">
                    {t('musicscale.center.getting_started.statuses.next_step', 'Próxima etapa')}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mt-2">{nextTitle}</h2>
                </div>
                <div className="w-14 h-14 rounded-2xl border border-white/10 bg-black/20 flex flex-col items-center justify-center shrink-0">
                  <span className="text-lg font-semibold text-white leading-none">{progressPercent}%</span>
                  <span className="text-[9px] text-[#8F98A8] mt-1">{completedCount}/{GUIDE_STEPS.length}</span>
                </div>
              </div>

              <p className="text-sm text-[#A0A7B5] leading-relaxed max-w-2xl min-h-[40px]">{nextDescription}</p>

              <div className="mt-6 h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2B85EB] to-[#70B4FF] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleNextAction}
                  disabled={nextActionDisabled}
                  className="min-h-[46px] px-5 rounded-xl bg-white text-[#050505] disabled:bg-white/5 disabled:text-[#737B89] disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 transition-transform hover:-translate-y-0.5"
                >
                  {nextAction}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSection('getting-started')}
                  className="min-h-[46px] px-5 rounded-xl border border-white/10 bg-white/[0.035] hover:bg-white/[0.065] text-white text-sm font-semibold flex items-center gap-2"
                >
                  {t('musicscale.center.tabs.getting_started', 'Primeiros passos')}
                  <ChevronRight className="w-4 h-4 text-[#8F98A8]" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6 flex flex-col min-h-[230px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8F98A8]">
                  {t('musicscale.summary.next_scale', 'Próxima escala')}
                </p>
                <h3 className="text-lg font-semibold text-white mt-2">
                  {nextScale
                    ? t('musicscale.summary.music_scales', 'Escala de músicas')
                    : t('musicscale.summary.no_upcoming', 'Nenhuma próxima escala')}
                </h3>
              </div>
              <CalendarDays className="w-5 h-5 text-[#2B85EB]" />
            </div>

            {nextScale ? (
              <>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3">
                    <p className="text-lg font-semibold text-white">{nextScale.songCount}</p>
                    <p className="text-[10px] text-[#8F98A8] mt-1">{t('musicscale.summary.repertoire', 'Músicas')}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/[0.06] p-3">
                    <p className="text-lg font-semibold text-white">{nextScale.responseCounts.pending}</p>
                    <p className="text-[10px] text-[#8F98A8] mt-1">{t('musicscale.summary.pending', 'Pendentes')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenMusicScale(
                    resolveAppEntityDestination('musicscale', 'music_scale', nextScale.id) || pathFor('music_scales')
                  )}
                  disabled={!musicScaleReady || hasPaymentIssue}
                  className="mt-auto min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white flex items-center justify-center gap-2"
                >
                  {t('musicscale.center.resources.view_in_ms', 'Ver no MusicScale')}
                  <ExternalLink className="w-4 h-4 text-[#8F98A8]" />
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#8F98A8] leading-relaxed mt-4">
                  {t('musicscale.summary.no_upcoming_desc', 'Crie uma escala quando quiser preparar o próximo culto ou evento.')}
                </p>
                <button
                  type="button"
                  onClick={() => openDestination('music_scales')}
                  disabled={appActionDisabled}
                  className="mt-auto min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white flex items-center justify-center gap-2"
                >
                  {t('musicscale.center.getting_started.steps.music_scale.action', 'Abrir escalas')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(metric => {
            const Icon = metric.icon;
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => openDestination(metric.destination)}
                disabled={appActionDisabled}
                className="group min-h-[112px] rounded-2xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.13] disabled:opacity-45 disabled:cursor-not-allowed p-4 text-left transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-white">{metric.value}</span>
                  <Icon className="w-4 h-4 text-[#667085] group-hover:text-[#2B85EB] transition-colors" />
                </div>
                <p className="text-[11px] text-[#8F98A8] mt-2 leading-snug">{metric.label}</p>
              </button>
            );
          })}
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
              </h3>
              <p className="text-xs text-[#8F98A8] mt-1">
                {t('musicscale.center.resources.description', 'Abra diretamente a área que você precisa usar agora.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectSection('resources')}
              className="min-h-[44px] px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-xs font-semibold text-white flex items-center justify-center gap-2"
            >
              {t('musicscale.center.tabs.resources', 'Recursos')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'repertoire', destination: 'repertoire', icon: ListMusic },
              { key: 'library', destination: 'library', icon: Globe },
              { key: 'members', destination: 'members', icon: Users },
              { key: 'music_scales', destination: 'music_scales', icon: CalendarDays }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openDestination(item.destination)}
                  disabled={appActionDisabled}
                  className="min-h-[86px] rounded-xl border border-white/[0.07] bg-black/15 hover:bg-white/[0.04] disabled:opacity-45 disabled:cursor-not-allowed p-3 text-left flex flex-col justify-between"
                >
                  <Icon className="w-4 h-4 text-[#2B85EB]" />
                  <div className="flex items-end justify-between gap-2 mt-3">
                    <span className="text-xs font-semibold text-white">
                      {t(`musicscale.center.resources.${item.key}.title`, t('musicscale.center.fallback.resource', 'Recurso'))}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderGettingStarted = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
      <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B85EB]">
              {t('musicscale.center.tabs.getting_started', 'Primeiros passos')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-2">
              {t('musicscale.center.getting_started.title', 'Primeiros passos no MusicScale')}
            </h2>
            <p className="text-sm text-[#A0A7B5] leading-relaxed mt-3">
              {t('musicscale.center.getting_started.description', 'Siga esta ordem sugerida para preparar sua organização no MusicScale.')}
            </p>
          </div>
          <div className="min-w-[170px]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[#8F98A8]">{t('musicscale.center.getting_started.statuses.completed', 'Concluído')}</span>
              <strong className="text-white">{completedCount}/{GUIDE_STEPS.length}</strong>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2B85EB] to-[#70B4FF] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.055] p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#2B85EB] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">
            {t('musicscale.center.getting_started.guidance_title', 'Você não precisa decorar o sistema')}
          </p>
          <p className="text-xs sm:text-sm text-[#8F98A8] leading-relaxed mt-1">
            {organizationReady && teamStarted
              ? t('musicscale.center.getting_started.guidance_ready', 'Sua organização e sua equipe já estão prontas. O painel acompanha o que já foi feito e mostra o próximo passo.')
              : !organizationReady
                ? t('musicscale.center.getting_started.guidance_org', 'Comece conferindo os dados da sua igreja ou organização. Depois, o painel mostra o próximo passo.')
                : t('musicscale.center.getting_started.guidance_team', 'Sua organização está pronta. Agora convide as pessoas que usarão o MusicScale com você.')}
          </p>
        </div>
      </div>

      <section className="space-y-2">
        {GUIDE_STEPS.map((step, index) => {
          const completed = completedByStep[step.id];
          const isNext = nextStep?.id === step.id;
          const expanded = expandedStep === step.id;

          let title = t(`musicscale.center.getting_started.steps.${step.key}.title`, t('musicscale.center.fallback.guide_step', 'Etapa do guia'));
          let description = t(`musicscale.center.getting_started.steps.${step.key}.what`, '');
          let statusText = completed
            ? t('musicscale.center.getting_started.statuses.completed', 'Concluído')
            : isNext
              ? t('musicscale.center.getting_started.statuses.next_step', 'Próxima etapa')
              : t('musicscale.center.getting_started.statuses.do_in_ms', 'Faça no MusicScale');

          if (step.id === 'organization') {
            title = organizationReady
              ? t('musicscale.center.getting_started.organization.ready_title', 'Organização pronta')
              : t('musicscale.center.getting_started.organization.attention_title', 'Confira sua organização');
            description = organizationReady
              ? t('musicscale.center.getting_started.organization.ready_description', 'Sua igreja ou organização já está criada no MillionsNest.')
              : t('musicscale.center.getting_started.organization.attention_description', 'Confirme os dados da igreja ou organização antes de continuar.');
            statusText = organizationReady
              ? t('musicscale.center.getting_started.statuses.completed', 'Concluído')
              : t('musicscale.center.getting_started.statuses.attention', 'Precisa de atenção');
          }

          if (step.id === 'team') {
            if (memberCount > 1) {
              title = t('musicscale.center.getting_started.team.connected_title', 'Equipe conectada');
              description = t('musicscale.center.getting_started.team.connected_description', 'Sua organização já possui outras pessoas ativas.');
              statusText = t('musicscale.center.getting_started.statuses.completed', 'Concluído');
            } else if (pendingInviteCount > 0) {
              title = t('musicscale.center.getting_started.team.invite_sent_title', 'Convite enviado');
              description = t('musicscale.center.getting_started.team.waiting_description', 'Há um convite aguardando a pessoa entrar na organização.');
              statusText = t('musicscale.center.getting_started.statuses.pending_invite', 'Convite enviado');
            } else {
              title = t('musicscale.center.getting_started.team.invite_title', 'Convide sua equipe');
              description = t('musicscale.center.getting_started.team.empty_description', 'Convide as primeiras pessoas que utilizarão o MusicScale com você.');
              statusText = t('musicscale.center.getting_started.statuses.pending', 'Pendente');
            }
          }

          const why = t(`musicscale.center.getting_started.steps.${step.key}.why`, '');
          const how = t(`musicscale.center.getting_started.steps.${step.key}.how`, '');
          const result = t(`musicscale.center.getting_started.steps.${step.key}.result`, '');

          return (
            <article
              key={step.id}
              className={`rounded-2xl border transition-all ${
                isNext
                  ? 'border-[#2B85EB]/30 bg-[#2B85EB]/[0.055] shadow-[0_16px_50px_rgba(0,0,0,.14)]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedStep(expanded ? null : step.id)}
                aria-expanded={expanded}
                className="min-h-[74px] w-full px-4 sm:px-5 py-3 flex items-center gap-4 text-left outline-none focus:ring-2 focus:ring-[#2B85EB]/60 rounded-2xl"
              >
                <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border ${
                  completed
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : isNext
                      ? 'bg-[#2B85EB]/15 border-[#2B85EB]/25 text-[#70B4FF]'
                      : 'bg-white/[0.035] border-white/[0.07] text-[#667085]'
                }`}>
                  {completed ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-white">{title}</h3>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-full border ${
                      completed
                        ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]'
                        : isNext
                          ? 'text-[#70B4FF] border-[#2B85EB]/20 bg-[#2B85EB]/[0.08]'
                          : 'text-[#7D8796] border-white/[0.07] bg-white/[0.025]'
                    }`}>
                      {statusText}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#8F98A8] mt-1 line-clamp-2">{description}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-[#667085] shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>

              {expanded && (
                <div className="px-4 sm:px-5 pb-5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="ml-0 sm:ml-[52px] border-t border-white/[0.06] pt-4">
                    {(why || how || result) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                        {why && (
                          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                              {t('musicscale.center.common.why', 'Por que fazer')}
                            </p>
                            <p className="text-xs text-[#A0A7B5] leading-relaxed mt-2">{why}</p>
                          </div>
                        )}
                        {how && (
                          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                              {t('musicscale.center.common.how_to', 'Como fazer')}
                            </p>
                            <p className="text-xs text-[#A0A7B5] leading-relaxed mt-2">{how}</p>
                          </div>
                        )}
                        {result && (
                          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                              {t('musicscale.center.common.expected_result', 'Resultado esperado')}
                            </p>
                            <p className="text-xs text-[#A0A7B5] leading-relaxed mt-2">{result}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {step.id === 'team' && (
                      <div className="mb-4 rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] p-3 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-[#2B85EB] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#A0A7B5] leading-relaxed">
                          {t('musicscale.center.getting_started.steps.team.important', 'A função Administrador ou Membro define o acesso ao MillionsNest. Funções ministeriais, como músico, vocal ou líder, são configuradas dentro do MusicScale.')}
                        </p>
                      </div>
                    )}

                    {step.id === 'organization' ? (
                      canManageOrganization ? (
                        <button
                          type="button"
                          onClick={onReviewOrganization}
                          className="min-h-[44px] px-4 rounded-xl bg-white text-[#050505] text-xs font-semibold flex items-center gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          {t('musicscale.center.getting_started.organization.check_action', 'Conferir dados')}
                        </button>
                      ) : (
                        <p className="text-xs text-amber-300 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4" />
                          {t('musicscale.center.getting_started.organization.admin_notice', 'Um administrador pode alterar esses dados.')}
                        </p>
                      )
                    ) : step.id === 'team' ? (
                      !canInvite && !canManageTeam ? (
                        <p className="text-xs text-amber-300 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4" />
                          {t('musicscale.center.getting_started.team.no_permission', 'Peça a um administrador para convidar ou gerenciar a equipe.')}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {canInvite && (
                            <button
                              type="button"
                              onClick={onOpenInviteModal}
                              className="min-h-[44px] px-4 rounded-xl bg-white text-[#050505] text-xs font-semibold flex items-center gap-2"
                            >
                              <UserPlus className="w-4 h-4" />
                              {memberCount > 1 || pendingInviteCount > 0
                                ? t('musicscale.center.getting_started.team.invite_another_action', 'Convidar outra pessoa')
                                : t('musicscale.center.getting_started.team.invite_action', 'Convidar uma pessoa')}
                            </button>
                          )}
                          {canManageTeam && (
                            <button
                              type="button"
                              onClick={onManageTeam}
                              className="min-h-[44px] px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] text-white text-xs font-semibold flex items-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              {t('musicscale.center.getting_started.team.manage_action', 'Ver equipe e convites')}
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenMusicScale(pathForStep(step))}
                        disabled={!musicScaleReady || hasPaymentIssue}
                        className="min-h-[44px] px-4 rounded-xl bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-white/[0.04] disabled:text-[#667085] disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2"
                      >
                        {t(`musicscale.center.getting_started.steps.${step.key}.action`, t('musicscale.center.overview.primary_action', 'Abrir MusicScale'))}
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );

  const renderResources = () => {
    const resourceCards = [
      { key: 'repertoire', icon: ListMusic, destination: 'repertoire', metric: String(musicScaleSummary.songsCount) },
      { key: 'library', icon: Globe, destination: 'library', metric: null },
      { key: 'chords', icon: FileText, destination: 'chords', metric: musicScaleSummary.songsCount > 0 ? `${Math.round((musicScaleSummary.songsWithContentCount / musicScaleSummary.songsCount) * 100)}%` : '0%' },
      { key: 'lyrics', icon: FileText, destination: 'lyrics', metric: musicScaleSummary.songsCount > 0 ? `${Math.round((musicScaleSummary.songsWithContentCount / musicScaleSummary.songsCount) * 100)}%` : '0%' },
      { key: 'ai_import', icon: LinkIcon, destination: 'ai_import', metric: null },
      { key: 'music_scales', icon: CalendarDays, destination: 'music_scales', metric: String(musicScaleSummary.scalesCount) },
      { key: 'members', icon: Users, destination: 'members', metric: String(musicScaleSummary.configuredMembersCount) },
      { key: 'band_scales', icon: CalendarDays, destination: 'band_scales', metric: String(musicScaleSummary.bandScalesCount) }
    ];

    const flowNodes = [
      { key: 'library', destination: 'library', icon: Globe },
      { key: 'repertoire', destination: 'repertoire', icon: ListMusic },
      { key: 'music_scales', destination: 'music_scales', icon: CalendarDays }
    ];

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-5 sm:p-7">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2B85EB]">
              {t('musicscale.center.tabs.resources', 'Recursos')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-2">
              {t('musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
            </h2>
            <p className="text-sm text-[#A0A7B5] leading-relaxed mt-3">
              {t('musicscale.center.resources.description', 'Entenda onde ficam as músicas, cifras, letras, escalas e integrantes, e abra cada área diretamente.')}
            </p>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/15 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-[#2B85EB]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {t('musicscale.center.resources.flow.notice_title', 'Como o Repertório funciona')}
              </h3>
              <p className="text-[11px] text-[#8F98A8] mt-0.5">
                {t('musicscale.center.resources.flow.notice_text', 'Cada etapa se conecta à próxima. Clique em qualquer área para abrir no ponto certo.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2">
            {flowNodes.map((node, index) => {
              const Icon = node.icon;
              return (
                <React.Fragment key={node.key}>
                  <button
                    type="button"
                    onClick={() => openDestination(node.destination)}
                    disabled={appActionDisabled}
                    className="group min-h-[88px] rounded-2xl border border-white/[0.08] bg-black/15 hover:bg-white/[0.045] hover:border-[#2B85EB]/20 disabled:opacity-45 disabled:cursor-not-allowed p-4 text-left transition-all"
                  >
                    <Icon className="w-4 h-4 text-[#2B85EB]" />
                    <div className="flex items-end justify-between gap-3 mt-4">
                      <span className="text-sm font-semibold text-white">
                        {t(`musicscale.center.resources.${node.key}.title`, t('musicscale.center.fallback.resource', 'Recurso'))}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#667085] group-hover:text-white" />
                    </div>
                  </button>
                  {index < flowNodes.length - 1 && (
                    <div className="hidden md:flex items-center justify-center px-1 text-[#3B4655]">
                      <ArrowRight className="w-4 h-4" />
                      <span className="sr-only">
                        {index === 0
                          ? t('musicscale.center.resources.flow.imports_to', 'importa para')
                          : t('musicscale.center.resources.flow.supplies_songs_to', 'fornece músicas para')}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
            <button
              type="button"
              onClick={() => openDestination('members')}
              disabled={appActionDisabled}
              className="min-h-[70px] rounded-2xl border border-white/[0.08] bg-black/15 hover:bg-white/[0.045] disabled:opacity-45 disabled:cursor-not-allowed p-4 flex items-center gap-3 text-left"
            >
              <Users className="w-4 h-4 text-[#2B85EB] shrink-0" />
              <span className="text-sm font-semibold text-white">
                {t('musicscale.center.resources.flow.members', 'Integrantes')}
              </span>
            </button>
            <div className="hidden md:flex items-center gap-2 px-2 text-[#667085]">
              <LinkIcon className="w-3.5 h-3.5" />
              <span className="text-[9px] uppercase tracking-[0.14em] font-bold">
                {t('musicscale.center.resources.flow.forms', 'formam')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openDestination('band_scales')}
              disabled={appActionDisabled}
              className="min-h-[70px] rounded-2xl border border-white/[0.08] bg-black/15 hover:bg-white/[0.045] disabled:opacity-45 disabled:cursor-not-allowed p-4 flex items-center gap-3 text-left"
            >
              <CalendarDays className="w-4 h-4 text-[#2B85EB] shrink-0" />
              <div>
                <span className="text-sm font-semibold text-white block">
                  {t('musicscale.center.resources.flow.band_scale', 'Escala da Banda')}
                </span>
                <span className="text-[10px] text-[#667085] mt-1 block">
                  {t('musicscale.center.resources.flow.can_link_to', 'pode ser vinculada')}{' · '}
                  {t('musicscale.center.resources.flow.optional_link', 'opcional')}
                </span>
              </div>
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resourceCards.map(card => {
            const Icon = card.icon;
            const title = t(`musicscale.center.resources.${card.key}.title`, t('musicscale.center.fallback.resource', 'Recurso'));
            const desc = t(`musicscale.center.resources.${card.key}.desc`, '');
            const where = t(`musicscale.center.resources.${card.key}.where`, '');
            const canDoRaw = t(`musicscale.center.resources.${card.key}.can_do`, { returnObjects: true });
            const canDo = Array.isArray(canDoRaw) ? canDoRaw.slice(0, 2) as string[] : [];

            return (
              <article
                key={card.key}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.022] p-5 hover:bg-white/[0.035] hover:border-white/[0.13] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#70B4FF]" />
                  </div>
                  {card.metric !== null && (
                    <span className="text-lg font-semibold text-white">{card.metric}</span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-white mt-4">{title}</h3>
                <p className="text-xs text-[#8F98A8] leading-relaxed mt-2 min-h-[32px]">{desc}</p>

                {canDo.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {canDo.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 text-[11px] text-[#A0A7B5]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                      {t('musicscale.center.common.where_to_find', 'Onde encontrar')}
                    </p>
                    <p className="text-[11px] text-[#A0A7B5] mt-1 truncate">{where}</p>
                  </div>

                  {hasPaymentIssue ? (
                    canManageBilling ? (
                      <button
                        type="button"
                        onClick={onNavigateToBilling}
                        aria-label={t('musicscale.center.resources.billing_aria', 'Regularizar assinatura para acessar {{resource}}', { resource: title })}
                        className="min-h-[44px] px-4 rounded-xl bg-amber-400 text-black text-xs font-semibold flex items-center justify-center gap-2 shrink-0"
                      >
                        {t('musicscale.center.resources.regularize_subscription', 'Regularizar assinatura')}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <p className="text-[11px] text-amber-300 flex items-center gap-2">
                        <CircleAlert className="w-4 h-4 shrink-0" />
                        {t('musicscale.center.resources.ask_billing_owner', 'Peça ao responsável pela assinatura para regularizar o acesso.')}
                      </p>
                    )
                  ) : !musicScaleReady ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      aria-label={t('musicscale.center.resources.unavailable_aria', '{{resource}} indisponível no MusicScale', { resource: title })}
                      className="min-h-[44px] px-4 rounded-xl bg-white/[0.035] text-[#667085] text-xs font-semibold cursor-not-allowed shrink-0"
                    >
                      {t('musicscale.center.resources.unavailable', 'MusicScale indisponível')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenMusicScale(pathFor(card.destination))}
                      aria-label={t('musicscale.center.resources.view_aria', 'Ver {{resource}} no MusicScale', { resource: title })}
                      className="min-h-[44px] px-4 rounded-xl bg-white text-[#050505] text-xs font-semibold flex items-center justify-center gap-2 shrink-0 transition-transform group-hover:-translate-y-0.5"
                    >
                      {t('musicscale.center.resources.view_in_ms', 'Ver no MusicScale')}
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-14">
      {renderTabs()}
      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'getting-started' && renderGettingStarted()}
      {activeSection === 'resources' && renderResources()}
    </div>
  );
}
