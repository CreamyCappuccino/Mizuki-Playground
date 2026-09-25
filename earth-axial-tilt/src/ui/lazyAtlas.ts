import type { SeasonAtlas, AtlasSnapshot, AtlasActions } from './seasonAtlas';
import { t } from './i18n';
/** Loading the atlas is optional; opening failure cannot disable the single/dual globe. */
export class LazyAtlas {
  private instance: SeasonAtlas | null = null;
  private snapshot: AtlasSnapshot | null = null;
  private loading = false;
  private failed = false;
  private disposed = false;
  private readonly button = document.getElementById('open-atlas') as HTMLButtonElement;
  private readonly events = new AbortController();
  constructor(private readonly actions: AtlasActions) {
    this.button.addEventListener('click', () => { void this.open(); }, { signal: this.events.signal });
  }
  get needsReference(): boolean { return this.instance?.needsReference ?? false; }
  update(snapshot: AtlasSnapshot): void { this.snapshot=snapshot; this.instance?.update(snapshot); }
  private async open(): Promise<void> {
    if (this.loading || this.disposed) return;
    if (this.failed) { location.reload(); return; }
    if (!this.instance) {
      this.loading=true; this.button.disabled=true;
      try {
        const { SeasonAtlas } = await import('./seasonAtlas');
        if (this.disposed) return;
        this.instance=new SeasonAtlas(this.actions,false);
        if(this.snapshot)this.instance.update(this.snapshot);
        this.button.dataset.loaded='true';
      } catch { this.failed=true;this.button.textContent=t('Reload to retry season atlas'); return; }
      finally { this.loading=false;this.button.disabled=false; }
    }
    this.button.focus({ preventScroll: true });
    this.instance.open();
  }
  dispose(): void { this.disposed=true;this.events.abort();this.instance?.dispose();this.instance=null;this.snapshot=null; }
}
