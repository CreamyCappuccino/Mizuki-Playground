import type { GeographyClimateSolution } from '../physics/geographyClimate';
import { geographyRequest, geographyRequestKey, geographySolutionBytes, matchingGeographySolution, isGeographyReply,
  type GeographyConditions, type GeographyReply, type GeographyRequest } from '../physics/geographyProtocol';

export type GeographyOwner = 'A' | 'B' | 'reference';
export type GeographyState =
  | { status: 'queued' | 'computing' | 'canceled' }
  | { status: 'ready'; solution: GeographyClimateSolution }
  | { status: 'error'; error: string };
export interface GeographyWorker {
  postMessage(request: GeographyRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<GeographyReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
interface Desired {
  request: GeographyRequest;
  key: string;
  notify: (state: GeographyState) => void;
}
const MAX_FIELD_BYTES = 6 * 1024 * 1024;

/** One shared serial solve lane; one latest intent per A/B/reference slot.
 * Clients must drop visible fields on queued/canceled/error. Current accepted
 * fields live in this single bounded cache, not another per-owner cache.
 */
export class GeographyClient {
  private desired = new Map<GeographyOwner, Desired>();
  private queue = new Map<GeographyOwner, Desired>();
  private cache = new Map<string, GeographyClimateSolution>();
  private active: { owner: GeographyOwner; desired: Desired; worker: GeographyWorker } | null = null;
  private serial = 0;
  private disposed = false;
  constructor(private readonly createWorker: () => GeographyWorker) {}

  request(owner: GeographyOwner, conditions: GeographyConditions, notify: Desired['notify']): void {
    if (this.disposed) return;
    const request = geographyRequest(++this.serial, conditions), key = geographyRequestKey(request);
    const previous = this.desired.get(owner);
    // Render loops may repeat identical intent: do not restart or starve jobs.
    if (previous?.key === key) return;
    this.stopActive(owner);
    const desired = { request, key, notify };
    this.desired.set(owner, desired);
    this.queue.delete(owner);
    this.queue.set(owner, desired);
    notify({ status: 'queued' });
    this.pump();
  }
  cancel(owner: GeographyOwner): void {
    const desired = this.desired.get(owner);
    this.desired.delete(owner); this.queue.delete(owner);
    this.stopActive(owner);
    desired?.notify({ status: 'canceled' });
    this.pump();
  }
  retry(owner: GeographyOwner): void {
    const desired = this.desired.get(owner);
    if (!desired || this.disposed) return;
    this.desired.delete(owner);
    this.request(owner, desired.request, desired.notify);
  }
  dispose(): void {
    this.disposed = true;
    this.active?.worker.terminate(); this.active = null;
    this.queue.clear(); this.desired.clear(); this.cache.clear();
  }
  get cacheBytes(): number { return [...this.cache.values()].reduce((total, s) => total + geographySolutionBytes(s), 0); }
  get cacheFields(): number { return this.cache.size; }

  private stopActive(owner: GeographyOwner): void {
    if (this.active?.owner !== owner) return;
    this.active.worker.terminate(); this.active = null;
  }
  private pump(): void {
    if (this.disposed || this.active) return;
    const next = this.queue.entries().next().value as [GeographyOwner, Desired] | undefined;
    if (!next) return;
    const [owner, desired] = next;
    this.queue.delete(owner);
    const cached = this.cache.get(desired.key);
    if (cached) {
      this.cache.delete(desired.key); this.cache.set(desired.key, cached);
      desired.notify({ status: 'ready', solution: cached });
      this.pump(); return;
    }
    try {
      const worker = this.createWorker();
      const active = { owner, desired, worker };
      this.active = active;
      worker.onmessage = event => {
        if (this.active !== active || this.disposed) return;
        if (!isGeographyReply(event.data)) {
          this.finish(active, { status: 'error', error: 'Malformed geography worker reply.' }); return;
        }
        const reply = event.data;
        if (reply.id !== desired.request.id || reply.key !== desired.key) {
          this.finish(active, { status: 'error', error: 'Geography worker request/provenance mismatch.' }); return;
        }
        if (reply.status === 'computing') { desired.notify({ status: 'computing' }); return; }
        if (reply.status === 'error') { this.finish(active, { status: 'error', error: reply.error }); return; }
        try {
          if (!matchingGeographySolution(reply.solution, desired.request)) throw new Error('Geography solution/provenance mismatch.');
          this.retain(desired.key, reply.solution);
          this.finish(active, { status: 'ready', solution: reply.solution });
        } catch (error) {
          this.finish(active, { status: 'error', error: error instanceof Error ? error.message : 'Invalid geography solution.' });
        }
      };
      worker.onerror = event => {
        event.preventDefault();
        if (this.active === active) this.finish(active, { status: 'error', error: 'Geography worker unavailable. Retry calculation.' });
      };
      worker.postMessage(desired.request);
    } catch (error) {
      this.active?.worker.terminate(); this.active = null;
      desired.notify({ status: 'error', error: error instanceof Error ? error.message : 'Geography worker unavailable.' });
      this.pump();
    }
  }
  private finish(active: NonNullable<GeographyClient['active']>, state: GeographyState): void {
    active.worker.terminate(); this.active = null;
    if (this.desired.get(active.owner) === active.desired) active.desired.notify(state);
    this.pump();
  }
  private retain(key: string, solution: GeographyClimateSolution): void {
    // Validate accounting before mutation, and commit a proposed cache only
    // after eviction/accounting succeeds. Exceptions cannot poison later hits.
    const bytes = geographySolutionBytes(solution);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FIELD_BYTES) throw new Error('Invalid geography field byte size.');
    const proposed = new Map(this.cache);
    proposed.delete(key); proposed.set(key, solution);
    const totalBytes = () => [...proposed.values()].reduce((total, s) => total + geographySolutionBytes(s), 0);
    while (proposed.size > 3 || totalBytes() > MAX_FIELD_BYTES) proposed.delete(proposed.keys().next().value!);
    this.cache = proposed;
  }
}
