import { useEffect, Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar.js";
import { Hero } from "../components/Hero.js";

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
