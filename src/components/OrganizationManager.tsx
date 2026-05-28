import React, { useState } from 'react';
import { Building2, Users, LayoutGrid, CreditCard, ShieldCheck, Settings, Check, X, Loader2, Link, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumEmptyState } from '../packages/ui/empty-state.js';
import { framerTokens } from '../packages/ui/motion.js';

type OrgTab = 'settings' | 'members' | 'apps' | 'roles' | 'billing' | 'audit';

export function OrganizationManager({ 
  organization, 
  members, 
  currentUserPerms, 
  currentUserRole,
  user,
  profile,
  onSaveOrg,
  handleUpdateMemberRole,
  handleRemoveMember,
  isEditingOrg,
  setIsEditingOrg,
  orgNameInput,
  setOrgNameInput,
  savingOrg,
  handleCreateInvite,
  handleRevokeInvite,
  pendingInvites = [],
  copiedLink,
  auditLogs,
  setActiveDashboardTab,
  initialTab,
  onOpenInviteModal
}: any) {
  const [activeTab, setActiveTabInternal] = useState<OrgTab>((initialTab as OrgTab) || 'settings');

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
    { id: 'apps', label: 'Aplicativos & Ad-ons', icon: LayoutGrid, perms: ['organization.apps.manage'] },
    { id: 'billing', label: 'Assinatura', icon: CreditCard, perms: ['organization.billing.manage'] },
    { id: 'audit', label: 'Auditoria e Logs', icon: Settings, perms: ['organization.audit.view'] }
  ];

  const visibleTabs = TABS.filter(t => t.perms.some(p => currentUserPerms[p] || profile?.systemRole === 'ceo' || profile?.systemRole === 'admin'));

  return (
    <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 lg:p-8 border border-white/5 shadow-2xl flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3 mb-6 px-4">
           <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
            <Building2 className="w-4 h-4 text-[#A0A7B5]" />
          </span>
          Governança
        </h2>
        
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
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
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border ${isActive ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20 shadow-sm' : 'bg-transparent text-[#A0A7B5] border-transparent hover:bg-white/5 hover:text-[#F5F7FA]'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="text-lg font-semibold text-[#F5F7FA] mb-6">Ajustes da Organização</h3>
              
              <div className="space-y-6 max-w-xl">
                  <div className="bg-transparent p-0 rounded-none border-none">
                     <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Perfil Principal</p>
                     
                     <div className="flex items-start gap-5 bg-[#050505] p-5 rounded-2xl border border-white/5 mb-6">
                        <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-2xl text-[#F5F7FA]">
                          {organization?.logo ? <img src={organization.logo} className="w-full h-full rounded-xl object-cover" /> : organization?.name?.charAt(0) || 'O'}
                        </div>
                        <div className="flex-1">
                           <p className="text-xs font-semibold text-[#F5F7FA] mb-1.5">Mudar Logotipo</p>
                           <div className="flex items-center gap-2">
                              <input type="file" className="text-xs text-[#A0A7B5] file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-[#F5F7FA] hover:file:bg-white/10 transition-all cursor-pointer" />
                           </div>
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                       <div>
                         <p className="text-xs font-semibold text-[#A0A7B5] mb-1.5">Nome Oficial</p>
                         {isEditingOrg ? (
                           <div className="flex items-center gap-2">
                             <input 
                               title="Nome"
                               type="text" 
                               value={orgNameInput} 
                               onChange={(e) => setOrgNameInput(e.target.value)} 
                               className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] focus:ring-1 focus:ring-[#2B85EB]/50 transition-all w-full"
                             />
                             <button disabled={savingOrg} onClick={onSaveOrg} className="p-2.5 bg-[#2B85EB] hover:bg-[#2B85EB]/80 text-white rounded-xl transition-colors">
                               {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                             </button>
                             <button disabled={savingOrg} onClick={() => { setIsEditingOrg(false); setOrgNameInput(organization.name); }} className="p-2.5 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors">
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                         ) : (
                           <div className="flex items-center justify-between bg-[#050505] border border-white/5 rounded-xl px-4 py-3">
                             <p className="text-sm font-medium text-[#F5F7FA]">{organization?.name}</p>
                             <button onClick={() => setIsEditingOrg(true)} className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[#F5F7FA] transition-colors">Editar</button>
                           </div>
                         )}
                       </div>

                       <div>
                         <p className="text-xs font-semibold text-[#A0A7B5] mb-1.5">Slug (URL Público)</p>
                         <div className="flex items-center gap-2 bg-[#050505] border border-white/5 rounded-xl px-4 py-3 opacity-70">
                           <span className="text-sm text-[#A0A7B5]">nest.app/</span>
                           <input 
                              type="text" 
                              value={organization?.slug || ''}
                              placeholder="sua-organizacao"
                              className="bg-transparent text-sm text-[#F5F7FA] outline-none focus:border-none flex-1"
                              disabled
                           />
                         </div>
                       </div>
                     </div>
                  </div>
                  
                  <div className="bg-transparent pt-6 border-t border-white/5">
                     <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Identificador Único</p>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#A0A7B5] bg-[#050505] px-3 py-2 rounded-xl border border-white/5 select-all">{organization?.id || user.uid}</span>
                     </div>
                  </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                 <h3 className="text-lg font-semibold text-[#F5F7FA]">Membros & Convites</h3>
                 
                 {(currentUserRole === 'owner' || currentUserRole === 'admin' || profile?.systemRole === 'ceo') && (
                   <div className="flex items-center gap-3">
                     <button onClick={onOpenInviteModal} className="flex items-center gap-2 px-4 py-2 bg-[#F5F7FA] text-[#050505] rounded-xl hover:bg-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                       Convidar Membro
                     </button>
                   </div>
                 )}
               </div>
               
               <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                  {members.map((member: any, i: number) => (
                    <div key={member.id} className={`flex items-center justify-between p-4 ${i !== members.length - 1 ? 'border-b border-white/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-[#F5F7FA]">
                          {member.photoURL ? <img src={member.photoURL} className="w-full h-full rounded-xl object-cover" /> : member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#F5F7FA] flex items-center gap-2">
                            {member.displayName || 'Usuário'} {member.id === user?.uid && '(Você)'}
                          </span>
                          <span className="text-xs text-[#A0A7B5]">{member.email}</span>
                        </div>
                      </div>
                      
                      {currentUserPerms['organization.roles.manage'] ? (
                        <div className="flex items-center gap-3">
                          <select
                            value={member.role || 'member'}
                            onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                            disabled={
                               // Cannot edit yourself if you are an owner, it could break org access until someone else is owner
                               (member.id === user?.uid && member.role === 'owner') ||
                               // Admins cannot change owner role
                               (member.role === 'owner' && currentUserRole !== 'owner' && profile?.systemRole !== 'ceo' && profile?.systemRole !== 'global_admin')
                            }
                            className={`bg-[#0B0F19] border border-white/10 text-[#F5F7FA] text-xs font-medium rounded-lg px-3 py-1.5 outline-none focus:border-[#2B85EB] disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {(currentUserRole === 'owner' || profile?.systemRole === 'ceo' || profile?.systemRole === 'global_admin' || member.role === 'owner') && <option value="owner">Dono (Owner)</option>}
                            <option value="admin">Administrador</option>
                            <option value="leader">Líder</option>
                            <option value="secretary">Operador / Secretaria</option>
                            <option value="member">Membro Padrão</option>
                            <option value="guest">Visitante (Leitura)</option>
                          </select>
                          
                          {(currentUserRole === 'owner' || currentUserRole === 'admin' || profile?.systemRole === 'ceo') && (
                            <button
                               onClick={() => handleRemoveMember(member.id)}
                               disabled={member.role === 'owner' && (currentUserRole !== 'owner' && profile?.systemRole !== 'ceo')}
                               className="text-xs text-red-500/70 hover:text-red-500 font-medium px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                               {member.id === user?.uid ? 'Sair' : 'Remover'}
                            </button>
                          )}
                        </div>
                      ) : (
                         <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB]">
                            {{owner: 'Dono', admin: 'Admin', leader: 'Líder', secretary: 'Operador', member: 'Membro', guest: 'Visitante'}[(member.role as string) || 'member'] || member.role || 'Membro'}
                         </span>
                      )}
                    </div>
                  ))}
               </div>

               {pendingInvites && pendingInvites.length > 0 && (
                 <div className="mt-8">
                   <h4 className="text-sm font-semibold text-[#A0A7B5] mb-4 uppercase tracking-wider">Convites Pendentes</h4>
                   <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                     {pendingInvites.map((invite: any, i: number) => {
                       const isExpired = invite.status === 'pending' && invite.expiresAt && invite.expiresAt.toMillis && invite.expiresAt.toMillis() < Date.now();
                       const isOld = invite.status === 'pending' && invite.createdAt && invite.createdAt.toMillis && (Date.now() - invite.createdAt.toMillis() > 7 * 24 * 60 * 60 * 1000);
                       const showAsExpired = isExpired || isOld;
                       return (
                       <div key={invite.id} className={`flex items-center justify-between p-4 ${i !== pendingInvites.length - 1 ? 'border-b border-white/5' : ''}`}>
                         <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                             <span className="text-sm font-semibold text-[#F5F7FA] flex items-center gap-2">
                               Status: <span className={showAsExpired ? "text-red-400" : "text-[#10B981]"}>{showAsExpired ? 'Expirado' : 'Aguardando'}</span>
                             </span>
                             <span className="text-xs text-[#A0A7B5]">Função: {{owner: 'Dono', admin: 'Admin', leader: 'Líder', secretary: 'Operador', member: 'Membro', guest: 'Visitante'}[(invite.role as string) || 'member'] || invite.role || 'Membro'}</span>
                           </div>
                         </div>
                         
                         {(currentUserRole === 'owner' || currentUserRole === 'admin' || profile?.systemRole === 'ceo') && (
                           <button onClick={() => handleRevokeInvite(invite.id)} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 bg-red-500/10 rounded-lg">
                             Revogar
                           </button>
                         )}
                       </div>
                       );
                     })}
                   </div>
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'roles' && (
             <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-2">Cargos e Capabilities</h3>
                <p className="text-sm text-[#A0A7B5] mb-6">MillionsNest usa um sistema hierárquico baseado em capacidades (capabilities). Veja os perfis atuais:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-[#050505] p-5 rounded-2xl border border-[#2B85EB]/20 shadow-[0_0_15px_rgba(43,133,235,0.05)]">
                      <h4 className="text-[#F5F7FA] font-medium flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-[#2B85EB]" /> Dono (Owner) & Admin</h4>
                      <p className="text-xs text-[#A0A7B5] mb-3">Têm acesso a todas as capacidades de governança e aplicativos habilitados na organização.</p>
                      <div className="flex flex-wrap gap-1.5">
                         <span className="px-1.5 py-0.5 bg-white/5 text-[9px] text-[#A0A7B5] rounded border border-white/10 font-mono">*.manage</span>
                         <span className="px-1.5 py-0.5 bg-white/5 text-[9px] text-[#A0A7B5] rounded border border-white/10 font-mono">*.edit</span>
                      </div>
                   </div>
                   <div className="bg-[#050505] p-5 rounded-2xl border border-white/5">
                      <h4 className="text-[#F5F7FA] font-medium flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-[#A0A7B5]" /> Operador (Secretary)</h4>
                      <p className="text-xs text-[#A0A7B5] mb-3">Pode convidar membros e gerenciar dados nos aplicativos, mas não altera políticas ou pagamentos.</p>
                      <div className="flex flex-wrap gap-1.5">
                         <span className="px-1.5 py-0.5 bg-white/5 text-[9px] text-[#A0A7B5] rounded border border-white/10 font-mono">organization.members.invite</span>
                         <span className="px-1.5 py-0.5 bg-white/5 text-[9px] text-[#A0A7B5] rounded border border-white/10 font-mono">musicscale.*.edit</span>
                      </div>
                   </div>
                   <div className="bg-[#050505] p-5 rounded-2xl border border-white/5">
                      <h4 className="text-[#F5F7FA] font-medium flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-[#A0A7B5]" /> Membro Padrão</h4>
                      <p className="text-xs text-[#A0A7B5] mb-3">Acesso restrito. Só interage com dados relacionados e delegados a ele na interface pública, sem acesso administrativo aos módulos.</p>
                   </div>
                </div>
             </motion.div>
          )}

          {activeTab === 'apps' && (
             <motion.div key="apps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-6">Aplicativos & Ad-ons</h3>
                <p className="text-sm text-[#A0A7B5] mb-6">Gerencie os módulos ativados na sua organização.</p>
                
                <div className="bg-[#050505] rounded-2xl border border-white/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/20 flex items-center justify-center text-[#2B85EB] shadow-[0_0_15px_rgba(43,133,235,0.1)]">
                         <LayoutGrid className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="font-semibold text-[#F5F7FA]">MusicScale <span className="text-[10px] ml-2 font-bold uppercase tracking-widest bg-[#10B981]/10 text-[#10B981] rounded px-1.5 py-0.5 border border-[#10B981]/20">Instalado</span></p>
                         <p className="text-sm text-[#A0A7B5]">Módulo original do ecossistema</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => {
                        import('../packages/events/index.js').then(({ eventBus }) => {
                          eventBus.publish('action.contextual.open_musicscale', {});
                        });
                      }} className="px-5 py-2 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold text-sm hover:bg-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                         Abrir App
                      </button>
                      <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-[#A0A7B5] hover:bg-white/10 transition-colors border border-white/10">
                         <Settings className="w-4 h-4" />
                      </button>
                   </div>
                </div>
                
                {organization?.enabledApps?.filter((a: string) => a !== 'musicscale').map((appId: string) => (
                   <div key={appId} className="bg-[#050505] rounded-2xl border border-white/5 p-4 flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F5F7FA]">
                         <LayoutGrid className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="text-sm font-semibold text-[#F5F7FA] uppercase">{appId}</p>
                         <p className="text-xs text-[#A0A7B5]">Módulo terceirizado instalado via plano</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/5 text-[#A0A7B5] rounded-md border border-white/10">Habilitado</span>
                      <button className="text-xs text-[#EF4444] font-medium ml-2">Desativar</button>
                   </div>
                </div>
                ))}
             </motion.div>
          )}

          {activeTab === 'audit' && (
             <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-6">Registro de Auditoria</h3>
                
                <div className="bg-[#050505] rounded-2xl border border-white/5 overflow-hidden">
                   {auditLogs.length > 0 ? auditLogs.map((log: any, index: number) => (
                      <div key={log.id} className={`p-4 flex gap-4 ${index !== auditLogs.length -1 ? 'border-b border-white/5' : ''}`}>
                         <div className="w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5">
                            <Settings className="w-4 h-4 text-[#A0A7B5]" />
                         </div>
                         <div>
                            <p className="text-sm text-[#F5F7FA] mb-1">{log.action}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#A0A7B5] font-mono">
                               <span>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Sem data'}</span>
                               <span>Actor: {log.actorUid || 'Sistema'}</span>
                               {log.metadata && <span>Target: {JSON.stringify(log.metadata)}</span>}
                            </div>
                         </div>
                      </div>
                   )) : (
                      <div className="py-2">
                        <PremiumEmptyState 
                          icon={<ShieldCheck className="w-6 h-6" />}
                          title="Auditoria Limpa"
                          description="Nenhuma atividade administrativa recente na organização."
                        />
                      </div>
                   )}
                </div>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
