import sys

new_content = """import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '../contexts/OrganizationContext';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleCreateInvite: (
    role: "admin" | "member",
    email: string,
    overrideOrgId?: string
  ) => Promise<{
    inviteUrl: string;
    invitation: {
      id: string;
      organizationId: string;
      organizationName: string;
      email: string;
      role: "admin" | "member";
      status: "pending";
      expiresAtMs: number;
    };
  }>;
  isAtLimit?: boolean;
  occupiedSlots?: number;
  maxUsersLimit?: number;
  onUpgradeClick?: () => void;
  canInvite?: boolean;
}

export function InviteModal({ 
  isOpen, 
  onClose, 
  handleCreateInvite,
  isAtLimit,
  occupiedSlots,
  maxUsersLimit,
  onUpgradeClick,
  canInvite = true
}: InviteModalProps) {
  const [role, setRole] = useState<"admin" | "member">('member');
  const [email, setEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [adminOrgs, setAdminOrgs] = useState<any[]>([]);
  const [overrideOrgId, setOverrideOrgId] = useState<string>('');
  
  const [createdInviteUrl, setCreatedInviteUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fallbackLink, setFallbackLink] = useState(false);
  
  const { userProfile, user } = useAuth();
  const { organization } = useOrganization();
  const { t } = useTranslation();
  
  const isGlobalAdmin = userProfile?.systemRole === 'ceo' || userProfile?.systemRole === 'global_admin' || userProfile?.systemRole === 'ecosystem_owner' || userProfile?.systemRole === 'founder';

  useEffect(() => {
    if (isOpen) {
      setRole('member');
      setEmail('');
      setCopiedLink(false);
      setIsLoading(false);
      setCreatedInviteUrl('');
      setErrorMsg('');
      setSuccessMsg('');
      setFallbackLink(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isGlobalAdmin && user) {
       setLoadingOrgs(true);
       user.getIdToken().then(token => {
          fetch('/api/admin/organizations', {
             headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => res.json())
          .then(data => {
             if (Array.isArray(data.organizations)) {
               setAdminOrgs(data.organizations);
             } else {
               setErrorMsg(t('dashboard.invite.errors.organizations_load', 'Não foi possível carregar a lista de organizações.'));
             }
          })
          .catch(err => {
             console.error(err);
             setErrorMsg(t('dashboard.invite.errors.organizations_load', 'Não foi possível carregar a lista de organizações.'));
          })
          .finally(() => setLoadingOrgs(false));
       });
    }
  }, [isOpen, isGlobalAdmin, user, t]);

  const mapErrorCode = (code: string) => {
    switch(code) {
      case 'UNAUTHENTICATED': return t('dashboard.invite.errors.session_expired', 'Sua sessão expirou. Atualize a página e tente novamente.');
      case 'INVALID_INVITE_EMAIL': return t('dashboard.invite.errors.invalid_email', 'Informe um e-mail válido.');
      case 'INVALID_INVITE_ROLE': return t('dashboard.invite.errors.invalid_role', 'Escolha uma função válida.');
      case 'ACTOR_MEMBERSHIP_REQUIRED':
      case 'ACTOR_MEMBERSHIP_INACTIVE':
      case 'PERMISSION_DENIED': return t('dashboard.invite.errors.permission_denied', 'Você não possui permissão para convidar pessoas nesta organização.');
      case 'ORGANIZATION_NOT_FOUND': return t('dashboard.invite.errors.organization_not_found', 'A organização selecionada não foi encontrada.');
      case 'ORGANIZATION_INACTIVE': return t('dashboard.invite.errors.organization_inactive', 'Esta organização não está ativa.');
      case 'INVITE_ALREADY_PENDING': return t('dashboard.invite.errors.already_pending', 'Já existe um convite pendente para este e-mail. Revogue o convite anterior antes de criar outro.');
      case 'MEMBER_LIMIT_REACHED': return t('dashboard.invite.errors.member_limit', 'O limite de pessoas do plano foi atingido.');
      case 'MEMBER_LIMIT_UNAVAILABLE': return t('dashboard.invite.errors.limit_unavailable', 'Não foi possível confirmar o limite do plano agora. Tente novamente.');
      case 'TIMEOUT': return t('dashboard.invite.errors.timeout', 'A criação do convite demorou mais que o esperado. Verifique sua conexão antes de tentar novamente.');
      default: return t('dashboard.invite.errors.generic', 'Não foi possível criar o convite. Tente novamente.');
    }
  };

  const ensureInvite = async (): Promise<string | null> => {
    if (createdInviteUrl) return createdInviteUrl;
    
    if (!email || !email.trim()) {
      setErrorMsg(t('dashboard.invite.email_required', 'Informe o e-mail da pessoa.'));
      return null;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const res = await handleCreateInvite(role, email, overrideOrgId);
      setCreatedInviteUrl(res.inviteUrl);
      return res.inviteUrl;
    } catch (err: any) {
      setErrorMsg(mapErrorCode(err.message));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const onCopy = async () => {
    if (isLoading) return;
    const url = await ensureInvite();
    if (!url) return;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setSuccessMsg(t('dashboard.invite.link_copied', 'Link copiado.'));
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (e) {
      setFallbackLink(true);
      setErrorMsg(t('dashboard.invite.clipboard_blocked', 'O convite foi criado, mas o navegador não permitiu copiar automaticamente.'));
    }
  };

  const onWhatsApp = async () => {
    if (isLoading) return;
    
    if (!createdInviteUrl) {
      if (!email || !email.trim()) {
        setErrorMsg(t('dashboard.invite.email_required', 'Informe o e-mail da pessoa.'));
        return;
      }
    }
    
    const popup = window.open('about:blank', '_blank');
    
    const url = await ensureInvite();
    if (!url) {
      if (popup) popup.close();
      return;
    }
    
    const orgName = overrideOrgId && adminOrgs ? (adminOrgs.find((o:any)=>o.id === overrideOrgId)?.name || 'Nossa Organização') : (organization?.name || 'Nossa Organização');
    const text = encodeURIComponent(`Você foi convidado para entrar na organização ${orgName} na MillionsNest.\\n\\nAcesse: ${url}`);
    
    if (popup) {
      popup.location.href = `https://wa.me/?text=${text}`;
      setSuccessMsg(t('dashboard.invite.whatsapp_opened', 'WhatsApp aberto com o convite.'));
    } else {
      setFallbackLink(true);
      setErrorMsg(t('dashboard.invite.popup_blocked', 'O convite foi criado. Copie o link abaixo ou permita pop-ups para abrir o WhatsApp.'));
    }
  };

  const formDisabled = isLoading || !!createdInviteUrl;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0B0F19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#F5F7FA]">{t('dashboard.invite.title', 'Convidar uma pessoa')}</h2>
                <p className="text-[#A0A7B5] text-sm mt-1">{t('dashboard.invite.subtitle', 'Escolha a função e como deseja compartilhar o convite.')}</p>
              </div>
              <button 
                type="button"
                aria-label={t('dashboard.invite.close', 'Fechar')}
                onClick={onClose}
                className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A7B5] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAtLimit ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 animate-pulse">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-[#F5F7FA] font-medium mb-2">Limite de Membros Atingido</h3>
                <p className="text-[#A0A7B5] text-sm mb-6 px-4">
                  Sua organização está utilizando todas as <strong>{occupiedSlots}/{maxUsersLimit}</strong> vagas disponíveis no seu plano atual.
                </p>
                
                <div className="flex flex-col gap-3 w-full px-4">
                  <button 
                    type="button"
                    onClick={() => {
                      onUpgradeClick?.();
                      onClose();
                    }}
                    className="w-full py-3 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-xl transition-colors font-semibold text-sm shadow-lg shadow-[#2B85EB]/20"
                  >
                    Fazer Upgrade de Plano
                  </button>
                  <button 
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-[#F5F7FA] rounded-xl transition-colors font-medium text-sm"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : !canInvite ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-[#F5F7FA] font-medium mb-2">{t('dashboard.invite.access_denied', 'Acesso Negado')}</h3>
                <p className="text-[#A0A7B5] text-sm mb-6">{t('dashboard.invite.access_denied_description', 'Apenas administradores podem convidar novos membros para a organização.')}</p>
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 text-[#F5F7FA] rounded-xl transition-colors font-medium text-sm"
                >
                  Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                 {errorMsg && (
                    <div aria-live="polite" className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                       {errorMsg}
                    </div>
                 )}
                 {successMsg && !errorMsg && (
                    <div aria-live="polite" className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                       {successMsg}
                    </div>
                 )}
                 
                 {isGlobalAdmin ? (
                   <div className="space-y-4">
                     <p className="text-[#A0A7B5] text-xs px-2 -mt-2">
                       Você está criando um convite como administrador global. Escolha abaixo para qual organização deseja enviar este convite.
                     </p>
                     <div>
                       <label className="block text-sm font-medium text-[#A0A7B5] mb-2">Organização Alvo</label>
                       {loadingOrgs ? (
                          <div className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] opacity-50 flex items-center">
                             Carregando organizações...
                          </div>
                       ) : (
                          <select
                            value={overrideOrgId}
                            onChange={(e) => setOverrideOrgId(e.target.value)}
                            disabled={formDisabled}
                            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none disabled:opacity-50"
                          >
                            <option value="">(Usar organização atual do Dashboard)</option>
                            {adminOrgs.map((org: any) => (
                               <option key={org.id} value={org.id}>
                                  {org.name} ({org.id.substring(0,6)}...)
                               </option>
                            ))}
                          </select>
                       )}
                     </div>
                   </div>
                 ) : null}
                 
                <div>
                  <label className="block text-sm font-medium text-[#A0A7B5] mb-2">{t('dashboard.invite.email_label', 'E-mail da pessoa')} <span className="text-[#A0A7B5]/50 text-xs">{t('dashboard.invite.email_hint', 'Use o e-mail que a pessoa usará para entrar. O convite ficará protegido para essa conta.')}</span></label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                       setEmail(e.target.value);
                       setErrorMsg('');
                    }}
                    disabled={formDisabled}
                    placeholder="email@exemplo.com"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none placeholder:text-white/20 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#A0A7B5] mb-2">{t('dashboard.invite.role_label', 'Qual será a função dessa pessoa?')}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "admin" | "member")}
                    disabled={formDisabled}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none disabled:opacity-50"
                  >
                    <option value="admin">{t('dashboard.invite.role_admin', 'Administrador')}</option>
                    <option value="member">{t('dashboard.invite.role_member', 'Membro')}</option>
                  </select>
                  <p className="text-[#A0A7B5]/70 text-xs mt-2 px-1">
                     {t('dashboard.invite.role_explanation', 'Esta função define o acesso à organização. Funções ministeriais, como líder, músico ou vocal, são configuradas dentro do MusicScale.')}
                  </p>
                </div>
                
                {fallbackLink && createdInviteUrl && (
                  <div>
                    <label className="block text-sm font-medium text-[#A0A7B5] mb-2">{t('dashboard.invite.manual_link_label', 'Link do convite')}</label>
                    <input
                      type="text"
                      readOnly
                      value={createdInviteUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] opacity-80 cursor-text"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-[#A0A7B5] mb-2">{t('dashboard.invite.share_method', 'Como deseja enviar?')}</label>
                  <div className="gap-3 grid grid-cols-2">
                    <button
                      type="button"
                      onClick={onWhatsApp}
                      disabled={isLoading}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 rounded-xl transition-colors text-[#10B981] disabled:opacity-50"
                    >
                      {isLoading && !copiedLink ? <Loader2 className="w-6 h-6 animate-spin" /> : <MessageCircle className="w-6 h-6" />}
                      <span className="text-sm font-medium">{t('dashboard.invite.whatsapp', 'Enviar pelo WhatsApp')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onCopy}
                      disabled={isLoading}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-[#F5F7FA] disabled:opacity-50"
                    >
                      {isLoading && !copiedLink ? <Loader2 className="w-6 h-6 animate-spin" /> : copiedLink ? <Check className="w-6 h-6 text-[#10B981]" /> : <Copy className="w-6 h-6" />}
                      <span className="text-sm font-medium">{copiedLink ? t('dashboard.invite.link_copied', 'Link copiado') : t('dashboard.invite.copy_link', 'Copiar link')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
"""

with open('src/components/InviteModal.tsx', 'w') as f:
    f.write(new_content)

print("InviteModal patched successfully")
