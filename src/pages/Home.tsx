import { useEffect, Suspense, lazy } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/Navbar.js";
import { Hero } from "../components/Hero.js";
import { useAuth } from "../contexts/AuthContext.js";

const SocialProof = lazy(() => import("../components/SocialProof.js").then((module) => ({ default: module.SocialProof })));
const Problem = lazy(() => import("../components/Problem.js").then((module) => ({ default: module.Problem })));
const Ecosystem = lazy(() => import("../components/Ecosystem.js").then((module) => ({ default: module.Ecosystem })));
const Flagship = lazy(() => import("../components/Flagship.js").then((module) => ({ default: module.Flagship })));
const Guarantee = lazy(() => import("../components/Guarantee.js").then((module) => ({ default: module.Guarantee })));
const FAQ = lazy(() => import("../components/FAQ.js").then((module) => ({ default: module.FAQ })));
const SalesChat = lazy(() => import("../components/SalesChat.js").then((module) => ({ default: module.SalesChat })));
const Vision = lazy(() => import("../components/Vision.js").then((module) => ({ default: module.Vision })));
const Footer = lazy(() => import("../components/Footer.js").then((module) => ({ default: module.Footer })));

function SectionFallback() {
  return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-[#2B85EB]/30 border-t-[#2B85EB] rounded-full animate-spin"></div></div>;
}

export function Home() {
  const { hash } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-[#2B85EB]/30 border-t-[#2B85EB] animate-spin" aria-live="polite" />
          <span className="text-[#A1A1AA] text-sm font-medium">{t('loadingDashboard', 'Abrindo seu painel...')}</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen font-sans overflow-x-hidden bg-[#050505] text-[#F5F7FA]">
      <Navbar />
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <SocialProof />
        <Problem />
        <Flagship />
        <Guarantee />
        <FAQ />
        <Ecosystem />
        <Vision />
        <Footer />
        <SalesChat />
      </Suspense>
    </div>
  );
}
