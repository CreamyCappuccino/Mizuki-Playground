import { describe, expect, it } from 'vitest';
import { GeographyController, type GeographyWorlds } from '../src/ui/geographyController';
import type { GeographyOwner, GeographyState } from '../src/ui/geographyClient';
import type { GeographyConditions } from '../src/physics/geographyProtocol';

const conditions = (tilt = 23.44): GeographyConditions => ({ tilt, retainedDepth: 10,
  orbit: { eccentricity: 0, perihelion: 0, axis: 0 } });
class Lane {
  requests: { owner: GeographyOwner; conditions: GeographyConditions; notify: (state: GeographyState) => void }[] = [];
  canceled: GeographyOwner[] = [];
  retried: GeographyOwner[] = [];
  disposed = false;
  request(owner: GeographyOwner, conditions: GeographyConditions, notify: (state: GeographyState) => void): void {
    this.requests.push({ owner, conditions, notify }); notify({ status: 'queued' });
  }
  cancel(owner: GeographyOwner): void {
    this.canceled.push(owner); [...this.requests].reverse().find(r => r.owner === owner)?.notify({ status: 'canceled' });
  }
  retry(owner: GeographyOwner): void { this.retried.push(owner); }
  dispose(): void { this.disposed = true; }
}
const worlds = (): GeographyWorlds => ({ A: conditions(), B: conditions(60), reference: conditions() });
describe('host-owned geography controller', () => {
  it('deduplicates unchanged worlds, retains cancellation until deliberate resume and ignores obsolete callbacks', () => {
    const lane = new Lane(); let changes = 0;
    const controller = new GeographyController(() => changes++, lane);
    controller.sync(worlds()); expect(lane.requests).toHaveLength(3);
    for (let k = 0; k < 100; k++) controller.sync(worlds());
    expect(lane.requests).toHaveLength(3);
    controller.cancel('A'); controller.sync(worlds());
    expect(controller.status('A')?.status).toBe('canceled'); expect(lane.requests).toHaveLength(3);
    controller.resume('A'); expect(lane.requests).toHaveLength(4);
    controller.sync({ ...worlds(), A: conditions(45) });
    const old = lane.requests[0]; old.notify({ status: 'error', error: 'late' });
    expect(controller.status('A')?.status).toBe('queued');
    expect(controller.source('A')?.tilt).toBe(45); expect(controller.source('A')?.geography).toBeNull();
    expect(changes).toBeGreaterThan(0); controller.dispose();
  });
  it('validates all worlds atomically, disables absent owners and disposes once', () => {
    const lane = new Lane(), controller = new GeographyController(() => {}, lane);
    controller.sync(worlds());
    expect(() => controller.sync({ ...worlds(), A: conditions(45), B: conditions(NaN) })).toThrow();
    expect(controller.source('A')?.tilt).toBe(23.44); expect(lane.requests).toHaveLength(3);
    controller.sync({ A: conditions(), B: null, reference: null });
    expect(controller.source('B')).toBeNull(); expect(controller.source('reference')).toBeNull();
    lane.requests[1].notify({ status: 'error', error: 'obsolete B' }); expect(controller.status('B')).toBeNull();
    controller.sync(null); expect(controller.source('A')).toBeNull();
    controller.dispose(); controller.dispose(); controller.sync(worlds());
    expect(lane.disposed).toBe(true); expect(lane.requests).toHaveLength(3);
  });
  it('uses retry for retained error intent without reviving another canceled slot', () => {
    const lane = new Lane(), controller = new GeographyController(() => {}, lane);
    controller.sync(worlds());
    lane.requests[0].notify({ status: 'error', error: 'timeout' });
    controller.cancel('B'); controller.resume('A');
    expect(lane.retried).toEqual(['A']); expect(controller.status('B')?.status).toBe('canceled');
    controller.dispose();
  });
});
