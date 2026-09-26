import { geographyTemperatureSource, type GeographyTemperatureSource } from '../physics/geographyTemperatureSource';
import { geographyConditions, geographyRequest, geographyRequestKey, type GeographyConditions } from '../physics/geographyProtocol';
import { GeographyClient, type GeographyOwner, type GeographyState } from './geographyClient';

type Lane = Pick<GeographyClient, 'request' | 'cancel' | 'retry' | 'dispose'>;
interface Slot { conditions: GeographyConditions; key: string; state: GeographyState }
export interface GeographyWorlds {
  A: GeographyConditions;
  B: GeographyConditions | null;
  reference: GeographyConditions | null;
}

/** One host-owned client for all worlds. A slot only holds its current accepted
 * field, not a second cache. Its reference may outlive cache eviction: cache
 * bytes alone are therefore not a process/heap limit.
 */
export class GeographyController {
  private readonly slots = new Map<GeographyOwner, Slot>();
  private readonly lane: Lane;
  private disposed = false;
  revision = 0;
  constructor(private readonly onChange: () => void, lane?: Lane) {
    this.lane = lane ?? new GeographyClient(() =>
      new Worker(new URL('../physics/geography.worker.ts', import.meta.url), { type: 'module' }));
  }

  sync(worlds: GeographyWorlds | null): void {
    if (this.disposed) return;
    // Validate the whole configuration before changing any owner.
    const intents = (['A', 'B', 'reference'] as const).map(owner =>
      [owner, worlds?.[owner] ? geographyConditions(worlds[owner]!) : null] as const);
    const requests: [GeographyOwner, Slot][] = [];
    for (const [owner, intent] of intents) {
      if (!intent) {
        if (this.slots.has(owner)) { this.slots.delete(owner); this.lane.cancel(owner); this.revision++; }
        continue;
      }
      const conditions = intent;
      const key = geographyRequestKey(geographyRequest(1, conditions));
      if (this.slots.get(owner)?.key === key) continue;
      const slot: Slot = { conditions, key, state: { status: 'queued' } };
      this.slots.set(owner, slot);
      requests.push([owner, slot]);
    }
    for (const [owner, slot] of requests) this.requestSlot(owner, slot);
  }
  private requestSlot(owner: GeographyOwner, slot: Slot): void {
    if (this.slots.get(owner) !== slot || this.disposed) return;
    this.lane.request(owner, slot.conditions, state => {
      if (this.disposed || this.slots.get(owner) !== slot) return;
      slot.state = state; this.revision++; this.onChange();
    });
  }
  source(owner: GeographyOwner): GeographyTemperatureSource | null {
    const slot = this.slots.get(owner);
    return slot ? geographyTemperatureSource(slot.conditions,
      slot.state.status === 'ready' ? slot.state.solution : null) : null;
  }
  status(owner: GeographyOwner): GeographyState | null { return this.slots.get(owner)?.state ?? null; }
  cancel(owner: GeographyOwner): void { this.lane.cancel(owner); }
  resume(owner: GeographyOwner): void {
    const slot = this.slots.get(owner);
    if (!slot || this.disposed) return;
    if (slot.state.status === 'canceled') {
      // Cancellation removed the lane's intent; a deliberate current-condition
      // request, not render-driven sync, is the only restart.
      slot.state = { status: 'queued' };
      this.requestSlot(owner, slot);
    } else if (slot.state.status === 'error') this.lane.retry(owner);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.slots.clear(); this.lane.dispose();
  }
}
