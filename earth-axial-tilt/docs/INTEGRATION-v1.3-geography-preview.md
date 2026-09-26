# Geography UI connection — review candidate, not a release

Base: `661f9ff59738f13458cd4145c187c47ad10c3f9f` on
`codex/earth-geography-physics-data`. Accepted main remains `a8c096f`.
This patch adds an independent `geography-lab.html` integration page. It does not
modify the accepted 3D scene, Earth Classic, existing thermal worker, schema 3,
Vite release entry points, CI workflow, network configuration or deployment.

## Gate closed: independent production-mask annual calculation

The exact pinned q64 land fractions and production TypeScript annual driver were
compared to a separately implemented Python/SciPy reference: pairwise sparse
matrix, orbital bisection and half-angle conversion, time FFT and sparse direct
frequency solves. No PCG, yearly spin-up, production matrix builder or production
solar code was used by that reference.

Four cases: tilt23.44° circular; tilt60° circular; tilt90° with e=.3/peri90°;
and zero tilt with e=.3/peri240°/axis70°. Each case compares all 365 × 648 temperatures,
946,080 values in total. Largest absolute difference: 2.01813889511e-06 °C; predefined
acceptance 1e-5 °C. All four passed. This checks the discrete implementation, not
accuracy of Earth's real climate. Source blobs and payload checksums are in the
accompanying audit manifest; scripts and numeric summaries reproduce the result.

## New connection contract

- Only the pinned 18 × 36 grid, half-day solver and q64 mask are offered. Display
  resolution never changes science resolution. The loader checks grid/source
  identity, scalar types and SHA-256 of little-endian Float64 fractions.
- A selected point reads its containing 10° cell. No smooth city-scale precision
  is implied. Exact poles report an explicitly named polar-row mean, independent
  of an arbitrary longitude. The map highlights that row instead of a point.
- Time interpolation is linear between stored daily values and periodic at the
  year seam. The yearly graph, geographic map and longitude Atlas use this one
  sampler. The Atlas is a selected-longitude section, never a zonal average.
  At exact poles its note distinguishes the row-mean readout from the section.
- The reference is uniform ocean on the SAME new 18 × 36 grid at identical tilt and
  orbit. It is not old Classic, Earth B or a 23.44° baseline.
- `GeographyClient` invalidates prior results immediately, terminates superseded
  workers, validates result ownership/provenance, enforces a timeout, exposes
  errors/retry, and retains at most 2 result pairs within 8 MiB of owned arrays.
  Results transfer once from the worker; no hidden substitute temperatures.
- A standalone `earth-geography-lab` schema1 is used for this preview only.
  Existing Earth schema1–3 is not migrated or reinterpreted. JSON and URL imports
  are bounded, validated atomically and superseded by newer user actions.
- Japanese/English, Large text, native-cell map selection, keyboard navigation,
  time/location controls, JSON import/export, and an explicit scientific-limit
  notice are included. No new climate coefficients/feedbacks/topography.

## What was actually tested here

- The production core's nine source/data blobs match the pinned Git tree.
- New source and transitive numerical dependencies compile with strict TypeScript
  5.8.3, ES2022. This is NOT the complete project's npm/Vite typecheck/build.
- 34 Node interface/validation/sampling/cache/state tests passed. The same assertion
  bodies are provided as `tests/geographyIntegration.test.mjs` for Vitest; that
  Vitest wrapper has not been executed in this environment.
- 3 real Node-worker-thread tests passed: current/reference transfer, explicit data
  failure, and cancellation followed by a fresh solve. A bridge supplies the browser
  channel and pinned local fetch bytes. The transferred current field matches the
  same-runtime direct annual driver byte-for-byte. This is NOT browser-worker E2E.
- Chromium OFFLINE view-unit checks passed with the actual emitted view/client
  modules and audited numerical fixture: point/date/longitude routing, poles,
  invalid JSON atomicity, preservation of focused numeric edits during asynchronous repaint,
  language/difference views and 390 × 844 Large without
  horizontal overflow. Screenshots prominently identify fixture-only evidence.
- Actual Chromium navigation to the local HTTP preview was blocked by administrator
  policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). No network policy was changed. Therefore
  real browser module-worker loading, full-page E2E, Vite production bundling,
  macOS WebKit and physical iPhone Safari remain unverified for this patch.

## Next acceptance, via the correct local session

Use `S01a060ed47 / GPT本家瑞希ちゃん向け窓口👩 260902`, resolving a fresh Relay target
when sending. Never send to the old📦session. This artifact has not been sent.

1. Inspect fresh Git/worktree status and protect unrelated edits. Apply only to
   the reviewed physics/data branch or a clean descendant with unchanged bases.
2. Run npm install-from-lock, normal docs/typecheck/unit/build and the added
   Vitest tests. Start/reuse the existing LOCAL Vite dev server without changing
   tailnet/public configuration, then run
   `npx playwright test --config=playwright.geography.config.ts`.
3. Inspect both browser engines' actual screenshots, cancellation, stale results,
   per-condition memory/latency and validated-file races. Don't bless fixtures as E2E.
4. The dev server can expose a second HTML page, but the existing Vite release
   build only has its original entry. Decide/verify multi-page production entries
   before claiming that the new page is built or deployed. Do not overwrite the
   original main entry or silently add this preview to the stable release.
5. After review, connect to the original 3D globe/Compare/Atlas/schema through an
   explicit shared contract. This patch does not claim that step is complete.

References: existing `DESIGN-v1.3-earth-geography.md` and `data/README.md`;
WHATWG Worker termination (https://html.spec.whatwg.org/multipage/workers.html);
Vite multi-page build (https://vite.dev/guide/build.html#multi-page-app).
