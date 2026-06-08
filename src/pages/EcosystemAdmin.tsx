import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "../contexts/AuthContext.js";
import { Shield, Users, Search, AlertCircle, Building, Check, Loader2, User, TrendingUp, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EcosystemShell } from "../components/EcosystemShell.js";
import { canChangeSystemRole } from "../lib/roleResolver.js";

function resolveUserOrganizationContextLocal(
  userId: string,
  userData: any,
  organizations: any[]
) {
  if (!userId) return { hasOrganization: false, organizations: [], inconsistencies: [], needsRepair: false, activeOrgs: [], primaryOrg: null, activeOrg: null };

  const finalOrgs: any[] = [];
  const foundIds = new Set<string>();

  organizations.forEach(org => {
    const isOwner = org.ownerUserId === userId || org.ownerUid === userId || org.ownerId === userId;
    if (isOwner) {
      if (!foundIds.has(org.id)) {
        foundIds.add(org.id);
        finalOrgs.push(org);
      }
    }
  });

  if (userData) {
    const fields = [userData.activeOrganizationId, userData.primaryOrganizationId, userData.organizationId];
    fields.forEach(id => {
      if (id && typeof id === 'string') {
        const org = organizations.find(o => o.id === id);
        if (org && !foundIds.has(id)) {
          foundIds.add(id);
          finalOrgs.push(org);
        }
      }
    });

    if (Array.isArray(userData.organizations)) {
      userData.organizations.forEach((id: any) => {
        if (id && typeof id === 'string') {
          const org = organizations.find(o => o.id === id);
          if (org && !foundIds.has(id)) {
            foundIds.add(id);
            finalOrgs.push(org);
          }
        }
      });
    }
  }

  const activeOrgs = finalOrgs.filter(o => o.status !== 'archived');

  let activeId = userData?.activeOrganizationId || null;
  let primaryId = userData?.primaryOrganizationId || null;
  let legacyId = userData?.organizationId || null;

  let activeOrg = activeOrgs.find(o => o.id === activeId) || null;
  let primaryOrg = activeOrgs.find(o => o.id === primaryId) || null;
  let legacyOrg = activeOrgs.find(o => o.id === legacyId) || null;

  const resolvedPrimary = primaryOrg || activeOrg || legacyOrg || activeOrgs[0] || null;
  const resolvedActive = activeOrg || resolvedPrimary || null;

  const inconsistencies: string[] = [];
  let needsRepair = false;

  if (activeOrgs.length > 0) {
    if (!primaryId) {
      needsRepair = true;
      inconsistencies.push('Vínculo primário canonical (primaryOrganizationId) ausente.');
    }
    if (!activeId) {
      needsRepair = true;
      inconsistencies.push('Vínculo ativo canonical (activeOrganizationId) ausente.');
    }
    if (legacyId !== resolvedActive?.id) {
      needsRepair = true;
      inconsistencies.push(`userData.organizationId legado está de-sincronizado.`);
    }
  }

  return {
    organizations: finalOrgs,
    activeOrgs,
    primaryOrg: resolvedPrimary,
    activeOrg: resolvedActive,
    hasOrganization: activeOrgs.length > 0,
    needsRepair,
    inconsistencies
  };
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24"
      height="24"
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

export function EcosystemAdmin() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'users' | 'organizations' | 'analytics'>('users');
  const [diagnosticOrg, setDiagnosticOrg] = useState<any>(null);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);

  const [isExecutingRepair, setIsExecutingRepair] = useState(false);
  const [createOrgModalUser, setCreateOrgModalUser] = useState<any | null>(null);
  const [createOrgName, setCreateOrgName] = useState("");
  const [renameOrgModal, setRenameOrgModal] = useState<any | null>(null);
  const [renameOrgName, setRenameOrgName] = useState("");

  // Diagnostics and repair states
  const [diagnosticsModalUser, setDiagnosticsModalUser] = useState<any | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [selectedMainOrgId, setSelectedMainOrgId] = useState<string>("");
  const [movingFromOrgId, setMovingFromOrgId] = useState<string>("");
  const [movingToOrgId, setMovingToOrgId] = useState<string>("");

  const fetchDiagnostics = async (targetUser: any) => {
    setLoadingDiagnostics(true);
    setDiagnosticsData(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${targetUser.id}/diagnostics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Erro ao carregar diagnósticos");
      const data = await res.json();
      setDiagnosticsData(data);
      if (data.primaryOrganizationId) {
        setSelectedMainOrgId(data.primaryOrganizationId);
      } else if (data.organizations?.length > 0) {
        setSelectedMainOrgId(data.organizations[0].id);
      }
    } catch (e: any) {
      customAlert("Erro", "Erro ao carregar dados de diagnóstico: " + e.message, "error");
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleSetPrimaryOrg = async (orgId: string) => {
    if (!diagnosticsModalUser) return;
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${diagnosticsModalUser.id}/set-primary-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ organizationId: orgId })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erro ao definir principal");
      }
      customAlert("Sucesso", "Organização principal definida de forma canônica com sucesso!", "success");
      await fetchDiagnostics(diagnosticsModalUser);
      loadEcosystemData();
    } catch (e: any) {
      customAlert("Erro", "Erro ao processar: " + e.message, "error");
    } finally {
      setIsExecutingRepair(false);
    }
  };

  const handleArchiveOrDeleteOrg = async (orgId: string, action: 'archive' | 'delete') => {
    if (!diagnosticsModalUser) return;
    try {
      const token = await user?.getIdToken();
      const checkRes = await fetch(`/api/admin/organizations/${orgId}/check-empty`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!checkRes.ok) throw new Error("Erro ao checar dados da organização");
      const checkData = await checkRes.json();

      const label = action === 'archive' ? 'ARQUIVAR' : 'EXCLUIR PERMANENTEMENTE';
      const warningMessage = `Tem certeza que deseja ${label} a organização "${checkData.orgName}"?\n\n` +
        `• Músicas de Produção: ${checkData.songsCount}\n` +
        `• Escalas de Produção: ${checkData.scalesCount}\n` +
        `• Membros Cadastrados: ${checkData.membersCount}\n` +
        `• Convites Ativos: ${checkData.invitesCount}\n` +
        `${checkData.hasActiveSubscription ? '⚠️ AVISO CRÍTICO: Esta organização possui faturamento ativo no Stripe!' : ''}\n\n` +
        (checkData.isSafeToArchive ? 'Esta organização está vazia e é segura para arquivamento ou exclusão.' : '⚠️ AVISO IMPORTANTE: Contém dados de produção e ativos criados pelos usuários! É altamente sugerido mover ou transferir os dados primeiro!');

      customConfirm(warningMessage, async () => {
        setIsExecutingRepair(true);
        try {
          const res = await fetch(`/api/admin/organizations/${orgId}/archive-or-delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action })
          });
          if (!res.ok) throw new Error("Erro ao realizar ação");
          customAlert("Sucesso", `Organização ${action === 'archive' ? 'arquivada' : 'excluída'} com sucesso!`, "success");
          await fetchDiagnostics(diagnosticsModalUser);
          loadEcosystemData();
        } catch (err: any) {
          customAlert("Erro", err.message, "error");
        } finally {
          setIsExecutingRepair(false);
        }
      });
    } catch (e: any) {
      customAlert("Erro", e.message, "error");
    }
  };

  const handleMoveOrgData = async (fromOrgId: string, toOrgId: string) => {
    if (!fromOrgId || !toOrgId) return;
    if (fromOrgId === toOrgId) {
      customAlert("Aviso", "As organizações de origem e destino devem ser diferentes.", "error");
      return;
    }
    
    customConfirm(`Deseja mover as Músicas e Escalas vinculadas de forma definitiva? Isso migrará todos os ativos com segurança.`, async () => {
      setIsExecutingRepair(true);
      try {
        const token = await user?.getIdToken();
        const res = await fetch(`/api/admin/organizations/${fromOrgId}/move-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ toOrgId })
        });
        if (!res.ok) throw new Error("Erro ao mover os dados");
        const resData = await res.json();
        customAlert("Sucesso", `Dados transferidos com sucesso! Músicas migradas: ${resData.movedSongs}, Escalas migradas: ${resData.movedScales}.`, "success");
        await fetchDiagnostics(diagnosticsModalUser);
        loadEcosystemData();
      } catch (err: any) {
        customAlert("Erro", err.message, "error");
      } finally {
        setIsExecutingRepair(false);
      }
    });
  };

  const customConfirm = (message: string, onConfirm: () => void) => {
    setConfirmAction({ message, onConfirm });
  };

  const customAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage({ title, message, type });
  };

  const handleCreateOrganizationSubmit = async (confirmedAdditional: boolean = false) => {
    if (!createOrgModalUser) return;
    if (!createOrgName.trim()) {
      customAlert("Erro", "O nome da organização não pode ficar vazio.", "error");
      return;
    }
    
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${createOrgModalUser.id}/create-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          organizationName: createOrgName.trim(),
          confirmCreateAdditional: confirmedAdditional
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresExplicitConfirmation) {
          setIsExecutingRepair(false);
          customConfirm(
            "Este usuário já possui uma organização ativa vinculada. Deseja realmente criar uma organização adicional para ele?",
            () => handleCreateOrganizationSubmit(true)
          );
          return;
        }
        throw new Error(data.message || data.error || "Falha ao criar organização");
      }
      customAlert("Sucesso", "Organização criada com sucesso!", "success");
      setCreateOrgModalUser(null);
      loadEcosystemData();
    } catch (e: any) {
      customAlert("Erro", "Erro ao criar organização: " + e.message, "error");
    } finally {
      setIsExecutingRepair(false);
    }
  };

  const handleRenameOrganizationSubmit = async (orgId: string, newName: string) => {
    if (!newName.trim()) {
      customAlert("Erro", "O nome da organização não pode ficar vazio.", "error");
      return;
    }

    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${orgId}/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newName: newName.trim() })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao renomear organização");
      }
      customAlert("Sucesso", "Organização renomeada com sucesso!", "success");
      setRenameOrgModal(null);
      if (diagnosticOrg?.id === orgId) {
        setDiagnosticOrg({ ...diagnosticOrg, name: newName.trim() });
      }
      loadEcosystemData();
    } catch (e: any) {
      customAlert("Erro", "Erro ao renomear organização: " + e.message, "error");
    } finally {
      setIsExecutingRepair(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!['ceo', 'admin', 'global_admin'].includes(profile?.systemRole || '')) {
        navigate('/dashboard');
      } else {
        loadEcosystemData();
      }
    }
  }, [loading, profile, navigate]);

  const loadEcosystemData = async () => {
    try {
      if (!user) return;
      const idToken = await user.getIdToken();
      const resOrgs = await fetch('/api/admin/organizations', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (resOrgs.ok) {
        const data = await resOrgs.json();
        setOrganizations(data.organizations || []);
      }

      // Also fetching users securely
      const usersSnap = await getDocs(query(collection(db, "users")));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const analyticsSnap = await getDocs(query(collection(db, "analytics_events")));
      setAnalyticsEvents(analyticsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string | undefined, newRole: string | null) => {
    customConfirm(`Tem certeza que deseja atualizar o nível de acesso deste usuário?`, async () => {
      try {
        if (!user) return;
        const token = await user.getIdToken();
        
        const res = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ newRole })
        });

        if (!res.ok) {
          const errorData = await res.json();
          customAlert('Erro', `Erro: ${errorData.error}`, 'error');
          return;
        }
        
        await loadEcosystemData();
      } catch (err) {
        console.error("Error updating role:", err);
        customAlert('Erro', 'Erro ao atualizar função.', 'error');
      }
    });
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2B85EB] animate-spin" />
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <EcosystemShell activeAppId="core">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#2B85EB]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#2B85EB]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ecossistema MillionsNest</h1>
            <p className="text-xs text-[#A0A7B5]">Painel de Controle Global ({profile?.systemRole?.toUpperCase()})</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-2">
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'users' ? 'bg-[#2B85EB]/10 text-[#2B85EB]' : 'text-[#A0A7B5] hover:bg-white/5'}`}
            >
              <Users className="w-4 h-4" />
              Usuários e Acessos
            </button>
            <button 
              onClick={() => setActiveTab('organizations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'organizations' ? 'bg-[#2B85EB]/10 text-[#2B85EB]' : 'text-[#A0A7B5] hover:bg-white/5'}`}
            >
              <Building className="w-4 h-4" />
              Organizações e Suporte
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'analytics' ? 'bg-[#2B85EB]/10 text-[#2B85EB]' : 'text-[#A0A7B5] hover:bg-white/5'}`}
            >
              <ActivityIcon className="w-4 h-4" />
              Analytics e Growth
            </button>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            
            {activeTab === 'users' && (
              <>
                {/* Search */}
            <div className="relative">
              <Search className="w-5 h-5 text-[#A0A7B5] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#0B0F19] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-[#2B85EB] transition-colors"
              />
            </div>

            <div className="bg-[#0B0F19] border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 font-medium text-[#A0A7B5]">Usuário</th>
                      <th className="px-6 py-4 font-medium text-[#A0A7B5]">Organização Atual</th>
                      <th className="px-6 py-4 font-medium text-[#A0A7B5]">Nível de Acesso (Ecossistema)</th>
                      <th className="px-6 py-4 font-medium text-[#A0A7B5]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map(mappedUser => {
                      const resolvedContext = resolveUserOrganizationContextLocal(mappedUser.id, mappedUser, organizations);
                      return (
                        <tr key={mappedUser.id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {mappedUser.photoURL ? (
                                <img src={mappedUser.photoURL} className="w-8 h-8 rounded-full" alt="avatar" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-[#A0A7B5]" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-[#F5F7FA]">{mappedUser.displayName || 'Sem nome'}</p>
                                <p className="text-xs text-[#A0A7B5]">{mappedUser.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {resolvedContext.hasOrganization ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-white">
                                  {resolvedContext.primaryOrg?.name || resolvedContext.activeOrg?.name}
                                </span>
                                {resolvedContext.organizations.length > 1 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full w-max font-semibold">
                                    {resolvedContext.organizations.length} organizações
                                  </span>
                                )}
                                {resolvedContext.needsRepair && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded-full w-max font-semibold">
                                    ⚠️ Precisa de reparo
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-white/20">Nenhuma</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {mappedUser.systemRole === 'ceo' && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20">
                                CEO
                              </span>
                            )}
                            {mappedUser.systemRole === 'admin' && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB] text-xs font-semibold border border-[#2B85EB]/20">
                                Admin Global
                              </span>
                            )}
                            {!mappedUser.systemRole && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 text-[#A0A7B5] text-xs border border-white/10">
                                Usuário Padrão
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {(profile?.systemRole === 'ceo' || profile?.systemRole === 'admin' || profile?.systemRole === 'global_admin') && mappedUser.id !== profile.uid && (
                                <select
                                  value={mappedUser.systemRole || 'user'}
                                  onChange={(e) => handleUpdateRole(mappedUser.id, mappedUser.systemRole, e.target.value)}
                                  disabled={
                                    !canChangeSystemRole(
                                      profile?.systemRole,
                                      mappedUser.systemRole,
                                      mappedUser.systemRole,
                                      mappedUser.id === profile?.uid,
                                      users.filter(u => u.systemRole === 'ceo').length
                                    ).allowed
                                  }
                                  className="bg-[#050505] border border-white/10 rounded-lg px-2 py-1 text-xs text-[#F5F7FA] focus:outline-none disabled:opacity-50"
                                >
                                  {canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'user', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed && (
                                    <option value="user">Remover Acesso Global</option>
                                  )}
                                  {canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'admin', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed && (
                                    <option value="admin">Tornar Admin Global</option>
                                  )}
                                  {canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'ceo', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed && (
                                    <option value="ceo">Tornar CEO</option>
                                  )}
                                  
                                  {!canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'user', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed &&
                                   !canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'admin', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed &&
                                   !canChangeSystemRole(profile?.systemRole, mappedUser.systemRole, 'ceo', mappedUser.id === profile?.uid, users.filter(u => u.systemRole === 'ceo').length).allowed && (
                                    <option value={mappedUser.systemRole || 'user'}>
                                      {mappedUser.systemRole === 'ceo' ? 'CEO' : mappedUser.systemRole === 'admin' || mappedUser.systemRole === 'global_admin' ? 'Admin Global' : 'Usuário Padrão'}
                                    </option>
                                  )}
                                </select>
                              )}

                              {!resolvedContext.hasOrganization ? (
                                <button
                                  onClick={() => {
                                    const emailPrefix = mappedUser.email ? mappedUser.email.split('@')[0] : "";
                                    setCreateOrgModalUser(mappedUser);
                                    setCreateOrgName(emailPrefix);
                                  }}
                                  className="px-2 py-1 bg-[#2B85EB]/10 hover:bg-[#2B85EB]/20 text-[#2B85EB] border border-[#2B85EB]/20 hover:border-[#2B85EB]/40 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap"
                                >
                                  Criar Org
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setDiagnosticsModalUser(mappedUser);
                                    fetchDiagnostics(mappedUser);
                                  }}
                                  className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1"
                                >
                                  <Shield className="w-3 h-3 text-purple-400" />
                                  Resolver Vínculos
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>)}

            {activeTab === 'organizations' && (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="w-5 h-5 text-[#A0A7B5] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar organização pelo nome..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-[#2B85EB] transition-colors"
                  />
                </div>

                <div className="bg-[#0B0F19] border border-white/10 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Organização</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Dono / ID</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Plano Atual</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {organizations
                          .filter(org => (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(org => (
                          <tr key={org.id} className="hover:bg-white/[0.02]">
                            <td className="px-6 py-4">
                              <p className="font-medium text-[#F5F7FA]">{org.name || 'Sem nome'}</p>
                              <p className="text-xs text-[#A0A7B5]">{org.slug || 'sem-slug'}</p>
                            </td>
                            <td className="px-6 py-4 text-[#A0A7B5]">
                              {(() => {
                                const ownerId = org.ownerUserId || org.ownerUid || org.ownerId;
                                const oUser = users.find(u => u.id === ownerId || u.uid === ownerId);
                                if (oUser) {
                                  return (
                                    <div>
                                      <p className="text-[#F5F7FA] text-xs font-semibold">{oUser.displayName || 'Sem Nome'}</p>
                                      <p className="text-[#A0A7B5] text-[10px]">{oUser.email}</p>
                                    </div>
                                  );
                                }
                                if (org.ownerEmail || org.ownerName) {
                                  return (
                                    <div>
                                      <p className="text-[#F5F7FA] text-xs font-semibold">{org.ownerName || 'Sem Nome'}</p>
                                      <p className="text-[#A0A7B5] text-[10px]">{org.ownerEmail}</p>
                                    </div>
                                  );
                                }
                                return (
                                  <p className="text-white/40 text-xs">Desconhecido</p>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB] text-xs font-semibold border border-[#2B85EB]/20">
                                {org.subscriptionPlan || 'free'} • {org.subscriptionStatus || 'active'}
                              </span>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                              <button
                                onClick={() => setDiagnosticOrg(org)}
                                className="px-3 py-1.5 bg-[#2B85EB]/10 hover:bg-[#2B85EB]/20 text-[#2B85EB] border border-[#2B85EB]/20 hover:border-[#2B85EB]/40 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                              >
                                Ver Diagnóstico
                              </button>
                              <button
                                onClick={() => {
                                  setRenameOrgModal(org);
                                  setRenameOrgName(org.name || '');
                                }}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#F5F7FA] border border-white/10 hover:border-white/20 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#A0A7B5]" />
                                Renomear
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {/* Computed Metrics */}
                {(() => {
                  const now = Date.now();
                  const last24h = now - 24 * 60 * 60 * 1000;
                  const last7d = now - 7 * 24 * 60 * 60 * 1000;

                  // Active Users
                  const dauMap = new Set();
                  const wauMap = new Set();

                  // Errors & Performance
                  let totalErrors = 0;
                  let perfIssues = 0;

                  // Conversions
                  let checkoutsStarted = 0;
                  let checkoutsCompleted = 0;

                  analyticsEvents.forEach(evt => {
                    const timestamp = evt.timestamp?.seconds ? evt.timestamp.seconds * 1000 : now;
                    
                    if (timestamp >= last24h && evt.userId && evt.userId !== 'none') {
                      dauMap.add(evt.userId);
                    }
                    if (timestamp >= last7d && evt.userId && evt.userId !== 'none') {
                      wauMap.add(evt.userId);
                    }

                    if (evt.eventType === 'error') totalErrors++;
                    if (evt.eventType === 'performance_metric') perfIssues++;
                    if (evt.eventType === 'checkout_started') checkoutsStarted++;
                    if (evt.eventType === 'checkout_completed') checkoutsCompleted++;
                  });

                  const conversionRate = checkoutsStarted > 0 ? Math.round((checkoutsCompleted / checkoutsStarted) * 100) : 0;

                  // UX Funnels
                  let onboardingStarted = 0;
                  let onboardingCompleted = 0;
                  let aiImportStarted = 0;
                  let aiImportCompleted = 0;
                  let aiImportAbandoned = 0;

                  analyticsEvents.forEach(evt => {
                    if (evt.eventType === 'onboarding_started') onboardingStarted++;
                    if (evt.eventType === 'onboarding_completed') onboardingCompleted++;
                    if (evt.eventType === 'ai_processing_started') aiImportStarted++;
                    if (evt.eventType === 'ai_processing_completed') aiImportCompleted++;
                    if (evt.eventType === 'import_abandoned') aiImportAbandoned++;
                  });

                  const onboardingConv = onboardingStarted > 0 ? Math.round((onboardingCompleted / onboardingStarted) * 100) : 0;
                  const aiConv = aiImportStarted > 0 ? Math.round((aiImportCompleted / aiImportStarted) * 100) : 0;

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-white/10 group hover:border-[#2B85EB]/50 transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-[#2B85EB]" />
                            <h3 className="text-[#A0A7B5] font-medium text-sm">DAU / WAU</h3>
                          </div>
                          <div className="flex items-end gap-2">
                            <p className="text-3xl font-semibold text-[#F5F7FA]">{dauMap.size}</p>
                            <p className="text-sm text-[#A0A7B5] pb-1">/ {wauMap.size}</p>
                          </div>
                          <p className="text-xs text-[#A0A7B5] mt-2">Usuários ativos únicos (24h/7d)</p>
                        </div>

                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-white/10 group hover:border-[#10B981]/50 transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-5 h-5 text-[#10B981]" />
                            <h3 className="text-[#A0A7B5] font-medium text-sm">Conversão Checkout</h3>
                          </div>
                          <p className="text-3xl font-semibold text-[#F5F7FA]">{conversionRate}%</p>
                          <p className="text-xs text-[#A0A7B5] mt-2">{checkoutsCompleted} concluídos de {checkoutsStarted} iniciados</p>
                        </div>

                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-red-500/10 group hover:border-red-500/50 transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <h3 className="text-[#A0A7B5] font-medium text-sm">Erros Críticos (UX)</h3>
                          </div>
                          <p className="text-3xl font-semibold text-[#F5F7FA]">{totalErrors}</p>
                          <p className="text-xs text-[#A0A7B5] mt-2">Falhas JS, Crashes e Rejections</p>
                        </div>

                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-yellow-500/10 group hover:border-yellow-500/50 transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <ActivityIcon className="w-5 h-5 text-yellow-500" />
                            <h3 className="text-[#A0A7B5] font-medium text-sm">Gargalos e Lags</h3>
                          </div>
                          <p className="text-3xl font-semibold text-[#F5F7FA]">{perfIssues}</p>
                          <p className="text-xs text-[#A0A7B5] mt-2">Long Tasks e Slow Renders detectados</p>
                        </div>
                      </div>

                      {/* UX Funnels */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-white/10">
                           <h3 className="text-[#F5F7FA] font-medium mb-4 flex items-center gap-2">
                             <Users className="w-4 h-4 text-[#A0A7B5]"/> Onboarding Funnel
                           </h3>
                           <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-[#A0A7B5]">Iniciou ({onboardingStarted})</span>
                                  <span className="text-[#A0A7B5]">100%</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#2B85EB]" style={{ width: '100%' }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-[#A0A7B5]">Concluiu ({onboardingCompleted})</span>
                                  <span className="text-[#A0A7B5]">{onboardingConv}%</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#10B981]" style={{ width: `${onboardingConv}%` }} />
                                </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-[#0B0F19] rounded-2xl p-6 border border-white/10">
                           <h3 className="text-[#F5F7FA] font-medium mb-4 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-[#A0A7B5]"/> IA Import Funnel
                           </h3>
                           <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-[#A0A7B5]">Iniciou ({aiImportStarted})</span>
                                  <span className="text-[#A0A7B5]">100%</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#A855F7]" style={{ width: '100%' }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-[#A0A7B5]">Concluiu ({aiImportCompleted} / Abandono {aiImportAbandoned})</span>
                                  <span className="text-[#A0A7B5]">{aiConv}%</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#10B981]" style={{ width: `${aiConv}%` }} />
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="bg-[#0B0F19] border border-white/10 rounded-xl overflow-hidden p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#F5F7FA]">Log Completo e Monitoramento</h3>
                    <div className="flex items-center gap-4 text-xs text-[#A0A7B5]">
                      <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-[#A0A7B5]" /> {users.length} Total Users</span>
                      <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-[#A0A7B5]" /> {organizations.length} Orgs</span>
                      <span className="flex items-center gap-1.5"><ActivityIcon className="w-4 h-4 text-[#A0A7B5]" /> {analyticsEvents.length} Events</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#A0A7B5] mb-6">
                    A fundação de inteligência de produto e Product Health está ativa. Os eventos de performance (Long Tasks, Erros JS) e os eventos de uso contínuo são processados em batches. O monitoramento de vitalidade em tempo real protege a experiência do usuário.
                  </p>
                  
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-[#F5F7FA]">UX Timeline (Sessões Recentes)</h4>
                    <div className="space-y-4">
                      {(() => {
                        // Group events by session
                        const sessions: Record<string, any[]> = {};
                        analyticsEvents.forEach(evt => {
                          const sid = evt.sessionId || 'unknown';
                          if (!sessions[sid]) sessions[sid] = [];
                          sessions[sid].push(evt);
                        });

                        // Sort sessions by latest event
                        const sortedSessions = Object.entries(sessions).sort((a, b) => {
                          const maxA = Math.max(...a[1].map(e => e.timestamp?.seconds || 0));
                          const maxB = Math.max(...b[1].map(e => e.timestamp?.seconds || 0));
                          return maxB - maxA;
                        }).slice(0, 5);

                        if (sortedSessions.length === 0) {
                          return (
                            <p className="text-sm text-[#A0A7B5] py-4 text-center border border-white/5 border-dashed rounded-xl">
                              Nenhuma sessão registrada.
                            </p>
                          );
                        }

                        return sortedSessions.map(([sid, events]) => {
                          // Sort events ascending within session to form timeline
                          const sortedEvents = [...events].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
                          const userEvt = sortedEvents.find(e => e.userId && e.userId !== 'none');
                          
                          return (
                            <div key={sid} className="bg-white/5 border border-white/10 rounded-xl p-4">
                              <div className="flex justify-between items-center mb-4">
                                <h5 className="text-xs font-semibold text-[#F5F7FA] uppercase tracking-wider">
                                  Session: {sid.substring(0, 8)}...
                                </h5>
                                <span className="text-[#A0A7B5] text-xs">
                                  User: {userEvt ? userEvt.userId.substring(0, 5) : 'Anon'} | Eventos: {events.length}
                                </span>
                              </div>
                              <div className="space-y-3">
                                {sortedEvents.map(event => (
                                  <div key={event.id} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <div className={`w-2 h-2 rounded-full ${event.eventType === 'error' ? 'bg-red-500' : event.eventType === 'import_abandoned' ? 'bg-yellow-500' : 'bg-[#2B85EB]'}`} />
                                      <div className="w-px h-full bg-white/10 my-1" />
                                    </div>
                                    <div className="pb-3 flex-1 flex justify-between items-start">
                                      <div>
                                        <p className="text-[11px] font-medium text-[#F5F7FA] uppercase">{event.eventType}</p>
                                        <p className="text-[10px] text-[#A0A7B5] mt-0.5">Org: {event.organizationId?.substring(0, 8) || 'none'} | App: {event.app || 'core'}</p>
                                      </div>
                                      <span className="text-[#A0A7B5] text-[10px]">
                                        {event.timestamp ? new Date(event.timestamp.seconds * 1000).toLocaleTimeString('pt-BR') : 'Agora'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Diagnostic Modal */}
      {diagnosticOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B0F19] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0B0F19] z-10">
              <div>
                <h3 className="text-xl font-bold text-[#F5F7FA] flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5 text-[#2B85EB]" />
                  Diagnóstico de Organização
                </h3>
                <p className="text-sm text-[#A0A7B5] mt-1">Reparo administrativo do ecossistema MillionsNest.</p>
              </div>
              <button 
                onClick={() => setDiagnosticOrg(null)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#A0A7B5]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Resumo */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-2">
                <p className="text-sm text-[#F5F7FA]"><strong>ID:</strong> <span className="font-mono text-xs">{diagnosticOrg.id}</span></p>
                <p className="text-sm text-[#F5F7FA]"><strong>Nome:</strong> {diagnosticOrg.name || <span className="text-red-400">Ausente</span>}</p>
                <p className="text-sm text-[#F5F7FA]"><strong>Dono (UID):</strong> {diagnosticOrg.ownerUserId || <span className="text-red-400">Ausente</span>}</p>
                <p className="text-sm text-[#F5F7FA]"><strong>Dono (Email):</strong> {diagnosticOrg.ownerEmail || <span className="text-red-400">Ausente</span>}</p>
                <p className="text-sm text-[#F5F7FA]"><strong>Plano:</strong> {diagnosticOrg.subscriptionPlan} ({diagnosticOrg.subscriptionStatus})</p>
              </div>

              {/* Inconsistências Comuns */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[#F5F7FA] border-b border-white/10 pb-2">Status de Saúde</h4>
                
                {!diagnosticOrg.ownerUserId && (
                  <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-400">Dono Ausente</p>
                      <p className="text-xs text-red-400/80 mt-1">A organização está órfã. Sem vínculo com nenhum UID de usuário.</p>
                    </div>
                  </div>
                )}
                
                {diagnosticOrg.ownerUserId && !diagnosticOrg.ownerEmail && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-400">Email do Dono Desconhecido</p>
                      <p className="text-xs text-yellow-400/80 mt-1">O UID do dono está presente, mas falta o e-mail no registro da organização.</p>
                    </div>
                  </div>
                )}
                
                {!(diagnosticOrg.apps?.musicscale?.access) && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-400">MusicScale Inativo ou Incompleto</p>
                      <p className="text-xs text-yellow-400/80 mt-1">A tag apps.musicscale.access não está explicitamente ativa.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seleção de Dono (Reparo) */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[#F5F7FA] border-b border-white/10 pb-2">Ações de Reparo</h4>
                
                {/* 0. Alterar Nome da Organização */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#F5F7FA]">Alterar Nome da Organização</p>
                    <p className="text-xs text-[#A0A7B5]">Atualiza o nome amigável de exibição da empresa/ministério.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setRenameOrgModal(diagnosticOrg);
                      setRenameOrgName(diagnosticOrg.name || '');
                    }}
                    className="px-3 py-1.5 bg-[#2B85EB]/10 hover:bg-[#2B85EB]/20 text-[#2B85EB] border border-[#2B85EB]/20 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Renomear
                  </button>
                </div>
                
                {/* 1. Selecionar e Vincular Dono */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                  <p className="text-sm font-medium text-[#F5F7FA]">Selecionar ou Alterar Dono</p>
                  <p className="text-xs text-[#A0A7B5]">Pesquise pelo novo dono. Ele herdará os acessos e a organização.</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Buscar por UID ou nome nos usuários carregados..." 
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F5F7FA]"
                      value={ownerSearchTerm}
                      onChange={e => setOwnerSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {ownerSearchTerm && (
                    <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg bg-black/50 p-2 space-y-1">
                      {users
                        .filter(u => u.displayName?.toLowerCase().includes(ownerSearchTerm.toLowerCase()) || 
                                     u.email?.toLowerCase().includes(ownerSearchTerm.toLowerCase()) || 
                                     u.id.includes(ownerSearchTerm))
                        .map(u => (
                        <div 
                          key={u.id} 
                          className={`p-2 rounded-lg cursor-pointer flex justify-between items-center text-xs ${selectedOwner?.id === u.id ? 'bg-[#2B85EB]/20 border border-[#2B85EB]/50' : 'hover:bg-white/10'}`}
                          onClick={() => setSelectedOwner(u)}
                        >
                          <div>
                            <p className="font-medium text-[#F5F7FA]">{u.displayName || 'Sem nome'}</p>
                            <p className="text-[#A0A7B5]">{u.email}</p>
                          </div>
                          <p className="text-[10px] text-white/40">{u.id}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedOwner && (
                    <div className="pt-2 flex justify-end">
                      <button 
                        disabled={isExecutingRepair}
                        onClick={() => {
                          customConfirm(`Tem certeza que deseja vincular ${selectedOwner.email} como dono da organização? O usuário atual na organizationId será alterado.`, async () => {
                            setIsExecutingRepair(true);
                            try {
                              const token = await user?.getIdToken();
                              const res = await fetch(`/api/admin/organizations/${diagnosticOrg.id}/link-owner`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  selectedOwnerUid: selectedOwner.id,
                                  selectedOwnerEmail: selectedOwner.email,
                                  selectedOwnerName: selectedOwner.displayName
                                })
                              });
                              if (!res.ok) throw new Error("Falha na API");
                              customAlert('Sucesso', 'Dono vinculado com sucesso!', 'success');
                              setDiagnosticOrg(null);
                              loadEcosystemData();
                            } catch (e: any) {
                              customAlert('Erro', 'Erro ao vincular dono: ' + e.message, 'error');
                            } finally {
                              setIsExecutingRepair(false);
                            }
                          });
                        }}
                        className="px-4 py-2 bg-[#2B85EB] text-white rounded-lg text-sm font-medium hover:bg-[#2B85EB]/90 disabled:opacity-50"
                      >
                        {isExecutingRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular Dono Selecionado'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Criar Estrutura MusicScale */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F7FA]">Criar Estrutura Mínima (MusicScale)</p>
                    <p className="text-xs text-[#A0A7B5]">Injeta configurações básicas, papéis e permissões para abrir o app.</p>
                  </div>
                  <button 
                    disabled={isExecutingRepair}
                    onClick={() => {
                      customConfirm(`Tem certeza que deseja aplicar a estrutura mínima para ${diagnosticOrg.id}? Isso não afeta músicas existentes.`, async () => {
                        setIsExecutingRepair(true);
                        try {
                          const token = await user?.getIdToken();
                          const res = await fetch(`/api/admin/organizations/${diagnosticOrg.id}/create-musicscale-structure`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                          });
                          if (!res.ok) throw new Error("Falha na API de estrutura");
                          customAlert('Sucesso', 'Estrutura criada com sucesso!', 'success');
                          setDiagnosticOrg(null);
                        } catch (e: any) {
                          customAlert('Erro', 'Erro ao criar estrutura: ' + e.message, 'error');
                        } finally {
                          setIsExecutingRepair(false);
                        }
                      });
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-[#F5F7FA] border border-white/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    Executar Rotina
                  </button>
                </div>

                {/* 3. Normalizar Plano */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F7FA]">Normalizar Plano e Faturamento</p>
                    <p className="text-xs text-[#A0A7B5]">Converte legacy 'plan: MONTHLY' em estruturas separadas compatíveis e resincroniza status.</p>
                  </div>
                  <button 
                    disabled={isExecutingRepair}
                    onClick={() => {
                      customConfirm(`Tem certeza que deseja tentar normalizar o plano para ${diagnosticOrg.id}?`, async () => {
                        setIsExecutingRepair(true);
                        try {
                          const token = await user?.getIdToken();
                          const res = await fetch(`/api/admin/organizations/${diagnosticOrg.id}/normalize-plan`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                          });
                          if (!res.ok) throw new Error("Falha na API de normalização");
                          customAlert('Sucesso', 'Plano normalizado com sucesso!', 'success');
                          setDiagnosticOrg(null);
                          loadEcosystemData();
                        } catch (e: any) {
                          customAlert('Erro', 'Erro ao normalizar plano: ' + e.message, 'error');
                        } finally {
                          setIsExecutingRepair(false);
                        }
                      });
                    }}
                    className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    Normalizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0B] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-medium text-[#F5F7FA] mb-2">Confirmação</h3>
            <p className="text-sm text-[#A0A7B5] mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
                className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#0A0A0B] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${alertMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {alertMessage.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <Check className="w-6 h-6" />}
             </div>
             <h3 className="text-lg font-medium text-[#F5F7FA] mb-2">{alertMessage.title}</h3>
             <p className="text-sm text-[#A0A7B5] mb-6">{alertMessage.message}</p>
             <button 
               onClick={() => setAlertMessage(null)}
               className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
             >
                OK
             </button>
           </div>
        </div>
      )}

      {/* Modal de Criar Organização Customizada */}
      {createOrgModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#F5F7FA]">Criar Nova Organização</h3>
                <p className="text-xs text-[#A0A7B5] mt-1">Preencha o nome da organização para <strong>{createOrgModalUser.email}</strong>.</p>
              </div>
              <button 
                onClick={() => setCreateOrgModalUser(null)} 
                className="text-[#A0A7B5] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#A0A7B5] font-medium block">Nome da Organização</label>
              <input
                type="text"
                value={createOrgName}
                onChange={e => setCreateOrgName(e.target.value)}
                placeholder="Insira o nome da organização..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:border-[#2B85EB] transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-white/40">Sugerido automaticamente do seu e-mail (antes do @). Sinta-se livre para renomear.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setCreateOrgModalUser(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateOrganizationSubmit}
                disabled={isExecutingRepair || !createOrgName.trim()}
                className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isExecutingRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Organização'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Renomear Organização */}
      {renameOrgModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#F5F7FA]">Renomear Organização</h3>
                <p className="text-xs text-[#A0A7B5] mt-1">Altere o nome amigável da organização no ecossistema.</p>
              </div>
              <button 
                onClick={() => setRenameOrgModal(null)} 
                className="text-[#A0A7B5] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs text-[#A0A7B5] bg-white/[0.02] border border-white/5 p-3 rounded-lg">
              <p><strong>ID da Org:</strong> <span className="font-mono text-[10px]">{renameOrgModal.id}</span></p>
              <p><strong>Nome atual:</strong> {renameOrgModal.name}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#A0A7B5] font-medium block">Novo Nome</label>
              <input
                type="text"
                value={renameOrgName}
                onChange={e => setRenameOrgName(e.target.value)}
                placeholder="Insira o novo nome..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:border-[#2B85EB] transition-colors"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setRenameOrgModal(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleRenameOrganizationSubmit(renameOrgModal.id, renameOrgName)}
                disabled={isExecutingRepair || !renameOrgName.trim() || renameOrgName.trim() === renameOrgModal.name}
                className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isExecutingRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Diagnóstico e Reparo de Organizações do Usuário */}
      {diagnosticsModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-4xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-[#F5F7FA]">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  Diagnóstico e Reparo de Vínculos
                </h3>
                <p className="text-xs text-[#A0A7B5] mt-1">
                  Gerencie o isolamento de tenant, resolva organizações duplicadas e defina o contexto canônico para <strong className="text-purple-300">{diagnosticsModalUser.email}</strong>.
                </p>
              </div>
              <button 
                onClick={() => {
                  setDiagnosticsModalUser(null);
                  setDiagnosticsData(null);
                }} 
                className="text-[#A0A7B5] hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {loadingDiagnostics ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#2B85EB] animate-spin" />
                <p className="text-xs text-[#A0A7B5] font-medium">Analisando base de dados do Firestore...</p>
              </div>
            ) : diagnosticsData ? (
              <div className="space-y-6">
                
                {/* User Context & Overview Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-2">
                    <p className="text-xs text-[#A0A7B5] font-semibold uppercase tracking-wider">Identidade no Firestore</p>
                    <div className="text-sm space-y-1">
                      <p><span className="text-[#A0A7B5]">Nome:</span> <strong>{diagnosticsData.user?.displayName || 'Sem nome'}</strong></p>
                      <p><span className="text-[#A0A7B5]">E-mail:</span> <strong>{diagnosticsData.user?.email}</strong></p>
                      <p><span className="text-[#A0A7B5]">UID:</span> <code className="text-xs bg-black/40 px-1 py-0.5 rounded text-gray-300 select-all">{diagnosticsData.user?.uid}</code></p>
                      <p><span className="text-[#A0A7B5]">Cargo Global:</span> <span className="text-xs bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded text-purple-400 font-semibold">{diagnosticsData.user?.systemRole || 'user'}</span></p>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-2">
                    <p className="text-xs text-[#A0A7B5] font-semibold uppercase tracking-wider">Chaves de Contexto do Tenant (User Doc)</p>
                    <div className="text-sm space-y-1">
                      <p><span className="text-[#A0A7B5]">primaryOrganizationId (Canônico):</span> <code className="text-xs bg-black/40 px-1 py-0.5 rounded text-green-400 font-mono">{diagnosticsData.primaryOrganizationId || 'NENHUMA (Inconsistência!)'}</code></p>
                      <p><span className="text-[#A0A7B5]">activeOrganizationId (Canônico):</span> <code className="text-xs bg-black/40 px-1 py-0.5 rounded text-blue-400 font-mono">{diagnosticsData.activeOrganizationId || 'NENHUMA'}</code></p>
                      <p><span className="text-[#A0A7B5]">organizationId (Legado):</span> <code className="text-xs bg-black/40 px-1 py-0.5 rounded text-yellow-500 font-mono">{diagnosticsData.user?.organizationId || 'NENHUMA'}</code></p>
                    </div>
                  </div>
                </div>

                {/* Inconsistencies & Healing Banner */}
                {diagnosticsData.needsRepair && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-grow">
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-400">Inconsistências de Arquitetura Encontradas!</h4>
                        <ul className="list-disc list-inside text-xs text-yellow-200/80 mt-1 space-y-1">
                          {diagnosticsData.inconsistencies.map((inc: string, idx: number) => (
                            <li key={idx}>{inc}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <span className="text-xs text-[#A0A7B5]">Para corrigir e reparar instantaneamente estas chaves, defina uma das organizações abaixo como a **Organização Principal** do usuário.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* List of Linked Organizations */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[#A0A7B5] uppercase tracking-wider">Organizações Vinculadas Detectadas</h4>
                  
                  <div className="border border-white/5 rounded-xl divide-y divide-white/5 bg-black/20 overflow-hidden">
                    {diagnosticsData.organizations?.length === 0 ? (
                      <p className="p-6 text-center text-xs text-white/40">Nenhuma organização associada a este usuário no ecossistema.</p>
                    ) : (
                      diagnosticsData.organizations.map((org: any) => {
                        const isPrimary = org.id === diagnosticsData.primaryOrganizationId;
                        const isActive = org.id === diagnosticsData.activeOrganizationId;
                        const isLegacy = org.id === diagnosticsData.user?.organizationId;
                        const isOwner = org.ownerUid === diagnosticsData.user?.uid || org.ownerUserId === diagnosticsData.user?.uid;
                        
                        return (
                          <div key={org.id} className="p-4 hover:bg-white/[0.01] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                            <div className="space-y-2 max-w-md">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white">{org.name}</span>
                                <span className="font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded text-white/60">{org.id}</span>
                                
                                {isOwner ? (
                                  <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">Dono</span>
                                ) : (
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">Membro</span>
                                )}

                                {isPrimary && (
                                  <span className="bg-green-500/15 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded text-[10px] font-bold">Principal</span>
                                )}
                                {isActive && (
                                  <span className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded text-[10px] font-bold">Ativa na Sessão</span>
                                )}
                                {isLegacy && (
                                  <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 px-1.5 py-0.5 rounded text-[10px] font-semibold">Legada</span>
                                )}
                              </div>

                              {/* Org Statistics/Details */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[#A0A7B5] text-[11px]">
                                <p>• Músicas: <strong className="text-white">{org.stats?.songsCount ?? 0}</strong></p>
                                <p>• Escalas: <strong className="text-white">{org.stats?.scalesCount ?? 0}</strong></p>
                                <p>• Membros: <strong className="text-white">{org.stats?.membersCount ?? 0}</strong></p>
                                <p>• Convites: <strong className="text-white">{org.stats?.invitesCount ?? 0}</strong></p>
                                <p className="col-span-2">• Faturamento Plan: <strong className="text-[#2B85EB] uppercase">{org.subscriptionPlan || 'Nenhum'} ({org.subscriptionStatus || 'Nulo'})</strong></p>
                                <p className="col-span-2">• Criada em: <strong className="text-white">{org.createdAt ? new Date(org.createdAt).toLocaleDateString('pt-BR') : 'Desconhecido'}</strong></p>
                              </div>
                            </div>

                            {/* Actions per Org */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {!isPrimary && (
                                <button
                                  onClick={() => handleSetPrimaryOrg(org.id)}
                                  disabled={isExecutingRepair}
                                  className="px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 rounded-lg text-[10px] font-medium transition-colors"
                                >
                                  Tornar Principal & Alinhar
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleArchiveOrDeleteOrg(org.id, 'archive')}
                                disabled={isExecutingRepair || isPrimary}
                                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/45 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isPrimary ? 'Não é possível arquivar a organização principal' : ''}
                              >
                                Arquivar Org
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Data Migrator & Consolidator Tool */}
                {diagnosticsData.organizations?.length > 1 && (
                  <div className="border border-white/5 bg-white/[0.02] rounded-xl p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-purple-400">Consolidador de Dados (Migração de Ativos)</h4>
                      <p className="text-[11px] text-[#A0A7B5] mt-1">
                        Transfira todas as Músicas, Escalas de produção e Membros de um workspace duplicado criado por engano para a organização principal do usuário antes de arquivá-lo.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 items-end pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-[#A0A7B5] font-semibold uppercase tracking-wider">Mover Dados DE (Origem)</label>
                        <select
                          value={movingFromOrgId}
                          onChange={e => setMovingFromOrgId(e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-lg p-2 text-xs text-[#F5F7FA] focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          {diagnosticsData.organizations.map((org: any) => (
                            <option key={org.id} value={org.id}>
                              {org.name} ({org.stats?.songsCount} mus, {org.stats?.scalesCount} esc)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-[#A0A7B5] font-semibold uppercase tracking-wider">Mover Dados PARA (Destino)</label>
                        <select
                          value={movingToOrgId}
                          onChange={e => setMovingToOrgId(e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-lg p-2 text-xs text-[#F5F7FA] focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          {diagnosticsData.organizations.map((org: any) => (
                            <option key={org.id} value={org.id}>
                              {org.name} (ID: {org.id.substring(0,6)}...)
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleMoveOrgData(movingFromOrgId, movingToOrgId)}
                        disabled={isExecutingRepair || !movingFromOrgId || !movingToOrgId || movingFromOrgId === movingToOrgId}
                        className="w-full py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isExecutingRepair ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Migrar Ativos Agora'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-white/40">Falha ao obter diagnóstico de dados.</div>
            )}

            {/* Footer */}
            <div className="flex justify-end border-t border-white/5 pt-4">
              <button 
                onClick={() => {
                  setDiagnosticsModalUser(null);
                  setDiagnosticsData(null);
                }}
                className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </EcosystemShell>
  );
}
