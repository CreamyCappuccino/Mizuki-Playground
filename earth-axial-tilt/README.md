# Earth Axial Tilt Lab

**1.3.0-alpha.2 review candidate — Real Earth coarse-cell geography**

An interactive, bilingual science toy: tilt Earth, follow a day or year, and compare two hypothetical worlds. Static Vite + TypeScript + Three.js; no backend or runtime remote imagery required.

[Start developing](START_HERE.md) · [日本語ガイド](docs/GUIDE.ja.md) · [English guide](docs/GUIDE.en.md) · [Science](docs/SCIENCE.md) · [Roadmap](ROADMAP.md) · [Release gate](docs/RELEASE_CHECKLIST.md)

## New in the 1.3 alpha

Open **Climate geography** to compare two deliberately idealized materials at the same latitude and under the same orbit: **Idealized land** reuses the existing Fast 2.5 m-equivalent heat capacity, while **Idealized ocean** reuses Slow 50 m-equivalent storage. With A/B Compare closed, the solid annual curve is the selected material and the dashed curve is its counterpart; while comparing, the dashed annual curve is world B. The Season atlas difference layer always uses the land/ocean pairing, so seasonal amplitude and lag can be inspected without changing sunlight.

The idealized profiles still cover the whole model world with one material. The new **Earth geography** profile is separate: fixed 18×36 / 10° Natural Earth cells and the reviewed educational two-dimensional EBM. Classic and idealized numerical results remain unchanged. See [v1.3](docs/V1.3.md).

### Experimental real-geography preview

The main page now connects **Earth geography** to the nearest-cell 3D temperature layer, selected place, annual curve, A/B Compare and selected-longitude Season atlas. One serialized worker lane serves A/B/reference; stale/error/canceled fields expose no temperatures, and explicit retry restarts canceled work. The Atlas reference is 23.44° at A's orbit and the same mask, never B or uniform ocean. Schema 4 owns this profile; old schemas 1–3 retain their earlier meanings. The [separate preview](geography-lab.html) remains a component reference. A coarse land fraction describes the surrounding 10° cell, not whether the exact selected point is land or ocean. This is a **review branch**, not approval to change main or the existing MagicDNS serving clone.

The geography model still omits topography, winds, ocean currents, latent heat, clouds, ice feedback and weather. Its 10° resolution is a scientific model condition, not a graphics-quality setting. Source/data/solver boundaries and independent numerical checks are documented in [the geography design](docs/DESIGN-v1.3-earth-geography.md) and [browser slice design](docs/DESIGN-v1.3-earth-geography-browser.md).

## Orbit mechanics from the 1.2 candidate

Open **Orbit laboratory** in the left controls. Change eccentricity (0–0.3), the apparent Sun direction at perihelion and the static axis azimuth independently for A/B. Follow the Kepler orbit: distance, speed, inverse-square incoming solar energy and unequal seasonal durations stay consistent across the scene, daily/year graphs, comparison and thermal model. Perihelion/aphelion shortcuts, four seasonal markers and English/Japanese contextual help make the geometry inspectable. **Classic circle** restores the original orbital conditions.

Three new questions compare different orbits at the same tilt, summer versus winter perihelion, and an upright Earth on an ellipse. The seven old questions remain circular and unchanged. Every world anchors its northern-spring reference to model day 80. This is a fixed 365-day experiment, not a shared historical epoch or an astronomical calendar. Static axis azimuth is not a long-term precession trajectory. See [v1.2](docs/V1.2.md).

## Reproduce and share

Open **Experiments & sharing** in the left controls. Eleven question-based presets prepare polar sunlight, zero tilt, Taipei day/night, polar night, fast/slow heat storage, idealized land/ocean response and coupled motion. Preparation pauses playback, restores a useful view and reports the conditions. **Undo experiment** restores the previous scientific state.

**Copy experiment link** creates a versioned, bounded URL fragment. **Save / Load settings file** works across installations without requiring a public website. Schema-3 URLs/files restore A/B tilts and separate orbital parameters, time, coordinates, layers, model, global heat storage and the climate profile; language, typography, quality and playback are never imported. Values are recomputed, not copied from an old thermal solution. Schema-1 links migrate to the classic circle and schema-2 links retain their orbits; both migrate to Classic latitude bands. Invalid or future-version data leaves the experiment unchanged. Links are snapshots, not live-synchronized sessions.

A `localhost` URL points to the receiving device, not to your Mac. Use a settings file in another installed copy, or a shared app host only after deployment is separately approved. No server, upload, user tracking or automatic publication is added. See [v1.1](docs/V1.1.md) and the [state format](docs/EXPERIMENT_STATE.md).

## What you can explore

- **Single Earth:** exact 0–90° tilt, presets, date, independent rotation, city presets and globe picking.
- **Three clocks:** frozen-date Play day; fixed-spin Play year; coupled spin + orbit using one mean-model clock.
- **Compare Lab:** independent A/B tilts and orbits with shared elapsed model time, rotation, location, camera, model, heat storage and colour scale. Signed A−B daylight, daily solar and temperature values. Side-by-side on desktop, stacked on narrow screens. Both close-up and Sun-centred orbit views work in comparison.
- **Five layers:** Earth, instantaneous Sun now, daily-mean solar, daylight and experimental temperature.
- **Thermal EBM:** Classic uniform heat storage, idealized response profiles, or real geography at fixed 10° resolution; original illustrative model retained. No city calibration or hourly weather model.
- **Year / Day graphs:** pointer and keyboard selection; A/B annual reference in comparison. Day graph describes A only.
- **Season atlas:** all latitudes across a year. Classic compares A with 23.44° at A's orbit/storage; an idealized geography profile compares land with ocean at A's tilt/orbit. Neither reference silently becomes B.
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

Since v0.9 the orbital frame and eastward spin use the same prograde handedness. A 365-mean-solar-day model year contains **366 inertial turns**, not 365. This corrects the earlier isolated-animation orientation while preserving the original circle’s seasonal results. All astronomical forcing follows the selected orbit. The v1.3 idealized comparison changes only effective heat capacity and keeps the original EBM radiation, transport and albedo coefficients. See [coordinate, clock and climate definitions](docs/SCIENCE.md).

## Documentation and assets

[Development handoff](START_HERE.md) is current state; [roadmap](ROADMAP.md) is future work; version notes describe what actually changed. Older material is [history](docs/HISTORY.md), not a current backlog. Update the affected documents with code changes.

Earth imagery: Solar System Scope / INOVE, CC BY 4.0, redistributed via three.js. [Sources and hashes](src/assets/ATTRIBUTION.md). The Sun is procedural decoration. Runtime fonts are system fonts.
