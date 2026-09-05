import fs from 'node:fs';
import path from 'node:path';

const checkoutPath = path.join(process.cwd(), 'src/pages/Checkout.tsx');
const source = fs.readFileSync(checkoutPath, 'utf8');

const required = [
  "const requestedPlan = planParam",
  "data.plans?.find((p: any) => p.lookupKey === planParam)",
  "setSelectedPlanLookup(null);",
  "Never silently default a generic or direct checkout visit to Pro",
  "Never switch the customer to another tier",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing explicit-plan checkout contract token: ${token}`);
  }
}

const forbidden = [
  "const proMonthly = data.plans.find((p: any) => p.lookupKey === 'musicscale_pro_monthly')",
  "setSelectedPlanLookup(availablePlans[0].lookupKey)",
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`Unsafe implicit plan fallback is present: ${token}`);
  }
}

console.log('PASS: MusicScale checkout requires an explicit valid plan selection and never silently falls back to Pro or another tier.');
