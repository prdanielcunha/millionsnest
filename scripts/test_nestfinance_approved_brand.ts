import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ECOSYSTEM_APPS } from '../src/lib/apps.js';
import { EcosystemAppIcon } from '../src/components/apps/EcosystemAppIcon.js';

const app = ECOSYSTEM_APPS.find(app => app.id === 'nestfinance')!;
assert.equal(app.iconAsset, '/brand/nestfinance/nf-continuous/v2/symbols/nestfinance-gradient.svg');
const source = readFileSync(`public${app.iconAsset}`, 'utf8');
assert.match(source, /viewBox="0 0 512 512"/);
assert.doesNotMatch(source, /<(?:rect|image)\b|data:image|#(?:D4AF7A|00D6EF)/i);
assert.match(source, /#213F66/);
assert.match(source, /#649BC4/);
assert.equal((source.match(/<path\b/g) || []).length, 1, 'approved continuous nf must retain its single traced outline');
const rendered = EcosystemAppIcon({app});
assert.equal(rendered.type, 'img');
assert.equal(rendered.props.src, app.iconAsset);
assert.match(readFileSync('src/components/Ecosystem.tsx', 'utf8'), /app\?\.iconAsset/);
assert.match(readFileSync('src/components/ProductMotionStage.tsx', 'utf8'), /productIconAssets/);
console.log('Approved NF identity: catalog, transparent SVG, blue palette and public consumers PASS');
