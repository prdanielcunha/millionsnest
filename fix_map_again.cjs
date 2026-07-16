const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');

const startToken = '<div className="animate-in fade-in slide-in-from-bottom-4 duration-300">';
const idx = content.indexOf(startToken);
// Replace everything between startToken and `const renderFAQ` with my content.
const faqIdx = content.indexOf('const renderFAQ');

let top = content.substring(0, idx);
let bottom = content.substring(faqIdx);

const centerHTML = `<div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="max-w-3xl mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('dashboard.musicscale.center.resources.title', 'Conheça o MusicScale por dentro')}
          </h2>
          <p className="text-[#A0A7B5]">
            {t('dashboard.musicscale.center.resources.description', 'Entenda onde ficam as músicas, cifras, letras, escalas e integrantes, e como cada área se conecta na preparação da equipe.')}
          </p>
        </div>

        <div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col md:flex-row gap-8 justify-between">
            <div className="flex-1 flex flex-col">
              {/* Biblioteca Viva */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                <Globe className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.live_library')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.imports_to')}</span>
              </div>
              
              {/* Repertório */}
              <div className="flex items-center gap-3 bg-[#2B85EB]/10 p-4 rounded-xl border border-[#2B85EB]/20">
                <ListMusic className="w-5 h-5 text-[#2B85EB] shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.repertoire')}</span>
              </div>
              
              {/* Cifras / Letras */}
              <div className="pl-6 ml-6 border-l-2 border-white/10 py-3 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.chords')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.lyrics')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.supplies_songs_to')}</span>
              </div>
              
              {/* Escala de Músicas */}
              <div className="flex items-center gap-3 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <CalendarDays className="w-5 h-5 text-green-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.music_scale')}</span>
              </div>
            </div>
            
            <div className="hidden md:flex flex-col items-center justify-end pb-6 px-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                  <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                  <span className="text-xs text-[#A0A7B5] whitespace-nowrap">{t('dashboard.musicscale.center.resources.flow.can_link_to')}</span>
                  <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link')}</span>
                </div>
                <div className="w-full border-b border-dashed border-white/20" />
              </div>
            </div>
            
            <div className="md:hidden flex flex-col items-center py-2">
              <div className="h-6 border-l border-dashed border-white/20 mb-3" />
              <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                <span className="text-xs text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.can_link_to')}</span>
                <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link')}</span>
              </div>
              <div className="h-6 border-l border-dashed border-white/20 mt-3" />
            </div>

            <div className="flex-1 flex flex-col">
              {/* Integrantes */}
              <div className="flex items-center gap-3 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <Users className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.members')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.forms')}</span>
              </div>
              
              {/* Escala da Banda */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 md:mt-auto">
                <CalendarDays className="w-5 h-5 text-white shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.band_scale')}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* We keep the rest of resources as they are, but my other replacements replaced them into translation keys properly. Let's see if they are still intact. */}
`;

// It's probably safer to just replace the map part only.
const originalMapStart = '<div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">';
const startMapIdx = content.indexOf(originalMapStart);
let braceCount = 0;
let endMapIdx = -1;
for (let i = startMapIdx; i < content.length; i++) {
    if (content.substring(i, i + 4) === '<div') {
        braceCount++;
    } else if (content.substring(i, i + 5) === '</div') {
        braceCount--;
        if (braceCount === 0) {
            endMapIdx = i + 6;
            break;
        }
    }
}
const newMap = `<div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col md:flex-row gap-8 justify-between">
            <div className="flex-1 flex flex-col">
              {/* Biblioteca Viva */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                <Globe className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.live_library')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.imports_to')}</span>
              </div>
              
              {/* Repertório */}
              <div className="flex items-center gap-3 bg-[#2B85EB]/10 p-4 rounded-xl border border-[#2B85EB]/20">
                <ListMusic className="w-5 h-5 text-[#2B85EB] shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.repertoire')}</span>
              </div>
              
              {/* Cifras / Letras */}
              <div className="pl-6 ml-6 border-l-2 border-white/10 py-3 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.chords')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 border-b-2 border-white/10" />
                  <FileText className="w-4 h-4 text-[#A0A7B5] shrink-0" />
                  <span className="text-sm text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.lyrics')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.supplies_songs_to')}</span>
              </div>
              
              {/* Escala de Músicas */}
              <div className="flex items-center gap-3 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <CalendarDays className="w-5 h-5 text-green-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.music_scale')}</span>
              </div>
            </div>
            
            <div className="hidden md:flex flex-col items-center justify-end pb-6 px-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                  <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                  <span className="text-xs text-[#A0A7B5] whitespace-nowrap">{t('dashboard.musicscale.center.resources.flow.can_link_to')}</span>
                  <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link')}</span>
                </div>
                <div className="w-full border-b border-dashed border-white/20" />
              </div>
            </div>
            
            <div className="md:hidden flex flex-col items-center py-2">
              <div className="h-6 border-l border-dashed border-white/20 mb-3" />
              <div className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-1.5 rounded-full">
                <LinkIcon className="w-3.5 h-3.5 text-[#A0A7B5]" />
                <span className="text-xs text-[#A0A7B5]">{t('dashboard.musicscale.center.resources.flow.can_link_to')}</span>
                <span className="text-[10px] uppercase font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">{t('dashboard.musicscale.center.resources.flow.optional_link')}</span>
              </div>
              <div className="h-6 border-l border-dashed border-white/20 mt-3" />
            </div>

            <div className="flex-1 flex flex-col">
              {/* Integrantes */}
              <div className="flex items-center gap-3 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <Users className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.members')}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 px-6 text-[#A0A7B5]">
                <ArrowDown className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{t('dashboard.musicscale.center.resources.flow.forms')}</span>
              </div>
              
              {/* Escala da Banda */}
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 md:mt-auto">
                <CalendarDays className="w-5 h-5 text-white shrink-0" />
                <span className="font-semibold text-white">{t('dashboard.musicscale.center.resources.flow.band_scale')}</span>
              </div>
            </div>
          </div>
        </div>`;

content = content.substring(0, startMapIdx) + newMap + content.substring(endMapIdx);
if (!content.includes('LinkIcon') && !content.includes('Link as LinkIcon')) {
    content = content.replace('ArrowDown,', 'ArrowDown, Link as LinkIcon,');
}

fs.writeFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', content);

