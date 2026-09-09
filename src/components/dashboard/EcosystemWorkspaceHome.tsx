import React from 'react';
import { useTranslation } from 'react-i18next';
import { MusicScaleGuideCenter } from './MusicScaleGuideCenter.js';
import { EcosystemCommitments } from './EcosystemCommitments.js';
import { EcosystemApp } from '../../lib/apps.js';
import type { HubAppExperience } from '../../lib/hubAppExperience.js';
import { applyActionPreferences, deriveReadOnlyHubActions, type ActionPreference, type ActionPreferenceMode, type ReadOnlyHubAction } from '../../lib/actionCenter.js';
import { deriveReadOnlyHubCommitments, type ReadOnlyHubCommitment } from '../../lib/commitmentCenter.js';
import { EcosystemAppIcon } from '../apps/EcosystemAppIcon.js';
import { 
  Music, Check, Users, ShieldCheck, User, Settings, ArrowRight, Play, ExternalLink, Mail, Clock, LayoutGrid, Info,
  AlertCircle, CircleHelp, CreditCard, Rocket, BookOpen, UserPlus, ChevronRight, EyeOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupportHub } from '../support/SupportHubContext.js';

interface EcosystemWorkspaceHomeProps {
  selectedWorkspace: string;
  installedApps: EcosystemApp[];
  appExperiences: HubAppExperience[];
  organization: any;
  subscription: any;
  members: any[];
  pendingInvites: any[];
  currentUserPerms: Record<string, boolean>;
  isGlobalAdmin: boolean;
  musicScaleAccess: {
    accessible: boolean;
    catalogState:
      | 'available'
      | 'trialing'
      | 'active'
      | 'cancel_scheduled'
      | 'payment_issue'
      | 'administrative'
      | 'unavailable'
      | 'loading'
      | 'error';
  } | null;
  musicScaleApp?: EcosystemApp;
  musicScaleSummary: {
    songsCount: number;
    songsWithContentCount: number;
    configuredMembersCount: number;
    scalesCount: number;
    bandScalesCount: number;
    nextScale: null | {
      id: string;
      date: string;
      time?: string | null;
      status?: string | null;
      songCount: number;
      assignmentCount: number;
      bandScaleId?: string | null;
      responseSummaryAvailable: boolean;
      responseCounts: {
        pending: number;
        accepted: number;
        maybe: number;
        declined: number;
      };
    };
    nextPersonalScale: null | {
      id: string;
      date: string;
      time?: string | null;
      startsAtMs: number;
      songCount: number;
      functionNames: string[];
      publishRevision: number;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
    };
    updatedAtMs: number;
  };
  occupiedSlots: number;
  maxUsersLimit: number;
  onSelectWorkspace: (workspaceId: string) => void;
  onLaunchApp: (app: EcosystemApp, destinationPath?: string) => void;
  onOpenInviteModal: () => void;
  onNavigateToOrganizationMembers: () => void;
  onNavigateToBilling: () => void;
  onNavigateToOrganizationSettings: () => void;
  activeSection: 'overview' | 'resources' | 'getting-started';
  onSelectMusicScaleSection: (section: 'overview' | 'resources' | 'getting-started') => void;
  onRetryMusicScaleAccess: () => void;
  actionPreferences: ActionPreference[];
  actionPreferenceBusyKey?: string | null;
  onSetActionPreference: (
    action: ReadOnlyHubAction,
    mode: ActionPreferenceMode
  ) => void | Promise<void>;
  recentActivity: Array<{
    id: string;
    label: string;
    timestampMs: number | null;
    actorName: string | null;
  }>;
}

export function EcosystemWorkspaceHome({
  selectedWorkspace,
  installedApps,
  appExperiences,
  organization,
  subscription,
  members,
  pendingInvites,
  currentUserPerms,
  isGlobalAdmin,
  musicScaleAccess,
  musicScaleApp,
  musicScaleSummary,
  occupiedSlots,
  maxUsersLimit,
  onSelectWorkspace,
  onLaunchApp,
  onOpenInviteModal,
  onNavigateToOrganizationMembers,
  onNavigateToBilling,
  onNavigateToOrganizationSettings,
  activeSection,
  onSelectMusicScaleSection,
  onRetryMusicScaleAccess,
  actionPreferences,
  actionPreferenceBusyKey,
  onSetActionPreference,
  recentActivity
}: EcosystemWorkspaceHomeProps) {
  const { t } = useTranslation(['dashboard']);
  const { openHub } = useSupportHub();

  // Selector UI
  const renderWorkspaceSelector = () => {
    if (selectedWorkspace === 'home' && installedApps.length <= 1) return null;

    return (
      <div className="mb-6 md:mb-8 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto no-scrollbar">
        <p className="hidden sm:block text-[10px] font-bold text-[#A0A7B5] uppercase tracking-[0.18em] mb-3">
          {t('workspace.spaces_title', 'Acesso rápido')}
        </p>
        <div className="flex items-center gap-2 min-w-max" role="tablist" aria-label={t('workspace.spaces_title', 'Acesso rápido')}>
          <button
            type="button"
            onClick={() => onSelectWorkspace('home')}
            role="tab"
            aria-selected={selectedWorkspace === 'home'}
            className={`min-h-[42px] flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all border ${
              selectedWorkspace === 'home'
                ? 'bg-white/10 border-white/10 text-white'
                : 'bg-transparent border-white/5 text-[#A0A7B5] hover:bg-white/5'
            }`}
          >
            <LayoutGrid className={`w-4 h-4 ${selectedWorkspace === 'home' ? 'text-[#2B85EB]' : ''}`} />
            <span className="text-xs font-semibold">{t('navigation.home', 'Início')}</span>
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
                className={`min-h-[42px] flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-[#2B85EB]/10 border-[#2B85EB]/25 text-white'
                    : 'bg-transparent border-white/5 text-[#A0A7B5] hover:bg-white/5'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#2B85EB] text-white' : 'bg-white/5'}`}>
                  {app.id === 'musicscale' ? (
                    <img src="/LogoIconMusicScale-1.png" alt="" className="w-4 h-4 object-contain" />
                  ) : (
                    <EcosystemAppIcon app={app} iconClassName="w-3.5 h-3.5" assetClassName="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs font-semibold">{app.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHomeWorkspace = () => {
    type MusicScaleDisplayStatus =
      | 'available'
      | 'trialing'
      | 'active'
      | 'cancel_scheduled'
      | 'payment_issue'
      | 'loading'
      | 'error'
      | 'administrative'
      | 'unavailable';

    const musicScaleDisplayStatus: MusicScaleDisplayStatus =
      (musicScaleAccess?.catalogState as MusicScaleDisplayStatus) ?? 'unavailable';
    const musicScaleExperience = appExperiences.find(experience => experience.app.id === 'musicscale');
    const operationalApps = appExperiences.filter(experience => experience.installed);
    const discoveryApps = appExperiences.filter(experience =>
      !experience.installed &&
      (experience.state === 'coming_soon' || experience.state === 'development')
    );
    const canInviteMembers = Boolean(currentUserPerms['organization.members.invite'] || isGlobalAdmin);
    const canManageMembers = Boolean(currentUserPerms['organization.members.manage'] || isGlobalAdmin);
    const canManageBilling = Boolean(currentUserPerms['organization.billing.manage'] || isGlobalAdmin);
    const canManageOrganization = Boolean(currentUserPerms['organization.settings.update'] || isGlobalAdmin);
    const teamStarted = members.length > 1 || pendingInvites.length > 0;
    const appSummaryReady = musicScaleSummary.updatedAtMs > 0;
    const isMusicScaleReady = [
      'active',
      'trialing',
      'cancel_scheduled',
      'administrative'
    ].includes(musicScaleDisplayStatus);

    const appStateLabel = (experience: HubAppExperience) => {
      const labels: Record<string, string> = {
        active: t('workspace.app_state.active', 'Ativo'),
        trialing: t('workspace.app_state.trialing', 'Em teste'),
        cancel_scheduled: t('workspace.app_state.cancel_scheduled', 'Cancelamento agendado'),
        payment_issue: t('workspace.app_state.payment_issue', 'Pagamento pendente'),
        administrative: t('workspace.app_state.administrative', 'Acesso administrativo'),
        loading: t('workspace.app_state.loading', 'Verificando'),
        error: t('workspace.app_state.error', 'Precisa de atenção'),
        available: t('workspace.app_state.available', 'Disponível'),
        unavailable: t('workspace.app_state.unavailable', 'Indisponível'),
        coming_soon: t('workspace.app_state.coming_soon', 'Em breve'),
        development: t('workspace.app_state.development', 'Em desenvolvimento')
      };
      return labels[experience.state] || t('workspace.app_state.available', 'Disponível');
    };

    const appStateClass = (experience: HubAppExperience) => {
      if (experience.state === 'payment_issue' || experience.state === 'error') {
        return 'bg-red-500/10 text-red-300 border-red-500/20';
      }
      if (experience.state === 'trialing' || experience.state === 'cancel_scheduled') {
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      }
      if (experience.state === 'administrative') {
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      }
      if (experience.installed) {
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      }
      return 'bg-white/5 text-[#A0A7B5] border-white/10';
    };

    const planLabelFor = (experience: HubAppExperience) => {
      if (experience.app.id === 'musicscale' && isGlobalAdmin && experience.installed) {
        return t('workspace.plan_administrative', 'Acesso administrativo · Pro');
      }
      if (!experience.plan) return null;
      return String(experience.plan)
        .replace(/^musicscale[_-]?/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());
    };

    const projectedTodayActions = deriveReadOnlyHubActions({
      organization: {
        isConfigured: Boolean(organization?.name && organization?.slug)
      },
      permissions: {
        canManageOrganization,
        canManageMembers
      },
      pendingInvitesCount: pendingInvites.length,
      musicScale: {
        ready: isMusicScaleReady && appSummaryReady,
        nextScale: musicScaleSummary.nextScale
          ? {
              id: musicScaleSummary.nextScale.id,
              responseSummaryAvailable: musicScaleSummary.nextScale.responseSummaryAvailable,
              pendingResponses: musicScaleSummary.nextScale.responseCounts.pending || 0
            }
          : null,
        nextPersonalScale: musicScaleSummary.nextPersonalScale
          ? {
              id: musicScaleSummary.nextPersonalScale.id,
              startsAtMs: musicScaleSummary.nextPersonalScale.startsAtMs,
              publishRevision: musicScaleSummary.nextPersonalScale.publishRevision,
              responseSummaryAvailable: musicScaleSummary.nextPersonalScale.responseSummaryAvailable,
              pendingResponses: musicScaleSummary.nextPersonalScale.pendingResponses
            }
          : null
      }
    });
    const todayActions = applyActionPreferences(projectedTodayActions, actionPreferences);
    const hasSuppressedTodayActions = projectedTodayActions.length > todayActions.length;

    const commitments = deriveReadOnlyHubCommitments({
      musicScale: {
        ready: isMusicScaleReady && appSummaryReady,
        nextPersonalScale: musicScaleSummary.nextPersonalScale
      }
    });

    const attentionApp = operationalApps.find(experience => experience.needsAttention);

    const nextStep = attentionApp?.state === 'payment_issue'
      ? {
          tone: 'warning',
          appName: attentionApp.app.name,
          title: t('workspace.next_step.app_payment_title', '{{app}} precisa de atenção no pagamento', { app: attentionApp.app.name }),
          description: t('workspace.next_step.app_payment_desc', 'Revise a assinatura para manter o acesso da equipe funcionando normalmente.'),
          action: 'billing' as const,
          label: t('workspace.next_step.payment_action', 'Revisar pagamento')
        }
      : attentionApp?.state === 'error'
        ? {
            tone: 'warning',
            appName: attentionApp.app.name,
            title: t('workspace.next_step.app_error_title', 'Não conseguimos verificar {{app}}', { app: attentionApp.app.name }),
            description: t('workspace.next_step.app_error_desc', 'Abra o aplicativo no Hub para tentar novamente e ver o que precisa de atenção.'),
            action: 'workspace' as const,
            workspaceId: attentionApp.app.id,
            label: t('workspace.next_step.review_app_action', 'Ver aplicativo')
          }
        : !organization?.name || !organization?.slug
          ? {
              tone: 'primary',
              appName: null,
              title: t('workspace.next_step.organization_title', 'Complete os dados da sua organização'),
              description: t('workspace.next_step.organization_desc', 'Nome e página pública ajudam a manter o ecossistema organizado para toda a equipe.'),
              action: 'organization' as const,
              label: t('workspace.next_step.organization_action', 'Conferir organização')
            }
          : !teamStarted && canInviteMembers
            ? {
                tone: 'primary',
                appName: null,
                title: t('workspace.next_step.invite_title', 'Convide sua equipe'),
                description: t('workspace.next_step.invite_global_desc', 'Adicione as pessoas que vão usar os aplicativos com você e defina o acesso de cada uma.'),
                action: 'invite' as const,
                label: t('workspace.next_step.invite_action', 'Convidar equipe')
              }
            : musicScaleDisplayStatus === 'loading'
              ? {
                  tone: 'neutral',
                  appName: 'MusicScale',
                  title: t('workspace.next_step.loading_title', 'Estamos conferindo seu acesso'),
                  description: t('workspace.next_step.loading_desc', 'Isso acontece automaticamente. Você pode continuar assim que a verificação terminar.'),
                  action: 'none' as const,
                  label: ''
                }
              : musicScaleDisplayStatus === 'available'
                ? {
                    tone: 'primary',
                    appName: 'MusicScale',
                    title: t('workspace.next_step.choose_plan_title', 'Escolha o plano que combina com sua equipe'),
                    description: t('workspace.next_step.choose_plan_desc', 'Depois disso, o MusicScale fica disponível para você começar a organizar o ministério.'),
                    action: 'billing' as const,
                    label: t('workspace.next_step.choose_plan_action', 'Ver planos')
                  }
                : isMusicScaleReady && appSummaryReady && musicScaleSummary.songsCount === 0
                  ? {
                      tone: 'primary',
                      appName: 'MusicScale',
                      title: t('workspace.next_step.songs_title', 'Adicione as primeiras músicas'),
                      description: t('workspace.next_step.songs_desc', 'Comece seu repertório para depois montar as escalas dos cultos.'),
                      action: 'app' as const,
                      workspaceId: 'musicscale',
                      path: '/songs',
                      label: t('workspace.next_step.songs_action', 'Adicionar músicas')
                    }
                  : isMusicScaleReady && appSummaryReady && musicScaleSummary.songsWithContentCount === 0
                    ? {
                        tone: 'primary',
                        appName: 'MusicScale',
                        title: t('workspace.next_step.content_title', 'Complete o conteúdo das músicas'),
                        description: t('workspace.next_step.content_desc', 'Confira letras e cifras das primeiras músicas antes de preparar a equipe.'),
                        action: 'app' as const,
                        workspaceId: 'musicscale',
                        path: '/songs',
                        label: t('workspace.next_step.content_action', 'Revisar músicas')
                      }
                    : isMusicScaleReady && appSummaryReady && musicScaleSummary.configuredMembersCount === 0
                      ? {
                          tone: 'primary',
                          appName: 'MusicScale',
                          title: t('workspace.next_step.members_title', 'Configure quem faz o quê na equipe'),
                          description: t('workspace.next_step.members_desc', 'Defina músicos, vocais e funções ministeriais no MusicScale.'),
                          action: 'app' as const,
                          workspaceId: 'musicscale',
                          path: '/users',
                          label: t('workspace.next_step.members_action', 'Configurar equipe')
                        }
                      : isMusicScaleReady && appSummaryReady && musicScaleSummary.bandScalesCount === 0
                        ? {
                            tone: 'primary',
                            appName: 'MusicScale',
                            title: t('workspace.next_step.band_scale_title', 'Monte sua primeira equipe para um culto'),
                            description: t('workspace.next_step.band_scale_desc', 'Crie a primeira escala da banda com músicos, vocais e funções.'),
                            action: 'app' as const,
                            workspaceId: 'musicscale',
                            path: '/band-scales',
                            label: t('workspace.next_step.band_scale_action', 'Criar escala da banda')
                          }
                        : isMusicScaleReady && appSummaryReady && musicScaleSummary.scalesCount === 0
                          ? {
                              tone: 'primary',
                              appName: 'MusicScale',
                              title: t('workspace.next_step.music_scale_title', 'Monte sua primeira escala de músicas'),
                              description: t('workspace.next_step.music_scale_desc', 'Escolha as músicas do culto e conecte a equipe que participará.'),
                              action: 'app' as const,
                              workspaceId: 'musicscale',
                              path: '/scales',
                              label: t('workspace.next_step.music_scale_action', 'Criar escala de músicas')
                            }
                          : isMusicScaleReady && appSummaryReady && musicScaleSummary.nextScale?.responseSummaryAvailable === true && (musicScaleSummary.nextScale?.responseCounts.pending || 0) > 0
                            ? {
                                tone: 'warning',
                                appName: 'MusicScale',
                                title: t('workspace.next_step.responses_title', 'Há confirmações aguardando resposta'),
                                description: t('workspace.next_step.responses_desc', '{{count}} participação(ões) da próxima escala ainda não foram confirmadas.', { count: musicScaleSummary.nextScale?.responseCounts.pending || 0 }),
                                action: 'app' as const,
                                workspaceId: 'musicscale',
                                path: musicScaleSummary.nextScale ? `/scales/${musicScaleSummary.nextScale.id}` : '/scales',
                                label: t('workspace.next_step.responses_action', 'Ver próxima escala')
                              }
                            : operationalApps.length > 0
                              ? {
                                  tone: 'success',
                                  appName: null,
                                  title: t('workspace.next_step.all_good_title', 'Sua operação está em dia'),
                                  description: t('workspace.next_step.all_good_desc', 'Os aplicativos ativos e os acessos principais estão funcionando. Continue pelo aplicativo que precisa usar agora.'),
                                  action: 'none' as const,
                                  label: ''
                                }
                              : {
                                  tone: 'neutral',
                                  appName: null,
                                  title: t('workspace.next_step.no_apps_title', 'Escolha o primeiro aplicativo'),
                                  description: t('workspace.next_step.no_apps_desc', 'Quando um produto for ativado para sua organização, ele aparecerá aqui com o passo a passo completo.'),
                                  action: 'billing' as const,
                                  label: t('workspace.next_step.view_products_action', 'Ver produtos')
                                };

    const isNextStepRepresentedInToday =
      (nextStep.action === 'organization' &&
        todayActions.some(action => action.signalType === 'organization_incomplete')) ||
      (nextStep.action === 'app' &&
        'path' in nextStep &&
        typeof nextStep.path === 'string' &&
        nextStep.path.startsWith('/scales/') &&
        todayActions.some(action => action.signalType === 'musicscale_pending_responses'));

    const handleTodayAction = (action: ReadOnlyHubAction) => {
      const destination = action.destination;

      if (destination.kind === 'hub') {
        if (destination.section === 'organization') onNavigateToOrganizationSettings();
        if (destination.section === 'members') onNavigateToOrganizationMembers();
        if (destination.section === 'billing') onNavigateToBilling();
        return;
      }

      const experience = appExperiences.find(item => item.app.id === destination.appId);
      if (experience?.app && experience.canOpen) {
        onLaunchApp(experience.app, destination.path);
        return;
      }

      if (destination.appId === 'musicscale') {
        onSelectWorkspace('musicscale');
      }
    };

    const handleCommitmentOpen = (commitment: ReadOnlyHubCommitment) => {
      const experience = appExperiences.find(
        item => item.app.id === commitment.destination.appId
      );

      if (experience?.app && experience.canOpen) {
        onLaunchApp(
          experience.app,
          commitment.destination.path
        );
        return;
      }

      if (commitment.destination.appId === 'musicscale') {
        onSelectWorkspace('musicscale');
      }
    };

    const handleNextStep = () => {
      if (nextStep.action === 'billing') onNavigateToBilling();
      if (nextStep.action === 'invite') onOpenInviteModal();
      if (nextStep.action === 'organization') onNavigateToOrganizationSettings();
      if (nextStep.action === 'workspace' && 'workspaceId' in nextStep) onSelectWorkspace(nextStep.workspaceId);
      if (nextStep.action === 'app' && 'workspaceId' in nextStep) {
        const experience = appExperiences.find(item => item.app.id === nextStep.workspaceId);
        if (experience?.app) onLaunchApp(experience.app, 'path' in nextStep ? nextStep.path : undefined);
      }
    };

    return (
      <div className="mb-8 animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-8 md:space-y-10">
        <section aria-labelledby="hub-home-title" className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#07090D] p-5 shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:p-7 md:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-[-10%] top-[-45%] h-96 w-96 rounded-full bg-[#2B85EB]/16 blur-[110px]" />
            <div className="absolute bottom-[-45%] left-[10%] h-72 w-72 rounded-full bg-[#6E56CF]/10 blur-[100px]" />
            <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '42px 42px' }} />
          </div>

          <div className="relative grid gap-7 xl:grid-cols-[1fr_auto] xl:items-end">
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2B85EB]/20 bg-[#2B85EB]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#86BEFF]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#73B4FF]" />
                  {t('workspace.home_eyebrow', 'Central da organização')}
                </span>
                {isGlobalAdmin && (
                  <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.055] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
                    CEO
                  </span>
                )}
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.17em] text-[#626E7E]">
                {organization?.name || t('workspace.intro', 'Tudo da sua organização em um só lugar')}
              </p>
              <h2 id="hub-home-title" className="mt-3 max-w-4xl text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-4xl md:text-5xl">
                {t('workspace.intro', 'Tudo da sua organização em um só lugar')}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#909BAA] md:text-base">
                {t('workspace.sub_intro', 'Veja o que está funcionando, o que precisa de atenção e qual é o próximo passo.')}
              </p>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 xl:w-[390px]">
              <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{operationalApps.length}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#748091]">{t('workspace.summary.active_apps', 'Apps ativos')}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{members.length}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#748091]">{t('workspace.summary.people', 'Pessoas')}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{pendingInvites.length}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#748091]">{t('workspace.summary.invites', 'Convites')}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-7 grid gap-2 border-t border-white/[0.06] pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => onSelectWorkspace('musicscale')}
              className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.055] px-4 text-left transition hover:border-[#2B85EB]/30 hover:bg-[#2B85EB]/[0.08]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2B85EB]/15 bg-black/20">
                <img src="/LogoIconMusicScale-1.png" alt="" className="h-6 w-6 object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">MusicScale</p>
                <p className="mt-1 truncate text-[10px] text-[#7D8999]">{t('workspace.apps_hint', 'Entre para ver dados, acessos e configurações de cada produto.')}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenInviteModal}
              disabled={!canInviteMembers}
              className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <UserPlus className="h-4 w-4 text-[#9CC8FF]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{t('workspace.next_step.invite_action', 'Convidar equipe')}</p>
                <p className="mt-1 truncate text-[10px] text-[#7D8999]">{t('workspace.summary.people', 'Pessoas')}: {members.length}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onNavigateToOrganizationSettings}
              disabled={!canManageOrganization}
              className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <Settings className="h-4 w-4 text-[#9CC8FF]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{t('workspace.next_step.organization_action', 'Conferir organização')}</p>
                <p className="mt-1 truncate text-[10px] text-[#7D8999]">{organization?.name || 'MillionsNest'}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onNavigateToBilling}
              disabled={!canManageBilling}
              className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <CreditCard className="h-4 w-4 text-[#9CC8FF]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{t('workspace.next_step.payment_action', 'Revisar pagamento')}</p>
                <p className="mt-1 truncate text-[10px] text-[#7D8999]">{t('workspace.plan_label', 'Plano atual:')}</p>
              </div>
            </button>
          </div>
        </section>

        <section
          aria-labelledby="hub-today-title"
          className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-[#080A0F] p-5 shadow-[0_26px_80px_rgba(0,0,0,.24)] sm:p-6 md:p-7"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#2B85EB]/10 blur-[90px]" />
            <div className="absolute bottom-[-55%] left-[8%] h-56 w-56 rounded-full bg-emerald-400/[0.05] blur-[90px]" />
          </div>

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#73B4FF] shadow-[0_0_18px_rgba(115,180,255,.55)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86BEFF]">
                  {t('workspace.actions.eyebrow')}
                </p>
              </div>
              <h3 id="hub-today-title" className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-3xl">
                {todayActions.length > 0
                  ? t('workspace.actions.title')
                  : hasSuppressedTodayActions
                    ? t('workspace.actions.title_paused')
                    : t('workspace.actions.title_clear')}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8E99A8]">
                {todayActions.length > 0
                  ? t('workspace.actions.subtitle')
                  : hasSuppressedTodayActions
                    ? t('workspace.actions.paused_description')
                    : t('workspace.actions.clear_description')}
              </p>
            </div>

            {todayActions.length > 0 && (
              <div className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-xs font-semibold text-white/80">
                {t('workspace.actions.count', { count: todayActions.length })}
              </div>
            )}
          </div>

          {todayActions.length > 0 ? (
            <div className="relative mt-6 space-y-2.5">
              {todayActions.map((action, index) => {
                const isMusicScaleAction = action.sourceApp === 'musicscale';
                const highPriority = action.priority === 'high' || action.priority === 'urgent';

                return (
                  <article
                    key={action.id}
                    className="group grid gap-4 rounded-2xl border border-white/[0.065] bg-white/[0.022] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.035] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                      isMusicScaleAction
                        ? 'border-[#2B85EB]/20 bg-[#2B85EB]/10'
                        : highPriority
                          ? 'border-amber-400/15 bg-amber-400/[0.07]'
                          : 'border-white/[0.08] bg-white/[0.035]'
                    }`}>
                      {isMusicScaleAction ? (
                        <img src="/LogoIconMusicScale-1.png" alt="" className="h-6 w-6 object-contain" />
                      ) : action.signalType === 'pending_invites' ? (
                        <UserPlus className="h-4 w-4 text-[#9CC8FF]" />
                      ) : (
                        <AlertCircle className={`h-4 w-4 ${highPriority ? 'text-amber-300' : 'text-[#9CC8FF]'}`} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#687486]">
                          {isMusicScaleAction ? 'MusicScale' : t('workspace.actions.source_hub')}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                          highPriority
                            ? 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300'
                            : 'border-white/[0.07] bg-white/[0.025] text-[#8793A3]'
                        }`}>
                          {highPriority
                            ? t('workspace.actions.priority_high')
                            : t('workspace.actions.priority_normal')}
                        </span>
                        <span className="text-[9px] font-medium text-[#4F5968]">#{index + 1}</span>
                      </div>
                      <h4 className="text-[15px] font-semibold leading-snug text-white sm:text-base">
                        {t(action.titleKey, action.translationParams ?? {})}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-[#8A95A4] sm:text-[13px]">
                        {t(action.descriptionKey, action.translationParams ?? {})}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleTodayAction(action)}
                        className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-white px-4 py-2.5 text-xs font-semibold text-[#07090D] transition-all hover:bg-[#F2F5F8] active:scale-[0.985] sm:min-w-[108px]"
                      >
                        <span className="inline-flex items-center justify-center gap-1.5">
                          {t('workspace.actions.open_action')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={actionPreferenceBusyKey === action.dedupeKey}
                          onClick={() => onSetActionPreference(action, 'snoozed')}
                          className="min-h-[36px] rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[10px] font-semibold text-[#A8B2C0] transition hover:bg-white/[0.055] hover:text-white disabled:cursor-wait disabled:opacity-40"
                        >
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {t('workspace.actions.snooze_action')}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={actionPreferenceBusyKey === action.dedupeKey}
                          onClick={() => onSetActionPreference(action, 'dismissed')}
                          className="min-h-[36px] rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[10px] font-semibold text-[#A8B2C0] transition hover:bg-white/[0.055] hover:text-white disabled:cursor-wait disabled:opacity-40"
                        >
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <EyeOff className="h-3 w-3" />
                            {t('workspace.actions.dismiss_action')}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="relative mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.045] p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/15 bg-emerald-400/[0.08]">
                <Check className="h-4 w-4 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {hasSuppressedTodayActions
                    ? t('workspace.actions.paused_status')
                    : t('workspace.actions.clear_status')}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#83908F]">
                  {hasSuppressedTodayActions
                    ? t('workspace.actions.paused_hint')
                    : t('workspace.actions.clear_hint')}
                </p>
              </div>
            </div>
          )}

          {todayActions.length > 0 && (
            <p className="relative mt-4 text-[10px] leading-relaxed text-[#5E6978]">
              {t('workspace.actions.personal_preference_note')}
            </p>
          )}
        </section>

        {commitments.length > 0 && (
          <EcosystemCommitments
            commitments={commitments}
            onOpen={handleCommitmentOpen}
          />
        )}

        {!isNextStepRepresentedInToday && (
        <section
          aria-label={t('workspace.next_step.eyebrow', 'Próximo passo')}
          className={`relative overflow-hidden rounded-[1.75rem] border p-5 sm:p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 ${
            nextStep.tone === 'warning'
              ? 'bg-amber-500/[0.08] border-amber-500/20'
              : nextStep.tone === 'success'
                ? 'bg-emerald-500/[0.06] border-emerald-500/15'
                : nextStep.tone === 'primary'
                  ? 'bg-[#2B85EB]/[0.08] border-[#2B85EB]/20'
                  : 'bg-white/[0.025] border-white/10'
          }`}
        >
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_85%_0%,rgba(43,133,235,.10),transparent_36%)]" />
          <div className="relative min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0A7B5]">
                {t('workspace.next_step.eyebrow', 'Próximo passo')}
              </p>
              {nextStep.appName && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70">
                  {nextStep.appName}
                </span>
              )}
            </div>
            <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-white">{nextStep.title}</h3>
            <p className="text-sm text-[#A0A7B5] leading-relaxed max-w-2xl mt-2">{nextStep.description}</p>
          </div>
          {nextStep.action !== 'none' && (
            <button
              type="button"
              onClick={handleNextStep}
              className="relative shrink-0 min-h-[46px] w-full md:w-auto px-5 py-3 rounded-xl bg-white text-[#050505] hover:bg-[#F5F7FA] text-sm font-semibold transition-all active:scale-[0.98]"
            >
              {nextStep.label}
            </button>
          )}
        </section>
        )}

        <section id="apps-overview" aria-labelledby="active-apps-title">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0A7B5]">{t('workspace.apps_kicker', 'Ecossistema')}</p>
              <h3 id="active-apps-title" className="text-xl md:text-2xl font-semibold tracking-tight text-white mt-1">
                {t('workspace.apps_title', 'Seus aplicativos')}
              </h3>
            </div>
            <p className="text-xs text-[#A0A7B5]">{t('workspace.apps_hint', 'Entre para ver dados, acessos e configurações de cada produto.')}</p>
          </div>

          {operationalApps.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {operationalApps.map(experience => {
                const app = experience.app;
                const planLabel = planLabelFor(experience);
                const isMusicScale = app.id === 'musicscale';
                const genericSummary = organization?.apps?.[app.id]?.hubSummary;
                const genericMetrics = Array.isArray(genericSummary?.metrics)
                  ? genericSummary.metrics
                      .filter((metric: any) => metric && typeof metric.label === 'string' && ['string', 'number'].includes(typeof metric.value))
                      .slice(0, 3)
                  : [];

                return (
                  <article
                    key={app.id}
                    className="mn-surface-strong mn-interactive relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6"
                  >
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_90%_0%,rgba(43,133,235,.08),transparent_38%)]" />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            {app.id === 'musicscale' ? (
                              <img src="/LogoIconMusicScale-1.png" alt="" className="w-7 h-7 object-contain" />
                            ) : (
                              <EcosystemAppIcon app={app} iconClassName="w-5 h-5" assetClassName="w-9 h-9" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-lg font-semibold text-white truncate">{app.name}</h4>
                            <p className="text-xs text-[#A0A7B5] mt-0.5 truncate">{app.shortDescription || app.description}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${appStateClass(experience)}`}>
                          {appStateLabel(experience)}
                        </span>
                      </div>

                      {planLabel && (
                        <div className="mt-4 flex items-center gap-2 text-xs">
                          <span className="text-[#A0A7B5]">{t('workspace.plan_label', 'Plano atual:')}</span>
                          <span className="font-semibold text-white">{planLabel}</span>
                        </div>
                      )}

                      {isMusicScale && appSummaryReady ? (
                        <div className="grid grid-cols-3 gap-2 mt-5">
                          <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                            <p className="text-lg font-semibold text-white">{musicScaleSummary.songsCount}</p>
                            <p className="text-[10px] text-[#A0A7B5] mt-1">{t('musicscale.summary.repertoire', 'músicas')}</p>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                            <p className="text-lg font-semibold text-white">{musicScaleSummary.configuredMembersCount}</p>
                            <p className="text-[10px] text-[#A0A7B5] mt-1">{t('musicscale.summary.configured_members', 'integrantes')}</p>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                            <p className="text-lg font-semibold text-white">{musicScaleSummary.scalesCount}</p>
                            <p className="text-[10px] text-[#A0A7B5] mt-1">{t('musicscale.summary.music_scales', 'escalas')}</p>
                          </div>
                        </div>
                      ) : genericMetrics.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 mt-5">
                          {genericMetrics.map((metric: any, index: number) => (
                            <div key={index} className="rounded-xl border border-white/5 bg-white/[0.025] p-3 min-w-0">
                              <p className="text-lg font-semibold text-white truncate">{String(metric.value)}</p>
                              <p className="text-[10px] text-[#A0A7B5] mt-1 line-clamp-2">{metric.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                          <p className="text-xs font-semibold text-white">{t('workspace.app_connected_title', 'Conectado ao MillionsNest')}</p>
                          <p className="text-[11px] text-[#A0A7B5] mt-1 leading-relaxed">
                            {t('workspace.app_connected_desc', 'A organização, os acessos e a assinatura são administrados por aqui.')}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
                        <button
                          type="button"
                          onClick={() => onSelectWorkspace(app.id)}
                          className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition-colors"
                        >
                          {t('workspace.manage_app', 'Ver e gerenciar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (experience.state === 'payment_issue') {
                              onNavigateToBilling();
                            } else if (experience.state === 'error' && app.id === 'musicscale') {
                              onRetryMusicScaleAccess();
                            } else if (experience.canOpen) {
                              onLaunchApp(app);
                            }
                          }}
                          disabled={!experience.canOpen && experience.state !== 'payment_issue' && experience.state !== 'error'}
                          className="min-h-[44px] rounded-xl bg-white text-[#050505] disabled:bg-white/5 disabled:text-[#A0A7B5] disabled:cursor-not-allowed text-sm font-semibold transition-colors"
                        >
                          {experience.state === 'payment_issue'
                            ? t('workspace.resolve_payment', 'Regularizar pagamento')
                            : experience.state === 'error'
                              ? t('workspace.retry', 'Tentar novamente')
                              : t('workspace.open_app', 'Abrir {{appName}}', { appName: app.name })}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] p-7 text-center">
              <LayoutGrid className="w-8 h-8 text-white/20 mx-auto" />
              <h4 className="text-base font-semibold text-white mt-3">{t('workspace.no_active_apps_title', 'Nenhum aplicativo ativo ainda')}</h4>
              <p className="text-sm text-[#A0A7B5] mt-1">{t('workspace.no_apps_found', 'Os aplicativos liberados para sua organização aparecerão aqui.')}</p>
            </div>
          )}

          {discoveryApps.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A7B5] mr-1">{t('workspace.coming_next', 'Em breve no ecossistema')}</span>
              {discoveryApps.slice(0, 4).map(experience => (
                <span key={experience.app.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/70">
                  <EcosystemAppIcon app={experience.app} iconClassName="w-3.5 h-3.5" assetClassName="w-4 h-4" />
                  {experience.app.name}
                </span>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="management-title">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0A7B5]">{t('workspace.management_kicker', 'Administração')}</p>
            <h3 id="management-title" className="text-xl md:text-2xl font-semibold tracking-tight text-white mt-1">
              {t('workspace.management_title', 'Central de gestão')}
            </h3>
            <p className="text-xs text-[#A0A7B5] mt-1">{t('workspace.management_desc', 'As tarefas administrativas ficam no MillionsNest, independentemente do aplicativo que sua equipe usa.')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={onNavigateToOrganizationSettings}
              className="min-h-[118px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] flex items-center justify-center"><Settings className="w-4.5 h-4.5" /></div>
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.organization', 'Dados da organização')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{organization?.name || t('workspace.organization_unnamed', 'Sua organização')}</p>
            </button>

            <button
              type="button"
              onClick={onNavigateToOrganizationMembers}
              className="min-h-[118px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center"><Users className="w-4.5 h-4.5" /></div>
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.people', 'Pessoas e acessos')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.management.people_count', '{{count}} pessoa(s) na organização', { count: members.length })}</p>
            </button>

            <button
              type="button"
              onClick={onOpenInviteModal}
              disabled={!canInviteMembers}
              className="min-h-[118px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] disabled:opacity-45 disabled:cursor-not-allowed p-4 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center"><UserPlus className="w-4.5 h-4.5" /></div>
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.invites', 'Convites')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{pendingInvites.length > 0 ? t('workspace.management.pending_invites', '{{count}} pendente(s)', { count: pendingInvites.length }) : t('workspace.management.no_pending_invites', 'Nenhum convite pendente')}</p>
            </button>

            <button
              type="button"
              onClick={onNavigateToBilling}
              disabled={!canManageBilling}
              className="min-h-[118px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] disabled:opacity-45 disabled:cursor-not-allowed p-4 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center"><CreditCard className="w-4.5 h-4.5" /></div>
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.billing', 'Planos e assinatura')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.management.billing_desc', 'Veja o plano de cada aplicativo e os pagamentos.')}</p>
            </button>
          </div>

          {(!canManageOrganization || !canManageMembers) && (
            <p className="text-[11px] text-[#A0A7B5] mt-3">
              {t('workspace.management.permission_note', 'Algumas ações dependem do seu nível de acesso na organização.')}
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_.8fr] gap-4">
          <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0A7B5]">{t('workspace.activity_kicker', 'Organização')}</p>
                <h3 className="text-lg font-semibold text-white mt-1">{t('workspace.activity_title', 'Atividade recente')}</h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToOrganizationSettings}
                className="text-xs font-semibold text-[#2B85EB] hover:text-[#6EAFFF]"
              >
                {t('workspace.activity_view_all', 'Ver gestão')}
              </button>
            </div>

            {recentActivity.length > 0 ? (
              <div className="divide-y divide-white/5">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-[#2B85EB] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{activity.label}</p>
                      <p className="text-[11px] text-[#A0A7B5] mt-1">
                        {activity.timestampMs ? new Date(activity.timestampMs).toLocaleString() : t('workspace.activity_now', 'Agora')}
                        {activity.actorName ? ` · ${activity.actorName}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-emerald-300"><Check className="w-4 h-4" /><span className="text-sm font-semibold">{t('workspace.activity_empty_title', 'Tudo tranquilo por aqui')}</span></div>
                <p className="text-xs text-[#A0A7B5] mt-1">{t('workspace.activity_empty_desc', 'As mudanças importantes aparecerão aqui.')}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openHub}
            className="mn-surface mn-interactive rounded-[1.75rem] p-5 sm:p-6 text-left group min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] flex items-center justify-center"><CircleHelp className="w-5 h-5" /></div>
            <h3 className="text-lg font-semibold text-white mt-5">{t('support.hub.central_action.title', 'Central de Ajuda & Suporte')}</h3>
            <p className="text-xs text-[#A0A7B5] mt-2 leading-relaxed">{t('support.hub.central_action.description', 'Envie uma solicitação, fale pelo WhatsApp ou consulte guias rápidos do ecossistema.')}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#2B85EB] group-hover:gap-3 transition-all">
              {t('workspace.support_open', 'Abrir suporte')} <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </section>
      </div>
    );
  };

    const renderMusicScaleWorkspace = () => {
    const isLoading = musicScaleAccess?.catalogState === "loading";
    
    if (isLoading) {
      return (
        <div className="w-full h-64 border border-white/5 bg-white/5 rounded-3xl p-6 md:p-10 flex flex-col items-center justify-center gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-32 h-4 rounded bg-white/10" />
          <div className="w-48 h-3 rounded bg-white/5" />
        </div>
      );
    }

    const isError = musicScaleAccess?.catalogState === "error";
    const hasPaymentIssue = musicScaleAccess?.catalogState === "payment_issue";
    
        
    type MusicScaleDisplayStatus =
      | 'available'
      | 'trialing'
      | 'active'
      | 'cancel_scheduled'
      | 'payment_issue'
      | 'loading'
      | 'error'
      | 'administrative'
      | 'unavailable';

    const musicScaleDisplayStatus: MusicScaleDisplayStatus =
      (musicScaleAccess?.catalogState as MusicScaleDisplayStatus) ?? 'unavailable';

    const orgActive = !!organization;
        const isReadyToOpen = [
      'active',
      'trialing',
      'cancel_scheduled',
      'administrative'
    ].includes(musicScaleDisplayStatus);
    const isPrimaryActionDisabled = [
      'loading',
      'unavailable'
    ].includes(musicScaleDisplayStatus);
    const msActive = musicScaleAccess?.accessible === true || musicScaleAccess?.catalogState === 'trialing';
    const teamStarted = members.length > 1 || pendingInvites.length > 0;

    const heroContent = (
        <div className="mn-surface-strong relative overflow-hidden rounded-3xl p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2B85EB]/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex-1 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <img src="/LogoIconMusicScale-1.png" alt="MusicScale" className="w-8 h-8" />
              <h2 className="text-xl font-bold text-white tracking-tight">MusicScale</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ 
                musicScaleDisplayStatus === 'available' || musicScaleDisplayStatus === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                musicScaleDisplayStatus === 'trialing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                musicScaleDisplayStatus === 'payment_issue' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                musicScaleDisplayStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                musicScaleDisplayStatus === 'cancel_scheduled' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                musicScaleDisplayStatus === 'administrative' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                'bg-white/10 text-[#A0A7B5]'
              }`}> 
                {t(`musicscale.status.${musicScaleDisplayStatus}`, t('musicscale.status.unavailable'))}
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
              <button
                type="button"
                id="btn-sidebar-open-musicscale"
                onClick={() => {
                  if (musicScaleDisplayStatus === 'error') {
                    onRetryMusicScaleAccess();
                  } else if (
                    musicScaleDisplayStatus === 'payment_issue' ||
                    musicScaleDisplayStatus === 'available'
                  ) {
                    onNavigateToBilling();
                  } else if (isReadyToOpen && musicScaleApp) {
                    onLaunchApp(musicScaleApp);
                  }
                }}
                disabled={isPrimaryActionDisabled}
                className={`px-6 py-3 font-semibold rounded-xl transition-all min-h-[44px] flex items-center justify-center gap-2 ${
                  (musicScaleDisplayStatus === 'payment_issue' || musicScaleDisplayStatus === 'error') ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' :
                  (musicScaleDisplayStatus === 'loading' || musicScaleDisplayStatus === 'unavailable') ? 'bg-white/5 text-[#A0A7B5] cursor-not-allowed' :
                  'bg-[#2B85EB] hover:bg-[#3B95FB] text-white shadow-lg shadow-[#2B85EB]/20'
                }`}
              >
                {musicScaleDisplayStatus === 'loading' ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : musicScaleDisplayStatus === 'error' ? (
                  'Tentar novamente'
                ) : musicScaleDisplayStatus === 'payment_issue' ? (
                  t('workspace.resolve_payment', 'Regularizar pagamento')
                ) : musicScaleDisplayStatus === 'available' ? (
                  t('workspace.view_plans', 'Ver planos')
                ) : (
                  t('workspace.open_app', 'Abrir MusicScale', { appName: 'MusicScale' })
                )}
              </button>
              <button type="button" onClick={() => onSelectMusicScaleSection('getting-started')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">{t('workspace.getting_started', 'Primeiros passos')}</button>
              <button type="button" onClick={() => onSelectMusicScaleSection('resources')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">{t('workspace.know_resources', 'Conhecer recursos')}</button>
            </div>
          </div>
        </div>
    );

    const overviewContent = (
      <div className="space-y-6">
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400 mb-1">
                {t('musicscale.summary.live_label', 'Dados ao vivo')}
              </p>
              <h3 className="text-lg font-bold text-white">
                {t('musicscale.summary.title', 'Como está o MusicScale agora')}
              </h3>
            </div>
            <p className="text-xs text-[#A0A7B5]">
              {musicScaleSummary.updatedAtMs
                ? t('musicscale.summary.synced', 'Atualizado automaticamente')
                : t('musicscale.summary.loading', 'Carregando dados do aplicativo...')}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button type="button" onClick={() => musicScaleApp && onLaunchApp(musicScaleApp, '/songs')} className="text-left rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
              <p className="text-2xl font-bold text-white">{musicScaleSummary.songsCount}</p>
              <p className="text-xs text-[#A0A7B5] mt-1">{t('musicscale.summary.repertoire', 'músicas no repertório')}</p>
            </button>
            <button type="button" onClick={() => musicScaleApp && onLaunchApp(musicScaleApp, '/users')} className="text-left rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
              <p className="text-2xl font-bold text-white">{musicScaleSummary.configuredMembersCount}</p>
              <p className="text-xs text-[#A0A7B5] mt-1">{t('musicscale.summary.configured_members', 'integrantes configurados')}</p>
            </button>
            <button type="button" onClick={() => musicScaleApp && onLaunchApp(musicScaleApp, '/scales')} className="text-left rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
              <p className="text-2xl font-bold text-white">{musicScaleSummary.scalesCount}</p>
              <p className="text-xs text-[#A0A7B5] mt-1">{t('musicscale.summary.music_scales', 'escalas de músicas')}</p>
            </button>
            <button type="button" onClick={() => musicScaleApp && onLaunchApp(musicScaleApp, '/band-scales')} className="text-left rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
              <p className="text-2xl font-bold text-white">{musicScaleSummary.bandScalesCount}</p>
              <p className="text-xs text-[#A0A7B5] mt-1">{t('musicscale.summary.band_scales', 'escalas da banda')}</p>
            </button>
          </div>

          {musicScaleSummary.nextScale ? (
            <button
              type="button"
              onClick={() => musicScaleApp && onLaunchApp(musicScaleApp, `/scales/${musicScaleSummary.nextScale?.id}`)}
              className="mt-4 w-full rounded-xl border border-[#2B85EB]/20 bg-[#2B85EB]/[0.07] p-4 text-left hover:bg-[#2B85EB]/10 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#2B85EB] uppercase tracking-wider">{t('musicscale.summary.next_scale', 'Próxima escala')}</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {new Date(`${musicScaleSummary.nextScale.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })}
                    {musicScaleSummary.nextScale.time ? ` · ${musicScaleSummary.nextScale.time}` : ''}
                  </p>
                  <p className="text-xs text-[#A0A7B5] mt-1">
                    {t('musicscale.summary.next_scale_details', '{{songs}} músicas · {{people}} participações', {
                      songs: musicScaleSummary.nextScale.songCount,
                      people: musicScaleSummary.nextScale.assignmentCount
                    })}
                  </p>
                </div>
                {musicScaleSummary.nextScale.responseSummaryAvailable && (
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/15">
                      {musicScaleSummary.nextScale.responseCounts.accepted} {t('musicscale.summary.accepted', 'confirmadas')}
                    </span>
                    {musicScaleSummary.nextScale.responseCounts.pending > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/15">
                        {musicScaleSummary.nextScale.responseCounts.pending} {t('musicscale.summary.pending', 'aguardando')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ) : musicScaleSummary.updatedAtMs > 0 ? (
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-white">{t('musicscale.summary.no_upcoming', 'Nenhuma próxima escala encontrada')}</p>
              <p className="text-xs text-[#A0A7B5] mt-1">{t('musicscale.summary.no_upcoming_desc', 'Quando uma nova escala for criada, ela aparecerá aqui automaticamente.')}</p>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (Recursos do MusicScale) */}
          <div className="lg:col-span-2 space-y-6">
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
            
            {/* 3. Organização e acesso */}
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">{t('workspace.org_and_access', 'Organização e acesso')}</h3>
              <div className="flex flex-col gap-3">
                {(currentUserPerms['organization.members.invite'] || isGlobalAdmin) && (
                  <button
                    type="button"
                    onClick={onOpenInviteModal}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group min-h-[80px] outline-none focus:ring-2 focus:ring-[#2B85EB]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white mb-0.5">{t('workspace.invite_person', 'Convidar pessoa')}</span>
                        <ChevronRight className="w-4 h-4 text-[#A0A7B5] group-hover:text-white transition-colors group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-xs text-[#A0A7B5] leading-relaxed">{t('workspace.invite_person_desc', 'Adicione alguém com o nível de acesso correto.')}</p>
                    </div>
                  </button>
                )}
                {(currentUserPerms['organization.members.manage'] || isGlobalAdmin) && (
                  <button
                    type="button"
                    onClick={onNavigateToOrganizationMembers}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group min-h-[80px] outline-none focus:ring-2 focus:ring-[#2B85EB]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white mb-0.5">{t('workspace.manage_team', 'Gerenciar equipe')}</span>
                        <ChevronRight className="w-4 h-4 text-[#A0A7B5] group-hover:text-white transition-colors group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-xs text-[#A0A7B5] leading-relaxed">{t('workspace.manage_team_desc', 'Confira integrantes, convites e permissões.')}</p>
                    </div>
                  </button>
                )}
                {(currentUserPerms['organization.billing.manage'] || isGlobalAdmin) && (
                  <button
                    type="button"
                    onClick={onNavigateToBilling}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group min-h-[80px] outline-none focus:ring-2 focus:ring-[#2B85EB]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-[#2B85EB] flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white mb-0.5">{t('workspace.view_subscription', 'Ver assinatura')}</span>
                        <ChevronRight className="w-4 h-4 text-[#A0A7B5] group-hover:text-white transition-colors group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-xs text-[#A0A7B5] leading-relaxed">{t('workspace.view_subscription_desc', 'Consulte plano, acesso e situação da assinatura.')}</p>
                    </div>
                  </button>
                )}
              </div>
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
        onOpenMusicScale={(destinationPath?: string) => {
          if (musicScaleApp) onLaunchApp(musicScaleApp, destinationPath);
        }}
        onNavigateToBilling={onNavigateToBilling}
        heroContent={heroContent}
        overviewContent={overviewContent}
        memberCount={members.length}
        pendingInviteCount={pendingInvites.length}
        musicScaleSummary={musicScaleSummary}
      />
    );
  };
  const renderGenericAppWorkspace = (experience: HubAppExperience) => {
    const app = experience.app;
    const appRecord = organization?.apps?.[app.id] || {};
    const hubSummary = appRecord?.hubSummary || {};
    const metrics = Array.isArray(hubSummary?.metrics)
      ? hubSummary.metrics
          .filter((metric: any) => metric && typeof metric.label === 'string' && ['string', 'number'].includes(typeof metric.value))
          .slice(0, 4)
      : [];
    const planLabel = experience.plan
      ? String(experience.plan).replace(/[_-]/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
      : t('workspace.plan_included', 'Incluído');
    const statusLabel: Record<string, string> = {
      active: t('workspace.app_state.active', 'Ativo'),
      trialing: t('workspace.app_state.trialing', 'Em teste'),
      cancel_scheduled: t('workspace.app_state.cancel_scheduled', 'Cancelamento agendado'),
      payment_issue: t('workspace.app_state.payment_issue', 'Pagamento pendente'),
      administrative: t('workspace.app_state.administrative', 'Acesso administrativo'),
      error: t('workspace.app_state.error', 'Precisa de atenção')
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-6">
        <section className="mn-surface-strong relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7 md:p-8">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_90%_0%,rgba(43,133,235,.10),transparent_40%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <EcosystemAppIcon app={app} iconClassName="w-6 h-6" assetClassName="w-11 h-11" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">{app.name}</h2>
                  <span className={`px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                    experience.needsAttention
                      ? 'bg-red-500/10 text-red-300 border-red-500/20'
                      : experience.state === 'administrative'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  }`}>
                    {statusLabel[experience.state] || t('workspace.app_state.active', 'Ativo')}
                  </span>
                </div>
                <p className="text-sm text-[#A0A7B5] leading-relaxed max-w-2xl mt-2">{app.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
                  <span className="text-[#A0A7B5]">{t('workspace.plan_label', 'Plano atual:')} <strong className="text-white font-semibold">{planLabel}</strong></span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-[#A0A7B5]">{organization?.name}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (experience.state === 'payment_issue') onNavigateToBilling();
                else if (experience.canOpen) onLaunchApp(app);
              }}
              disabled={!experience.canOpen && experience.state !== 'payment_issue'}
              className="min-h-[46px] w-full lg:w-auto px-5 py-3 rounded-xl bg-white text-[#050505] disabled:bg-white/5 disabled:text-[#A0A7B5] disabled:cursor-not-allowed text-sm font-semibold shrink-0"
            >
              {experience.state === 'payment_issue'
                ? t('workspace.resolve_payment', 'Regularizar pagamento')
                : t('workspace.open_app', 'Abrir {{appName}}', { appName: app.name })}
            </button>
          </div>
        </section>

        {hubSummary?.nextAction?.title && (
          <section className="rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/[0.06] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B85EB]">{t('workspace.next_step.eyebrow', 'Próximo passo')}</p>
              <h3 className="text-base font-semibold text-white mt-1">{hubSummary.nextAction.title}</h3>
              {hubSummary.nextAction.description && <p className="text-xs text-[#A0A7B5] mt-1">{hubSummary.nextAction.description}</p>}
            </div>
            {experience.canOpen && (
              <button
                type="button"
                onClick={() => onLaunchApp(app, typeof hubSummary.nextAction.destinationPath === 'string' ? hubSummary.nextAction.destinationPath : undefined)}
                className="min-h-[42px] px-4 rounded-xl bg-white text-[#050505] text-xs font-semibold"
              >
                {hubSummary.nextAction.label || t('workspace.continue_action', 'Continuar')}
              </button>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.length > 0 ? metrics.map((metric: any, index: number) => (
            <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 min-w-0">
              <p className="text-xl font-semibold text-white truncate">{String(metric.value)}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1 line-clamp-2">{metric.label}</p>
            </div>
          )) : (
            <>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <p className="text-xl font-semibold text-white">{members.length}</p>
                <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.summary.people', 'Pessoas')}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <p className="text-xl font-semibold text-white">{pendingInvites.length}</p>
                <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.summary.invites', 'Convites')}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 col-span-2">
                <p className="text-sm font-semibold text-white">{t('workspace.app_connected_title', 'Conectado ao MillionsNest')}</p>
                <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.generic_summary_desc', 'Acessos, organização, plano e equipe estão centralizados aqui.')}</p>
              </div>
            </>
          )}
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0A7B5]">{t('workspace.management_kicker', 'Administração')}</p>
          <h3 className="text-xl font-semibold text-white mt-1 mb-4">{t('workspace.manage_this_app', 'Gerenciar este aplicativo')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button type="button" onClick={onNavigateToOrganizationMembers} className="min-h-[104px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left">
              <Users className="w-5 h-5 text-emerald-300" />
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.people', 'Pessoas e acessos')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.manage_people_app_desc', 'Controle quem usa a organização e o acesso administrativo.')}</p>
            </button>
            <button type="button" onClick={onOpenInviteModal} className="min-h-[104px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left">
              <UserPlus className="w-5 h-5 text-amber-300" />
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.invites', 'Convites')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.manage_invites_app_desc', 'Convide novas pessoas e acompanhe convites pendentes.')}</p>
            </button>
            <button type="button" onClick={onNavigateToOrganizationSettings} className="min-h-[104px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left">
              <Settings className="w-5 h-5 text-[#2B85EB]" />
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.organization', 'Dados da organização')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.manage_org_app_desc', 'Atualize os dados compartilhados por todo o ecossistema.')}</p>
            </button>
            <button type="button" onClick={onNavigateToBilling} className="min-h-[104px] rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] p-4 text-left">
              <CreditCard className="w-5 h-5 text-purple-300" />
              <p className="text-sm font-semibold text-white mt-3">{t('workspace.management.billing', 'Planos e assinatura')}</p>
              <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.manage_billing_app_desc', 'Veja o plano e a situação de cobrança deste produto.')}</p>
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={openHub}
          className="w-full rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] p-4 flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 text-[#2B85EB] flex items-center justify-center shrink-0"><CircleHelp className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{t('support.hub.central_action.title', 'Central de Ajuda & Suporte')}</p>
            <p className="text-[11px] text-[#A0A7B5] mt-1">{t('workspace.app_support_desc', 'Ajuda sobre acesso, configuração e uso deste aplicativo.')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#A0A7B5] shrink-0" />
        </button>
      </div>
    );
  };

  const currentExperience = appExperiences.find(experience => experience.app.id === selectedWorkspace && experience.installed);

  return (
    <div className="w-full">
      {renderWorkspaceSelector()}
      
      {selectedWorkspace === 'home' && renderHomeWorkspace()}
      {selectedWorkspace === 'musicscale' && renderMusicScaleWorkspace()}
      {selectedWorkspace !== 'home' && selectedWorkspace !== 'musicscale' && currentExperience && renderGenericAppWorkspace(currentExperience)}
    </div>
  );
}
