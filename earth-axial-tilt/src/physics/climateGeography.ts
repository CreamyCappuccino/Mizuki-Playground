export type ClimateProfile = 'classic' | 'idealized-land' | 'idealized-ocean';

export const CLIMATE_PROFILES = Object.freeze({
  classic: { effectiveDepth: null, counterpart: null },
  'idealized-land': { effectiveDepth: 2.5, counterpart: 'idealized-ocean' },
  'idealized-ocean': { effectiveDepth: 50, counterpart: 'idealized-land' },
} satisfies Record<ClimateProfile, {
  effectiveDepth: number | null;
  counterpart: ClimateProfile | null;
}>);

export function effectiveHeatDepth(profile: ClimateProfile, classicDepth: number): number {
  return CLIMATE_PROFILES[profile].effectiveDepth ?? classicDepth;
}

export function geographyCounterpart(profile: ClimateProfile): ClimateProfile | null {
  return CLIMATE_PROFILES[profile].counterpart;
}

export function isIdealizedGeography(profile: ClimateProfile): boolean {
  return profile !== 'classic';
}

export function climateProfileKey(profile: ClimateProfile, classicDepth: number): string {
  // Keep the retained Classic control in provenance even when an idealized
  // profile uses a fixed effective depth. Portable state can change it while
  // the material remains selected, and ThermalSolution.depth owns that value.
  return `${profile}:retained-${classicDepth}:effective-${effectiveHeatDepth(profile, classicDepth)}`;
}
