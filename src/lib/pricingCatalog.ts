// Catálogo oficial de produtos e preços do MillionsNest
// Esta é a única fonte da verdade para a interface e para o checkout.

export interface CatalogProduct {
  lookupKey: string;
  name: string;
  description: string;
  tier: 'starter' | 'advanced' | 'pro' | 'addon';
  type: 'plan' | 'addon';
  interval: 'month' | 'year' | 'one_time';
  price: number;
  featured?: boolean;
  recommended?: boolean;
  envKey: string; // The ENV variable key holding the Stripe Price ID
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  // PLANOS STARTER
  {
    lookupKey: 'musicscale_starter_monthly',
    name: 'Starter (Mensal)',
    description: 'Ideal para começar com simplicidade.',
    tier: 'starter',
    type: 'plan',
    interval: 'month',
    price: 19.90,
    envKey: 'STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY'
  },
  {
    lookupKey: 'musicscale_starter_yearly',
    name: 'Starter (Anual)',
    description: 'Ideal para começar com simplicidade.',
    tier: 'starter',
    type: 'plan',
    interval: 'year',
    price: 191.04,
    envKey: 'STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY'
  },

  // PLANOS ADVANCED
  {
    lookupKey: 'musicscale_advanced_monthly',
    name: 'Advanced (Mensal)',
    description: 'Para ministérios em crescimento.',
    tier: 'advanced',
    type: 'plan',
    interval: 'month',
    price: 29.90,
    envKey: 'STRIPE_PRICE_MUSICSCALE_ADVANCED_MONTHLY'
  },
  {
    lookupKey: 'musicscale_advanced_yearly',
    name: 'Advanced (Anual)',
    description: 'Para ministérios em crescimento.',
    tier: 'advanced',
    type: 'plan',
    interval: 'year',
    price: 287.04,
    envKey: 'STRIPE_PRICE_MUSICSCALE_ADVANCED_YEARLY'
  },

  // PLANOS PRO
  {
    lookupKey: 'musicscale_pro_monthly',
    name: 'Pro (Mensal)',
    description: 'Para ministérios que desejam a experiência premium completa.',
    tier: 'pro',
    type: 'plan',
    interval: 'month',
    price: 34.90,
    recommended: true,
    envKey: 'STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY'
  },
  {
    lookupKey: 'musicscale_pro_yearly',
    name: 'Pro (Anual)',
    description: 'Para ministérios que desejam a experiência premium completa.',
    tier: 'pro',
    type: 'plan',
    interval: 'year',
    price: 335.04,
    recommended: true,
    envKey: 'STRIPE_PRICE_MUSICSCALE_PRO_YEARLY'
  },

  // ADD-ONS
  {
    lookupKey: 'musicscale_setup_premium',
    name: 'Setup Premium',
    description: 'Configuração inicial assistida para estruturar rapidamente sua equipe no MusicScale.',
    tier: 'addon',
    type: 'addon',
    interval: 'one_time',
    price: 54.90,
    envKey: 'STRIPE_PRICE_MUSICSCALE_SETUP_PREMIUM'
  },
  {
    lookupKey: 'musicscale_training_express',
    name: 'Treinamento Express',
    description: 'Treinamento online prático para aprender rapidamente o fluxo do MusicScale.',
    tier: 'addon',
    type: 'addon',
    interval: 'one_time',
    price: 29.90,
    envKey: 'STRIPE_PRICE_MUSICSCALE_TRAINING_EXPRESS'
  },
  {
    lookupKey: 'musicscale_worship_100',
    name: 'Acervo Inicial Worship',
    description: 'Acervo pronto de 100 músicas já organizadas, incluindo cifra e letra integradas.',
    tier: 'addon',
    type: 'addon',
    interval: 'one_time',
    price: 97.00,
    envKey: 'STRIPE_PRICE_MUSICSCALE_WORSHIP_100'
  },
  {
    lookupKey: 'musicscale_music_pack_10',
    name: 'Music Pack +10',
    description: 'Pacote avulso para adicionar até 10 novas músicas ao acervo da sua organização.',
    tier: 'addon',
    type: 'addon',
    interval: 'one_time',
    price: 29.90,
    envKey: 'STRIPE_PRICE_MUSICSCALE_PACK_10'
  }
];

export function getProductByLookupKey(lookupKey: string): CatalogProduct | undefined {
  return PRODUCT_CATALOG.find(p => p.lookupKey === lookupKey);
}
