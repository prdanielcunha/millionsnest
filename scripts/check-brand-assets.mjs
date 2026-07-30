import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const BRAND_DIR = path.join(PUBLIC_DIR, 'brand/nestfinance/nest-flow-signature/v1');

const requiredFiles = [
  'logos/nestfinance-logo-horizontal-transparent-dark-ui.svg',
  'logos/nestfinance-logo-horizontal-transparent-light-ui.svg',
  'symbols/nestfinance-symbol-vector-gradient.svg',
  'icons/favicon.svg',
  'icons/nestfinance-app-icon-192.png',
  'icons/nestfinance-app-icon-512.png',
  'icons/nestfinance-maskable-512.png',
  'social/nestfinance-og-1200x630.jpg',
  'manifest/site.webmanifest'
];

let hasErrors = false;

for (const file of requiredFiles) {
  const filePath = path.join(BRAND_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Missing required file: ${file}`);
    hasErrors = true;
  } else {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.error(`ERROR: File is empty: ${file}`);
      hasErrors = true;
    }
    
    // Check SVG validity
    if (file.endsWith('.svg')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('<svg') || !content.includes('viewBox')) {
        console.error(`ERROR: Invalid SVG (missing <svg> or viewBox): ${file}`);
        hasErrors = true;
      }
    }
  }
}

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
if (indexHtml.includes('Logo_transp.png')) {
  console.error("ERROR: index.html still references Logo_transp.png");
  hasErrors = true;
}
if (!indexHtml.includes('favicon.svg')) {
  console.error("ERROR: index.html missing favicon.svg reference");
  hasErrors = true;
}
if (!indexHtml.includes('/brand/nestfinance/nest-flow-signature/v1/')) {
  console.error("ERROR: index.html not using v1 paths");
  hasErrors = true;
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log("SUCCESS: Brand assets checked.");
}
