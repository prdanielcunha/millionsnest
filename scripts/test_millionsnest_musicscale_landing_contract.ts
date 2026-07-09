import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting landing contract tests...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const checkFile = (filePath: string, asserts: (content: string) => void) => {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      assert(false, `File not found: ${filePath}`);
      return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    asserts(content);
  };

  checkFile('src/components/Hero.tsx', (content) => {
    assert(!content.includes("alert("), "Hero: CTA does not use alert()");
    assert(content.includes("/musicscale#musicscale-demo"), "Hero: CTA points to /musicscale#musicscale-demo");
  });

  checkFile('src/components/Flagship.tsx', (content) => {
    assert(!content.includes("alert("), "Flagship: CTA does not use alert()");
    assert(content.includes("/musicscale#musicscale-demo"), "Flagship: CTA points to /musicscale#musicscale-demo");
  });

  checkFile('src/pages/MusicScaleLanding.tsx', (content) => {
    assert(content.includes("/LogoIconMusicScale-1.png"), "MusicScaleLanding: Uses LogoIconMusicScale-1.png");
    assert(content.includes("<Pricing />"), "MusicScaleLanding: Includes Pricing component");
    assert(!content.includes("alert("), "MusicScaleLanding: Does not use alert() for demos");
    assert(content.includes("handleStartTrial"), "MusicScaleLanding: handleStartTrial is present for purchase_intent");
  });

  checkFile('src/pages/Home.tsx', (content) => {
    assert(!content.includes("<Pricing"), "Home: Does not include Pricing directly");
  });

  checkFile('src/components/EscalasMockup.tsx', (content) => {
    assert(content.includes("/LogoIconMusicScale-1.png"), "EscalasMockup: Uses LogoIconMusicScale-1.png");
  });

  checkFile('src/pages/Dashboard.tsx', (content) => {
    assert(content.includes("/LogoIconMusicScale-1.png"), "Dashboard: Uses LogoIconMusicScale-1.png");
  });

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
