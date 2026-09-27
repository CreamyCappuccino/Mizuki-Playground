# Earth Synthesis — 1.5.0-rc.1 verification

Accepted starting point: `3861d5a1e03fef7cdd46a37619112def7f317f88`, v1.4 alpha1
with branch CI71 / main CI72 and M4 source/HTTP confirmation. Nothing in this
record retroactively marks the physical iPhone release checklist passed.

## Source invariants and independent audit

Existing physics/ and experiments/state.ts are unchanged. Earth Classic,
geographic EBM, feedback model.ts, main/Feedback state parsers and numerical
coefficients are retained. Changes in old pages are navigation links only.
No runtime dependency change. The normal workflow is restored after a one-off,
read-only source/locked Linux dependency artifact on the review branch.

`audits/synthesis/oracle.py` runs actual hashed production TypeScript. Its
independent NumPy code uses orbital bisection, a true-anomaly half-angle formula,
a separately written angle-domain daily-sunlight expression and 14,400-bin
half-year quadrature. It does not invoke the production Kepler, calendar,
solar or grid functions. Four sweeps / 40 worlds / 17,480 daily+seasonal values:

- Maximum calendar-sample difference: 4.8658e-11 W/m² (criterion <1e-7).
- Maximum angle-sample difference: 1.3984e-11 W/m² (criterion <1e-7).
- Maximum half-year energy difference from fine quadrature: 0.04338 MJ/m²
  (criterion <0.25; this is quadrature sensitivity, not climate accuracy).
- Maximum duration difference from fine quadrature: 1.201e-7 days
  (criterion <1e-6).

Production model.ts SHA256: `0b09ffb2f383f8d945016b5052fbc9a17b1f2d06c84fd565288cdf98cc93ff29`.
The runner records all executed source hashes and writes generated arrays/JSON
outside Git. A single cloud Node run of the maximum 41-row calculation took
~55ms plus cooperative scheduling; this is not an iPhone speed guarantee.
Retained numeric series: 143,336 bytes maximum; not process memory.

Focused tests cover independent sunlight, energy/time weighting, circular and
zero-tilt degeneracies, seam/date wrapping, hemisphere symmetry, gauge invariance,
finite allocation limits, strict serialization, current-schema bridges, all
seven recipes, cancellation/supersession/errors and static bilingual labels.
No new tolerant golden replaces an old exact baseline.

Cloud full `npm run verify` passes: documentation checks (30 documents / 172
main-page IDs / 407 Japanese catalogue keys), strict TypeScript, **281 unit tests
in 27 files**, and the production build. The first invocation was cut short by
the tool call duration; the complete rerun finished successfully in about 62
seconds for tests. No test timeout or expectation was relaxed.

## Browser and final gate

Cloud Chromium refused loopback navigation with ERR_BLOCKED_BY_ADMINISTRATOR;
no policy bypass was attempted. Actual production-build HTTP browser evidence
must therefore come from Actions Chromium and macOS Playwright WebKit. The
new e2e/v15.spec.ts suite exercises real computation, selected-vs-comparison
views, CSV, malformed/valid JSON and same-document hashes, cancellation,
Japanese Large390×844, numeric input preservation, invalid destination state
after resize, and navigation into the real main3D/Atlas and zonal Feedback.

At this record's creation, full same-HEAD browser CI and final PNG review are
pending. Final acceptance must reference the exact tested commit. The old
Chromium/macOS WebKit suites remain enabled; the WebKit list includes v15.
Physical iPhone portrait/landscape/touch/back-forward and a public release
remain separate. No claim that a standalone solar atlas is a 2D feedback model.
