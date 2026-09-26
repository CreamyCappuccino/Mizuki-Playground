import type { GeographyMask } from './geographyClimate';
import {GEOGRAPHY_MASK_ID,GEOGRAPHY_PAYLOAD_SHA,OCEAN_REFERENCE_ID} from './geographyContract';
const ARCHIVE='1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de';
type ObjectRecord=Record<string,unknown>;
const record=(v:unknown):v is ObjectRecord=>typeof v==='object'&&v!==null&&!Array.isArray(v);

/** Validate the pinned payload, never a best-effort/coerced replacement. */
export async function validateGeographyData(input: unknown): Promise<GeographyMask> {
  if(!record(input)||input.schema!==1||!record(input.source)||!record(input.grid)||!record(input.quadrature)||
    input.source.dataset!=='Natural Earth 1:110m land'||input.source.version!=='4.1.0'||input.source.archiveSha256!==ARCHIVE||
    input.grid.id!=='phi-midpoint-18x36-v1'||input.grid.nlat!==18||input.grid.nlon!==36||
    input.grid.order!=='south-to-north rows, west-to-east columns'||input.grid.firstLatitude!==-85||input.grid.firstLongitude!==-175||
    input.quadrature.samplesPerAxis!==64||input.quadrature.method!=='sin(phi)/longitude midpoint'||
    input.fractionsFloat64LESha256!==GEOGRAPHY_PAYLOAD_SHA||!Array.isArray(input.fractions)||input.fractions.length!==648)
    throw new Error('Unsupported or corrupted pinned geography data.');
  const fractions=new Float64Array(648),bytes=new ArrayBuffer(648*8),view=new DataView(bytes);
  for(let i=0;i<648;i++) {
    const f=input.fractions[i];if(typeof f!=='number'||!Number.isFinite(f)||f<0||f>1)throw new Error('Invalid land fraction.');
    fractions[i]=f;view.setFloat64(i*8,f,true);
  }
  if(!globalThis.crypto?.subtle)throw new Error('Secure-context Web Crypto is required to verify geography data.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==GEOGRAPHY_PAYLOAD_SHA)throw new Error('Geography payload checksum mismatch.');
  return {nlat:18,nlon:36,fractions,provenance:{id:GEOGRAPHY_MASK_ID,payloadSha256:digest,
    sourceVersion:'4.1.0',archiveSha256:ARCHIVE,quadrature:'sin-phi-midpoint-q64'}};
}
export async function loadGeographyData(): Promise<GeographyMask> {
  const response=await fetch(new URL('../../data/land-fractions.json',import.meta.url));
  if(!response.ok)throw new Error(`Geography data HTTP ${response.status}.`);
  return validateGeographyData(await response.json());
}
export function uniformOceanMask(): GeographyMask {
  return {nlat:18,nlon:36,fractions:new Float64Array(648),provenance:{id:OCEAN_REFERENCE_ID,source:'explicit uniform-ocean control'}};
}
