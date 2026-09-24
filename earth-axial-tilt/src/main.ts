import { solarMoment, subsolarLongitude, formatSolarClock, rotationAtSolarHour, wrapRotation, diurnalProfile } from './physics/diurnal';
import { renderDayChart, updateSolarCursor } from './ui/dayChart';
import { advanceSimulation, togglePlayback, type Playback } from './ui/playback';
import './style.css';
import { DEFAULT_LOCATION, LOCATIONS, type LocationPreset } from './data/locations';
import { EarthScene, type SurfaceMode } from './scene/EarthScene';
import { annualProfile, temperatureEstimateC, type AnnualPoint } from './physics/climate';
import { dailyMeanInsolation, dayLengthHours, seasonLabel, solarDeclinationDeg, SOLAR_CONSTANT } from './physics/solar';
import { renderAnnualChart, updateChartDay, formatModelDate, type ChartMetric } from './ui/chart';
import { parseTiltInput } from './ui/tiltInput';
import { bindChartScrubber, LAST_SOLAR_MINUTE } from './ui/chartScrubber';

interface AppState {
  tilt: number;
  day: number;
  speed: number;
  playback: Playback;
  rotation: number;
  period: 'year' | 'day';
  surfaceMode: SurfaceMode;
  chartMetric: ChartMetric;
  location: LocationPreset;
  guides: boolean;
  compare: boolean;
}

const state: AppState = {
  tilt: 23.44, day: 172, speed: 1, playback: 'paused', rotation: 0, period: 'year',
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
const playDayButton = $<HTMLButtonElement>('#play-day');
const rotationInput = $<HTMLInputElement>('#rotation');
const locationSelect = $<HTMLSelectElement>('#location-select');
const chartContainer = $<HTMLElement>('#annual-chart');
const textSize = $<HTMLSelectElement>('#text-size');
// A local display preference only. The app still works when storage is blocked.
try {
  textSize.value = localStorage.getItem('earth-lab:text-size') === 'large' ? 'large' : 'comfortable';
} catch { textSize.value = 'comfortable'; }
document.documentElement.dataset.textSize = textSize.value;
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
  for (const attribute of ['tilt', 'speed', 'mode', 'chart', 'period'] as const) {
    document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach((button) => {
      const expected = { tilt: String(state.tilt), speed: String(state.speed), mode: state.surfaceMode, chart: state.chartMetric, period: state.period }[attribute];
      const active = button.dataset[attribute] === expected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  playButton.textContent = state.playback === 'year' ? '❚❚ Pause year' : '▶ Play year';
  playButton.setAttribute('aria-pressed', String(state.playback === 'year'));
  playDayButton.textContent = state.playback === 'day' ? '❚❚ Pause day' : '▶ Play day';
  playDayButton.setAttribute('aria-pressed', String(state.playback === 'day'));
  $('#chart-buttons').toggleAttribute('hidden', state.period === 'day');
  document.querySelector<HTMLElement>('.compare-control')!.hidden = state.period === 'day';
  $('#profile-period').textContent = state.period === 'year' ? 'ANNUAL PROFILE' : 'ONE SOLAR DAY';
  scene.setState({ tilt: state.tilt, day: state.day, mode: state.surfaceMode, location: state.location, guides: state.guides, rotation: state.rotation });
  updateSurfaceLegend();
  updateReadouts();
}

function updateReadouts(): void {
  rotationInput.value = String(state.rotation);
  $('#rotation-readout').textContent = `${state.rotation.toFixed(1)}°`;
  dayInput.value = String(Math.floor(state.day));
  $('#day-readout').textContent = String(Math.floor(state.day));
  $('#date-readout').textContent = `${formatModelDate(state.day)} · Day ${Math.floor(state.day)}`;
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
  const sunLongitude = subsolarLongitude(state.day, state.tilt, state.rotation);
  $('#subsolar-longitude').textContent = sunLongitude === null ? 'Undefined at solar pole' : formatCoordinate(sunLongitude, 'E', 'W');
  const moment = solarMoment(latitude, longitude, state.day, state.tilt, state.rotation);
  $('#metric-solar-time').textContent = formatSolarClock(moment.solarHours);
  $('#metric-elevation').textContent = `${moment.elevationDeg.toFixed(1)}°`;
  $('#metric-instant').textContent = `${Math.round(moment.insolation)} W/m²`;
  const status = $('#illumination-state');
  status.textContent = { day: 'Daytime', night: 'Night', horizon: 'On the horizon' }[moment.illumination];
  status.setAttribute('data-illumination', moment.illumination);
  for (const hour of ['noon', 'midnight']) {
    const button = $<HTMLButtonElement>(`#${hour}-here`);
    button.disabled = moment.solarHours === null;
    button.title = button.disabled ? 'Solar meridian is undefined at this geometry.' : 'Use local apparent solar time, not clock time.';
  }
  if (state.period === 'day') {
    const key = `day:${latitude}:${state.day}:${state.tilt}:${moment.solarHours === null}`;
    const hour = moment.solarHours ?? state.rotation / 15;
    if (key !== chartKey) {
      const daily = diurnalProfile(latitude, state.day, state.tilt);
      const mean = dailyMeanInsolation(latitude, state.day, state.tilt);
      renderDayChart(chartContainer, daily, mean, hour, moment.solarHours !== null);
      $('#chart-title').textContent = 'Instantaneous solar (TOA)';
      $('#profile-summary').textContent = `Dashed: daily mean ${mean.toFixed(1)} W/m² · Peak ${Math.max(...daily.map(p => p.insolation)).toFixed(1)} W/m² · ${moment.solarHours === null ? 'Nominal rotation hours; no defined solar meridian.' : 'Local solar time, not civil time.'}`;
      chartKey = key;
    } else updateSolarCursor(chartContainer, hour);
    updateChartSelection();
    return;
  }


  const nextKey = `${latitude}:${state.tilt}`;
  if (nextKey !== profileKey) {
    profile = annualProfile(latitude, state.tilt);
    profileKey = nextKey;
  }
  if (state.compare && referenceLatitude !== latitude) {
    reference = annualProfile(latitude, 23.44);
    referenceLatitude = latitude;
  }
  const nextChartKey = `year:${profileKey}:${state.chartMetric}:${state.compare}`;
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
  updateChartSelection();
}

function selectedChartValue(): number {
  if (state.period === 'year') return Math.min(365, Math.max(1, state.day));
  return solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation).solarHours
    ?? state.rotation / 15;
}

function updateChartSelection(): void {
  const value = selectedChartValue();
  let description: string;
  if (state.period === 'year') {
    const selected = {
      temperature: () => `${temperatureEstimateC(state.location.latitude, state.day, state.tilt).toFixed(1)} °C · daily-mean estimate`,
      insolation: () => `${dailyMeanInsolation(state.location.latitude, state.day, state.tilt).toFixed(1)} W/m² · daily mean`,
      daylight: () => `${dayLengthHours(state.location.latitude, state.day, state.tilt).toFixed(1)} h · daylight`,
    }[state.chartMetric]();
    description = `${formatModelDate(state.day)} · Day ${Math.floor(state.day)} · ${selected}`;
    chartContainer.setAttribute('aria-label', 'Annual profile: select model day');
    $('#chart-help').textContent = 'Click or drag to choose a day. Arrow keys: 1 day; Page keys: 30 days; Home / End: first / last day.';
  } else {
    const moment = solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation);
    const nominal = moment.solarHours === null;
    description = `${formatSolarClock(value)} · ${nominal ? 'nominal rotation time' : 'local solar time'} · ${moment.insolation.toFixed(1)} W/m² now`;
    chartContainer.setAttribute('aria-label', nominal ? 'Daily profile: select nominal rotation time' : 'Daily profile: select local solar time');
    $('#chart-help').textContent = 'Click or drag to choose a time. Arrow keys: 15 min; Page keys: 1 hour; Home / End: 00:00 / 23:59. Swipe vertically to scroll.';
  }
  chartContainer.setAttribute('aria-valuemin', state.period === 'year' ? '1' : '0');
  chartContainer.setAttribute('aria-valuemax', state.period === 'year' ? '365' : String(LAST_SOLAR_MINUTE));
  chartContainer.setAttribute('aria-valuenow', String(Math.min(value, state.period === 'year' ? 365 : LAST_SOLAR_MINUTE)));
  chartContainer.setAttribute('aria-valuetext', description);
  $('#chart-selection').textContent = description;
}

bindChartScrubber(chartContainer, {
  getPeriod: () => state.period,
  getValue: selectedChartValue,
  onSelect: (value) => {
    state.playback = 'paused';
    if (state.period === 'year') state.day = value;
    else {
      const moment = solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation);
      state.rotation = moment.solarHours === null ? wrapRotation(value * 15)
        : rotationAtSolarHour(state.location.longitude, state.day, state.tilt, value) ?? state.rotation;
    }
    update();
  },
});

let lastChartSize = '';
let resizeFrame = 0;
function refreshChartSize(): void {
  const box = chartContainer.getBoundingClientRect();
  const key = `${box.width.toFixed(2)}:${box.height.toFixed(2)}:${getComputedStyle(chartContainer).fontSize}`;
  if (box.width <= 0 || box.height <= 0 || key === lastChartSize) return;
  lastChartSize = key;
  chartKey = '';
  updateReadouts();
}
const chartObserver = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(refreshChartSize);
});
chartObserver.observe(chartContainer);
textSize.addEventListener('change', () => {
  document.documentElement.dataset.textSize = textSize.value;
  try { localStorage.setItem('earth-lab:text-size', textSize.value); } catch { /* session-only preference */ }
  refreshChartSize();
});
$('#jump-chart').addEventListener('click', () => {
  $('#profile-section').scrollIntoView({ block: 'start', behavior: 'auto' });
  chartContainer.focus({ preventScroll: true });
});

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

function updateSurfaceLegend(): void {
  const legend = $<HTMLElement>('#surface-legend');
  legend.hidden = state.surfaceMode === 'normal';
  if (state.surfaceMode === 'normal') return;
  const scale = {
    insolation: { title: 'Daily mean solar · TOA · W/m²', min: 0, max: SOLAR_CONSTANT },
    instant: { title: 'Sun now · TOA · W/m²', min: 0, max: SOLAR_CONSTANT },
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
dayInput.addEventListener('input', () => { state.playback = 'paused'; state.day = Number(dayInput.value); update(); });
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
playButton.addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'year'); update(); });
playDayButton.addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'day'); update(); });
rotationInput.addEventListener('input', () => {
  state.playback = 'paused'; state.rotation = wrapRotation(Number(rotationInput.value)); update();
});
for (const [id, hour] of [['noon-here', 12], ['midnight-here', 0]] as const) {
  $<HTMLButtonElement>(`#${id}`).addEventListener('click', () => {
    const rotation = rotationAtSolarHour(state.location.longitude, state.day, state.tilt, hour);
    if (rotation === null) return;
    state.rotation = rotation; state.playback = 'paused'; update();
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(button => {
  button.addEventListener('click', () => { state.period = button.dataset.period as 'year' | 'day'; update(); });
});
$('#focus-location').addEventListener('click', () => scene.focusLocation());
$('#reset-view').addEventListener('click', () => scene.resetView());


let lastTime = performance.now();
let lastReadout = 0;
function tick(now: number): void {
  const elapsedSeconds = (now - lastTime) / 1000;
  lastTime = now;
  if (state.playback !== 'paused' && !document.hidden) {
    const next = advanceSimulation(state.day, state.rotation, state.playback, elapsedSeconds, state.speed);
    state.day = next.day; state.rotation = next.rotation;
    scene.setState(state.playback === 'year' ? { day: state.day } : { rotation: state.rotation });
    if (now - lastReadout >= 100) { updateReadouts(); lastReadout = now; }
  }
  requestAnimationFrame(tick);
}
update();
requestAnimationFrame(tick);
