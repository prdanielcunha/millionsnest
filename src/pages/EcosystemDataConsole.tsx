import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "../contexts/AuthContext.js";
import { 
  Database, Users, Search, AlertCircle, Building, Check, Loader2, 
  TrendingUp, Pencil, Trash2, Plus, Music, Sliders, Copy, ExternalLink, 
  FileText, CheckCircle, RefreshCw, Share2, ShieldAlert
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EcosystemShell } from "../components/EcosystemShell.js";

export function EcosystemDataConsole() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Primary Console States
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'organizations' | 'users' | 'audits'>('organizations');
  
  // Search and Filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Organization Specific States (Managed within the Drawer)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [selectedOrgTab, setSelectedOrgTab] = useState<'details' | 'members' | 'musicscale' | 'repair'>('details');
  const [orgSongs, setOrgSongs] = useState<any[]>([]);
  const [orgScales, setOrgScales] = useState<any[]>([]);
  const [loadingMSData, setLoadingMSData] = useState(false);

  // MusicScale Repertoire Forms
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [songBpms, setSongBpms] = useState("");
  const [songLyrics, setSongLyrics] = useState("");
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Administrative Action Triggers & Modals
  const [isExecutingRepair, setIsExecutingRepair] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);

  // Field Edit Form (Organization Profile)
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Create Org Modal
  const [createOrgModalUser, setCreateOrgModalUser] = useState<any | null>(null);
  const [createOrgName, setCreateOrgName] = useState("");

  // Helpers
  const customConfirm = (message: string, onConfirm: () => void) => {
    setConfirmAction({ message, onConfirm });
  };

  const customAlert = (title: string, message: string, type: 'success' | 'error') => {
    setAlertMessage({ title, message, type });
  };

  // Enforce Access Control
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
      } else if (profile && !['ceo', 'admin', 'global_admin'].includes(profile.systemRole)) {
        navigate('/');
      }
    }
  }, [user, profile, loading, navigate]);

  // Main Data Load
  const loadEcosystemDatabase = async () => {
    setLoadingData(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Não autenticado");

      // 1. Fetch Aggregated Orgs via our custom API
      const orgsRes = await fetch('/api/admin/database/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!orgsRes.ok) throw new Error("Erro ao carregar organizações do ecossistema.");
      const orgsData = await orgsRes.json();
      setOrganizations(orgsData.organizations || []);

      // 2. Fetch Users from Firestore
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);

      // 3. Fetch Audit Logs
      const auditRes = await fetch('/api/admin/database/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }
    } catch (err: any) {
      console.error('[Ecosystem Console Load Error]', err);
      customAlert('Erro de Conexão', err.message || 'Falha ao buscar dados administrativos.', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && profile && ['ceo', 'admin', 'global_admin'].includes(profile.systemRole)) {
      loadEcosystemDatabase();
    }
  }, [user, profile]);

  // Load MusicScale Songs & Scales for a Selected Org
  const loadMusicScaleData = async (orgId: string) => {
    setLoadingMSData(true);
    try {
      const token = await user?.getIdToken();
      
      const songsRes = await fetch(`/api/admin/database/organizations/${orgId}/songs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const scalesRes = await fetch(`/api/admin/database/organizations/${orgId}/scales`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (songsRes.ok) {
        const sData = await songsRes.json();
        setOrgSongs(sData.songs || []);
      }
      if (scalesRes.ok) {
        const scData = await scalesRes.json();
        setOrgScales(scData.scales || []);
      }
    } catch (e: any) {
      console.error("Erro ao carregar repertório do MusicScale:", e);
    } finally {
      setLoadingMSData(false);
    }
  };

  // Open Gerenciar Drawer
  const handleManageOrg = (org: any) => {
    setSelectedOrg(org);
    setEditName(org.name || "");
    setEditSlug(org.slug || "");
    setEditPlan(org.subscriptionPlan || "free");
    setEditStatus(org.subscriptionStatus || "none");
    setSelectedOrgTab('details');
    setEditingSongId(null);
    clearSongForm();
    loadMusicScaleData(org.id);
  };

  const clearSongForm = () => {
    setSongTitle("");
    setSongArtist("");
    setSongKey("");
    setSongBpms("");
    setSongLyrics("");
    setEditingSongId(null);
  };

  // Create Organizations (autofill based on user email)
  const handleCreateOrgSubmit = async (confirmedAdditional: boolean = false) => {
    if (!createOrgName.trim()) return;
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${createOrgModalUser.id}/create-organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizationName: createOrgName.trim(),
          confirmCreateAdditional: confirmedAdditional
        })
      });
      
      const resData = await res.json();
      if (!res.ok) {
        if (resData.requiresExplicitConfirmation) {
          setIsExecutingRepair(false);
          customConfirm(
            "Este usuário já possui uma organização ativa vinculada. Deseja realmente criar uma organização adicional para ele?",
            () => handleCreateOrgSubmit(true)
          );
          return;
        }
        throw new Error(resData.message || resData.error || "Falha na criação");
      }
      
      customAlert('Sucesso', 'Organização criada e vinculada com sucesso no ecossistema!', 'success');
      setCreateOrgModalUser(null);
      loadEcosystemDatabase();
    } catch (e: any) {
      customAlert('Erro', e.message || 'Falha ao criar organização.', 'error');
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // Update Org Details & Subscriber details
  const handleSaveFieldsSubmit = async () => {
    if (!selectedOrg) return;
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/database/organizations/${selectedOrg.id}/update-fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim(),
          subscriptionPlan: editPlan,
          subscriptionStatus: editStatus
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Falha ao atualizar");
      }

      customAlert('Configurações Gravadas', 'Organização editada com sucesso!', 'success');
      setSelectedOrg(null);
      loadEcosystemDatabase();
    } catch (e: any) {
      customAlert('Erro', e.message || 'Erro ao atualizar dados.', 'error');
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // Re-link Owner
  const handleLinkOwnerSubmit = async () => {
    if (!selectedOrg || !selectedOwner) return;
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}/link-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selectedOwnerUid: selectedOwner.id,
          selectedOwnerEmail: selectedOwner.email,
          selectedOwnerName: selectedOwner.displayName
        })
      });
      if (!res.ok) throw new Error("Erro na API.");
      customAlert('Dono Alterado', 'Vínculo do proprietário atualizado!', 'success');
      setSelectedOrg(null);
      setSelectedOwner(null);
      setOwnerSearchTerm("");
      loadEcosystemDatabase();
    } catch (e: any) {
      customAlert('Erro', 'Falha ao vincular: ' + e.message, 'error');
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // Inject MS minimal structure (Diagnostic execution)
  const handleRunMSRoutine = async (orgId: string) => {
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${orgId}/create-musicscale-structure`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro na API de estrutura");
      customAlert('Infraestrutura Pronta', 'Módulo MusicScale provisionado!', 'success');
      setSelectedOrg(null);
      loadEcosystemDatabase();
    } catch (e: any) {
      customAlert('Erro', 'Falha na rotina: ' + e.message, 'error');
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // Re-normalize legacy Plan mapping status
  const handleNormalizeBillingRoutine = async (orgId: string) => {
    setIsExecutingRepair(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${orgId}/normalize-plan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro na API de faturação.");
      customAlert('Faturamento Normalizado', 'Plano legacy normalizado!', 'success');
      setSelectedOrg(null);
      loadEcosystemDatabase();
    } catch (e: any) {
      customAlert('Erro', 'Falha ao normalizar: ' + e.message, 'error');
    } finally {
      setIsExecutingRepair(false);
    }
  };

  // MusicScale Repertoire Management (Songs Operations)
  const handleSongSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;
    setLoadingMSData(true);
    try {
      const token = await user?.getIdToken();
      const payload = {
        title: songTitle.trim(),
        artist: songArtist.trim(),
        key: songKey.trim(),
        bpms: Number(songBpms) || 0,
        lyrics: songLyrics.trim()
      };

      let url = `/api/admin/database/organizations/${selectedOrg.id}/songs`;
      let method = 'POST';

      if (editingSongId) {
        url = `/api/admin/database/organizations/${selectedOrg.id}/songs/${editingSongId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Falha ao salvar música.");
      
      customAlert('Sucesso', editingSongId ? 'Música atualizada' : 'Música criada com sucesso', 'success');
      clearSongForm();
      loadMusicScaleData(selectedOrg.id);
    } catch (err: any) {
      customAlert('Erro', err.message, 'error');
    } finally {
      setLoadingMSData(false);
    }
  };

  const handleEditSongClick = (song: any) => {
    setEditingSongId(song.id);
    setSongTitle(song.title || "");
    setSongArtist(song.artist || "");
    setSongKey(song.key || "");
    setSongBpms(song.bpms ? String(song.bpms) : "");
    setSongLyrics(song.lyrics || "");
  };

  const handleDeleteSongSubmit = async (songId: string) => {
    setLoadingMSData(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/database/organizations/${selectedOrg.id}/songs/${songId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Falha ao deletar.");
      customAlert('Música Deletada', 'Arquivo foi removido do ecossistema.', 'success');
      loadMusicScaleData(selectedOrg.id);
    } catch (err: any) {
      customAlert('Erro', err.message, 'error');
    } finally {
      setLoadingMSData(false);
    }
  };

  const copyInviteLink = (orgId: string) => {
    const inviteUrl = `${window.location.origin}/join?orgId=${orgId}&ref=support_console`;
    navigator.clipboard.writeText(inviteUrl);
    customAlert('Copiado!', 'Link de convite para a organização copiado para o clipboard.', 'success');
  };

  const shareInviteWhatsApp = (org: any) => {
    const inviteUrl = `${window.location.origin}/join?orgId=${org.id}&ref=support_console`;
    const message = `Olá! Você foi convidado para participar da organização *${org.name}* no ecossistema MillionsNest. Faça o seu login e configure o seu perfil de excelência através do link de adesão abaixo:\n\n${inviteUrl}`;
    const encMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encMessage}`, '_blank');
  };

  // Math metrics for summary
  const totalOrgsCount = organizations.length;
  const criticalOrgsCount = organizations.filter(o => o.healthStatus === 'Crítica').length;
  const warningOrgsCount = organizations.filter(o => o.healthStatus === 'Atenção').length;
  const healthyOrgsCount = totalOrgsCount - criticalOrgsCount - warningOrgsCount;

  return (
    <EcosystemShell>
      <main className="text-white min-h-[calc(100vh-80px)] py-6 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
        
        {/* Banner Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-[#2B85EB]">
              <Database className="w-6 h-6" />
              <span className="text-xs font-mono tracking-widest uppercase">Console Central de Excelência</span>
            </div>
            <h1 className="text-2xl md:text-3.5xl font-sans font-medium text-[#F5F7FA] mt-1">
              Banco de Dados do Ecossistema
            </h1>
            <p className="text-sm text-[#A0A7B5] mt-1.5 max-w-2xl">
              Hub operacional unificado para diagnóstico de saúde, reparos cirúrgicos e administração dos dados do ecossistema e apps de louvor conectados.
            </p>
          </div>
          <button 
            onClick={loadEcosystemDatabase}
            disabled={loadingData}
            className="self-start md:self-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-white/20 text-xs font-medium rounded-xl flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Recarregar Console
          </button>
        </div>

        {/* Dashboard Grid Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0B0F19]/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-sm space-y-1">
            <h3 className="text-xs font-medium text-[#A0A7B5] flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#2B85EB]" /> Total Organizações
            </h3>
            <p className="text-2xl md:text-3xl font-semibold text-[#F5F7FA]">{totalOrgsCount}</p>
            <p className="text-[10px] text-white/40">Parceiras cadastradas</p>
          </div>
          <div className="bg-[#0B0F19]/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-sm space-y-1">
            <h3 className="text-xs font-medium text-[#A0A7B5] flex items-center gap-1.5 text-emerald-500">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Tenants Saudáveis
            </h3>
            <p className="text-2xl md:text-3xl font-semibold text-emerald-400">{healthyOrgsCount}</p>
            <p className="text-[10px] text-emerald-400/60">Configuração completa</p>
          </div>
          <div className="bg-[#0B0F19]/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-sm space-y-1">
            <h3 className="text-xs font-medium text-[#A0A7B5] flex items-center gap-1.5 text-yellow-500" style={{ color: '#EAB308' }}>
              <AlertCircle className="w-4 h-4 text-yellow-500" /> Atenção / Incompletas
            </h3>
            <p className="text-2xl md:text-3xl font-semibold text-yellow-400">{warningOrgsCount}</p>
            <p className="text-[10px] text-white/40">Falta MusicScale ou tags</p>
          </div>
          <div className="bg-[#0B0F19]/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-sm space-y-1">
            <h3 className="text-xs font-medium text-[#A0A7B5] flex items-center gap-1.5 text-red-500">
              <ShieldAlert className="w-4 h-4 text-red-500" /> Órfãs ou Sem Dono
            </h3>
            <p className="text-2xl md:text-3xl font-semibold text-red-400">{criticalOrgsCount}</p>
            <p className="text-[10px] text-red-400/60">Requer vinculação operacional</p>
          </div>
        </div>

        {/* Global Console Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-2">
          <button
            onClick={() => { setActiveTab('organizations'); setSearchTerm(''); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'organizations' 
              ? 'border-[#2B85EB] text-[#2B85EB]' 
              : 'border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]'
            }`}
          >
            <Building className="w-4 h-4" />
            Organizações ({organizations.length})
          </button>
          <button
            onClick={() => { setActiveTab('users'); setSearchTerm(''); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users' 
              ? 'border-[#2B85EB] text-[#2B85EB]' 
              : 'border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]'
            }`}
          >
            <Users className="w-4 h-4" />
            Votos Globais / Usuários ({users.length})
          </button>
          <button
            onClick={() => { setActiveTab('audits'); setSearchTerm(''); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'audits' 
              ? 'border-[#2B85EB] text-[#2B85EB]' 
              : 'border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Auditoria Global ({auditLogs.length})
          </button>
        </div>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0B0F19]/20 border border-white/5 rounded-2xl">
            <Loader2 className="w-10 h-10 animate-spin text-[#2B85EB] mb-3" />
            <p className="text-sm text-[#A0A7B5]">Carregando bases do ecossistema...</p>
          </div>
        ) : (
          <>
            {/* VIEW: ORGANIZATIONS TAB */}
            {activeTab === 'organizations' && (
              <div className="space-y-4">
                
                {/* Filters Row */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A0A7B5] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome da organização, slug ou id..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#2B85EB] transition-colors text-white placeholder-white/30"
                  />
                </div>

                {/* Table */}
                <div className="bg-[#0B0F19] border border-white/10 rounded-xl overflow-hidden shadow">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Organização / ID / Slug</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Proprietário (Dono)</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Métricas (MS / Members)</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Plano / Status</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Saúde</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5] text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {organizations
                          .filter(org => {
                            const term = searchTerm.toLowerCase();
                            return (org.name || '').toLowerCase().includes(term) ||
                                   (org.slug || '').toLowerCase().includes(term) ||
                                   org.id.toLowerCase().includes(term);
                          })
                          .map(org => (
                            <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-[#F5F7FA]">{org.name}</div>
                                <div className="text-[10px] text-white/40 mt-0.5 font-mono">{org.id}</div>
                                <div className="inline-block px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/60 mt-1">
                                  /{org.slug || 'sem-slug'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {org.ownerUserId ? (
                                  <div>
                                    <div className="text-white/80 font-medium text-xs truncate max-w-[200px]" title={org.ownerName}>
                                      {org.ownerName || 'Dono Cadastrado'}
                                    </div>
                                    <div className="text-[10px] text-white/40 font-mono mt-0.5">{org.ownerEmail || org.ownerUserId}</div>
                                  </div>
                                ) : (
                                  <span className="text-red-400 bg-red-400/10 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-medium">Orfã / Sem dono</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                                    <Users className="w-3.5 h-3.5 text-white/40" />
                                    <span>{org.memberCount || 0} membros</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                                    <Music className="w-3.5 h-3.5 text-white/40" />
                                    <span>{org.songCount || 0} músicas</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  org.subscriptionPlan === 'full_unlimited' || org.subscriptionPlan === 'essential'
                                    ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20'
                                    : 'bg-white/5 text-white/60 border-white/10'
                                }`}>
                                  {org.subscriptionPlan} • {org.subscriptionStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                                  org.healthStatus === 'Saudável'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : org.healthStatus === 'Atenção'
                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                    : 'bg-red-505/10 text-red-400 border-red-500/20'
                                }`}>
                                  {org.healthStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleManageOrg(org)}
                                  className="px-3 py-1.5 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
                                >
                                  Gerenciar
                                </button>
                              </td>
                            </tr>
                          ))}
                        
                        {organizations.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-20 text-white/40 text-sm">
                              Nenhuma organização registrada no ecossistema MillionsNest.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: USERS TAB */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A0A7B5] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar usuários carregados..."
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#2B85EB] transition-colors text-white placeholder-white/30"
                  />
                </div>

                <div className="bg-[#0B0F19] border border-white/10 rounded-xl overflow-hidden shadow">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">E-mail / UID</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Nome de Exibição</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Organização Atual</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5]">Função do Sistema</th>
                          <th className="px-6 py-4 font-medium text-[#A0A7B5] text-right">Ação Operacional</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users
                          .filter(u => {
                            const term = userSearchTerm.toLowerCase();
                            return (u.email || '').toLowerCase().includes(term) ||
                                   (u.displayName || '').toLowerCase().includes(term) ||
                                   u.id.toLowerCase().includes(term);
                          })
                          .map(u => {
                            const hasAssociatedOrg = organizations.some(o => o.id === u.organizationId || o.ownerUserId === u.id);
                            
                            return (
                              <tr key={u.id} className="hover:bg-white/[0.02]">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-[#F5F7FA] font-mono">{u.email}</div>
                                  <div className="text-[10px] text-white/40 mt-0.5 font-mono">{u.id}</div>
                                </td>
                                <td className="px-6 py-4 text-white/80">{u.displayName || <span className="text-white/30">Sem nome</span>}</td>
                                <td className="px-6 py-4 font-mono text-xs">
                                  {u.organizationId ? (
                                    <span className="text-[#2B85EB]" title={u.organizationId}>
                                      {organizations.find(o => o.id === u.organizationId)?.name || u.organizationId.substring(0, 8) + '...'}
                                    </span>
                                  ) : (
                                    <span className="text-red-400 font-sans">Sem Organização Vinculada</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    u.systemRole === 'ceo' || u.systemRole === 'admin'
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                      : 'bg-white/5 text-[#A0A7B5] border-white/10'
                                  }`}>
                                    {u.systemRole || 'user'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {!hasAssociatedOrg && (
                                    <button
                                      onClick={() => {
                                        const emailPrefix = u.email ? u.email.split('@')[0] : "";
                                        setCreateOrgModalUser(u);
                                        setCreateOrgName(emailPrefix);
                                      }}
                                      className="px-2.5 py-1 bg-[#2B85EB]/10 hover:bg-[#2B85EB]/20 text-[#2B85EB] border border-[#2B85EB]/20 hover:border-[#2B85EB]/40 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                                    >
                                      Criar Org e Vincular Dono
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: AUDITS TAB */}
            {activeTab === 'audits' && (
              <div className="space-y-4">
                <div className="bg-[#0B0F19] border border-white/10 rounded-xl p-6 shadow space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#F5F7FA]">Linha do Tempo de Auditoria Administrativa</h3>
                    <p className="text-xs text-[#A0A7B5] mt-1">Modificações operacionais executadas pelos donos, ceos ou pelo suporte.</p>
                  </div>

                  <div className="relative border-l border-white/10 pl-6 space-y-8">
                    {auditLogs.map((log, index) => {
                      let dateStr = "Recent";
                      if (log.createdAt?.seconds) {
                        dateStr = new Date(log.createdAt.seconds * 1000).toLocaleString('pt-BR');
                      } else if (log.createdAt) {
                        dateStr = new Date(log.createdAt).toLocaleString('pt-BR');
                      }
                      
                      return (
                        <div key={log.id || index} className="relative group">
                          {/* Anchor circle */}
                          <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#2B85EB] border-4 border-[#0B0F19] group-hover:bg-purple-500 transition-colors" />
                          
                          <div className="space-y-1">
                            <div className="flex flex-col md:flex-row md:items-center justify-between text-xs gap-1">
                              <span className="font-semibold text-white uppercase tracking-wider text-[#2B85EB]">
                                {log.action || 'system.database_log'}
                              </span>
                              <span className="text-white/40 font-mono text-[11px]">{dateStr}</span>
                            </div>
                            <p className="text-xs text-white/70">
                              Executor: <strong>{log.actorEmail || 'Suporte'}</strong> ({log.actorSystemRole || 'admin'})
                            </p>
                            <p className="text-xs text-white/50">
                              Org ID: <span className="font-mono text-[10px] text-white/70">{log.organizationId || 'None'}</span>
                            </p>
                            
                            {log.before && log.after && (
                              <div className="mt-2 bg-black/30 border border-white/5 rounded-lg p-2 font-mono text-[10px] space-y-1 text-white/60">
                                <div><strong>De:</strong> {JSON.stringify(log.before)}</div>
                                <div><strong>Para:</strong> {JSON.stringify(log.after)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {auditLogs.length === 0 && (
                      <div className="text-white/30 text-sm py-4">Nenhum evento registrado no arquivo de auditoria.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* DETAILS/MANAGER MAIN DRAWER */}
        {selectedOrg && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-end">
            <div className="bg-[#0B0F19] border-l border-white/10 w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden radial-glow animate-slide-left">
              
              {/* Header */}
              <div className="p-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-[#2B85EB]" />
                    <span className="text-white/40 font-mono text-xs">Administração de Tenant</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-[#F5F7FA] mt-1">{selectedOrg.name}</h3>
                  <p className="text-[10px] font-mono text-white/40 mt-1">ID: {selectedOrg.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedOrg(null)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white transition-all text-sm font-semibold"
                >
                  ✕ Fechar
                </button>
              </div>

              {/* Sub navbar inside drawer */}
              <div className="flex bg-white/[0.02] border-b border-white/10 text-xs">
                <button
                  onClick={() => setSelectedOrgTab('details')}
                  className={`flex-1 py-3 text-center border-b-2 font-medium ${selectedOrgTab === 'details' ? 'border-[#2B85EB] text-[#2B85EB]' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
                >
                  Cadastro & Vínculo
                </button>
                <button
                  onClick={() => setSelectedOrgTab('members')}
                  className={`flex-1 py-3 text-center border-b-2 font-medium ${selectedOrgTab === 'members' ? 'border-[#2B85EB] text-[#2B85EB]' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
                >
                  Membros & Convites
                </button>
                <button
                  onClick={() => setSelectedOrgTab('musicscale')}
                  className={`flex-1 py-3 text-center border-b-2 font-medium ${selectedOrgTab === 'musicscale' ? 'border-[#2B85EB] text-[#2B85EB]' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
                >
                  Louvor (MusicScale)
                </button>
                <button
                  onClick={() => setSelectedOrgTab('repair')}
                  className={`flex-1 py-3 text-center border-b-2 font-medium ${selectedOrgTab === 'repair' ? 'border-[#2B85EB] text-[#2B85EB]' : 'border-transparent text-[#A0A7B5] hover:text-white'}`}
                >
                  Diagnóstico / Reparos
                </button>
              </div>

              {/* Drawer Body / Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* SUBTAB: DETAILS */}
                {selectedOrgTab === 'details' && (
                  <div className="space-y-5">
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveFieldsSubmit(); }} className="space-y-4">
                      <div>
                        <label className="text-[11px] font-semibold text-[#A0A7B5] block uppercase">Nome Amigável</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:border-[#2B85EB] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#A0A7B5] block uppercase">Tenant Slug</label>
                        <input
                          type="text"
                          value={editSlug}
                          onChange={e => setEditSlug(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:border-[#2B85EB] focus:outline-none font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-semibold text-[#A0A7B5] block uppercase">Plano de Assinatura</label>
                          <select
                            value={editPlan}
                            onChange={e => setEditPlan(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1 h-9 focus:border-[#2B85EB] focus:outline-none"
                          >
                            <option value="free">Free / Trial</option>
                            <option value="essential">MusicScale Essential</option>
                            <option value="full_unlimited">MusicScale Ilimitado (CEO)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-[#A0A7B5] block uppercase">Status da Assinatura</label>
                          <select
                            value={editStatus}
                            onChange={e => setEditStatus(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1 h-9 focus:border-[#2B85EB] focus:outline-none"
                          >
                            <option value="none">Nenhum</option>
                            <option value="active">Ativo (Permitido)</option>
                            <option value="canceled">Cancelado</option>
                            <option value="past_due">Inadimplente</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={isExecutingRepair}
                          className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          {isExecutingRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações de Cadastro'}
                        </button>
                      </div>
                    </form>

                    {/* SELECIONAR NOVO DONO WORKSPACE */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[#F5F7FA]">Alterar Proprietário (Dono)</h4>
                        <p className="text-[10px] text-[#A0A7B5] mt-0.5">Substitui o ownerUserId principal da organização no Firestore.</p>
                      </div>

                      <input 
                        type="text" 
                        placeholder="Buscar por UID ou nome de usuário..." 
                        value={ownerSearchTerm}
                        onChange={e => setOwnerSearchTerm(e.target.value)}
                        className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white"
                      />

                      {ownerSearchTerm && (
                        <div className="max-h-32 overflow-y-auto border border-white/10 rounded-lg bg-black/50 p-2 space-y-1">
                          {users
                            .filter(u => (u.displayName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) || 
                                         (u.email || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) || 
                                         u.id.includes(ownerSearchTerm))
                            .map(u => (
                              <div 
                                key={u.id} 
                                onClick={() => setSelectedOwner(u)}
                                className={`p-1.5 rounded text-[11px] cursor-pointer flex justify-between items-center ${selectedOwner?.id === u.id ? 'bg-[#2B85EB]/20 border border-[#2B85EB]/50 text-white' : 'hover:bg-white/5 text-[#A0A7B5]'}`}
                              >
                                <div>
                                  <div className="font-semibold">{u.displayName || 'Sem nome'}</div>
                                  <div className="text-[10px] opacity-60">{u.email}</div>
                                </div>
                                <span className="font-mono text-[9px] opacity-40">{u.id.substring(0,6)}...</span>
                              </div>
                            ))}
                        </div>
                      )}

                      {selectedOwner && (
                        <div className="flex items-center justify-between bg-[#2B85EB]/10 border border-[#2B85EB]/20 rounded-lg p-3">
                          <div className="text-xs">
                            Compromisso: definir <strong>{selectedOwner.email}</strong> como proprietário.
                          </div>
                          <button
                            onClick={() => {
                              customConfirm(`Deseja mesmo vincular ${selectedOwner.email} como proprietário de ${selectedOrg.name}?`, handleLinkOwnerSubmit);
                            }}
                            className="px-3 py-1 bg-[#2B85EB] text-white rounded text-xs font-semibold active:scale-95 transition-all"
                          >
                            Dono Vinculado Juntos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUBTAB: MEMBERS */}
                {selectedOrgTab === 'members' && (
                  <div className="space-y-6">
                    
                    {/* Action Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => copyInviteLink(selectedOrg.id)}
                        className="bg-white/5 border border-white/10 hover:border-white/30 rounded-xl p-3 text-center transition-all flex flex-col items-center justify-center gap-1.5 focus:outline-none"
                      >
                        <Copy className="w-5 h-5 text-[#2B85EB]" />
                        <span className="text-xs font-medium">Copiar Link Adesão</span>
                      </button>
                      <button
                        onClick={() => shareInviteWhatsApp(selectedOrg)}
                        className="bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl p-3 text-center transition-all flex flex-col items-center justify-center gap-1.5 focus:outline-none"
                      >
                        <Share2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-400">Share no WhatsApp</span>
                      </button>
                    </div>

                    {/* Member Directory */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-[#A0A7B5] uppercase block">Lista de Membros Ativos</h4>
                      
                      {/* Note: Pulling members belonging to organizations/{orgId}/members. For demo purposes we map loaded database users matching tenant */}
                      <div className="divide-y divide-white/5 bg-black/20 border border-white/5 rounded-xl">
                        {users
                          .filter(u => u.organizationId === selectedOrg.id)
                          .map(u => (
                            <div key={u.id} className="p-3 flex justify-between items-center">
                              <div>
                                <div className="text-xs font-medium">{u.displayName || 'Sem Nome'}</div>
                                <div className="text-[10px] text-white/50">{u.email}</div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#2B85EB]/10 text-[#2B85EB] border border-[#2B85EB]/20">
                                {selectedOrg.ownerUserId === u.id ? 'Owner' : 'Membro'}
                              </span>
                            </div>
                          ))}
                        
                        {users.filter(u => u.organizationId === selectedOrg.id).length === 0 && (
                          <div className="p-6 text-center text-xs text-white/40">Nenhum membro registrado além do proprietário. Use o link operacional para novos ingressantes.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBTAB: MUSICSCALE REPERTOIRE */}
                {selectedOrgTab === 'musicscale' && (
                  <div className="space-y-6">
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#050505] p-3 rounded-xl border border-white/5">
                        <div className="text-[10px] text-white/40 uppercase font-mono">Músicas no Repertoiro</div>
                        <div className="text-xl font-bold mt-1 text-[#2B85EB]">{orgSongs.length}</div>
                      </div>
                      <div className="bg-[#050505] p-3 rounded-xl border border-white/5">
                        <div className="text-[10px] text-white/40 uppercase font-mono">Arranjos e Tons</div>
                        <div className="text-xl font-bold mt-1 text-purple-400">{orgScales.length}</div>
                      </div>
                    </div>

                    {/* Repertoire Song Insertion / Modification Form */}
                    <form onSubmit={handleSongSubmit} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-[#F5F7FA] flex items-center gap-1.5 border-b border-white/10 pb-2">
                        <Music className="w-4 h-4 text-[#2B85EB]" />
                        {editingSongId ? 'Modificar detalhes da Música' : 'Injetar Música Administrador'}
                      </h4>

                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Título da canção..."
                          value={songTitle}
                          onChange={e => setSongTitle(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                        
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Artista..."
                            value={songArtist}
                            onChange={e => setSongArtist(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Tom..."
                            value={songKey}
                            onChange={e => setSongKey(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                          <input
                            type="number"
                            placeholder="Bpm..."
                            value={songBpms}
                            onChange={e => setSongBpms(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <textarea
                          placeholder="Letras ou notas administrativas..."
                          value={songLyrics}
                          rows={2}
                          onChange={e => setSongLyrics(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        {editingSongId && (
                          <button
                            type="button"
                            onClick={clearSongForm}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg text-xs"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loadingMSData}
                          className="px-3 py-1.5 bg-[#2B85EB] text-white hover:bg-[#2B85EB]/90 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          {loadingMSData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingSongId ? 'Gravar Alteração' : 'Gravar Nova'}
                        </button>
                      </div>
                    </form>

                    {/* Songs List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[#A0A7B5] uppercase block">Acervo Operacional do Louvor</h4>
                      
                      {loadingMSData ? (
                        <div className="py-10 text-center text-xs text-white/40 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#2B85EB]" />
                          Carregando banco de músicas...
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {orgSongs.map(song => (
                            <div key={song.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-start gap-4">
                              <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-white">{song.title}</p>
                                <p className="text-[10px] text-white/50">{song.artist || 'Sem Artista'} • Tom: {song.key || 'N/A'} • {song.bpms || 0} BPM</p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleEditSongClick(song)}
                                  className="p-1 hover:bg-white/10 rounded text-amber-400"
                                  title="Editar Música"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    customConfirm(`Excluir a música "${song.title}"? Esta operação é definitiva.`, () => handleDeleteSongSubmit(song.id));
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-red-400"
                                  title="Remover Música"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {orgSongs.length === 0 && (
                            <div className="p-6 text-center text-xs text-white/30 border border-dashed border-white/5 rounded-xl">
                              Nenhuma música cadastrada no MusicScale para esta organização.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUBTAB: REPAIR AND HANDOFF */}
                {selectedOrgTab === 'repair' && (
                  <div className="space-y-4">
                    
                    {/* Status de Saúde */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-[#A0A7B5] uppercase block">Resultados Diagnósticos</h4>

                      {/* Diagnostic Alerts */}
                      {!selectedOrg.ownerUserId && (
                        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold">Dono Ausente (Órfã)</p>
                            <p className="text-[10px] opacity-80 mt-0.5">A organização está órfã. Sem vínculo com nenhum UID de usuário de suporte ou CEO.</p>
                          </div>
                        </div>
                      )}

                      {!(selectedOrg.apps?.musicscale?.access) && (
                        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#EAB308' }} />
                          <div>
                            <p className="text-xs font-bold">Acesso ao MusicScale Desativado</p>
                            <p className="text-[10px] opacity-80 mt-0.5">Falta o trigger apps.musicscale.access para ativação do botão no launcher do cliente.</p>
                          </div>
                        </div>
                      )}

                      {selectedOrg.ownerUserId && selectedOrg.apps?.musicscale?.access && (
                        <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                          <Check className="w-5 h-5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold">Saúde Nominal</p>
                            <p className="text-[10px] opacity-80 mt-0.5">Nenhuma anomalia crítica de consistência foi encontrada na raiz do ecossistema.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cirurgias Rápidas */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-semibold text-[#A0A7B5] uppercase block">Cirurgias Rápidas</h4>

                      <div className="bg-[#050505] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-white">Criar Estrutura MusicScale</p>
                          <p className="text-[10px] text-white/50 mt-0.5">Injeta regras mínimas de papéis e canais de louvor padrões necessários para abertura inicial do app.</p>
                        </div>
                        <button
                          disabled={isExecutingRepair}
                          onClick={() => {
                            customConfirm(`Provisionar estrutura inicial do MusicScale em ${selectedOrg.name}? Isso não causará perda de arranjos.`, () => handleRunMSRoutine(selectedOrg.id));
                          }}
                          className="px-3 py-1.5 bg-white/15 hover:bg-white/20 text-white rounded text-xs font-semibold active:scale-95 transition-all whitespace-nowrap"
                        >
                          Executar Routine
                        </button>
                      </div>

                      <div className="bg-[#050505] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-white">Normalizar Plano & Faturamento</p>
                          <p className="text-[10px] text-white/50 mt-0.5">Alinha planos legados legados ou desalinhados no webhook do Stripe e refaz consistência no Firestore.</p>
                        </div>
                        <button
                          disabled={isExecutingRepair}
                          onClick={() => {
                            customConfirm(`Solicitar resincronização de plano faturamento para ${selectedOrg.slug}?`, () => handleNormalizeBillingRoutine(selectedOrg.id));
                          }}
                          className="px-3 py-1.5 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/20 rounded text-xs font-semibold active:scale-95 transition-all whitespace-nowrap"
                        >
                          Normalizar Plano
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DIALOG DE CONFIRMAÇÃO */}
        {confirmAction && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-[#F5F7FA]">Confirmação de Ação Suprema</h3>
              <p className="text-xs text-[#A0A7B5]">{confirmAction.message}</p>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setConfirmAction(null)} 
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                  className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-xs font-semibold"
                >
                  Executar Operação
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG DE ALERTA */}
        {alertMessage && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${alertMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {alertMessage.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <Check className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F7FA]">{alertMessage.title}</h3>
                <p className="text-xs text-[#A0A7B5] mt-1.5">{alertMessage.message}</p>
              </div>
              <button 
                onClick={() => setAlertMessage(null)}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* MODAL: CRIAR ORGANIZAÇÃO CUSTOMIZADA */}
        {createOrgModalUser && (
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0B0F19] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-slide-up">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#F5F7FA]">Criar Nova Organização do Ecossistema</h3>
                  <p className="text-xs text-[#A0A7B5] mt-1">Preencha o nome amigável para o e-mail: <strong>{createOrgModalUser.email}</strong>.</p>
                </div>
                <button 
                  onClick={() => setCreateOrgModalUser(null)} 
                  className="text-white/40 hover:text-white transition-colors text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[#A0A7B5] block uppercase">Nome da Organização</label>
                <input
                  type="text"
                  value={createOrgName}
                  onChange={e => setCreateOrgName(e.target.value)}
                  placeholder="Ex: Igreja Adoração"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#2B85EB] transition-colors"
                  autoFocus
                />
                <p className="text-[10px] text-white/40">Definido por padrão a partir do e-mail (antes do @). Fique à vontade para ajustar.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setCreateOrgModalUser(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateOrgSubmit}
                  disabled={isExecutingRepair || !createOrgName.trim()}
                  className="px-4 py-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isExecutingRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar e Ativar Tenant'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </EcosystemShell>
  );
}
