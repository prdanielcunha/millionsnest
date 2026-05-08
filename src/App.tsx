/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SocialProof } from "./components/SocialProof";
import { Problem } from "./components/Problem";
import { Ecosystem } from "./components/Ecosystem";
import { Flagship } from "./components/Flagship";
import { Pricing } from "./components/Pricing";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen font-sans overflow-x-hidden">
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
