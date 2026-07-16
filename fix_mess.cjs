const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');

content = content.replace(/'\{t\('dashboard.musicscale.center.paths.live_library'\)\}'\)/g, "'Biblioteca Viva')");

// Also check {t('dashboard.musicscale.center.paths.repertoire_songs')} inside strings?
content = content.replace(/'No MusicScale, abra \{t\('dashboard.musicscale.center.paths.repertoire_songs'\)\}. Adicione manualmente, use a importação inteligente ou importe pela \{t\('dashboard.musicscale.center.paths.live_library'\)\}.'\)/g, "'No MusicScale, abra Repertório → Músicas. Adicione manualmente, use a importação inteligente ou importe pela Biblioteca Viva.')");

fs.writeFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', content);
