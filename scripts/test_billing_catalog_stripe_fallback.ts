import assert from 'node:assert/strict';
import { BillingService } from '../src/server/services/BillingService.js';

const canonicalKey = 'STRIPE_PRICE_MUSICSCALE_PACK_10';
const legacyKey = 'STRIPE_PRICE_MUSIC_PACK_10';
const previousCanonical = process.env[canonicalKey];
const previousLegacy = process.env[legacyKey];

delete process.env[canonicalKey];
delete process.env[legacyKey];

const fakeStripe: any = {
  prices: {
    list: async () => ({
      data: [
        {
          id: 'price_live_music_pack_10',
          active: true,
          currency: 'brl',
          type: 'one_time',
          metadata: {
            app: 'musicscale',
            type: 'addon',
            catalog_key: 'musicscale_music_pack_10'
          }
        }
      ]
    })
  }
};

try {
  const service = new BillingService(fakeStripe, null, false);
  const products = await service.getProducts();
  const pack = products.addons.find(item => item.lookupKey === 'musicscale_music_pack_10');

  assert.ok(pack, 'Music Pack +10 must exist in the catalog');
  assert.equal(
    pack.id,
    'price_live_music_pack_10',
    'Missing ENV must resolve Music Pack +10 from active Stripe metadata before using a mock ID'
  );

  console.log('PASS billing catalog Stripe metadata fallback');
} finally {
  if (previousCanonical === undefined) delete process.env[canonicalKey];
  else process.env[canonicalKey] = previousCanonical;

  if (previousLegacy === undefined) delete process.env[legacyKey];
  else process.env[legacyKey] = previousLegacy;
}
