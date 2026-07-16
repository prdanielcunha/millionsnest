import re

with open("src/components/dashboard/EcosystemWorkspaceHome.tsx", "r") as f:
    content = f.read()

# Replace the buttons div in renderMusicScaleWorkspace
# Specifically, we look for <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

old_pattern = r'<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">[\s\S]*?</button>\s*</div>'

new_buttons = """<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!hasPaymentIssue ? (
              <button 
                onClick={() => { if(musicScaleApp) onLaunchApp(musicScaleApp); }}
                className="px-6 py-3 bg-[#2B85EB] text-white font-semibold rounded-xl hover:bg-[#3B95FB] transition-all flex items-center gap-2"
              >
                Abrir MusicScale
                <ExternalLink className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4" />
                Assinatura pendente
              </div>
            )}
            <button type="button" onClick={() => onSelectMusicScaleSection('getting-started')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">Primeiros passos</button>
            <button type="button" onClick={() => onSelectMusicScaleSection('resources')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-xl transition-all min-h-[44px]">Conhecer recursos</button>
          </div>"""

content = re.sub(old_pattern, new_buttons, content)

with open("src/components/dashboard/EcosystemWorkspaceHome.tsx", "w") as f:
    f.write(content)
