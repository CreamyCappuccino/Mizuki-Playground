# Earth Axial Tilt Lab

**1.0.0-rc.1 — Compare Lab and release candidate**

An interactive, bilingual science toy: tilt Earth, follow a day or year, and compare two hypothetical worlds. Static Vite + TypeScript + Three.js; no backend or runtime remote imagery required.

[Start developing](START_HERE.md) · [日本語ガイド](docs/GUIDE.ja.md) · [English guide](docs/GUIDE.en.md) · [Science](docs/SCIENCE.md) · [Roadmap](ROADMAP.md) · [Release gate](docs/RELEASE_CHECKLIST.md)

## What you can explore

- **Single Earth:** exact 0–90° tilt, presets, date, independent rotation, city presets and globe picking.
- **Three clocks:** frozen-date Play day; fixed-spin Play year; coupled spin + orbit using one mean-model clock.
- **Compare Lab:** independent A/B tilts with a shared date, rotation, location, camera, model, heat storage and colour scale. Signed A−B daylight, daily solar and temperature values. Side-by-side on desktop, stacked on narrow screens. Both close-up and Sun-centred orbit views work in comparison.
- **Five layers:** Earth, instantaneous Sun now, daily-mean solar, daylight and experimental temperature.
- **Thermal EBM:** adjustable global heat storage; original illustrative model retained. No city calibration or hourly weather model.
- **Year / Day graphs:** pointer and keyboard selection; A/B annual reference in comparison. Day graph describes A only.
- **Season atlas:** all latitudes across a year; its reference remains 23.44°, explicitly labelled even when A/B comparison is open.
- **Accessible exploration:** Japanese/English, contextual ? guides, persistent large text, optional Basic/All tools and dismissible introduction.
- **Presentation:** shared-resource dual rendering, local 4K day/night imagery, optional fixed night lights, atmosphere, artistic Sun, quality choices and Focus for single or dual views.

## Quick start

From this project directory with Node **22.12 or later**:

```bash
npm ci
npm run dev
```

Open the address printed by Vite. Stop with Ctrl+C. For a production preview:

```bash
npm run build
npm run preview
```

The committed package lock is authoritative. `npm ci` installs exactly that dependency graph. Do not copy a lock from a different project or update dependencies unintentionally while modifying a UI label.

## First experiments

**Seasons:** Orbit overview → 90° → Play year. The planet moves; its axis does not chase the Sun.

**Day/night:** Sun now → Noon here → View location → Play day. Instantaneous light changes, daily averages do not.

**A/B:** Compare Earth A/B → 23.44° / 90° → Daylight. Same date and location, different tilt. Set B to 23.44° to check zero differences.

**Both motions:** Coupled motion. At ×1 one model day takes ten real seconds; ×4 and ×12 preserve the same rotation/orbit ratio. Play year remains the faster way to browse seasons.

## Verification and release status

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
# On a supported macOS system, for the additional engine suite:
npx playwright install webkit
npm run test:e2e:webkit
```

CI installs from the lock, checks documentation links/translations/IDs, typechecks, runs unit tests, builds, and exercises Chromium plus selected macOS WebKit flows. Browser screenshots and traces are evidence. A small Chromium-only golden image checks the Japanese comparison panel; GPU views are checked by geometry, actual captures and A=B rendering invariants rather than universal pixel identity across different GPUs.

**RC is deliberate:** automated WebKit is not a physical iPhone running branded Safari. The on-device checklist remains open until real observations are recorded. No public site deployment has been performed or authorized by this change. See [v1.0 candidate](docs/V1.0.md) and [release checklist](docs/RELEASE_CHECKLIST.md).

## Scientific boundaries

Solar energy is at the top of the atmosphere. Temperature is a daily-mean-style latitude-band experiment, not a forecast or daytime maximum. Geometry is a 365-day circular model, not a real-time ephemeris. World sizes and distances are illustrative. A and B are two separate hypothetical worlds, not two Earths occupying one solar system.

Since v0.9 the orbital frame and eastward spin use the same prograde handedness. A 365-mean-solar-day model year contains **366 inertial turns**, not 365. This corrects the earlier isolated-animation orientation while leaving seasonal solar energy and climate equations unchanged. See [coordinate and clock definitions](docs/SCIENCE.md).

## Documentation and assets

[Development handoff](START_HERE.md) is current state; [roadmap](ROADMAP.md) is future work; version notes describe what actually changed. Older material is [history](docs/HISTORY.md), not a current backlog. Update the affected documents with code changes.

Earth imagery: Solar System Scope / INOVE, CC BY 4.0, redistributed via three.js. [Sources and hashes](src/assets/ATTRIBUTION.md). The Sun is procedural decoration. Runtime fonts are system fonts.
