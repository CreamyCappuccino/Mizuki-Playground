import { PLANETS, type PlanetId } from './definitions';
import { DEFAULT_EXPLORER,validateExplorer,type ExplorerState } from './explorerState';
import { worldDefinition,seasonSeries } from './geometry';
import { planetaryMomentAtSeason } from './astronomy';

export const PLANET_ORDER: readonly PlanetId[] = Object.freeze(['earth','mars','uranus','mercury']);
export type RecipeId='sideways'|'mars'|'equal'|'clocks'|'distance';
export function comparisonRecipe(id:RecipeId):ExplorerState {
  const base=validateExplorer(DEFAULT_EXPLORER);
  switch(id){
    case 'sideways': return validateExplorer({...base,a:{id:'earth',tilt:90}});
    case 'mars': return validateExplorer({...base,b:{id:'mars',tilt:null},latitude:25});
    case 'equal': return validateExplorer({...base,b:{id:'earth',tilt:null}});
    case 'clocks': return validateExplorer({...base,clock:'elapsed',days:365,latitude:25});
    case 'distance': return validateExplorer({...base,a:{id:'earth',tilt:0},b:{id:'mercury',tilt:0},latitude:0});
    default: throw new RangeError('Unknown question.');
  }
}
export function planetSummary(id:PlanetId) {
  const p=PLANETS[id];if(!p)throw new RangeError('Unknown planet.');
  const a=p.orbit.semiMajorAxisAU,e=p.orbit.eccentricity;
  return {id,tilt:p.rotation.obliquityDeg,eccentricity:e,yearDays:p.orbit.yearEarthDays,
    siderealHours:p.rotation.siderealDayHours,meanSolarHours:p.rotation.solarDayHours,
    perihelionAU:a*(1-e),aphelionAU:a*(1+e),
    maximumDeclinationDeg:Math.asin(Math.sin(p.rotation.obliquityDeg*Math.PI/180))*180/Math.PI,
    annualRayNormalMean:1361/(a*a*Math.sqrt(1-e*e)),climate:p.climate.kind};
}
/** 181 seasonal-angle rows per world. Neither the row spacing nor a simple row
 * mean represents uniform elapsed time. All state and output numbers are validated. */
export function explorerCSV(settings:ExplorerState):string {
  const s=validateExplorer(settings);
  const lines=['world,planet,tilt_deg,latitude_deg,seasonal_longitude_deg,phase_earth_days,distance_au,ray_normal_toa_wm2,frozen_lit_fraction,frozen_rotation_mean_toa_wm2'];
  for(const side of ['a','b'] as const){const p=worldDefinition(s[side]);for(const x of seasonSeries(p,s.latitude)){
    const m=planetaryMomentAtSeason(p,x.ls);
    const values=[p.rotation.obliquityDeg,s.latitude,x.ls,m.elapsedEarthDays,m.distanceAU,m.irradianceWm2,x.fraction,x.mean];
    if(values.some(v=>!Number.isFinite(v)))throw new RangeError('Nonfinite export.');
    lines.push([side.toUpperCase(),p.id,...values].join(','));
  }}
  return lines.join('\n')+'\n';
}
export function galleryCSV():string {
  const rows=['planet,tilt_deg,eccentricity,orbital_earth_days,sidereal_earth_hours,mean_solar_earth_hours,perihelion_au,aphelion_au,annual_ray_normal_toa_wm2,climate_capability'];
  for(const id of PLANET_ORDER){const x=planetSummary(id);rows.push([id,x.tilt,x.eccentricity,x.yearDays,x.siderealHours,x.meanSolarHours,x.perihelionAU,x.aphelionAU,x.annualRayNormalMean,x.climate].join(','));}
  return rows.join('\n')+'\n';
}
