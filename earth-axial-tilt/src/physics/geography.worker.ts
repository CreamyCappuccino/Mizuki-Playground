import {solveGeographyClimate} from './geographyClimate';
import {loadGeographyData,uniformOceanMask} from './geographyData';
import {assertGeographyPair,geographyBuffers,geographyKey,normalizeGeographyConfiguration,
  type GeographyReply,type GeographyRequest,type GeographyPair} from './geographyContract';

const channel=self as unknown as {onmessage:((event:MessageEvent<GeographyRequest>)=>void)|null;
  postMessage:(message:GeographyReply,transfer?:Transferable[])=>void;};
let started=false;
channel.onmessage=async(event)=>{
  const request=event.data;
  // One solve per worker. Cancellation is worker termination, not a queued
  // "cancel" message that a synchronous numerical solve cannot read in time.
  if(started)return;
  started=true;
  try {
    if(!Number.isSafeInteger(request?.id)||request.id<1)throw new Error('Invalid geography request id.');
    const c=normalizeGeographyConfiguration(request.configuration);
    if(request.key!==geographyKey(c))throw new Error('Geography request key mismatch.');
    const progress=(phase:'data'|'earth'|'ocean')=>channel.postMessage({id:request.id,key:request.key,kind:'progress',phase});
    progress('data');const mask=await loadGeographyData();
    progress('earth');const current=solveGeographyClimate(c.tilt,mask,{orbit:c.orbit});
    let reference=null;
    if(c.reference){progress('ocean');reference=solveGeographyClimate(c.tilt,uniformOceanMask(),{orbit:c.orbit});}
    const pair:GeographyPair={key:request.key,current,reference};
    assertGeographyPair(pair,c);
    channel.postMessage({id:request.id,key:request.key,kind:'ready',pair},geographyBuffers(pair));
  } catch(error) {
    channel.postMessage({id:request?.id,key:request?.key,kind:'error',message:error instanceof Error?error.message:'Geography calculation failed.'});
  }
};
