import { effectiveHeatDepth, isIdealizedGeography, type AppClimateProfile } from '../physics/climateGeography';
import { isThermalReady, type ScientificTemperatureSource } from '../physics/temperatureModel';
import { updateHeatStorageControl } from './heatStorageNote';
import { t as tr, msg } from './i18n';

export interface ClimateStatusSnapshot {
    source: ScientificTemperatureSource;
    profile: AppClimateProfile;
    classicDepth: number;
    error: string;
    extrema: { minimum: number; maximum: number } | null;
}

/** Presentation only: scientific state and worker ownership remain with the host. */
export function renderClimateStatus(snapshot: ClimateStatusSnapshot): void {
    const { source, profile, classicDepth, error, extrema } = snapshot;
    const thermal = source.model === 'energy-balance';
    const ready = isThermalReady(source);
    const status = document.querySelector<HTMLElement>('#climate-status')!;
    const effectiveDepth = profile === 'earth-geography' ? null : effectiveHeatDepth(profile, classicDepth);
    status.setAttribute('data-status', error ? 'error' : ready ? 'ready' : 'loading');
    status.textContent = !thermal ? tr('Illustrative model · original fixed 28-day lag.') : error ? tr('Thermal worker unavailable. Retry or choose the illustrative model.')
        : ready ? profile === 'earth-geography' ? tr('Earth geography · 10° cells · periodic year solved.') : msg `Thermal EBM · ${effectiveDepth!} m effective heat storage · periodic year solved.` : tr('Calculating a repeating thermal year… Solar controls remain live.');
    document.querySelector<HTMLButtonElement>('#retry-climate')!.hidden = !error;
    updateHeatStorageControl(thermal, profile);
    const geographySelect = document.querySelector<HTMLSelectElement>('#climate-geography')!;
    geographySelect.value = profile;
    geographySelect.disabled = !thermal;
    document.querySelector<HTMLElement>('#geography-help')!.textContent = tr(profile === 'earth-geography'
        ? 'Earth geography uses 10° cell averages, not point land/ocean classification. Small islands, coastlines, lakes and ice are not separately resolved. The texture coastline is only a visual guide.'
        : 'Idealized land/ocean covers the whole model world with one material so the same latitude can be compared. It is not a real Earth map.');
    const warning = document.querySelector<HTMLElement>('#climate-warning')!;
    warning.hidden = !thermal || !ready || !(extrema && (extrema.minimum < -60 || extrema.maximum > 60));
    warning.textContent = tr('Large model extrapolation: linear radiation and fixed reflectivity omit ice, evaporation and climate feedbacks. Extreme temperatures are not predictions.');
    document.querySelector<HTMLElement>('#temperature-model-note')!.textContent = profile === 'earth-geography'
        ? tr('Natural Earth 4.1.0 · 18×36 / 10° cell-average educational EBM; fixed albedo, linear radiation, isotropic diffusion. Not local weather or city climate.') : thermal
        ? tr(isIdealizedGeography(profile)
            ? 'Idealized land/ocean contrast: one material covers the model world. Same sunlight and latitude transport; only effective heat capacity differs. This is not a real Earth map.'
            : 'Thermal EBM: experimental latitude-band temperature driven by daily-mean sunlight. Heat storage is uniform across the planet, not a local land/ocean map. Not calibrated to local weather.')
        : tr('Mean temperature estimate, not the daytime high. Original illustrative latitude-band model; not fitted to local weather.');
}
