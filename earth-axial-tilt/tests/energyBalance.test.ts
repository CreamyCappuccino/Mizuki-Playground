import { describe, expect, it } from 'vitest';
import { buildClimateGrid, EBM, heatTransport, planetaryAlbedo, sampleThermalTemperature as temperature, solveSeasonalClimate } from '../src/physics/energyBalance';
import { dailyMeanInsolation } from '../src/physics/solar';
import { temperatureEstimateC } from '../src/physics/climate';
import { isThermalReady, profileFromSource, temperatureFromSource, temperatureScale } from '../src/physics/temperatureModel';
import { ThermalClient, type ClimateWorker, type ThermalReply, type ThermalRequest } from '../src/ui/thermalClient';

const mixed = solveSeasonalClimate(23.44, 10);
const fast = solveSeasonalClimate(23.44, 2.5);
const slow = solveSeasonalClimate(23.44, 50);
const extreme = solveSeasonalClimate(90, 10);
const profile = (solution: typeof mixed, latitude = 25.033) => Array.from({ length: 365 }, (_, i) => temperature(solution, latitude, i + 1));
const mean = (p: number[]) => p.reduce((a, b) => a + b, 0) / p.length;
const range = (p: number[]) => Math.max(...p) - Math.min(...p);

describe('seasonal energy balance', () => {
  it('covers the sphere and conserves transported energy', () => {
    const grid = buildClimateGrid();
    expect(grid.weight.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 12);
    const field = grid.x.map(x => 30 - 50 * x * x + 13 * Math.sin(7 * x));
    const transport = heatTransport(field, grid);
    expect(Math.abs(transport.reduce((sum, f, i) => sum + f * grid.weight[i], 0))).toBeLessThan(1e-9);
    expect(Array.from(heatTransport(grid.x.map(() => 15), grid)).every(x => x === 0)).toBe(true);
  });
  it('has no seasonal cycle at zero tilt and satisfies the stationary equation', () => {
    const solution = solveSeasonalClimate(0, 10), grid = buildClimateGrid();
    const row = solution.temperatures.slice(0, grid.x.length);
    const transport = heatTransport(row, grid);
    expect(range(profile(solution))).toBeLessThan(1e-8);
    for (let i = 0; i < grid.x.length; i += 1) {
      const residual = (1 - planetaryAlbedo(grid.x[i])) * dailyMeanInsolation(grid.latitude[i], 1, 0)
        - EBM.A - EBM.B * row[i] + transport[i];
      expect(Math.abs(residual)).toBeLessThan(1e-7);
    }
  });
  it('converges to a repeating year with independently checked global radiation balance', () => {
    const grid = buildClimateGrid();
    for (const solution of [mixed, fast, slow, extreme]) {
      expect(solution.periodicError).toBeLessThan(1e-6);
      expect(Math.abs(solution.energyResidual)).toBeLessThan(1e-5);
      let incoming = 0, outgoing = 0;
      for (let d = 0; d < 365; d += 1) for (let i = 0; i < grid.x.length; i += 1) {
        incoming += grid.weight[i] * (1 - planetaryAlbedo(grid.x[i])) * dailyMeanInsolation(grid.latitude[i], d + 1, solution.tilt);
        outgoing += grid.weight[i] * (EBM.A + EBM.B * solution.temperatures[d * grid.x.length + i]);
      }
      expect(Math.abs((incoming - outgoing) / 730)).toBeLessThan(0.005);
    }
  });
  it('respects hemispheric half-year symmetry, including extreme tilt', () => {
    for (const solution of [mixed, extreme]) for (const lat of [0, 25.033, 45, 80, 90]) {
      for (let day = 1; day < 365; day += 7) {
        expect(Math.abs(temperature(solution, lat, day) - temperature(solution, -lat, day + 182.5))).toBeLessThan(0.005);
      }
    }
  });
  it('reduces seasonal range and delays the peak when heat capacity increases', () => {
    const p = [fast, mixed, slow].map(s => profile(s));
    expect(range(p[0])).toBeGreaterThan(range(p[1]));
    expect(range(p[1])).toBeGreaterThan(range(p[2]));
    const peaks = p.map(v => v.indexOf(Math.max(...v)));
    expect(peaks[0]).toBeLessThan(peaks[1]); expect(peaks[1]).toBeLessThan(peaks[2]);
  });
  it('does not mistake thermal inertia for a change in annual-mean equilibrium', () => {
    for (const lat of [0, 25.033, 60, 90]) {
      expect(Math.abs(mean(profile(fast, lat)) - mean(profile(slow, lat)))).toBeLessThan(0.001);
    }
  });
  it('changes the annual-mean latitude distribution when obliquity changes', () => {
    expect(mean(profile(mixed, 0))).toBeGreaterThan(mean(profile(mixed, 90)));
    expect(mean(profile(extreme, 90))).toBeGreaterThan(mean(profile(extreme, 0)));
  });
  it('converges under both temporal and spatial refinement', () => {
    const finer = solveSeasonalClimate(90, 10, { bands: 180, stepsPerDay: 4 });
    for (const lat of [0, 25.033, 60, 90]) for (let day = 1; day < 365; day += 13) {
      expect(Math.abs(temperature(extreme, lat, day) - temperature(finer, lat, day))).toBeLessThan(0.2);
    }
  });
  it('stays finite without secretly clipping extreme temperatures to the legacy limits', () => {
    const solution = solveSeasonalClimate(90, 2.5);
    expect(solution.temperatures.every(Number.isFinite)).toBe(true);
    expect(solution.maximum).toBeGreaterThan(55);
    expect(temperature(solution, 90, 200)).toBeGreaterThan(100);
    for (const lat of [-90, 90]) for (const day of [-200, 0, 171.25, 365.999, 366, 999]) {
      expect(Number.isFinite(temperature(solution, lat, day))).toBe(true);
    }
  });
  it('interpolates continuously through the end of the repeating year', () => {
    expect(temperature(mixed, 25, 366)).toBe(temperature(mixed, 25, 1));
    expect(Math.abs(temperature(mixed, 25, 365.999999) - temperature(mixed, 25, 1.000001))).toBeLessThan(1e-5);
    expect(temperature(mixed, 25, 171.5)).toBeCloseTo((temperature(mixed, 25, 171) + temperature(mixed, 25, 172)) / 2, 10);
  });
  it('rejects invalid inputs rather than generating plausible-looking numbers', () => {
    for (const tilt of [-1, 91, NaN, Infinity]) expect(() => solveSeasonalClimate(tilt, 10)).toThrow();
    for (const depth of [0, 2, 51, NaN, Infinity]) expect(() => solveSeasonalClimate(23, depth)).toThrow();
    expect(() => buildClimateGrid(0)).toThrow(); expect(() => buildClimateGrid(90.5)).toThrow();
    expect(() => solveSeasonalClimate(23, 10, { stepsPerDay: 0 })).toThrow();
    expect(() => temperature(mixed, 91, 1)).toThrow(); expect(() => temperature(mixed, 25, NaN)).toThrow();
  });
});

describe('one source for temperature readouts, graphs and the globe', () => {
  it('preserves the original illustrative model exactly when explicitly selected', () => {
    const source = { model: 'illustrative', tilt: 23.44, depth: 10, solution: null } as const;
    expect(temperatureFromSource(source, 25.033, 172)).toBe(temperatureEstimateC(25.033, 172, 23.44));
    expect(temperatureScale('illustrative')).toEqual({ min: -65, max: 55 });
  });
  it('uses all 365 thermal samples and never substitutes stale data', () => {
    const source = { model: 'energy-balance', tilt: 23.44, depth: 10, solution: mixed } as const;
    const p = profileFromSource(source, 25.033)!;
    expect(p).toHaveLength(365);
    for (const point of p) expect(point.temperature).toBe(temperatureFromSource(source, 25.033, point.day));
    expect(isThermalReady({ ...source, tilt: 90 })).toBe(false);
    expect(temperatureFromSource({ ...source, depth: 50 }, 25, 172)).toBeNull();
    expect(profileFromSource({ ...source, solution: null }, 25)).toBeNull();
  });
});

class FakeWorker implements ClimateWorker {
  sent: ThermalRequest[] = [];
  onmessage: ((event: MessageEvent<ThermalReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage(request: ThermalRequest) { this.sent.push(request); }
  terminate() { this.terminated = true; }
  finish(index: number) { this.onmessage?.({ data: { id: this.sent[index].id, current: mixed, reference: null,
    geographyReference: null } } as MessageEvent<ThermalReply>); }
}
describe('thermal worker request ownership', () => {
  it('coalesces intermediate slider requests and discards stale replies', () => {
    const worker = new FakeWorker(), results: ThermalReply[] = [];
    const client = new ThermalClient(() => worker, r => results.push(r));
    client.request(23.44, 10, false); client.request(45, 10, false); client.request(90, 50, true);
    expect(worker.sent).toHaveLength(1);
    worker.finish(0);
    expect(results).toHaveLength(0); expect(worker.sent).toHaveLength(2);
    expect(worker.sent[1]).toMatchObject({ tilt: 90, depth: 50, compare: true });
    worker.finish(1); expect(results).toHaveLength(1); client.dispose();
  });
  it('cannot overwrite illustrative mode after cancellation or disposal', () => {
    const worker = new FakeWorker(), results: ThermalReply[] = [];
    const client = new ThermalClient(() => worker, r => results.push(r));
    client.request(90, 10, false); client.cancel(); worker.finish(0);
    expect(results).toHaveLength(0);
    client.request(45, 10, false); client.dispose(); worker.finish(1);
    expect(results).toHaveLength(0); expect(worker.terminated).toBe(true);
  });
  it('reports worker construction failure and permits an explicit retry', () => {
    const worker = new FakeWorker(), results: ThermalReply[] = [];
    let first = true;
    const client = new ThermalClient(() => { if (first) { first = false; throw new Error('Blocked worker'); } return worker; }, r => results.push(r));
    client.request(23.44, 10, false);
    expect(results[0]).toMatchObject({ error: 'Blocked worker' });
    client.request(23.44, 10, false); worker.finish(0);
    expect(results).toHaveLength(2); client.dispose();
  });
});
