const fs = require('fs');
let code = fs.readFileSync('src/pages/Checkout.tsx', 'utf8');

const target = `            <div className="mx-auto flex items-center gap-3">
                <NestFinanceLogo className="h-8 w-auto" />
                <span className="font-semibold tracking-tight text-lg text-[#F5F7FA]">MillionsNest</span>
            </div>`;
const replace = `            <div className="mx-auto flex items-center">
                <NestFinanceLogo layout="horizontal" tagline={false} surface="dark" className="h-[40px] md:h-[52px] w-auto" />
            </div>`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  fs.writeFileSync('src/pages/Checkout.tsx', code);
  console.log('Fixed Checkout');
} else {
  console.log('Target not found in Checkout');
}
