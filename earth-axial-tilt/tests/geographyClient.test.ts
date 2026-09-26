import { describe, expect, it } from 'vitest';
import { GeographyClient, type GeographyState, type GeographyWorker } from '../src/ui/geographyClient';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import type { GeographyClimateSolution } from '../src/physics/geographyClimate';
import { geographyRequestKey, type GeographyRequest, type GeographyReply } from '../src/physics/geographyProtocol';
import { GEOGRAPHY_SOURCE_ARCHIVE } from '../src/physics/geographyMask';

const conditions = (tilt = 23.44) => ({ tilt, retainedDepth: 10 as const, orbit: { eccentricity: 0, perihelion: 0, axis: 0 } });
class FakeWorker implements GeographyWorker {
  onmessage: GeographyWorker['onmessage'] = null;
  onerror: GeographyWorker['onerror'] = null;
  terminated = false;
  request!: GeographyRequest;
  postMessage(request: GeographyRequest): void { this.request = request; }
  terminate(): void { this.terminated = true; }
  reply(data: GeographyReply): void { this.onmessage?.({ data } as MessageEvent<GeographyReply>); }
  ready(solution = field(this.request)): void {
    this.reply({ id: this.request.id, key: geographyRequestKey(this.request), status: 'ready', solution });
  }
}
function field(r: GeographyRequest): GeographyClimateSolution {
  const grid = buildGeographyGrid();
  return { tilt: r.tilt, orbit: r.orbit, grid, landFraction: new Float64Array(648),
    temperatures: new Float64Array(365 * 648), years: 31, stepsPerDay: 2,
    periodicError: 7e-7, energyResidual: 1e-6, maxStepEnergyResidual: 1e-7,
    maxRelativeLinearResidual: 1e-11, maxLinearIterations: 39, minimum: 0, maximum: 0,
    provenance: { id: r.mask, grid: r.grid, solver: r.solver, retainedClassicDepth: r.retainedDepth,
      sourceVersion: '4.1.0', sourceArchiveSha256: GEOGRAPHY_SOURCE_ARCHIVE,
      stepsPerDay: 2, A: 210, B: 2, D: .55, periodicTolerance: 1e-6,
      pcgRelativeTolerance: 1e-11, pcgAbsoluteTolerance: 1e-11 } };
}
function setup() {
  const workers: FakeWorker[] = [];
  const client = new GeographyClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const a: GeographyState[] = [], b: GeographyState[] = [], ref: GeographyState[] = [];
  return { workers, client, a, b, ref };
}

describe('geography serial compute lifecycle', () => {
  it('serializes A/B/reference, emits honest stages and preserves exact A=B reuse', () => {
    const { client, workers, a, b, ref } = setup();
    client.request('A', conditions(), s => a.push(s));
    client.request('B', conditions(), s => b.push(s));
    client.request('reference', conditions(60), s => ref.push(s));
    expect(workers).toHaveLength(1);
    const r = workers[0].request;
    workers[0].reply({ id: r.id, key: geographyRequestKey(r), status: 'computing' });
    workers[0].ready();
    expect(a.map(s => s.status)).toEqual(['queued', 'computing', 'ready']);
    expect(b.map(s => s.status)).toEqual(['queued', 'ready']);
    expect(a.at(-1)).toBeDefined();
    const av = a.at(-1), bv = b.at(-1);
    if (av?.status !== 'ready' || bv?.status !== 'ready') throw new Error('Missing fixture response');
    expect(av.solution).toBe(bv.solution);
    expect(workers).toHaveLength(2);
    expect(workers[1].request.tilt).toBe(60);
    workers[1].ready();
    expect(ref.at(-1)?.status).toBe('ready');
    client.dispose();
  });
  it('terminates obsolete synchronous solves and ignores late old replies', () => {
    const { client, workers, a } = setup();
    client.request('A', conditions(), s => a.push(s));
    const old = workers[0];
    client.request('A', conditions(60), s => a.push(s));
    expect(old.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    old.ready();
    expect(a.map(s => s.status)).toEqual(['queued', 'queued']);
    workers[1].ready();
    const last = a.at(-1);
    expect(last?.status === 'ready' && last.solution.tilt).toBe(60);
    client.dispose();
  });
  it('does not infinite-request identical intentions and gives other slots their turn', () => {
    const { client, workers, a, b } = setup();
    client.request('A', conditions(), s => a.push(s));
    client.request('B', conditions(45), s => b.push(s));
    for (let k = 0; k < 100; k++) client.request('A', conditions(), s => a.push(s));
    expect(workers).toHaveLength(1);
    client.request('A', conditions(60), s => a.push(s));
    expect(workers[1].request.tilt).toBe(45);
    workers[1].ready();
    expect(workers[2].request.tilt).toBe(60);
    workers[2].ready();
    client.request('A', conditions(60), s => a.push(s));
    expect(workers).toHaveLength(3);
    expect(b.at(-1)?.status).toBe('ready');
    client.dispose();
  });
  it('distinguishes cancellation from failure and permits a fresh request', () => {
    const { client, workers, a } = setup();
    client.request('A', conditions(), s => a.push(s));
    client.cancel('A');
    expect(workers[0].terminated).toBe(true);
    expect(a.at(-1)).toEqual({ status: 'canceled' });
    workers[0].ready();
    expect(a.at(-1)?.status).toBe('canceled');
    client.request('A', conditions(), s => a.push(s));
    workers[1].ready();
    expect(a.at(-1)?.status).toBe('ready');
    client.dispose();
  });
  it('rejects wrong identities/provenance and invalid numerical fields without stalling the lane', () => {
    const { client, workers, a, b } = setup();
    client.request('A', conditions(), s => a.push(s));
    client.request('B', conditions(60), s => b.push(s));
    workers[0].reply({ id: 999, key: 'stale', status: 'computing' });
    expect(a.at(-1)?.status).toBe('error');
    expect(workers).toHaveLength(2);
    const wrong = field(workers[1].request);
    wrong.provenance = { ...wrong.provenance, id: 'another-mask' };
    workers[1].ready(wrong);
    expect(b.at(-1)?.status).toBe('error');
    client.retry('B');
    const nonfinite = field(workers[2].request);
    nonfinite.temperatures[100] = Infinity;
    workers[2].ready(nonfinite);
    expect(b.at(-1)?.status).toBe('error');
    client.retry('B'); workers[3].ready();
    expect(b.at(-1)?.status).toBe('ready');
    client.dispose();
  });
  it('keeps at most three accepted fields and enforces a real byte bound', () => {
    const { client, workers, a } = setup();
    for (const tilt of [0, 23.44, 45, 60]) {
      client.request('A', conditions(tilt), s => a.push(s)); workers.at(-1)!.ready();
    }
    expect(client.cacheFields).toBe(3);
    expect(client.cacheBytes).toBeLessThanOrEqual(6 * 1024 * 1024);
    expect(client.cacheBytes).toBeGreaterThan(3 * 365 * 648 * 8);
    client.request('A', conditions(0), s => a.push(s));
    expect(workers).toHaveLength(5); // evicted oldest, not an unbounded hidden field
    client.dispose();
    expect(client.cacheFields).toBe(0);
    workers[4].ready(); expect(a.at(-1)?.status).toBe('queued');
  });
  it('error/retry and cancellation do not discard a valid other-world queue', () => {
    const { client, workers, a, b } = setup();
    client.request('A', conditions(), s => a.push(s));
    client.request('B', conditions(60), s => b.push(s));
    let prevented = false;
    workers[0].onerror?.({ preventDefault: () => { prevented = true; } } as ErrorEvent);
    expect(prevented).toBe(true); expect(a.at(-1)?.status).toBe('error');
    expect(workers[1].request.tilt).toBe(60);
    client.retry('A');
    workers[1].ready();
    expect(workers[2].request.tilt).toBe(23.44);
    client.cancel('A'); expect(a.at(-1)?.status).toBe('canceled');
    expect(b.at(-1)?.status).toBe('ready');
    client.dispose();
  });
  it('keys orbit and retained capacity independently of display edits', () => {
    const { client, workers, a } = setup();
    client.request('A', conditions(), s => a.push(s)); workers[0].ready();
    client.request('A', { ...conditions(), retainedDepth: 50 }, s => a.push(s)); workers[1].ready();
    client.request('A', { ...conditions(), orbit: { eccentricity: .2, perihelion: 90, axis: 45 } }, s => a.push(s));
    expect(workers).toHaveLength(3);
    expect(geographyRequestKey(workers[0].request)).not.toBe(geographyRequestKey(workers[1].request));
    expect(() => client.request('B', conditions(NaN), () => {})).toThrow();
    client.dispose();
  });
});
