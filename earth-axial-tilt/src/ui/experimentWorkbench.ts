import { decodeExperiment, decodeExperimentFile, encodeExperiment, experimentFile, experimentURL,
  MAX_EXPERIMENT_LENGTH, type ExperimentParse, type ExperimentState } from '../experiments/state';
import { EXPERIMENT_PRESETS, findExperimentPreset } from '../experiments/presets';
import { getLanguage, onLanguageChange, t, msg } from './i18n';

interface WorkbenchActions {
  capture: () => ExperimentState;
  cancelPending: () => void;
  apply: (state: ExperimentState) => Promise<boolean>;
}
/** Explicit, bounded state transfers. No network, autosave, geolocation or autoplay. */
export class ExperimentWorkbench {
  private previous: ExperimentState | null = null;
  private busy=false;
  private disposed=false;
  private action=0;
  private selected='';
  private notice='';
  private requestKind='';
  private lastSummary='';
  private readonly events=new AbortController();
  private readonly unsubscribe:()=>void;
  private readonly objectURLs=new Set<string>();
  private readonly el=<T extends HTMLElement = HTMLElement>(id:string):T=>document.getElementById(id) as T;
  constructor(private readonly actions: WorkbenchActions) {
    const on=(id:string,event:string,listener:()=>void)=>this.el(id).addEventListener(event,listener,{signal:this.events.signal});
    on('experiment-preset','change',()=>{this.selected=this.el<HTMLSelectElement>('experiment-preset').value;this.render();});
    on('experiment-apply','click',()=>{
      const preset=findExperimentPreset(this.selected);if(preset)void this.applyState({...preset.state},'Preset applied. Playback is paused.');
    });
    on('experiment-undo','click',()=>{if(this.previous)void this.applyState({...this.previous},'Previous experiment restored. Playback is paused.');});
    on('experiment-copy','click',()=>void this.copyLink());
    on('experiment-export','click',()=>this.exportFile());
    on('experiment-import','click',()=>this.el<HTMLInputElement>('experiment-file').click());
    on('experiment-file','change',()=>void this.importFile());
    window.addEventListener('hashchange',()=>void this.restoreHash(),{signal:this.events.signal});
    this.unsubscribe=onLanguageChange(()=>{this.lastSummary='';this.render();this.refresh();});
    this.render();
  }
  async restoreHash():Promise<void> {
    if(this.disposed)return;
    this.actions.cancelPending();++this.action;this.busy=false;this.render();
    const parsed=decodeExperiment(window.location.hash);
    if(parsed.status==='none')return;
    this.el<HTMLDetailsElement>('experiment-workbench').open=true;
    await this.restoreParsed(parsed,'Shared experiment restored. Playback is paused.');
  }
  private async restoreParsed(parsed:ExperimentParse,success:string):Promise<void> {
    if(parsed.status==='ok')await this.applyState(parsed.state,success);
    else this.setNotice(parsed.status==='error'&&parsed.reason==='version'
      ?'This experiment version is not supported. Current settings were kept.'
      :'Invalid experiment. Current settings were kept.','error');
  }
  private async applyState(next:ExperimentState,success:string):Promise<void> {
    const action=++this.action;
    const before=this.actions.capture();
    this.busy=true;this.setNotice('Preparing experiment…','loading');this.render();
    try {
      const applied=await this.actions.apply(next);
      if(this.disposed||action!==this.action)return;
      if(applied){this.previous=before;this.setNotice(success,'ready');}
      else this.setNotice('Experiment cancelled by a newer action. Current settings were kept.','cancelled');
    } catch {
      if(!this.disposed&&action===this.action)this.setNotice('Experiment could not be loaded. Current settings were kept. Reload to retry optional tools.','error');
    } finally {
      if(!this.disposed&&action===this.action){this.busy=false;this.render();this.refresh();}
    }
  }
  private setNotice(text:string,kind:string):void {
    this.notice=text;this.requestKind=kind;
    this.el('experiment-notice').textContent=t(text);
    this.el('experiment-notice').dataset.status=kind;
  }
  private async copyLink():Promise<void> {
    try {
      const url=experimentURL(window.location.href,this.actions.capture());
      const input=this.el<HTMLTextAreaElement>('experiment-link');
      input.value=url; this.el('experiment-link-box').hidden=false;this.el('experiment-link-stale').hidden=true;
      try {
        if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        if(!this.disposed)this.setNotice('Experiment link copied.','ready');
      } catch {
        if(this.disposed)return;
        input.focus();input.select();this.setNotice('Copy is unavailable here. Select and copy the link below.','ready');
      }
    } catch {this.setNotice('Invalid experiment. Current settings were kept.','error');}
  }
  private exportFile():void {
    try {
      const blob=new Blob([experimentFile(this.actions.capture())],{type:'application/json'});
      const url=URL.createObjectURL(blob);this.objectURLs.add(url);
      const link=document.createElement('a');link.href=url;link.download='earth-experiment.json';
      document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>{URL.revokeObjectURL(url);this.objectURLs.delete(url);},1000);
      this.setNotice('Experiment file exported. It contains settings, not a rendered image.','ready');
    } catch {this.setNotice('Invalid experiment. Current settings were kept.','error');}
  }
  private async importFile():Promise<void> {
    const input=this.el<HTMLInputElement>('experiment-file');const file=input.files?.[0];input.value='';
    if(!file)return;
    this.actions.cancelPending();++this.action;this.busy=false;this.render();
    // Check bytes before reading, and characters again after decoding. Files never become script/HTML.
    if(file.size>MAX_EXPERIMENT_LENGTH){this.setNotice('Invalid experiment. Current settings were kept.','error');return;}
    const action=++this.action;
    try {
      const text=await file.text();
      if(this.disposed||action!==this.action)return;
      await this.restoreParsed(decodeExperimentFile(text),'Experiment file restored. Playback is paused.');
    } catch {if(!this.disposed)this.setNotice('Invalid experiment. Current settings were kept.','error');}
  }
  private render():void {
    const select=this.el<HTMLSelectElement>('experiment-preset');
    const language=getLanguage()==='ja'?1:0;
    select.replaceChildren(new Option(t('Choose a question…'),''),...EXPERIMENT_PRESETS.map(preset=>new Option(preset.title[language],preset.id)));
    select.value=this.selected;
    const preset=findExperimentPreset(this.selected);
    this.el('experiment-question').textContent=preset?.question[language]??'';
    this.el('experiment-observe').textContent=preset?.watch[language]??t('Choose a question to prepare an experiment. Nothing starts playing automatically.');
    this.el<HTMLButtonElement>('experiment-apply').disabled=this.busy||!preset;
    this.el<HTMLButtonElement>('experiment-undo').disabled=this.busy||!this.previous;
    this.el<HTMLButtonElement>('experiment-import').disabled=this.busy;
    this.el('experiment-notice').textContent=t(this.notice);
    this.el('experiment-notice').dataset.status=this.requestKind;
    this.el('experiment-workbench').setAttribute('aria-busy',String(this.busy));
  }
  refresh():void {
    const state=this.actions.capture();
    const key=encodeExperiment(state);if(key===this.lastSummary)return;this.lastSummary=key;
    this.el('experiment-current').textContent=msg`Current: A ${state.tilt}°${state.dual?` / B ${state.tiltB}°`:''} · Day ${Math.floor(state.day)} · ${state.latitude.toFixed(2)}° / ${state.longitude.toFixed(2)}°`;
    // A displayed link is a deliberate snapshot, not silently updated while replaying.
    this.el('experiment-link-stale').hidden=this.el<HTMLTextAreaElement>('experiment-link').value===experimentURL(window.location.href,state);
  }
  dispose():void {
    this.disposed=true;++this.action;this.events.abort();this.unsubscribe();
    for(const url of this.objectURLs)URL.revokeObjectURL(url);this.objectURLs.clear();
  }
}
