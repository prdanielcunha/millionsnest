const fs = require('fs');
let code = fs.readFileSync('src/pages/OrganizationPublicPage.tsx', 'utf8');

const target1 = `<NestFinanceLogo className="h-10 w-auto mb-8 opacity-50" />`;
const replace1 = `<NestFinanceLogo layout="symbol" className="h-12 w-12 mb-8 opacity-50 grayscale" />`;

const target2 = `<NestFinanceLogo className="h-7 w-auto" />`;
const replace2 = `<NestFinanceLogo layout="horizontal" compact surface="dark" className="h-7 w-auto" />`;

code = code.replace(target1, replace1).replace(target2, replace2);
fs.writeFileSync('src/pages/OrganizationPublicPage.tsx', code);
console.log('Fixed OrganizationPublicPage');
