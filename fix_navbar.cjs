const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
const target = `        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <NestFinanceLogo className="h-10 md:h-12 w-auto transition-transform group-hover:scale-105" />
          
        </Link>`;
const replace = `        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* Mobile Logo */}
          <NestFinanceLogo layout="symbol" className="h-9 w-auto md:hidden transition-transform group-hover:scale-105" />
          {/* Desktop Logo */}
          <NestFinanceLogo layout="horizontal" tagline={false} surface="dark" className="h-[52px] w-[196px] hidden md:block transition-transform group-hover:scale-105" />
        </Link>`;
if (code.includes(target)) {
  code = code.replace(target, replace);
  fs.writeFileSync('src/components/Navbar.tsx', code);
  console.log('Fixed Navbar');
} else {
  console.log('Target not found in Navbar');
}
