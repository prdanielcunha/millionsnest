import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {parseReferenceUpload,canAccessStoredReference,isWebPWithoutLocationMetadata,canonicalReferencePath,safeReferenceListingUrl} from '../src/server/services/NestAffiliateReferenceMediaService.js';
function webp(){
 const chunk=Buffer.concat([Buffer.from('VP8 '),Buffer.from([4,0,0,0]),Buffer.from([1,2,3,4])]);
 const header=Buffer.alloc(12);header.write('RIFF');header.writeUInt32LE(4+chunk.length,4);header.write('WEBP',8);
 return Buffer.concat([header,chunk,Buffer.alloc(128-12-chunk.length)]);
}
test('rejects lookalike domains and private targets',()=>{
 assert.equal(safeReferenceListingUrl('https://www.mercadolivre.com.br/p/MLB','MELI'),true);
 assert.equal(safeReferenceListingUrl('https://evilmercadolivre.com.br/p/MLB','MELI'),false);
 assert.equal(safeReferenceListingUrl('http://www.mercadolivre.com.br/p/MLB','MELI'),false);
});
test('server rejects raw or metadata-bearing images',()=>{
 const bad=Buffer.from('not-an-image');
 assert.equal(isWebPWithoutLocationMetadata(bad),false);
 const b=webp();assert.equal(isWebPWithoutLocationMetadata(b),false);
});
test('server refuses tampered uploads',()=>{
 const bytes=Buffer.alloc(512);
 const raw={
  productId:'meli:MLB123',marketplace:'MELI',externalListingId:'MLB123',
  sourceType:'USER_OWN_PHOTO',rightsEvidence:'Photo owned 2026-10-08',
  sourceUrl:'https://www.mercadolivre.com.br/item/MLB123',
  variantFingerprint:'MELI|MLB123|pink',
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  imageBase64:bytes.toString('base64'),canSendToExternalAI:true,
 };
 assert.throws(()=>parseReferenceUpload(raw),/REFERENCE_FORMAT_INVALID/);
 assert.throws(()=>parseReferenceUpload({...raw,sourceType:'MARKETPLACE_REFERENCE'}),/REFERENCE_METADATA_INVALID/);
 assert.throws(()=>parseReferenceUpload({...raw,canSendToExternalAI:false}),/REFERENCE_METADATA_INVALID/);
});
test('private download is identity, tenant, status and path scoped',()=>{
 const id='ref-MELI-MLB123-'+'f'.repeat(16);const organizationId='org-a';
 const asset={id,organizationId,storagePath:canonicalReferencePath(organizationId,id),
  rights:'USER_ATTESTED',referenceStatus:'READY_FOR_AI',canSendToExternalAI:true,
  sha256:'f'.repeat(64)};
 assert.equal(canAccessStoredReference(asset,organizationId,id),true);
 assert.equal(canAccessStoredReference({...asset,organizationId:'org-b'},organizationId,id),false);
 assert.equal(canAccessStoredReference({...asset,referenceStatus:'REVOKED'},organizationId,id),false);
 assert.equal(canAccessStoredReference({...asset,storagePath:'organizations/org-b/product-references/p.webp'},organizationId,id),false);
});

test('valid bounded, metadata-free reference is accepted and hash verified',()=>{
  const data=Buffer.alloc(108);
  const chunk=Buffer.alloc(8);chunk.write('VP8 ',0);chunk.writeUInt32LE(data.length,4);
  const header=Buffer.alloc(12);header.write('RIFF',0);header.writeUInt32LE(4+chunk.length+data.length,4);header.write('WEBP',8);
  const bytes=Buffer.concat([header,chunk,data]);
  assert.equal(bytes.length,128);
  assert.equal(isWebPWithoutLocationMetadata(bytes),true);
  const raw={
    productId:'meli:MLB123',marketplace:'MELI',externalListingId:'MLB123',
    sourceType:'USER_OWN_PHOTO',rightsEvidence:'Photo created by test owner',
    sourceUrl:'https://www.mercadolivre.com.br/item/MLB123',
    variantFingerprint:'MELI|MLB123|pink',
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    imageBase64:bytes.toString('base64'),canSendToExternalAI:true,
  };
  const result=parseReferenceUpload(raw);
  assert.equal(result.hash,raw.sha256);
  assert.equal(result.bytes.length,bytes.length);
  assert.match(result.refId,/^ref-MELI-MLB123-/);
  assert.throws(()=>parseReferenceUpload({...raw,sha256:'0'.repeat(64)}),/REFERENCE_HASH_MISMATCH/);
  const malicious=Buffer.from(bytes);
  malicious.write('EXIF',12);
  assert.equal(isWebPWithoutLocationMetadata(malicious),false);
});
