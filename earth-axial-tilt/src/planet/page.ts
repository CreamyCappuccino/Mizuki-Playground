import './lab.css';
import { getPlanetDefinition, type PlanetId } from './definitions';
import { daylightHours, planetaryMomentAtSeason, solarDeclinationDeg, yearSolarDays } from './astronomy';
import { DEFAULT_PLANET_STATE, decodePlanetState, encodePlanetState, planetShareURL, type PlanetLabState } from './state';
import { planetMessage, type PlanetLanguage, type PlanetMessageKey } from './i18n';

const q = <T extends HTMLElement>(selector: string): T => {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error('Missing Planet Lab element: ' + selector);
  return node as T;
};

const worldA = q<HTMLSelectElement>('#pl-world-a');
const worldB = q<HTMLSelectElement>('#pl-world-b');
const season = q<HTMLInputElement>('#pl-season');
const latitude = q<HTMLInputElement>('#pl-latitude');
const language = q<HTMLSelectElement>('#pl-language');
const large = q<HTMLInputElement>('#pl-large');
const shareURL = q<HTMLInputElement>('#pl-url');
const copy = q<HTMLButtonElement>('#pl-copy');
const status = q<HTMLDivElement>('#pl-status');
const shell = q<HTMLDivElement>('#pl-shell');

let lang: PlanetLanguage = localStorage.getItem('planet-lab-language') === 'ja' ? 'ja' : 'en';
let state: PlanetLabState = DEFAULT_PLANET_STATE;

const decoded = decodePlanetState(location.hash);
if (decoded.status === 'ok') state = decoded.state;

function metric(label: string, value: string): string {
  return '<div class="pl-metric"><span>' + label + '</span><strong>' + value + '</strong></div>';
}

function renderWorld(selector: string, id: PlanetId): void {
  const card = q<HTMLElement>(selector);
  const planet = getPlanetDefinition(id);
  const moment = planetaryMomentAtSeason(planet, state.seasonalLongitudeDeg);
  const declination = solarDeclinationDeg(planet, state.seasonalLongitudeDeg);
  const daylight = daylightHours(planet, state.latitudeDeg, state.seasonalLongitudeDeg);
  const metrics = card.querySelector('.pl-metrics');
  const capability = card.querySelector('.pl-capability');
  const heading = card.querySelector('h2');
  if (!(metrics instanceof HTMLElement) || !(capability instanceof HTMLElement) || !(heading instanceof HTMLElement))
    throw new Error('Planet card structure missing.');

  heading.textContent = planet.name;
  metrics.innerHTML =
    metric(planetMessage(lang, 'distance'), moment.distanceAU.toFixed(4) + ' AU') +
    metric(planetMessage(lang, 'flux'), moment.irradianceWm2.toFixed(1) + ' W/m²') +
    metric(planetMessage(lang, 'declination'), declination.toFixed(2) + '°') +
    metric(planetMessage(lang, 'daylight'), daylight.toFixed(2) + ' h') +
    metric(planetMessage(lang, 'year'), planet.orbit.yearEarthDays.toFixed(2) + ' Earth d · ' + yearSolarDays(planet).toFixed(2) + ' ' + planetMessage(lang, 'sols')) +
    metric(planetMessage(lang, 'elapsed'), moment.elapsedEarthDays.toFixed(2) + ' Earth d · ' + moment.elapsedSolarDays.toFixed(2) + ' ' + planetMessage(lang, 'sols')) +
    metric(planetMessage(lang, 'speed'), moment.speedRatio.toFixed(3) + '×');

  const capabilityText =
    planet.climate.kind === 'earth-existing'
      ? planetMessage(lang, 'earthClimate')
      : planetMessage(lang, 'noMarsClimate');
  capability.innerHTML = '<strong>' + planetMessage(lang, 'climate') + '</strong><br>' + capabilityText;
}

function currentState(): PlanetLabState {
  const next: PlanetLabState = {
    version: 1,
    worldA: worldA.value as PlanetId,
    worldB: worldB.value as PlanetId,
    seasonalLongitudeDeg: Number(season.value),
    latitudeDeg: Number(latitude.value),
  };
  return next;
}

function applyState(next: PlanetLabState): void {
  state = next;
  worldA.value = state.worldA;
  worldB.value = state.worldB;
  season.value = String(state.seasonalLongitudeDeg);
  latitude.value = String(state.latitudeDeg);
}

function translate(): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-pl]').forEach((node) => {
    const key = node.dataset.pl as PlanetMessageKey | undefined;
    if (key) node.textContent = planetMessage(lang, key);
  });
}

function render(): void {
  state = currentState();
  renderWorld('#pl-card-a', state.worldA);
  renderWorld('#pl-card-b', state.worldB);
  const hash = encodePlanetState(state);
  if (location.hash !== hash) history.replaceState(null, '', hash);
  shareURL.value = planetShareURL(location.href, state);
}

function safeRender(): void {
  try {
    render();
    status.textContent = '';
  } catch {
    status.textContent = lang === 'ja' ? '値を確認してください。' : 'Check the entered values.';
  }
}

for (const input of [worldA, worldB, season, latitude]) input.addEventListener('input', safeRender);
document.querySelectorAll<HTMLButtonElement>('[data-season]').forEach((button) => {
  button.addEventListener('click', () => {
    season.value = button.dataset.season ?? '0';
    safeRender();
  });
});

language.value = lang;
language.addEventListener('change', () => {
  lang = language.value === 'ja' ? 'ja' : 'en';
  localStorage.setItem('planet-lab-language', lang);
  translate();
  safeRender();
});
large.addEventListener('change', () => shell.classList.toggle('large', large.checked));
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareURL.value);
    status.textContent = planetMessage(lang, 'copied');
  } catch {
    status.textContent = planetMessage(lang, 'copyFailed');
  }
});

applyState(state);
translate();
render();
