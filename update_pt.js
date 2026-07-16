const fs = require('fs');

const ptContent = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf8');

// I will just use string replacement or regex to insert the new blocks.

// 1. common
const commonStr = `            "common": {
                  "can_do": "Você pode:",
                  "where_to_find": "Onde encontrar",
                  "in_practice": "Na prática:",
                  "what_is": "O que é:",
                  "why_important": "Por que é importante:",
                  "how_to": "Como fazer:",
                  "expected_result": "Resultado esperado:",
                  "important": "Importante:",
                  "global_collection": "Acervo global",
                  "optional": "Opcional"
            },
            "paths": {
                  "repertoire_songs": "Repertório → Músicas",
                  "repertoire_chords": "Repertório → Cifras",
                  "repertoire_lyrics": "Repertório → Letras",
                  "live_library": "Biblioteca Viva",
                  "ai_import": "Repertório → Músicas → Importar com IA",
                  "members": "Integrantes",
                  "scales_band": "Escalas → Escalas da Banda",
                  "scales_songs": "Escalas → Escalas de Músicas"
            },`;

let newPt = ptContent.replace('"tabs": {', commonStr + '\n            "tabs": {');

// 2. resources.groups
const groupsStr = `
                  "groups": {
                        "music_content": "Músicas e conteúdo",
                        "team_scales": "Equipe e escalas"
                  },`;

newPt = newPt.replace('"title": "Conheça o MusicScale por dentro",', '"title": "Conheça o MusicScale por dentro",' + groupsStr);

// 3. resources.flow
const flowReplacer = `"band_scale": "Escala da Banda",
                        "imports_to": "importa para",
                        "supplies_songs_to": "fornece músicas para",
                        "forms": "formam",
                        "can_link_to": "pode ser vinculada",
                        "optional_link": "opcional",`;

newPt = newPt.replace('"band_scale": "Escala da Banda",', flowReplacer);

fs.writeFileSync('src/packages/i18n/locales/pt.ts', newPt);
console.log("Updated pt.ts");
