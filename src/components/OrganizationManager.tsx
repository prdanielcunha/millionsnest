import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, LayoutGrid, CreditCard, ShieldCheck, Settings, Check, X, Loader2, Link, Copy, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumEmptyState } from '../packages/ui/empty-state.js';
import { framerTokens } from '../packages/ui/motion.js';
import { normalizeSlug } from '../lib/slug.js';
import { isGlobalPrivilegedUser, canEnterAnyOrganization, resolveEcosystemPrivilegePolicy } from '../lib/permissionService.js';
import {
  getInviteableOrganizationRolesForActor,
  getOrganizationRoleDescription,
  getOrganizationRoleLabel,
  normalizeExistingOrganizationRole
} from '../lib/organizationRoles.js';
import { getMemberRoleUiPolicy } from '../lib/organizationMemberRoleUiPolicy.js';
import {
  ASSIGNABLE_SYSTEM_ROLES,
  canChangeSystemRole,
  getSystemRoleLabel,
  normalizeLegacySystemRole
} from '../lib/roleResolver.js';
import { feedback } from '../packages/ui/feedback.js';
import type { HubAppExperience } from '../lib/hubAppExperience.js';
import { EcosystemAppIcon } from './apps/EcosystemAppIcon.js';

type OrgTab = 'settings' | 'members' | 'apps' | 'roles' | 'billing' | 'audit';

const humanizeOrganizationAuditAction = (action: unknown) => {
  const value = String(action || '').toLowerCase();
  if (!value) return 'Atividade registrada';
  if (value.includes('invitation') && value.includes('created')) return 'Convite criado para a equipe';
  if (value.includes('invite') && value.includes('revok')) return 'Convite revogado';
  if (value.includes('member') && value.includes('remove')) return 'Pessoa removida da equipe';
  if (value.includes('member') && (value.includes('role') || value.includes('permission'))) return 'Acesso de uma pessoa foi atualizado';
  if (value.includes('join') && (value.includes('approve') || value.includes('accept'))) return 'Entrada de uma pessoa foi aprovada';
  if (value.includes('join') && value.includes('reject')) return 'Solicitação de entrada foi recusada';
  if (value.includes('organization') && value.includes('update')) return 'Dados da organização foram atualizados';
  if (value.includes('billing') || value.includes('subscription')) return 'Assinatura ou pagamento foi atualizado';
  if (value.includes('support.ticket')) return 'Solicitação de suporte criada';
  if (value.includes('admin_accessed')) return 'Suporte acessou a organização';
  return 'Atividade administrativa registrada';
};

const resizeOrganizationLogo = (file: File): Promise<{ base64: string; contentType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('FILE_READ_FAILED'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      image.onload = () => {
        const maxDimension = 512;
        const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('CANVAS_UNAVAILABLE'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (dataUrl.length > 300000) {
          dataUrl = canvas.toDataURL('image/webp', 0.62);
        }
        const base64 = dataUrl.split(',')[1] || '';
        if (!base64 || base64.length > 340000) {
          reject(new Error('IMAGE_TOO_LARGE_AFTER_RESIZE'));
          return;
        }
        resolve({ base64, contentType: 'image/webp' });
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });

export function OrganizationManager({ 
  organization, 
  members, 
  currentUserPerms, 
  currentUserRole,
  user,
  profile,
  onSaveOrg,
  handleUpdateMemberRole,
  handleUpdateMemberSystemRole,
  handleRemoveMember,
  onEditMember,
  onTransferOwnership,
  isEditingOrg,
  setIsEditingOrg,
  orgNameInput,
  setOrgNameInput,
  orgSlugInput,
  setOrgSlugInput,
  savingOrg,
  handleCreateInvite,
  handleRevokeInvite,
  handleAcceptJoinRequest,
  handleRejectJoinRequest,
  pendingInvites = [],
  joinRequests = [],
  copiedLink,
  auditLogs,
  setActiveDashboardTab,
  initialTab,
  onOpenInviteModal,
  adminSelectedOrgId,
  setAdminSelectedOrgId,
  onOpenMusicScale,
  appExperiences = [],
  onOpenApp
}: any) {
  const { t } = useTranslation(['dashboard']);
  const isGlobalAdmin = isGlobalPrivilegedUser(profile);
  const canCrossTenantAccess = canEnterAnyOrganization(profile);
  const ecosystemPrivilegePolicy = resolveEcosystemPrivilegePolicy(profile?.systemRole);
  const isEcosystemSupport = ecosystemPrivilegePolicy.isEcosystemSupportStaff;
  const canManageGlobalGovernance = ecosystemPrivilegePolicy.canManageGlobalGovernance;
  const isCrossTenantSupportSession = isEcosystemSupport && Boolean(adminSelectedOrgId);
  const [activeTab, setActiveTabInternal] = useState<OrgTab>(
    (initialTab as OrgTab) || (isCrossTenantSupportSession ? 'members' : 'settings')
  );
  const [slugStatus, setSlugStatus] = useState<string | null>(null);
  const [adminOrgs, setAdminOrgs] = useState<any[]>([]);
  const [liveConductorByMember, setLiveConductorByMember] = useState<Record<string, boolean>>({});
  const [liveConductorSavingId, setLiveConductorSavingId] = useState<string | null>(null);
  const [liveConductorError, setLiveConductorError] = useState<string | null>(null);
  const [globalRoleSavingId, setGlobalRoleSavingId] = useState<string | null>(null);
  const [reissuingInviteId, setReissuingInviteId] = useState<string | null>(null);
  const [inviteActionMessage, setInviteActionMessage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [organizationDetails, setOrganizationDetails] = useState({
    addressLine: '',
    city: '',
    state: '',
    country: 'Brasil',
    postalCode: '',
    phone: '',
    whatsapp: '',
    website: '',
    instagram: '',
    locale: 'pt-BR',
    timeZone: 'America/Sao_Paulo'
  });
  const organizationRoleLocale: 'pt' | 'en' | 'es' =
    String(organizationDetails.locale || organization?.locale || 'pt-BR').toLowerCase().startsWith('en')
      ? 'en'
      : String(organizationDetails.locale || organization?.locale || 'pt-BR').toLowerCase().startsWith('es')
        ? 'es'
        : 'pt';

  useEffect(() => {
    setOrganizationDetails({
      addressLine: organization?.addressLine || organization?.address?.street || '',
      city: organization?.city || organization?.address?.city || '',
      state: organization?.state || organization?.address?.state || '',
      country: organization?.country || organization?.address?.country || 'Brasil',
      postalCode: organization?.postalCode || organization?.address?.zip || '',
      phone: organization?.phone || '',
      whatsapp: organization?.whatsapp || '',
      website: organization?.website || '',
      instagram: organization?.instagram || '',
      locale: organization?.locale || 'pt-BR',
      timeZone: organization?.timeZone || 'America/Sao_Paulo'
    });
  }, [
    organization?.id,
    organization?.addressLine,
    organization?.city,
    organization?.state,
    organization?.country,
    organization?.postalCode,
    organization?.phone,
    organization?.whatsapp,
    organization?.website,
    organization?.instagram,
    organization?.locale,
    organization?.timeZone
  ]);

  const updateOrganizationDetail = (key: string, value: string) => {
    setOrganizationDetails(previous => ({ ...previous, [key]: value }));
    setDetailsMessage(null);
  };

  const handleSaveOrganizationDetails = async () => {
    if (!user || !organization?.id) return;
    setDetailsSaving(true);
    setDetailsMessage(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/user/organization', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orgId: organization.id,
          ...organizationDetails
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || 'Não foi possível salvar os dados.');
      }
      setDetailsMessage('Dados atualizados com sucesso.');
    } catch (error: any) {
      setDetailsMessage(error?.message || 'Não foi possível salvar os dados.');
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleLogoUpload = async (file?: File | null) => {
    if (!file || !user || !organization?.id) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setDetailsMessage('Use uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDetailsMessage('A imagem original precisa ter no máximo 5 MB.');
      return;
    }

    setLogoUploading(true);
    setDetailsMessage(null);
    try {
      const processed = await resizeOrganizationLogo(file);
      const base64 = processed.base64;
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/v1/organizations/${encodeURIComponent(organization.id)}/logo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: processed.contentType,
            base64
          })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || 'Não foi possível atualizar a logo.');
      }
      setDetailsMessage('Logo atualizada com sucesso.');
    } catch (error: any) {
      setDetailsMessage(error?.message || 'Não foi possível atualizar a logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const member of members || []) {
      next[member.id] =
        member?.permissions?.['musicscale.live.conduct'] === true;
    }
    setLiveConductorByMember(next);
  }, [members]);

  const handleReissueInvite = async (invite: any) => {
    if (!user || !organization?.id || !invite?.id) return;
    setReissuingInviteId(invite.id);
    setInviteActionMessage(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/v1/organizations/${encodeURIComponent(organization.id)}/invitations/${encodeURIComponent(invite.id)}/reissue`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: '{}'
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true || typeof data?.invitePath !== 'string') {
        throw new Error(data?.reasonCode || 'REISSUE_FAILED');
      }

      const inviteUrl = new URL(data.invitePath, window.location.origin).toString();
      const emailResponse = await fetch('/api/v1/invitations/email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: organization.id,
          invitationId: data.invitation.id,
          inviteUrl
        })
      });
      const emailData = await emailResponse.json().catch(() => ({}));

      if (emailResponse.ok && emailData?.success === true) {
        setInviteActionMessage(`Novo convite enviado para ${data.invitation.email}.`);
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setInviteActionMessage('Novo convite criado com segurança e link copiado.');
      }
    } catch (error: any) {
      console.error('[OrganizationManager] Invitation reissue failed', error);
      setInviteActionMessage('Não foi possível reenviar o convite. Tente novamente.');
    } finally {
      setReissuingInviteId(null);
    }
  };

  const authoritativeOwnerUid = String(
    organization?.ownerUid ||
    organization?.ownerUserId ||
    organization?.ownerId ||
    organization?.owner_user_id ||
    '',
  );
  const actorIsAuthoritativeOwner =
    Boolean(authoritativeOwnerUid) && authoritativeOwnerUid === user?.uid;

  const getMemberRoleManagementOptions = (member: any) => {
    const memberId = String(member?.id || member?.uid || '');
    const rawRole = String(
      member?.organizationRole ?? member?.role ?? 'member',
    ).trim().toLowerCase();

    const decision = getMemberRoleUiPolicy({
      actorUid: user?.uid,
      actorIsGlobalPrivileged: isGlobalAdmin,
      actorOrganizationRole: currentUserRole,
      actorIsAuthoritativeOwner,
      targetUid: memberId,
      targetOrganizationRole: rawRole,
      authoritativeOwnerUid,
    });

    if (!decision.canEdit) return [];

    return getInviteableOrganizationRolesForActor({
      systemRole: profile?.systemRole,
      organizationRole: currentUserRole,
    });
  };

  const roleInheritsLiveConduct = (role: string | null | undefined) =>
    ['owner', 'admin', 'leader'].includes(
      String(role || '').trim().toLowerCase(),
    );

  const getSystemRoleOptionsForMember = (member: any) => {
    const actorRole = String(
      normalizeLegacySystemRole(profile?.systemRole || 'user') || 'user',
    );
    const targetRole = String(
      normalizeLegacySystemRole(member?.systemRole || 'user') || 'user',
    );

    return ASSIGNABLE_SYSTEM_ROLES.filter((candidate) =>
      candidate === targetRole ||
      canChangeSystemRole(actorRole, targetRole, candidate).allowed
    );
  };

  const handleChangeMemberSystemRole = async (member: any, nextRole: string) => {
    if (
      !canManageGlobalGovernance ||
      typeof handleUpdateMemberSystemRole !== 'function' ||
      !member?.id ||
      member.id === user?.uid
    ) return;

    setGlobalRoleSavingId(member.id);
    try {
      await handleUpdateMemberSystemRole(member.id, nextRole);
    } finally {
      setGlobalRoleSavingId(null);
    }
  };

  const handleToggleLiveConduct = async (member: any) => {
    if (!organization?.id || !user || roleInheritsLiveConduct(member?.role)) return;

    const current = liveConductorByMember[member.id] === true;
    const next = !current;
    setLiveConductorSavingId(member.id);
    setLiveConductorError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/v1/organizations/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(member.id)}/musicscale-capability`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            capability: 'musicscale.live.conduct',
            enabled: next,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.reasonCode || 'CAPABILITY_UPDATE_FAILED');
      }
      setLiveConductorByMember((previous) => ({
        ...previous,
        [member.id]: next,
      }));
    } catch (error) {
      console.error('[OrganizationManager] Live conductor update failed', error);
      setLiveConductorError(
        'Não foi possível atualizar a permissão de condução. Nenhuma outra permissão foi alterada.',
      );
    } finally {
      setLiveConductorSavingId(null);
    }
  };

  useEffect(() => {
    if (canCrossTenantAccess) {
       user.getIdToken().then((token: string) => {
         fetch('/api/admin/organizations', {
            headers: { 'Authorization': `Bearer ${token}` }
         }).then(res => res.json()).then(data => {
            if (data.organizations) setAdminOrgs(data.organizations);
         }).catch(console.error);
       });
    }
  }, [canCrossTenantAccess, user]);

  // Auto-generate slug when typing name if slug is empty or it was auto-generated
  useEffect(() => {
     if (isEditingOrg && orgNameInput) {
        if (!orgSlugInput || (organization && orgSlugInput === normalizeSlug(organization.name))) {
           setOrgSlugInput(normalizeSlug(orgNameInput));
        }
     }
  }, [orgNameInput, isEditingOrg]);

  // Check slug availability when it changes
  useEffect(() => {
     if (!isEditingOrg || !orgSlugInput || orgSlugInput.trim().length === 0) {
        setSlugStatus(null);
        return;
     }
     
     if (organization && orgSlugInput === organization.slug) {
        setSlugStatus('current_org');
        return;
     }

     const checkSlug = async () => {
        setSlugStatus('checking');
        try {
           const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(orgSlugInput)}&orgId=${organization?.id || ''}`);
           const data = await res.json();
           if (data.available) {
              setSlugStatus('available');
           } else {
              setSlugStatus(data.reason || 'taken'); // 'taken', 'reserved', 'current_org'
           }
        } catch (e) {
           console.error(e);
           setSlugStatus(null);
        }
     };

     const timeoutId = setTimeout(checkSlug, 500); // debounce check
     return () => clearTimeout(timeoutId);
  }, [orgSlugInput, isEditingOrg, organization]);

  React.useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabInternal(initialTab as OrgTab);
    }
  }, [initialTab]);

  const setActiveTab = (tab: OrgTab) => {
    setActiveTabInternal(tab);
    // Option to push to history
  }

  const TABS = [
    { id: 'settings', label: 'Ajustes', icon: Settings, perms: ['organization.settings.update'] },
    { id: 'members', label: 'Membros & Convites', icon: Users, perms: ['organization.members.manage', 'organization.members.invite'] },
    { id: 'roles', label: 'Cargos e Permissões', icon: ShieldCheck, perms: ['organization.roles.manage'] },
    { id: 'apps', label: 'Aplicativos', icon: LayoutGrid, perms: ['organization.apps.manage'] },
    { id: 'billing', label: 'Assinatura', icon: CreditCard, perms: ['organization.billing.manage'] },
    { id: 'audit', label: 'Atividade e segurança', icon: Settings, perms: ['organization.audit.view'] }
  ];

  const visibleTabs = isCrossTenantSupportSession
    ? TABS.filter(t => ['members', 'apps', 'audit'].includes(t.id))
    : TABS.filter(t => t.perms.some(p => currentUserPerms[p] || isGlobalAdmin));

  useEffect(() => {
    if (
      isCrossTenantSupportSession &&
      !['members', 'apps', 'audit'].includes(activeTab)
    ) {
      setActiveTabInternal('members');
    }
  }, [isCrossTenantSupportSession, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      {canCrossTenantAccess && (
        <div className="relative overflow-hidden rounded-[1.6rem] border border-[#2B85EB]/25 bg-[#08111D] p-4 shadow-[0_22px_60px_rgba(0,0,0,.24)] sm:p-5">
          <div className="pointer-events-none absolute right-[-5%] top-[-80%] h-56 w-56 rounded-full bg-[#2B85EB]/20 blur-[80px]" />
          <div className="relative flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-5 h-5 text-[#2B85EB]" />
             <div>
                <p className="text-sm font-bold text-[#F5F7FA]">{isEcosystemSupport ? 'Modo Suporte' : 'Administração Global'}</p>
                <p className="text-[11px] text-[#A0A7B5]">
                  {isEcosystemSupport
                    ? 'Acesse uma organização para diagnóstico e suporte operacional, sem assumir propriedade.'
                    : 'Acesse qualquer organização usando seu papel global do ecossistema.'}
                </p>
             </div>
          </div>
          <select
            value={adminSelectedOrgId || profile?.organizationId || ''}
            onChange={(e) => {
               if (e.target.value === profile?.organizationId) {
                  setAdminSelectedOrgId(null);
               } else {
                  setAdminSelectedOrgId(e.target.value);
               }
            }}
            className="bg-[#050505] text-[#F5F7FA] text-sm rounded-xl px-4 py-2.5 border border-white/10 outline-none w-full sm:w-auto sm:min-w-[250px]"
          >
             <option value={profile?.organizationId || ''}>Voltar à sua organização</option>
             {adminOrgs.filter(o => o.id !== profile?.organizationId).map(org => (
               <option key={org.id} value={org.id}>{org.name} {org.slug ? `(${org.slug})` : ''}</option>
             ))}
          </select>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#07090D]/95 p-3 shadow-[0_35px_100px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_65%_-10%,rgba(43,133,235,.09),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:gap-5">
      {/* Sidebar Navigation */}
      <aside className="w-full shrink-0 overflow-x-auto md:overflow-visible no-scrollbar rounded-2xl border border-white/[0.055] bg-black/15 p-2 md:w-64 md:p-3">
        <h2 className="hidden md:flex text-xl font-semibold text-[#F5F7FA] items-center gap-3 mb-6 px-4">
           <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
            <Building2 className="w-4 h-4 text-[#A0A7B5]" />
          </span>
          Administração
        </h2>
        
        <div className="flex gap-2 md:flex-col">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasNotification = tab.id === 'members' && joinRequests && joinRequests.length > 0;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'billing') {
                  setActiveDashboardTab('billing'); // Redirects back to dashboard billing tab or we merge billing here?
                  return;
                }
                setActiveTab(tab.id as OrgTab);
              }}
              className={`shrink-0 min-h-[44px] flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all font-medium text-xs md:text-sm border relative ${isActive ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20 shadow-sm' : 'bg-transparent text-[#A0A7B5] border-white/5 md:border-transparent hover:bg-white/5 hover:text-[#F5F7FA]'}`}
            >
              <div className="relative">
                 <Icon className="w-4 h-4" />
                 {hasNotification && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#050505]"></span>}
              </div>
              {tab.label}
            </button>
          )
        })}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-h-[400px] min-w-0 flex-1 rounded-2xl border border-white/[0.05] bg-black/10 p-3 sm:p-5 md:p-6">
        <AnimatePresence mode="wait">
          
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="text-lg font-semibold text-[#F5F7FA] mb-6">Dados da organização</h3>
              
              <div className="space-y-6 max-w-xl">
                  <div className="bg-transparent p-0 rounded-none border-none">
                     <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Dados principais</p>
                     
                     <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 bg-[#050505] p-4 sm:p-5 rounded-2xl border border-white/5 mb-6">
                        <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-2xl text-[#F5F7FA] shrink-0">
                          {organization?.logo ? <img src={organization.logo} className="w-full h-full rounded-xl object-cover" /> : organization?.name?.charAt(0) || 'O'}
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                           <p className="text-xs font-semibold text-[#F5F7FA] mb-1.5">Logo da organização</p>
                           <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                disabled={logoUploading}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  void handleLogoUpload(file);
                                  event.currentTarget.value = '';
                                }}
                                className="text-xs text-[#A0A7B5] file:mr-3 file:py-1.5 file:px-3 sm:file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-[#F5F7FA] hover:file:bg-white/10 transition-all cursor-pointer disabled:opacity-50 min-w-0 max-w-full w-full"
                              />
                              {logoUploading && <Loader2 className="w-4 h-4 text-[#2B85EB] animate-spin" />}
                           </div>
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                       <div>
                         <p className="text-xs font-semibold text-[#A0A7B5] mb-1.5">Nome Oficial</p>
                         {isEditingOrg ? (
                           <div className="flex items-center gap-2 min-w-0">
                             <input 
                               title="Nome"
                               type="text" 
                               value={orgNameInput} 
                               onChange={(e) => setOrgNameInput(e.target.value)} 
                               className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all min-w-0 flex-1 w-full"
                             />
                             <button disabled={savingOrg} onClick={onSaveOrg} className="p-2.5 bg-[#2B85EB] hover:bg-[#2B85EB]/80 text-white rounded-xl transition-colors shrink-0">
                               {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                             </button>
                             <button disabled={savingOrg} onClick={() => { setIsEditingOrg(false); setOrgNameInput(organization.name); }} className="p-2.5 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors shrink-0">
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                         ) : (
                           <div className="flex items-center justify-between gap-3 bg-[#050505] border border-white/5 rounded-xl px-4 py-3 min-w-0">
                             <p className="text-sm font-medium text-[#F5F7FA] min-w-0 break-words">{organization?.name}</p>
                             <button onClick={() => setIsEditingOrg(true)} className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[#F5F7FA] transition-colors">Editar</button>
                           </div>
                         )}
                       </div>

                       <div>
                         <div className="text-xs font-semibold text-[#A0A7B5] mb-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span>Endereço da página pública</span>
                            {organization?.slug && !isEditingOrg && (
                               <span className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                                   <button
                                     type="button"
                                     onClick={async () => {
                                       try {
                                         await navigator.clipboard.writeText(`https://millionsnest.com/${organization.slug}`);
                                         feedback.success('Link copiado.');
                                       } catch {
                                         feedback.error('Não foi possível copiar o link.');
                                       }
                                     }}
                                     className="text-[#A0A7B5] hover:text-white flex items-center gap-1.5 font-normal px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
                                   >
                                     <Copy className="w-3.5 h-3.5" /> Copiar
                                   </button>
                                   <a href={`/${organization.slug}`} target="_blank" rel="noopener noreferrer" className="bg-[#2B85EB]/10 border border-[#2B85EB]/20 text-[#2B85EB] text-[10px] font-bold rounded-md px-2.5 py-1 flex items-center gap-1.5 uppercase tracking-widest shadow-sm hover:bg-[#2B85EB]/20 transition-colors"><Link className="w-3.5 h-3.5" /> Ver Página</a>
                               </span>
                            )}
                         </div>
                         <div className={`flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[#050505] border ${isEditingOrg ? (orgSlugInput.trim().length > 0 && slugStatus === 'available' ? 'border-[#10B981]' : (orgSlugInput.trim().length > 0 && slugStatus !== 'checking' ? 'border-[#EF4444]' : 'border-white/10')) : 'border-white/5'} rounded-xl px-4 py-3 ${isEditingOrg ? '' : 'opacity-70'} relative transition-colors`}>
                           <span className="text-xs sm:text-sm text-[#A0A7B5] shrink-0">millionsnest.com/</span>
                           {isEditingOrg ? (
                             <>
                               <input 
                                 type="text" 
                                 value={orgSlugInput}
                                 onChange={(e) => setOrgSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                 placeholder="sua-organizacao"
                                 className="bg-transparent text-sm text-[#F5F7FA] outline-none focus:border-none flex-1 min-w-[110px]"
                               />
                               {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#A0A7B5] animate-spin shrink-0" />}
                               {slugStatus === 'available' && orgSlugInput.trim().length > 0 && <span className="text-xs font-semibold text-[#10B981] shrink-0 bg-[#10B981]/10 px-2 py-1 rounded">Disponível</span>}
                               {slugStatus === 'taken' && orgSlugInput.trim().length > 0 && <span className="text-xs font-semibold text-[#EF4444] shrink-0 bg-[#EF4444]/10 px-2 py-1 rounded">Em uso</span>}
                               {slugStatus === 'reserved' && orgSlugInput.trim().length > 0 && <span className="text-xs font-semibold text-[#EF4444] shrink-0 bg-[#EF4444]/10 px-2 py-1 rounded">Reservado</span>}
                               {slugStatus === 'current_org' && orgSlugInput.trim().length > 0 && <span className="text-xs font-semibold text-[#2B85EB] shrink-0 bg-[#2B85EB]/10 px-2 py-1 rounded">Seu endereço</span>}
                             </>
                           ) : (
                             <input 
                               type="text" 
                               value={organization?.slug || ''}
                               placeholder="sua-organizacao"
                               className="bg-transparent text-sm text-[#F5F7FA] outline-none focus:border-none flex-1 min-w-[110px]"
                               disabled
                             />
                           )}
                         </div>
                         {isEditingOrg && organization?.slug && orgSlugInput !== organization.slug && orgSlugInput.trim().length > 0 && (
                            <p className="text-[11px] text-[#A0A7B5] mt-2 flex items-center gap-1.5 bg-[#2B85EB]/10 p-2 rounded-lg border border-[#2B85EB]/20">
                               <ShieldCheck className="w-3 h-3 text-[#2B85EB]" /> Links antigos continuarão funcionando com redirecionamento automático.
                            </p>
                         )}
                       </div>
                     </div>
                  </div>
                  
                  <details className="group bg-[#050505] border border-white/5 rounded-2xl p-5">
                    <summary className="cursor-pointer list-none flex items-start sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#F5F7FA]">Contato e localização</p>
                        <p className="text-xs text-[#A0A7B5] mt-1">Complete somente as informações que sua igreja deseja usar.</p>
                      </div>
                      <span className="text-xs text-[#2B85EB] group-open:hidden">Editar</span>
                      <span className="text-xs text-[#A0A7B5] hidden group-open:inline">Fechar</span>
                    </summary>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                      <label className="text-xs text-[#A0A7B5]">
                        Endereço
                        <input value={organizationDetails.addressLine} onChange={(e) => updateOrganizationDetail('addressLine', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" placeholder="Rua e número" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Cidade
                        <input value={organizationDetails.city} onChange={(e) => updateOrganizationDetail('city', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Estado
                        <input value={organizationDetails.state} onChange={(e) => updateOrganizationDetail('state', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        País
                        <input value={organizationDetails.country} onChange={(e) => updateOrganizationDetail('country', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        CEP
                        <input value={organizationDetails.postalCode} onChange={(e) => updateOrganizationDetail('postalCode', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Telefone
                        <input value={organizationDetails.phone} onChange={(e) => updateOrganizationDetail('phone', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" placeholder="(00) 0000-0000" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        WhatsApp
                        <input value={organizationDetails.whatsapp} onChange={(e) => updateOrganizationDetail('whatsapp', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" placeholder="(00) 00000-0000" />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Site
                        <input value={organizationDetails.website} onChange={(e) => updateOrganizationDetail('website', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" placeholder="https://..." />
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Instagram
                        <input value={organizationDetails.instagram} onChange={(e) => updateOrganizationDetail('instagram', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]" placeholder="@suaigreja" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                      <label className="text-xs text-[#A0A7B5]">
                        Idioma principal
                        <select value={organizationDetails.locale} onChange={(e) => updateOrganizationDetail('locale', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]">
                          <option value="pt-BR">Português (Brasil)</option>
                          <option value="en">English</option>
                          <option value="es">Español</option>
                        </select>
                      </label>
                      <label className="text-xs text-[#A0A7B5]">
                        Fuso horário
                        <select value={organizationDetails.timeZone} onChange={(e) => updateOrganizationDetail('timeZone', e.target.value)} className="mt-1.5 w-full bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#2B85EB]">
                          <option value="America/Sao_Paulo">Brasília / São Paulo</option>
                          <option value="America/Manaus">Manaus</option>
                          <option value="America/Rio_Branco">Rio Branco</option>
                          <option value="America/Noronha">Fernando de Noronha</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </label>
                    </div>

                    {detailsMessage && (
                      <p className={`mt-4 text-xs ${detailsMessage.includes('sucesso') ? 'text-emerald-400' : 'text-amber-300'}`}>{detailsMessage}</p>
                    )}

                    <button
                      type="button"
                      disabled={detailsSaving}
                      onClick={() => void handleSaveOrganizationDetails()}
                      className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
                    >
                      {detailsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Salvar informações
                    </button>
                  </details>

                  {isGlobalAdmin && (
                    <details className="bg-transparent pt-4 border-t border-white/5">
                      <summary className="cursor-pointer text-xs font-semibold text-[#A0A7B5]">Informações técnicas</summary>
                      <div className="mt-3">
                        <span className="text-xs font-mono text-[#A0A7B5] bg-[#050505] px-3 py-2 rounded-xl border border-white/5 select-all break-all inline-block max-w-full">{organization?.id || user.uid}</span>
                      </div>
                    </details>
                  )}
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                 <h3 className="text-lg font-semibold text-[#F5F7FA]">Membros & Convites</h3>
                 
                 {(currentUserRole === 'owner' || currentUserRole === 'admin' || isGlobalAdmin) && (
                   <div className="flex items-center gap-3">
                     <button onClick={onOpenInviteModal} className="flex items-center gap-2 px-4 py-2 bg-[#F5F7FA] text-[#050505] rounded-xl hover:bg-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                       Convidar Membro
                     </button>
                   </div>
                 )}
               </div>
               
               {liveConductorError && (
                 <div className="mb-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200/80">
                   {liveConductorError}
                 </div>
               )}

               <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                  {members.map((member: any, i: number) => (
                    <div key={member.id} className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== members.length - 1 ? 'border-b border-white/5' : ''}`}>
                      <div className="flex w-full min-w-0 items-start gap-3 sm:flex-1">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-[#F5F7FA]">
                          {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full rounded-xl object-cover" /> : member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-semibold text-[#F5F7FA] break-words">
                            {member.displayName || 'Usuário'} {member.id === user?.uid && '(Você)'}
                          </span>
                          <span className="text-xs text-[#A0A7B5] break-all">{member.email}</span>
                        </div>
                      </div>
                      
                      {(currentUserPerms['organization.roles.manage'] || isGlobalAdmin) ? (
                        <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 sm:w-auto sm:justify-end">
                          {(() => {
                            const inherited = roleInheritsLiveConduct(member.organizationRole ?? member.role);
                            const enabled = inherited || liveConductorByMember[member.id] === true;
                            const isSaving = liveConductorSavingId === member.id;
                            return (
                              <button
                                type="button"
                                onClick={() => void handleToggleLiveConduct(member)}
                                disabled={inherited || isSaving}
                                aria-pressed={enabled}
                                title={
                                  inherited
                                    ? 'Este cargo já pode conduzir ao vivo.'
                                    : enabled
                                      ? 'Remover permissão individual de condução'
                                      : 'Permitir condução ao vivo sem liberar gestão de escalas'
                                }
                                className={`h-8 px-3 rounded-full border inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                                  enabled
                                    ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'
                                    : 'border-white/[0.08] bg-white/[0.025] text-[#A0A7B5] hover:text-[#F5F7FA] hover:bg-white/[0.05]'
                                } disabled:cursor-default`}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      enabled ? 'bg-emerald-300' : 'bg-white/25'
                                    }`}
                                  />
                                )}
                                {inherited
                                  ? 'Direção · cargo'
                                  : enabled
                                    ? 'Pode conduzir'
                                    : 'Condução'}
                              </button>
                            );
                          })()}

                          {(() => {
                            const rawRole = String(
                              member?.organizationRole ?? member?.role ?? 'member',
                            ).trim().toLowerCase();
                            const options = getMemberRoleManagementOptions(member);
                            const canEditRole = options.length > 0;
                            const optionValues = new Set(options);
                            const currentIsCanonicalOption = optionValues.has(rawRole as any);

                            return (
                              <select
                                value={rawRole}
                                onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                disabled={!canEditRole}
                                aria-label={`Nível de acesso de ${member.displayName || member.email || 'membro'}`}
                                className="min-w-0 max-w-full flex-1 sm:flex-none bg-[#0B0F19] border border-white/10 text-[#F5F7FA] text-xs font-medium rounded-lg px-3 py-2 outline-none focus:border-[#2B85EB] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {!currentIsCanonicalOption && (
                                  <option value={rawRole} disabled={canEditRole}>
                                    {getOrganizationRoleLabel(rawRole, organizationRoleLocale)}
                                  </option>
                                )}
                                {options.map((role) => (
                                  <option key={role} value={role}>
                                    {getOrganizationRoleLabel(role, organizationRoleLocale)}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                          
                          {canManageGlobalGovernance && member.id !== user?.uid && typeof handleUpdateMemberSystemRole === 'function' && (() => {
                            const currentSystemRole = String(
                              normalizeLegacySystemRole(member?.systemRole || 'user') || 'user',
                            );
                            const systemRoleOptions = getSystemRoleOptionsForMember(member);
                            const systemRoleEditable = systemRoleOptions.some(role => role !== currentSystemRole);
                            const isSavingSystemRole = globalRoleSavingId === member.id;

                            return (
                              <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] px-2.5 py-2 sm:w-auto">
                                <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7DB7FA]">
                                  {t('governance.ecosystem_label')}
                                </span>
                                <select
                                  value={currentSystemRole}
                                  onChange={(event) => void handleChangeMemberSystemRole(member, event.target.value)}
                                  disabled={!systemRoleEditable || isSavingSystemRole}
                                  aria-label={t('governance.ecosystem_role_aria', {
                                    name: member.displayName || member.email || t('governance.member_fallback')
                                  })}
                                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#080B10] px-2.5 py-1.5 text-[11px] font-semibold text-[#F5F7FA] outline-none focus:border-[#2B85EB] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[170px]"
                                >
                                  {systemRoleOptions.map(role => (
                                    <option key={role} value={role}>
                                      {t(`governance.system_roles.${role}`, { defaultValue: getSystemRoleLabel(role) })}
                                    </option>
                                  ))}
                                </select>
                                {isSavingSystemRole && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#77B5FF]" />}
                              </div>
                            );
                          })()}

                          {(currentUserRole === 'owner' || currentUserRole === 'admin' || isGlobalAdmin) && (
                            <>
                              {onEditMember && (
                                <button
                                   onClick={() => onEditMember(member)}
                                   className="text-xs text-[#A0A7B5] hover:text-[#F5F7FA] font-medium p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded bg-white/5 hover:bg-white/10"
                                >
                                   <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isGlobalAdmin && onTransferOwnership && member.id !== authoritativeOwnerUid && (
                                <button
                                  type="button"
                                  onClick={() => onTransferOwnership(member)}
                                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#2B85EB]/25 bg-[#2B85EB]/10 text-[#6EAFFF] hover:bg-[#2B85EB]/15 transition-colors"
                                >
                                  Tornar dono
                                </button>
                              )}
                              <button
                                 onClick={() => handleRemoveMember(member.id)}
                                 disabled={String(member?.organizationRole ?? member?.role ?? '').toLowerCase() === 'owner'}
                                 className="text-xs text-red-500/70 hover:text-red-500 font-medium px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                 {member.id === user?.uid ? 'Sair' : 'Remover'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                         <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB]">
                            {getOrganizationRoleLabel(String(member?.organizationRole ?? member?.role ?? 'member'), organizationRoleLocale)}
                         </span>
                      )}
                    </div>
                  ))}
               </div>

               {pendingInvites && pendingInvites.length > 0 && (
                 <div className="mt-8">
                   <h4 className="text-sm font-semibold text-[#A0A7B5] mb-4 uppercase tracking-wider">Convites Pendentes</h4>
                   {inviteActionMessage && (
                     <p className="text-xs text-[#A0A7B5] mb-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">{inviteActionMessage}</p>
                   )}
                   <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                     {pendingInvites.map((invite: any, i: number) => {
                       const isExpired = invite.status === 'pending' && invite.expiresAt && invite.expiresAt.toMillis && invite.expiresAt.toMillis() < Date.now();
                       const isOld = invite.status === 'pending' && invite.createdAt && invite.createdAt.toMillis && (Date.now() - invite.createdAt.toMillis() > 7 * 24 * 60 * 60 * 1000);
                       const showAsExpired = isExpired || isOld;
                       return (
                       <div key={invite.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== pendingInvites.length - 1 ? 'border-b border-white/5' : ''}`}>
                         <div className="flex min-w-0 flex-1 items-center gap-3">
                           <div className="flex min-w-0 flex-1 flex-col">
                             <span className="text-sm font-semibold text-[#F5F7FA] flex items-center gap-2">
                               Status: <span className={showAsExpired ? "text-red-400" : "text-[#10B981]"}>{showAsExpired ? 'Expirado' : 'Aguardando'}</span>
                             </span>
                             <span className="text-xs text-[#A0A7B5] break-all">{invite.email || invite.emailNormalized || 'E-mail protegido'}</span>
                             <span className="text-xs text-[#A0A7B5]">Acesso: {getOrganizationRoleLabel(String(invite.role || 'member'), organizationRoleLocale)}</span>
                           </div>
                         </div>
                         
                         {(currentUserRole === 'owner' || currentUserRole === 'admin' || isGlobalAdmin) && (
                           <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                             <button
                               type="button"
                               disabled={reissuingInviteId === invite.id}
                               onClick={() => void handleReissueInvite(invite)}
                               className="text-xs font-medium text-[#2B85EB] hover:text-[#3B95FB] transition-colors px-3 py-1.5 bg-[#2B85EB]/10 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                             >
                               {reissuingInviteId === invite.id && <Loader2 className="w-3 h-3 animate-spin" />}
                               Reenviar
                             </button>
                             <button onClick={() => handleRevokeInvite(invite.id)} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 bg-red-500/10 rounded-lg">
                               Revogar
                             </button>
                           </div>
                         )}
                       </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {joinRequests && joinRequests.length > 0 && (
                 <div className="mt-8">
                   <h4 className="text-sm font-semibold text-[#A0A7B5] mb-4 uppercase tracking-wider relative inline-block">
                      Solicitações de Acesso Pendentes
                      <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                   </h4>
                   <p className="text-xs text-[#A0A7B5] mb-4">Usuários aguardando aprovação para ingressar na organização como membro padrão.</p>
                   <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                     {joinRequests.map((req: any, i: number) => (
                       <div key={req.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== joinRequests.length - 1 ? 'border-b border-white/5' : ''}`}>
                         <div className="flex min-w-0 flex-1 items-center gap-3">
                           <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-[#F5F7FA]">
                             {req.photoURL ? <img src={req.photoURL} alt="" className="w-full h-full rounded-xl object-cover" /> : req.displayName?.charAt(0) || req.email?.charAt(0) || '?'}
                           </div>
                           <div className="flex min-w-0 flex-1 flex-col">
                             <span className="text-sm font-semibold text-[#F5F7FA] break-words">{req.displayName || 'Usuário Indefinido'}</span>
                             <span className="text-xs text-[#A0A7B5] break-all">{req.email || req.id}</span>
                           </div>
                         </div>
                         
                         {(currentUserRole === 'owner' || currentUserRole === 'admin' || isGlobalAdmin) && (
                           <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                              <button onClick={() => handleRejectJoinRequest && handleRejectJoinRequest(req.id)} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg">
                                Recusar
                              </button>
                              <button onClick={() => handleAcceptJoinRequest && handleAcceptJoinRequest(req.id)} className="text-xs font-medium text-[#10B981] hover:text-emerald-300 transition-colors px-3 py-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/20 rounded-lg">
                                Aprovar
                              </button>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'roles' && (
             <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-2">Cargos e permissões</h3>
                <p className="text-sm text-[#A0A7B5] mb-6">Escolha o nível de acesso que combina com a responsabilidade de cada pessoa. As regras técnicas ficam protegidas nos bastidores.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['owner', 'admin', 'manager', 'member', 'viewer'] as const).map((role) => (
                    <div
                      key={role}
                      className={`bg-[#050505] p-5 rounded-2xl border ${role === 'owner' ? 'border-[#2B85EB]/20' : 'border-white/5'}`}
                    >
                      <h4 className="text-[#F5F7FA] font-medium flex items-center gap-2 mb-2">
                        {role === 'owner' || role === 'admin' ? (
                          <ShieldCheck className={`w-4 h-4 ${role === 'owner' ? 'text-[#2B85EB]' : 'text-[#A0A7B5]'}`} />
                        ) : (
                          <Users className="w-4 h-4 text-[#A0A7B5]" />
                        )}
                        {getOrganizationRoleLabel(role, organizationRoleLocale)}
                      </h4>
                      <p className="text-xs text-[#A0A7B5]">
                        {getOrganizationRoleDescription(role, organizationRoleLocale)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">Funções ministeriais como músico, vocal, ministro ou instrumento são configuradas no MusicScale. Aqui você controla somente o acesso administrativo à organização.</p>
                </div>
             </motion.div>
          )}

          {activeTab === 'apps' && (
             <motion.div key="apps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-2">Aplicativos da organização</h3>
                <p className="text-sm text-[#A0A7B5] mb-6">Veja o que está ativo, o plano de cada produto e abra as configurações certas sem precisar entender a estrutura técnica do ecossistema.</p>

                <div className="space-y-3">
                  {(appExperiences as HubAppExperience[])
                    .filter(experience => experience.installed)
                    .map(experience => {
                      const app = experience.app;
                      const planLabel = experience.plan
                        ? String(experience.plan).replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
                        : experience.state === 'administrative'
                          ? 'Pro · acesso administrativo'
                          : 'Incluído';
                      const statusLabel: Record<string, string> = {
                        active: 'Ativo',
                        trialing: 'Em teste',
                        cancel_scheduled: 'Cancelamento agendado',
                        payment_issue: 'Pagamento pendente',
                        administrative: 'Acesso administrativo',
                        loading: 'Verificando',
                        error: 'Precisa de atenção'
                      };

                      return (
                        <div key={app.id} className="bg-[#050505] rounded-2xl border border-white/5 p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                {app.id === 'musicscale' ? (
                                  <img src="/LogoIconMusicScale-1.png" alt="" className="w-7 h-7 object-contain" />
                                ) : (
                                  <EcosystemAppIcon app={app} iconClassName="w-5 h-5" assetClassName="w-9 h-9" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-[#F5F7FA]">{app.name}</p>
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    experience.needsAttention
                                      ? 'bg-red-500/10 text-red-300 border-red-500/20'
                                      : experience.state === 'administrative'
                                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  }`}>
                                    {statusLabel[experience.state] || 'Ativo'}
                                  </span>
                                </div>
                                <p className="text-xs text-[#A0A7B5] mt-1 line-clamp-2">{app.shortDescription || app.description}</p>
                                <p className="text-[11px] text-white/50 mt-1.5">Plano: <span className="text-white/80 font-medium">{planLabel}</span></p>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenApp?.(app)}
                                disabled={experience.needsAttention && !isEcosystemSupport}
                                className="min-h-[42px] px-4 rounded-xl bg-white text-[#050505] text-xs font-semibold hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Abrir {app.name}
                              </button>
                              {!isEcosystemSupport && (
                                <button
                                  type="button"
                                  onClick={() => setActiveDashboardTab('billing')}
                                  className={`min-h-[42px] px-4 rounded-xl border text-xs font-semibold ${
                                    experience.needsAttention
                                      ? 'bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/15'
                                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                  }`}
                                >
                                  {experience.needsAttention ? 'Revisar assinatura' : 'Plano e cobrança'}
                                </button>
                              )}
                            </div>
                          </div>

                          {app.id === 'musicscale' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 pt-5 border-t border-white/5">
                              <button type="button" onClick={() => onOpenMusicScale?.('/users')} className="text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                <p className="text-sm font-semibold text-white">Equipe no MusicScale</p>
                                <p className="text-xs text-[#A0A7B5] mt-1">Músicos, vocais e funções ministeriais.</p>
                              </button>
                              <button type="button" onClick={() => onOpenMusicScale?.('/scales')} className="text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                <p className="text-sm font-semibold text-white">Escalas</p>
                                <p className="text-xs text-[#A0A7B5] mt-1">Cultos, músicas e confirmações.</p>
                              </button>
                              <button type="button" onClick={() => onOpenMusicScale?.('/profile')} className="text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                <p className="text-sm font-semibold text-white">Preferências do aplicativo</p>
                                <p className="text-xs text-[#A0A7B5] mt-1">Perfil e opções pessoais do MusicScale.</p>
                              </button>
                              <button type="button" onClick={() => onOpenMusicScale?.('/plan-usage')} className="text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                <p className="text-sm font-semibold text-white">Uso do plano</p>
                                <p className="text-xs text-[#A0A7B5] mt-1">Veja limites e utilização dos recursos.</p>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {(appExperiences as HubAppExperience[]).filter(experience => !experience.installed).length > 0 && (
                  <div className="mt-7 pt-6 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#A0A7B5] mb-3">Outros produtos do ecossistema</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(appExperiences as HubAppExperience[])
                        .filter(experience => !experience.installed)
                        .map(experience => (
                          <div key={experience.app.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              <EcosystemAppIcon app={experience.app} iconClassName="w-4 h-4 text-[#A0A7B5]" assetClassName="w-7 h-7" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{experience.app.name}</p>
                              <p className="text-[11px] text-[#A0A7B5] mt-0.5">
                                {experience.state === 'coming_soon' ? 'Em breve' : experience.state === 'development' ? 'Em desenvolvimento' : 'Disponível para contratação'}
                              </p>
                            </div>
                            {experience.state === 'available' && (
                              <button type="button" onClick={() => setActiveDashboardTab('billing')} className="text-xs font-semibold text-[#2B85EB]">Ver planos</button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-xs text-[#A0A7B5] leading-relaxed">
                    A organização, os convites, os cargos administrativos e a cobrança ficam centralizados no MillionsNest. Configurações operacionais específicas — como instrumentos, categorias ou fluxos internos — continuam dentro de cada aplicativo.
                  </p>
                </div>
             </motion.div>
          )}

          {activeTab === 'audit' && (
             <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-2">Atividade da organização</h3>
                <p className="text-sm text-[#A0A7B5] mb-6">Acompanhe mudanças importantes sem precisar interpretar códigos técnicos.</p>
                
                <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                   {auditLogs.length > 0 ? auditLogs.map((log: any, index: number) => {
                      const actor = members.find((member: any) => member.id === log.actorUid || member.uid === log.actorUid);
                      return (
                        <div key={log.id} className={`p-4 flex gap-4 ${index !== auditLogs.length -1 ? 'border-b border-white/5' : ''}`}>
                           <div className="w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
                              <Settings className="w-4 h-4 text-[#A0A7B5]" />
                           </div>
                           <div className="min-w-0">
                              <p className="text-sm text-[#F5F7FA] mb-1">{humanizeOrganizationAuditAction(log.action)}</p>
                              <p className="text-xs text-[#A0A7B5]">
                                {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Data não disponível'}
                                {actor?.displayName ? ` · por ${actor.displayName}` : ''}
                              </p>
                              {isGlobalAdmin && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-[10px] text-[#A0A7B5]">Detalhes técnicos</summary>
                                  <pre className="mt-2 text-[10px] text-[#A0A7B5] whitespace-pre-wrap break-all bg-black/20 p-2 rounded-lg">{JSON.stringify({ action: log.action, actorUid: log.actorUid, metadata: log.metadata }, null, 2)}</pre>
                                </details>
                              )}
                           </div>
                        </div>
                      );
                   }) : (
                      <div className="py-2">
                        <PremiumEmptyState 
                          icon={<ShieldCheck className="w-6 h-6" />}
                          title="Tudo tranquilo por aqui"
                          description="As mudanças administrativas importantes aparecerão nesta área."
                        />
                      </div>
                   )}
                </div>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
        </div>
    </div>
    </div>
  );
}
