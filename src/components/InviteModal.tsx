import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganization } from '../contexts/OrganizationContext.js';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleCreateInvite: (role: string, method: 'whatsapp' | 'copy', email?: string, overrideOrgId?: string) => Promise<void>;
  loading?: boolean;
  isAtLimit?: boolean;
  occupiedSlots?: number;
  maxUsersLimit?: number;
  onUpgradeClick?: () => void;
}

export function InviteModal({ 
  isOpen, 
  onClose, 
  handleCreateInvite, 
  loading = false,
  isAtLimit = false,
  occupiedSlots = 0,
  maxUsersLimit = 10,
  onUpgradeClick
}: InviteModalProps) {
  const [role, setRole] = useState('member');
  const [email, setEmail] = useState('');
  const [overrideOrgId, setOverrideOrgId] = useState('');
  const [adminOrgs, setAdminOrgs] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { profile, user } = useAuth();
  
  const canInvite = profile?.systemRole === 'ceo' || profile?.systemRole === 'admin' || profile?.systemRole === 'global_admin' || 
                    profile?.organizationRole === 'owner' || profile?.organizationRole === 'admin';

  useEffect(() => {
    if (isOpen && (profile?.systemRole === 'ceo' || profile?.systemRole === 'admin')) {
      setLoadingOrgs(true);
      user?.getIdToken().then(token => {
        fetch('/api/admin/organizations', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
           if (Array.isArray(data)) setAdminOrgs(data);
        })
        .catch(console.error)
        .finally(() => setLoadingOrgs(false));
      });
    }
  }, [isOpen, profile, user]);

  const onCopy = async () => {
    setIsGenerating(true);
    await handleCreateInvite(role, 'copy', email.trim() || undefined, overrideOrgId || undefined);
    setIsGenerating(false);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const onWhatsApp = async () => {
    setIsGenerating(true);
    await handleCreateInvite(role, 'whatsapp', email.trim() || undefined, overrideOrgId || undefined);
    setIsGenerating(false);
  };

  const isLoading = loading || isGenerating;

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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#F5F7FA]">Criar Link de Acesso</h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[#A0A7B5] transition-colors"
              >
                <X className="w-4 h-4" />
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
                    onClick={() => {
                      onUpgradeClick?.();
                      onClose();
                    }}
                    className="w-full py-3 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-xl transition-colors font-semibold text-sm shadow-lg shadow-[#2B85EB]/20"
                  >
                    Fazer Upgrade de Plano
                  </button>
                  <button 
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
                <h3 className="text-[#F5F7FA] font-medium mb-2">Acesso Negado</h3>
                <p className="text-[#A0A7B5] text-sm mb-6">Apenas administradores podem convidar novos membros para a organização.</p>
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 text-[#F5F7FA] rounded-xl transition-colors font-medium text-sm"
                >
                  Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                 {profile?.systemRole === 'ceo' || profile?.systemRole === 'admin' ? (
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
                            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none"
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
                  <label className="block text-sm font-medium text-[#A0A7B5] mb-2">E-mail do convidado <span className="text-[#A0A7B5]/50 text-xs">(Opcional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none placeholder:text-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#A0A7B5] mb-2">Função Inicial</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-[#F5F7FA] focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all outline-none"
                  >
                    <option value="admin">Administrador</option>
                    <option value="leader">Líder</option>
                    <option value="member">Membro</option>
                  </select>
                </div>

                <div className="gap-3 grid grid-cols-2">
                  <button
                    onClick={onWhatsApp}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 rounded-xl transition-colors text-[#10B981]"
                  >
                    {isLoading && !copiedLink ? <Loader2 className="w-6 h-6 animate-spin" /> : <MessageCircle className="w-6 h-6" />}
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>
                  <button
                    onClick={onCopy}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-[#F5F7FA]"
                  >
                    {isLoading && !copiedLink ? <Loader2 className="w-6 h-6 animate-spin" /> : copiedLink ? <Check className="w-6 h-6 text-[#10B981]" /> : <Copy className="w-6 h-6" />}
                    <span className="text-sm font-medium">{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
