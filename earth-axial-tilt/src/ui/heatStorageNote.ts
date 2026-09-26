import { isIdealizedGeography, type ClimateProfile } from '../physics/climateGeography';
import { t } from './i18n';

/** Distinguish the retained Classic control from the material actually being solved. */
export function updateHeatStorageControl(thermal: boolean, profile: ClimateProfile): void {
  const idealized = isIdealizedGeography(profile);
  const select = document.querySelector<HTMLSelectElement>('#heat-storage')!;
  const note = document.querySelector<HTMLElement>('#heat-retained-note')!;
  select.disabled = !thermal || idealized;
  note.hidden = !idealized;
  note.textContent = t('Classic value retained, currently unused. Effective storage: land 2.5 m / ocean 50 m equivalent.');
}
