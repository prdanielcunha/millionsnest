import Stripe from 'stripe';

export interface NormalizedProduct {
  id: string; // Internal/Price ID
  lookupKey: string | null;
  app: string;
  type: string; // 'plan', 'addon', 'content_pack', etc.
  tier?: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: Stripe.Price.Recurring.Interval | 'one_time';
  feature: string;
  featured: boolean;
  recommended: boolean;
  metadata: Record<string, string>;
}

export class BillingService {
  private stripe: Stripe;
  private cachedProducts: { plans: NormalizedProduct[], addons: NormalizedProduct[], timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private isMock: boolean;

  constructor(stripeInstance: Stripe, isMock: boolean = false) {
    this.stripe = stripeInstance;
    this.isMock = isMock;
  }

  async getProducts(): Promise<{ plans: NormalizedProduct[], addons: NormalizedProduct[] }> {
    const now = Date.now();
    if (this.cachedProducts && (now - this.cachedProducts.timestamp) < this.CACHE_TTL_MS) {
      console.log('[BillingService] Serving products from local memory cache');
      return { plans: this.cachedProducts.plans, addons: this.cachedProducts.addons };
    }

    const plans: NormalizedProduct[] = [];
    const addons: NormalizedProduct[] = [];

    if (this.isMock) {
      console.log('[BillingService] Returning mock data without Stripe keys');
      // Mock dinâmico simulando metadatas estruturadas
      plans.push(this.createMockProduct('price_monthly_mock', 'musicscale_pro_monthly', 'Pro (Mensal)', 29.90, 'month', 'plan', 'pro', 'musicscale'));
      plans.push(this.createMockProduct('price_annual_mock', 'musicscale_pro_yearly', 'Pro (Anual)', 287.04, 'year', 'plan', 'pro', 'musicscale'));
      
      addons.push(this.createMockProduct('price_setup_mock', 'musicscale_setup_premium', 'Setup Premium', 54.90, 'one_time', 'addon', 'setup_premium', 'musicscale'));
      addons.push(this.createMockProduct('price_training_mock', 'musicscale_training_express', 'Treinamento Express', 29.90, 'one_time', 'addon', 'training_express', 'musicscale'));
      addons.push(this.createMockProduct('price_worship_mock', 'musicscale_worship_100', 'Acervo Inicial Worship', 39.90, 'one_time', 'content_pack', 'worship_100', 'musicscale'));
      addons.push(this.createMockProduct('price_music_mock', 'musicscale_music_pack_10', 'Music Pack +10', 14.90, 'one_time', 'addon', 'music_pack_10', 'musicscale'));
      
      this.cachedProducts = { plans, addons, timestamp: now };
      return { plans, addons };
    }

    try {
      console.log('[BillingService] Fetching prices from Stripe...');
      const pricesResponse = await this.stripe.prices.list({
        active: true,
        expand: ['data.product'],
        limit: 100
      });

      const envIdToLookupKey: Record<string, string> = {};
      if (process.env.STRIPE_PRICE_ID_MONTHLY) envIdToLookupKey[process.env.STRIPE_PRICE_ID_MONTHLY] = 'musicscale_pro_monthly';
      if (process.env.STRIPE_PRICE_ID_ANNUAL) envIdToLookupKey[process.env.STRIPE_PRICE_ID_ANNUAL] = 'musicscale_pro_yearly';
      if (process.env.STRIPE_PRICE_ID_SETUP_PREMIUM) envIdToLookupKey[process.env.STRIPE_PRICE_ID_SETUP_PREMIUM] = 'musicscale_setup_premium';
      if (process.env.STRIPE_PRICE_ID_TRAINING_EXPRESS) envIdToLookupKey[process.env.STRIPE_PRICE_ID_TRAINING_EXPRESS] = 'musicscale_training_express';
      if (process.env.STRIPE_PRICE_ID_WORSHIP_100) envIdToLookupKey[process.env.STRIPE_PRICE_ID_WORSHIP_100] = 'musicscale_worship_100';
      if (process.env.STRIPE_PRICE_ID_MUSIC_PACK_10) envIdToLookupKey[process.env.STRIPE_PRICE_ID_MUSIC_PACK_10] = 'musicscale_music_pack_10';

      pricesResponse.data.forEach(price => {
        const product = price.product as Stripe.Product;
        if (!product || !product.active) return;
        
        const metadata = product.metadata || {};
        
        const type = metadata.type || (price.type === 'recurring' ? 'plan' : 'addon');
        const app = metadata.app || 'musicscale';
        // Assign lookup key from Stripe or fallback to environment variable mapping
        const lookupKey = price.lookup_key || envIdToLookupKey[price.id] || null;
        const feature = metadata.feature || (lookupKey ? lookupKey.replace('musicscale_', '') : product.name.toLowerCase().replace(/ /g, '_'));
        const tier = metadata.tier;
        const featured = metadata.featured === 'true' || (lookupKey?.includes('yearly') || lookupKey?.includes('worship'));
        const recommended = metadata.recommended === 'true' || lookupKey?.includes('yearly');
        
        const item: NormalizedProduct = {
          id: price.id,
          lookupKey: lookupKey,
          app,
          type,
          tier,
          name: product.name,
          description: product.description,
          price: (price.unit_amount || 0) / 100,
          currency: price.currency,
          interval: price.type === 'recurring' ? (price.recurring?.interval || 'month') : 'one_time',
          feature,
          featured,
          recommended,
          metadata
        };

        if (type === 'plan' || price.type === 'recurring') {
          plans.push(item);
        } else {
          addons.push(item);
        }
      });
      
      this.cachedProducts = { plans, addons, timestamp: now };
      console.log('[BillingService] Cache updated from Stripe');
      return { plans, addons };
    } catch (err: any) {
      console.error('[BillingService] Error fetching from Stripe', err.message);
      if (this.cachedProducts) {
        console.log('[BillingService] Graceful degradation: serving stale cache due to Stripe error');
        return { plans: this.cachedProducts.plans, addons: this.cachedProducts.addons };
      }
      throw err;
    }
  }

  async getPriceByLookupKey(lookupKey: string): Promise<string | null> {
    const products = await this.getProducts();
    const item = [...products.plans, ...products.addons].find(p => p.lookupKey === lookupKey);
    return item ? item.id : null;
  }

  private createMockProduct(id: string, lookupKey: string, name: string, price: number, interval: any, type: string, feature: string, app: string): NormalizedProduct {
    return {
      id,
      lookupKey,
      app,
      type,
      tier: type === 'plan' ? feature : undefined,
      name,
      description: null,
      price,
      currency: 'BRL',
      interval,
      feature,
      featured: lookupKey.includes('yearly') || lookupKey.includes('worship'),
      recommended: lookupKey.includes('yearly'),
      metadata: { type, feature, app }
    };
  }
}
