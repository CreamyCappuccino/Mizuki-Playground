# Earth Axial Tilt Lab

**1.2.0-rc.1 — Earth orbit mechanics and reproducible experiments**

An interactive, bilingual science toy: tilt Earth, follow a day or year, and compare two hypothetical worlds. Static Vite + TypeScript + Three.js; no backend or runtime remote imagery required.

[Start developing](START_HERE.md) · [日本語ガイド](docs/GUIDE.ja.md) · [English guide](docs/GUIDE.en.md) · [Science](docs/SCIENCE.md) · [Roadmap](ROADMAP.md) · [Release gate](docs/RELEASE_CHECKLIST.md)

## New in the 1.2 candidate

Open **Orbit laboratory** in the left controls. Change eccentricity (0–0.3), the apparent Sun direction at perihelion and the static axis azimuth independently for A/B. Follow the Kepler orbit: distance, speed, inverse-square incoming solar energy and unequal seasonal durations stay consistent across the scene, daily/year graphs, comparison and thermal model. Perihelion/aphelion shortcuts, four seasonal markers and English/Japanese contextual help make the geometry inspectable. **Classic circle** restores the original orbital conditions.

Three new questions compare different orbits at the same tilt, summer versus winter perihelion, and an upright Earth on an ellipse. The seven old questions remain circular and unchanged. Every world anchors its northern-spring reference to model day 80. This is a fixed 365-day experiment, not a shared historical epoch or an astronomical calendar. Static axis azimuth is not a long-term precession trajectory. See [v1.2](docs/V1.2.md).

## Reproduce and share

Open **Experiments & sharing** in the left controls. Ten question-based presets prepare polar sunlight, zero tilt, Taipei day/night, polar night, fast/slow heat storage and coupled motion. Preparation pauses playback, restores a useful view and reports the conditions. **Undo experiment** restores the previous scientific state.

**Copy experiment link** creates a versioned, bounded URL fragment. **Save / Load settings file** works across installations without requiring a public website. Schema-2 URLs/files restore A/B tilts and separate orbital parameters, time, coordinates, layers, model and global heat storage; language, typography, quality and playback are never imported. Values are recomputed, not copied from an old thermal solution. Schema-1 links/files migrate to the classic circle. Invalid or future-version data leaves the experiment unchanged. Links are snapshots, not live-synchronized sessions.

A `localhost` URL points to the receiving device, not to your Mac. Use a settings file in another installed copy, or a shared app host only after deployment is separately approved. No server, upload, user tracking or automatic publication is added. See [v1.1](docs/V1.1.md) and the [state format](docs/EXPERIMENT_STATE.md).

## What you can explore

- **Single Earth:** exact 0–90° tilt, presets, date, independent rotation, city presets and globe picking.
- **Three clocks:** frozen-date Play day; fixed-spin Play year; coupled spin + orbit using one mean-model clock.
- **Compare Lab:** independent A/B tilts and orbits with shared elapsed model time, rotation, location, camera, model, heat storage and colour scale. Signed A−B daylight, daily solar and temperature values. Side-by-side on desktop, stacked on narrow screens. Both close-up and Sun-centred orbit views work in comparison.
- **Five layers:** Earth, instantaneous Sun now, daily-mean solar, daylight and experimental temperature.
- **Thermal EBM:** adjustable global heat storage; original illustrative model retained. No city calibration or hourly weather model.
- **Year / Day graphs:** pointer and keyboard selection; A/B annual reference in comparison. Day graph describes A only.
- **Season atlas:** all latitudes across a year; its reference remains 23.44° with A’s orbit and heat storage, explicitly labelled even when A/B comparison is open.
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

Solar energy is at the top of the atmosphere. Temperature is a daily-mean-style latitude-band experiment, not a forecast or daytime maximum. Geometry uses a fixed 365-day model year: the classic circle or Kepler ellipses with semimajor axis 1 au. Day 80 is each world’s spring reference, not a shared real epoch. World sizes and distances are illustrative. A and B are two separate hypothetical worlds, not two Earths occupying one solar system.

Since v0.9 the orbital frame and eastward spin use the same prograde handedness. A 365-mean-solar-day model year contains **366 inertial turns**, not 365. This corrects the earlier isolated-animation orientation while preserving the original circle’s seasonal results. In v1.2 all astronomical forcing follows the selected orbit; EBM coefficients are unchanged. See [coordinate and clock definitions](docs/SCIENCE.md).

## Documentation and assets

[Development handoff](START_HERE.md) is current state; [roadmap](ROADMAP.md) is future work; version notes describe what actually changed. Older material is [history](docs/HISTORY.md), not a current backlog. Update the affected documents with code changes.

Earth imagery: Solar System Scope / INOVE, CC BY 4.0, redistributed via three.js. [Sources and hashes](src/assets/ATTRIBUTION.md). The Sun is procedural decoration. Runtime fonts are system fonts.
