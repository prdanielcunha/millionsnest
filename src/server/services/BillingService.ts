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
  invalidConfiguration?: boolean;
}

export class BillingService {
  private stripe: Stripe;
  private db: any;
  private cachedProducts: { plans: NormalizedProduct[], addons: NormalizedProduct[], timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private isMock: boolean;

  constructor(stripeInstance: Stripe, db: any, isMock: boolean = false) {
    this.stripe = stripeInstance;
    this.db = db;
    this.isMock = isMock;
  }

  async getProducts(): Promise<{ plans: NormalizedProduct[], addons: NormalizedProduct[] }> {
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
      
      this.cachedProducts = { plans, addons, timestamp: Date.now() };
      return { plans, addons };
    }

    try {
      if (this.db) {
        console.log('[BillingService] Fetching from Firestore catalogue...');
        const snapshot = await this.db.collection('billing_products').where('active', '==', true).get();
        if (!snapshot.empty) {
          snapshot.forEach((doc: any) => {
            const data = doc.data() as NormalizedProduct;
            if (data.type === 'plan') plans.push(data);
            else addons.push(data);
          });
          this.cachedProducts = { plans, addons, timestamp: Date.now() };
          return { plans, addons };
        } else {
          console.log('[BillingService] Firestore empty. Using memory cache fallback if available.');
        }
      }
    } catch (err: any) {
      console.error('[BillingService] Firestore error:', err.message);
    }

    if (this.cachedProducts) {
      console.log('[BillingService] Graceful degradation: serving stale memory cache');
      return { plans: this.cachedProducts.plans, addons: this.cachedProducts.addons };
    }

    return { plans, addons };
  }

  async syncStripeToFirestore(): Promise<any> {
    if (this.isMock) return { error: 'mock mode' };
    if (!this.db) return { error: 'No db instance' };
    
    // Arrays required!
    const plans: NormalizedProduct[] = [];
    const addons: NormalizedProduct[] = [];

    try {
      console.log('[BillingService] Fetching prices from Stripe...');
      const pricesResponse = await this.stripe.prices.list({
        active: true,
        expand: ['data.product'],
        limit: 100
      });

      const envIdToLookupKey: Record<string, string> = {};
      const envStarterMonthly = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY;
      const envStarterAnnual = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY;
      const envProMonthly = process.env.STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY || process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_MONTHLY;
      const envProAnnual = process.env.STRIPE_PRICE_MUSICSCALE_PRO_YEARLY || process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_PRICE_ANNUAL;
      
      const envSetupPremium = process.env.STRIPE_PRICE_MUSICSCALE_SETUP_PREMIUM || process.env.STRIPE_PRICE_SETUP_PREMIUM;
      const envTrainingExpress = process.env.STRIPE_PRICE_MUSICSCALE_TRAINING_EXPRESS || process.env.STRIPE_PRICE_TRAINING_EXPRESS;
      const envWorship100 = process.env.STRIPE_PRICE_MUSICSCALE_WORSHIP_100 || process.env.STRIPE_PRICE_ACERVO_WORSHIP_100;
      const envMusicPack10 = process.env.STRIPE_PRICE_MUSICSCALE_PACK_10 || process.env.STRIPE_PRICE_MUSIC_PACK_10;

      if (envStarterMonthly) envIdToLookupKey[envStarterMonthly] = 'musicscale_starter_monthly';
      if (envStarterAnnual) envIdToLookupKey[envStarterAnnual] = 'musicscale_starter_yearly';
      if (envProMonthly) envIdToLookupKey[envProMonthly] = 'musicscale_pro_monthly';
      if (envProAnnual) envIdToLookupKey[envProAnnual] = 'musicscale_pro_yearly';
      if (envSetupPremium) envIdToLookupKey[envSetupPremium] = 'musicscale_setup_premium';
      if (envTrainingExpress) envIdToLookupKey[envTrainingExpress] = 'musicscale_training_express';
      if (envWorship100) envIdToLookupKey[envWorship100] = 'musicscale_worship_100';
      if (envMusicPack10) envIdToLookupKey[envMusicPack10] = 'musicscale_music_pack_10';

      pricesResponse.data.forEach(price => {
        const product = price.product as Stripe.Product;
        if (!product || !product.active) return;
        
        // Combine metadata from Product and Price (Price overrides Product)
        const metadata = { ...product.metadata, ...price.metadata };
        
        const STRICT_MODE = process.env.BILLING_STRICT_MODE === 'true';
        let invalidReason: string | null = null;
        let invalidConfiguration = false;

        // 1. Mandatory lookup_key check
        let originalLookupKey = price.lookup_key;
        let lookupKey = envIdToLookupKey[price.id] || price.lookup_key || null;
        
        if (!lookupKey) {
          invalidReason = 'Missing lookup_key';
          invalidConfiguration = true;
          if (STRICT_MODE) {
            console.log(`[BillingService] Ignoring price ${price.id} - ${invalidReason}`);
            return;
          }
        }

        // 2. Mandatory metadata check
        if (!metadata || !metadata.app || !metadata.type) {
          if (!invalidReason) invalidReason = 'Missing required metadata (app, type)';
          invalidConfiguration = true;
          if (STRICT_MODE) {
            console.log(`[BillingService] Ignoring price ${price.id} - ${invalidReason}`);
            return;
          }
        }
        
        // If we are in transitional mode (STRICT_MODE=false) and reached here with invalidConfiguration:
        // We log a warning but continue with a fallback configuration
        if (invalidConfiguration) {
          console.warn(`[BillingService] TRANSTIONAL FALLBACK for ${product.name} (Price: ${price.id}): ${invalidReason}`);
        }

        // Safe feature fallback based on known ENV Price IDs to strictly avoid name heuristics
        let featureFallback = lookupKey || `fallback_feature_${price.id}`;
        let finalLookupKey = lookupKey || `fallback_${price.id}`;
        
        if (invalidConfiguration) {
           const envStarterMonthly = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY;
           const envStarterAnnual = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY;
           const envProMonthly = process.env.STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY || process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_MONTHLY;
           const envProAnnual = process.env.STRIPE_PRICE_MUSICSCALE_PRO_YEARLY || process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_PRICE_ANNUAL;
           
           if (price.id === envStarterMonthly) featureFallback = 'starter_monthly';
           if (price.id === envStarterAnnual) featureFallback = 'starter_yearly';
           if (price.id === envProMonthly) featureFallback = 'pro_monthly';
           if (price.id === envProAnnual) featureFallback = 'pro_yearly';
           if (price.id === (process.env.STRIPE_PRICE_MUSICSCALE_SETUP_PREMIUM || process.env.STRIPE_PRICE_SETUP_PREMIUM)) featureFallback = 'setup_premium';
           if (price.id === (process.env.STRIPE_PRICE_MUSICSCALE_TRAINING_EXPRESS || process.env.STRIPE_PRICE_TRAINING_EXPRESS)) featureFallback = 'training_express';
           if (price.id === (process.env.STRIPE_PRICE_MUSICSCALE_WORSHIP_100 || process.env.STRIPE_PRICE_ACERVO_WORSHIP_100)) featureFallback = 'worship_100';
           if (price.id === (process.env.STRIPE_PRICE_MUSICSCALE_PACK_10 || process.env.STRIPE_PRICE_MUSIC_PACK_10)) featureFallback = 'music_pack_10';
           
           // Ensure lookup key matches standard format so frontend doesn't break
           if (featureFallback !== lookupKey && !featureFallback.startsWith('fallback')) {
             finalLookupKey = `musicscale_${featureFallback}`;
           }
        }

        const tier = metadata.tier || null;
        const featured = metadata.featured === 'true';
        const recommended = metadata.recommended === 'true';
        
        const item: NormalizedProduct = {
          id: price.id,
          lookupKey: finalLookupKey,
          app: metadata.app || 'musicscale',
          type: metadata.type || (price.type === 'recurring' ? 'plan' : 'addon'),
          tier,
          name: product.name || 'Sem Nome',
          description: product.description || null,
          price: (price.unit_amount || 0) / 100,
          currency: price.currency,
          interval: price.type === 'recurring' ? (price.recurring?.interval || 'month') : 'one_time',
          feature: metadata.feature || featureFallback,
          featured,
          recommended,
          metadata,
          invalidConfiguration
        };

        if (item.type === 'plan' || price.type === 'recurring') {
          plans.push(item);
        } else {
          addons.push(item);
        }
      });
      
      const batch = this.db.batch();
      const allItems = [...plans, ...addons];
      const syncedIds: string[] = [];
      const timestamp = Date.now();
      
      // Update or Set products
      for (const item of allItems) {
        const docRef = this.db.collection('billing_products').doc(item.lookupKey);
        batch.set(docRef, {
          ...item,
          active: true,
          visible: true,
          lastStripeSync: timestamp,
          stripePriceId: item.id, // For architectural mapping
          stripeProductId: item.metadata?.product_id || '' 
        });
        syncedIds.push(item.lookupKey);
      }
      
      // Optionally deactivate old elements could be done here (omitted for safety right now, or we can fetch existing and set active: false to non-synced)
      const existingSnapshot = await this.db.collection('billing_products').get();
      existingSnapshot.forEach((doc: any) => {
         if (!syncedIds.includes(doc.id)) {
           batch.update(doc.ref, { active: false });
         }
      });
      
      await batch.commit();
      
      this.cachedProducts = { plans, addons, timestamp: timestamp }; 
      console.log(`[BillingService] Sync completed. Synced ${syncedIds.length} products to Firestore.`);
      return { success: true, count: syncedIds.length, syncedIds };
    } catch (err: any) {
      console.error('[BillingService] Error syncing from Stripe:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getDebugInfo(): Promise<any> {
    if (this.isMock) {
      return { environment: 'mock', message: 'No debug info for mock mode' };
    }
    
    try {
      const pricesResponse = await this.stripe.prices.list({
        active: true,
        expand: ['data.product'],
        limit: 100
      });

      const envIdToLookupKey: Record<string, string> = {};
      const envStarterMonthly = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY;
      const envStarterAnnual = process.env.STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY;
      const envProMonthly = process.env.STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY || process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_MONTHLY;
      const envProAnnual = process.env.STRIPE_PRICE_MUSICSCALE_PRO_YEARLY || process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_PRICE_ANNUAL;
      
      const envSetupPremium = process.env.STRIPE_PRICE_MUSICSCALE_SETUP_PREMIUM || process.env.STRIPE_PRICE_SETUP_PREMIUM;
      const envTrainingExpress = process.env.STRIPE_PRICE_MUSICSCALE_TRAINING_EXPRESS || process.env.STRIPE_PRICE_TRAINING_EXPRESS;
      const envWorship100 = process.env.STRIPE_PRICE_MUSICSCALE_WORSHIP_100 || process.env.STRIPE_PRICE_ACERVO_WORSHIP_100;
      const envMusicPack10 = process.env.STRIPE_PRICE_MUSICSCALE_PACK_10 || process.env.STRIPE_PRICE_MUSIC_PACK_10;

      if (envStarterMonthly) envIdToLookupKey[envStarterMonthly] = 'musicscale_starter_monthly';
      if (envStarterAnnual) envIdToLookupKey[envStarterAnnual] = 'musicscale_starter_yearly';
      if (envProMonthly) envIdToLookupKey[envProMonthly] = 'musicscale_pro_monthly';
      if (envProAnnual) envIdToLookupKey[envProAnnual] = 'musicscale_pro_yearly';
      if (envSetupPremium) envIdToLookupKey[envSetupPremium] = 'musicscale_setup_premium';
      if (envTrainingExpress) envIdToLookupKey[envTrainingExpress] = 'musicscale_training_express';
      if (envWorship100) envIdToLookupKey[envWorship100] = 'musicscale_worship_100';
      if (envMusicPack10) envIdToLookupKey[envMusicPack10] = 'musicscale_music_pack_10';

      const STRICT_MODE = process.env.BILLING_STRICT_MODE === 'true';

      const log: any[] = [];
      pricesResponse.data.forEach(price => {
        const product = price.product as Stripe.Product;
        if (!product || !product.active) return;
        
        const metadata = { ...product.metadata, ...price.metadata };
        const explicitLookupKey = price.lookup_key;
        const envLookupKey = envIdToLookupKey[price.id] || null;
        const lookupKey = explicitLookupKey || envLookupKey;
        
        let status = 'Valid';
        let ignored = false;
        
        if (!lookupKey) {
           status = 'Missing lookup_key';
           if (STRICT_MODE) ignored = true;
        } else if (!metadata.app || !metadata.type) {
           status = 'Missing required metadata (app, type)';
           if (STRICT_MODE) ignored = true;
        }

        log.push({
           priceId: price.id,
           productId: product.id,
           productName: product.name,
           explicitLookupKey,
           envLookupKey,
           finalLookupKey: lookupKey,
           productMetadata: product.metadata,
           priceMetadata: price.metadata,
           ignored,
           status
        });
      });
      
      let firestoreItems: any[] = [];
      if (this.db) {
         try {
            const snap = await this.db.collection('billing_products').get();
            snap.forEach((doc: any) => firestoreItems.push(doc.data()));
         } catch (e: any) {
             console.error('[BillingService] Failed to read from firestore for DB debug info', e);
         }
      }
      
      return { STRICT_MODE, firestore_status: this.db ? 'connected' : 'not_configured', stripeItems: log, firestoreItems };

    } catch (e: any) {
       return { error: e.message };
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
