const fs = require('fs');
let code = fs.readFileSync('src/components/Footer.tsx', 'utf8');
const target = `            <Link to="/" className="flex items-center gap-3 mb-6">
              <NestFinanceLogo loading="lazy" decoding="async" className="h-8 md:h-10 w-auto opacity-90 hover:opacity-100 transition-opacity" />
              <span className="font-semibold text-lg tracking-tight text-[#F5F7FA]">MillionsNest</span>
            </Link>`;
const replace = `            <Link to="/" className="flex mb-6">
              <NestFinanceLogo layout="horizontal" tagline={true} surface="dark" loading="lazy" decoding="async" className="h-10 md:h-[52px] w-[190px] md:w-[230px] opacity-90 hover:opacity-100 transition-opacity" />
            </Link>`;
if (code.includes(target)) {
  code = code.replace(target, replace);
  fs.writeFileSync('src/components/Footer.tsx', code);
  console.log('Fixed Footer');
} else {
  console.log('Target not found in Footer');
}
