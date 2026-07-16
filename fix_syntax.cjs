const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');

// Find nested {t( inside t(
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.songs\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.songs.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.chords\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.chords.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.members\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.members.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.band\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.band.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.music\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.music.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.review\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.review.how')");
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.team\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.team.how')");

// Also check for the specific line 844 error where I replaced it incorrectly.
content = content.replace(/t\('dashboard\.musicscale\.center\.getting_started\.steps\.content\.how',\s*'(.*?)'\)/g, "t('dashboard.musicscale.center.getting_started.steps.chords.how')");

// Also add type="button" to ALL buttons that don't have it
content = content.replace(/<button(?!\s+type=)/g, '<button type="button"');

fs.writeFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', content);
