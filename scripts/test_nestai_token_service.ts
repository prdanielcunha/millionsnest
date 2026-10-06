import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { getNestAiJwks, issueNestAiToken } from '../src/server/services/NestAiTokenService.js';

function decodeJson(value: string): any {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateJwk = privateKey.export({ format: 'jwk' });
const env = {
  ...process.env,
  NESTAI_SIGNING_PRIVATE_JWK: JSON.stringify(privateJwk),
};

const now = 1_800_000_000;
const issued = issueNestAiToken({
  uid: 'user-1',
  organizationId: 'org-1',
  appId: 'nestlume',
  nowSeconds: now,
  env,
});

assert.equal(issued.expiresIn, 300);
const parts = issued.token.split('.');
assert.equal(parts.length, 3);

const [encodedHeader, encodedPayload, encodedSignature] = parts;
assert.ok(encodedHeader && encodedPayload && encodedSignature);

const header = decodeJson(encodedHeader);
const payload = decodeJson(encodedPayload);
const jwks = getNestAiJwks(env);

assert.equal(header.alg, 'ES256');
assert.equal(header.typ, 'JWT');
assert.equal(header.kid, jwks.keys[0]?.kid);
assert.equal(payload.iss, 'https://millionsnest.com');
assert.equal(payload.aud, 'nestai');
assert.equal(payload.sub, 'user-1');
assert.equal(payload.organizationId, 'org-1');
assert.equal(payload.appId, 'nestlume');
assert.deepEqual(payload.capabilities, ['ai:run']);
assert.equal(payload.iat, now);
assert.equal(payload.exp, now + 300);
assert.equal(payload.nbf, now - 5);
assert.equal(typeof payload.jti, 'string');

const publicKey = crypto.createPublicKey({
  key: jwks.keys[0] as unknown as crypto.JsonWebKey,
  format: 'jwk',
});
const valid = crypto.verify(
  'sha256',
  Buffer.from(`${encodedHeader}.${encodedPayload}`),
  { key: publicKey, dsaEncoding: 'ieee-p1363' },
  Buffer.from(encodedSignature, 'base64url'),
);
assert.equal(valid, true);

assert.equal('d' in jwks.keys[0]!, false);
console.log('NESTAI_HUB_TOKEN_SERVICE_OK');
