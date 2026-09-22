# Earth Axial Tilt Simulator

Interactive 3D visualization for exploring how Earth's axial tilt changes seasons, sunlight, day length, and simplified climate patterns.

This project lives inside **Mizuki-Playground** but remains self-contained.

## Current milestone

- Three.js 3D Earth with atmosphere, star field, sunlight direction, orbital plane, and visible rotation axis
- Adjustable axial tilt from 0° to 90°
- Day-of-year control and animated yearly playback
- Surface modes for normal Earth, daily mean insolation, day length, and estimated temperature
- Location presets including Taipei, Tokyo, Singapore, London, New York, Reykjavík, Tromsø, and the North Pole
- Click/tap the globe to inspect an arbitrary latitude/longitude
- Annual graphs for temperature estimate, insolation, and daylight
- Unit tests for solar geometry, symmetry, polar day/night, extreme tilt, and climate-model invariants
- Playwright browser smoke test
- Project-scoped GitHub Actions CI

## Physics

The solar layer uses a circular-orbit approximation and computes solar declination from obliquity and orbital longitude. Day length follows the sunset-hour-angle relation, and daily mean top-of-atmosphere insolation uses the standard latitude/declination/hour-angle formulation.

The temperature layer is intentionally different: it is a compact educational estimate built from a latitude baseline, daily-mean solar anomaly, and a fixed seasonal thermal lag. It is meant to show **relative seasonal response to axial tilt**, not reproduce real-world weather or a general circulation model.

## Run locally

```bash
npm install
npm run dev
```

Verification:

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## First demo to try

Set **Axial tilt = 90°**, then move the day-of-year slider between the June and December solstices. The extreme polar-season geometry is the point of the project. 🌍
