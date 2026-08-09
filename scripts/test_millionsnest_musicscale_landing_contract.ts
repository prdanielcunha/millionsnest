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
    assert(content.includes("subscription_scope_badge"), "1. MusicScaleLanding possui a chave musicscale:subscription_scope_badge");
    assert(content.includes("subscription_scope_desc"), "2. MusicScaleLanding possui a chave musicscale:subscription_scope_desc");
    const ctaIndex = content.indexOf("musicscale:hero_cta_primary");
    const scopeIndex = content.indexOf("musicscale:subscription_scope_badge");
    const benefitIndex = content.indexOf("musicscale:hero_benefit_1");
    assert(ctaIndex >= 0 && scopeIndex > ctaIndex, "3. o índice de subscription_scope_badge é maior que o índice de hero_cta_primary");
    assert(scopeIndex >= 0 && benefitIndex > 0 && scopeIndex < benefitIndex, "4. o índice de subscription_scope_badge é menor que o índice de hero_benefit_1");
  });

  // 5 & 6: Pricing
  checkFile('src/components/Pricing.tsx', (content) => {
    assert(content.includes("pricing_organization_scope_badge"), "5. Pricing possui a chave landing:pricing_organization_scope_badge");
    assert(content.includes("pricing_organization_scope_desc"), "6. Pricing possui a chave landing:pricing_organization_scope_desc");
    const descriptionIndex = content.indexOf("landing:pricing_desc");
    const scopeIndex = content.indexOf("pricing_organization_scope_badge");
    const monthlyIndex = content.indexOf("pricing_monthly_tab");
    assert(descriptionIndex >= 0 && scopeIndex > descriptionIndex && scopeIndex < monthlyIndex, "7. o índice de pricing_organization_scope_badge é menor que o índice de pricing_monthly_tab");
    assert(content.includes("pricing_organization_scope_label"), "8. Pricing contém pricing_organization_scope_label");
    const labelOccurrences = content.match(/pricing_organization_scope_label/g)?.length ?? 0;
    assert(labelOccurrences === 3, "9. pricing_organization_scope_label aparece exatamente três vezes em Pricing.tsx");
    
    // Check order in cards
    const starterPos = content.indexOf("prices.starter_monthly > 0");
    const firstLabel = content.indexOf("pricing_organization_scope_label", starterPos);
    const firstTrial = content.indexOf("pricing_free_trial", firstLabel);
    
    const advPos = content.indexOf("prices.advanced_monthly > 0");
    const secondLabel = content.indexOf("pricing_organization_scope_label", advPos);
    const secondTrial = content.indexOf("pricing_free_trial", secondLabel);
    
    const proPos = content.indexOf("prices.pro_monthly > 0");
    const thirdLabel = content.indexOf("pricing_organization_scope_label", proPos);
    const thirdTrial = content.indexOf("pricing_free_trial", thirdLabel);
    
    assert(
      firstLabel > starterPos && firstLabel < firstTrial &&
      secondLabel > advPos && secondLabel < secondTrial &&
      thirdLabel > proPos && thirdLabel < thirdTrial,
      "10. em cada plano, o rótulo aparece depois do preço e antes de pricing_free_trial"
    );
    
    // Check lookupKeys and other features
    const lookupKeys = [
      "musicscale_starter_monthly", "musicscale_starter_yearly",
      "musicscale_advanced_monthly", "musicscale_advanced_yearly",
      "musicscale_pro_monthly", "musicscale_pro_yearly"
    ];
    assert(lookupKeys.every(k => content.includes(k)), "20. os lookupKeys dos seis planos permanecem presentes");
    assert(["Starter", "Advanced", "Pro"].every(k => content.includes(k)), "21. Starter, Advanced e Pro permanecem presentes");
    assert(content.includes("pricing_free_trial"), "22. pricing_free_trial permanece presente");
    assert(!content.includes("stripe.redirectToCheckout") && !content.includes("loadStripe"), "23. nenhuma lógica Stripe nova foi adicionada");
    assert(!content.includes("/ user") && !content.includes("/ userLimit"), "24. nenhum preço foi dividido por usuário");
  });

  // 7 & 8: FAQ
  checkFile('src/components/FAQ.tsx', (content) => {
    assert(content.includes("faq_q5"), "7. FAQ possui t('faq_q5')");
    assert(content.includes("faq_a5"), "8. FAQ possui t('faq_a5')");
  });

  // 9 & 10: SalesChat
  checkFile('src/components/SalesChat.tsx', (content) => {
    assert(content.includes("faq_q5"), "11. SalesChat contém faq_q5");
    assert(content.includes("faq_a5"), "12. SalesChat contém faq_a5");
    const faqScopeIndex = content.indexOf("q: t('faq_q5')");
    const faqOneIndex = content.indexOf("q: t('faq_q1')");
    assert(faqScopeIndex >= 0 && faqScopeIndex < faqOneIndex, "13. faq_q5 aparece antes de faq_q1 no array commonQuestions");
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
    assert(content.includes("pricing_organization_scope_label"), "14. pt.ts contém pricing_organization_scope_label");
    assert(content.includes("Valor por organização, não por pessoa."), "17. o texto português contém exatamente: Valor por organização, não por pessoa.");
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
    assert(content.includes("pricing_organization_scope_label"), "15. en.ts contém pricing_organization_scope_label");
    assert(content.includes("Price per organization, not per person."), "18. o texto inglês contém exatamente: Price per organization, not per person.");
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
    assert(content.includes("pricing_organization_scope_label"), "16. es.ts contém pricing_organization_scope_label");
    assert(content.includes("Precio por organización, no por persona."), "19. o texto espanhol contém exactamente: Precio por organización, no por persona.");
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
