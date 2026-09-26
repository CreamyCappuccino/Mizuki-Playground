import type { OrbitParameters } from '../physics/orbit';
import type { ThermalSolution } from '../physics/energyBalance';
import { geographyCounterpart, type ClimateProfile } from '../physics/climateGeography';
import type { TemperatureModel, TemperatureSource } from '../physics/temperatureModel';
import { ThermalClient } from './thermalClient';

export interface ClimateConfiguration {
  orbit: OrbitParameters;
  model: TemperatureModel;
  tilt: number;
  classicDepth: number;
  climateProfile: ClimateProfile;
  needsTiltReference: boolean;
}

type SourceKind = 'current' | 'tilt-reference' | 'geography-reference';

/** Owns thermal request provenance and the three solutions used by the UI. */
export class ClimateController {
  current: ThermalSolution | null = null;
  tiltReference: ThermalSolution | null = null;
  geographyReference: ThermalSolution | null = null;
  error = '';
  revision = 0;
  private key = '';
  private readonly client: ThermalClient;

  constructor(onChange: () => void) {
    this.client = new ThermalClient(
      () => new Worker(new URL('../physics/climate.worker.ts', import.meta.url), { type: 'module' }),
      reply => {
        if ('error' in reply) this.error = reply.error;
        else {
          this.current = reply.current;
          this.tiltReference = reply.reference;
          this.geographyReference = reply.geographyReference;
          this.error = '';
        }
        this.revision += 1;
        onChange();
      },
    );
  }

  sync(config: ClimateConfiguration): void {
    const contrast = geographyCounterpart(config.climateProfile) !== null;
    const key = [config.model, config.tilt, config.classicDepth, config.climateProfile,
      config.needsTiltReference, contrast, config.orbit.eccentricity, config.orbit.perihelion, config.orbit.axis].join(':');
    if (key === this.key) return;
    this.key = key;
    this.error = '';
    this.revision += 1;
    this.current = null;
    this.tiltReference = null;
    this.geographyReference = null;
    if (config.model === 'energy-balance') {
      this.client.request(config.tilt, config.classicDepth, config.needsTiltReference, config.orbit,
        config.climateProfile, contrast);
    } else this.client.cancel();
  }

  source(config: ClimateConfiguration, kind: SourceKind = 'current'): TemperatureSource {
    const counterpart = geographyCounterpart(config.climateProfile);
    if (kind === 'geography-reference' && !counterpart) return this.source(config, 'tilt-reference');
    return {
      orbit: config.orbit,
      model: config.model,
      tilt: kind === 'tilt-reference' ? 23.44 : config.tilt,
      depth: config.classicDepth,
      climateProfile: kind === 'geography-reference' ? counterpart! : config.climateProfile,
      solution: kind === 'current' ? this.current
        : kind === 'tilt-reference' ? this.tiltReference : this.geographyReference,
    };
  }

  retry(): void { this.key = ''; }
  dispose(): void { this.client.dispose(); }
}
