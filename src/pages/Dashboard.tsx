import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext.js";
import { Navigate } from "react-router-dom";
import { 
  Music, ArrowRight, Settings, ExternalLink, ShieldCheck, 
  CreditCard, LayoutGrid, User, Clock, AlertCircle, ChevronRight, Building2,
  Star, Zap, Headphones, Video, ListMusic, Check, Users, Link, Mail, Plus, X, Loader2, Copy
} from "lucide-react";
import { Navbar } from "../components/Navbar.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, getDocs, query, where, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";

type Tab = "overview" | "organization" | "account" | "billing";

export function Dashboard() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [subscription, setSubscription] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Organization Edit States
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  
  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Invite Link states
  const [copiedLink, setCopiedLink] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const [prices, setPrices] = useState({ 
    starter_monthly: 0,
    starter_annual: 0,
    pro_monthly: 0, 
    pro_annual: 0,
    setup_premium: 0,
    training_express: 0,
    worship_100: 0,
    music_pack_10: 0
  });
  const [plansData, setPlansData] = useState<any[]>([]);
  const [addonsData, setAddonsData] = useState<any[]>([]);
  const [isAnnual, setIsAnnual] = useState(true);

  const openBillingPortal = async () => {
    if (!user) return;
    try {
      setCheckoutLoading(true);
      const res = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        if (res.status === 404 || res.status === 500 || data.error?.includes('Stripe não encontrado') || data.error?.includes('No such customer')) {
          alert('Inconsistência identificada na conta. Sincronizando e reparando acesso...');
          await fetchSubscriptionAndOrg(true);
          return;
        }
        alert(data.error || 'Erro ao carregar o portal. Verifique sua assinatura.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de comunicação.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const fetchSubscriptionAndOrg = async (forceSync = false, passedSessionId?: string) => {
    if (!user) return;
    try {
      console.log("[Dashboard] Fetching subscription and org for:", user.uid);
      
      if (forceSync) {
        setLoadingSub(true);
        console.log("[Dashboard] Automatic silent sync with Stripe...");
        try {
          const syncRes = await fetch('/api/v1/billing/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid, sessionId: passedSessionId })
          });
          
          if (syncRes.ok) {
             const syncData = await syncRes.json();
             console.log("[Dashboard] Sync Result:", syncData.status);
          }
        } catch (e) {
          console.error("[Dashboard] Background sync failed silently.");
        }
      }

      const subRef = doc(db, "subscriptions", user.uid);
      const subSnap = await getDoc(subRef);
      
      if (subSnap.exists()) {
         const data = subSnap.data();
         setSubscription(data);
         // If trialing, we check Stripe one more time silently to see if it moved to active
         if (data.status === 'trialing' && !forceSync) {
           fetch('/api/v1/billing/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.uid })
           }).then(r => r.json()).then(res => {
              if (res.stripeStatus === 'active') {
                console.log("[Dashboard] Stripe confirmed active status via background sync.");
                fetchSubscriptionAndOrg(false);
              }
           }).catch(err => console.debug("[Dashboard] Background check ignored."));
         }
      } else {
         setSubscription(null);
         // If user is logged in but has no sub doc, maybe try one sync if we don't have sub state
         if (!forceSync) {
           console.log("[Dashboard] No sub doc found, attempt one sync...");
           // fetchSubscriptionAndOrg(true); // Don't loop infinitely
         }
      }

      // Org is usually 1:1 right now (orgId === user.uid)
      const orgId = profile?.organizationId || user.uid;
      const orgRef = doc(db, "organizations", orgId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        setOrganization(orgSnap.data());
      } else {
        setOrganization(null);
      }

      // Fetch org members
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("organizationId", "==", orgId));
        const membersSnap = await getDocs(q);
        const mems = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMembers(mems);
      } catch (err) {
        console.error("Erro ao buscar membros", err);
      }

    } catch (error) {
      console.error("[Dashboard] Error fetching data:", error);
      setSubscription(null);
      setOrganization(null);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (organization?.name) {
      setOrgNameInput(organization.name);
    }
  }, [organization]);

  useEffect(() => {
    if (profile?.displayName) {
      setProfileNameInput(profile.displayName);
    }
  }, [profile]);
  
  const handleSaveOrg = async () => {
    if (!user || !orgNameInput.trim()) return;
    setSavingOrg(true);
    try {
      const orgId = profile?.organizationId || user.uid;
      const res = await fetch('/api/user/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, name: orgNameInput })
      });
      if (!res.ok) throw new Error('Failed to save');
      setOrganization({ ...organization, name: orgNameInput });
      setIsEditingOrg(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar organização.");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profileNameInput.trim()) return;
    setSavingProfile(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: profileNameInput });
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      // update in users collection
      const userRef = doc(db, "users", memberId);
      await updateDoc(userRef, { role: newRole });
      
      // update in organization_members collection
      const orgId = profile?.organizationId || user?.uid;
      const memberOrgRef = doc(db, "organization_members", `${memberId}_${orgId}`);
      await updateDoc(memberOrgRef, { role: newRole });
      
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (e) {
      console.error("Erro ao atualizar função", e);
      alert("Erro ao atualizar função do membro.");
    }
  };

  const handleInviteWhatsapp = () => {
    const orgId = profile?.organizationId || user?.uid;
    const link = `${window.location.origin}/login?org=${orgId}`;
    const text = encodeURIComponent(`Olá! Quero te convidar para acessar nossa organização no ecossistema MillionsNest.\n\nAcesse: ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    const orgId = profile?.organizationId || user?.uid;
    const link = `${window.location.origin}/login?org=${orgId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const addonSuccess = urlParams.get('addon_success');

    if (addonSuccess) {
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('Returned from Addon checkout:', addonSuccess);
      alert(`Compra de ${addonSuccess.replace(/_/g, ' ')} concluída com sucesso! Obrigado!`);
      setLoadingSub(true);
      fetchSubscriptionAndOrg(true);
      return;
    }

    if (sessionId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('Returned from Stripe session:', sessionId);
      // TODO: Criar suporte visual futuro no MillionsNest: "Cupom aplicado com sucesso"
      // Aqui podemos checar se houve desconto na session e exibir uma notificação.
      setLoadingSub(true);
      fetchSubscriptionAndOrg(true, sessionId); // Forçar sync total ao voltar do Stripe
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptionAndOrg();
    fetch('/api/v1/billing/products')
      .then(res => res.json())
      .then(data => {
         if (data.plans) setPlansData(data.plans);
         if (data.addons) setAddonsData(data.addons);
         
         setPrices(prev => {
           const newPrices = { ...prev };
           
           // Extract plans (strictly by lookupKey)
           const starterMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_monthly');
           const starterAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_starter_yearly');
           const proMonthly = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_monthly');
           const proAnnual = data.plans?.find((p: any) => p.lookupKey === 'musicscale_pro_yearly');
           
           if (starterMonthly) newPrices.starter_monthly = starterMonthly.price;
           if (starterAnnual) newPrices.starter_annual = starterAnnual.price;
           if (proMonthly) newPrices.pro_monthly = proMonthly.price;
           if (proAnnual) newPrices.pro_annual = proAnnual.price;
           
           // Extract addons (strictly by lookupKey)
           data.addons?.forEach((addon: any) => {
             if (addon.lookupKey === 'musicscale_setup_premium') newPrices.setup_premium = addon.price;
             if (addon.lookupKey === 'musicscale_training_express') newPrices.training_express = addon.price;
             if (addon.lookupKey === 'musicscale_worship_100') newPrices.worship_100 = addon.price;
             if (addon.lookupKey === 'musicscale_music_pack_10') newPrices.music_pack_10 = addon.price;
           });
           
           return newPrices;
         });
      })
      .catch(err => console.error(err));
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2B85EB] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasMusicScaleAccess = profile?.products?.includes("musicscale") || false;
  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const isCanceled = subscription?.status === "canceled";
  const hasValidSubscription = isActive || isTrialing;
  const showMusicScaleCard = hasMusicScaleAccess || subscription != null;

  const formattedRenewal = subscription?.currentPeriodEnd 
    ? new Date((subscription.currentPeriodEnd.seconds || subscription.currentPeriodEnd._seconds || 0) * 1000).toLocaleDateString('pt-BR') 
    : null;

  const handleAddonCheckout = async (lookupKey: string) => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/v1/billing/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email, lookupKey })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert("Erro ao iniciar checkout: " + data.error);
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao conectar com o servidor.");
      setCheckoutLoading(false);
    }
  };

  const handleSubscribe = async (lookupKey: string) => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email, lookupKey })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Erro ao iniciar checkout');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de comunicação com o servidor de pagamento');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F7FA]">
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#2B85EB]/5 blur-[150px] rounded-full pointer-events-none" />
      <Navbar />
      
      {/* Secondary Navigation */}
      <div className="bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 pt-24 md:pt-32 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "overview" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab("organization")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "organization" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Organização
          </button>
          <button 
            onClick={() => setActiveTab("billing")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "billing" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Valores e Assinatura
          </button>
          <button 
            onClick={() => setActiveTab("account")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "account" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Minha Conta
          </button>
        </div>
      </div>
      
      <main className="py-12 max-w-7xl mx-auto px-6 relative z-10">
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5 mb-2"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" loading="lazy" decoding="async" className="w-16 h-16 rounded-2xl border border-white/10 shadow-sm" />
            ) : (
              <div className="w-16 h-16 bg-[#0B0F19] rounded-2xl flex items-center justify-center text-[#F5F7FA] font-bold text-2xl border border-white/10 shadow-sm">
                {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#F5F7FA] tracking-tight">
                Olá, {profile?.displayName?.split(' ')[0] || user.email?.split('@')[0]}
              </h1>
              <p className="text-[#A0A7B5] text-sm md:text-base mt-1">
                Gerencie seus aplicativos e conexões do ecossistema MillionsNest.
              </p>
            </div>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <LayoutGrid className="w-4 h-4 text-[#A0A7B5]" />
                  </span>
                  Seus Apps e Produtos
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* MusicScale Card(s) */}
                {hasValidSubscription ? (
                  <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/5 shadow-2xl flex flex-col h-full transform transition-all duration-300 hover:border-white/10 hover:shadow-[0_0_40px_rgba(43,133,235,0.05)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#2B85EB]/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110 blur-xl" />

                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 bg-[#050505] rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
                        <Music className="w-6 h-6 text-[#2B85EB]" />
                      </div>
                      
                      {loadingSub ? (
                        <div className="h-6 w-20 bg-white/5 rounded-full animate-pulse" />
                      ) : isTrialing ? (
                        <span className="px-3 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold rounded-full border border-[#F59E0B]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                          <Clock className="w-3.5 h-3.5" /> Trial
                        </span>
                      ) : isActive ? (
                        <span className="px-3 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold rounded-full border border-[#10B981]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-white/5 text-[#A0A7B5] text-[10px] font-bold rounded-full border border-white/10 uppercase tracking-widest shadow-sm">
                           Sem Assinatura
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-2xl font-semibold text-[#F5F7FA] tracking-tight mb-2 flex items-center gap-2">
                      MusicScale {subscription?.tier && <span className="text-[#2B85EB] uppercase text-sm tracking-wider font-bold bg-[#2B85EB]/10 px-2 py-0.5 rounded-md border border-[#2B85EB]/20">{subscription.tier === 'pro' ? 'Pró' : 'Starter'}</span>}
                    </h3>
                    
                    <p className="text-[#A0A7B5] text-sm mb-6 flex-1 font-normal leading-relaxed">
                      A plataforma completa para gestão e escalas de ministérios de louvor, integrada ao ecossistema central.
                    </p>

                    {(subscription && subscription.status !== 'none' || loadingSub) && (
                      <div className="mb-6 bg-[#050505] rounded-2xl p-5 border border-white/5 relative overflow-hidden group shadow-inner">
                        {loadingSub ? (
                          <div className="flex flex-col gap-2 py-2 animate-pulse">
                            <div className="h-3 w-20 bg-white/5 rounded"></div>
                            <div className="h-4 w-32 bg-white/5 rounded"></div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="text-[9px] text-[#A0A7B5] font-bold uppercase tracking-widest mb-2">Status da Assinatura</p>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border ${
                                    subscription.status === 'active' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' :
                                    subscription.status === 'trialing' ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' :
                                    'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                                  }`}>
                                    {subscription.status === 'trialing' ? 'Trial Ativo' : subscription.status === 'active' ? 'Ativo' : subscription.status}
                                  </span>
                                  <span className="text-xs font-semibold text-[#F5F7FA]">
                                    {subscription?.plan === 'annual' ? 'Plano Anual' : 'Plano Mensal'}
                                  </span>
                                </div>
                              </div>
                              <div className="w-8 h-8 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4 text-[#A0A7B5]" />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[#A0A7B5]">Próximo Faturamento</span>
                                <span className="font-semibold text-[#F5F7FA]">
                                  {formattedRenewal || "Sincronizando..."}
                                </span>
                              </div>
                              
                              {subscription?.status === 'trialing' && (
                                <div className="flex items-start gap-2 p-3 bg-[#2B85EB]/10 rounded-xl border border-[#2B85EB]/20 mt-3">
                                  <Clock className="w-3.5 h-3.5 text-[#2B85EB] mt-0.5 flex-shrink-0" />
                                  <p className="text-[11px] text-[#2B85EB] font-medium leading-relaxed">
                                    Seu teste grátis termina em <strong className="font-bold text-[#F5F7FA]">{formattedRenewal}</strong>. Nenhuma cobrança será feita até lá.
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 mt-auto">
                      <a 
                        href="https://musicscale.millionsnest.com" 
                        target="_blank" rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white transition-all shadow-sm active:scale-95 mt-auto"
                      >
                        Abrir App
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </a>
                      {subscription?.stripeCustomerId && (
                        <button
                          onClick={openBillingPortal}
                          className="w-full py-3 px-4 mt-2 bg-white/5 text-[#A0A7B5] border border-white/5 rounded-xl font-semibold flex items-center justify-center hover:bg-white/10 hover:text-[#F5F7FA] transition-all active:scale-95"
                        >
                          <Settings className="w-4 h-4 mr-2" /> Gerenciar Assinatura
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* MusicScale Pro Card */}
                    <div className="bg-[#0B0F19]/70 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-[#2B85EB]/40 shadow-2xl flex flex-col h-full transform transition-all duration-300 hover:border-[#2B85EB]/80 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#2B85EB]/10 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110 blur-xl" />

                      <div className="flex items-start justify-between mb-6">
                        <div className="w-14 h-14 bg-[#2B85EB]/10 rounded-2xl flex items-center justify-center border border-[#2B85EB]/20 shadow-inner">
                          <Music className="w-6 h-6 text-[#2B85EB]" />
                        </div>
                        <span className="px-3 py-1 bg-white/5 text-[#A0A7B5] text-[10px] font-bold rounded-full border border-white/10 uppercase tracking-widest shadow-sm">
                           Sem Assinatura
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-semibold text-[#F5F7FA] tracking-tight mb-2 flex items-center gap-2">
                        MusicScale <span className="text-[#2B85EB] uppercase text-sm tracking-wider font-bold bg-[#2B85EB]/10 px-2 py-0.5 rounded-md border border-[#2B85EB]/20">Pró</span>
                      </h3>
                      <p className="text-[#A0A7B5] text-sm mb-6 flex-1 font-normal leading-relaxed">
                        Acesso total. Equipes ilimitadas, repertório ilimitado, notificações automatizadas no Whatsapp e métricas de desempenho.
                      </p>

                      <div className="flex flex-col gap-3 relative mt-auto">
                        <button 
                          onClick={() => handleSubscribe('musicscale_pro_yearly')}
                          disabled={checkoutLoading}
                          className="w-full py-4 px-4 bg-[#2B85EB] text-[#F5F7FA] rounded-xl font-semibold flex-col flex items-center justify-center hover:bg-[#3B95FB] transition-all shadow-sm active:scale-95 relative overflow-hidden disabled:opacity-70"
                        >
                          <span className="absolute top-0 right-0 bg-[#050505]/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-widest border-b border-l border-white/10">20% OFF</span>
                          <span className="flex items-center gap-2">
                            Assinatura Anual <ArrowRight className="w-4 h-4" />
                          </span>
                          <span className="text-xs text-white/90 mt-1 font-bold">R$ {(prices.pro_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                          <span className="text-[10px] text-white/70 font-medium">7 dias grátis, depois R$ {prices.pro_annual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ano</span>
                        </button>

                        <button 
                          onClick={() => handleSubscribe('musicscale_pro_monthly')}
                          disabled={checkoutLoading}
                          className="w-full py-3 px-4 bg-transparent text-[#F5F7FA] border border-white/10 rounded-xl font-semibold flex flex-col items-center justify-center hover:bg-white/5 transition-all active:scale-95 disabled:opacity-70"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            Assinatura Mensal
                          </span>
                          <span className="text-[10px] text-[#A0A7B5] font-medium mt-1">7 dias grátis, depois R$ {prices.pro_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                        </button>
                      </div>
                    </div>

                    {/* MusicScale Starter Card */}
                    <div className="bg-[#0B0F19]/30 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/5 shadow-2xl flex flex-col h-full transform transition-all duration-300 hover:border-white/10 relative overflow-hidden group">
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-14 h-14 bg-[#050505] rounded-2xl flex items-center justify-center border border-white/5 shadow-inner opacity-70">
                          <Music className="w-6 h-6 text-[#A0A7B5]" />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-semibold text-[#F5F7FA] tracking-tight mb-2 flex items-center gap-2">
                        MusicScale <span className="text-[#A0A7B5] uppercase text-sm tracking-wider font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10">Starter</span>
                      </h3>
                      <p className="text-[#A0A7B5] text-sm mb-6 flex-1 font-normal leading-relaxed opacity-80">
                        O essencial. Gestão básica de equipe, escalas padrão e controle de repertório simplificado sem automações avançadas.
                      </p>

                      <div className="flex flex-col gap-3 relative mt-auto">
                        <button 
                          onClick={() => handleSubscribe('musicscale_starter_yearly')}
                          disabled={checkoutLoading}
                          className="w-full py-4 px-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold flex-col flex items-center justify-center hover:bg-white transition-all shadow-sm active:scale-95 relative overflow-hidden disabled:opacity-70"
                        >
                          <span className="absolute top-0 right-0 bg-black/5 text-[#050505] text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-widest border-b border-l border-black/10">20% OFF</span>
                          <span className="flex items-center gap-2">
                            Assinatura Anual <ArrowRight className="w-4 h-4" />
                          </span>
                          <span className="text-xs text-[#050505]/70 mt-1 font-bold">R$ {(prices.starter_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                          <span className="text-[10px] text-[#050505]/50 font-medium">7 dias grátis, depois R$ {prices.starter_annual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ano</span>
                        </button>

                        <button 
                          onClick={() => handleSubscribe('musicscale_starter_monthly')}
                          disabled={checkoutLoading}
                          className="w-full py-3 px-4 bg-transparent text-[#F5F7FA] border border-white/10 rounded-xl font-semibold flex flex-col items-center justify-center hover:bg-white/5 transition-all active:scale-95 disabled:opacity-70"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            Assinatura Mensal
                          </span>
                          <span className="text-[10px] text-[#A0A7B5] font-medium mt-1">7 dias grátis, depois R$ {prices.starter_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Placeholder */}
                <div className="bg-[#0B0F19]/30 rounded-[2rem] p-6 md:p-8 border border-white/5 border-dashed flex flex-col justify-center items-center text-center group transition-all hover:bg-[#0B0F19]/50 hover:border-white/10">
                  <div className="w-16 h-16 bg-[#050505] rounded-2xl flex items-center justify-center mb-6 text-[#A0A7B5] shadow-inner border border-white/5 transition-transform group-hover:scale-105">
                     <LayoutGrid className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#A0A7B5] tracking-tight mb-2">Comunicação e Analytics</h3>
                  <p className="text-[#A0A7B5]/60 text-sm font-normal px-4">
                    Estamos construindo novas integrações de gestão e relatórios para o ecossistema.
                  </p>
                </div>
              </div>

              {/* Addons Section */}
              <div className="mt-16">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                      <Zap className="w-4 h-4 text-[#F59E0B]" />
                    </span>
                    Potencialize seu Ministério
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Setup Premium */}
                  <div className="bg-[#0B0F19]/50 rounded-2xl p-6 border border-white/5 flex flex-col transition-all hover:border-white/10 hover:bg-[#0B0F19]/80 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#2B85EB]/10 rounded-bl-[80px] -z-10 blur-xl group-hover:scale-125 transition-transform" />
                    <h4 className="text-[#F5F7FA] font-semibold text-sm mb-2">Setup Premium</h4>
                    <p className="text-[#A0A7B5] text-xs leading-relaxed flex-1 mb-4">Avaliação completa, relatórios e plano de ação estruturado para sua equipe.</p>
                    <div className="text-lg font-semibold text-[#F5F7FA] mb-4">
                      R$ {prices.setup_premium > 0 ? prices.setup_premium.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "..."}
                    </div>
                    <button 
                      onClick={() => handleSubscribe('musicscale_setup_premium')}
                      disabled={checkoutLoading}
                      className="w-full py-2.5 px-4 bg-white/5 text-[#F5F7FA] text-xs font-semibold rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Treinamento Express */}
                  <div className="bg-[#0B0F19]/50 rounded-2xl p-6 border border-white/5 flex flex-col transition-all hover:border-white/10 hover:bg-[#0B0F19]/80 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 rounded-bl-[80px] -z-10 blur-xl group-hover:scale-125 transition-transform" />
                    <h4 className="text-[#F5F7FA] font-semibold text-sm mb-2">Treinamento Express</h4>
                    <p className="text-[#A0A7B5] text-xs leading-relaxed flex-1 mb-4">Acesso a workshops rápidos para desenvolver habilidades técnicas e espirituais.</p>
                    <div className="text-lg font-semibold text-[#F5F7FA] mb-4">
                      R$ {prices.training_express > 0 ? prices.training_express.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "..."}
                    </div>
                    <button 
                       onClick={() => handleSubscribe('musicscale_training_express')}
                       disabled={checkoutLoading}
                       className="w-full py-2.5 px-4 bg-white/5 text-[#F5F7FA] text-xs font-semibold rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Worship 100 */}
                  <div className="bg-[#0B0F19]/50 rounded-2xl p-6 border border-white/5 flex flex-col transition-all hover:border-white/10 hover:bg-[#0B0F19]/80 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#10B981]/10 rounded-bl-[80px] -z-10 blur-xl group-hover:scale-125 transition-transform" />
                    <h4 className="text-[#F5F7FA] font-semibold text-sm mb-2">Acervo Worship 100</h4>
                    <p className="text-[#A0A7B5] text-xs leading-relaxed flex-1 mb-4">Acesso instantâneo a 100 cifras e recursos exclusivos de worship.</p>
                    <div className="text-lg font-semibold text-[#F5F7FA] mb-4">
                      R$ {prices.worship_100 > 0 ? prices.worship_100.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "..."}
                    </div>
                    <button 
                       onClick={() => handleSubscribe('musicscale_worship_100')}
                       disabled={checkoutLoading}
                       className="w-full py-2.5 px-4 bg-white/5 text-[#F5F7FA] text-xs font-semibold rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Music Pack +10 */}
                  <div className="bg-[#0B0F19]/50 rounded-2xl p-6 border border-white/5 flex flex-col transition-all hover:border-white/10 hover:bg-[#0B0F19]/80 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-bl-[80px] -z-10 blur-xl group-hover:scale-125 transition-transform" />
                    <h4 className="text-[#F5F7FA] font-semibold text-sm mb-2">Music Pack +10</h4>
                    <p className="text-[#A0A7B5] text-xs leading-relaxed flex-1 mb-4">Pacote adicional de 10 músicas premium com todos os recursos.</p>
                    <div className="text-lg font-semibold text-[#F5F7FA] mb-4">
                      R$ {prices.music_pack_10 > 0 ? prices.music_pack_10.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "..."}
                    </div>
                    <button 
                       onClick={() => handleSubscribe('musicscale_music_pack_10')}
                       disabled={checkoutLoading}
                       className="w-full py-2.5 px-4 bg-white/5 text-[#F5F7FA] text-xs font-semibold rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {hasValidSubscription && (
                <div className="mt-16 flex justify-center">
                  <div className="bg-[#0B0F19]/50 rounded-2xl p-6 md:p-8 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 w-full max-w-4xl relative overflow-hidden group hover:border-white/10 transition-all">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-br-[100px] -z-10 blur-xl group-hover:scale-110 transition-transform" />
                    
                    <div className="flex flex-col gap-3 max-w-xl text-center md:text-left z-10 w-full md:w-auto">
                      <h3 className="text-[#F5F7FA] font-semibold text-lg flex items-center justify-center md:justify-start gap-2">
                        <Settings className="w-5 h-5 text-[#A0A7B5]" />
                        Fazer Upgrade / Downgrade
                      </h3>
                      <p className="text-[#A0A7B5] text-sm leading-relaxed">
                        Gerencie seu plano atual, faça upgrade para adicionar novos recursos ou altere a periodicidade do faturamento.
                      </p>
                    </div>

                    <button
                      onClick={openBillingPortal}
                      className="whitespace-nowrap px-6 py-4 bg-white/5 text-[#F5F7FA] border border-white/10 rounded-xl font-semibold flex items-center justify-center hover:bg-white/10 transition-all shadow-sm active:scale-95 h-fit w-full md:w-auto z-10"
                    >
                      Acessar Portal
                    </button>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {activeTab === "organization" && (
            <motion.section
              key="organization"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 shadow-2xl">
                <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
                   <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <Building2 className="w-4 h-4 text-[#A0A7B5]" />
                  </span>
                  Organização Central
                </h2>

                {organization ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-6 border-b border-white/5">
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Nome da Organização</p>
                        {isEditingOrg ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input 
                              title="Nome da Organização"
                              type="text" 
                              value={orgNameInput} 
                              onChange={(e) => setOrgNameInput(e.target.value)} 
                              className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] transition-colors w-full max-w-[250px]"
                            />
                            <button disabled={savingOrg} onClick={handleSaveOrg} className="p-2 bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl hover:bg-[#2B85EB]/20 transition-colors">
                              {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button disabled={savingOrg} onClick={() => { setIsEditingOrg(false); setOrgNameInput(organization.name); }} className="p-2 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-base font-semibold text-[#F5F7FA]">{organization.name}</p>
                            <button onClick={() => setIsEditingOrg(true)} className="text-xs font-medium text-[#2B85EB] hover:text-[#3B95FB]">Editar</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pb-6 border-b border-white/5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Status do Tenant</p>
                        <p className="text-base font-semibold text-[#F5F7FA]">
                          <span className={`inline-flex px-2 py-0.5 mt-1 bg-white/5 text-[#A0A7B5] text-[10px] font-bold rounded-md border border-white/10 uppercase tracking-widest shadow-sm ${organization?.subscriptionStatus === 'active' || organization?.subscriptionStatus === 'trialing' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : ''}`}>
                            {organization?.subscriptionStatus || 'Inativo'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 pb-6 border-b border-white/5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5]">Membros & Convites</p>
                      
                      {members.length > 0 && (
                        <div className="flex flex-col gap-2 mb-4">
                          {(() => {
                            const currentUserRole = members.find(m => m.id === user?.uid)?.role || 'member';
                            const canEditRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
                            return members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#2B85EB]/20 flex items-center justify-center text-[#2B85EB] font-bold text-xs uppercase">
                                  {member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-[#F5F7FA]">
                                    {member.displayName || 'Usuário'} {member.id === user?.uid && '(Você)'}
                                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#2B85EB]/10 text-[#2B85EB]">
                                      {{owner: 'Dono', admin: 'Administrador', member: 'Membro', guest: 'Visitante'}[(member.role as string) || 'member'] || member.role || 'Membro'}
                                    </span>
                                  </span>
                                  <span className="text-[10px] text-[#A0A7B5]">{member.email}</span>
                                </div>
                              </div>
                              {member.id !== user?.uid && canEditRoles && (
                                <div className="flex items-center gap-3">
                                  <select
                                    value={member.role || 'member'}
                                    onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                    className="bg-white/5 border border-white/10 text-[#F5F7FA] text-xs rounded-md px-2 py-1 outline-none focus:border-[#2B85EB]"
                                  >
                                    <option value="owner">Dono</option>
                                    <option value="admin">Administrador</option>
                                    <option value="member">Membro</option>
                                    <option value="guest">Visitante</option>
                                  </select>
                                  <button className="text-xs text-[#EF4444] hover:text-[#FCA5A5] font-medium" onClick={() => alert("Remoção de membros em desenvolvimento.")}>Excluir</button>
                                </div>
                              )}
                            </div>
                            ));
                          })()}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button onClick={handleInviteWhatsapp} className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/10 text-[#10B981] rounded-xl hover:bg-[#10B981]/20 transition-colors border border-[#10B981]/20 text-sm font-medium">
                          <Link className="w-4 h-4" /> Whatsapp
                        </button>
                        <button onClick={handleCopyLink} className="flex items-center gap-2 px-4 py-2 bg-white/5 text-[#F5F7FA] rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium">
                          {copiedLink ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />} Copiar Link
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">ID da Organização</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs font-mono text-[#A0A7B5] bg-[#050505] px-2 py-1 rounded-md border border-white/5">{profile?.organizationId || user.uid}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#050505] border border-white/5 p-6 rounded-2xl">
                    <p className="text-sm font-medium text-[#A0A7B5] mb-4">
                      Você ainda não está vinculado a uma organização ou igreja ativa.
                      Sua organização será criada automaticamente ao iniciar uma assinatura.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === "account" && (
            <motion.section
              key="account"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 shadow-2xl">
                <h2 className="text-xl font-semibold text-[#F5F7FA] flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
                   <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <User className="w-4 h-4 text-[#A0A7B5]" />
                  </span>
                  Dados da Conta
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Nome de Exibição</p>
                      {isEditingProfile ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            title="Nome de Exibição"
                            type="text" 
                            value={profileNameInput} 
                            onChange={(e) => setProfileNameInput(e.target.value)} 
                            className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#2B85EB] transition-colors w-full max-w-[250px]"
                          />
                          <button disabled={savingProfile} onClick={handleSaveProfile} className="p-2 bg-[#2B85EB]/10 text-[#2B85EB] rounded-xl hover:bg-[#2B85EB]/20 transition-colors">
                            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button disabled={savingProfile} onClick={() => { setIsEditingProfile(false); setProfileNameInput(profile?.displayName || ""); }} className="p-2 bg-white/5 text-[#A0A7B5] rounded-xl hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-base font-semibold text-[#F5F7FA]">{profileNameInput || profile?.displayName || "Não informado"}</p>
                          <button onClick={() => setIsEditingProfile(true)} className="text-xs font-medium text-[#2B85EB] hover:text-[#3B95FB]">Editar</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Email</p>
                      <p className="text-base font-semibold text-[#F5F7FA]">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">ID Central</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-mono text-[#A0A7B5] bg-[#050505] px-2 py-1 rounded-md border border-white/5">{user.uid}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={logout}
                      className="text-[#EF4444] font-semibold hover:text-[#FCA5A5] transition-colors text-sm px-5 py-2.5 bg-[#EF4444]/10 rounded-xl hover:bg-[#EF4444]/20 border border-[#EF4444]/20 active:scale-95"
                    >
                      Encerrar Sessão
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === "billing" && (
            <motion.section
              key="billing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-10 border border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#050505] rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                      <CreditCard className="w-6 h-6 text-[#2B85EB]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-[#F5F7FA]">Plano e Assinatura</h2>
                      <p className="text-[#A0A7B5] text-sm font-normal">Gerencie seu faturamento centralizado.</p>
                    </div>
                  </div>
                  {loadingSub && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 animate-pulse">
                       <div className="w-2.5 h-2.5 border-2 border-white/20 border-t-[#2B85EB] rounded-full animate-spin"></div>
                       <span className="text-[10px] font-medium text-[#A0A7B5] uppercase tracking-widest">Sincronizando...</span>
                    </div>
                  )}
                </div>
                
                {subscription && subscription.status !== 'none' ? (
                  <div className="space-y-6">
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 shadow-inner">
                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Plano Atual</p>
                           <h3 className="text-xl font-semibold text-[#F5F7FA]">{subscription?.plan === 'annual' ? 'Anual' : 'Mensal'} - MusicScale</h3>
                        </div>
                        <div className="text-left md:text-right">
                           <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Status</p>
                           <span className={`inline-flex px-3 py-1 text-[10px] font-bold rounded-full border uppercase tracking-widest shadow-sm ${
                             subscription.status === 'active' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 
                             subscription.status === 'trialing' ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' : 
                             subscription.status === 'canceled' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' : 
                             'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                           }`}>
                             {subscription.status === 'trialing' ? 'Trial Ativo' : subscription.status === 'active' ? 'Ativo' : subscription.status === 'canceled' ? 'Cancelado' : subscription.status === 'past_due' ? 'Pagamento Atrasado' : subscription.status}
                           </span>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-6 border-t border-white/5 gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-1">
                            {subscription.status === 'trialing' ? 'Fim do Trial' : subscription.status === 'canceled' ? 'Acesso até' : 'Próxima Cobrança'}
                          </p>
                          <p className="text-sm font-semibold text-[#F5F7FA]">{formattedRenewal}</p>
                        </div>
                        {subscription.status === 'trialing' && subscription.trialEndsAt && (
                          <div className="text-left md:text-right">
                            <p className="text-[11px] font-medium text-[#2B85EB] flex items-center gap-1.5 bg-[#2B85EB]/10 px-3 py-1.5 rounded-lg border border-[#2B85EB]/20">
                              <Clock className="w-3.5 h-3.5" />
                              Faltam {Math.max(0, Math.ceil((new Date(subscription.trialEndsAt.seconds * 1000).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dias
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-[#A0A7B5] text-sm font-normal text-center pt-2">
                      Faturamento e ciclo de vida gerenciados de forma segura pelo Stripe.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                      <button 
                        onClick={openBillingPortal}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                      >
                        <Settings className="w-4 h-4 ml-1" /> Gerenciar Assinatura
                      </button>
                      
                      {subscription.status === 'canceled' || subscription.status === 'past_due' ? (
                        <button 
                          onClick={openBillingPortal}
                          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#2B85EB] text-white rounded-xl font-semibold hover:bg-[#2B85EB]/90 transition-all shadow-sm active:scale-95"
                        >
                          Reativar Assinatura
                        </button>
                      ) : (
                        <button 
                          onClick={openBillingPortal}
                          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white/5 text-[#F5F7FA] border border-white/10 rounded-xl font-semibold hover:bg-white/10 transition-all shadow-sm active:scale-95"
                        >
                          Fazer Upgrade / Downgrade
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-xl font-semibold text-[#F5F7FA]">Escolha seu Plano</h3>
                         <p className="text-[#A0A7B5] text-sm">Assinatura unificada para todo o ministério.</p>
                       </div>
                       <div className="bg-[#0B0F19] p-1.5 rounded-xl border border-white/10 flex relative shadow-sm">
                         <button 
                           onClick={() => setIsAnnual(false)}
                           className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                         >
                           Mensal
                         </button>
                         <button 
                           onClick={() => setIsAnnual(true)}
                           className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isAnnual ? 'text-[#050505]' : 'text-[#A0A7B5] hover:text-[#F5F7FA]'}`}
                         >
                           Anual
                         </button>
                         <div 
                           className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#F5F7FA] rounded-lg transition-transform duration-300 ease-in-out"
                           style={{ transform: isAnnual ? 'translateX(calc(100% + 6px))' : 'translateX(6px)' }}
                         />
                       </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* PRO */}
                      <div className="bg-[#050505] rounded-[2rem] p-6 border border-[#2B85EB]/30 relative flex flex-col premium-shadow group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#2B85EB]/5 to-transparent pointer-events-none rounded-[2rem]" />
                        {plansData?.find(p => p.lookupKey === 'musicscale_pro_monthly')?.featured && (
                          <div className="absolute top-4 right-4 md:right-6">
                            <div className="bg-[#2B85EB] text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-widest flex items-center gap-1">
                              <Star className="w-3 h-3" /> Popular
                            </div>
                          </div>
                        )}

                        <h3 className="text-sm font-bold text-[#F5F7FA] mb-2 uppercase tracking-widest relative z-10 mt-4 md:mt-0">Pro</h3>
                        <p className="text-[#A0A7B5] text-[11px] md:text-xs mb-4 min-h-[40px] relative z-10">
                          Para ministérios que desejam crescimento e acesso contínuo aos recursos premium do MusicScale.
                        </p>
                        
                        <div className="flex items-baseline gap-1 mb-1 relative z-10">
                          <span className="text-3xl md:text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                            R$ {prices.pro_monthly > 0 ? (isAnnual ? (prices.pro_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.pro_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "..."}
                          </span>
                          <span className="text-[#A0A7B5] font-normal text-xs md:text-sm">/mês</span>
                        </div>
                        
                        {isAnnual ? (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium relative z-10">
                             {prices.pro_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.pro_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                             {prices.pro_monthly > 0 && prices.pro_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.pro_annual / (prices.pro_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
                          </div>
                        ) : (
                          <div className="h-5 md:h-6 mb-6 relative z-10" />
                        )}
                        
                        <button 
                          onClick={() => handleSubscribe(isAnnual ? 'musicscale_pro_yearly' : 'musicscale_pro_monthly')}
                          disabled={checkoutLoading}
                          className="w-full py-3.5 px-4 rounded-xl bg-[#F5F7FA] text-[#050505] text-center font-semibold text-sm hover:bg-white transition-all shadow-[0_0_20px_rgba(245,247,250,0.1)] hover:shadow-[0_0_30px_rgba(245,247,250,0.2)] active:scale-95 mb-6 block relative z-10"
                        >
                          {checkoutLoading ? "Processando..." : "Assinar MusicScale Pro"}
                        </button>
                        
                        <ul className="space-y-3 flex-1 pt-4 border-t border-white/5 relative z-10">
                          {[
                            "Pessoas ilimitadas",
                            "Músicas e escalas ilimitadas",
                            "Acesso à Biblioteca Viva",
                            "Novas músicas continuamente"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-[#F5F7FA]">
                              <Zap className="w-3.5 h-3.5 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                              <span className="font-normal text-xs opacity-90">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* STARTER */}
                      <div className="bg-[#0B0F19] rounded-[2rem] p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">
                        <h3 className="text-sm font-bold text-[#A0A7B5] mb-2 uppercase tracking-widest">Starter</h3>
                        <p className="text-[#A0A7B5] text-[11px] md:text-xs mb-4 min-h-[40px]">
                          Ideal para equipes que desejam organizar o ministério com excelência, sem recursos pro.
                        </p>
                        
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl md:text-4xl font-semibold text-[#F5F7FA] tracking-tight">
                            R$ {prices.starter_monthly > 0 ? (isAnnual ? (prices.starter_annual / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : prices.starter_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : "..."}
                          </span>
                          <span className="text-[#A0A7B5] font-normal text-xs md:text-sm">/mês</span>
                        </div>
                        
                        {isAnnual ? (
                          <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                            {prices.starter_monthly > 0 && <span className="text-[#A0A7B5]/50 line-through">R$ {(prices.starter_monthly * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {prices.starter_monthly > 0 && prices.starter_annual > 0 && <span className="text-[#2B85EB] font-semibold bg-[#2B85EB]/10 border border-[#2B85EB]/20 px-2 py-0.5 rounded-md text-[10px]">{(100 - (prices.starter_annual / (prices.starter_monthly * 12)) * 100).toFixed(0)}% OFF</span>}
                          </div>
                        ) : (
                          <div className="h-5 md:h-6 mb-6" />
                        )}
                        
                        <button 
                          onClick={() => handleSubscribe(isAnnual ? 'musicscale_starter_yearly' : 'musicscale_starter_monthly')}
                          disabled={checkoutLoading}
                          className="w-full py-3.5 px-4 rounded-xl bg-white/5 border border-white/10 text-[#F5F7FA] text-center font-semibold text-sm hover:bg-white/10 transition-all shadow-sm active:scale-95 mb-6 block"
                        >
                          {checkoutLoading ? "Processando..." : "Assinar MusicScale Starter"}
                        </button>
                        
                        <ul className="space-y-3 flex-1 pt-4 border-t border-white/5">
                          {[
                            "Músicas e escalas ilimitadas",
                            "Até 10 pessoas por organização",
                            "Sincronização em nuvem",
                            "Suporte padrão"
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-[#A0A7B5]">
                              <Check className="w-3.5 h-3.5 text-[#2B85EB] flex-shrink-0 mt-0.5" />
                              <span className="font-normal text-xs">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- MARKETPLACE / SERVIÇOS PREMIUM --- */}
                <div className="mt-16 pt-12 border-t border-white/5">
                  <div className="mb-10 text-center md:text-left">
                     <h3 className="text-xl font-semibold text-[#F5F7FA] mb-2">Serviços e Adicionais</h3>
                     <p className="text-[#A0A7B5] text-sm">Complemente sua assinatura com ferramentas e serviços premium estruturados para o seu ministério.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {/* Setup Premium */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Settings className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.setup_premium > 0 ? prices.setup_premium.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Setup Premium</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Onboarding assistido</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Organização de equipe estruturada</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_setup_premium')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Solicitar Setup"}
                      </button>
                    </div>

                    {/* Treinamento Express */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Video className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.training_express > 0 ? prices.training_express.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Treinamento Express</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Treinamento online prático para aprender rapidamente o fluxo do MusicScale.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Sessão de grupo online</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Gravação completa disponível</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_training_express')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Quero Participar"}
                      </button>
                    </div>

                    {/* Acervo Inicial */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-[#2B85EB]/20 hover:border-[#2B85EB]/40 transition-colors flex flex-col group relative overflow-hidden">
                      {addonsData?.find(a => a.lookupKey === 'musicscale_worship_100')?.featured && (
                        <div className="absolute top-0 right-0 p-3">
                          <div className="bg-[#2B85EB]/10 text-[#2B85EB] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#2B85EB]/20 uppercase tracking-widest flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Popular
                          </div>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#2B85EB]/10 rounded-xl border border-[#2B85EB]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <ListMusic className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right pt-6 mt-1">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.worship_100 > 0 ? prices.worship_100.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Acervo Inicial Worship</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Comece com 100 músicas cadastradas, incluindo cifra e letra.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> 100 músicas formatadas</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Implantação imediata</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_worship_100')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#2B85EB] text-white text-xs text-center font-semibold hover:bg-[#2B85EB]/90 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Comprar Acervo"}
                      </button>
                    </div>

                    {/* Music Pack 10 */}
                    <div className="bg-[#050505] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#0B0F19] rounded-xl border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Headphones className="w-5 h-5 text-[#2B85EB]" />
                        </div>
                        <div className="text-right">
                          <div className="text-[#F5F7FA] font-mono text-sm">
                             R$ {prices.music_pack_10 > 0 ? prices.music_pack_10.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."} <span className="text-[#A0A7B5] text-xs font-sans">/único</span>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[#F5F7FA] font-semibold text-base mb-1">Music Pack +10</h4>
                      <p className="text-[#A0A7B5] text-xs mb-6 flex-1">
                        Pacote avulso para adicionar até 10 novas músicas ao seu acervo.
                      </p>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Até 10 novas adições</li>
                        <li className="flex items-center gap-2 text-xs text-[#A0A7B5]"><Check className="w-3 h-3 text-[#2B85EB]" /> Cifras e letras nativas</li>
                      </ul>
                      <button 
                        onClick={() => handleAddonCheckout('musicscale_music_pack_10')}
                        disabled={checkoutLoading}
                        className="w-full py-2.5 px-4 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] text-xs text-center font-semibold hover:bg-[#2B85EB]/10 hover:text-[#2B85EB] transition-colors disabled:opacity-50"
                      >
                        {checkoutLoading ? "Processando..." : "Comprar Pacote"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
