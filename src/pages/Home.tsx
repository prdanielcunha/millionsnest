import { useEffect, Suspense, lazy } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "../components/Navbar.js";
import { Hero } from "../components/Hero.js";
import { useAuth } from "../contexts/AuthContext.js";
import { trackPublicHomeView } from "../lib/publicFunnelAnalytics.js";

const SocialProof = lazy(() => import("../components/SocialProof.js").then((module) => ({ default: module.SocialProof })));
const Problem = lazy(() => import("../components/Problem.js").then((module) => ({ default: module.Problem })));
const ActionOsShowcase = lazy(() => import("../components/ActionOsShowcase.js").then((module) => ({ default: module.ActionOsShowcase })));
const Flagship = lazy(() => import("../components/Flagship.js").then((module) => ({ default: module.Flagship })));
const Ecosystem = lazy(() => import("../components/Ecosystem.js").then((module) => ({ default: module.Ecosystem })));
const Vision = lazy(() => import("../components/Vision.js").then((module) => ({ default: module.Vision })));
const FAQ = lazy(() => import("../components/FAQ.js").then((module) => ({ default: module.FAQ })));
const Guarantee = lazy(() => import("../components/Guarantee.js").then((module) => ({ default: module.Guarantee })));
const Footer = lazy(() => import("../components/Footer.js").then((module) => ({ default: module.Footer })));
const SalesChat = lazy(() => import("../components/SalesChat.js").then((module) => ({ default: module.SalesChat })));

function SectionFallback() {
  return <div className="flex justify-center bg-[#050505] py-20"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#6EAFFF]" /></div>;
}

export function Home() {
  const { hash } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!authLoading && !user) trackPublicHomeView();
  }, [authLoading, user]);

  useEffect(() => {
    if (hash) {
      setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2B85EB]/25 border-t-[#2B85EB]" aria-live="polite" />
          <span className="text-sm font-medium text-[#A1A1AA]">{t('loadingDashboard', 'Abrindo seu painel...')}</span>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard/overview" replace />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] font-sans text-[#F5F7FA]">
      <Navbar />
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <SocialProof />
        <Problem />
        <ActionOsShowcase />
        <Flagship />
        <Ecosystem />
        <Vision />
        <FAQ />
        <Guarantee />
        <Footer />
        <SalesChat />
      </Suspense>
    </div>
  );
}
