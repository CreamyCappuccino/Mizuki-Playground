# Earth Axial Tilt Simulator

**Start here:** [Handoff / 次の瑞希へ](START_HERE.md) · [日本語の使い方](docs/GUIDE.ja.md) · [Current release: v0.8](docs/V0.8.md)

## v0.8 — bilingual guided orbit lab

Use **Language / 言語 → 日本語** for Japanese labels, live readouts, graphs, atlas and help. The language choice does not reset the experiment. Hover over a **?** for a preview; click/tap for a guide explaining what to change and what to watch.

**Viewpoint → Orbit overview** puts the Sun at the centre and Earth on a visible circular orbit. The axis keeps its inertial direction while Play year moves Earth. Four seasonal-position buttons and Fit orbit make the relationship easy to inspect; View location returns to the close-up. The Sun has a static procedural surface and corona. This is a display transformation, not a new orbit/climate model, and all sizes/distances are illustrative.

The previous physics, large typography, Focus view, quality controls and local imagery are retained. See [v0.8](docs/V0.8.md) for implementation/verification and [START_HERE](START_HERE.md) for the shortest route into future work.

## v0.7 — an unobstructed observatory

Use **Focus view** in the header to hide the panels; **Show controls** or Escape brings them back without changing the planet. The large-text preference remains in place. Portrait views keep the globe comfortably framed.

**Quality → Eco / Balanced / High** controls real drawing-buffer resolution and texture filtering only; the climate model does not change. The preference is saved when browser storage is available. Settled views stop submitting identical WebGL frames while live camera/playback changes still render.

Day and night images are now **local 4K assets**. Earth view adds Sun-masked fixed night lights and a Sun-facing atmospheric limb. Night lights can be switched off; lights and the decorative atmosphere are hidden on scientific layers. There is no cloud/weather/city evolution model. Missing image status is visible and the numerical tools remain usable.

Earth artwork: **Solar System Scope / INOVE, CC BY 4.0**, redistributed from the three.js texture collection. [Attribution and exact asset hashes](src/assets/ATTRIBUTION.md), [v0.7 details](docs/V0.7.md).

## v0.6 — season atlas

Open **Season atlas** in the location panel to see a full latitude-by-year map in a roomy dialog. It preserves Comfort/Large typography and the original globe layout.

- Daily solar, daylight and temperature across all 365 model days, north at the top.
- **Difference from 23.44°** subtracts the same metric at the same latitude/day, with the same temperature model and heat storage. It is not a measured-climate baseline. Blue is lower, pale is zero, warm is higher.
- Change obliquity (including exact numeric input and 90° preset) or heat storage inside the atlas. Temperature reuses the existing worker solution; astronomy remains usable while it is pending or unavailable.
- Click/tap a location on the map or use the labelled day and latitude sliders. Selection changes the model day and latitude, retaining longitude and rotation. Changing the latitude selects a custom point, not a different city. **View this selection on Earth** closes the atlas and points the camera at it.
- The dashed curve is the Sun's subsolar latitude, not a temperature boundary. Hovering and scrolling never seek; native sliders supply a keyboard equivalent.
- Cached raster: moving a selection changes only its crosshair, not the entire field. No new dependencies or climate coefficients.

Try **90° → Daylight**, then **Temperature → Difference from 23.44°**, and compare Fast/Mixed/Slow heat storage. Read each legend: thermal and difference scales adapt to the whole sampled field. See [v0.6 notes](docs/V0.6.md) for sampling, exact-value semantics and verification.


Interactive 3D science toy for exploring how axial tilt changes sunlight, daylight and seasonal temperature experiments. A self-contained project inside **Mizuki-Playground**.

## v0.5 — heat storage and seasonal energy balance

**Thermal EBM** is the new default temperature mode. Instead of a fixed 28-day shift, a small one-dimensional energy-balance solver computes heat storage, absorbed sunlight, outgoing radiation and diffusive exchange between latitude bands. Switch **Temperature model** to **Illustrative** to recover the exact earlier temperature calculations.

Use **Heat storage → Fast / Mixed / Slow** to change the whole planet's effective heat capacity. At the same tilt, a larger heat capacity reduces seasonal variation and delays the warmest season. All three are experiments, not local land/ocean classifications. The globe's thermal colours, location readout and annual graph share one solved field. Earth-reference comparisons use the same model and heat capacity at 23.44 degrees.

The solver works in a Web Worker, reuses a periodic year, and coalesces rapid edits. Pending or failed thermal values are never silently replaced by old temperatures. Astronomy, daylight and Sun now remain independent. Large-font controls and graph navigation from v0.4 are preserved.

**Important:** this is still not a station-calibrated climate model. Fixed albedo, linear radiation and no ice/cloud/latent-heat feedback make extreme-tilt absolute temperatures highly illustrative. Large extrapolations are flagged; the solver does not secretly clip its output. Changing settings selects a new equilibrated climate, not the first real year after abruptly tilting Earth.

Try **Taipei → Temp → Year**, change Heat storage from Fast to Slow, then switch tilt between Earth and 90 degrees. **Compare Earth** holds the chosen heat storage fixed. Details, numerical verification, parameter units and primary references: [science notes](docs/SCIENCE.md), [v0.5 notes](docs/V0.5.md).

## v0.4 — readable controls and hands-on graphs

- **Larger text by default:** right-panel metric values are 22 CSS px; ordinary labels and explanations are 14–15 px at the browser's default 16 px root size. Text size → **Large** raises values to 24 px and explanations to 16–17 px. This local display preference persists when browser storage is available.
- **Readable graph labels:** annual and daily SVGs are laid out at the actual container dimensions. Tick labels remain 14 px (16 px in Large) instead of being scaled down with a fixed 720-pixel drawing. Narrow graphs omit some labels rather than shrink the text.
- **Direct graph selection:** click/tap or drag horizontally on Year to select a whole model day, or on Day to choose local solar time to the nearest minute. Selection pauses either transport and leaves the chosen graph's curve intact.
- **Keyboard:** focus the graph and use arrows (1 day / 15 minutes), Page Up/Down (30 days / 1 hour), Home or End. The last selectable solar time is 23:59, avoiding an unexpected wrap to 00:00 at the right edge. Existing native sliders remain available.
- **Polar semantics:** when a local solar meridian is undefined, the daily chart explicitly selects nominal rotation time. It does not invent a clock time at a geographic or subsolar pole.
- **Responsive panels:** phone/tablet layouts put Earth above the panels; narrow metric cards wrap without ellipsis. **Explore the graph** scrolls directly to the graph controls. Vertical touch gestures on a graph scroll rather than seek.
- The selected graph position is also shown as readable text with units and an accessible slider value. Calendar month/day labels are conveniences for the existing circular model, not a new astronomical ephemeris.

The astronomy, temperature coefficients, Three.js scene and external Earth-texture policy are unchanged from v0.3. This release does not calibrate city climates or add daily maximum/minimum temperatures. See [v0.4 implementation notes](docs/V0.4.md).

## v0.3 — a day inside the year

- **Earth rotation** is a real surface rotation around the tilted local axis, separate from mouse/touch camera orbit. A 0–360-degree phase slider and **Play day** hold the seasonal date fixed. **Play year** holds the rotational phase fixed. Only one transport runs at a time; the existing speed buttons apply to both.
- **Noon here / Midnight here** orient the selected meridian to local apparent solar noon or midnight. These are Sun-based times, not UTC or time-zone clock times.
- **Sun now** adds a fifth surface layer: instantaneous horizontal incoming flux at the top of the atmosphere. It uses a GPU shader driven by the same Sun direction used by the numeric physics.
- **Sun at this moment** shows local solar time, geometric Sun elevation, instantaneous TOA flux and a daytime/night/horizon indicator. At geographic poles or an exact subsolar pole, undefined solar times are labelled rather than fabricated.
- **Year / Day graph switch** retains the annual plots and Earth reference. Day plots the local 24-hour insolation cycle, with a dashed daily-mean reference and a moving cursor. Spinning does not rebuild the curve or change the daily temperature/solar mean.
- **View location / Reset view** move only the observer, with geographic picking preserved after any tilt and rotation.
- New regression tests check Three.js matrix agreement, full-rotation averaging, local hour-angle agreement, pole cases, transport isolation, unchanged annual statistics, post-rotation picking and browser-rendered changes.

Try Taipei → Sun now → Noon here → View location → Day, then Play day. Repeat with North Pole and tilt 90 degrees to see a nearly flat polar-day curve.

## v0.2 — precise controls and science guides

- **Exact angle input** beside the slider and presets: enter 0–90 degrees to two decimal places, then Enter or leave the field. Invalid/empty values keep the previous angle; Escape cancels uncommitted input.
- **Science guides:** golden subsolar point, day–night boundary, N/S axis labels and tilt arc. Toggle the guides as a group.
- **Honest units and scales:** daily-mean estimated temperature (not daytime maximum), TOA daily solar energy, colour legends, all-365-day annual averages and daily-curve ranges. Expand the explanation panel for model limits.
- **Compare Earth:** optional dashed 23.44-degree annual curve using the same model, with a shared chart scale.
- **Interaction fixes:** dragging/pinching does not select a new location; clicked coordinates/markers follow the globe texture convention.
- **Playback:** reuse annual curves and move the chart cursor; cache latitude rows for scientific globe colours and bound the climate cache. Metrics update at 10 Hz while the scene continues rendering each frame.
- **Geometry fixes:** robust exact-pole / exact-90-degree handling and consistent view-space atmosphere normals.
- **Responsive UI:** scrollable desktop panels, precise numeric entry on small viewports, no unnecessary blank mobile footer, system-font fallbacks.

The original Earth, atmosphere, star field, solar direction, orbit-plane guide, location presets and annual science layers remain available.

## Temperature is still an illustrative model

In **Illustrative** mode, temperature is a latitude baseline plus a lagged solar anomaly. **Thermal EBM** solves a seasonal energy-balance equation, but neither mode is a calibrated Earth climate model. v0.4 retains the original coefficients; it does not silently change the meaning to match local daily highs. See [the science notes](docs/SCIENCE.md) for the exact formula, real-world mean-vs-maximum examples, and the deliberately limited Earth reference comparison.

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

The project-scoped GitHub Actions workflow runs typechecking, unit tests, production build and Chromium browser tests. The v0.2/v0.3 suites cover exact-angle validation, actual SphereGeometry coordinate checks, solar/subsolar agreement, global incoming-energy conservation, polar edge cases, 365-day statistics, drag-vs-click interaction, comparison curves, playback cursor reuse and mobile-layout checks. Browser screenshots/traces are retained as CI artifacts; these captures are not yet a pixel-baseline regression suite.

The dependency ranges are unchanged from v0.1. A committed package lock and `npm ci` migration remain follow-up work. Since v0.7, Earth imagery is also bundled locally; neither images nor fonts require a runtime third-party host.
