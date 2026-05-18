import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar.js";
import { Hero } from "../components/Hero.js";
import { SocialProof } from "../components/SocialProof.js";
import { Problem } from "../components/Problem.js";
import { Ecosystem } from "../components/Ecosystem.js";
import { Flagship } from "../components/Flagship.js";
import { Pricing } from "../components/Pricing.js";
import { FAQ } from "../components/FAQ.js";
import { Footer } from "../components/Footer.js";

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
