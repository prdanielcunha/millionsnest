const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');

const replacement = `
            {!hasPaymentIssue ? (
              <button type="button" onClick={() => {
                  if (!isReadyToOpen) onSelectMusicScaleSection('getting-started');
                  else if (musicScaleApp) onLaunchApp(musicScaleApp);
                }}
                disabled={msCatalogState === 'loading' || !isReadyToOpen}
                className="px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all bg-[#2B85EB] hover:bg-[#3B95FB] text-white shadow-lg shadow-[#2B85EB]/20 active:scale-95 min-h-[44px]"
              >
                {msCatalogState === 'loading' ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {t('dashboard.musicscale.hero.open', 'Abrir MusicScale')}
              </button>
            ) : (
              <div className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-semibold flex items-center justify-center min-h-[44px]">
                {t('dashboard.musicscale.status.pending_sub', 'Assinatura pendente')}
              </div>
            )}
            <button type="button" onClick={() => onSelectMusicScaleSection('getting-started')} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5 min-h-[44px]">
              {t('dashboard.musicscale.hero.getting_started', 'Primeiros passos')}
            </button>
            <button type="button" onClick={() => onSelectMusicScaleSection('resources')} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5 min-h-[44px]">
              {t('dashboard.musicscale.hero.learn_more', 'Conhecer recursos')}
              <ExternalLink className="w-4 h-4" />
            </button>
`;

// Find where the buttons are
content = content.replace(/<button type="button"[\s\S]*?onClick=\{\(\) => \{[\s\S]*?hasPaymentIssue \? t\('dashboard\.musicscale\.actions\.view_sub'[\s\S]*?<\/button>\s*<button type="button"\s*onClick=\{\(\) => onSelectMusicScaleSection\('resources'\)\}[\s\S]*?<\/button>/, replacement.trim());

fs.writeFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', content);

