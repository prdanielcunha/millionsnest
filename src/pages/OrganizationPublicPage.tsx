import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.js';
import { Building2, Users, LayoutGrid, Check, Server, Shield, Sparkles, MapPin, ChevronRight, User, X, Loader2 } from 'lucide-react';
import { MillionsNestLogo } from '../components/MillionsNestLogo.js';
import { ECOSYSTEM_APPS } from '../lib/apps.js';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  enabledApps: string[];
  createdAt: string | null;
}

interface PublicMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  role: string;
}

export function OrganizationPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [org, setOrg] = useState<PublicOrg | null>(null);
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Check if current user is part of this org
  const isMember = profile?.organizationId === org?.id || profile?.organizations?.includes(org?.id || '');
  const userRole = isMember ? profile?.organizationRole || 'member' : null;
  const isAdmin = userRole === 'owner' || userRole === 'admin' || profile?.systemRole === 'ceo' || profile?.systemRole === 'global_admin';

  const handleGenerateInvite = async () => {
     if (!isAdmin || !org) return;
     setGeneratingInvite(true);
     try {
         const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
         await addDoc(collection(db, 'organizations', org.id, 'invites'), {
             code: inviteCode,
             role: inviteRole,
             createdAt: new Date(),
             createdBy: user?.uid,
             expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
         });
         
         const text = `Você foi convidado para a organização *${org.name}* no MillionsNest como ${
            inviteRole === 'admin' ? 'Administrador' : inviteRole === 'leader' ? 'Líder' : 'Membro'
         }.\n\nPara acessar, clique no link abaixo e confirme seu convite:\nhttps://millionsnest.com/join/${inviteCode}`;
         
         if (navigator.share) {
             navigator.share({
                 title: `Convite - ${org.name}`,
                 text: text,
                 url: `https://millionsnest.com/join/${inviteCode}`
             }).catch(() => {
                 navigator.clipboard.writeText(text);
                 alert('Link e instrução copiados!');
             });
         } else {
             navigator.clipboard.writeText(text);
             alert('Link e instrução copiados para a área de transferência!');
         }
         setIsInviteModalOpen(false);
     } catch (e) {
         console.error(e);
         alert('Erro ao gerar convite.');
     } finally {
         setGeneratingInvite(false);
     }
  };

  useEffect(() => {
    async function loadPublicData() {
      if (!slug) return;
      try {
        setLoading(true);
        setError(null);
        
        const orgRes = await fetch(`/api/public/organizations/by-slug/${slug}`);
        if (!orgRes.ok) {
          if (orgRes.status === 404) {
            setError('NotFound');
          } else {
            setError('Error');
          }
          return;
        }

        const orgData = await orgRes.json();
        
        // Auto redirect to new slug if it was a legacy/redirect slug
        if (orgData.slug && orgData.slug !== slug) {
           navigate(`/${orgData.slug}`, { replace: true });
           return;
        }

        setOrg(orgData);

        const memRes = await fetch(`/api/public/organizations/${orgData.id}/members`);
        if (memRes.ok) {
          const memData = await memRes.json();
          setMembers(memData.members || []);
        }
      } catch (err) {
        console.error(err);
        setError('Error');
      } finally {
        setLoading(false);
      }
    }
    loadPublicData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#2B85EB]/30 border-t-[#2B85EB] animate-spin" />
      </div>
    );
  }

  if (error === 'NotFound' || !org) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <MillionsNestLogo className="h-10 w-auto mb-8 opacity-50" />
        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
          <Building2 className="w-8 h-8 text-[#A0A7B5]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Organização não encontrada</h1>
        <p className="text-[#A0A7B5] max-w-md mx-auto mb-8">
          A página que você está tentando acessar não existe ou o endereço foi alterado. Verifique o link e tente novamente.
        </p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-white text-[#050505] rounded-xl font-semibold hover:bg-white/90 transition-colors">
          Voltar para Início
        </button>
      </div>
    );
  }

  const roleText = (role: string) => {
    switch (role) {
      case 'owner': return 'Dono';
      case 'admin': return 'Administrador';
      case 'leader': return 'Líder';
      default: return 'Membro';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
      case 'admin': return 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20';
      case 'leader': return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
      default: return 'bg-white/5 text-[#A0A7B5] border-white/10';
    }
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navbar Minimalista */}
      <nav className="border-b border-white/5 bg-[#050505]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
            <MillionsNestLogo className="h-7 w-auto" />
          </button>
          
          <div className="flex items-center gap-4">
            {user ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
                Dashboard
              </button>
            ) : (
              <button onClick={() => navigate('/login')} className="text-sm font-semibold text-[#050505] bg-[#F5F7FA] hover:bg-white px-4 py-2 rounded-lg transition-colors">
                Entrar
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-16">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#0A0D14] rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
              {org.logo ? (
                <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#A0A7B5]" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{org.name}</h1>
                <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/20" title="Organização no Ecossistema">
                  <Check className="w-3 h-3 text-[#10B981]" />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#A0A7B5]">
                {org.city && (
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {org.city}{org.state ? `, ${org.state}` : ''}</span>
                )}
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {members.length} membros</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 w-full md:w-auto">
             {!user && (
               <button onClick={() => navigate('/login')} className="px-6 py-3 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] w-full md:w-auto flex items-center justify-center gap-2">
                 Entrar para acessar
               </button>
             )}
             {user && !isMember && (
               <div className="px-5 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl text-center md:text-left text-[#F59E0B] text-sm font-medium">
                 Você está logado, mas não faz parte desta organização.
               </div>
             )}
             {user && isMember && (
                <div className="flex flex-col md:items-end gap-3 w-full">
                  {isAdmin && (
                    <div className="flex flex-col items-center md:items-end w-full">
                        <div className="bg-[#1A1F2E]/80 backdrop-blur-md border border-[#2B85EB]/20 rounded-2xl p-4 w-full md:w-auto shadow-lg relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-[#2B85EB]"></div>
                           <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#2B85EB] mb-3 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Administração</h3>
                           <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                              <button onClick={() => navigate('/dashboard/organization')} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-white transition-colors">Organização</button>
                              <button onClick={() => navigate('/dashboard/team')} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-white transition-colors">Equipe</button>
                              <button onClick={() => navigate('/dashboard/apps')} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-white transition-colors">Apps</button>
                              <button onClick={() => navigate('/dashboard/billing')} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-white transition-colors">Assinatura</button>
                              <button onClick={() => setIsInviteModalOpen(true)} className="text-xs bg-[#2B85EB]/10 border border-[#2B85EB]/20 hover:bg-[#2B85EB]/20 px-3 py-1.5 rounded-lg text-[#2B85EB] transition-colors font-semibold">Convidar Membros</button>
                           </div>
                        </div>
                    </div>
                  )}
                </div>
             )}
          </div>
        </motion.div>

        {org.description && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-16 max-w-3xl">
            <h2 className="text-xl font-semibold text-white mb-4">Sobre a Organização</h2>
            <p className="text-[#A0A7B5] leading-relaxed text-lg">{org.description}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           {/* APPS COLUMN */}
           <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                 <h2 className="text-xl font-semibold text-white flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-[#2B85EB]" /> Aplicativos Habilitados</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {ECOSYSTEM_APPS.map((app, idx) => {
                    // Check if app is enabled or is MusicScale
                     const isEnabled = app.id === 'musicscale' || org.enabledApps.includes(app.id);
                     if (!isEnabled) return null;

                     return (
                       <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (idx * 0.05) }} className="bg-[#0A0D14] border border-white/5 rounded-2xl p-5 hover:bg-[#0F1219] hover:border-white/10 transition-all flex flex-col justify-between h-full">
                         <div>
                            <div className="w-12 h-12 rounded-xl bg-[#2B85EB]/10 border border-[#2B85EB]/20 flex items-center justify-center text-[#2B85EB] mb-4">
                               <LayoutGrid className="w-6 h-6" /> 
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{app.name}</h3>
                            <p className="text-sm text-[#A0A7B5] mb-6">{app.description}</p>
                         </div>
                         
                         <div className="flex items-center justify-between mt-auto">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A7B5]">Módulo Ativo</span>
                            {user && isMember ? (
                               <button onClick={() => {
                                 if (app.id === 'musicscale') {
                                    import('../packages/events/index.js').then(({ eventBus }) => {
                                      eventBus.publish('action.contextual.open_musicscale', {
                                         organizationId: org.id,
                                         userId: user.uid,
                                         appSource: 'core'
                                      } as any);
                                    });
                                 } else {
                                   navigate(`/dashboard/apps`);
                                 }
                               }} className="flex items-center gap-1.5 text-sm font-semibold text-[#2B85EB] hover:text-[#3B95FB]">
                                 Abrir App <ChevronRight className="w-4 h-4" />
                               </button>
                            ) : (
                               <button onClick={() => navigate('/login')} className="text-sm font-medium text-white/50 hover:text-white transition-colors">
                                 Requer Acesso
                               </button>
                            )}
                         </div>
                       </motion.div>
                     )
                 })}
                 {org.enabledApps.length === 0 && (
                   <div className="col-span-1 md:col-span-2 bg-[#0A0D14] border border-white/5 rounded-2xl p-8 flex flex-col items-center text-center">
                      <Server className="w-12 h-12 text-[#A0A7B5] mb-4 opacity-50" />
                      <p className="text-white font-medium mb-1">Nenhum aplicativo ativo</p>
                      <p className="text-sm text-[#A0A7B5]">Esta organização ainda não ativou módulos adicionais.</p>
                   </div>
                 )}
              </div>
           </div>

           {/* MEMBERS COLUMN */}
           <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                 <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#10B981]" /> Equipe</h2>
              </div>

              <div className="bg-[#0A0D14] border border-white/5 rounded-2xl p-5 flex flex-col gap-1 max-h-[600px] overflow-y-auto custom-scrollbar">
                 {members.length > 0 ? members.map((m, idx) => (
                    <div key={m.uid} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                       <div className="w-10 h-10 rounded-full bg-[#1A1F2E] flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                         {m.photoURL ? (
                           <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover" />
                         ) : (
                           <User className="w-5 h-5 text-[#A0A7B5]" />
                         )}
                       </div>
                       <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{m.displayName}</p>
                          <p className="text-xs text-[#A0A7B5] mt-0.5 truncate flex justify-start">
                             <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest border ${getRoleBadgeColor(m.role)}`}>
                               {roleText(m.role)}
                             </span>
                          </p>
                       </div>
                    </div>
                 )) : (
                    <div className="py-10 text-center flex flex-col items-center">
                       <Users className="w-8 h-8 text-white/20 mb-3" />
                       <p className="text-sm text-[#A0A7B5]">A equipe desta organização ainda está sendo configurada.</p>
                    </div>
                 )}
              </div>
              
              <div className="bg-[#1A1A24]/30 border border-white/5 rounded-2xl p-5">
                 <div className="flex items-center gap-2 mb-3">
                   <Shield className="w-4 h-4 text-[#A0A7B5]" />
                   <h3 className="text-sm font-semibold text-white">Sobre os Acessos</h3>
                 </div>
                 <p className="text-xs text-[#A0A7B5] leading-relaxed">
                   Os membros desta organização possuem acesso seguro e autenticado aos módulos liberados pelo administrador. Acesse o seu dashboard para ver convites pendentes e gerenciar seu perfil no ecossistema MillionsNest.
                 </p>
              </div>

           </div>
        </div>

      </main>

      {/* MODAL DE CONVITE */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[#0B0F19] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <button onClick={() => setIsInviteModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#A0A7B5] hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
              
              <div className="mb-6">
                <div className="w-12 h-12 bg-[#2B85EB]/10 border border-[#2B85EB]/20 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[#2B85EB]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Convidar Membro</h3>
                <p className="text-sm text-[#A0A7B5]">Gere um link seguro para {org?.name}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-semibold text-[#A0A7B5] mb-2 pl-1 block">Nível de Acesso Inicial</label>
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)} 
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#F5F7FA] outline-none hover:border-white/20 focus:border-[#2B85EB] transition-colors appearance-none"
                  >
                    <option value="member">Membro Padrão</option>
                    <option value="leader">Líder (Pode gerenciar pessoas)</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleGenerateInvite} 
                  disabled={generatingInvite} 
                  className="w-full flex items-center justify-center gap-2 bg-[#2B85EB] hover:bg-[#2B85EB]/80 text-white font-medium px-4 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(43,133,235,0.3)] disabled:opacity-50"
                >
                  {generatingInvite ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link className="w-5 h-5" />}
                  Gerar Link e Copiar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
