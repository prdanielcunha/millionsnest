import React, { useState } from 'react';
import { Building2, Users, LayoutGrid, CreditCard, ShieldCheck, Settings, Check, X, Loader2, Link, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type OrgTab = 'settings' | 'members' | 'apps' | 'roles' | 'billing' | 'audit';

export function OrganizationManager({ 
  organization, 
  members, 
  currentUserPerms, 
  user,
  profile,
  onSaveOrg,
  handleUpdateMemberRole,
  isEditingOrg,
  setIsEditingOrg,
  orgNameInput,
  setOrgNameInput,
  savingOrg,
  handleInviteWhatsapp,
  handleCopyLink,
  copiedLink,
  auditLogs,
  setActiveDashboardTab
}: any) {
  const [activeTab, setActiveTab] = useState<OrgTab>('settings');

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
                 <div className="bg-[#050505] p-5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Perfil Principal</p>
                    
                    <div className="flex items-start gap-5">
                       <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-2xl text-[#F5F7FA]">
                         {organization?.logo ? <img src={organization.logo} className="w-full h-full rounded-xl object-cover" /> : organization?.name?.charAt(0) || 'O'}
                       </div>
                       <div className="flex-1">
                          <p className="text-xs font-semibold text-[#F5F7FA] mb-1.5">Mudar Logotipo</p>
                          <div className="flex items-center gap-2">
                             <input type="file" className="text-xs text-[#A0A7B5] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-[#F5F7FA] hover:file:bg-white/20 transition-all cursor-pointer" />
                          </div>
                       </div>
                    </div>
                    
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-[#A0A7B5] mb-2">Nome Oficial</p>
                      {isEditingOrg ? (
                        <div className="flex items-center gap-2">
                          <input 
                            title="Nome"
                            type="text" 
                            value={orgNameInput} 
                            onChange={(e) => setOrgNameInput(e.target.value)} 
                            className="bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] transition-colors w-full"
                          />
                          <button disabled={savingOrg} onClick={onSaveOrg} className="p-2 bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl">
                            {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button disabled={savingOrg} onClick={() => { setIsEditingOrg(false); setOrgNameInput(organization.name); }} className="p-2 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2">
                          <p className="text-sm font-medium text-[#F5F7FA]">{organization?.name}</p>
                          <button onClick={() => setIsEditingOrg(true)} className="text-xs font-medium text-[#2B85EB]">Editar</button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold text-[#A0A7B5] mb-2">Slug (URL Público)</p>
                      <div className="flex items-center gap-2 bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2">
                        <span className="text-sm text-[#A0A7B5]">nest.app/</span>
                        <input 
                           type="text" 
                           value={organization?.slug || ''}
                           placeholder="sua-organizacao"
                           className="bg-transparent text-sm text-[#F5F7FA] outline-none focus:border-none flex-1"
                           disabled
                        />
                      </div>
                      <p className="text-[10px] text-[#A0A7B5] mt-2">Em breve: defina um slug amigável para acessos públicos.</p>
                    </div>
                 </div>
                 
                 <div className="bg-[#050505] p-5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-4">Identificador Único</p>
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-mono text-[#A0A7B5] bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-white/5 select-all">{organization?.id || user.uid}</span>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                 <h3 className="text-lg font-semibold text-[#F5F7FA]">Membros & Convites</h3>
                 
                 <div className="flex items-center gap-3 bg-[#050505] p-1.5 rounded-xl border border-white/5">
                    <select
                      id="invite-role"
                      className="bg-transparent text-[#F5F7FA] text-xs font-medium pl-2 outline-none border-r border-white/10 pr-2 py-1"
                    >
                      <option value="member">Membro Padrão</option>
                      <option value="admin">Administrador</option>
                      <option value="secretary">Operador</option>
                      <option value="guest">Visitante</option>
                    </select>
                    <button onClick={() => {
                        const role = (document.getElementById('invite-role') as HTMLSelectElement).value;
                        const orgId = profile?.organizationId || user?.uid;
                        const link = `${window.location.origin}/login?org=${orgId}&role=${role}`;
                        const text = encodeURIComponent(`Olá! Quero te convidar para acessar nossa organização no ecossistema MillionsNest.\n\nAcesse: ${link}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                    }} className="flex items-center gap-2 px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] rounded-lg hover:bg-[#10B981]/20 transition-colors border border-[#10B981]/20 text-xs font-medium">
                      <Link className="w-3.5 h-3.5" /> Invite
                    </button>
                    <button onClick={() => {
                        const role = (document.getElementById('invite-role') as HTMLSelectElement).value;
                        const orgId = profile?.organizationId || user?.uid;
                        const link = `${window.location.origin}/login?org=${orgId}&role=${role}`;
                        navigator.clipboard.writeText(link);
                        handleCopyLink();
                    }} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-[#F5F7FA] rounded-lg hover:bg-white/10 transition-colors border border-white/10 text-xs font-medium">
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />} {copiedLink ? 'Copiado!' : 'Copiar'}
                    </button>
                 </div>
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
                            className="bg-[#0B0F19] border border-white/10 text-[#F5F7FA] text-xs font-medium rounded-lg px-3 py-1.5 outline-none focus:border-[#2B85EB]"
                          >
                            <option value="owner">Dono (Owner)</option>
                            <option value="admin">Administrador</option>
                            <option value="secretary">Operador / Secretaria</option>
                            <option value="member">Membro Padrão</option>
                            <option value="guest">Visitante (Leitura)</option>
                          </select>
                        </div>
                      ) : (
                         <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB]">
                            {{owner: 'Dono', admin: 'Admin', secretary: 'Operador', member: 'Membro', guest: 'Visitante'}[(member.role as string) || 'member'] || member.role || 'Membro'}
                         </span>
                      )}
                    </div>
                  ))}
               </div>
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
                <h3 className="text-lg font-semibold text-[#F5F7FA] mb-6">Apps & Módulos Instalados</h3>
                
                <div className="bg-[#050505] rounded-2xl border border-white/5 p-4 flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/20 flex items-center justify-center text-[#2B85EB]">
                         <LayoutGrid className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="text-sm font-semibold text-[#F5F7FA]">MusicScale - Flagship</p>
                         <p className="text-xs text-[#A0A7B5]">Módulo original do ecossistema</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-[#10B981]/10 text-[#10B981] rounded-md border border-[#10B981]/20">Instalado</span>
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
                      <p className="p-8 text-center text-sm font-medium text-[#A0A7B5]">Nenhuma atividade administrativa recente.</p>
                   )}
                </div>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
