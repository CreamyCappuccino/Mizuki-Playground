import {assertGeographyPair,geographyBytes,geographyKey,normalizeGeographyConfiguration,
  type GeographyConfiguration,type GeographyPair,type GeographyReply,type GeographyRequest} from '../physics/geographyContract';
export interface GeographyWorker {
  postMessage(request:GeographyRequest):void; terminate():void;
  onmessage:((event:MessageEvent<GeographyReply>)=>void)|null;
  onerror:((event:ErrorEvent)=>void)|null;
  onmessageerror:((event:MessageEvent)=>void)|null;
}
export type GeographyEvent={kind:'loading'|'cancelled';key:string}
  |{kind:'progress';key:string;phase:'data'|'earth'|'ocean'}
  |{kind:'ready';key:string;pair:GeographyPair;cached:boolean}
  |{kind:'error';key:string;message:string};

/** A maximum of two result pairs and 8 MiB of their typed-array buffers.
 * New conditions immediately invalidate the old request and stop its worker.
 * No background old solve can publish a late result into a newer experiment. */
export class GeographyClient {
  private serial=0;
  private worker:GeographyWorker|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private active='';
  private disposed=false;
  private readonly cache=new Map<string,GeographyPair>();
  readonly byteLimit=8*1024*1024;
  constructor(private readonly createWorker:()=>GeographyWorker,
    private readonly onEvent:(event:GeographyEvent)=>void,private readonly timeoutMs=60_000) {
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new RangeError('Invalid geography timeout.');
  }
  get cachedBytes():number{return [...this.cache.values()].reduce((sum,p)=>sum+geographyBytes(p),0);}
  get cachedEntries():number{return this.cache.size;}
  request(value:GeographyConfiguration):void {
    if(this.disposed)throw new Error('Geography client disposed.');
    const config=normalizeGeographyConfiguration(value),key=geographyKey(config);
    if(this.worker&&key===this.active)return;
    this.stop();const id=++this.serial;this.active=key;
    this.onEvent({kind:'loading',key});
    if(id!==this.serial||this.disposed)return;
    const cached=this.cache.get(key);
    if(cached){this.cache.delete(key);this.cache.set(key,cached);this.onEvent({kind:'ready',key,pair:cached,cached:true});return;}
    const fail=(message:string)=>{
      if(id!==this.serial||this.disposed)return;
      ++this.serial;this.stop();this.onEvent({kind:'error',key,message});
    };
    try {
      const worker=this.createWorker();this.worker=worker;
      worker.onmessage=event=>{
        if(id!==this.serial||this.disposed)return;
        const reply=event.data;
        if(!reply||reply.id!==id||reply.key!==key)return;
        if(reply.kind==='progress'){this.onEvent({kind:'progress',key,phase:reply.phase});return;}
        if(reply.kind==='error'){fail(reply.message);return;}
        try {
          if(reply.kind!=='ready')throw new Error('Invalid geography worker reply.');
          assertGeographyPair(reply.pair,config);
          ++this.serial;this.stop();const bytes=geographyBytes(reply.pair);
          if(bytes<=this.byteLimit){
            while(this.cache.size&&(this.cache.size>=2||this.cachedBytes+bytes>this.byteLimit))
              this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key,reply.pair);
          }
          this.onEvent({kind:'ready',key,pair:reply.pair,cached:false});
        }catch(error){fail(error instanceof Error?error.message:'Invalid geography result.');}
      };
      worker.onerror=event=>{event.preventDefault?.();fail(event.message||'Geography worker unavailable.');};
      worker.onmessageerror=()=>fail('Geography worker response could not be decoded.');
      this.timer=setTimeout(()=>fail('Geography calculation timed out. Retry or keep the existing Classic model.'),this.timeoutMs);
      worker.postMessage({id,key,configuration:config});
    }catch(error){fail(error instanceof Error?error.message:'Geography worker failed to start.');}
  }
  cancel():void{if(this.disposed)return;++this.serial;this.stop();this.onEvent({kind:'cancelled',key:this.active});this.active='';}
  private stop():void {
    if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
    if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.worker=null;}
  }
  dispose():void{if(this.disposed)return;++this.serial;this.stop();this.cache.clear();this.active='';this.disposed=true;}
}
