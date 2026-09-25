/** Display only. All existing experiment settings survive Basic/All changes. */
export function bindReleaseControls(refresh: () => void): () => void {
  const root=document.documentElement;
  const select=document.getElementById('tools-mode') as HTMLSelectElement;
  const intro=document.getElementById('quick-start') as HTMLElement;
  const events=new AbortController();
  try { select.value=localStorage.getItem('earth-lab:tools') === 'basic'?'basic':'all';
    intro.hidden=localStorage.getItem('earth-lab:intro-dismissed') === 'true'; } catch { select.value='all'; }
  const apply=()=>{ root.dataset.toolsMode=select.value;
    try{localStorage.setItem('earth-lab:tools',select.value);}catch{/* session-only */} refresh(); };
  select.addEventListener('change',apply,{signal:events.signal});
  document.getElementById('intro-basic')!.addEventListener('click',()=>{select.value='basic';apply();},{signal:events.signal});
  document.getElementById('intro-dismiss')!.addEventListener('click',()=>{
    intro.hidden=true;try{localStorage.setItem('earth-lab:intro-dismissed','true');}catch{/* optional */}
  },{signal:events.signal});
  document.getElementById('show-intro')!.addEventListener('click',()=>{intro.hidden=false;intro.scrollIntoView({block:'center'});},{signal:events.signal});
  apply(); return ()=>events.abort();
}
