# Verification — Planet Synthesis 2.4.0-rc.1

## Base and checkpoint sequence

Base accepted main is `055131958304cb980b79a1a9c384ef595b0b11bf` (v2.1 plus
independent Earth overlay toggles). Existing serving clone was confirmed at this
SHA in Relay ERM000290 before starting the new work.

The workspace/dependency snapshot CI94 was **not acceptance**. Its temporary
workflow was replaced with the original full pipeline before all acceptance runs;
the only final workflow change is adding the new browser suites to the existing
macOS WebKit loop. Dependencies and lockfile resolution remain unchanged.

### v2.2 Uranus

Immutable checkpoint `6508114285c1c9f2e03c3572637daa0de415a47f` passed full
CI95 / run36889307531 (completed2026-10-01T16:16:02Z). Both jobs passed, including
all existing regressions and the new Uranus browser tests. Cloud verification
passed301tests/31files plus docs/typecheck/build. Actual Chromium and WebKit
captures `uranus-earth90.png` and `uranus-mobile-ja.png` were read. The latter
captures a scrolled Japanese Large numeric region, not a whole mobile page.

### v2.3 Mercury

Implementation checkpoint `3f2588c3f6401faacbfa5d8b45b3c3c7952968b1` passed full
CI96 / run36890920337 (completed2026-10-01T16:29:24Z). Both jobs succeeded.
Chromium and WebKit Mercury desktop and Japanese Large captures were inspected;
the perihelion zoom visibly shows the solar reversal and three horizon crossings.
Review caught a last-frame pause/input mismatch after animation; the v2.4
candidate synchronizes the time controls on pause and tests exact agreement
between the input and rendered accepted time. No astronomy formula changed.
Focused cloud tests pass18tests across3files (Mercury7, Uranus5, legacyPlanet6).

### v2.4 release candidate

The final candidate must pass full same-HEAD CI before main advances. This file
records test design and earlier immutable evidence, not an advance declaration
that a later run passed. Final run/SHA and serving evidence are also recorded in
the MCP development index after they are actually observed.

Cloud verification of the integrated v2.4 candidate passes313tests/33files,
39document checks, strict TypeScript and production build. A byte comparison with
the archived base finds50original files in physics/scene/feedback/synthesis/
experiments unchanged; original main.ts is also unchanged. The dependency graph
matches the base after excluding only package version metadata.

## Independent numerical checks

- Uranus: directed-pole dot-product geometry, inclination97.77°, maximum
  declination82.23°, positive/negative polar illumination,90°/180° limits.
-45frozen-rotation cases compared against14,400longitude quadrature samples,
  tolerance5e-5W/m². Geometry and averaged irradiance agree without changing Earth.
- Mercury:604orbit points compared with independent80-step bisection and half-angle
  true anomaly, not production Newton iteration.3:2two-orbit closure, circular
  non-reversal, analytic rate vs finite differences, independent hour-angle flux,
  and three horizon crossings near perihelion at model meridian90°.
- Four-world annual flux:1024equal-time midpoint samples for each planet compared
  with the analytic inverse-square time average. All16planet pairs and4tilt
  choices round-trip without flattening state. Native definitions remain unchanged.

## Browser acceptance responsibilities

`e2e/v22.spec.ts`: Uranus/Earth90, native/custom controls, shared clocks, invalid
drafts, paused hash restore and Japanese Large with blocked storage.
`e2e/v23.spec.ts`: coupled Mercury motion, perihelion reversal vs circular case,
two-orbit closure, zoom, link/CSV and Japanese Large390px.
`e2e/v24.spec.ts`: four-world gallery/A-B choices, five presets, comparison/native
CSV, stale-link reporting, four-world restore, gallery table overflow containment,
Japanese Large and navigation to Mercury. Full-page final evidence is generated.
All new suites run on Chromium and macOS WebKit, together with old suites.

This cloud runtime denied localhost Chromium navigation with
`ERR_BLOCKED_BY_ADMINISTRATOR`; no bypass was attempted and local screenshot
success is not claimed. Browser evidence comes from the repository's authorized
CI runners. Physical iPhone Safari remains a separate human gate.

## Non-claims and deployment

This is numerical consistency of fixed teaching models, not climate calibration
or astronomical ephemeris accuracy. Non-Earth temperatures remain unavailable.
No new public deployment, network exposure, secrets, cloud service, or dependency
is added. Main synchronization, Lite local pull and actual M4 serving HTTP are
verified separately. CI metadata, screenshots and user-visible completion must
refer to the same final accepted code.
