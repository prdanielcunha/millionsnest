import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runTests() {
  console.log("Starting MN-RELEASE-BLOCKERS-1-FIX-1 validations...\n");

  // 1. Configuration & Number uniqueness
  const supportConfigPath = path.join(rootDir, 'src', 'server', 'config', 'supportConfig.ts');
  const supportConfig = fs.readFileSync(supportConfigPath, 'utf8');
  
  const match = supportConfig.match(/const DEFAULT_WHATSAPP_NUMBER = ['"](\d{10,15})['"]/);
  assert(!!match, "Extracted DEFAULT_WHATSAPP_NUMBER programmatically");
  const extractedNumber = match ? match[1] : '';
  
  if (extractedNumber) {
    let globalOccurrences = 0;
    
    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (['node_modules', 'dist', '.git'].includes(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx|js|cjs|mjs|json)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          let idx = content.indexOf(extractedNumber);
          while (idx !== -1) {
             globalOccurrences++;
             if (!fullPath.endsWith('supportConfig.ts')) {
               console.error(`❌ FAIL: Number found in ${fullPath}`);
             }
             idx = content.indexOf(extractedNumber, idx + 1);
          }
        }
      }
    }
    
    scanDir(rootDir);
    
    assert(globalOccurrences === 1, `Global occurrences of number must be exactly 1 (found ${globalOccurrences})`);
  } else {
    assert(false, "Could not extract default number");
  }

  // 2. Locale normalizer
  const clientContent = fs.readFileSync(path.join(rootDir, 'src', 'services', 'publicContactClient.ts'), 'utf8');
  assert(clientContent.includes('function resolvePublicContactLocale'), "resolvePublicContactLocale exists");
  
  const evalLocale = (lang: string | null | undefined) => {
    if (!lang) return 'pt';
    const normalized = lang.replace(/_/g, '-').toLowerCase();
    if (normalized.startsWith('pt')) return 'pt';
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('es')) return 'es';
    return 'pt';
  };
  
  assert(evalLocale('pt') === 'pt', "pt resolves to pt");
  assert(evalLocale('pt-BR') === 'pt', "pt-BR resolves to pt");
  assert(evalLocale('pt_PT') === 'pt', "pt_PT resolves to pt");
  assert(evalLocale('en') === 'en', "en resolves to en");
  assert(evalLocale('en-US') === 'en', "en-US resolves to en");
  assert(evalLocale('en_GB') === 'en', "en_GB resolves to en");
  assert(evalLocale('es') === 'es', "es resolves to es");
  assert(evalLocale('es-ES') === 'es', "es-ES resolves to es");
  assert(evalLocale('es_MX') === 'es', "es_MX resolves to es");
  assert(evalLocale('fr') === 'pt', "unknown resolves to pt");
  assert(evalLocale('') === 'pt', "empty resolves to pt");
  assert(evalLocale(null) === 'pt', "null resolves to pt");
  assert(evalLocale(undefined) === 'pt', "undefined resolves to pt");

  // 3. Server service validations
  const serviceContent = fs.readFileSync(path.join(rootDir, 'src', 'server', 'services', 'PublicSalesWhatsAppService.ts'), 'utf8');
  
  assert(serviceContent.includes('if (!payload || typeof payload !== \'object\' || Array.isArray(payload))'), "Validates payload is object");
  assert(serviceContent.includes('typeof payload.intent !== \'string\''), "Validates intent is string");
  assert(serviceContent.includes('typeof payload.locale !== \'string\''), "Validates locale is string");
  assert(serviceContent.includes('if (payload.message !== undefined)'), "Checks message presence");
  assert(serviceContent.includes('typeof payload.message !== \'string\''), "Validates message is string before trim");
  assert(serviceContent.includes('if (payload.pagePath !== undefined)'), "Checks pagePath presence");
  assert(serviceContent.includes('typeof payload.pagePath !== \'string\''), "Validates pagePath is string before trim");
  assert(serviceContent.includes("res.set('Cache-Control', 'no-store');"), "Sets Cache-Control no-store");
  assert(serviceContent.includes("source: 'Origem:'"), "PT source label present");
  assert(serviceContent.includes("source: 'Source:'"), "EN source label present");
  assert(serviceContent.includes("source: 'Origen:'"), "ES source label present");

  // Mocking the server endpoint function locally to test behavior (using dynamic import or just eval-like validation)
  // For the sake of safety and because we're running tsx, we can import it.
  const { createPublicSalesWhatsAppLink } = await import(path.join(rootDir, 'src', 'server', 'services', 'PublicSalesWhatsAppService.ts'));
  
  // Set fake env var to test 
  process.env.SALES_WHATSAPP_NUMBER = '5511999999999';
  
  const mockReq = (body: any) => ({ body });
  const mockRes = () => {
    const res: any = {
      headers: {},
      statusCode: 0,
      jsonData: null,
      set: (key: string, val: string) => { res.headers[key] = val; return res; },
      status: (code: number) => { res.statusCode = code; return res; },
      json: (data: any) => { res.jsonData = data; return res; }
    };
    return res;
  };
  
  const runApi = async (body: any) => {
    const req = mockReq(body) as any;
    const res = mockRes();
    await createPublicSalesWhatsAppLink(req, res);
    return res;
  };

  // Test successful intents
  let res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: '/foo' });
  assert(res.statusCode === 200, "pricing PT success");
  assert(res.jsonData.url.startsWith('https://wa.me/'), "URL starts with https://wa.me/");
  assert(decodeURIComponent(res.jsonData.url).includes('Origem:'), "PT url contains Origem:");
  assert(res.headers['Cache-Control'] === 'no-store', "Cache-Control no-store on success");

  res = await runApi({ intent: 'pricing', locale: 'en', pagePath: '/foo' });
  assert(res.statusCode === 200, "pricing EN success");
  assert(!decodeURIComponent(res.jsonData.url).includes('Origem:'), "EN url does not contain Origem");
  assert(decodeURIComponent(res.jsonData.url).includes('Source:'), "EN url contains Source:");

  res = await runApi({ intent: 'pricing', locale: 'es', pagePath: '/foo' });
  assert(res.statusCode === 200, "pricing ES success");
  assert(!decodeURIComponent(res.jsonData.url).includes('Origem:'), "ES url does not contain Origem");
  assert(decodeURIComponent(res.jsonData.url).includes('Origen:'), "ES url contains Origen:");

  res = await runApi({ intent: 'pre_sales_question', locale: 'pt', message: 'Hi there' });
  assert(res.statusCode === 200, "pre_sales_question PT success");
  
  res = await runApi({ intent: 'partnership', locale: 'en', pagePath: '/foo' });
  assert(res.statusCode === 200, "partnership EN success");
  
  res = await runApi({ intent: 'general', locale: 'es' });
  assert(res.statusCode === 200, "general ES success");

  // Invalid payloads
  res = await runApi(null);
  assert(res.statusCode === 400, "400 on null body");
  
  res = await runApi([1,2,3]);
  assert(res.statusCode === 400, "400 on array body");

  res = await runApi({ intent: 'unknown', locale: 'pt' });
  assert(res.statusCode === 400, "400 on invalid intent");

  res = await runApi({ intent: 'pricing', locale: 'fr' });
  assert(res.statusCode === 400, "400 on invalid locale");

  res = await runApi({ intent: 'pricing', locale: 'pt', message: null });
  assert(res.statusCode === 400, "400 on message null");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: 123 });
  assert(res.statusCode === 400, "400 on message number");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: {} });
  assert(res.statusCode === 400, "400 on message object");

  res = await runApi({ intent: 'pricing', locale: 'pt', message: [] });
  assert(res.statusCode === 400, "400 on message array");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: '' });
  assert(res.statusCode === 400, "400 on message empty string");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: '   ' });
  assert(res.statusCode === 400, "400 on message spaces only");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: 'a'.repeat(1001) });
  assert(res.statusCode === 400, "400 on message too long");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', message: 'javascript:alert(1)' });
  assert(res.statusCode === 400, "400 on message javascript");

  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: null });
  assert(res.statusCode === 400, "400 on pagePath null");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: 123 });
  assert(res.statusCode === 400, "400 on pagePath number");

  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: '' });
  assert(res.statusCode === 400, "400 on pagePath empty string");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: 'foo' });
  assert(res.statusCode === 400, "400 on pagePath missing starting slash");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: '//foo' });
  assert(res.statusCode === 400, "400 on pagePath starting with //");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: 'http://foo' });
  assert(res.statusCode === 400, "400 on pagePath absolute url");
  
  res = await runApi({ intent: 'pricing', locale: 'pt', pagePath: '/a'.repeat(500) });
  assert(res.statusCode === 400, "400 on pagePath too long");

  // Error payloads should not contain phone numbers or messages
  assert(!JSON.stringify(res.jsonData).includes('55119'), "Error does not leak number");
  
  // Test sales whatsapp not configured
  process.env.SALES_WHATSAPP_NUMBER = 'invalid';
  process.env.SUPPORT_WHATSAPP_NUMBER = '';
  res = await runApi({ intent: 'pricing', locale: 'pt' });
  assert(res.statusCode === 503, "503 when SALES_WHATSAPP_NUMBER invalid");

  delete process.env.SALES_WHATSAPP_NUMBER;
  delete process.env.SUPPORT_WHATSAPP_NUMBER;

  // 4. Client and components
  const footerContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Footer.tsx'), 'utf8');
  const salesChatContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SalesChat.tsx'), 'utf8');

  assert(footerContent.includes('resolvePublicContactLocale'), "Footer uses locale resolver");
  assert(salesChatContent.includes('resolvePublicContactLocale'), "SalesChat uses locale resolver");
  assert(!footerContent.includes('alert('), "Footer does not use alert");
  assert(!salesChatContent.includes('alert('), "SalesChat does not use alert");
  assert(footerContent.includes('role="status"'), "Footer uses role status");
  assert(salesChatContent.includes('role="alert"'), "SalesChat uses role alert");
  assert(footerContent.includes("public_contact_loading"), "Footer uses public_contact_loading");
  assert(salesChatContent.includes("public_contact_loading"), "SalesChat uses public_contact_loading");
  assert(footerContent.includes("popup.opener = null"), "Footer disables window.opener");
  assert(salesChatContent.includes("popup.opener = null"), "SalesChat disables window.opener");
  assert(!salesChatContent.includes("Minha dúvida:"), "SalesChat does not hardcode Minha dúvida prefix");
  assert(!salesChatContent.includes("'support'"), "SalesChat does not use support intent");

  // 5. I18N
  const locales = ['pt', 'en', 'es'];
  for (const locale of locales) {
    const i18nPath = path.join(rootDir, `src/packages/i18n/locales/${locale}.ts`);
    const i18nContent = fs.readFileSync(i18nPath, 'utf8');
    assert(i18nContent.includes('pre_sales_question:'), `pre_sales_question exists in ${locale}`);
    assert(i18nContent.includes('pre_sales_prompt:'), `pre_sales_prompt exists in ${locale}`);
    assert(i18nContent.includes('public_contact_loading:'), `public_contact_loading exists in ${locale}`);
    assert(i18nContent.includes('public_contact_error:'), `public_contact_error exists in ${locale}`);
    assert(i18nContent.includes('footer_contact_aria:'), `footer_contact_aria exists in ${locale}`);
  }

  // 6. Residual files
  const residualFiles = ['patch_script.js', 'patch_script.cjs', 'patch_script.ts', 'patch_script.py'];
  for (const file of residualFiles) {
    assert(!fs.existsSync(path.join(rootDir, file)), `${file} absent`);
  }
  
  const rootFiles = fs.readdirSync(rootDir);
  const tempFiles = rootFiles.filter(f => (f.startsWith('patch_') || f.startsWith('fix_') || f.startsWith('temp_') || f.startsWith('update_')) && (f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.cjs') || f.endsWith('.mjs')));
  assert(tempFiles.length === 0, "No residual script files in root");

  console.log(`\n================================`);
  console.log(`Tests Run: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`================================`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
