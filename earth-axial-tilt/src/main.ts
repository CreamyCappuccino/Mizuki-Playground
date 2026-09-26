import { CLASSIC_ORBIT, orbitKey, maximumSolarFactor, dayAtSeasonalLongitude, type OrbitParameters } from './physics/orbit';
import { OrbitWorkbench } from './ui/orbitWorkbench';
import { ExperimentWorkbench } from './ui/experimentWorkbench';
import { experimentOrbit, experimentLocation, type ExperimentState } from './experiments/state';
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
import { isThermalReady, isGeographySource, profileFromSource, temperatureFromSource, temperatureScale, type TemperatureModel, type ScientificTemperatureSource } from './physics/temperatureModel';
import { ClimateController, type ClimateConfiguration } from './ui/climateController';
import { effectiveHeatDepth, geographyCounterpart, isIdealizedGeography, type AppClimateProfile } from './physics/climateGeography';
import { GeographyController } from './ui/geographyController';
import { geographyTemperatureSource } from './physics/geographyTemperatureSource';
import { geographyCell, geographyMaterial } from './physics/geographySampling';
import { renderClimateStatus } from './ui/climateStatus';
import { dailyMeanInsolation, dayLengthHours, seasonLabel, solarDeclinationDeg, SOLAR_CONSTANT } from './physics/solar';
import { renderAnnualChart, updateChartDay, formatModelDate, type ChartMetric } from './ui/chart';
import { parseTiltInput } from './ui/tiltInput';
import { bindChartScrubber, LAST_SOLAR_MINUTE } from './ui/chartScrubber';
const applicationEvents = new AbortController();
let applicationDisposed = false;
let tickFrame = 0;
interface AppState {
    orbitA: OrbitParameters;
    orbitB: OrbitParameters;
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
    climateProfile: AppClimateProfile;
    heatDepth: number;
}
const state: AppState = {
    orbitA:{...CLASSIC_ORBIT},orbitB:{...CLASSIC_ORBIT},
    tilt: 23.44, day: 172, speed: 1, playback: 'paused', rotation: 0, period: 'year',
    surfaceMode: 'normal', chartMetric: 'temperature', location: DEFAULT_LOCATION,
    guides: true, compare: false, temperatureModel: 'energy-balance', climateProfile: 'classic', heatDepth: 10,
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
let comparePromise: Promise<CompareLab> | null = null;
let dormantTiltB=90;
let experimentRequest=0;
let workbench: ExperimentWorkbench | null = null;
let orbitWorkbench: OrbitWorkbench | null = null;
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
const climate = new ClimateController(() => update());
const geography = new GeographyController(() => update());
const geographyConditions = (tilt = state.tilt, orbit = state.orbitA) =>
    ({ tilt, orbit, retainedDepth: state.heatDepth as 2.5 | 10 | 50 });
function climateConfiguration(): ClimateConfiguration {
    return { orbit: state.orbitA, model: state.temperatureModel, tilt: state.tilt, classicDepth: state.heatDepth,
        climateProfile: state.climateProfile === 'earth-geography' ? 'classic' : state.climateProfile, needsTiltReference: state.compare || atlas.needsReference };
}
function temperatureSource(reference = false): ScientificTemperatureSource {
    if (state.climateProfile === 'earth-geography') return geography.source(reference ? 'reference' : 'A')
        ?? geographyTemperatureSource(geographyConditions(reference ? 23.44 : state.tilt), null);
    return climate.source(climateConfiguration(), reference ? 'tilt-reference' : 'current');
}
function geographyReferenceSource(): ScientificTemperatureSource { return climate.source(climateConfiguration(), 'geography-reference'); }
function syncThermalModel(): void {
    if (state.climateProfile === 'earth-geography') {
        climate.sync({ ...climateConfiguration(), model: 'illustrative' });
        geography.sync({ A: geographyConditions(), B: compareLab?.enabled ? geographyConditions(compareLab.tiltB, state.orbitB) : null,
            reference: atlas.needsReference || state.compare ? geographyConditions(23.44) : null });
    } else { geography.sync(null); climate.sync(climateConfiguration()); }
}
function temperatureAt(latitude: number, day: number): number | null {
    return temperatureFromSource(temperatureSource(), latitude, day, state.location.longitude);
}
function climateError(): string {
    const status = geography.status('A');
    return state.climateProfile === 'earth-geography' ? status?.status === 'error' ? status.error : status?.status === 'canceled' ? 'Canceled' : '' : climate.error;
}
function updateThermalStatus(): void {
    const source = temperatureSource();
    renderClimateStatus({ source: temperatureSource(), profile: state.climateProfile,
        classicDepth: state.heatDepth, error: climateError(), extrema: isGeographySource(source) ? source.geography : climate.current });
    const status = geography.status('A');
    $<HTMLButtonElement>('#cancel-geography').hidden = state.climateProfile !== 'earth-geography' || !status || !['queued','computing'].includes(status.status);
    if (state.climateProfile === 'earth-geography' && status?.status === 'canceled') {
        $('#climate-status').setAttribute('data-status','canceled');
        $('#climate-status').textContent = tr('Geography calculation canceled. Retry to resume.');
    }
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
    return { orbitB: state.orbitB, source: temperatureSource(), latitude: state.location.latitude, longitude: state.location.longitude,
        locationName: state.location.name, day: state.day, rotation: state.rotation, mode: state.surfaceMode, playback: state.playback };
}
function chartReferenceSource(): ScientificTemperatureSource {
    return compareLab?.enabled ? compareLab.sourceB
        : geographyCounterpart(state.climateProfile) ? geographyReferenceSource() : temperatureSource(true);
}
function chartComparison(): boolean { return state.compare || !!compareLab?.enabled || isIdealizedGeography(state.climateProfile); }
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
    const geographyReference=isIdealizedGeography(state.climateProfile);
    $<HTMLElement>('#profile-reference-control').hidden = state.period === 'day' || !!compareLab?.enabled || geographyReference;
    $<HTMLElement>('#profile-reference-note').hidden = state.period === 'day' || !!compareLab?.enabled || !geographyReference;
    $('#profile-period').textContent = state.period === 'year' ? tr('ANNUAL PROFILE') : tr('ONE SOLAR DAY');
    const source = temperatureSource();
    scene.setState({ orbit:state.orbitA, radiationMax:radiationMaximum(), tilt: state.tilt, day: state.day, mode: state.surfaceMode, location: state.location, guides: state.guides, rotation: state.rotation, temperatureModel: state.temperatureModel, climateProfile:state.climateProfile, heatDepth: state.heatDepth, thermal: climate.current, geography: isGeographySource(source) ? source : null });
    updateSurfaceLegend();
    updateReadouts();
}
function refreshExperimentLabel(): void {
    const mode = tr(state.playback === 'paused' ? 'Paused' : state.playback === 'year' ? 'Year experiment' : state.playback === 'day' ? 'Day experiment' : 'Coupled motion');
    $('#experiment-status').textContent = `${tr(compareLab?.enabled ? 'Compare Lab' : 'Single Earth')} · ${tr(canvas.dataset.sceneView === 'orbit' ? 'Orbit overview' : 'Earth close-up')} · ${mode}`;
}
function updateReadouts(): void {
    refreshExperimentLabel();
    workbench?.refresh();
    orbitWorkbench?.refresh();
    const atlasComparisonNote=$<HTMLElement>('#atlas-comparison-note');
    atlasComparisonNote.hidden = !compareLab?.enabled;
    atlasComparisonNote.textContent=tr(isIdealizedGeography(state.climateProfile)
        ? 'Compare Lab: this atlas shows Earth A. Its difference map compares the idealized surfaces, not Earth B.'
        : 'Compare Lab: this atlas shows Earth A. Its difference map always compares A with 23.44°, not with Earth B.');
    compareLab?.update(compareSnapshot());
    atlas.update({ source: temperatureSource(), reference: isIdealizedGeography(state.climateProfile) ? geographyReferenceSource() : temperatureSource(true),
        referenceKind:isIdealizedGeography(state.climateProfile)?'geography':'tilt', revision: climate.revision + geography.revision,
        day: state.day, latitude: state.location.latitude, longitude: state.location.longitude,
        locationName: state.location.name, error: climateError() });
    rotationInput.value = String(state.rotation);
    $('#rotation-readout').textContent = `${state.rotation.toFixed(1)}°`;
    dayInput.value = String(Math.floor(state.day));
    $('#day-readout').textContent = String(Math.floor(state.day));
    $('#date-readout').textContent = msg `${formatModelDate(state.day)} · Day ${Math.floor(state.day)}`;
    $('#season-label').textContent = tr(seasonLabel(state.day, state.orbitA));
    const { latitude, longitude } = state.location;
    $('#location-name').textContent = tr(state.location.name);
    $('#location-coords').textContent = `${formatCoordinate(latitude, 'N', 'S')} · ${formatCoordinate(longitude, 'E', 'W')}`;
    const daylight = dayLengthHours(latitude, state.day, state.tilt, state.orbitA);
    $('#metric-daylight').textContent = `${daylight.toFixed(1)} h`;
    $('#metric-daylight').setAttribute('title', daylight === 24 ? tr('Polar day') : daylight === 0 ? tr('Polar night') : tr('Geometric day length'));
    $('#metric-solar').textContent = `${Math.round(dailyMeanInsolation(latitude, state.day, state.tilt, state.orbitA))} W/m²`;
    const temperature = temperatureAt(latitude, state.day);
    $('#metric-temp').textContent = temperature === null ? (climateError() ? tr('Unavailable') : tr('Calculating…')) : `${temperature.toFixed(1)} °C`;
    const currentSource = temperatureSource();
    if (isGeographySource(currentSource) && isThermalReady(currentSource)) {
        const cell = geographyCell(currentSource.geography!.grid, latitude, longitude), material = geographyMaterial(currentSource.geography!, cell);
        $('#location-coords').textContent += msg ` · 10° cell center (${cell.latitude.toFixed(0)}°, ${cell.longitude.toFixed(0)}°) · land ${(material.landFraction * 100).toFixed(1)}% · ${material.effectiveDepth.toFixed(2)} m · cell average, not city climate`;
    }
    $('#metric-temp').setAttribute('data-model', state.temperatureModel);
    const declination = solarDeclinationDeg(state.day, state.tilt, state.orbitA);
    $('#metric-declination').textContent = `${declination >= 0 ? '+' : ''}${declination.toFixed(1)}°`;
    $('#subsolar-readout').textContent = formatCoordinate(declination, 'N', 'S');
    const sunLongitude = subsolarLongitude(state.day, state.tilt, state.rotation, state.orbitA);
    $('#subsolar-longitude').textContent = sunLongitude === null ? tr('Undefined at solar pole') : formatCoordinate(sunLongitude, 'E', 'W');
    const moment = solarMoment(latitude, longitude, state.day, state.tilt, state.rotation, state.orbitA);
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
        $('#chart-title').textContent = tr(climateError() || (compareLab?.enabled && compareLab.failed) ? 'Temperature unavailable' : 'Thermal temperature · calculating');
        $('#profile-summary').textContent = climateError() || (compareLab?.enabled && compareLab.failed) ? tr('Thermal model unavailable; no substitute temperatures are shown.') : tr('Solving heat storage, radiation and heat exchange between latitude bands…');
        updateChartSelection();
        return;
    }
    if (state.period === 'day') {
        const key = `day:${latitude}:${state.day}:${state.tilt}:${moment.solarHours === null}:${orbitKey(state.orbitA)}`;
        const hour = moment.solarHours ?? state.rotation / 15;
        if (key !== chartKey) {
            const daily = diurnalProfile(latitude, state.day, state.tilt, state.orbitA);
            const mean = dailyMeanInsolation(latitude, state.day, state.tilt, state.orbitA);
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
    const nextKey = `${latitude}:${longitude}:${state.tilt}:${orbitKey(state.orbitA)}:${thermalChart ? `${state.climateProfile}:${state.heatDepth}:${climate.revision}:${geography.revision}` : 'original'}`;
    if (nextKey !== profileKey) {
        profile = thermalChart ? profileFromSource(temperatureSource(), latitude, longitude)! : annualProfile(latitude, state.tilt, state.orbitA);
        profileKey = nextKey;
    }
    const nextReferenceKey = `${latitude}:${longitude}:${chartReferenceSource().tilt}:${orbitKey(chartReferenceSource().orbit)}:${chartReferenceSource().climateProfile}:${compareLab?.revision}:${thermalChart ? `${state.heatDepth}:${climate.revision}:${geography.revision}` : 'original'}`;
    if (chartComparison() && referenceKey !== nextReferenceKey) {
        reference = thermalChart ? profileFromSource(chartReferenceSource(), latitude, longitude)! : annualProfile(latitude, chartReferenceSource().tilt, chartReferenceSource().orbit);
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
        $('#profile-summary').textContent = msg `Annual mean ${mean.toFixed(1)} ${unit} · Daily-curve range ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)} ${unit}${chartComparison() ? tr(compareLab?.enabled ? ' · Dashed: Earth B' : isIdealizedGeography(state.climateProfile) ? ' · Dashed: other idealized surface' : ' · Dashed: Earth reference') : ''}${thermalChart ? state.climateProfile === 'earth-geography' ? tr(' · Earth geography / 10° cell') : msg ` · Thermal EBM / ${effectiveHeatDepth(state.climateProfile,state.heatDepth)} m effective` : ''}`;
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
    return solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation, state.orbitA).solarHours
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
            insolation: () => msg `${dailyMeanInsolation(state.location.latitude, state.day, state.tilt, state.orbitA).toFixed(1)} W/m² · daily mean`,
            daylight: () => msg `${dayLengthHours(state.location.latitude, state.day, state.tilt, state.orbitA).toFixed(1)} h · daylight`,
        }[state.chartMetric]();
        description = msg `${formatModelDate(state.day)} · Day ${Math.floor(state.day)} · ${selected}`;
        chartContainer.setAttribute('aria-label', tr('Annual profile: select model day'));
        $('#chart-help').textContent = tr('Click or drag to choose a day. Arrow keys: 1 day; Page keys: 30 days; Home / End: first / last day.');
    }
    else {
        const moment = solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation, state.orbitA);
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
            const moment = solarMoment(state.location.latitude, state.location.longitude, state.day, state.tilt, state.rotation, state.orbitA);
            state.rotation = moment.solarHours === null ? wrapRotation(value * 15)
                : rotationAtSolarHour(state.location.longitude, state.day, state.tilt, value, state.orbitA) ?? state.rotation;
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
function radiationMaximum():number {
    return SOLAR_CONSTANT*Math.max(maximumSolarFactor(state.orbitA),compareLab?.enabled?maximumSolarFactor(state.orbitB):1);
}
function updateSurfaceLegend(): void {
    const legend = $<HTMLElement>('#surface-legend');
    legend.hidden = state.surfaceMode === 'normal';
    if (state.surfaceMode === 'normal')
        return;
    const scale = {
        insolation: { title: tr('Daily mean solar · TOA · W/m²'), min: 0, max: radiationMaximum() },
        instant: { title: tr('Sun now · TOA · W/m²'), min: 0, max: radiationMaximum() },
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
        // Label precision is presentation-only; keep the underlying orbital scale exact.
        const label = Number(value.toFixed(1));
        span.textContent = `${state.surfaceMode === 'temperature' ? (value === scale.min ? '≤ ' : value === scale.max ? '≥ ' : '') : ''}${label}`;
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
        const rotation = rotationAtSolarHour(state.location.longitude, state.day, state.tilt, hour, state.orbitA);
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
$('#focus-location').addEventListener('click', () => { scene.focusLocation(); canvas.scrollIntoView({ block: 'center', behavior: 'auto' }); }, { signal: applicationEvents.signal });
$('#reset-view').addEventListener('click', () => scene.resetView(), { signal: applicationEvents.signal });
$('#temperature-model').addEventListener('change', event => {
    state.temperatureModel = (event.target as HTMLSelectElement).value as TemperatureModel;
    if(state.temperatureModel==='illustrative')state.climateProfile='classic';
    state.playback = 'paused';
    update();
}, { signal: applicationEvents.signal });
$('#heat-storage').addEventListener('change', event => {
    state.heatDepth = Number((event.target as HTMLSelectElement).value);
    state.playback = 'paused';
    update();
}, { signal: applicationEvents.signal });
$('#climate-geography').addEventListener('change', event => {
    state.climateProfile=(event.target as HTMLSelectElement).value as AppClimateProfile;
    state.playback='paused';profileKey='';referenceKey='';chartKey='';update();
}, { signal: applicationEvents.signal });
$('#play-coupled').addEventListener('click', () => { state.playback = togglePlayback(state.playback, 'coupled'); update(); }, { signal: applicationEvents.signal });
$('#retry-climate').addEventListener('click', () => { if(state.climateProfile === 'earth-geography')geography.resume('A');else climate.retry(); update(); }, { signal: applicationEvents.signal });
$('#cancel-geography').addEventListener('click', () => {geography.cancel('A');update();}, {signal:applicationEvents.signal});
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
    climate.dispose();
    geography.dispose();
    compareLab?.dispose();
    atlas.dispose();
    workbench?.dispose();
    orbitWorkbench?.dispose();
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
    button.addEventListener('click', () => { state.day = dayAtSeasonalLongitude((Number(button.dataset.seasonDay)-80)/365*360,state.orbitA); state.playback = 'paused'; update(); }, { signal: applicationEvents.signal });
});
async function ensureComparison(): Promise<CompareLab> {
    if(compareLab)return compareLab;
    if(comparePromise)return comparePromise;
    const button=$<HTMLButtonElement>('#compare-toggle');button.disabled=true;
    comparePromise=(async()=>{
        try {
            const { CompareLab: Comparison }=await import('./ui/compareLab');
            if(applicationDisposed)throw new Error('Application disposed');
            compareLab=new Comparison({
                change:()=>update(),
                tiltA:tilt=>{state.tilt=tilt;state.playback='paused';update();},
                day:day=>{state.day=day;state.playback='paused';update();},
                mode:mode=>{state.surfaceMode=mode;update();},
                playback:mode=>{state.playback=togglePlayback(state.playback,mode);update();},
                scene:value=>scene.setComparison(value),
                geographySource:()=>geography.source('B'),
                geographyError:()=>{const s=geography.status('B');return s?.status==='error'?s.error:s?.status==='canceled'?'Canceled':'';},
                geographyRetry:()=>geography.resume('B'),
            });
            compareLab.tiltB=dormantTiltB;
            compareLab.update(compareSnapshot());return compareLab;
        } catch(error) {
            button.dataset.loadError='true';button.textContent=tr('Reload to retry comparison');throw error;
        } finally {button.disabled=false;comparePromise=null;}
    })();
    return comparePromise;
}
$('#compare-toggle').addEventListener('click',async()=>{
    const request=++experimentRequest;
    const button=$<HTMLButtonElement>('#compare-toggle');
    if(button.dataset.loadError==='true'){location.reload();return;}
    try {
        const comparison=await ensureComparison();
        if(applicationDisposed||request!==experimentRequest)return;
        state.playback='paused';comparison.toggle();
    } catch { /* Explicit reload message remains on the comparison button. */ }
},{signal:applicationEvents.signal});

function captureExperiment(): ExperimentState {
    return {eccentricity:state.orbitA.eccentricity,perihelion:state.orbitA.perihelion,axisAzimuth:state.orbitA.axis,
        eccentricityB:state.orbitB.eccentricity,perihelionB:state.orbitB.perihelion,axisAzimuthB:state.orbitB.axis,
        tilt:state.tilt,tiltB:compareLab?.tiltB??dormantTiltB,day:state.day,rotation:state.rotation,
        latitude:state.location.latitude,longitude:state.location.longitude,dual:!!compareLab?.enabled,
        surfaceMode:state.surfaceMode,temperatureModel:state.temperatureModel,climateProfile:state.climateProfile,heatDepth:state.heatDepth as ExperimentState['heatDepth'],
        sceneView:canvas.dataset.sceneView==='orbit'?'orbit':'earth',period:state.period,chartMetric:state.chartMetric,
        reference:state.compare,guides:state.guides,speed:state.speed as ExperimentState['speed']};
}
async function applyExperiment(next:ExperimentState):Promise<boolean> {
    const request=++experimentRequest;
    if(next.dual)await ensureComparison();
    if(applicationDisposed||request!==experimentRequest)return false;
    // Nothing from the untrusted payload is assigned until validation and optional loading have succeeded.
    state.orbitA=experimentOrbit(next);state.orbitB=experimentOrbit(next,'B');
    state.tilt=next.tilt; state.day=next.day; state.rotation=next.rotation;state.speed=next.speed;
    state.playback='paused';state.location=experimentLocation(next);state.surfaceMode=next.surfaceMode;
    state.temperatureModel=next.temperatureModel;state.climateProfile=next.climateProfile;state.heatDepth=next.heatDepth;
    state.period=next.period;state.chartMetric=next.chartMetric;state.compare=next.reference;state.guides=next.guides;
    dormantTiltB=next.tiltB;compareLab?.configure(next.dual,next.tiltB);
    locationSelect.value=state.location.id;
    $<HTMLSelectElement>('#temperature-model').value=state.temperatureModel;
    $<HTMLSelectElement>('#climate-geography').value=state.climateProfile;
    $<HTMLSelectElement>('#heat-storage').value=String(state.heatDepth);
    $<HTMLInputElement>('#show-guides').checked=state.guides;
    $<HTMLInputElement>('#compare-earth').checked=state.compare;
    tiltHelp.textContent=tr(TILT_HELP);profileKey='';referenceKey='';chartKey='';
    // Fit a useful starting camera without loading a saved camera pose or changing personal display preferences.
    scene.setOrbitView(next.sceneView==='orbit');syncSceneView();
    update();
    if(next.sceneView==='orbit')scene.fitOrbit();else scene.focusLocation();
    return true;
}
// A newer direct user action wins over a slow dynamic import. Worker replies do not cancel requests.
for(const event of ['input','change','pointerdown','keydown'])document.addEventListener(event,()=>{experimentRequest++;},
    {capture:true,signal:applicationEvents.signal});
workbench=new ExperimentWorkbench({capture:captureExperiment,apply:applyExperiment,cancelPending:()=>{experimentRequest++;}});
orbitWorkbench=new OrbitWorkbench({
    get:()=>({a:state.orbitA,b:state.orbitB,dual:!!compareLab?.enabled,tiltA:state.tilt,tiltB:compareLab?.tiltB??dormantTiltB,day:state.day}),
    set:(side,orbit)=>{if(side==='A')state.orbitA=orbit;else state.orbitB=orbit;state.playback='paused';update();},
    day:day=>{state.day=day;state.playback='paused';update();},
});
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
void workbench.restoreHash();
tickFrame = requestAnimationFrame(tick);
