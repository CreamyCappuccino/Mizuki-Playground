import './style.css';
import { DEFAULT_LOCATION, LOCATIONS, type LocationPreset } from './data/locations';
import { EarthScene, type SurfaceMode } from './scene/EarthScene';
import { annualProfile, temperatureEstimateC, type AnnualPoint } from './physics/climate';
import { dailyMeanInsolation, dayLengthHours, seasonLabel, solarDeclinationDeg, SOLAR_CONSTANT } from './physics/solar';
import { renderAnnualChart, updateChartDay, type ChartMetric } from './ui/chart';
import { parseTiltInput } from './ui/tiltInput';

interface AppState {
  tilt: number;
  day: number;
  speed: number;
  playing: boolean;
  surfaceMode: SurfaceMode;
  chartMetric: ChartMetric;
  location: LocationPreset;
  guides: boolean;
  compare: boolean;
}

const state: AppState = {
  tilt: 23.44, day: 172, speed: 1, playing: false,
  surfaceMode: 'normal', chartMetric: 'temperature', location: DEFAULT_LOCATION,
  guides: true, compare: false,
};
const $ = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};
const canvas = $<HTMLCanvasElement>('#earth-canvas');
const tiltInput = $<HTMLInputElement>('#tilt');
const tiltNumber = $<HTMLInputElement>('#tilt-number');
const tiltHelp = $<HTMLElement>('#tilt-help');
const dayInput = $<HTMLInputElement>('#day');
const playButton = $<HTMLButtonElement>('#play-year');
const locationSelect = $<HTMLSelectElement>('#location-select');
const chartContainer = $<HTMLElement>('#annual-chart');
const TILT_HELP = '0–90° · Enter or leave the field to apply.';
const scene = new EarthScene(canvas, {
  onLocationPick: (location) => {
    state.location = location;
    locationSelect.value = 'custom';
    update();
  },
});
for (const location of LOCATIONS) {
  const option = new Option(location.name, location.id);
  locationSelect.append(option);
}
const customOption = new Option('Custom point — click the globe', 'custom');
customOption.disabled = true;
locationSelect.append(customOption);
locationSelect.value = state.location.id;

let profileKey = '';
let profile: AnnualPoint[] = [];
let referenceLatitude = NaN;
let reference: AnnualPoint[] = [];
let chartKey = '';

function update(): void {
  tiltInput.value = String(state.tilt);
  tiltNumber.value = String(state.tilt);
  tiltNumber.removeAttribute('aria-invalid');
  $('#tilt-readout').textContent = `${Number.isInteger(state.tilt) ? state.tilt : state.tilt.toFixed(2)}°`;
  for (const attribute of ['tilt', 'speed', 'mode', 'chart'] as const) {
    document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach((button) => {
      const expected = { tilt: String(state.tilt), speed: String(state.speed), mode: state.surfaceMode, chart: state.chartMetric }[attribute];
      const active = button.dataset[attribute] === expected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  playButton.textContent = state.playing ? '❚❚ Pause' : '▶ Play year';
  playButton.setAttribute('aria-pressed', String(state.playing));
  scene.setState({ tilt: state.tilt, day: state.day, mode: state.surfaceMode, location: state.location, guides: state.guides });
  updateSurfaceLegend();
  updateReadouts();
}

function updateReadouts(): void {
  dayInput.value = String(Math.floor(state.day));
  $('#day-readout').textContent = String(Math.floor(state.day));
  $('#date-readout').textContent = `Day ${Math.floor(state.day)}`;
  $('#season-label').textContent = seasonLabel(state.day);
  const { latitude, longitude } = state.location;
  $('#location-name').textContent = state.location.name;
  $('#location-coords').textContent = `${formatCoordinate(latitude, 'N', 'S')} · ${formatCoordinate(longitude, 'E', 'W')}`;
  const daylight = dayLengthHours(latitude, state.day, state.tilt);
  $('#metric-daylight').textContent = `${daylight.toFixed(1)} h`;
  $('#metric-daylight').setAttribute('title', daylight === 24 ? 'Polar day' : daylight === 0 ? 'Polar night' : 'Geometric day length');
  $('#metric-solar').textContent = `${Math.round(dailyMeanInsolation(latitude, state.day, state.tilt))} W/m²`;
  $('#metric-temp').textContent = `${temperatureEstimateC(latitude, state.day, state.tilt).toFixed(1)} °C`;
  const declination = solarDeclinationDeg(state.day, state.tilt);
  $('#metric-declination').textContent = `${declination >= 0 ? '+' : ''}${declination.toFixed(1)}°`;
  $('#subsolar-readout').textContent = formatCoordinate(declination, 'N', 'S');

  const nextKey = `${latitude}:${state.tilt}`;
  if (nextKey !== profileKey) {
    profile = annualProfile(latitude, state.tilt);
    profileKey = nextKey;
  }
  if (state.compare && referenceLatitude !== latitude) {
    reference = annualProfile(latitude, 23.44);
    referenceLatitude = latitude;
  }
  const nextChartKey = `${profileKey}:${state.chartMetric}:${state.compare}`;
  if (nextChartKey !== chartKey) {
    const titles: Record<ChartMetric, string> = {
      temperature: 'Daily-mean temperature estimate', insolation: 'Daily mean solar (TOA)', daylight: 'Day length',
    };
    $('#chart-title').textContent = titles[state.chartMetric];
    renderAnnualChart(chartContainer, profile, { metric: state.chartMetric, activeDay: state.day, reference: state.compare ? reference : undefined });
    const values = profile.map((point) => point[state.chartMetric]);
    const unit = { temperature: '°C', insolation: 'W/m²', daylight: 'h' }[state.chartMetric];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    $('#profile-summary').textContent = `Annual mean ${mean.toFixed(1)} ${unit} · Daily-curve range ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)} ${unit}${state.compare ? ' · Dashed: Earth reference' : ''}`;
    chartKey = nextChartKey;
  } else {
    updateChartDay(chartContainer, state.day);
  }
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

function updateSurfaceLegend(): void {
  const legend = $<HTMLElement>('#surface-legend');
  legend.hidden = state.surfaceMode === 'normal';
  if (state.surfaceMode === 'normal') return;
  const scale = {
    insolation: { title: 'Daily mean solar · TOA · W/m²', min: 0, max: SOLAR_CONSTANT },
    daylight: { title: 'Geometric day length · h', min: 0, max: 24 },
    temperature: { title: 'Daily-mean estimate · °C', min: -65, max: 55 },
  }[state.surfaceMode];
  $('#surface-legend-title').textContent = scale.title;
  const stops = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const [h, saturation, lightness] = state.surfaceMode === 'temperature'
      ? [0.65 - t * 0.65, 0.88, 0.24 + Math.sin(t * Math.PI) * 0.22]
      : state.surfaceMode === 'daylight' ? [0.68 - t * 0.53, 0.82, 0.2 + t * 0.48]
        : [0.66 - t * 0.55, 0.88, 0.22 + t * 0.42];
    return `hsl(${h * 360} ${saturation * 100}% ${lightness * 100}%) ${t * 100}%`;
  });
  $<HTMLElement>('#surface-legend-ramp').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  $('#surface-legend-ticks').replaceChildren(...[scale.min, (scale.min + scale.max) / 2, scale.max].map((value) => {
    const span = document.createElement('span'); span.textContent = String(value); return span;
  }));
}

function commitTilt(): void {
  const value = parseTiltInput(tiltNumber.value);
  if (value === null) {
    tiltHelp.textContent = 'Enter a number from 0 to 90. Previous angle kept.';
    tiltNumber.value = String(state.tilt);
    tiltNumber.removeAttribute('aria-invalid');
    return;
  }
  state.tilt = value;
  tiltHelp.textContent = TILT_HELP;
  update();
}

tiltNumber.addEventListener('input', () => {
  tiltNumber.setAttribute('aria-invalid', String(parseTiltInput(tiltNumber.value) === null));
});
tiltNumber.addEventListener('change', commitTilt);
tiltNumber.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); commitTilt(); }
  if (event.key === 'Escape') {
    tiltNumber.value = String(state.tilt);
    tiltNumber.removeAttribute('aria-invalid');
    tiltHelp.textContent = TILT_HELP;
    tiltNumber.blur();
  }
});
tiltInput.addEventListener('input', () => {
  state.tilt = Number(tiltInput.value); tiltHelp.textContent = TILT_HELP; update();
});
dayInput.addEventListener('input', () => { state.day = Number(dayInput.value); update(); });
document.querySelectorAll<HTMLButtonElement>('[data-tilt]').forEach((button) => {
  button.addEventListener('click', () => { state.tilt = Number(button.dataset.tilt); tiltHelp.textContent = TILT_HELP; update(); });
});
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => { state.speed = Number(button.dataset.speed); update(); });
});
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => { state.surfaceMode = button.dataset.mode as SurfaceMode; update(); });
});
document.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach((button) => {
  button.addEventListener('click', () => { state.chartMetric = button.dataset.chart as ChartMetric; update(); });
});
locationSelect.addEventListener('change', () => {
  const location = LOCATIONS.find((candidate) => candidate.id === locationSelect.value);
  if (location) { state.location = location; update(); }
});
$<HTMLInputElement>('#show-guides').addEventListener('change', (event) => {
  state.guides = (event.target as HTMLInputElement).checked; update();
});
$<HTMLInputElement>('#compare-earth').addEventListener('change', (event) => {
  state.compare = (event.target as HTMLInputElement).checked; update();
});
playButton.addEventListener('click', () => { state.playing = !state.playing; update(); });

let lastTime = performance.now();
let lastReadout = 0;
function tick(now: number): void {
  const elapsedSeconds = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state.playing && !document.hidden) {
    state.day = ((state.day - 1 + elapsedSeconds * state.speed * 7) % 365) + 1;
    scene.setState({ day: state.day });
    // Metrics update at 10 Hz; the 3D view is still rendered every frame.
    if (now - lastReadout >= 100) { updateReadouts(); lastReadout = now; }
  }
  requestAnimationFrame(tick);
}
update();
requestAnimationFrame(tick);
