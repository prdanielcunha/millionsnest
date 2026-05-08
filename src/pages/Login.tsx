import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function Login() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirecionamento e lógica pós-login
  useEffect(() => {
    if (authLoading) return;
    
    if (user && profile) {
      if (profile.products?.includes("musicscale")) {
        // Já possui o produto, redireciona para o app MusicScale
        window.location.href = "https://musicscale.millionsnest.com";
      } else {
        // Redireciona para o fluxo de onboarding no MusicScale que lidará com a criação da org e checkout
        window.location.href = "https://musicscale.millionsnest.com/start";
      }
    }
  }, [user, profile, authLoading]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!auth) {
      setError("Firebase não está configurado. Verifique as variáveis de ambiente.");
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || "Erro na autenticação");
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    
    if (!auth) {
      setError("Firebase não está configurado. Verifique as variáveis de ambiente.");
      return;
    }

    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login com Google.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfc]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          <p className="text-brand-primary font-medium">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  // Se já tiver usuário, mas não fez o redirect ainda (aguardando o effect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfc] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-brand-primary/5 p-8 border border-brand-primary/10"
      >
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="MillionsNest Logo" className="h-10 w-auto" />
        </div>
        
        <h2 className="text-2xl font-bold text-brand-primary text-center tracking-tight mb-2">
          {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
        </h2>
        <p className="text-center text-brand-primary/60 text-sm mb-8">
          Acesse a central MillionsNest
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full relative flex flex-row items-center justify-center gap-2 px-4 py-2.5 mb-6 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continuar com Google
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <hr className="w-full border-gray-200" />
          <span className="absolute bg-white px-2 text-xs text-brand-primary/40 uppercase font-medium">Ou</span>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-primary mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/50 transition-all text-sm"
              placeholder="seu@ministerio.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-primary mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/50 transition-all text-sm"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 bg-brand-primary text-white rounded-xl font-medium text-sm hover:bg-brand-primary/90 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center h-[44px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? "Entrar" : "Criar conta")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-brand-primary/60 hover:text-brand-primary font-medium transition-colors"
          >
            {isLogin ? "Não tem uma conta? Cadastre-se" : "Já possui conta? Entre"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
