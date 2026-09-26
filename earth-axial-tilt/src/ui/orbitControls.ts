import { MAX_EDUCATIONAL_ECCENTRICITY, orbitalState, type OrbitParameters } from '../physics/orbit';
import { t, msg } from './i18n';

export class OrbitControls {
  private readonly events = new AbortController();
  private readonly eccentricity = document.querySelector<HTMLInputElement>('#orbit-eccentricity')!;
  private readonly perihelion = document.querySelector<HTMLInputElement>('#orbit-perihelion')!;
  private readonly axis = document.querySelector<HTMLInputElement>('#orbit-axis')!;

  constructor(private readonly change: (orbit: OrbitParameters) => void) {
    const update = () => this.change({
      eccentricity: Number(this.eccentricity.value),
      perihelionLongitude: Number(this.perihelion.value),
      axisLongitude: Number(this.axis.value),
    });
    for (const input of [this.eccentricity, this.perihelion, this.axis]) {
      input.addEventListener('input', update, { signal: this.events.signal });
    }
    document.querySelectorAll<HTMLButtonElement>('[data-orbit-e]').forEach(button => {
      button.addEventListener('click', () => {
        this.eccentricity.value = button.dataset.orbitE!;
        update();
      }, { signal: this.events.signal });
    });
  }

  sync(orbit: OrbitParameters, day: number): void {
    this.eccentricity.max = String(MAX_EDUCATIONAL_ECCENTRICITY);
    this.eccentricity.value = String(orbit.eccentricity);
    this.perihelion.value = String(orbit.perihelionLongitude);
    this.axis.value = String(orbit.axisLongitude);
    document.querySelector<HTMLOutputElement>('#orbit-eccentricity-readout')!.value = orbit.eccentricity.toFixed(3);
    document.querySelector<HTMLOutputElement>('#orbit-perihelion-readout')!.value = `${orbit.perihelionLongitude.toFixed(0)}°`;
    document.querySelector<HTMLOutputElement>('#orbit-axis-readout')!.value = `${orbit.axisLongitude.toFixed(0)}°`;
    document.querySelectorAll<HTMLButtonElement>('[data-orbit-e]').forEach(button => {
      const active = Number(button.dataset.orbitE) === orbit.eccentricity;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    const state = orbitalState(day, orbit);
    document.querySelector('#metric-distance')!.textContent = `${state.distanceAu.toFixed(3)} AU`;
    document.querySelector('#metric-relative-flux')!.textContent = `×${state.relativeFlux.toFixed(3)}`;
    document.querySelector('#metric-orbital-speed')!.textContent = `×${state.relativeSpeed.toFixed(3)}`;
    const degenerate = document.querySelector<HTMLElement>('#orbit-degenerate')!;
    degenerate.hidden = orbit.eccentricity !== 0;
    degenerate.textContent = t('At e = 0 every point is equally near the Sun, so perihelion direction has no physical effect.');
    const phase = Math.sin((orbit.perihelionLongitude - orbit.axisLongitude) * Math.PI / 180);
    document.querySelector('#perihelion-season')!.textContent = orbit.eccentricity === 0 ? t('Undefined for a circular orbit')
      : Math.abs(phase) < 0.35 ? t('Near an equinox')
        : phase > 0 ? t('Northern warm season') : t('Northern cold season');
    document.querySelector('#orbit-diagnostic-note')!.textContent = msg`Model phase, not a calendar ephemeris. Relative values use a circular orbit as ×1.`;
  }

  dispose(): void { this.events.abort(); }
}
