import type { OrbitParameters } from '../physics/orbit';
import type { ThermalSolution } from '../physics/energyBalance';
export interface ThermalRequest { orbit?: OrbitParameters; id: number; tilt: number; depth: number; compare: boolean }
export type ThermalReply = { id: number; current: ThermalSolution; reference: ThermalSolution | null }
  | { id: number; error: string };
export interface ClimateWorker {
  postMessage(request: ThermalRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<ThermalReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** One in-flight calculation plus the latest desired request, not a slider-event queue. */
export class ThermalClient {
  private worker: ClimateWorker | null = null;
  private wanted: ThermalRequest | null = null;
  private active: ThermalRequest | null = null;
  private serial = 0;
  private disposed = false;
  constructor(private readonly createWorker: () => ClimateWorker,
    private readonly onReply: (reply: ThermalReply) => void) {}

  request(tilt: number, depth: number, compare: boolean, orbit?: OrbitParameters): void {
    this.wanted = { id: ++this.serial, tilt, depth, compare, ...(orbit ? {orbit:{...orbit}} : {}) };
    this.pump();
  }
  cancel(): void { this.wanted = null; this.serial += 1; }
  dispose(): void {
    this.disposed = true; this.cancel(); this.worker?.terminate(); this.worker = null;
  }
  private pump(): void {
    if (this.disposed || this.active || !this.wanted) return;
    const request = this.wanted;
    try {
      if (!this.worker) {
        this.worker = this.createWorker();
        this.worker.onmessage = event => {
          if (this.disposed || event.data.id !== this.active?.id) return;
          this.active = null;
          if (event.data.id === this.wanted?.id) {
            this.wanted = null;
            this.onReply(event.data);
          }
          this.pump();
        };
        this.worker.onerror = event => {
          event.preventDefault();
          this.worker?.terminate(); this.worker = null; this.active = null;
          const wanted = this.wanted; this.wanted = null;
          if (wanted && !this.disposed) this.onReply({ id: wanted.id, error: 'Thermal worker unavailable. Retry or choose the illustrative model.' });
        };
      }
      this.active = request;
      this.worker.postMessage(request);
    } catch (error) {
      this.active = null; this.wanted = null;
      this.worker?.terminate(); this.worker = null;
      this.onReply({ id: request.id, error: error instanceof Error ? error.message : 'Thermal worker unavailable.' });
    }
  }
}
