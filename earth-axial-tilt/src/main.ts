import './style.css';
import { DEFAULT_LOCATION, LOCATIONS, type LocationPreset } from './data/locations';
import { EarthScene, type SurfaceMode } from './scene/EarthScene';
import { annualProfile, temperatureEstimateC } from './physics/climate';
import {
  dailyMeanInsolation,
  dayLengthHours,
  seasonLabel,
  solarDeclinationDeg,
} from './physics/solar';
import { renderAnnualChart, type ChartMetric } from './ui/chart';

interface AppState {
  tilt: number;
  day: number;
  speed: number;
  playing: boolean;
  surfaceMode: SurfaceMode;
  chartMetric: ChartMetric;
  location: LocationPreset;
}

const state: AppState = {
  tilt: 23.44,
  day: 172,
  speed: 1,
  playing: false,
  surfaceMode: 'normal',
  chartMetric: 'temperature',
  location: DEFAULT_LOCATION,
};

const $ = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const canvas = $<HTMLCanvasElement>('#earth-canvas');
const tiltInput = $<HTMLInputElement>('#tilt');
const dayInput = $<HTMLInputElement>('#day');
const tiltReadout = $<HTMLOutputElement>('#tilt-readout');
const dayReadout = $<HTMLOutputElement>('#day-readout');
const dateReadout = $<HTMLElement>('#date-readout');
const seasonReadout = $<HTMLElement>('#season-label');
const playButton = $<HTMLButtonElement>('#play-year');
const locationSelect = $<HTMLSelectElement>('#location-select');
const chartContainer = $<HTMLElement>('#annual-chart');

const scene = new EarthScene(canvas, {
  onLocationPick: (location) => {
    state.location = location;
    locationSelect.value = '';
    update();
  },
});

for (const location of LOCATIONS) {
  const option = document.createElement('option');
  option.value = location.id;
  option.textContent = location.name;
  locationSelect.append(option);
}
locationSelect.value = state.location.id;

function update(): void {
  tiltInput.value = String(state.tilt);
  dayInput.value = String(state.day);
  tiltReadout.value = `${state.tilt.toFixed(state.tilt % 1 === 0 ? 0 : 2)}°`;
  dayReadout.value = String(Math.round(state.day));
  dateReadout.textContent = `Day ${Math.round(state.day)}`;
  seasonReadout.textContent = seasonLabel(state.day);

  document.querySelectorAll<HTMLButtonElement>('[data-tilt]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.tilt) === state.tilt);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.speed) === state.speed);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.surfaceMode);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach((button) => {
    button.classList.toggle('active', button.dataset.chart === state.chartMetric);
  });

  playButton.textContent = state.playing ? '❚❚ Pause' : '▶ Play year';
  playButton.setAttribute('aria-pressed', String(state.playing));

  scene.setState({
    tilt: state.tilt,
    day: state.day,
    mode: state.surfaceMode,
    location: state.location,
  });

  updateLocationPanel();
}

function updateLocationPanel(): void {
  const { latitude, longitude } = state.location;
  $('#location-name').textContent = state.location.name;
  $('#location-coords').textContent = `${formatLatitude(latitude)} · ${formatLongitude(longitude)}`;

  const daylight = dayLengthHours(latitude, state.day, state.tilt);
  const solar = dailyMeanInsolation(latitude, state.day, state.tilt);
  const temperature = temperatureEstimateC(latitude, state.day, state.tilt);
  const declination = solarDeclinationDeg(state.day, state.tilt);

  $('#metric-daylight').textContent = `${daylight.toFixed(1)} h`;
  $('#metric-solar').textContent = `${Math.round(solar)} W/m²`;
  $('#metric-temp').textContent = `${temperature.toFixed(1)} °C`;
  $('#metric-declination').textContent = `${declination >= 0 ? '+' : ''}${declination.toFixed(1)}°`;

  const chartTitles: Record<ChartMetric, string> = {
    temperature: 'Temperature estimate',
    insolation: 'Daily mean solar energy',
    daylight: 'Day length',
  };
  $('#chart-title').textContent = chartTitles[state.chartMetric];

  renderAnnualChart(
    chartContainer,
    annualProfile(latitude, state.tilt),
    { metric: state.chartMetric, activeDay: state.day },
  );
}

function formatLatitude(value: number): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'N' : 'S'}`;
}

function formatLongitude(value: number): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'E' : 'W'}`;
}

tiltInput.addEventListener('input', () => {
  state.tilt = Number(tiltInput.value);
  update();
});

dayInput.addEventListener('input', () => {
  state.day = Number(dayInput.value);
  update();
});

document.querySelectorAll<HTMLButtonElement>('[data-tilt]').forEach((button) => {
  button.addEventListener('click', () => {
    state.tilt = Number(button.dataset.tilt);
    update();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => {
    state.speed = Number(button.dataset.speed);
    update();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    state.surfaceMode = button.dataset.mode as SurfaceMode;
    update();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach((button) => {
  button.addEventListener('click', () => {
    state.chartMetric = button.dataset.chart as ChartMetric;
    update();
  });
});

locationSelect.addEventListener('change', () => {
  const location = LOCATIONS.find((candidate) => candidate.id === locationSelect.value);
  if (!location) return;
  state.location = location;
  update();
});

playButton.addEventListener('click', () => {
  state.playing = !state.playing;
  update();
});

let lastTime = performance.now();
function tick(now: number): void {
  const elapsedSeconds = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state.playing) {
    state.day += elapsedSeconds * state.speed * 7;
    if (state.day > 365) state.day = ((state.day - 1) % 365) + 1;

    dayInput.value = String(Math.round(state.day));
    dayReadout.value = String(Math.round(state.day));
    dateReadout.textContent = `Day ${Math.round(state.day)}`;
    seasonReadout.textContent = seasonLabel(state.day);
    scene.setState({ day: state.day });
    updateLocationPanel();
  }

  requestAnimationFrame(tick);
}

update();
requestAnimationFrame(tick);
