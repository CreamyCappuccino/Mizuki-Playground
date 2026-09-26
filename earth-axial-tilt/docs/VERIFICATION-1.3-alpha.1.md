# v1.3 alpha 1 verification record

Date: 2026-09-26  
Feature track: `1.3.0-alpha.1`  
Base main: `836498136afa12f539a1ab0def87a117a458e8c0`

This record covers the idealized land/ocean seasonal-response slice. It does
not close the full v1.3 geographic-Earth roadmap, the physical iPhone Safari
gate or public deployment.

## Local scientific and build checks

- `npm ci`: completed from the committed lock, 50 packages, 0 vulnerabilities.
- `npm run check:docs`: 22 documents, 167 unique HTML IDs and 384 Japanese keys.
- `npm run typecheck`: passed.
- `npm test`: 13 files, 137 tests passed.
- `npm run build`: passed with 48 transformed modules.
- `git diff --check`: passed.

The v1.3 unit cases verify that Classic arrays remain unchanged, Idealized
Land is exactly the inherited Fast 2.5 m calculation, Idealized Ocean is
exactly the inherited Slow 50 m calculation, land has the larger/earlier
mid-latitude seasonal response, annual means agree to tolerance, profile
provenance rejects mismatches, Atlas uses the counterpart material, schema 3
round-trips and schema 1/2 migrate to Classic. Review regressions also verify
that idealized cache keys retain the raw Classic depth instead of colliding at
the effective depth.

## Browser checks

Focused v1.3 Chromium: 6/6 passed. Screenshots were opened at original
resolution and checked for control legibility, Atlas difference semantics,
mobile Japanese Large text, Compare, Orbit and Focus:

- `v13-climate-geography-controls.png`
- `v13-idealized-reference-routing.png`
- `v13-land-ocean-atlas.png`
- `v13-ocean-compare-focus-ja.png`

Full local Chromium: 75 passed and three failed in the eight-worker run. Two
older interaction/layout cases (precise tilt input and Japanese mobile dual
viewport placement) passed immediately when rerun together with one worker,
so they are recorded as local parallel timing failures rather than changed
behavior. The remaining failure is the existing pinned Japanese-panel image:
all text rasterized more heavily and the element height changed from 366 to
367 pixels. The expected and actual content/layout were inspected; no semantic
text or control changed. The golden image was deliberately not replaced
without same-environment CI evidence.

The exact macOS WebKit CI suites (`v06` through `v13`, one worker and a fresh
browser per suite) passed: 55 passed and one Chromium-only golden check skipped.
The amended `v13` suite passed 6/6, including retained-depth cache provenance
and Atlas reference invalidation in both directions. A broader earlier non-CI
run of all 76 WebKit tests also
found three old `v04` pointer-boundary expectations one unit low (`365` vs
`364`, `12:00` vs `11:59`); those suites are outside the established WebKit
gate and no unrelated test or graph behavior was changed in this slice.

## Remaining gates

- Same-HEAD GitHub CI must pass after the review branch is pushed/dispatched.
- Physical iPhone Safari remains separate and pending.
- A real land/ocean mask remains deferred until a longitude-aware model,
  weighting, transport and Atlas design are specified and validated.
- Public deployment requires separate authorization.
