import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "../contexts/AuthContext.js";
import { Shield, Users, Search, AlertCircle, Building, Check, Loader2, User, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EcosystemShell } from "../components/EcosystemShell.js";

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
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'users' | 'analytics'>('users');

  useEffect(() => {
    if (!loading) {
      if (profile?.systemRole !== 'ceo' && profile?.systemRole !== 'admin') {
        navigate('/dashboard');
      } else {
        loadEcosystemData();
      }
    }
  }, [loading, profile, navigate]);

  const loadEcosystemData = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, "users")));
      const orgsSnap = await getDocs(query(collection(db, "organizations")));
      const analyticsSnap = await getDocs(query(collection(db, "analytics_events")));
      
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrganizations(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAnalyticsEvents(analyticsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string | undefined, newRole: string | null) => {
    if (!window.confirm(`Tem certeza que deseja atualizar o nível de acesso deste usuário?`)) return;
    
    try {
      await updateDoc(doc(db, "users", userId), {
        systemRole: newRole === 'user' ? null : newRole
      });
      await loadEcosystemData();
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Erro ao atualizar função.");
    }
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
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.photoURL ? (
                              <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="avatar" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-[#A0A7B5]" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-[#F5F7FA]">{user.displayName || 'Sem nome'}</p>
                              <p className="text-xs text-[#A0A7B5]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#A0A7B5]">
                          {organizations.find(o => o.id === user.organizationId)?.name || <span className="text-white/20">Nenhuma</span>}
                        </td>
                        <td className="px-6 py-4">
                          {user.systemRole === 'ceo' && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20">
                              CEO
                            </span>
                          )}
                          {user.systemRole === 'admin' && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-[#2B85EB]/10 text-[#2B85EB] text-xs font-semibold border border-[#2B85EB]/20">
                              Admin Global
                            </span>
                          )}
                          {!user.systemRole && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 text-[#A0A7B5] text-xs border border-white/10">
                              Usuário Padrão
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {profile?.systemRole === 'ceo' && user.id !== profile.uid && (
                            <select
                              value={user.systemRole || 'user'}
                              onChange={(e) => handleUpdateRole(user.id, user.systemRole, e.target.value)}
                              className="bg-[#050505] border border-white/10 rounded-lg px-2 py-1 text-xs text-[#F5F7FA] focus:outline-none"
                            >
                              <option value="user">Remover Acesso Global</option>
                              <option value="admin">Tornar Admin Global</option>
                              <option value="ceo">Tornar CEO</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>)}

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
    </EcosystemShell>
  );
}
