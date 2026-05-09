import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { 
  Music, ArrowRight, Settings, ExternalLink, ShieldCheck, 
  CreditCard, LayoutGrid, User, Clock, AlertCircle, ChevronRight 
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Tab = "overview" | "account" | "billing";

export function Dashboard() {
  const { user, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      if (!user) return;
      try {
        const q = query(collection(db, "subscriptions"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        let activeSub = null;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === "active" || data.status === "trialing") {
             activeSub = data;
          } else if (!activeSub) {
             activeSub = data; // fallback to canceled/past_due if no active
          }
        });
        setSubscription(activeSub);
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setLoadingSub(false);
      }
    }
    fetchSubscription();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-primary/60 font-medium text-sm animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasMusicScale = profile?.products?.includes("musicscale") || false;
  
  // Handlers for subscription display
  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const isCanceled = subscription?.status === "canceled";
  
  const formattedRenewal = subscription?.currentPeriodEnd 
    ? new Date(subscription.currentPeriodEnd.seconds * 1000).toLocaleDateString('pt-BR') 
    : null;

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <Navbar />
      
      {/* Secondary Navigation */}
      <div className="bg-white border-b border-gray-100 pt-24 md:pt-32 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "overview" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-primary/50 hover:text-brand-primary/80"}`}
          >
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab("account")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "account" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-primary/50 hover:text-brand-primary/80"}`}
          >
            Minha Conta
          </button>
          <button 
            onClick={() => setActiveTab("billing")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "billing" ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-primary/50 hover:text-brand-primary/80"}`}
          >
            Assinatura e Faturamento
          </button>
        </div>
      </div>
      
      <main className="py-12 max-w-7xl mx-auto px-6">
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5 mb-2"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-16 h-16 rounded-2xl border-4 border-white shadow-sm" />
            ) : (
              <div className="w-16 h-16 bg-brand-primary/5 rounded-2xl flex items-center justify-center text-brand-primary font-bold text-2xl border-4 border-white shadow-sm">
                {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary tracking-tight">
                Olá, {profile?.displayName?.split(' ')[0] || user.email?.split('@')[0]}
              </h1>
              <p className="text-brand-primary/60 text-sm md:text-base">
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
                <h2 className="text-xl font-bold text-brand-primary flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5" />
                  Seus Apps e Produtos
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* MusicScale Card */}
                <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] relative overflow-hidden group">
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />

                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-[#0a0a0a] rounded-2xl flex items-center justify-center shadow-md">
                      <Music className="w-7 h-7 text-brand-secondary" />
                    </div>
                    
                    {loadingSub ? (
                      <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    ) : hasMusicScale && isTrialing ? (
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200 flex items-center gap-1.5 uppercase tracking-wide">
                        <Clock className="w-3.5 h-3.5" /> Trial
                      </span>
                    ) : hasMusicScale && isActive ? (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1.5 uppercase tracking-wide">
                        <ShieldCheck className="w-3.5 h-3.5" /> Ativo
                      </span>
                    ) : hasMusicScale && isCanceled ? (
                      <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200 flex items-center gap-1.5 uppercase tracking-wide">
                        <AlertCircle className="w-3.5 h-3.5" /> Cancelado
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-50 text-gray-500 text-xs font-bold rounded-full border border-gray-200 uppercase tracking-wide">
                         Sem Assinatura
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-brand-primary tracking-tight mb-2">MusicScale</h3>
                  <p className="text-brand-primary/60 text-sm mb-6 flex-1">
                    A plataforma completa para gestão e escalas de ministérios de louvor, integrada ao ecossistema central.
                  </p>

                  {/* Plan Details Context */}
                  {hasMusicScale && !loadingSub && (
                    <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-brand-primary/50 font-medium uppercase tracking-wider">Plano Atual</span>
                        <span className="text-sm font-semibold text-brand-primary capitalize">
                          {subscription?.planName || "Pro"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-brand-primary/50 font-medium uppercase tracking-wider">Próxima Cobrança</span>
                        <span className="text-sm font-medium text-brand-primary/80">
                          {formattedRenewal || "Não disponível"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-auto">
                    {hasMusicScale ? (
                      <>
                        <a 
                          href="https://musicscale.millionsnest.com" 
                          target="_blank" rel="noopener noreferrer"
                          className="w-full py-3.5 px-4 bg-brand-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all shadow-sm active:scale-[0.98]"
                        >
                          Abrir App
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      </>
                    ) : (
                      <>
                        <a 
                          href="https://musicscale.millionsnest.com/start" 
                          className="w-full py-3.5 px-4 bg-brand-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all shadow-md shadow-brand-primary/10 active:scale-[0.98]"
                        >
                          Começar Trial de 7 Dias
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Placeholder for future apps */}
                <div className="bg-gray-50/50 rounded-3xl p-6 md:p-8 border border-gray-200 border-dashed flex flex-col justify-center items-center text-center group transition-colors hover:bg-gray-50">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-5 text-gray-300 shadow-sm transition-transform group-hover:scale-105">
                     <LayoutGrid className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-400 tracking-tight mb-2">Novo App em breve</h3>
                  <p className="text-gray-400 text-sm px-4">
                    Estamos construindo novas integrações para sua organização.
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
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h2 className="text-xl font-bold text-brand-primary flex items-center gap-2 mb-8">
                  <User className="w-5 h-5" />
                  Dados da Conta
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-brand-primary/50 mb-1">Nome de Exibição</p>
                      <p className="text-base font-medium text-brand-primary">{profile?.displayName || "Não informado"}</p>
                    </div>
                    <button className="text-sm font-medium text-brand-secondary hover:text-brand-secondary/80">Editar</button>
                  </div>
                  
                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-brand-primary/50 mb-1">Email</p>
                      <p className="text-base font-medium text-brand-primary">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-brand-primary/50 mb-1">ID Central</p>
                      <p className="text-sm font-mono text-brand-primary/70 bg-gray-50 px-2 py-1 rounded inline-block mt-1">{user.uid}</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={logout}
                      className="text-red-500 font-medium hover:text-red-600 transition-colors text-sm px-4 py-2 bg-red-50 rounded-xl hover:bg-red-100"
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
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center py-16">
                <div className="w-20 h-20 bg-brand-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CreditCard className="w-8 h-8 text-brand-primary/40" />
                </div>
                <h2 className="text-2xl font-bold text-brand-primary mb-3">Gerenciar Assinaturas</h2>
                <p className="text-brand-primary/60 text-base mb-8 max-w-md mx-auto">
                  A gestão financeira e de assinaturas é realizada diretamente na plataforma MusicScale no momento.
                </p>
                <a 
                  href="https://musicscale.millionsnest.com" 
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/95 transition-all shadow-sm active:scale-[0.98]"
                >
                  Acessar Painel de Pagamento
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
