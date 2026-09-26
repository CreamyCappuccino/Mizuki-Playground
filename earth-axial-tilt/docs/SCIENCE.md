# What the numbers mean — current through v1.0 RC

## Temperature is not the daytime maximum

Neither temperature mode is an hourly weather calculation. **Thermal EBM**, the v0.5 default, solves a repeating seasonal energy balance. **Illustrative** preserves the v0.1–v0.4 heuristic exactly. A new configuration is a new equilibrated experiment, not an instantaneous physical jump in Earth's real climate.

## Illustrative mode (unchanged legacy model)

The plotted temperature is an illustrative **daily-mean-style estimate** for a latitude band, representing day and night together. It is not an observed station value, a daily maximum/minimum, a feels-like temperature, or a forecast. The annual summary averages the 365 plotted daily values; the displayed curve range is a range of **daily means**, not intraday extremes.

The model is a heuristic, not a solved energy balance model:

```
latitude baseline = 27 - 0.22 * abs(latitude) - 0.0018 * latitude^2
seasonal response = 0.055 * (daily solar at day - 28 - annual mean solar)
T = clamp(baseline + seasonal response, -65, 55) degrees C
```

The 28-day lag is illustrative. Land/ocean heat storage, altitude, atmospheric circulation, cloud cover, urban heating and ocean currents are not simulated. Longitude identifies the selected point but does not change its temperature estimate. Annual mean solar is subtracted at each obliquity, so this model primarily changes seasonal amplitude and timing; it does **not** predict the full change in annual-mean climate at a different tilt. The safety clamps can also affect annual means at extreme settings.

v0.2 retains v0.1's coefficients deliberately. It makes the interpretation explicit rather than raising a few coefficients to make selected cities look correct. Fractional days now use a continuous lag, and each annual profile contains all 365 days.

## Thermal EBM: seasonal heat storage and meridional transport

The new model solves a dry, zonally averaged energy-balance equation. It does not use the legacy latitude baseline or impose an artificial lag:

```
x = sin(latitude)
C dT/dt = (1 - alpha(x)) Q(x,t) - (A + B T) + D d/dx[(1-x²) dT/dx]
alpha(x) = 0.3 + 0.078 * (3 x² - 1) / 2
C = 4,000,000 * H J m^-2 K^-1
A = 210 W m^-2; B = 2 W m^-2 K^-1; D = 0.55 W m^-2 K^-1
```

`Q` is the existing astronomical daily-mean TOA irradiance; `T` is in degrees Celsius. The temperature variable is a seasonal surface/column proxy forced by daily means, not an observed 2-m station air temperature or an hourly mean computed from weather samples. Radiation is represented by a linear outgoing-flux parameterization. Latitude-to-latitude transport is a diffusive approximation, not resolved winds or ocean currents.

**Fast / Mixed / Slow** use H = 2.5 / 10 / 50 meters of *equivalent* water respectively (10 / 40 / 200 MJ m^-2 K^-1). This sets one heat capacity uniformly across the whole planet. It does not fill land with water, look up local ocean depth, or classify cities as land/ocean. Greater heat storage smooths and delays the seasonal response. For this fixed-albedo linear model, changing C does not change the equilibrated annual mean; changing tilt can redistribute annual-mean temperatures.

Parameters are transparent educational choices in the family described by Brian E. J. Rose's Climate Laboratory and climlab. They are **not fitted to Taipei, Singapore or a climatology dataset**. We implement the solver directly in TypeScript; climlab is a reference, not an application dependency.

### Numerics and interpretation

The sphere is divided into 90 latitude bands with 2-degree edges. Finite-volume weights are differences of sin(latitude); opposing interface fluxes cancel, and pole boundaries have zero flux. Values are carried at band area-centres, so the exact poles use the adjacent polar-cap temperature, not a separately resolved point.

Backward-Euler steps of half a model day solve a pre-factorized tridiagonal system. Forcing is evaluated at step endpoints. The solver starts from the annual-mean steady solution and integrates until the maximum change at the same annual phase is below 1e-6 C (at most 80 years). Nonconvergence or nonfinite results produce an explicit error, not a clipped fallback. Each output has 365 temperature rows; fractional dates interpolate in time and sin(latitude), wrapping continuously across the year. The displayed annual summary averages these daily samples.

The seasonal model conserves transported energy globally. Its converged global absorbed-minus-outgoing radiation residual is checked independently in tests. Tests also refine the grid to 180 bands and the timestep to one quarter day; the current 90-degree/Mixed check differs by less than 0.2 C at the tested locations/dates. This is a numerical consistency check, **not a physical uncertainty bound or forecast accuracy**.

### Model limits are particularly important at extreme tilt

Fixed reflectivity and linear outgoing radiation ignore changing ice, water vapour, latent heat, clouds, greenhouse feedbacks and circulation changes. At high obliquity and low heat capacity the model can return very large temperatures (including above 100 C). The UI warns about large extrapolations when any band/year sample is outside -60 to 60 C. That threshold is a presentation flag, not a validated physical validity domain. These values must not be read as Earth's future climate, boiling oceans, or a habitability prediction.

No temperature value is clipped by this solver. The thermal map has a labelled fixed -100 to 180 C display scale (endpoint colours saturate); numeric readouts and graphs preserve the result. Illustrative mode keeps its previous -65 to 55 C clamp and matching scale.

### Consistency while interacting

A module Web Worker solves the seasonal fields away from rendering. It caches at most six configurations and processes at most one active request plus the latest desired request. Superseded replies cannot overwrite the current model. Changing date, spin, camera or selected location reuses the solved year. While a changed thermal configuration is unresolved, temperature numbers/curves are withheld and the temperature-colour overlay is hidden; astronomical controls remain usable. Errors offer retry or an explicit switch to Illustrative, never a silent model substitution.

The Earth-reference curve uses the same selected temperature model and heat capacity at 23.44 degrees. It is not observed climate, nor a different heat-storage control run.

### Primary references

- Brian E. J. Rose, University at Albany, *The Climate Laboratory*, seasonal heat storage and energy-balance model: https://brian-rose.github.io/ClimateLaboratoryBook/courseware/seasonal-cycle/
- Same author, finite-latitude energy balance and no-flux transport: https://brian-rose.github.io/ClimateLaboratoryBook/courseware/one-dim-ebm/
- climlab EBM documentation, parameter units and model definitions: https://climlab.readthedocs.io/en/stable/api/climlab.model.ebm.html
- Vite, module-worker bundling: https://vite.dev/guide/features#web-workers

## Real-world scale checks (not calibration data in the app)

- **Singapore, Changi, 1991–2020:** the official monthly 24-hour mean ranges from **26.8 to 28.6 C**; mean daily maximum ranges from **30.5 to 32.4 C**. These are different statistics. Source: Meteorological Service Singapore, *Climate of Singapore*, temperature discussion and climate-station means table: https://www.weather.gov.sg/climate-climate-of-singapore/
- **Taipei, 1991–2020:** Taiwan's TCCIP/NCDR station-data presentation gives an annual mean of **23.3 C** in its station-anomaly baseline table, based on CWA observations. Source: https://tccip.ncdr.nat.gov.tw/ds_01.aspx . Station history and processing matter; the page documents station relocation / series-joining caveats.
- In Illustrative mode, with the app's latitude 25.033 N and tilt 23.44 degrees, the retained toy model gives an annual mean of about **20.36 C**, with daily-mean estimates from **13.37 to 25.97 C**. Thus the app's cool Taipei result is not explained solely by “mean versus maximum”: the model is also not locally calibrated.

These historical normals are not current weather observations and do not validate the counterfactual 90-degree climate.

## Astronomy and the Earth-centred scene

- Earth Classic uses a 365-day circular orbit, with the March-equinox phase anchored at model day 80. Its exact quarter-cycle positions are 80, 171.25, 262.5 and 353.75. v1.2 eccentric orbits retain a 365-day model period but place the seasonal quarters through Kepler time. Calendar labels are approximate, not an ephemeris.
- Solar declination is `asin(sin(tilt) * sin(orbital longitude))`.
- Daily mean incoming solar energy is top-of-atmosphere (TOA), not surface irradiance. The solar constant is 1361 W/m2. The globe-wide area-weighted daily mean is 1361/4 W/m2 for this circular-orbit model.
- Daylight uses an ideal point Sun without atmospheric refraction. The sunset calculation uses `cos(zenith) = a + b*cos(hour angle)` rather than singular tangents. When the Sun is exactly on the horizon all day, 12 h is an explicit reporting convention; effective incoming energy is zero. This occurs at the equator at an exact 90-degree-obliquity solstice, and at a pole at an exact equinox.
- The golden subsolar marker is aligned with the light direction. The terminator is a great circle perpendicular to that direction. The axis, angle arc and N/S labels expose the geometry.
- The close-up keeps Earth at the origin and moves the Sun direction for inspection. Orbit overview instead puts the Sun at the origin and Earth at -14 times the unit Sun direction. Sizes and distances are not to scale; this is not a claim that the Sun orbits Earth.
- Rotation is a freely controlled phase around the tilted local axis. Geographic longitude, the rotating surface, the selected marker and the subsolar meridian are consistent. The phase is not tied to UTC or a historical ephemeris.
- Geographic markers now follow the equirectangular texture convention of Three.js SphereGeometry: +Y is north, +X is longitude 0 and -Z is longitude 90 E.

## Diurnal experiment (v0.3)

The scene uses `Rx(-obliquity) * Ry(rotation)`; its polar axis therefore does not precess or swing around the orbit-plane normal as the surface spins. A geographic surface normal `n` and the rotating-frame unit Sun vector `s` give:

```
mu = dot(n, s)
elevation = asin(clamp(mu, -1, 1))
instantaneous horizontal TOA flux = 1361 * max(0, mu) W/m2
```

The independent hour-angle expression used for the Day graph is
`mu = sin(latitude)*sin(declination) + cos(latitude)*cos(declination)*cos(hour angle)`.
Here hour angle is `15 * (local apparent solar hours - 12)` degrees. For a defined subsolar meridian, local solar hours are `wrap24(12 + (longitude - subsolar longitude)/15)`. No equation-of-time or time-zone conversion is claimed. Solar-noon buttons set this geometric hour, not a civil clock. The noon position need not be overhead unless latitude equals declination.

The displayed Sun position, instantaneous shader and selected-point computation all use the same rotating-frame direction. Their agreement with actual Three.js rotations is tested. Numerically averaging instantaneous flux over 1,440 evenly spaced rotation phases agrees with the existing analytic daily-mean insolation within 0.01 W/m2 across the tested tilts, latitudes and seasons. This is a mathematical consistency check, not climate calibration.

**Frozen-date convention:** a diurnal experiment makes one full turn while holding the orbital date and declination fixed. At x1 that takes 30 real seconds, not 24 real hours. Year playback instead changes only the seasonal date. These two independent experiments do not implement a civil clock or ephemeris. A separate Coupled mode was added in v0.9, defined below. Manual date or rotation changes pause playback, and hidden-tab elapsed time is not accumulated.

**Degeneracies:** at a geographic pole there is no unique local longitude/time meridian. When the Sun is exactly over a pole, the subsolar longitude is likewise undefined for the entire globe. These cases display `Undefined`, disable solar-noon/midnight targeting and use nominal 0–24 rotation hours on the flat Day graph. At an exact geometric horizon the direct horizontal flux is zero. Numerical cosine residuals below 1e-12 are snapped to zero.

The daily temperature estimate has no hourly component. Moving the rotation control must not change temperature, geometric day length, daily solar or annual profiles. No diurnal temperature cycle is inferred from the instantaneous flux.

Background references (definitions / implementation conventions, not a claim to implement NOAA's full calculator):
- NOAA/GML Solar Calculator glossary, solar time, solar noon and zenith angle: https://gml.noaa.gov/grad/solcalc/glossary.html
- Three.js Euler (intrinsic rotations): https://threejs.org/docs/pages/Euler.html
- Three.js matrix transformations and local/world matrices: https://threejs.org/manual/pages/matrix-transformations.html

## Comparison and colour scales

The optional dashed annual curve runs the **same** model at Earth's 23.44 degrees. It is not a measured-climate curve. Both curves use the same chart scale.

Surface legends use fixed educational colour ranges: daily and instantaneous solar 0–1361 W/m2, daylight 0–24 h, and temperature -65–55 C in Illustrative mode or -100–180 C in Thermal EBM mode. These are colour limits, not numerical clipping. High-e perihelion flux can exceed the solar colour limit and saturate visually; diagnostics, graphs and climate forcing retain the calculated value.

## Visual resources and remaining limits

The decorative Earth texture still loads from the existing threejs.org URL at runtime; failure leaves the scientific modes usable. This release removes the remote font request and uses local/system font fallbacks. Cloud physics, real-time weather, station-calibrated climate, quality presets, dual-globe rendering and deployment are outside this release.


## v0.9: prograde inertial frame and coupled clock

The old separate animations had opposite spin/orbit handedness at zero obliquity. Coupling them requires a consistent frame. Since v0.9:

```
lambda = 2*pi*(day-80)/365
s_world = [cos(lambda), 0, -sin(lambda)]
r_Earth = -R * s_world                 (R=14 is display-only)
n_axis = [0, cos(epsilon), -sin(epsilon)]
M_surface = Rx(-epsilon) * Ry(theta)
s_untilted-local = [s_x, -s_z*sin(epsilon), s_z*cos(epsilon)]
```

The axial and orbital angular momenta agree about +Y for zero tilt. Declination remains asin(sin(epsilon)*sin(lambda)); no EBM coefficients or scalar daily/annual energy functions were changed. The camera was mirrored to retain a sunlit starting view. The arbitrary phase's absolute subsolar longitude can differ from pre-v0.9 displays.

For a circular model with 365 mean solar days per orbit and prograde spin, the Sun's annual apparent circuit subtracts one turn from the inertial spin count. We therefore choose 366 inertial turns per model year:

```
dtheta/dday = 360 * 366 / 365  degrees/model-day
dday/dreal-second = 0.1 * speed
```

These are model definitions, not rounded real-world ephemeris constants. At zero tilt, apparent solar time repeats after one model day. At nonzero tilt the projected subsolar meridian advances nonuniformly; a uniform apparent solar clock is not asserted. At an exact solar/geographic pole a meridian may be undefined. Sidereal versus solar definitions: [USNO](https://aa.usno.navy.mil/faq/GAST), [solar day](https://iasb.be/en/encyclopedia/solar-day-definition), [sidereal day](https://aeronomy.be/en/encyclopedia/sidereal-day-definition).

A visibility transition resets the animation timestamp, and frame increments are bounded. Rotation wraps independently of the annual phase; a year boundary never resets the surface to an arbitrary zero.

## A/B comparison semantics

A/B have the same day, longitude/latitude, rotational phase, model and heat depth. Tilt and orbit parameters may differ. Differences are A−B for geometric daylight, TOA daily solar, and the same temperature model. Equal configurations give exact zero differences. Missing or configuration-mismatched thermal solutions give null differences, not substituted earlier temperatures.

The annual graph uses B as its reference while comparing. The daily graph remains A's instantaneous profile at the current date. Atlas remains A versus 23.44°. Those references are labelled separately. Sharing rotational phase is not the same as forcing equal apparent solar time at two obliquities, which is why instantaneous A−B solar metrics are not included without further controls.

Rendering reuses one scene/context with isolated scissor passes and restores primary state after B. Identical colours denote identical numerical scales. Display geometry and quality never enter the energy-balance solver. See [Three.js multiple scenes](https://threejs.org/manual/pages/multiple-scenes.html) for the shared-renderer pattern.

## v1.2: eccentric orbit and axis orientation

v1.2 keeps model day 80 at inertial mean longitude zero. Uniform model time advances mean longitude and mean anomaly; it does not advance true longitude uniformly. For eccentricity `e` and perihelion longitude `varpi`:

```
L = 2*pi*(day-80)/365
M = L - varpi
M = E - e*sin(E)
nu = atan2(sqrt(1-e^2)*sin(E), cos(E)-e)
lambda = nu + varpi
r/a = 1 - e*cos(E)
relative TOA flux = 1/(r/a)^2
relative orbital speed = sqrt(2/(r/a) - 1)
```

The implementation solves Kepler's equation by bounded Newton iteration. The UI accepts `0 <= e <= 0.6`; this educational limit is not a claim about Earth-like climates at large eccentricity. Semi-major axis and year length remain fixed.

Perihelion longitude, true longitude and axis orientation `alpha` share the same inertial +Y-prograde frame:

```
s_world = [cos(lambda), 0, -sin(lambda)]
n_axis = [-sin(epsilon)*sin(alpha), cos(epsilon), -sin(epsilon)*cos(alpha)]
M_surface = Ry(alpha) * Rx(-epsilon) * Ry(theta)
declination = asin(sin(epsilon) * sin(lambda-alpha))
```

Quarter-season markers occur at true longitudes `alpha + k*pi/2`, then are converted back to model days through Kepler's equation. Perihelion and aphelion occur at `varpi` and `varpi+pi`. At `e=0`, every orbital point has the same distance: changing `varpi` must have no effect, and the UI labels perihelion direction as undefined.

All solar, daily, annual, Atlas, A/B and thermal calculations consume the same orbit object. Thermal cache/readiness keys include eccentricity, perihelion longitude and axis orientation; a solution calculated for a different orbit is not displayed. This remains a repeating 365-day model phase, not a civil calendar or astronomical ephemeris.
