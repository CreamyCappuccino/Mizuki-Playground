# Earth geography — isolated physics/data design candidate

Updated: 2026-09-26. Decision sources: Chat-side science designer's
CX-MSG0211–0213 and CX-MSG0216–0217; 0212 supersedes the original grid reuse.
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
   local PCG still needs implementation and oracle comparison.
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
independent oracle audit and solver implementation are still pending.
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
