import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { SocialProof } from "../components/SocialProof";
import { Problem } from "../components/Problem";
import { Ecosystem } from "../components/Ecosystem";
import { Flagship } from "../components/Flagship";
import { Pricing } from "../components/Pricing";
import { FAQ } from "../components/FAQ";
import { Footer } from "../components/Footer";

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
      <SocialProof />
      <Problem />
      <Flagship />
      <Ecosystem />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
