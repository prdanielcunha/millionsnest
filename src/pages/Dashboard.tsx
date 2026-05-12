import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { 
  Music, ArrowRight, Settings, ExternalLink, ShieldCheck, 
  CreditCard, LayoutGrid, User, Clock, AlertCircle, ChevronRight 
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Tab = "overview" | "account" | "billing";

export function Dashboard() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchSubscription = async () => {
    if (!user) return;
    try {
      console.log("[Dashboard] Fetching subscription for:", user.uid);
      const docRef = doc(db, "subscriptions", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
         const data = docSnap.data();
         console.log("[Dashboard] Subscription found:", data);
         setSubscription(data);
      } else {
         console.log("[Dashboard] No subscription found in Firestore");
         setSubscription(null);
      }
    } catch (error) {
      console.error("[Dashboard] Error fetching subscription:", error);
      setSubscription(null);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('Returned from Stripe session:', sessionId);
      setLoadingSub(true);
      fetchSubscription();
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [user]);

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
    ? new Date(subscription.currentPeriodEnd.seconds * 1000).toLocaleDateString('pt-BR') 
    : null;

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email, plan })
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
            onClick={() => setActiveTab("account")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "account" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Minha Conta
          </button>
          <button 
            onClick={() => setActiveTab("billing")}
            className={`pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === "billing" ? "border-[#2B85EB] text-[#F5F7FA]" : "border-transparent text-[#A0A7B5] hover:text-[#F5F7FA]"}`}
          >
            Assinatura e Faturamento
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
              <img src={profile.photoURL} alt="Profile" className="w-16 h-16 rounded-2xl border border-white/10 shadow-sm" />
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
                {/* MusicScale Card */}
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
                    ) : isCanceled ? (
                      <span className="px-3 py-1 bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold rounded-full border border-[#EF4444]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                        <AlertCircle className="w-3.5 h-3.5" /> Cancelado
                      </span>
                    ) : subscription != null ? (
                       <span className="px-3 py-1 bg-[#2B85EB]/10 text-[#2B85EB] text-[10px] font-bold rounded-full border border-[#2B85EB]/20 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                        {subscription.status}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-white/5 text-[#A0A7B5] text-[10px] font-bold rounded-full border border-white/10 uppercase tracking-widest shadow-sm">
                         Sem Assinatura
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-semibold text-[#F5F7FA] tracking-tight mb-2">MusicScale</h3>
                  <p className="text-[#A0A7B5] text-sm mb-6 flex-1 font-normal leading-relaxed">
                    A plataforma completa para gestão e escalas de ministérios de louvor, integrada ao ecossistema central.
                  </p>

                  {(subscription || loadingSub) && (
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
                    {hasValidSubscription ? (
                      <>
                        <a 
                          href="https://musicscale.millionsnest.com" 
                          target="_blank" rel="noopener noreferrer"
                          className="w-full py-3.5 px-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white transition-all shadow-sm active:scale-95"
                        >
                          Abrir App
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      </>
                    ) : (
                      <div className="flex flex-col gap-3 relative">
                        <button 
                          onClick={() => handleSubscribe('annual')}
                          disabled={checkoutLoading}
                          className="w-full py-4 px-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold flex-col flex items-center justify-center hover:bg-white transition-all shadow-sm active:scale-95 relative overflow-hidden disabled:opacity-70"
                        >
                          <span className="absolute top-0 right-0 bg-[#2B85EB]/10 text-[#2B85EB] text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-widest border-b border-l border-[#2B85EB]/20">30% OFF</span>
                          <span className="flex items-center gap-2">
                            Assinatura Anual <ArrowRight className="w-4 h-4" />
                          </span>
                          <span className="text-xs text-[#2B85EB] mt-1 font-bold">R$ 14,08/mês</span>
                          <span className="text-[10px] text-[#050505]/60 font-medium">7 dias grátis, depois R$ 169,00/ano</span>
                        </button>

                        <button 
                          onClick={() => handleSubscribe('monthly')}
                          disabled={checkoutLoading}
                          className="w-full py-3 px-4 bg-transparent text-[#F5F7FA] border border-white/10 rounded-xl font-semibold flex flex-col items-center justify-center hover:bg-white/5 transition-all active:scale-95 disabled:opacity-70"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            Assinatura Mensal
                          </span>
                          <span className="text-[10px] text-[#A0A7B5] font-medium mt-1">7 dias grátis, depois R$ 19,90/mês</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#A0A7B5] mb-2">Nome de Exibição</p>
                      <p className="text-base font-semibold text-[#F5F7FA]">{profile?.displayName || "Não informado"}</p>
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
              className="max-w-2xl"
            >
              <div className="bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] p-10 border border-white/5 shadow-2xl text-center">
                <div className="w-20 h-20 bg-[#050505] rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-inner">
                  <CreditCard className="w-8 h-8 text-[#2B85EB]" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F7FA] mb-4">Gerenciar Assinaturas</h2>
                <p className="text-[#A0A7B5] text-sm font-normal mb-10 max-w-sm mx-auto leading-relaxed">
                  Toda a sua gestão financeira, faturamento e alteração de planos é feita de forma totalmente segura pelo portal do Stripe.
                </p>
                
                {hasValidSubscription ? (
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/stripe/create-portal-session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user.uid })
                        });
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else {
                          alert(data.error || 'Erro ao carregar o portal. Verifique sua assinatura.');
                        }
                      } catch (e) {
                        console.error(e);
                        alert('Erro de comunicação.');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                  >
                    Acessar Portal do Stripe
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <div className="bg-[#050505] border border-white/5 p-6 rounded-2xl max-w-sm mx-auto">
                    <p className="text-sm font-medium text-[#A0A7B5]">
                      Você ainda não possui ferramentas ativas. Volte para a Visão Geral para assinar e iniciar seu período de teste.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
