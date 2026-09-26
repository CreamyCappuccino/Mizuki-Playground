# Earth Feedbacks Lab — alpha 1 verification record

## Accepted base and scope

v1.3 is accepted at `0d3fd674245f6698da287bd0f9146ad338e19567`:
CI65 / run36269940714 passed both full jobs after the final reference-only
failure/retry correction. Main and the M4 serving clone were confirmed at that
exact revision; localhost and the existing tailnet HTTPS route returned200.
This source/service check is not a physical-iPhone acceptance.

The v1.4 candidate adds a production-built, linked `feedback-lab.html` workspace.
It uses 90 zonal bands and uniform storage; it does not enable 2D geographic
feedback or main-globe feedback colouring. All previous numerical modules and
Earth state schemas remain unchanged. No new runtime dependency was added.

## Actual production-source numerical review

The checked `src/feedback/model.ts` SHA256 is
`9c007fa81e081c16fbc1550f3c0be219f9a89ce6c914cb490ac325e8f0a46272`.
An independent Python orbital-bisection/insolation/geometry/banded implementation
was compared to the actual TypeScript, rather than to another copy of its solver.
All six 365×90 fields (197,100 temperatures) meet the predeclared max1e-5°C bound;
maximum observed difference is1.3073986337985843e-12°C. Cases include opposite
seeds, feedback off, and tilt90° / eccentricity0.3 / perihelion90°.

Analytical zero-diffusion and zero-sunlight branches, energy conservation,
periodicity across every half-day phase, strict threshold convention, actual
continued-state identity and bounded nonconvergence have separate tests.
The actual 15-stage sweep and a 17-stage alternating path were run through
production ingress validation; both returned all stages. The latter retained
4,566,200 bytes of arrays, below the6MiB limit. This is not peak browser memory
or a performance guarantee for an iPhone.

Half→quarter→eighth-day differences and a 90→180-band area-weighted comparison
are documented in V1.4. These tests establish implementation consistency and
quantify numerical sensitivity, not real climate accuracy.

Reproduction: `audits/feedback/oracle.py`, `run-production.mjs`, `refinement.mjs`.
Generated output stays outside the repository. No candidate-derived golden
replaces an accepted baseline.

## Browser history and acceptance

CI67 / run36271027891, revisionf093715, passed246 unit tests, typecheck,
documentation and production build;91 of92 Chromium tests passed. Both
engines caught the same real defect: changing only the URL fragment did not
restore settings. The fix adds atomic `hashchange` handling, not a forced reload
or relaxed expectation.

CI68 / run36271786251 at
`6545d36bc6f6eb3c2d5fa3b6937e8aee36a7fbf3` passed both complete jobs. Real
production workers exercise warm/cold separation, feedback-off equivalence,
continued history, malformed reply rejection, cancel/restart, valid/invalid
fragment replacement, paused URL/JSON restore and390×844 Japanese Large.
Screenshots from successful CI67 tests were inspected in both engines; no
precomputed fields were used. Final-candidate screenshots are a separate check.

After CI68, a bounded polish pass preserves unrun science edits across history
preset switches, adds the actual80-year unsettled-path browser/unit case,
updates the guides and hardens audit output-directory guards. These changes
must pass the same-head full workflow before promotion; CI68 is not represented
as evidence for code that came after it. Focused feedback tests at this stage
are27/27, with cloud typecheck/build/documentation checks passing.

Cloud Chromium cannot access localhost under the container's managed policy.
Accordingly actual HTTP/module-worker browser evidence comes from GitHub
Actions Chromium and macOS Playwright WebKit, not a claimed local browser run.

## Remaining boundaries

Physical iPhone portrait/landscape/touch/back-forward acceptance is still human.
No public deployment, new network exposure or cloud billing service was enabled.
M4 source/process/HTTP checks occur only after an exact accepted revision is
promoted. Cold-area output is a snow/ice threshold proxy, not ice mass, latent
heat or seawater freezing. The v1.4 track's later geographic/3D integration is
not declared finished by this first workspace milestone.

## Final test-selector correction

CI69 at `14daad76` passed all numerical checks and the first six feedback
browser scenarios. The unsettled-path scenario reached the correct one-result,
80-year, not-equilibrium UI, then failed a page-wide `.feedback-curve` count:
that shared class belongs to both the annual and history charts. The regression
now asserts one annual curve under `#fb-annual` and one history checkpoint under
`#fb-history`, rather than counting unrelated chart paths together. No model
results, tolerances, time limits or production code were changed for this fix.
The corrected same-head run remains the promotion gate.
