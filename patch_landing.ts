import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/pages/MusicScaleLanding.tsx', 'utf8');

// Add import
content = content.replace(
  'import { useAuth } from "../contexts/AuthContext.js";',
  'import { useAuth } from "../contexts/AuthContext.js";\nimport { useOrganization } from "../contexts/OrganizationContext.js";'
);

// Add useOrganization hook
content = content.replace(
  'const { user } = useAuth();',
  'const { user } = useAuth();\n  const { organization, subscription } = useOrganization();'
);

// Replace handleStartTrial to handle logic or we can just replace the CTAs in the JSX
const isSubscribedCheck = `
  const isSubscribed = organization?.enabledApps?.includes('musicscale') || subscription?.status === 'active' || subscription?.status === 'trialing';

  const handleLaunch = () => {
    // Basic redirect for now
    navigate('/dashboard');
  };
`;

content = content.replace(
  'const handleStartTrial = () => {',
  isSubscribedCheck + '\n  const handleStartTrial = () => {'
);

const primaryCTA = `
              {isSubscribed ? (
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="group relative w-full sm:w-auto px-8 py-4 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_40px_rgba(43,133,235,0.4)] hover:shadow-[0_0_60px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                  <div className="relative flex items-center justify-center gap-2">
                    Abrir MusicScale
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ) : (
                <button 
                  onClick={handleStartTrial}
                  className="group relative w-full sm:w-auto px-8 py-4 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_40px_rgba(43,133,235,0.4)] hover:shadow-[0_0_60px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                  <div className="relative flex items-center justify-center gap-2">
                    {t('musicscale:hero_cta_primary', 'Começar teste grátis')}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              )}
`;

content = content.replace(
  /<button\s+onClick=\{handleStartTrial\}\s+className="group relative w-full sm:w-auto px-8 py-4 bg-\[#2B85EB\] text-white text-lg font-bold rounded-2xl shadow-\[0_0_40px_rgba\(43,133,235,0\.4\)\] hover:shadow-\[0_0_60px_rgba\(43,133,235,0\.6\)\] transition-all overflow-hidden">\s*<div className="absolute inset-0 bg-white\/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" \/>\s*<div className="relative flex items-center justify-center gap-2">\s*\{t\('musicscale:hero_cta_primary', 'Começar teste grátis'\)\}\s*<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" \/>\s*<\/div>\s*<\/button>/,
  primaryCTA
);

// We should do it for the final CTA too and the middle one.
content = content.replace(
  /<button\s+onClick=\{handleStartTrial\}\s+className="group relative px-8 py-4 bg-white\/5 border border-white\/10 text-white text-lg font-semibold rounded-2xl hover:bg-white\/10 transition-all shadow-\[0_0_20px_rgba\(255,255,255,0\.02\)\] flex items-center justify-center gap-3 backdrop-blur-md">\s*\{t\('musicscale:chaos_cta', 'Quero organizar minha próxima escala'\)\}\s*<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" \/>\s*<\/button>/,
  `
             {isSubscribed ? (
               <button 
                 onClick={() => navigate('/dashboard')}
                 className="group relative px-8 py-4 bg-white/5 border border-white/10 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)] flex items-center justify-center gap-3 backdrop-blur-md"
               >
                 Abrir MusicScale
                 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>
             ) : (
               <button 
                 onClick={handleStartTrial}
                 className="group relative px-8 py-4 bg-white/5 border border-white/10 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)] flex items-center justify-center gap-3 backdrop-blur-md"
               >
                 {t('musicscale:chaos_cta', 'Quero organizar minha próxima escala')}
                 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>
             )}
  `
);


// Final CTA
content = content.replace(
  /<button\s+onClick=\{handleStartTrial\}\s+className="group relative w-full sm:w-auto px-10 py-5 bg-\[#2B85EB\] text-white text-lg font-bold rounded-2xl shadow-\[0_0_50px_rgba\(43,133,235,0\.3\)\] hover:shadow-\[0_0_80px_rgba\(43,133,235,0\.6\)\] transition-all overflow-hidden">\s*<div className="absolute inset-0 bg-white\/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" \/>\s*<div className="relative flex items-center justify-center gap-2">\s*\{t\('musicscale:final_cta_button', 'Começar teste grátis'\)\}\s*<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" \/>\s*<\/div>\s*<\/button>/,
  `
            {isSubscribed ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="group relative w-full sm:w-auto px-10 py-5 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_50px_rgba(43,133,235,0.3)] hover:shadow-[0_0_80px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                <div className="relative flex items-center justify-center gap-2">
                  Abrir MusicScale 
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ) : (
              <button 
                onClick={handleStartTrial}
                className="group relative w-full sm:w-auto px-10 py-5 bg-[#2B85EB] text-white text-lg font-bold rounded-2xl shadow-[0_0_50px_rgba(43,133,235,0.3)] hover:shadow-[0_0_80px_rgba(43,133,235,0.6)] transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                <div className="relative flex items-center justify-center gap-2">
                  {t('musicscale:final_cta_button', 'Começar teste grátis')} 
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}
  `
);


writeFileSync('src/pages/MusicScaleLanding.tsx', content);

