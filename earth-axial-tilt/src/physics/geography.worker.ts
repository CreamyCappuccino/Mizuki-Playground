import { solveGeographyClimate } from './geographyClimate';
import { productionGeographyMask } from './geographyMask';
import { geographyRequestKey, type GeographyReply, type GeographyRequest } from './geographyProtocol';

/** Dedicated stateless worker. Cancellation terminates it from the client;
 * a queued onmessage cannot interrupt a synchronous numerical solve.
 */
self.onmessage = async (event: MessageEvent<GeographyRequest>) => {
  const request = event.data;
  let key = '';
  try {
    key = geographyRequestKey(request);
    const mask = await productionGeographyMask();
    const progress: GeographyReply = { id: request.id, key, status: 'computing' };
    self.postMessage(progress);
    const solution = solveGeographyClimate(request.tilt, mask, { orbit: request.orbit });
    solution.provenance = { ...solution.provenance, retainedClassicDepth: request.retainedDepth };
    const reply: GeographyReply = { id: request.id, key, status: 'ready', solution };
    // No worker cache is retained. Transfer the large field to the sole cache
    // owner; never detach a field still owned by a cache.
    self.postMessage(reply, { transfer: [solution.temperatures.buffer] });
  } catch (error) {
    const reply: GeographyReply = { id: request.id, key, status: 'error',
      error: error instanceof Error ? error.message : 'Geography calculation failed.' };
    self.postMessage(reply);
  }
};
