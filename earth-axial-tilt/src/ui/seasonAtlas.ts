import { ATLAS_UNITS, atlasReady, atlasReading, atlasScale, atlasSelection, buildAtlasField,
  type AtlasConfig, type AtlasField, type AtlasMetric, type AtlasView } from '../physics/atlas';
import type { TemperatureSource } from '../physics/temperatureModel';
import { solarDeclinationDeg } from '../physics/solar';
import { atlasColor } from './atlasColors';
import { createChartLayout, type ChartLayout } from './chartLayout';
import { formatModelDate } from './chart';
import { parseTiltInput } from './tiltInput';

export interface AtlasSnapshot {
  source: TemperatureSource;
  reference: TemperatureSource;
  revision: number;
  day: number;
  latitude: number;
  longitude: number;
  locationName: string;
  error: string;
}
interface AtlasActions {
  onOpen: () => void;
  onSettings: () => void;
  onSelect: (day: number, latitude: number) => void;
  onTilt: (tilt: number) => void;
  onHeat: (depth: number) => void;
  onFocus: () => void;
}
const TITLES: Record<AtlasMetric, string> = {
  temperature: 'Daily-mean temperature', insolation: 'Daily mean solar · TOA', daylight: 'Day length',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
const signed = (n: number) => `${n >= 0 ? '+' : ''}${Math.abs(n) < 0.05 ? '0.0' : n.toFixed(1)}`;
const latitudeLabel = (lat: number) => lat === 0 ? 'Equator' : `${Math.abs(lat).toFixed(1)}° ${lat > 0 ? 'N' : 'S'}`;

/** A modal overview, not another model. Only field/config/size changes repaint the raster. */
export class SeasonAtlas {
  private readonly dialog: HTMLDialogElement;
  private readonly plot: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: SVGSVGElement;
  private readonly metric: HTMLSelectElement;
  private readonly view: HTMLSelectElement;
  private snapshot: AtlasSnapshot | null = null;
  private field: AtlasField | null = null;
  private fieldKey = '';
  private layoutKey = '';
  private layout: ChartLayout | null = null;
  private paintCount = 0;
  private resizeFrame = 0;
  private readonly observer: ResizeObserver;
  private gesture: { id: number; x: number; y: number; moved: boolean } | null = null;
  private readonly el = <T extends Element = HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing atlas element: ${id}`);
    return element as unknown as T;
  };
  constructor(private readonly actions: AtlasActions) {
    this.dialog = this.el('season-atlas'); this.plot = this.el('atlas-plot');
    this.canvas = this.el('atlas-field'); this.overlay = this.el('atlas-overlay');
    this.metric = this.el('atlas-metric'); this.view = this.el('atlas-view');
    this.el('open-atlas').addEventListener('click', () => {
      if (this.dialog.open) return;
      this.dialog.showModal(); this.actions.onOpen();
    });
    this.el('atlas-close').addEventListener('click', () => this.dialog.close());
    this.el('atlas-focus').addEventListener('click', () => { this.dialog.close(); this.actions.onFocus(); });
    this.dialog.addEventListener('close', () => { this.gesture = null; this.actions.onSettings(); });
    for (const element of [this.metric, this.view]) element.addEventListener('change', () => this.actions.onSettings());
    this.el('atlas-trace').addEventListener('change', () => this.overlay.querySelector('.atlas-trace')?.toggleAttribute('hidden', !this.el<HTMLInputElement>('atlas-trace').checked));
    this.el('atlas-day').addEventListener('input', event => {
      if (this.snapshot) this.actions.onSelect(Number((event.target as HTMLInputElement).value), this.snapshot.latitude);
    });
    this.el('atlas-latitude').addEventListener('input', event => {
      if (this.snapshot) this.actions.onSelect(this.snapshot.day, Number((event.target as HTMLInputElement).value));
    });
    const angle = this.el<HTMLInputElement>('atlas-tilt');
    const commit = () => {
      const value = parseTiltInput(angle.value);
      if (value === null) {
        angle.value = String(this.snapshot?.source.tilt ?? 23.44);
        this.el('atlas-input-status').textContent = 'Enter 0–90°. The previous angle was kept.';
      } else { this.el('atlas-input-status').textContent = ''; this.actions.onTilt(value); }
    };
    angle.addEventListener('change', commit);
    angle.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-atlas-tilt]').forEach(button => {
      button.addEventListener('click', () => { this.el('atlas-input-status').textContent = ''; this.actions.onTilt(Number(button.dataset.atlasTilt)); });
    });
    this.el('atlas-heat').addEventListener('change', event => this.actions.onHeat(Number((event.target as HTMLSelectElement).value)));
    this.plot.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || this.gesture) { this.gesture = null; return; }
      this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    });
    this.plot.addEventListener('pointermove', event => {
      if (this.gesture && this.gesture.id === event.pointerId && Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 8) this.gesture.moved = true;
    });
    this.plot.addEventListener('pointercancel', () => { this.gesture = null; });
    this.plot.addEventListener('pointerleave', () => { this.gesture = null; });
    this.plot.addEventListener('pointerup', event => {
      const start = this.gesture; this.gesture = null;
      if (!start || start.moved || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 || !this.layout) return;
      const box = this.plot.getBoundingClientRect(), l = this.layout;
      const x = (event.clientX - box.left) / box.width * l.width;
      const y = (event.clientY - box.top) / box.height * l.height;
      if (x < l.left || x > l.right || y < l.top || y > l.bottom) return;
      const selected = atlasSelection((x - l.left) / (l.right - l.left), (y - l.top) / (l.bottom - l.top));
      if (selected) this.actions.onSelect(selected.day, selected.latitude);
    });
    this.observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => { if (this.snapshot) this.update(this.snapshot); });
    });
    this.observer.observe(this.plot);
  }
  get needsReference(): boolean {
    return this.dialog.open && this.metric.value === 'temperature' && this.view.value === 'difference';
  }
  dispose(): void { cancelAnimationFrame(this.resizeFrame); this.observer.disconnect(); }
  update(snapshot: AtlasSnapshot): void {
    this.snapshot = snapshot;
    if (!this.dialog.open) return;
    const config: AtlasConfig = { metric: this.metric.value as AtlasMetric, view: this.view.value as AtlasView,
      source: snapshot.source, reference: snapshot.reference };
    this.el<HTMLInputElement>('atlas-day').value = String(Math.floor(snapshot.day));
    this.el<HTMLInputElement>('atlas-latitude').value = String(snapshot.latitude);
    this.el('atlas-day-output').textContent = `${formatModelDate(snapshot.day)} · ${Math.floor(snapshot.day)}`;
    this.el('atlas-latitude-output').textContent = latitudeLabel(snapshot.latitude);
    const tiltInput = this.el<HTMLInputElement>('atlas-tilt');
    if (document.activeElement !== tiltInput) tiltInput.value = String(snapshot.source.tilt);
    this.el<HTMLSelectElement>('atlas-heat').value = String(snapshot.source.depth);
    this.el<HTMLSelectElement>('atlas-heat').disabled = snapshot.source.model !== 'energy-balance';
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-atlas-tilt]').forEach(button => {
      const active = Number(button.dataset.atlasTilt) === snapshot.source.tilt;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    this.el('atlas-context').textContent = `${snapshot.source.tilt}° tilt · ${snapshot.source.model === 'energy-balance'
      ? `Thermal EBM · ${snapshot.source.depth} m heat storage` : 'Illustrative temperature model'} · same repeating year as the globe`;
    const ready = atlasReady(config);
    this.plot.setAttribute('aria-busy', String(!ready));
    const status = this.el('atlas-status'); status.hidden = ready;
    status.textContent = snapshot.error ? 'Temperature unavailable. Solar and Daylight remain usable. Close to retry the thermal model.' : 'Calculating the matching thermal year…';
    const key = `${config.metric}:${config.view}:${snapshot.source.tilt}:${config.metric === 'temperature'
      ? `${snapshot.source.model}:${snapshot.source.depth}:${snapshot.revision}:${ready}` : 'astronomy'}`;
    const box = this.plot.getBoundingClientRect();
    const font = parseFloat(getComputedStyle(this.plot).fontSize) || 14;
    const layoutKey = `${box.width}:${box.height}:${font}:${window.devicePixelRatio}`;
    if (box.width > 0 && box.height > 0 && (key !== this.fieldKey || layoutKey !== this.layoutKey)) {
      if (key !== this.fieldKey) { this.field = buildAtlasField(config); this.fieldKey = key; }
      this.layout = createChartLayout(box.width, box.height, font);
      this.layoutKey = layoutKey;
      this.paint(config);
    }
    const reading = atlasReading(config, snapshot.latitude, snapshot.day);
    const unit = ATLAS_UNITS[config.metric];
    this.el('atlas-selection').textContent = `${formatModelDate(snapshot.day)} · ${latitudeLabel(snapshot.latitude)} · ${reading
      ? `${config.view === 'difference' ? signed(reading.value) : reading.value.toFixed(1)} ${unit}${config.view === 'difference'
        ? ` difference (selected ${reading.current.toFixed(1)}; Earth ${reading.reference!.toFixed(1)})` : ''}` : 'temperature not available yet'}`;
    this.el('atlas-location-note').textContent = `Selected: ${snapshot.locationName} · longitude ${Math.abs(snapshot.longitude).toFixed(2)}° ${snapshot.longitude < 0 ? 'W' : 'E'} retained. Rotation is unchanged.`;
    const extreme = config.metric === 'temperature' && snapshot.source.model === 'energy-balance' && ready &&
      [snapshot.source.solution, ...(config.view === 'difference' ? [snapshot.reference.solution] : [])].some(s => s && (s.minimum < -60 || s.maximum > 60));
    this.el('atlas-warning').hidden = !extreme;
    this.moveCursor(snapshot.day, snapshot.latitude);
  }
  private paint(config: AtlasConfig): void {
    const l = this.layout!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(l.width * dpr); this.canvas.height = Math.round(l.height * dpr);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable.');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, l.width, l.height);
    const x = (day: number) => l.left + (day - 1) / 364 * (l.right - l.left);
    const y = (lat: number) => l.top + (90 - lat) / 180 * (l.bottom - l.top);
    if (this.field) {
      const field = this.field, scale = atlasScale(config, field);
      const raster = document.createElement('canvas'); raster.width = field.columns; raster.height = field.rows;
      const rasterContext = raster.getContext('2d')!;
      const pixels = rasterContext.createImageData(field.columns, field.rows);
      for (let i = 0; i < field.values.length; i += 1) {
        const color = atlasColor(field.values[i], config.metric, scale);
        pixels.data.set([...color, 255], i * 4);
      }
      rasterContext.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(raster, l.left, l.top, l.right - l.left, l.bottom - l.top);
      const stops = Array.from({ length: 9 }, (_, i) => `rgb(${atlasColor(scale.minimum + i / 8 * (scale.maximum - scale.minimum), config.metric, scale).join(',')}) ${i / 8 * 100}%`);
      this.el('atlas-ramp').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
      this.el('atlas-scale-labels').replaceChildren(...[scale.minimum, (scale.minimum + scale.maximum) / 2, scale.maximum].map(value => {
        const label = document.createElement('span'); label.textContent = `${value} ${ATLAS_UNITS[config.metric]}`; return label;
      }));
      this.el('atlas-scale-note').textContent = `${config.view === 'difference' ? 'Selected tilt − Earth 23.44°, same model and heat storage. Blue: lower · pale: no change · warm: higher. Symmetric scale adapts.'
        : config.metric === 'temperature' ? 'Temperature scale adapts to the full sampled field. Read the legend when changing settings.' : 'Fixed scale for direct comparisons between tilts.'} Sampled range: ${field.minimum.toFixed(1)} to ${field.maximum.toFixed(1)} ${ATLAS_UNITS[config.metric]}.`;
      this.el('atlas-legend').hidden = false;
    } else {
      this.el('atlas-legend').hidden = true;
      this.el('atlas-scale-note').textContent = 'No matching temperature field yet. The colour scale and sampled range appear only after the selected model is ready.';
    }
    this.canvas.dataset.fieldRevision = String(++this.paintCount);
    this.canvas.setAttribute('aria-label', `${TITLES[config.metric]} across the model year, north at top and south at bottom. ${config.view === 'difference' ? 'Difference from Earth 23.44 degrees.' : ''} ${this.field ? 'Use the day and latitude controls for exact readings.' : 'No matching temperature data yet.'}`);
    const lines = [90, 60, 30, 0, -30, -60, -90].map(lat => `<line class="atlas-grid" x1="${l.left}" x2="${l.right}" y1="${y(lat)}" y2="${y(lat)}"/><text x="${l.left - 10}" y="${y(lat) + l.fontSize * .34}" text-anchor="end" class="atlas-axis">${lat === 0 ? '0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`}</text>`).join('');
    const stride = [1, 2, 3, 4, 6, 12].find(s => (l.right - l.left) * s / 12 >= l.fontSize * 2.5) ?? 12;
    const months = MONTHS.map((name, i) => i % stride ? '' : `<text x="${x((STARTS[i] + STARTS[i + 1] - 1) / 2)}" y="${l.height - 10}" text-anchor="middle" class="atlas-axis">${name}</text>`).join('');
    const trace = Array.from({ length: 365 }, (_, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(2)},${y(solarDeclinationDeg(i + 1, config.source.tilt)).toFixed(2)}`).join(' ');
    this.overlay.setAttribute('viewBox', `0 0 ${l.width} ${l.height}`);
    this.overlay.innerHTML = `${lines}${months}<rect class="atlas-border" x="${l.left}" y="${l.top}" width="${l.right - l.left}" height="${l.bottom - l.top}"/><path class="atlas-trace" d="${trace}" ${this.el<HTMLInputElement>('atlas-trace').checked ? '' : 'hidden'}/><line class="atlas-day-cursor" y1="${l.top}" y2="${l.bottom}"/><line class="atlas-lat-cursor" x1="${l.left}" x2="${l.right}"/><circle class="atlas-crosshair" r="5"/>`;
  }
  private moveCursor(day: number, latitude: number): void {
    if (!this.layout) return;
    const l = this.layout;
    const x = l.left + (Math.min(365, Math.max(1, day)) - 1) / 364 * (l.right - l.left);
    const y = l.top + (90 - latitude) / 180 * (l.bottom - l.top);
    const vertical = this.overlay.querySelector('.atlas-day-cursor');
    vertical?.setAttribute('x1', String(x)); vertical?.setAttribute('x2', String(x));
    const horizontal = this.overlay.querySelector('.atlas-lat-cursor');
    horizontal?.setAttribute('y1', String(y)); horizontal?.setAttribute('y2', String(y));
    const cross = this.overlay.querySelector('.atlas-crosshair');
    cross?.setAttribute('cx', String(x)); cross?.setAttribute('cy', String(y));
  }
}
