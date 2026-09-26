# Earth geography browser slice — alpha 2 candidate

Updated: 2026-09-27. Authority: CX-MSG0226/CX-MSG0239/CX-MSG0245, continuing the isolated
[physics/data design](DESIGN-v1.3-earth-geography.md). The component lane and a separate production-built browser preview are now
implemented on review branches; the canonical branch now connects the main
3D/profile/point/year/Compare/Atlas/schema4 slice, with final acceptance pending.
Base accepted core: `661f9ff`. The preview does not alter schema 3 or the
accepted 3D Earth/Compare/Atlas semantics.

## Ownership and gates

The reusable sampler/worker/client components were prepared on
`codex/earth-geography-browser`; Chat-side review then assembled the separate
`mizuki/earth-geography-live-preview` production-built preview after independent
core acceptance. Main and the existing serving clone remain at the accepted
display `a8c096f` until final review/fast-forward. No deployment, network
change, new physical coefficients, feedback or finer UI grid is authorized by
this slice.

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
  Each active solve has an absolute 60-second deadline, including mask loading.
  Progress/repeated intent does not reset it. Expiry terminates the worker,
  reports an explicit error and advances the queue; only explicit retry restarts
  that intent. Finish/cancel/supersede/dispose release the timer. A queued owner
  receives its own deadline when its worker starts, not while waiting its turn.
- `ScientificTemperatureSource` is the shared zonal/geography sampling boundary.
  Geography sources check tilt/orbit/retained-depth/grid/mask/solver ownership
  before exposing accepted client fields, and require explicit finite longitude
  for both point and annual sampling. The compatibility `TemperatureSource` name
  remains zonal-only until each existing UI owner is migrated with its wiring;
  adding the adapter alone does not enable a main-page geography profile.
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
and separate. Core full-year FFT acceptance passed in CX-MSG0227; final browser
acceptance remains separate and cannot be inferred from that numerical audit.
Update README/START_HERE/SCIENCE/state/version
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

`geographySampling.ts` defines the common containing-cell/time sampler;
`geographyMask.ts` verifies actual little-endian numerical payload bytes with
Web Crypto and returns private mask snapshots. These components are connected
to the isolated preview but not yet to the accepted 3D Earth profile.
Polar readouts identify a selected longitude sector in a coarse polar cap, not
a unique longitude at the geometric pole. Cancel will be distinct from error.
Globe colour must not create interpolated scientific values across cells:
prefer a discrete cell texture/nearest sampling; any visual interpolation must
be labelled as display-only while all readouts/curves/Atlas use the same index.

The dedicated stateless worker and shared serial client are implemented and
connected to the isolated preview, but not yet to the accepted 3D Earth/Compare/Atlas UI. The client validates scientific keys/provenance,
terminates obsolete synchronous jobs, ignores late callbacks, distinguishes
cancel/error, supports explicit retry and caches at most three accepted fields
under 6 MiB of owned typed arrays. Fake-worker lifecycle tests exercise
A=B exact reuse, unchanged-intent deduplication, queue fairness, cancellation,
wrong replies, errors/retries and real-byte eviction. These are component
tests, not an actual browser-worker or completed UI proof.

CX-MSG0231 independently accepts the actual sampler: 960 boundary/seam/pole/
day-wrap fixtures agreed (maximum rounding difference 3.55e-15 °C); all annual
getter and longitude-slice values exactly matched production raw fields.
It also exposed two malformed-reply defects, now covered by regressions:
missing grid arrays previously poisoned a cache before byte accounting threw,
and null messages threw outside the callback guard. Validate fixed grid arrays,
actual temperature min/max and nonnegative diagnostics before insertion;
commit cache changes transactionally. Guard reply shape before dereference,
emit error, terminate the bad worker and continue other queued owners. These
are internal message-defence failures, not observed external attacks. A canceled
slot resumes only with a deliberate fresh request using current conditions;
`retry` is for retained error intent, not an automatic cancel undo.


## Actual browser preview evidence

The isolated `geography-lab.html` preview is built as a second Vite HTML entry.
It uses the production `geography.worker.ts`, `GeographyClient`, validated mask
and common `geographySampling.ts` functions; no precomputed browser fixture is
substituted. Scientific edits replace/cancel obsolete worker intent, while day
and location changes only resample accepted annual fields. The optional
reference is 23.44° at the same orbit and geography.

Chromium and macOS Playwright WebKit exercise the real worker, verify the
Taipei coarse cell (25°N/125°E, q64 land fraction 7.47%), change longitude
without a new annual solve, cancel/retry a changed-tilt solve, and check
Japanese Large at 390×844 without horizontal overflow. Browser screenshots
cover the real land-fraction field and the mobile temperature/reference view.
This evidence remains distinct from branded physical-iPhone Safari acceptance.

Portable settings on this preview use their own pinned `earth-geography-preview`
version-1 envelope and mask/solver identity. They do **not** upgrade or reinterpret
the main application's schema 3. A future integrated profile still requires an
explicit schema-4 migration contract.

## Main-page integration candidate — 2026-09-27

The canonical `codex/earth-geography-browser` track now connects the reviewed
shared controller and scientific source to the existing main UI. Geography is
an additional application profile, never a value sent to the zonal worker.
The fragment-position globe layer selects nearest 36×18 colors in local
coordinates (+Y north, +X Greenwich, −Z east); no spatial mesh-color interpolation
creates new scientific temperatures. A/B rendering and picking restore A's
geography source after each pass. Hidden/pending layers release old field
references. Compare presentation avoids resizing for newly allocated adapters
over an unchanged accepted field.

Point/year/Compare share explicit longitude. Atlas temperature uses 18 native
latitude centers and 365 daily samples, with nearest raster drawing and the
23.44° same-A-orbit/mask reference. Schema 4 adds the profile, while schema 3
rejects it in both URL and JSON. The real-land/ocean question selects 45°N/105°E
and allows switching to 45°N/135°W; A/B always remains the same picked place.
JA/EN notes explicitly distinguish 10° surrounding-cell fraction from point
coastline classification, and retained Classic depth from effective capacity.

Local `npm run verify` passed 222 tests in 25 files, typecheck/docs/build.
`geography-main.spec.ts` has four real-HTTP cases per engine: main globe/point/
year/Compare/Atlas; same-latitude longitude switch, A=B shared single solve,
cancel→explicit retry and JA Large/mobile/Focus; injected malformed reply→
error/retry and atomic schema3 rejection; and 90°/e=.3/peri90 polar Orbit.
The 28-case combined geography-main + prior v13 Chromium/WebKit run passed;
final source changes and same-HEAD CI must still be verified, not inferred
from these local checkpoints. No font-sensitive golden was rewritten.

The browser test records worker postMessage→ready time and returned typed-array
bytes (`worker-latency-and-payload-not-peak-heap.json`). One local Chromium
checkpoint measured 4.882 s (A23.44°) / 4.514 s (B90°), 1,898,200 array bytes
per field and maximum one active geography worker. These are environment-
specific observations, not mobile performance guarantees. The 6MiB limit is
client-cache ownership only; A/B/reference slots can retain evicted fields,
and worker/solver/renderer arrays add memory. **Peak heap/process memory was
not measured** and is an explicit open measurement, not this payload size.

Main and MagicDNS serving clone remain `a8c096f`. Independent final image
review, same-HEAD CI, later main/live FF authorization and physical iPhone
acceptance remain separate gates. No v1.4 code is included.
