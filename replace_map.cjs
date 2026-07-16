const fs = require('fs');

const file = 'src/components/dashboard/MusicScaleGuideCenter.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace map
const startToken = '<div className="mb-12 bg-[#050505] border border-white/5 rounded-2xl p-6 lg:p-8">';
const startIdx = content.indexOf(startToken);
if (startIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = startIdx; i < content.length; i++) {
        if (content.substring(i, i + 4) === '<div') {
            braceCount++;
        } else if (content.substring(i, i + 5) === '</div') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i + 6;
                break;
            }
        }
    }
    if (endIdx !== -1) {
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
        content = content.substring(0, startIdx) + newMap + content.substring(endIdx);
    }
}

// Add LinkIcon import
if (!content.includes('LinkIcon') && !content.includes('Link as LinkIcon')) {
    content = content.replace('ArrowDown,', 'ArrowDown, Link as LinkIcon,');
}

// Replace exact strings matching the DOM structure, ignoring inside t()
content = content.replace(/>\s*Músicas e conteúdo\s*</g, ">{t('dashboard.musicscale.center.resources.groups.music_content')}<");
content = content.replace(/>\s*Equipe e escalas\s*</g, ">{t('dashboard.musicscale.center.resources.groups.team_scales')}<");
content = content.replace(/>\s*Você pode:\s*</g, ">{t('dashboard.musicscale.center.common.can_do')}:<");
content = content.replace(/>\s*Onde encontrar\s*</g, ">{t('dashboard.musicscale.center.common.where_to_find')}<");
content = content.replace(/>\s*Na prática:\s*</g, ">{t('dashboard.musicscale.center.common.in_practice')}:<");
content = content.replace(/>\s*O que é:\s*</g, ">{t('dashboard.musicscale.center.common.what_is')}:<");
content = content.replace(/>\s*Por que é importante:\s*</g, ">{t('dashboard.musicscale.center.common.why_important')}:<");
content = content.replace(/>\s*Como fazer:\s*</g, ">{t('dashboard.musicscale.center.common.how_to')}:<");
content = content.replace(/>\s*Resultado esperado:\s*</g, ">{t('dashboard.musicscale.center.common.expected_result')}:<");
content = content.replace(/>\s*Importante:\s*</g, ">{t('dashboard.musicscale.center.common.important')}:<");

// Now for the paths in <p> tags
content = content.replace(/>Repertório \S+ Músicas \S+ Importar com IA</g, ">{t('dashboard.musicscale.center.paths.ai_import')}<");
content = content.replace(/>Repertório \S+ Músicas</g, ">{t('dashboard.musicscale.center.paths.repertoire_songs')}<");
content = content.replace(/>Repertório \S+ Cifras</g, ">{t('dashboard.musicscale.center.paths.repertoire_chords')}<");
content = content.replace(/>Repertório \S+ Letras</g, ">{t('dashboard.musicscale.center.paths.repertoire_lyrics')}<");
content = content.replace(/>Escalas \S+ Escalas de Músicas</g, ">{t('dashboard.musicscale.center.paths.scales_songs')}<");
content = content.replace(/>Escalas \S+ Escalas da Banda</g, ">{t('dashboard.musicscale.center.paths.scales_band')}<");

// For Biblioteca Viva and Integrantes, they are in <p className="text-sm text-[#A0A7B5] mb-3">Biblioteca Viva</p>
content = content.replace(/>Biblioteca Viva</g, ">{t('dashboard.musicscale.center.paths.live_library')}<");
content = content.replace(/>Integrantes</g, ">{t('dashboard.musicscale.center.paths.members')}<");

fs.writeFileSync(file, content);
console.log('Update complete');
