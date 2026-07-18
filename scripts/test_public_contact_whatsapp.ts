import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("Starting MN-RELEASE-BLOCKERS-1 validations...\n");

// 1. Residual files
const residualFiles = ['patch_script.js', 'patch_script.cjs', 'patch_script.ts', 'patch_script.py'];
let foundResidual = false;
for (const file of residualFiles) {
  if (fs.existsSync(path.join(rootDir, file))) {
    console.error(`❌ Found residual file: ${file}`);
    foundResidual = true;
  }
}
assert(!foundResidual, "Residual files must be removed");
console.log("✅ No residual files found.");

// 2. Configuration
const supportConfigPath = path.join(rootDir, 'src', 'server', 'config', 'supportConfig.ts');
const supportConfig = fs.readFileSync(supportConfigPath, 'utf8');
assert(supportConfig.includes("const DEFAULT_WHATSAPP_NUMBER = '5543999907071';"), "DEFAULT_WHATSAPP_NUMBER not found");
assert(supportConfig.includes('const rawSupportNumber = process.env.SUPPORT_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER;'), "support whatsapp config wrong");
assert(supportConfig.includes('const rawSalesNumber = process.env.SALES_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER;'), "sales whatsapp config wrong");
assert(supportConfig.includes('salesWhatsappNumber = normalizeNumber(rawSalesNumber)'), "sales whatsapp config export wrong");
console.log("✅ Configuration correctly centralized.");

// 3. Server service
const servicePath = path.join(rootDir, 'src', 'server', 'services', 'PublicSalesWhatsAppService.ts');
assert(fs.existsSync(servicePath), "PublicSalesWhatsAppService.ts does not exist");
const serviceContent = fs.readFileSync(servicePath, 'utf8');
assert(serviceContent.includes('getSupportConfig()'), "Service does not use supportConfig");
assert(serviceContent.includes('salesWhatsappNumber'), "Service does not use salesWhatsappNumber");
console.log("✅ Server-side logic separated and correctly referencing config.");

// 4. API Registration
const serverPath = path.join(rootDir, 'server.ts');
const serverContent = fs.readFileSync(serverPath, 'utf8');
assert(serverContent.includes("app.post('/api/v1/public/sales/whatsapp-link'"), "API route not registered");
assert(serverContent.includes("import { createPublicSalesWhatsAppLink } from './src/server/services/PublicSalesWhatsAppService.js';"), "API route does not import the service");
assert(serverContent.includes("createPublicSalesWhatsAppLink);"), "API route does not use the service handler");
console.log("✅ API route registered successfully.");

// 5. Client integration
const clientPath = path.join(rootDir, 'src', 'services', 'publicContactClient.ts');
assert(fs.existsSync(clientPath), "publicContactClient.ts does not exist");
const clientContent = fs.readFileSync(clientPath, 'utf8');
assert(clientContent.includes('fetch(\'/api/v1/public/sales/whatsapp-link\''), "Client does not fetch API");
assert(!clientContent.includes('5543999907071'), "Client must not contain the number");

const footerPath = path.join(rootDir, 'src', 'components', 'Footer.tsx');
const footerContent = fs.readFileSync(footerPath, 'utf8');
assert(footerContent.includes('createPublicSalesWhatsAppLink'), "Footer does not use client");
assert(!footerContent.includes('5543999907071'), "Footer must not contain the number");
assert(footerContent.includes('window.open(\'about:blank\', \'_blank\')'), "Footer must synchronously open blank window");

const salesChatPath = path.join(rootDir, 'src', 'components', 'SalesChat.tsx');
const salesChatContent = fs.readFileSync(salesChatPath, 'utf8');
assert(salesChatContent.includes('createPublicSalesWhatsAppLink'), "SalesChat does not use client");
assert(!salesChatContent.includes('5543999907071'), "SalesChat must not contain the number");
assert(salesChatContent.includes('window.open(\'about:blank\', \'_blank\')'), "SalesChat must synchronously open blank window");
assert(salesChatContent.includes('pre_sales_question'), "SalesChat must use pre_sales_question intent instead of support");
assert(!salesChatContent.includes("'support'"), "SalesChat must NOT use support intent");
console.log("✅ Client integration correct and numbers stripped from frontend.");

// 6. i18n
const locales = ['pt', 'en', 'es'];
for (const locale of locales) {
  const i18nPath = path.join(rootDir, `src/packages/i18n/locales/${locale}.ts`);
  const i18nContent = fs.readFileSync(i18nPath, 'utf8');
  assert(i18nContent.includes('pre_sales_question:'), `pre_sales_question missing in ${locale}`);
  assert(i18nContent.includes('pre_sales_prompt:'), `pre_sales_prompt missing in ${locale}`);
}
console.log("✅ i18n keys correctly added.");

console.log("\n✅ All MN-RELEASE-BLOCKERS-1 validations passed successfully!");
