# Earth geography — isolated physics/data design candidate

Updated: 2026-09-26. Decision sources: Chat-side science designer's
CX-MSG0211 and CX-MSG0212; the latter supersedes the former's grid reuse.
Status: **proposal for review, not an implemented or validated release**.
Display follow-up has separate code/CI evidence at `a8c096f`, CI #53;
Chat-side acceptance is still pending.

## Ownership and sequence

Close the alpha-1 display review first. Then build an isolated physics/data
milestone; Chat-side Mizuki reviews its independent evidence **before** any UI
connection. Main integration has an explicitly assigned owner after review.
This document authorizes no solver implementation, deployment or new network
configuration. The scientist is independently checking the numerical design;
the local implementer must reproduce and inspect the delivered evidence.

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
  coupled to visual quality. UI/schema/cache design is not finalized here.

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

### Why the earlier grid proposal is withdrawn

CX-MSG0212 reports that reusing the x-area-center grid with the naive zonal
term failed the spherical harmonic check `T = cos(phi)*cos(lambda)`,
`Laplacian(T) = -2*T`: area RMS 0.102 / 0.100 / 0.0995 for 18 / 36 / 72
latitude cells. Conservation alone did not establish convergence.

The revised geometry reportedly gives RMS 0.002881 / 0.000785 / 0.000211 /
0.0000561 at 18 / 36 / 72 / 144 latitudes. These are **designer-reported
prototype results**, not local verified fixtures. Longitude counts, norm
normalization, scripts and tolerances must accompany the reproducible test.

## Gates before UI integration

1. Reproduce the harmonic convergence test and area-weighted transport sum
   for arbitrary fields, including polar caps and the longitude seam.
2. Compare the **new geometry** PCG solve against independent SciPy sparse
   direct solves. The reported `<=2.2e-10` solver difference and `<=8e-13`
   global transport residual were obtained with the **old geometry** and must
   not certify the replacement.
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

## Mask and reproducible data milestone

Candidate: Natural Earth 1:110m land archive, supplied official CDN address:
https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip

Before bundling, record the actual source URL, acquisition/version metadata,
archive SHA-256, included VERSION and component hashes. Do not equate the
landing-page version with either archive contents or the latest Git repo.
The designer reports public-domain/WGS84 checks; license and CRS evidence must
be retained with the actual acquired source. Do not infer geography from
imagery colours.

Build fractional coverage reproducibly from polygons. Cell subsampling must
be uniform in `sin(phi)` and longitude for area weighting, with refinement
checks. Test major continents, Pacific ocean, antimeridian wrapping, polar
caps, holes and small-island resolution limits. Pin the builder, parameters
and output checksum. No data has been acquired by this document change.

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
