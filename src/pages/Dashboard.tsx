import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Music, ArrowRight, Settings, ExternalLink, ShieldCheck, CreditCard, LayoutGrid } from "lucide-react";
import { Navbar } from "../components/Navbar";

export function Dashboard() {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfc] flex items-center justify-center">
        <p className="text-brand-primary font-medium">Carregando painel...</p>
      </div>
    );
  }

  // Se não estiver logado, redireciona para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasMusicScale = profile?.products?.includes("musicscale") || false;

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <Navbar />
      
      <main className="pt-28 pb-16 md:pt-36 max-w-7xl mx-auto px-6">
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-2"
          >
            <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary font-bold text-xl">
              {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
            </div>
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

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-brand-primary flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" />
              Seus Apps e Produtos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* MusicScale Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-6 md:p-8 border border-brand-primary/10 shadow-xl shadow-brand-primary/5 flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-[#0a0a0a] rounded-2xl flex items-center justify-center">
                  <Music className="w-7 h-7 text-brand-secondary" />
                </div>
                {hasMusicScale ? (
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Ativo
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-brand-primary/5 text-brand-primary/70 text-xs font-semibold rounded-full border border-brand-primary/10">
                     Não assinado
                  </span>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-brand-primary tracking-tight mb-2">MusicScale</h3>
              <p className="text-brand-primary/70 text-sm mb-8 flex-1">
                A plataforma completa para gestão e escalas de ministérios de louvor, integrada ao ecossistema.
              </p>

              <div className="flex flex-col gap-3 mt-auto">
                {hasMusicScale ? (
                  <>
                    <a 
                      href="https://musicscale.millionsnest.com" 
                      target="_blank" rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 bg-brand-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-colors"
                    >
                      Abrir App
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a 
                      href="https://musicscale.millionsnest.com" 
                      target="_blank" rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 bg-white text-brand-primary border border-brand-primary/10 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Gerenciar Assinatura
                    </a>
                  </>
                ) : (
                  <>
                    <a 
                      href="https://musicscale.millionsnest.com/start" 
                      className="w-full py-3.5 px-4 bg-brand-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-colors shadow-md shadow-brand-primary/20"
                    >
                      Começar Trial de 7 Dias
                      <ArrowRight className="w-4 h-4" />
                    </a>
                    <a 
                      href="https://musicscale.millionsnest.com/start" 
                      className="w-full py-3.5 px-4 bg-white text-brand-primary border border-brand-primary/10 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      Assinar Plano
                    </a>
                  </>
                )}
              </div>
            </motion.div>

            {/* Placeholder for future apps */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-brand-primary/5 rounded-3xl p-6 md:p-8 border border-brand-primary/10 border-dashed flex flex-col justify-center items-center text-center opacity-70"
            >
              <div className="w-14 h-14 bg-white/50 rounded-2xl flex items-center justify-center mb-4 text-brand-primary/40 shadow-sm">
                 <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-brand-primary/60 tracking-tight mb-2">Em breve</h3>
              <p className="text-brand-primary/50 text-sm">
                Novos módulos e integrações para sua organização estão a caminho.
              </p>
            </motion.div>
          </div>
        </section>

      </main>
    </div>
  );
}
