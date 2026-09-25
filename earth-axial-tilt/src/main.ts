import type { CompareLab } from './ui/compareLab';
import { bindContextHelp } from './ui/contextHelp';
import { t as tr, msg, initLanguageControl, onLanguageChange, solarClockLabel } from './ui/i18n';
import { bindViewControls } from './ui/viewControls';
import { LazyAtlas } from './ui/lazyAtlas';
import { bindReleaseControls } from './ui/releaseControls';
import { solarMoment, subsolarLongitude, formatSolarClock, rotationAtSolarHour, wrapRotation, diurnalProfile } from './physics/diurnal';
import { renderDayChart, updateSolarCursor } from './ui/dayChart';
import { advanceSimulation, togglePlayback, type Playback } from './ui/playback';
import './style.css';
import { DEFAULT_LOCATION, LOCATIONS, type LocationPreset } from './data/locations';
import { EarthScene, type SurfaceMode } from './scene/EarthScene';
import { annualProfile, type AnnualPoint } from './physics/climate';
import { type ThermalSolution } from './physics/energyBalance';
import { isThermalReady, profileFromSource, temperatureFromSource, temperatureScale, type TemperatureModel, type TemperatureSource } from './physics/temperatureModel';
import { ThermalClient } from './ui/thermalClient';
import { dailyMeanInsolation, dayLengthHours, seasonLabel, solarDeclinationDeg, SOLAR_CONSTANT } from './physics/solar';
import { renderAnnualChart, updateChartDay, formatModelDate, type ChartMetric } from './ui/chart';
import { parseTiltInput } from './ui/tiltInput';
import { bindChartScrubber, LAST_SOLAR_MINUTE } from './ui/chartScrubber';
const applicationEvents = new AbortController();
let applicationDisposed = false;
let tickFrame = 0;
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
    temperatureModel: TemperatureModel;
    heatDepth: number;
}
const state: AppState = {
    tilt: 23.44, day: 172, speed: 1, playback: 'paused', rotation: 0, period: 'year',
    surfaceMode: 'normal', chartMetric: 'temperature', location: DEFAULT_LOCATION,
    guides: true, compare: false, temperatureModel: 'energy-balance', heatDepth: 10,
};
const $ = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element)
        throw new Error(`Missing required element: ${selector}`);
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
}
catch {
    textSize.value = 'comfortable';
}
document.documentElement.dataset.textSize = textSize.value;
const disposeLanguageControl = initLanguageControl();
const TILT_HELP = '0–90° · Enter or leave the field to apply.';
let compareLab: CompareLab | null = null;
let compareLoading = false;
const scene = new EarthScene(canvas, {
    onLocationPick: (location) => {
        state.location = location;
        locationSelect.value = 'custom';
        update();
    },
});
const disposeView = bindViewControls({ quality: value => scene.setQuality(value), lights: value => scene.setNightLights(value), refresh: () => scene.refreshView() });
const disposeRelease = bindReleaseControls(() => scene.refreshView());
const sceneView = $<HTMLSelectElement>('#scene-view');
const syncSceneView = () => {
    sceneView.value = canvas.dataset.sceneView ?? 'earth';
    $<HTMLElement>('#orbit-toolbar').hidden = sceneView.value !== 'orbit';
    refreshExperimentLabel();
};
sceneView.addEventListener('change', () => { scene.setOrbitView(sceneView.value === 'orbit'); syncSceneView(); }, { signal: applicationEvents.signal });
canvas.addEventListener('sceneviewchange', syncSceneView, { signal: applicationEvents.signal });
$('#fit-orbit').addEventListener('click', () => scene.fitOrbit(), { signal: applicationEvents.signal });
syncSceneView();
for (const location of LOCATIONS) {
    const option = new Option(tr(location.name), location.id);
    locationSelect.append(option);
}
const customOption = new Option(tr('Custom point — click the globe'), 'custom');
customOption.disabled = true;
locationSelect.append(customOption);
locationSelect.value = state.location.id;
let profileKey = '';
let profile: AnnualPoint[] = [];
let referenceKey = '';
let thermalKey = '';
let thermalRevision = 0;
let thermalSolution: ThermalSolution | null = null;
let thermalReference: ThermalSolution | null = null;
let thermalError = '';
const thermalClient = new ThermalClient(() => new Worker(new URL('./physics/climate.worker.ts', import.meta.url), { type: 'module' }), reply => {
    if ('error' in reply)
        thermalError = reply.error;
    else {
        thermalSolution = reply.current;
        thermalReference = reply.reference;
        thermalError = '';
    }
    thermalRevision += 1;
    update();
});
function temperatureSource(reference = false): TemperatureSource {
    return { model: state.temperatureModel, tilt: reference ? 23.44 : state.tilt, depth: state.heatDepth,
        solution: reference ? thermalReference : thermalSolution };
}
function syncThermalModel(): void {
    const compare = state.compare || atlas.needsReference;
    const key = `${state.temperatureModel}:${state.tilt}:${state.heatDepth}:${compare}`;
    if (key === thermalKey)
        return;
    thermalKey = key;
    thermalError = '';
    thermalRevision += 1;
    thermalSolution = null;
    thermalReference = null;
    if (state.temperatureModel === 'energy-balance')
        thermalClient.request(state.tilt, state.heatDepth, compare);
    else
        thermalClient.cancel();
}
function temperatureAt(latitude: number, day: number): number | null {
    return temperatureFromSource(temperatureSource(), latitude, day);
}
function updateThermalStatus(): void {
    const thermal = state.temperatureModel === 'energy-balance';
    const ready = isThermalReady(temperatureSource());
    const status = $('#climate-status');
    status.setAttribute('data-status', thermalError ? 'error' : ready ? 'ready' : 'loading');
    status.textContent = !thermal ? tr('Illustrative model · original fixed 28-day lag.') : thermalError ? tr('Thermal worker unavailable. Retry or choose the illustrative model.')
        : ready ? msg `Thermal EBM · ${state.heatDepth} m equivalent heat storage · periodic year solved.` : tr('Calculating a repeating thermal year… Solar controls remain live.');
    $<HTMLButtonElement>('#retry-climate').hidden = !thermalError;
    $<HTMLSelectElement>('#heat-storage').disabled = !thermal;
    const warning = $<HTMLElement>('#climate-warning');
    warning.hidden = !thermal || !ready || !(thermalSolution!.minimum < -60 || thermalSolution!.maximum > 60);
    warning.textContent = tr('Large model extrapolation: linear radiation and fixed reflectivity omit ice, evaporation and climate feedbacks. Extreme temperatures are not predictions.');
    $('#temperature-model-note').textContent = thermal
        ? tr('Thermal EBM: experimental latitude-band temperature driven by daily-mean sunlight. Heat storage is uniform across the planet, not a local land/ocean map. Not calibrated to local weather.') : tr('Mean temperature estimate, not the daytime high. Original illustrative latitude-band model; not fitted to local weather.');
}
let reference: AnnualPoint[] = [];
let chartKey = '';
const atlas = new LazyAtlas({
    onOpen: () => { state.playback = 'paused'; update(); },
    onSettings: () => update(),
    onSelect: (day, latitude) => {
        state.playback = 'paused';
        state.day = day;
        if (Math.abs(latitude - state.location.latitude) > 1e-9) {
            state.location = { id: 'custom', name: 'Custom latitude', latitude, longitude: state.location.longitude };
            locationSelect.value = 'custom';
        }
        update();
    },
    onTilt: tilt => { state.tilt = tilt; state.playback = 'paused'; update(); },
    onHeat: depth => {
        state.heatDepth = depth;
        state.playback = 'paused';
        $<HTMLSelectElement>('#heat-storage').value = String(depth);
        update();
    },
    onFocus: () => scene.focusLocation(),
});
function compareSnapshot() {
    return { source: temperatureSource(), latitude: state.location.latitude, longitude: state.location.longitude,
        locationName: state.location.name, day: state.day, rotation: state.rotation, mode: state.surfaceMode, playback: state.playback };
}
function chartReferenceSource(): TemperatureSource { return compareLab?.enabled ? compareLab.sourceB : temperatureSource(true); }
function chartComparison(): boolean { return state.compare || !!compareLab?.enabled; }
function update(): void {
    syncThermalModel();
    updateThermalStatus();
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
    playButton.textContent = state.playback === 'year' ? tr('❚❚ Pause year') : tr('▶ Play year');
    playButton.setAttribute('aria-pressed', String(state.playback === 'year'));
    playDayButton.textContent = state.playback === 'day' ? tr('❚❚ Pause day') : tr('▶ Play day');
    playDayButton.setAttribute('aria-pressed', String(state.playback === 'day'));
    $('#play-coupled').textContent = tr(state.playback === 'coupled' ? 'Pause coupled motion' : 'Coupled motion');
    $('#play-coupled').setAttribute('aria-pressed', String(state.playback === 'coupled'));
    $('#play-coupled').classList.toggle('active', state.playback === 'coupled');
    $('#chart-buttons').toggleAttribute('hidden', state.period === 'day');
    document.querySelector<HTMLElement>('.compare-control')!.hidden = state.period === 'day' || !!compareLab?.enabled;
    $('#profile-period').textContent = state.period === 'year' ? tr('ANNUAL PROFILE') : tr('ONE SOLAR DAY');
    scene.setState({ tilt: state.tilt, day: state.day, mode: state.surfaceMode, location: state.location, guides: state.guides, rotation: state.rotation, temperatureModel: state.temperatureModel, heatDepth: state.heatDepth, thermal: thermalSolution });
    updateSurfaceLegend();
    updateReadouts();
}
function refreshExperimentLabel(): void {
    const mode = tr(state.playback === 'paused' ? 'Paused' : state.playback === 'year' ? 'Year experiment' : state.playback === 'day' ? 'Day experiment' : 'Coupled motion');
    $('#experiment-status').textContent = `${tr(compareLab?.enabled ? 'Compare Lab' : 'Single Earth')} · ${tr(canvas.dataset.sceneView === 'orbit' ? 'Orbit overview' : 'Earth close-up')} · ${mode}`;
}
function updateReadouts(): void {
    refreshExperimentLabel();
    $<HTMLElement>('#atlas-comparison-note').hidden = !compareLab?.enabled;
    compareLab?.update(compareSnapshot());
    atlas.update({ source: temperatureSource(), reference: temperatureSource(true), revision: thermalRevision,
        day: state.day, latitude: state.location.latitude, longitude: state.location.longitude,
        locationName: state.location.name, error: thermalError });
    rotationInput.value = String(state.rotation);
    $('#rotation-readout').textContent = `${state.rotation.toFixed(1)}°`;
    dayInput.value = String(Math.floor(state.day));
    $('#day-readout').textContent = String(Math.floor(state.day));
    $('#date-readout').textContent = msg `${formatModelDate(state.day)} · Day ${Math.floor(state.day)}`;
    $('#season-label').textContent = tr(seasonLabel(state.day));
    const { latitude, longitude } = state.location;
    $('#location-name').textContent = tr(state.location.name);
    $('#location-coords').textContent = `${formatCoordinate(latitude, 'N', 'S')} · ${formatCoordinate(longitude, 'E', 'W')}`;
    const daylight = dayLengthHours(latitude, state.day, state.tilt);
    $('#metric-daylight').textContent = `${daylight.toFixed(1)} h`;
    $('#metric-daylight').setAttribute('title', daylight === 24 ? tr('Polar day') : daylight === 0 ? tr('Polar night') : tr('Geometric day length'));
    $('#metric-solar').textContent = `${Math.round(dailyMeanInsolation(latitude, state.day, state.tilt))} W/m²`;
    const temperature = temperatureAt(latitude, state.day);
    $('#metric-temp').textContent = temperature === null ? (thermalError ? tr('Unavailable') : tr('Calculating…')) : `${temperature.toFixed(1)} °C`;
    $('#metric-temp').setAttribute('data-model', state.temperatureModel);
    const declination = solarDeclinationDeg(state.day, state.tilt);
    $('#metric-declination').textContent = `${declination >= 0 ? '+' : ''}${declination.toFixed(1)}°`;
    $('#subsolar-readout').textContent = formatCoordinate(declination, 'N', 'S');
    const sunLongitude = subsolarLongitude(state.day, state.tilt, state.rotation);
    $('#subsolar-longitude').textContent = sunLongitude === null ? tr('Undefined at solar pole') : formatCoordinate(sunLongitude, 'E', 'W');
    const moment = solarMoment(latitude, longitude, state.day, state.tilt, state.rotation);
    $('#metric-solar-time').textContent = solarClockLabel(formatSolarClock(moment.solarHours));
    $('#metric-elevation').textContent = `${moment.elevationDeg.toFixed(1)}°`;
    $('#metric-instant').textContent = `${Math.round(moment.insolation)} W/m²`;
    const status = $('#illumination-state');
    status.textContent = { day: tr('Daytime'), night: tr('Night'), horizon: tr('On the horizon') }[moment.illumination];
    status.setAttribute('data-illumination', moment.illumination);
    for (const hour of ['noon', 'midnight']) {
        const button = $<HTMLButtonElement>(`#${hour}-here`);
        button.disabled = moment.solarHours === null;
        button.title = button.disabled ? tr('Solar meridian is undefined at this geometry.') : tr('Use local apparent solar time, not clock time.');
    }
    const pendingTemperature = state.period === 'year' && state.chartMetric === 'temperature' &&
        (!isThermalReady(temperatureSource()) || (chartComparison() && !isThermalReady(chartReferenceSource())));
    chartContainer.classList.toggle('thermal-pending', pendingTemperature);
    chartContainer.setAttribute('aria-busy', String(pendingTemperature));
    if (pendingTemperature) {
        if (chartKey !== 'pending') {
            chartContainer.replaceChildren();
            chartKey = 'pending';
        }
        $('#chart-title').textContent = tr(thermalError || (compareLab?.enabled && compareLab.failed) ? 'Temperature unavailable' : 'Thermal temperature · calculating');
        $('#profile-summary').textContent = thermalError || (compareLab?.enabled && compareLab.failed) ? tr('Thermal model unavailable; no substitute temperatures are shown.') : tr('Solving heat storage, radiation and heat exchange between latitude bands…');
        updateChartSelection();
        return;
    }
    if (state.period === 'day') {
        const key = `day:${latitude}:${state.day}:${state.tilt}:${moment.solarHours === null}`;
        const hour = moment.solarHours ?? state.rotation / 15;
        if (key !== chartKey) {
            const daily = diurnalProfile(latitude, state.day, state.tilt);
            const mean = dailyMeanInsolation(latitude, state.day, state.tilt);
            renderDayChart(chartContainer, daily, mean, hour, moment.solarHours !== null);
            $('#chart-title').textContent = tr('Instantaneous solar (TOA)');
            $('#profile-summary').textContent = msg `Dashed: daily mean ${mean.toFixed(1)} W/m² · Peak ${Math.max(...daily.map(p => p.insolation)).toFixed(1)} W/m² · ${moment.solarHours === null ? tr('Nominal rotation hours; no defined solar meridian.') : tr('Local solar time, not civil time.')}`;
            chartKey = key;
        }
        else
            updateSolarCursor(chartContainer, hour);
        updateChartSelection();
        return;
    }
    const thermalChart = state.chartMetric === 'temperature' && state.temperatureModel === 'energy-balance';
    const nextKey = `${latitude}:${state.tilt}:${thermalChart ? `${state.heatDepth}:${thermalRevision}` : 'original'}`;
    if (nextKey !== profileKey) {
        profile = thermalChart ? profileFromSource(temperatureSource(), latitude)! : annualProfile(latitude, state.tilt);
        profileKey = nextKey;
    }
    const nextReferenceKey = `${latitude}:${chartReferenceSource().tilt}:${compareLab?.revision}:${thermalChart ? `${state.heatDepth}:${thermalRevision}` : 'original'}`;
    if (chartComparison() && referenceKey !== nextReferenceKey) {
        reference = thermalChart ? profileFromSource(chartReferenceSource(), latitude)! : annualProfile(latitude, chartReferenceSource().tilt);
        referenceKey = nextReferenceKey;
    }
    const nextChartKey = `year:${profileKey}:${state.chartMetric}:${chartComparison()}:${nextReferenceKey}`;
    if (nextChartKey !== chartKey) {
        const titles: Record<ChartMetric, string> = {
            temperature: state.temperatureModel === 'energy-balance' ? tr('Thermal temperature · daily forcing') : tr('Daily-mean temperature estimate'), insolation: tr('Daily mean solar (TOA)'), daylight: tr('Day length'),
        };
        $('#chart-title').textContent = titles[state.chartMetric];
        renderAnnualChart(chartContainer, profile, { metric: state.chartMetric, activeDay: state.day, reference: chartComparison() ? reference : undefined });
        const values = profile.map((point) => point[state.chartMetric]);
        const unit = { temperature: '°C', insolation: 'W/m²', daylight: 'h' }[state.chartMetric];
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        $('#profile-summary').textContent = msg `Annual mean ${mean.toFixed(1)} ${unit} · Daily-curve range ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)} ${unit}${chartComparison() ? tr(compareLab?.enabled ? ' · Dashed: Earth B' : ' · Dashed: Earth reference') : ''}${thermalChart ? msg ` · Thermal EBM / ${state.heatDepth} m` : ''}`;
        if (thermalChart) {
            const warmest = Math.max(...values);
            if (warmest - Math.min(...values) > 0.05)
                $('#profile-summary').textContent += msg ` · Warmest: ${formatModelDate(values.indexOf(warmest) + 1)}`;
        }
        chartKey = nextChartKey;
    }
    else {
        updateChartDay(chartContainer, state.day);
    }
    updateChartSelection();
}
function selectedChartValue(): number {
    if (state.period === 'year')
        return Math.min(365, Math.max(1, state.day));
    return solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation).solarHours
        ?? state.rotation / 15;
}
function updateChartSelection(): void {
    const value = selectedChartValue();
    let description: string;
    if (state.period === 'year') {
        const selected = {
            temperature: () => {
                const t = temperatureAt(state.location.latitude, state.day);
                return t === null ? tr('Temperature calculating / unavailable') : `${t.toFixed(1)} °C · ${state.temperatureModel === 'energy-balance' ? tr('thermal EBM') : tr('daily-mean estimate')}`;
            },
            insolation: () => msg `${dailyMeanInsolation(state.location.latitude, state.day, state.tilt).toFixed(1)} W/m² · daily mean`,
            daylight: () => msg `${dayLengthHours(state.location.latitude, state.day, state.tilt).toFixed(1)} h · daylight`,
        }[state.chartMetric]();
        description = msg `${formatModelDate(state.day)} · Day ${Math.floor(state.day)} · ${selected}`;
        chartContainer.setAttribute('aria-label', tr('Annual profile: select model day'));
        $('#chart-help').textContent = tr('Click or drag to choose a day. Arrow keys: 1 day; Page keys: 30 days; Home / End: first / last day.');
    }
    else {
        const moment = solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation);
        const nominal = moment.solarHours === null;
        description = msg `${formatSolarClock(value)} · ${nominal ? tr('nominal rotation time') : tr('local solar time')} · ${moment.insolation.toFixed(1)} W/m² now`;
        chartContainer.setAttribute('aria-label', nominal ? tr('Daily profile: select nominal rotation time') : tr('Daily profile: select local solar time'));
        $('#chart-help').textContent = tr('Click or drag to choose a time. Arrow keys: 15 min; Page keys: 1 hour; Home / End: 00:00 / 23:59. Swipe vertically to scroll.');
    }
    chartContainer.setAttribute('aria-valuemin', state.period === 'year' ? '1' : '0');
    chartContainer.setAttribute('aria-valuemax', state.period === 'year' ? '365' : String(LAST_SOLAR_MINUTE));
    chartContainer.setAttribute('aria-valuenow', String(Math.min(value, state.period === 'year' ? 365 : LAST_SOLAR_MINUTE)));
    chartContainer.setAttribute('aria-valuetext', description);
    $('#chart-selection').textContent = description;
}
const disposeScrubber = bindChartScrubber(chartContainer, {
    getPeriod: () => state.period,
    getValue: selectedChartValue,
    onSelect: (value) => {
        state.playback = 'paused';
        if (state.period === 'year')
            state.day = value;
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
    if (box.width <= 0 || box.height <= 0 || key === lastChartSize)
        return;
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
    try {
        localStorage.setItem('earth-lab:text-size', textSize.value);
    }
    catch { /* session-only preference */ }
    refreshChartSize();
}, { signal: applicationEvents.signal });
$('#jump-chart').addEventListener('click', () => {
    $('#profile-section').scrollIntoView({ block: 'start', behavior: 'auto' });
    chartContainer.focus({ preventScroll: true });
}, { signal: applicationEvents.signal });
function formatCoordinate(value: number, positive: string, negative: string): string {
    return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}
function updateSurfaceLegend(): void {
    const legend = $<HTMLElement>('#surface-legend');
    legend.hidden = state.surfaceMode === 'normal';
    if (state.surfaceMode === 'normal')
        return;
    const scale = {
        insolation: { title: tr('Daily mean solar · TOA · W/m²'), min: 0, max: SOLAR_CONSTANT },
        instant: { title: tr('Sun now · TOA · W/m²'), min: 0, max: SOLAR_CONSTANT },
        daylight: { title: tr('Geometric day length · h'), min: 0, max: 24 },
        temperature: { title: state.temperatureModel === 'energy-balance' ? tr('Daily-mean thermal EBM · °C') : tr('Daily-mean estimate · °C'), ...temperatureScale(state.temperatureModel) },
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
        const span = document.createElement('span');
        span.textContent = `${state.surfaceMode === 'temperature' ? (value === scale.min ? '≤ ' : value === scale.max ? '≥ ' : '') : ''}${value}`;
        return span;
    }));
}
function commitTilt(): void {
    const value = parseTiltInput(tiltNumber.value);
    if (value === null) {
        tiltHelp.textContent = tr('Enter a number from 0 to 90. Previous angle kept.');
        tiltNumber.value = String(state.tilt);
        tiltNumber.removeAttribute('aria-invalid');
        return;
    }
    state.tilt = value;
    tiltHelp.textContent = tr(TILT_HELP);
    update();
}
tiltNumber.addEventListener('input', () => {
    tiltNumber.setAttribute('aria-invalid', String(parseTiltInput(tiltNumber.value) === null));
}, { signal: applicationEvents.signal });
tiltNumber.addEventListener('change', commitTilt, { signal: applicationEvents.signal });
tiltNumber.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        commitTilt();
    }
    if (event.key === 'Escape') {
        tiltNumber.value = String(state.tilt);
        tiltNumber.removeAttribute('aria-invalid');
        tiltHelp.textContent = tr(TILT_HELP);
        tiltNumber.blur();
    }
}, { signal: applicationEvents.signal });
tiltInput.addEventListener('input', () => {
    state.tilt = Number(tiltInput.value);
    tiltHelp.textContent = tr(TILT_HELP);
    update();
}, { signal: applicationEvents.signal });
dayInput.addEventListener('input', () => { state.playback = 'paused'; state.day = Number(dayInput.value); update(); }, { signal: applicationEvents.signal });
document.querySelectorAll<HTMLButtonElement>('[data-tilt]').forEach((button) => {
    button.addEventListener('click', () => { state.tilt = Number(button.dataset.tilt); tiltHelp.textContent = tr(TILT_HELP); update(); }, { signal: applicationEvents.signal });
});
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => { state.speed = Number(button.dataset.speed); update(); }, { signal: applicationEvents.signal });
});
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => { state.surfaceMode = button.dataset.mode as SurfaceMode; update(); }, { signal: applicationEvents.signal });
});
document.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach((button) => {
    button.addEventListener('click', () => { state.chartMetric = button.dataset.chart as ChartMetric; update(); }, { signal: applicationEvents.signal });
});
locationSelect.addEventListener('change', () => {
    const location = LOCATIONS.find((candidate) => candidate.id === locationSelect.value);
    if (location) {
        state.location = location;
        update();
    }
}, { signal: applicationEvents.signal });
$<HTMLInputElement>('#show-guides').addEventListener('change', (event) => {
    state.guides = (event.target as HTMLInputElement).checked;
    update();
}, { signal: applicationEvents.signal });
$<HTMLInputElement>('#compare-earth').addEventListener('change', (event) => {
    state.compare = (event.target as HTMLInputElement).checked;
    update();
}, { signal: applicationEvents.signal });
playButton.addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'year'); update(); }, { signal: applicationEvents.signal });
playDayButton.addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'day'); update(); }, { signal: applicationEvents.signal });
rotationInput.addEventListener('input', () => {
    state.playback = 'paused';
    state.rotation = wrapRotation(Number(rotationInput.value));
    update();
}, { signal: applicationEvents.signal });
for (const [id, hour] of [['noon-here', 12], ['midnight-here', 0]] as const) {
    $<HTMLButtonElement>(`#${id}`).addEventListener('click', () => {
        const rotation = rotationAtSolarHour(state.location.longitude, state.day, state.tilt, hour);
        if (rotation === null)
            return;
        state.rotation = rotation;
        state.playback = 'paused';
        update();
    }, { signal: applicationEvents.signal });
}
document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(button => {
    button.addEventListener('click', () => { state.period = button.dataset.period as 'year' | 'day'; update(); }, { signal: applicationEvents.signal });
});
$('#focus-location').addEventListener('click', () => scene.focusLocation(), { signal: applicationEvents.signal });
$('#reset-view').addEventListener('click', () => scene.resetView(), { signal: applicationEvents.signal });
$('#temperature-model').addEventListener('change', event => {
    state.temperatureModel = (event.target as HTMLSelectElement).value as TemperatureModel;
    state.playback = 'paused';
    update();
}, { signal: applicationEvents.signal });
$('#heat-storage').addEventListener('change', event => {
    state.heatDepth = Number((event.target as HTMLSelectElement).value);
    state.playback = 'paused';
    update();
}, { signal: applicationEvents.signal });
$('#play-coupled').addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'coupled'); update(); }, { signal: applicationEvents.signal });
$('#retry-climate').addEventListener('click', () => { thermalKey = ''; update(); }, { signal: applicationEvents.signal });
window.addEventListener('pagehide', event => {
    if (event.persisted)
        return; // A bfcache page must remain resumable.
    applicationDisposed = true;
    cancelAnimationFrame(tickFrame);
    cancelAnimationFrame(resizeFrame);
    chartObserver.disconnect();
    disposeScrubber();
    disposeHelp();
    disposeView();
    disposeRelease();
    disposeLanguage();
    disposeLanguageControl();
    thermalClient.dispose();
    compareLab?.dispose();
    atlas.dispose();
    scene.dispose();
    applicationEvents.abort();
}, { signal: applicationEvents.signal });
let lastTime = performance.now();
let lastReadout = 0;
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); }, { signal: applicationEvents.signal });
function tick(now: number): void {
    if (applicationDisposed)
        return;
    const elapsedSeconds = (now - lastTime) / 1000;
    lastTime = now;
    if (state.playback !== 'paused' && !document.hidden) {
        const next = advanceSimulation(state.day, state.rotation, state.playback, elapsedSeconds, state.speed);
        state.day = next.day;
        state.rotation = next.rotation;
        scene.setState(state.playback === 'year' ? { day: state.day } : state.playback === 'coupled' ? { day: state.day, rotation: state.rotation } : { rotation: state.rotation });
        if (now - lastReadout >= 100) {
            updateReadouts();
            lastReadout = now;
        }
    }
    tickFrame = requestAnimationFrame(tick);
}
document.querySelectorAll<HTMLButtonElement>('[data-season-day]').forEach(button => {
    button.addEventListener('click', () => { state.day = Number(button.dataset.seasonDay); state.playback = 'paused'; update(); }, { signal: applicationEvents.signal });
});
$('#compare-toggle').addEventListener('click', async () => {
    if (compareLoading)
        return;
    const button = $<HTMLButtonElement>('#compare-toggle');
    if(button.dataset.loadError === 'true'){ location.reload(); return; }
    if (!compareLab) {
        compareLoading = true;
        button.disabled = true;
        try {
            const { CompareLab: Comparison } = await import('./ui/compareLab');
            if (applicationDisposed)
                return;
            compareLab = new Comparison({
                change: () => update(),
                tiltA: tilt => { state.tilt = tilt; state.playback = 'paused'; update(); },
                day: day => { state.day = day; state.playback = 'paused'; update(); },
                mode: mode => { state.surfaceMode = mode; update(); },
                playback: mode => { state.playback = togglePlayback(state.playback, mode); update(); },
                scene: value => scene.setComparison(value),
            });
            compareLab.update(compareSnapshot());
        }
        catch {
            button.dataset.loadError='true';button.textContent = tr('Reload to retry comparison');
            return;
        }
        finally {
            compareLoading = false;
            button.disabled = false;
        }
    }
    state.playback = 'paused';
    compareLab.toggle();
}, { signal: applicationEvents.signal });
const disposeHelp = bindContextHelp();
const disposeLanguage = onLanguageChange(() => {
    scene.refreshLanguage();
    for (const option of Array.from(locationSelect.options)) {
        const preset = LOCATIONS.find(item => item.id === option.value);
        option.textContent = tr(preset?.name ?? 'Custom point — click the globe');
    }
    profileKey = '';
    referenceKey = '';
    chartKey = '';
    lastChartSize = '';
    tiltHelp.textContent = tr(TILT_HELP);
    update();
});
update();
tickFrame = requestAnimationFrame(tick);
