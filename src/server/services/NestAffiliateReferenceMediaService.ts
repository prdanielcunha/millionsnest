import crypto from 'node:crypto';

export type ReferenceSourceType='USER_OWN_PHOTO'|'OWNER_AUTHORIZED'|'LICENSED_MEDIA';
export interface ReferenceUploadInput{
  productId:string;
  marketplace:'MELI'|'SHOPEE'|'AMAZON';
  externalListingId:string;
  sourceType:ReferenceSourceType;
  rightsEvidence:string;
  sourceUrl:string;
  variantFingerprint:string;
  sha256:string;
  imageBase64:string;
  canSendToExternalAI:boolean;
}
export type ParsedReferenceUpload={refId:string;bytes:Buffer;hash:string;fields:Omit<ReferenceUploadInput,'imageBase64'>};
export const MAX_REFERENCE_BYTES=8_000_000;
const legalHosts={
  MELI:['mercadolivre.com.br','mercadolibre.com.br','mercadolibre.com','mercadolivre.com'],
  SHOPEE:['shopee.com.br','shopee.com'],
  AMAZON:['amazon.com.br','amazon.com'],
} as const;
export function safeReferenceListingUrl(raw:string,marketplace:ReferenceUploadInput['marketplace']):boolean {
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.endsWith('.'))return false;
    const host=url.hostname.toLowerCase();
    return legalHosts[marketplace].some(domain=>host===domain||host.endsWith('.'+domain));
  }catch{return false;}
}
export function isWebPWithoutLocationMetadata(bytes:Buffer):boolean {
  if(bytes.length<20||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')return false;
  const fileSize=bytes.readUInt32LE(4)+8;
  if(fileSize!==bytes.length)return false;
  let i=12,foundImage=false;
  while(i+8<=bytes.length){
    const fourCC=bytes.toString('ascii',i,i+4);
    const length=bytes.readUInt32LE(i+4);
    if(length<0||i+8+length>bytes.length)return false;
    if(['EXIF','XMP ','ICCP'].includes(fourCC))return false;
    if(['VP8 ','VP8L','VP8X'].includes(fourCC))foundImage=true;
    i+=8+length+(length%2);
  }
  return i===bytes.length && foundImage;
}
export function parseReferenceUpload(raw:unknown):ParsedReferenceUpload {
  if(!raw||typeof raw!=='object')throw new Error('REFERENCE_INVALID');
  const v=raw as Record<string,unknown>;
  const fields={
    productId:String(v.productId||''),
    marketplace:String(v.marketplace||'') as ReferenceUploadInput['marketplace'],
    externalListingId:String(v.externalListingId||''),
    sourceType:String(v.sourceType||'') as ReferenceSourceType,
    rightsEvidence:String(v.rightsEvidence||''),
    sourceUrl:String(v.sourceUrl||''),
    variantFingerprint:String(v.variantFingerprint||''),
    sha256:String(v.sha256||''),
    canSendToExternalAI:v.canSendToExternalAI===true,
  };
  if(!['MELI','SHOPEE','AMAZON'].includes(fields.marketplace)||
    !['USER_OWN_PHOTO','OWNER_AUTHORIZED','LICENSED_MEDIA'].includes(fields.sourceType)||
    !fields.canSendToExternalAI||fields.rightsEvidence.trim().length<12||
    fields.rightsEvidence.length>2048||
    !/^[\w:-]{2,128}$/.test(fields.productId)||
    !/^[\w:-]{2,128}$/.test(fields.externalListingId)||
    fields.variantFingerprint.length>500||
    !/^[a-f0-9]{64}$/.test(fields.sha256)||
    !safeReferenceListingUrl(fields.sourceUrl,fields.marketplace)){
    throw new Error('REFERENCE_METADATA_INVALID');
  }
  const b64=String(v.imageBase64||'');
  if(!b64||b64.length>Math.ceil(MAX_REFERENCE_BYTES*4/3)+20||!/^[a-zA-Z0-9+/]+={0,2}$/.test(b64)){
    throw new Error('REFERENCE_BINARY_INVALID');
  }
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length<128||bytes.length>MAX_REFERENCE_BYTES||!isWebPWithoutLocationMetadata(bytes)){
    throw new Error('REFERENCE_FORMAT_INVALID');
  }
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==fields.sha256)throw new Error('REFERENCE_HASH_MISMATCH');
  const refId='ref-'+fields.marketplace+'-'+fields.externalListingId.replace(/[^a-z0-9_-]/gi,'').slice(0,48)+'-'+hash.slice(0,16);
  return {refId,bytes,hash,fields};
}
export function canonicalReferencePath(organizationId:string,referenceId:string){
  if(!/^[\w-]{1,128}$/.test(organizationId)||!/^ref-[A-Za-z0-9_-]{8,100}$/.test(referenceId)){
    throw new Error('REFERENCE_PATH_INVALID');
  }
  return 'organizations/'+organizationId+'/product-references/'+referenceId+'.webp';
}
export function canAccessStoredReference(asset:Record<string,unknown>,organizationId:string,referenceId:string):boolean {
  try{
    const expected=canonicalReferencePath(organizationId,referenceId);
    return asset.id===referenceId&&asset.organizationId===organizationId&&
      asset.storagePath===expected&&asset.referenceStatus==='READY_FOR_AI'&&
      asset.canSendToExternalAI===true&&
      asset.rights==='USER_ATTESTED'&&typeof asset.sha256==='string'&&
      /^[a-f0-9]{64}$/.test(asset.sha256);
  }catch{return false;}
}
