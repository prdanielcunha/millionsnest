import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase.js";
import { useAuth } from "../contexts/AuthContext.js";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Login() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(['auth']);
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const org = params.get('org');
    if (org) {
      localStorage.setItem('invite_org_id', org);
    }
    
    if (authLoading) return;
    
    if (user && profile) {
      // UX Optimized: Check if user was trying to buy something before login
      const purchaseIntent = sessionStorage.getItem('purchase_intent');
      if (purchaseIntent) {
        sessionStorage.removeItem('purchase_intent');
        navigate(`/checkout?plan=${purchaseIntent}`);
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, profile, authLoading, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!auth) {
      setError(t("firebase_error"));
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
      setError(err.message || t("auth_error"));
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    
    if (!auth) {
      setError(t("firebase_error"));
      return;
    }

    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || t("google_error"));
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#F5F7FA] animate-spin" />
        </div>
      </div>
    );
  }

  // Se já tiver usuário, mas não fez o redirect ainda (aguardando o effect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-[#2B85EB]/10 rounded-[100%] blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#0B0F19]/50 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 md:p-10 border border-white/5 relative z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none rounded-[2rem]" />
        
        <div className="flex justify-center mb-10">
          <img src="/logo02.png" alt="MillionsNest Logo" className="h-12 w-auto opacity-100" />
        </div>
        
        <h2 className="text-2xl font-semibold text-[#F5F7FA] text-center tracking-tight mb-2">
          {isLogin ? t("welcome_back") : t("create_account")}
        </h2>
        <p className="text-center text-[#A0A7B5] text-sm font-normal mb-8">
          {t("access_central")}
        </p>

        {error && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] p-3 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full relative flex flex-row items-center justify-center gap-3 px-4 py-3 mb-6 text-sm font-semibold border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-[#F5F7FA] disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("continue_google")}
        </button>

        <div className="relative flex items-center justify-center mb-8">
          <hr className="w-full border-white/10" />
          <span className="absolute bg-[#0B0F19] px-3 text-[10px] text-[#A0A7B5] uppercase font-bold tracking-widest">{t("or")}</span>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#A0A7B5] mb-2 uppercase tracking-wide">{t("email")}</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-white/10 focus:outline-none focus:ring-1 focus:ring-[#2B85EB] focus:border-[#2B85EB] transition-all text-sm text-[#F5F7FA] placeholder-white/20 shadow-inner"
              placeholder={t("email_placeholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A0A7B5] mb-2 uppercase tracking-wide">{t("password")}</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-white/10 focus:outline-none focus:ring-1 focus:ring-[#2B85EB] focus:border-[#2B85EB] transition-all text-sm text-[#F5F7FA] placeholder-white/20 shadow-inner"
              placeholder={t("password_placeholder")}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold text-sm hover:bg-white transition-all disabled:opacity-50 mt-4 flex items-center justify-center shadow-sm active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#050505]" /> : (isLogin ? t("login_button") : t("create_button"))}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#A0A7B5] hover:text-[#F5F7FA] font-medium transition-colors"
          >
            {isLogin ? t("no_account") : t("has_account")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
