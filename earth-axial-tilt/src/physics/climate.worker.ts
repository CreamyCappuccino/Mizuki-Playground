import { solveSeasonalClimate, type ThermalSolution } from './energyBalance';
import type { ThermalRequest, ThermalReply } from '../ui/thermalClient';

const cache = new Map<string, ThermalSolution>();
function solution(tilt: number, depth: number): ThermalSolution {
  const key = `${tilt}:${depth}`;
  const existing = cache.get(key);
  if (existing) { cache.delete(key); cache.set(key, existing); return existing; }
  const result = solveSeasonalClimate(tilt, depth);
  if (cache.size >= 6) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
self.onmessage = (event: MessageEvent<ThermalRequest>) => {
  const request = event.data;
  let reply: ThermalReply;
  try {
    const current = solution(request.tilt, request.depth);
    const reference = request.compare ? solution(23.44, request.depth) : null;
    reply = { id: request.id, current, reference };
  } catch (error) {
    reply = { id: request.id, error: error instanceof Error ? error.message : 'Thermal calculation failed.' };
  }
  // Structured clone preserves the worker's bounded cache (do not transfer/detach it).
  self.postMessage(reply);
};
