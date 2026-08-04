import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting landing contract tests (MN-MS-SALES-SCOPE-01)...");
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

  // Base assertions
  checkFile('src/components/Hero.tsx', (content) => {
    assert(!content.includes("alert("), "Hero: CTA does not use alert()");
    assert(content.includes("/musicscale#musicscale-demo"), "Hero: CTA points to /musicscale#musicscale-demo");
  });

  // 1 & 2: Flagship
  checkFile('src/components/Flagship.tsx', (content) => {
    assert(!content.includes("alert("), "Flagship: CTA does not use alert()");
    assert(content.includes("/musicscale#musicscale-demo"), "Flagship: CTA points to /musicscale#musicscale-demo");
    assert(content.includes("subscription_scope_badge"), "1. Flagship possui a chave landing:subscription_scope_badge");
    assert(content.includes("subscription_scope_desc"), "2. Flagship possui a chave landing:subscription_scope_desc");
  });

  // 3 & 4: MusicScaleLanding
  checkFile('src/pages/MusicScaleLanding.tsx', (content) => {
    assert(content.includes("/LogoIconMusicScale-1.png"), "MusicScaleLanding: Uses LogoIconMusicScale-1.png");
    assert(content.includes("<Pricing />"), "MusicScaleLanding: Includes Pricing component");
    assert(!content.includes("alert("), "MusicScaleLanding: Does not use alert() for demos");
    assert(content.includes("handleStartTrial"), "MusicScaleLanding: handleStartTrial is present for purchase_intent");
    assert(content.includes("subscription_scope_badge"), "3. MusicScaleLanding possui a chave musicscale:subscription_scope_badge");
    assert(content.includes("subscription_scope_desc"), "4. MusicScaleLanding possui a chave musicscale:subscription_scope_desc");
  });

  // 5 & 6: Pricing
  checkFile('src/components/Pricing.tsx', (content) => {
    assert(content.includes("pricing_organization_scope_badge"), "5. Pricing possui a chave landing:pricing_organization_scope_badge");
    assert(content.includes("pricing_organization_scope_desc"), "6. Pricing possui a chave landing:pricing_organization_scope_desc");
  });

  // 7 & 8: FAQ
  checkFile('src/components/FAQ.tsx', (content) => {
    assert(content.includes("faq_q5"), "7. FAQ possui t('faq_q5')");
    assert(content.includes("faq_a5"), "8. FAQ possui t('faq_a5')");
  });

  // 9 & 10: SalesChat
  checkFile('src/components/SalesChat.tsx', (content) => {
    assert(content.includes("faq_q5"), "9. SalesChat possui q: t('faq_q5')");
    assert(content.includes("faq_a5"), "10. SalesChat possui a: t('faq_a5')");
  });

  // 11 & 12: Checkout
  checkFile('src/pages/Checkout.tsx', (content) => {
    assert(content.includes("subscription_scope_summary_title"), "11. Checkout possui checkout:subscription_scope_summary_title");
    assert(content.includes("subscription_scope_summary_desc"), "12. Checkout possui checkout:subscription_scope_summary_desc");
  });

  // 13 - 22: pt.ts
  checkFile('src/packages/i18n/locales/pt.ts', (content) => {
    assert(content.includes("subscription_scope_badge"), "13. pt.ts possui landing.subscription_scope_badge");
    assert(content.includes("subscription_scope_desc"), "14. pt.ts possui landing.subscription_scope_desc");
    assert(content.includes("pricing_organization_scope_badge"), "15. pt.ts possui landing.pricing_organization_scope_badge");
    assert(content.includes("pricing_organization_scope_desc"), "16. pt.ts possui landing.pricing_organization_scope_desc");
    assert(content.includes("faq_q5"), "17. pt.ts possui landing.faq_q5");
    assert(content.includes("faq_a5"), "18. pt.ts possui landing.faq_a5");
    assert(content.includes("subscription_scope_badge"), "19. pt.ts possui musicscale.subscription_scope_badge");
    assert(content.includes("subscription_scope_desc"), "20. pt.ts possui musicscale.subscription_scope_desc");
    assert(content.includes("subscription_scope_summary_title"), "21. pt.ts possui checkout.subscription_scope_summary_title");
    assert(content.includes("subscription_scope_summary_desc"), "22. pt.ts possui checkout.subscription_scope_summary_desc");
  });

  // 23: en.ts
  checkFile('src/packages/i18n/locales/en.ts', (content) => {
    const hasKeys = [
      "subscription_scope_badge",
      "subscription_scope_desc",
      "pricing_organization_scope_badge",
      "pricing_organization_scope_desc",
      "faq_q5",
      "faq_a5",
      "subscription_scope_summary_title",
      "subscription_scope_summary_desc"
    ].every(k => content.includes(k));
    assert(hasKeys, "23. en.ts possui todas as chaves equivalentes da MN-MS-SALES-SCOPE-01");
  });

  // 24: es.ts
  checkFile('src/packages/i18n/locales/es.ts', (content) => {
    const hasKeys = [
      "subscription_scope_badge",
      "subscription_scope_desc",
      "pricing_organization_scope_badge",
      "pricing_organization_scope_desc",
      "faq_q5",
      "faq_a5",
      "subscription_scope_summary_title",
      "subscription_scope_summary_desc"
    ].every(k => content.includes(k));
    assert(hasKeys, "24. es.ts possui todas as chaves equivalentes da MN-MS-SALES-SCOPE-01");
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
