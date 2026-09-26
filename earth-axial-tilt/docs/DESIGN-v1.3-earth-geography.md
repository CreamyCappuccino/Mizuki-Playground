# Earth geography — isolated physics/data design candidate

Updated: 2026-09-26. Decision sources: Chat-side science designer's
CX-MSG0211–0213 and CX-MSG0216–0220; 0212 supersedes the original grid reuse.
Status: **physics/data implementation authorized; no solver or UI release yet**.
Display follow-up at `a8c096f` was accepted and FF-integrated into main and
the existing serving clone. Same-head CI #53 / run 36246368748 and main CI #54 /
run 36247125673 passed both jobs; physical iPhone acceptance remains unverified.

## Ownership and sequence

The alpha-1 display review is closed. CX-MSG0213 authorizes an isolated physics/data
milestone; Chat-side Mizuki reviews its independent evidence **before** any UI
connection. Main integration has an explicitly assigned owner after review.
The scientist's Relay GO, not this document alone, authorizes implementation.
No deployment or new network configuration is authorized. The local implementer
must reproduce and inspect numerical/data evidence before claiming validation.

## Invariants and declared approximations

- Keep Classic's existing 90-band solver, `buildClimateGrid`, coefficients and
  complete results byte-unchanged. Existing idealized profiles stay unchanged.
- Add geography as a separate scientific profile and grid, not a texture mask
  pretending the existing zonal solver is longitude-aware.
- Keep existing A/B/D and latitude albedo. Equal zonal/meridional D is a new,
  explicitly stated **isotropic educational diffusion assumption**, not a fit
  to winds or ocean currents. No feedback, topography or new climate constants.
- Coastal cells use area-fraction mixed-column heat capacity:
  `C = 4e6 * (f_land * 2.5 + (1 - f_land) * 50)`.
  A coarse cell temperature is not a precise city weather estimate.
- Start with 18 latitude × 36 longitude cells (10° angular spacing, 648
  cells), prominently labelled. Resolution is a scientific condition, never
  coupled to visual quality. Order is south-to-north, then west-to-east within
  each row; centres are latitude −85, −75, …, 85 and longitude −175, −165, …, 175.
  A=210, B=2, D=0.55; UI/schema/cache integration is not finalized here.

## Geography-specific spherical finite volume

Use regular latitude edges and their angular midpoint `phi_i`; no point lies
at a pole. Define `x_i = sin(phi_i)`,
`w_i = sin(phi_N) - sin(phi_S)`, longitude width `d_lambda` and latitude
width `d_phi`, all angles in radians. A common longitude-area factor may be
cancelled consistently; global weighting still includes cell longitude width.

Shared face conductances in the latitude-area-weighted row convention:

```
G_NS = D * cos(phi_face) / (phi_(i+1) - phi_i)
G_EW = D * d_phi / (cos(phi_i) * d_lambda^2)
M_ii = w_i*C_i/dt + w_i*B + sum(G_ij)
M_ij = -G_ij
rhs_i = w_i*C_i/dt*T_old_i + w_i*((1-alpha_i)*Q_i - A)
```

Longitude is periodic. Polar exterior conductance is zero. Each shared face
adds equal/opposite weighted flux. Backward Euler gives a symmetric positive
definite system for positive storage/radiation damping; candidate solver is
Jacobi-preconditioned CG. Finite values, solver residual, energy residual and
nonconvergence must be explicit outputs, not silently clipped or hidden.
Use half-day steps with forcing at the step end, inherited daily-mean orbital
forcing and fixed latitude albedo. PCG has a finite iteration bound, guards
nonfinite/abnormal denominators and verifies the actual residual. Spin-up is
bounded at 80 years and requires same-phase maximum difference <1e-6 °C.
Nonconvergence is an error: no clipping or fallback to Classic. A 1D initial
guess may accelerate convergence but cannot replace any final 2D values.
Store all 365×648 daily values; a later runtime cache must have a byte bound
(initial target at most 2–3 configurations), including retained copies.

### Why the earlier grid proposal is withdrawn

CX-MSG0212 reports that reusing the x-area-center grid with the naive zonal
term failed the spherical harmonic check `T = cos(phi)*cos(lambda)`,
`Laplacian(T) = -2*T`: area RMS 0.102 / 0.100 / 0.0995 for 18 / 36 / 72
latitude cells. Conservation alone did not establish convergence.

The revised geometry reportedly gives RMS 0.002881 / 0.000785 / 0.000211 /
0.0000561 at 18 / 36 / 72 / 144 latitudes. These are **designer-reported
prototype results**, not local verified fixtures. Longitude counts, norm
normalization, scripts and tolerances must accompany the reproducible test.

CX-MSG0217 supplies the exact definition: nlat=[18,36,72,144], nlon=2*nlat,
`error = L_D(T) + 2*D*T`, D=0.55, and
`areaRMS = sqrt(sum(w_i*error_ij^2)/(2*nlon))`. This includes D; it is not
the bare Laplacian norm. Targets are 0.0028811671 / 0.0007849835 /
0.0002109333 / 0.0000561486, maximum errors 0.0234076 / 0.0119250 /
0.0059903 / 0.0029986. The largest grid only requires matvec, not annual solve.

The isolated `src/physics/geographyGrid.ts` implements this geometry and pairwise
weighted transport. `tests/geographyGrid.test.ts` checks the stated harmonic
norm, shared-face symmetry/dissipation, constant field, seam/poles, spherical
area and variable-capacity weighted conservation. This is not a PCG solver or
completed annual climate validation; Classic code and UI are unchanged.

CX-MSG0219 independently reviewed the actual `cf08e023` grid against a Python
pairwise sparse matrix: operator max difference 1.37e-11, global weighted
transport 7.45e-14, weight difference 2.3e-16 and negative dissipation. This
acceptance covers the grid/transport only, not a complete annual solver.

`geographySystem.ts` snapshots variable-capacity matrix coefficients;
`geographyPcg.ts` implements bounded Jacobi-PCG, default relative/absolute
tolerances 1e-11, positive denominator/diagonal guards and actual residual
verification (with residual replacement/restart). `geographyPcg.test.ts`
compares a 6×12 matrix and solve to separately assembled dense Gaussian
elimination, checks the full 18×36 true residual and exact warm start, and
tests zero RHS, D=0, source snapshots and explicit numerical failures.
PCG validation does not establish periodic spin-up or annual energy balance.
Local default-grid smooth mask `f_k=(1+sin(.17*k))/2`, rhs `100*sin(.17*k)`:
34 iterations, actual residual norm 1.0499100680011729e-8, relative L2 residual
5.838234044981182e-12. A single local run took ~2.5 ms; this is not a mobile or
annual-solve guarantee, nor the designer's sparse-direct oracle comparison.

`geographyClimate.ts` now implements the isolated annual solve. Step-end forcing
is evaluated at day `1+(step+1)/stepsPerDay`; daily outputs sample the state at
days 1…365 before that day's first step, consistent with Classic's phase.
Spin-up compares **all step-end phases** to the preceding year (<1e-6 °C),
bounded at 80 years; it never clips or falls back. Stationary annual-mean
phi-grid 1D temperatures are an initial guess only. It reports annual radiation
residual, per-step radiation minus capacity-weighted storage residual, actual
linear residual/iterations and source/mask/grid/solver provenance. No runtime
cache or worker/UI connection exists yet. One retained daily field is 1.89 MB;
the temporary all-phase convergence history adds 3.78 MB at half-day stepping.
The fixed-mask whole-array FFT oracle check remains a separate pending gate.

Latest local production-mask 23.44° run: 31 spin-up years, all-phase periodic
error 7.142699516e-7 °C, annual radiation residual 1.535674178e-6 W/m²,
maximum step energy residual 1.597994728e-7 W/m², maximum linear relative residual
9.999661464e-12, maximum 39 PCG iterations/step, temperature range −20.891…31.201 °C,
~3.68 s on this M4 (initial run ~4.24 s). Not a mobile or climate accuracy claim.

Local `npm run verify` passes 170 tests: uniform land/ocean vs independently
assembled phi-grid 1D direct solves (full-array max <1e-5 °C), exact uniform
longitude invariance, production-mask 23.44°/60°/90° with e=.3/perihelion 90°,
full-phase periodic/linear/energy checks, half→quarter-day hemisphere refinement,
uniform-land spatial refinement, explicit failure cases, and two Classic
full-array SHA-256 regressions at unchanged accepted-main source. The external
annual FFT/independent orbital forcing comparison is not yet passed.

Annual uniform-material tests exposed ~1e-10 °C longitude roundoff from
edge-wise accumulation and Jacobi diagonal ordering. The matrix now applies
the identical south/north/east-west direction order and diagonal sum at every
longitude. This preserves uniform-world longitude symmetry exactly, without
projecting temperatures or replacing the 2D solution. Dense direct comparison,
SPD guards and actual-residual checks remain in place.

Local uniform-land 18×36→36×72 annual comparison, fine cells area-aggregated
into coarse cells: maximum 0.9277274 °C / global area-and-time RMS 0.2020277 °C;
two solves ~1.65 s, four spin-up years each. A separate hemisphere-mask fine-grid
trial (before that accumulation-order adjustment) reached its 60-second process
timeout: no fine annual result or convergence pass was claimed for that trial.
The default remains **18×36**; finer heterogeneous-grid performance is an open
research limitation, never an implicit display-quality setting.

## Gates before UI integration

1. Reproduce the harmonic convergence test and area-weighted transport sum
   for arbitrary fields, including polar caps and the longitude seam.
2. Compare the **new geometry** local PCG solve against independent sparse
   direct solutions. CX-MSG0213 reports a new pairwise-edge / time-FFT SciPy
   direct implementation, independent of PCG and spin-up: full-year maxima
   5.4e-8 °C (uniform land), 2.93e-6 °C (uniform ocean), 2.80e-6 °C
   (longitude >0 land). These remain designer-reported, not local fixtures.
   The old-geometry `<=2.2e-10` comparison must not certify the replacement.
   CX-MSG0217 additionally reports new-grid smooth fractional-mask PCG vs sparse
   direct max difference 6.34e-11, actual relative-L2 residual 2.34e-11,
   matrix symmetry error 8.9e-16. These are independent designer results;
   local PCG is implemented; independent sparse oracle comparison is pending.
3. Uniform land/ocean must reduce to an independently implemented 1D finite
   volume solve on the **same new grid**, not byte-match an old 18-band
   x-center discretization. Independently retain Classic byte regressions.
4. Verify periodic-year convergence, timestep/grid refinement, annual energy
   balance, variable-C conservation and failure behaviour. Scientist and
   implementer agree tolerances from evidence before calling a gate passed.
5. Benchmark worker latency, cancellation/stale-result handling and peak
   memory on M4, then record mobile uncertainty. One annual Float64 field is
   1,892,160 bytes; references, worker copies and working arrays add memory.
   Prototype timings are not device performance guarantees.

CX-MSG0213 also reports global energy residual <=4.6e-6 W/m² in five cases,
periodic error <1e-6, finite polar/seam values, and convergence at tilt 60°
and tilt 90° / e=0.3 / perihelion 90°. Uniform worlds have exactly zero
longitude differences. Local reproduction is required for all these gates.
CX-MSG0216 reports half-day → quarter-day hemisphere-mask differences of
maximum 0.0274 °C / ordinary (not area-weighted) RMS 0.0100 °C, and
18×36 → 36×72 FFT periodic solutions area-aggregated to coarse cells differ
by maximum 1.75 °C / global area RMS 0.240 °C. This is numerical inspection,
not evidence of climate accuracy. Some fine-grid PCG prototypes exceeded
60 seconds: do not silently increase the science grid with display quality.

## Mask and reproducible data milestone

Pinned source: Natural Earth 1:110m land archive, official CDN address:
https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip

Acquired 2026-09-26: archive VERSION is **4.1.0**, despite the landing page's
4.0.0 label. The 69,700-byte archive and component hashes are recorded in
[data provenance](../data/README.md). Its `.prj` specifies WGS84 angular degrees;
the official Terms of Use states public domain. Do not infer geography from
imagery colours or equate this archive with the current upstream Git repo.

Build fractional coverage reproducibly from polygons. Cell subsampling must
be uniform in `sin(phi)` and longitude for area weighting, with refinement
checks. Test major continents, Pacific ocean, antimeridian wrapping, polar
caps, holes and small-island resolution limits. Pin the builder, parameters
and output checksum. A 64×64 equal-area midpoint mask candidate now exists:
`data/land-fractions.json`, generated offline with `npm run data:geography`.
See data README for pinned builder/output hashes, explicit even-odd fill rule
and preservation of self-intersecting feature 78. Source-roundoff coordinates
are retained, with no broad geometry repair. Tests include synthetic holes,
seam/poles/area, source locations and sampling refinement. Full 648-cell
independent solver/orbital oracle comparison remains pending.
CX-MSG0220 accepts source/grid/mask after exact 648-cell Python quadrature
agreement and full comparison to independent clipped spherical area. See the
data README for residuals. This does not certify the newly implemented annual
solver or prototypes computed with a different exact-area mask.
CX-MSG0219 reports an independently implemented identical quadrature vs the
clipped-edge oracle: q64 max fraction error 0.003036 / area RMS 0.000466;
q128 max 0.001313 / area RMS 0.000154. These are reported approximation errors,
not local full-cell verification and not solver errors on a fixed mask.
The designer has prepared an independent Shapely cell-clipping / line-integral
area oracle (`-integral sin(phi) d_lambda` for lon/lat-linear polygon edges),
with rectangle/holes/poles/4π fixtures. Compare its results against the local
subsample mask when generated; neither method is already verified here.

## UI contract to review later

Globe, selected cell, annual series and Compare must all use longitude-aware
solutions. Show land fraction, effective depth and coarse resolution beside
the selected location. Atlas candidate is a **selected-longitude latitude ×
year section**, not a zonal average or silently Earth B / 23.44°.
One explicit reference (candidate: uniform ocean at the same new grid,
tilt/orbit) must be selected and labelled before implementation. Schema,
worker/cache provenance, comparison semantics and immutable mask identity need
a separate accepted contract. No UI or migration implementation yet.

## Background pointers supplied by the scientist

- https://brian-rose.github.io/ClimateLaboratoryBook/courseware/one-dim-ebm/
- https://brian-rose.github.io/ClimateLaboratoryBook/courseware/seasonal-cycle/
- https://www.naturalearthdata.com/about/terms-of-use/
- https://www.naturalearthdata.com/features/

These are background for inherited EBM/data, not a claim that a source
validates our 2D extension. This candidate still needs independent review.
