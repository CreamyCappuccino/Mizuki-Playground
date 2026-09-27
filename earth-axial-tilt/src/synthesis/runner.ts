import { calculateRow, validateSweep, type SweepResult, type SweepRow, type SweepSettings } from './model';
export type SweepStatus =
  | { status: 'idle' | 'canceled' }
  | { status:'running'; completed:number; total:number }
  | { status:'ready'; result:SweepResult }
  | { status:'error'; message:string };
/** One bounded row per event-loop turn. No climate solves, background service,
 * hidden cache or spin-up. Obsolete runs drop their private rows immediately. */
export class SweepRunner {
  private serial=0;
  private disposed=false;
  private timer: ReturnType<typeof setTimeout> | null=null;
  constructor(private readonly notify:(state:SweepStatus)=>void,
    private readonly compute=calculateRow) {}
  cancel(status:'idle'|'canceled'='canceled'): void {
    this.serial++; if (this.timer !== null) clearTimeout(this.timer); this.timer=null;
    if (!this.disposed) this.notify({status});
  }
  run(input:SweepSettings): void {
    if(this.disposed)return;
    // Validate first: a bad programmatic request cannot cancel a valid result.
    const settings=validateSweep(input);
    this.cancel('idle'); const serial=this.serial, rows:SweepRow[]=[];
    const advance=()=>{
      this.timer=null; if(this.disposed||serial!==this.serial)return;
      try {
        rows.push(this.compute(settings,rows.length));
        if(this.disposed||serial!==this.serial)return;
        if(rows.length===settings.count){this.notify({status:'ready',result:{settings,rows}});return;}
        this.notify({status:'running',completed:rows.length,total:settings.count});
        if(!this.disposed&&serial===this.serial)this.timer=setTimeout(advance,0);
      } catch(error){ if(serial===this.serial&&!this.disposed)this.notify({status:'error',message:String(error)}); }
    };
    this.notify({status:'running',completed:0,total:settings.count});
    if(serial===this.serial&&!this.disposed)this.timer=setTimeout(advance,0);
  }
  dispose():void { if(this.disposed)return; this.disposed=true;this.cancel(); }
}
