const fs = require('fs');

const compPath = 'src/components/dashboard/MusicScaleGuideCenter.tsx';
let compContent = fs.readFileSync(compPath, 'utf8');
compContent = compContent.replace(/getting_started\.steps\.chords/g, 'getting_started.steps.content');
fs.writeFileSync(compPath, compContent);

const testPath = 'scripts/test_ux_foundation_1b1_guided_musicscale_center.ts';
let testContent = fs.readFileSync(testPath, 'utf8');
testContent = testContent.replace(/getting_started\.steps\.chords/g, 'getting_started.steps.content');
fs.writeFileSync(testPath, testContent);

