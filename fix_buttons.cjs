const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');

// The requirement says buttons must have type="button", translated aria-label, min-h-[44px]
// Let's add them where missing

content = content.replace(/<button\s+onClick=\{\(\) => onClose\(\)\}\s+className="p-2/g, `<button\n            type="button"\n            aria-label={t('common.close', 'Fechar')}\n            onClick={() => onClose()}\n            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center`);

content = content.replace(/<button\s+onClick=\{\(\) => onSelectSection\('getting-started'\)\}/g, `<button\n                type="button"\n                aria-label={t('dashboard.musicscale.center.overview.btn_continue')}\n                onClick={() => onSelectSection('getting-started')}`);

content = content.replace(/<button\s+onClick=\{onOpenInviteModal\}/g, `<button\n                  type="button"\n                  aria-label={t('dashboard.musicscale.center.overview.btn_invite')}\n                  onClick={onOpenInviteModal}`);

content = content.replace(/<button\s+onClick=\{onNavigateToBilling\}/g, `<button\n                        type="button"\n                        aria-label={t('dashboard.musicscale.center.overview.resolve_payment')}\n                        onClick={onNavigateToBilling}`);

content = content.replace(/<button\s+onClick=\{onNavigateToMusicScale\}/g, `<button\n          type="button"\n          aria-label={t('dashboard.musicscale.center.resources.btn_open')}\n          onClick={onNavigateToMusicScale}`);

// Also add type="button" to accordion buttons
content = content.replace(/<button\s+onClick=\{\(\) => toggleItem\(item\.id\)\}/g, `<button\n                  type="button"\n                  aria-expanded={expandedItem === item.id}\n                  onClick={() => toggleItem(item.id)}`);

fs.writeFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', content);
