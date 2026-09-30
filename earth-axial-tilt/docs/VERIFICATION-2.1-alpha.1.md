# Verification — 2.1.0-alpha.1

## Candidate scope

Planet Lab v2.0 Foundation + v2.1 Mars astronomy-first.

The accepted Earth v1.x physics/state implementations remain in place. The candidate adds a separate
planet-generic astronomy layer, a thin Earth adapter, and an independent `planet-lab.html` workspace.

## Pre-record full CI evidence

Branch candidate `0ced68996d4dac63660496d84e1b77c058f13b25` completed
Earth Axial Tilt CI **#85 / run 36765298469** successfully.

The run included:

- reproducible `npm ci`
- document/translation checks
- TypeScript strict typecheck
- complete unit suite, including Planet Lab regression tests
- production build including `planet-lab.html`
- complete Chromium regression suite
- macOS WebKit regression suite, explicitly including `e2e/v21.spec.ts`

This is browser automation evidence. It is **not** the separate physical-iPhone Safari human gate.

## Planet foundation regression

`tests/planet.test.ts` checks the thin Earth adapter against the untouched v1.x orbit/solar routines
across circular and eccentric cases and several seasonal longitudes. The generic layer must preserve:

- Earth Sun distance
- Earth TOA irradiance scaling
- elapsed model time from northern spring
- solar declination
- daylight duration

The new capability model also checks that Earth can point to existing Earth climate workspaces while
Mars explicitly reports no temperature model.

## Mars v2.1 acceptance

The Mars definition supplies astronomy/rotation constants only. The workspace compares Earth and Mars at
a common seasonal longitude Ls and latitude and reports:

- Sun distance
- ray-normal TOA solar flux
- subsolar latitude
- daylight in each world's own mean solar-day hours
- orbital-year length
- elapsed time since northern spring
- orbital speed relative to the circular speed at the same semimajor axis

Tests cover Mars perihelion/aphelion distance, flux ordering, year length in sols, and its own solar-day
duration. Browser tests cover Earth/Mars selection, explicit unavailable Mars climate, Japanese/Large
presentation, seasonal presets, and versioned URL state.

## State boundary

Planet Lab state is independent `planet=1` fragment state. It does not replace or migrate Earth schema
1–4, `earth-feedbacks v1`, or `earth-synthesis v1`. Duplicate owned fields, unknown planets, unknown
versions, and out-of-range Ls/latitude are rejected.

## Explicit non-claims

v2.1 does not provide:

- a Mars temperature/climate/habitability model
- a dated Mars ephemeris
- atmosphere, dust, weather, or surface thermal-inertia simulation
- physical iPhone Safari acceptance
- public deployment

## Final gate

After this verification record is committed, the latest branch HEAD must pass the same CI again before
merge. The successful pre-record run above establishes the implementation evidence; the final run
establishes same-HEAD integrity including this document.
