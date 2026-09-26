# v1.3 real-geography preview verification record

Date: 2026-09-27  
Scope: isolated alpha-2 geography physics/data core plus production-built browser preview.  
Accepted main baseline before this candidate: `a8c096f6d756b4093b240fb6fff590169d8ab640`.

This record does **not** claim full integration into the accepted 3D Earth profile,
A/B Compare, the main Season Atlas, schema 4, physical iPhone Safari, or public deployment.

## Data and numerical core

- Natural Earth 1:110m land archive is pinned as v4.1.0 with source/component hashes and public-domain provenance.
- Production mask: 18×36 / 10° cells, 648 q64 equal-area land fractions; Float64LE payload SHA-256 `09462b795716c3a3ce747bcf0835b089b38be8028d09b75cc1cdd196b2567084`.
- Geography solver is separate from Classic: spherical finite volumes, periodic longitude, zero external polar flux, inherited A/B/D/albedo, mixed coastal heat capacity, half-day backward Euler and bounded Jacobi-PCG.
- Classic production solver/source remains unchanged and is compared against frozen accepted source in the same runtime.
- Independent Chat-side calculation assembled the fixed production-mask matrix and orbit forcing separately and solved the periodic year by sparse/time-FFT methods. Four complete 365×648 fields (946,080 temperatures) differed from production by at most about `2.02e-6 °C`, below the `1e-5 °C` implementation-equivalence gate. This is a discrete-equation check, not a climate-accuracy bound.
- Core branch `661f9ff59738f13458cd4145c187c47ad10c3f9f`: GitHub CI #56 / run `36249767365` passed Ubuntu verify and macOS WebKit.

## Browser/component slice

The preview uses a dedicated stateless geography worker and one serialized `GeographyClient` lane. Request identity includes tilt, normalized orbit, fixed profile/grid/mask/solver settings and retained Classic-depth metadata. Returned fields are shape/provenance/min/max/residual validated before transactional cache insertion. Obsolete synchronous work is canceled by terminating its worker; late callbacks are ignored. Accepted cache ownership is bounded to three fields and 6 MiB of typed-array bytes.

One shared containing-cell sampler drives the selected readout, map, annual curve and selected-longitude latitude×year section. Longitude wraps at the seam; ±90° select a coarse polar-cap sector and do not invent a unique physical pole longitude. Spatial values are cell-constant, while daily values interpolate periodically in time.

The standalone `geography-lab.html` is a second Vite production entry. It exposes tilt/orbit, optional same-geography 23.44° reference, cancel/retry, date/location resampling, land fraction/effective storage, geographic field, annual response and longitude section. Its portable JSON/link envelope is intentionally separate from main schema 3.

Browser evidence at review head `356cadc4d1aa9eb591d1459c41970015adaa4fda`:

- GitHub CI #58 / run `36257435311`: typecheck, geography/core unit suite, production multi-page build, full Chromium regression and macOS WebKit v06–v13 all passed.
- Chromium used the real module worker; no browser fixture replaced the solve.
- Desktop evidence verifies longitude-sensitive temperature results and the full preview layout.
- Japanese Large mobile evidence at 390×844 verifies real worker computation, changed-tilt cancel/retry and no horizontal overflow.

A subsequent review commit adds a pinned preview-state round-trip/rejection test, makes the surrounding-cell meaning explicit, and captures the real land-fraction field after the longitude-sensitive temperature assertion. Its final same-head CI is required before integration.

## Remaining gates

- Inspect the final Chromium/WebKit evidence after the cell-clarity change and require same-head CI success.
- Integrate this proven sampler/worker into the accepted 3D Earth temperature layer and selected point without interpolating scientific values across cells.
- Add A/B geography Compare semantics and the main Atlas selected-longitude section using the same fields; do not silently reuse alpha-1 material references.
- Define/validate schema 4 before making real geography a main scientific profile; schema 1/2/3 retain their existing meanings.
- Physical iPhone Safari remains a human device gate. Playwright WebKit is not a substitute.
- Public deployment or new network configuration requires separate authorization.
