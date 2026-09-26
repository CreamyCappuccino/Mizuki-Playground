import type { FeedbackExperiment, FeedbackExperimentResult } from './experiment';
import { feedbackRequest, isFeedbackReply, matchingFeedbackResult, type FeedbackRequest } from './protocol';
export type FeedbackClientState = {status:'idle'|'canceled'}|{status:'working';completed:number;total:number;year:number}|
  {status:'ready';result:FeedbackExperimentResult}|{status:'error';error:string};
export interface FeedbackWorker {postMessage:(v:FeedbackRequest)=>void;terminate:()=>void;onmessage:((v:MessageEvent<unknown>)=>void)|null;onerror:((v:ErrorEvent)=>void)|null}
/** One active worker and one accepted result; no hidden history cache. */
export class FeedbackClient {
  state:FeedbackClientState={status:'idle'};
  private active:{worker:FeedbackWorker;request:FeedbackRequest;timer:ReturnType<typeof setTimeout>}|null=null;
  private serial=0;private disposed=false;
  constructor(private readonly notify:(s:FeedbackClientState)=>void,
    private readonly makeWorker:()=>FeedbackWorker=()=>new Worker(new URL('./feedback.worker.ts',import.meta.url),{type:'module'}),
    private readonly deadlineMs=120_000){
    if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>2_147_483_647)throw new RangeError('Invalid feedback deadline.');
  }
  private emit(state:FeedbackClientState){this.state=state;this.notify(state);}
  private stop(){if(this.active){clearTimeout(this.active.timer);this.active.worker.terminate();this.active=null;}}
  invalidate(){if(this.disposed)return;this.stop();this.emit({status:'idle'});}
  cancel(){if(this.disposed)return;this.stop();this.emit({status:'canceled'});}
  run(value:FeedbackExperiment):void{
    if(this.disposed)return;
    const request=feedbackRequest(++this.serial,value); // invalid new settings leave accepted result intact
    this.stop();this.emit({status:'working',completed:0,total:value.mode==='compare'?2:value.multipliers.length,year:0});
    try{
      const worker=this.makeWorker();
      const active={worker,request,timer:setTimeout(()=>{if(this.active===active)this.fail('Feedback calculation timed out. Run explicitly to retry.');},this.deadlineMs)};
      this.active=active;
      worker.onmessage=event=>{
        if(this.disposed||this.active!==active)return;
        const r=event.data;
        if(!isFeedbackReply(r)||r.id!==request.id||r.key!==request.key){this.fail('Invalid feedback worker reply.');return;}
        if(r.status==='error'){this.fail(r.error);return;}
        if(r.status==='progress'){
          if(r.total!==(request.experiment.mode==='compare'?2:request.experiment.multipliers.length)){this.fail('Invalid feedback progress.');return;}
          this.emit({status:'working',completed:r.completed,total:r.total,year:r.year});return;
        }
        if(!matchingFeedbackResult(r.result,request)){this.fail('Feedback result failed validation.');return;}
        this.stop();this.emit({status:'ready',result:r.result});
      };
      worker.onerror=event=>{event.preventDefault();if(this.active===active)this.fail('Feedback worker unavailable. Run explicitly to retry.');};
      worker.postMessage(request);
    }catch(error){this.fail(error instanceof Error?error.message:'Feedback worker unavailable.');}
  }
  private fail(error:string){this.stop();this.emit({status:'error',error});}
  dispose(){if(this.disposed)return;this.disposed=true;this.stop();this.state={status:'idle'};}
}
