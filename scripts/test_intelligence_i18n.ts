import assert from 'node:assert/strict';
import pt from '../src/packages/i18n/intelligence/pt.js';
import en from '../src/packages/i18n/intelligence/en.js';
import es from '../src/packages/i18n/intelligence/es.js';
import type { HubLensId } from '../src/lib/lensResolver.js';

function collectLeafPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => collectLeafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function readPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

const ptPaths = collectLeafPaths(pt);
assert.deepEqual(
  collectLeafPaths(en),
  ptPaths,
  'English Church Intelligence resources must have the exact same key structure as Portuguese'
);
assert.deepEqual(
  collectLeafPaths(es),
  ptPaths,
  'Spanish Church Intelligence resources must have the exact same key structure as Portuguese'
);

for (const [locale, resources] of Object.entries({ pt, en, es })) {
  for (const path of ptPaths) {
    const value = readPath(resources, path);
    assert.equal(typeof value, 'string', `${locale}:${path} must resolve to a string`);
    assert.ok((value as string).trim().length > 0, `${locale}:${path} must not be blank`);
  }
}

const lensIds: readonly HubLensId[] = [
  'my_today',
  'pastoral',
  'journey',
  'worship',
  'finance',
  'administration'
];

for (const lensId of lensIds) {
  for (const [locale, resources] of Object.entries({ pt, en, es })) {
    assert.ok(
      resources.lenses[lensId].trim().length > 0,
      `${locale} must provide a visible label for ${lensId}`
    );
    assert.ok(
      resources.lenses.descriptions[lensId].trim().length > 0,
      `${locale} must provide an accessible description for ${lensId}`
    );
  }
}

assert.equal(pt.evidence.no_source_no_claim, 'Sem fonte, sem afirmação.');
assert.equal(en.evidence.no_source_no_claim, 'No source, no claim.');
assert.equal(es.evidence.no_source_no_claim, 'Sin fuente, no hay afirmación.');

console.log('Church Intelligence PT/EN/ES coverage checks passed.');
