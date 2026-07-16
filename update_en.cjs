const fs = require('fs');
const ptContent = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf8');

const commonStr = `            "common": {
                  "can_do": "You can",
                  "where_to_find": "Where to find",
                  "in_practice": "In practice",
                  "what_is": "What it is",
                  "why_important": "Why it's important",
                  "how_to": "How to do it",
                  "expected_result": "Expected result",
                  "important": "Important",
                  "global_collection": "Global collection",
                  "optional": "Optional"
            },
            "paths": {
                  "repertoire_songs": "Repertoire → Songs",
                  "repertoire_chords": "Repertoire → Chords",
                  "repertoire_lyrics": "Repertoire → Lyrics",
                  "live_library": "Biblioteca Viva",
                  "ai_import": "Repertoire → Songs → Import with AI",
                  "members": "Members",
                  "scales_band": "Scales → Band Scales",
                  "scales_songs": "Scales → Song Scales"
            },`;

let newPt = ptContent.replace('"tabs": {', commonStr + '\n            "tabs": {');

const groupsStr = `
                  "groups": {
                        "music_content": "Music and content",
                        "team_scales": "Team and scales"
                  },`;

newPt = newPt.replace('"title": "Get to know MusicScale inside",', '"title": "Get to know MusicScale inside",' + groupsStr);

const flowReplacer = `"band_scale": "Band Scale",
                        "imports_to": "imports to",
                        "supplies_songs_to": "supplies songs to",
                        "forms": "forms",
                        "can_link_to": "can be linked to",
                        "optional_link": "optional",`;

newPt = newPt.replace('"band_scale": "Band Scale",', flowReplacer);

fs.writeFileSync('src/packages/i18n/locales/en.ts', newPt);
console.log("Updated en.ts");
