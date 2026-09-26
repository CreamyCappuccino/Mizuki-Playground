import type { PositiveSystem } from './geographySystem';

export interface PcgOptions {
  relativeTolerance?: number;
  absoluteTolerance?: number;
  maxIterations?: number;
}
export interface PcgResult {
  solution: Float64Array;
  iterations: number;
  /** Always computed from rhs - A*x, not the recursive CG residual. */
  residualNorm: number;
  relativeResidual: number;
}

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let k = 0; k < a.length; k += 1) sum += a[k] * b[k];
  if (!Number.isFinite(sum)) throw new Error('PCG nonfinite dot product.');
  return sum;
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`PCG invalid ${name}.`);
}

/** Bounded Jacobi-PCG. No clipping, silent fallback, or unverified convergence.
 * The input guess is copied. On recursive convergence (and every 25 iterations),
 * recompute the actual residual. If needed, restart from it to avoid drift.
 */
export function solveGeographyPcg(
  system: PositiveSystem, rhs: Float64Array, guess: Float64Array = new Float64Array(system.size),
  options: PcgOptions = {},
): PcgResult {
  const n = system.size, rtol = options.relativeTolerance ?? 1e-11;
  const atol = options.absoluteTolerance ?? 1e-11, max = options.maxIterations ?? Math.min(n, 1024);
  if (!Number.isInteger(n) || n < 1 || rhs.length !== n || guess.length !== n || system.diagonal.length !== n) {
    throw new RangeError('PCG size mismatch.');
  }
  if (!Number.isFinite(rtol) || rtol < 0 || rtol >= 1 || !Number.isFinite(atol) || atol < 0 ||
      rtol + atol === 0 || !Number.isInteger(max) || max < 1 || max > 10000) {
    throw new RangeError('Invalid PCG tolerance/iteration bound.');
  }
  for (let k = 0; k < n; k += 1) {
    if (!Number.isFinite(rhs[k]) || !Number.isFinite(guess[k])) throw new RangeError('PCG inputs must be finite.');
    positive(system.diagonal[k], 'Jacobi diagonal');
  }
  const x = guess.slice(), r = new Float64Array(n), z = new Float64Array(n);
  const p = new Float64Array(n), ap = new Float64Array(n);
  const rhsNorm = Math.sqrt(dot(rhs, rhs)), tolerance = atol + rtol * rhsNorm;
  const actualResidual = (): number => {
    system.apply(x, ap);
    for (let k = 0; k < n; k += 1) r[k] = rhs[k] - ap[k];
    return Math.sqrt(dot(r, r));
  };
  const result = (iterations: number, norm: number): PcgResult => ({ solution: x, iterations,
    residualNorm: norm, relativeResidual: rhsNorm > 0 ? norm / rhsNorm : norm });
  const precondition = (): number => {
    for (let k = 0; k < n; k += 1) z[k] = r[k] / system.diagonal[k];
    const rho = dot(r, z);
    positive(rho, 'preconditioned residual');
    return rho;
  };
  let norm = actualResidual();
  if (norm <= tolerance) return result(0, norm);
  let rho = precondition();
  p.set(z);
  for (let iteration = 1; iteration <= max; iteration += 1) {
    system.apply(p, ap);
    const denominator = dot(p, ap);
    positive(denominator, 'p dot A*p');
    const alpha = rho / denominator;
    positive(alpha, 'step length');
    for (let k = 0; k < n; k += 1) {
      x[k] += alpha * p[k]; r[k] -= alpha * ap[k];
    }
    norm = Math.sqrt(dot(r, r));
    if (norm <= tolerance || iteration % 25 === 0 || iteration === max) {
      norm = actualResidual();
      if (norm <= tolerance) return result(iteration, norm);
      // Restart after explicit residual replacement, preserving an SPD search.
      rho = precondition(); p.set(z);
    } else {
      const next = precondition(), beta = next / rho;
      if (!Number.isFinite(beta)) throw new Error('PCG nonfinite direction update.');
      for (let k = 0; k < n; k += 1) p[k] = z[k] + beta * p[k];
      rho = next;
    }
  }
  throw new Error(`PCG did not converge in ${max} iterations; actual residual ${norm}, tolerance ${tolerance}.`);
}
