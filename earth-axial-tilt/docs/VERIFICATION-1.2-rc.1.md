# Verification — 1.2.0-rc.1

Date: 2026-09-26  
Candidate branch: `codex/earth-v1.2-orbit-lab`

## Automated checks

- `npm ci`: completed from the committed lock, 0 vulnerabilities.
- `npm run check:docs`: 21 documents, 164 unique HTML IDs and 362 Japanese message keys.
- `npm run typecheck`: passed.
- `npm test`: 126 passed in 13 files.
- `npm run build`: passed with Vite 8.3.1.
- Chromium: 69 passed, including all five v1.2 tests.
- macOS Playwright WebKit: v06–v12 final results total 46 passed and one intentional Chromium-only golden-image test skipped.

The first sequential WebKit run timed out once in the pre-existing v06 mobile Atlas test because `#atlas-plot` remained hidden. The test then passed alone (1/1) and the complete v06 file passed on immediate clean rerun (6/6). It did not reproduce in Chromium or later WebKit runs; this is recorded as a transient runner/lazy-load observation, not silently discarded.

## v1.2 evidence

Unit coverage fixes the circular fallback, Kepler equation, equal mean-anomaly advance, perihelion/aphelion distance, inverse-square flux, vis-viva speed, shared-frame axis direction, dynamic seasonal markers, schema migration and thermal orbit readiness.

Browser coverage checks:

- eccentric distance/flux/speed diagnostics and season navigation;
- rendered axis direction against the shared-frame equation;
- circular-orbit perihelion degeneracy;
- independent A/B orbit parameters without clock divergence or stale thermal reuse;
- schema 1 migration and complete schema 2 restoration;
- Japanese Large controls at 390×844 without horizontal overflow.

Chromium and WebKit screenshots were opened and inspected. The eccentric orbit is visible, diagnostics and annual forcing agree, and Japanese mobile text fits. The existing Japanese Compare golden changed only because its scientific context now says tilt and orbit may differ; expected, actual and diff images were inspected before updating the snapshot.

## Open gates

- No physical iPhone/Safari test was performed.
- No public deployment was made.
- GitHub CI on the pushed review commit remains to be observed by the reviewer.
- The model remains an educational 365-day phase, not a live ephemeris. Geography-dependent heat storage and nonlinear feedback remain out of scope.
