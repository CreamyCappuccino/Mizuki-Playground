# Earth Axial Tilt Simulator

Interactive 3D science toy for exploring how axial tilt changes sunlight, daylight and an illustrative seasonal temperature estimate. A self-contained project inside **Mizuki-Playground**.

## v0.2 — precise controls and science guides

- **Exact angle input** beside the slider and presets: enter 0–90 degrees to two decimal places, then Enter or leave the field. Invalid/empty values keep the previous angle; Escape cancels uncommitted input.
- **Science guides:** golden subsolar point, day–night boundary, N/S axis labels and tilt arc. Toggle the guides as a group.
- **Honest units and scales:** daily-mean estimated temperature (not daytime maximum), TOA daily solar energy, colour legends, all-365-day annual averages and daily-curve ranges. Expand the explanation panel for model limits.
- **Compare Earth:** optional dashed 23.44-degree annual curve using the same model, with a shared chart scale.
- **Interaction fixes:** dragging/pinching does not select a new location; clicked coordinates/markers follow the globe texture convention.
- **Playback:** reuse annual curves and move the chart cursor; cache latitude rows for scientific globe colours and bound the climate cache. Metrics update at 10 Hz while the scene continues rendering each frame.
- **Geometry fixes:** robust exact-pole / exact-90-degree handling and consistent view-space atmosphere normals.
- **Responsive UI:** scrollable desktop panels, precise numeric entry on small viewports, no unnecessary blank mobile footer, system-font fallbacks.

The existing 3D Earth, atmosphere, star field, solar direction, orbit-plane guide, location presets, custom picking, four surface modes and yearly playback are retained.

## Temperature is still an illustrative model

Temperature is a latitude baseline plus a lagged solar anomaly, **not a calibrated Earth climate model or solved energy-balance model**. v0.2 retains the original coefficients; it does not silently change the meaning to match local daily highs. See [the science notes](docs/SCIENCE.md) for the exact formula, real-world mean-vs-maximum examples, and the deliberately limited Earth reference comparison.

## Run locally

From this directory (not the repository root), with Node 22:

```bash
npm install
npm run dev
```

Open the local address shown by Vite. For a production preview:

```bash
npm run build
npm run preview
```

Stop the server with Ctrl+C.

## Verification

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The project-scoped GitHub Actions workflow runs typechecking, unit tests, production build and Chromium browser tests. The v0.2 suites add exact-angle validation, actual SphereGeometry coordinate checks, solar/subsolar agreement, global incoming-energy conservation, polar edge cases, 365-day statistics, drag-vs-click interaction, comparison curves, playback cursor reuse and mobile-layout checks. Browser screenshots/traces are retained as CI artifacts; these captures are not yet a pixel-baseline regression suite.

The dependency ranges are unchanged from v0.1. A committed package lock and `npm ci` migration remain follow-up work. The Earth texture still has a runtime external URL dependency; fonts no longer do.
