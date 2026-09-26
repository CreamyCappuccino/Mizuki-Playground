import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';

/** Run frozen accepted-main source in the SAME runtime as the candidate.
 * Cross-platform libm/V8 bytes need not match a hash captured on one Mac.
 * This preserves exact regression comparison, not a rounded/tolerant golden.
 * Fixture is immutable: never refresh it to match a candidate's output.
 */
export function classicBaseline(): typeof import('../src/physics/energyBalance').solveSeasonalClimate {
  const fixture: { commit: string; modules: Record<string, { blob: string; source: string }> } =
    JSON.parse(readFileSync(new URL('./fixtures/classic-a8c096f.json', import.meta.url), 'utf8'));
  if (fixture.commit !== 'a8c096f6d756b4093b240fb6fff590169d8ab640') throw new Error('Unexpected Classic baseline commit');
  const acceptedBlobs: Record<string, string> = {
    energyBalance: '2d55426f312e29ff60e6a185b77c0b7fe4a79d32',
    orbit: '7c5d15f2fe659cae17428b6eca5675fde2352a0a',
    solar: '1ca17373600719094d41fe031b5475d97d4cdc2b',
    climateGeography: 'e8f8289906523a7f5b0e136661c9dd9bd90f91ab',
  };
  const cache = new Map<string, Record<string, unknown>>();
  const load = (name: string): Record<string, unknown> => {
    const cached = cache.get(name);
    if (cached) return cached;
    const entry = fixture.modules[name];
    if (!entry || entry.blob !== acceptedBlobs[name]) throw new Error(`Unknown/changed baseline module: ${name}`);
    const blob = createHash('sha1').update(`blob ${Buffer.byteLength(entry.source)}\0`).update(entry.source).digest('hex');
    if (blob !== entry.blob) throw new Error(`Classic baseline blob mismatch: ${name}`);
    const module = { exports: {} as Record<string, unknown> };
    cache.set(name, module.exports);
    const compiled = ts.transpileModule(entry.source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const requireBaseline = (id: string) => {
      if (!/^\.\/[A-Za-z]+$/.test(id)) throw new Error('Baseline require is limited to fixture modules');
      return load(id.slice(2));
    };
    // Trusted, blob-verified historical project source only; no external input.
    new Function('exports', 'require', 'module', compiled)(module.exports, requireBaseline, module);
    return module.exports;
  };
  return load('energyBalance').solveSeasonalClimate as typeof import('../src/physics/energyBalance').solveSeasonalClimate;
}
