import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuth } from "../contexts/AuthContext.js";
import { Shield, Users, Search, AlertCircle, Building, Check, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function EcosystemAdmin() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
      
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrganizations(orgsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA]">
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
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#2B85EB]/10 text-[#2B85EB] font-medium text-sm">
              <Users className="w-4 h-4" />
              Usuários e Acessos
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#A0A7B5] hover:bg-white/5 transition-colors font-medium text-sm">
              <Building className="w-4 h-4" />
              Organizações
            </button>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            
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

          </div>
        </div>
      </main>
    </div>
  );
}
