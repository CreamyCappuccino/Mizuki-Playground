# Earth geography browser slice — alpha 2 candidate

Updated: 2026-09-26. Authority: CX-MSG0226, continuing the isolated
[physics/data design](DESIGN-v1.3-earth-geography.md). This is a plan, not
completed UI or scientific acceptance. Base core: `661f9ff`.

## Ownership and gates

Codex Mizuki is the sole repository writer; Chat-side Mizuki independently
checks the production-mask annual arrays and reviews browser images. Work is
isolated on `codex/earth-geography-browser`. Main and the existing serving
clone remain at the accepted display `a8c096f`. Integration/serving FF requires
the subsequent explicit GO after core and image acceptance. No deployment,
network change, new physical coefficients, feedback or finer UI grid.

## Fixed contracts

- New profile `earth-geography`, EBM only, fixed 18×36 / 10° science grid.
  Pin Natural Earth 4.1.0 and production fraction digest `09462b795716c3a3ce747bcf0835b089b38be8028d09b75cc1cdd196b2567084`.
  Preserve Classic and idealized solver results, controls and old migrations.
- One cell-aware sampler serves globe temperature, picked-place readout,
  annual curve and Compare. Use the containing angular cell, not a
  longitude-blind interpolation: rows south→north, columns west→east;
  longitude wraps to [-180,180), ±90 latitude selects the adjacent cap row
  using the selected longitude. Spatial temperature and fraction use the
  same cell; do not suggest subcell/coastline or precise city resolution.
  Fraction/depth are cell-constant. Daily temperatures interpolate periodically
  in time between day 1…365 samples, wrapping 366 to 1. Boundary tests fix
  longitude seam, exact cell edges, poles, coordinate handedness and day wrap.
- Dedicated geography worker/client with complete request identity:
  tilt, normalized orbit, profile, grid, mask digest, solver version/settings,
  and retained Classic depth metadata (not used as geography capacity).
  Worker validates requests and returned provenance; caller accepts only its
  current generation and scientific key. Immediately invalidate old fields
  on condition changes/errors. No silent fallback or stale temperature.
- Latest request wins; terminate obsolete synchronous solves with worker
  termination rather than pretending a queued cancel can interrupt them.
  Debounce slider recomputation; date/location/view edits only resample.
  Expose busy/error/retry/cancel while globe/UI stays responsive. Initially
  stage-based progress, not invented percent; numerical core stays unchanged.
- Bound retained field caches by bytes, initially at most three daily fields
  (~5.68 MB temperatures plus grid/fractions/metadata) across A/B/reference
  client ownership; separately account worker copies and temporary solve
  arrays. A shared serialized geography compute lane prevents three
  concurrent spin-ups. Cached accepted fields survive worker cancellation;
  use explicit ownership, not detached cache buffers.
- Compare uses independent A/B tilt and orbit with the same profile/mask.
  Identical scientific conditions reuse the exact A field; A=B differences
  are exactly zero. Busy/error B cannot be displayed as a previous B field.
- Geography Atlas is the selected-longitude column's latitude×year section,
  never a zonal average. Reference is 23.44° at A's orbit and the same mask,
  explicitly not B and not the old idealized counterpart. Longitude changes
  invalidate the sampled field cache but do not rerun the annual solve.
- Schema 4 accepts the new EBM/profile combination. Schema 1/2 retain Classic
  migration and schema 3 retains its existing profiles. Unknown versions,
  invalid profiles or illustrative+geography are rejected atomically by the
  shared URL/JSON validator; old states keep their existing scientific values.

## Implementation order and validation

1. Pin mask adapter, sampler contract/tests and schema 4 migration tests.
2. Prove profile→real worker→matching field→picked cell/annual graph as the
   first thin browser flow, including cancellation/error and coarse-cell label.
3. Extend that proven sampler to 3D colour, A/B Compare and Atlas; add the
   same-latitude land/ocean question, bilingual help and scientific attribution.
4. Unit/typecheck/docs/build; actual Chromium and macOS WebKit captures for
   ordinary/extreme forcing, A=B, schema, picking, Atlas, JA Large/mobile,
   Focus and Orbit; same-HEAD CI. Never auto-refresh font-sensitive goldens.

`main.ts` is already 681 lines and a high-growth host: do not accumulate new
geography state/lifecycle there. Extract focused wiring responsibilities before
feature additions. Atlas is 283 lines and expected to grow: extract field/
reference construction from presentation. State is 158 lines; keep its cohesive
validator/migration contract but reassess projected growth before editing.
Record actual file sizes and focused regression evidence at each checkpoint.

Intermediate source SHA is shared once; final SHA, same-head CI, PNGs and open
gates go back in CX-MSG0226's thread. Physical iPhone acceptance remains human
and separate. Core full-year FFT acceptance is pending and cannot be inferred
from component reviews or CI. Update README/START_HERE/SCIENCE/state/version
docs only with implemented facts, not this planned completion.

## Independent core acceptance and browser preparation

CX-MSG0227 accepts the actual `661f9ff` annual driver after blob/source checks
and the same production-mask Float64LE digest. Chat-side Node22 ran the
production code; a separate Python/SciPy sparse-direct time-FFT solve used
independent geometry assembly and Kepler bisection, not production PCG,
spin-up, solar functions or grid builder. Across four complete 365×648 arrays
(946,080 values), maximum differences were 1.474687263e-6 / 1.435033528e-6 /
2.018138900e-6 / 1.852242967e-6 °C for 23.44° circular, 0° e=.2/peri90,
60° circular, and 90° e=.3/peri90 (axis0). All meet the existing max<1e-5 °C
contract; area-time RMS <=1.095433520e-6 °C. Oracle recurrence residual
<=2.49e-11; production max step-energy residual <=3.62e-7 W/m².
Artifacts `fft-oracle.py`, `run-production.cjs`, `source-checks.json`,
`fft-audit.json` and complete arrays remain in the designer's runtime; this is
designer-reported independent acceptance, not a locally rerun Python audit.
Same-head CI56/run36249767365 passed verify and macOS WebKit. TSK1919 is closed.
This validates the discrete educational equations, not real climate accuracy.

`geographySampling.ts` now defines the common containing-cell/time sampler;
`geographyMask.ts` verifies actual little-endian numerical payload bytes with
Web Crypto and returns private mask snapshots. Browser UI is still unconnected.
Polar readouts identify a selected longitude sector in a coarse polar cap, not
a unique longitude at the geometric pole. Cancel will be distinct from error.
Globe colour must not create interpolated scientific values across cells:
prefer a discrete cell texture/nearest sampling; any visual interpolation must
be labelled as display-only while all readouts/curves/Atlas use the same index.

The dedicated stateless worker and shared serial client are implemented but
not connected to the UI yet. The client validates scientific keys/provenance,
terminates obsolete synchronous jobs, ignores late callbacks, distinguishes
cancel/error, supports explicit retry and caches at most three accepted fields
under 6 MiB of owned typed arrays. Fake-worker lifecycle tests exercise
A=B exact reuse, unchanged-intent deduplication, queue fairness, cancellation,
wrong replies, errors/retries and real-byte eviction. These are component
tests, not an actual browser-worker or completed UI proof.
