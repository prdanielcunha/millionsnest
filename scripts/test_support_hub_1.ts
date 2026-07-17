import { execSync } from 'child_process';
import * as fs from 'fs';

console.log('Testing Support Hub and WhatsApp logic...\n');

let pass = true;

const expectToContain = (filePath: string, text: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(text)) {
    console.error(`❌ [FAIL] ${filePath} missing expected string: ${text}`);
    pass = false;
  } else {
    console.log(`✅ [PASS] ${filePath} contains: ${text}`);
  }
};

const expectNotToContain = (filePath: string, text: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(text)) {
    console.error(`❌ [FAIL] ${filePath} SHOULD NOT contain string: ${text}`);
    pass = false;
  } else {
    console.log(`✅ [PASS] ${filePath} does not contain: ${text}`);
  }
};

const checkWhatsAppHardcodedNumber = () => {
  const files = [
    'src/components/support/SupportWhatsAppModal.tsx',
    'src/components/support/SupportHub.tsx',
    'src/services/supportClient.ts',
    'src/lib/supportContracts.ts',
    'src/packages/i18n/locales/pt.ts'
  ];

  for (const f of files) {
    if (fs.existsSync(f)) {
      expectNotToContain(f, '5543999907071');
      expectNotToContain(f, '43999907071');
    }
  }
};

const checkCentralConfig = () => {
  expectToContain('src/server/config/supportConfig.ts', 'process.env.SUPPORT_WHATSAPP_NUMBER || \'5543999907071\';');
};

const checkRouteAdded = () => {
  expectToContain('server.ts', 'app.post(\'/api/v1/support/whatsapp-link\'');
};

console.log('--- Static Checks ---');
checkWhatsAppHardcodedNumber();
checkCentralConfig();
checkRouteAdded();

console.log('\nFinal Result:', pass ? '✅ PASSED' : '❌ FAILED');
