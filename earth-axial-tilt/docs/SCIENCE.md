# What the numbers mean (v0.3)

## Temperature is not the daytime maximum

The plotted temperature is an illustrative **daily-mean-style estimate** for a latitude band, representing day and night together. It is not an observed station value, a daily maximum/minimum, a feels-like temperature, or a forecast. The annual summary averages the 365 plotted daily values; the displayed curve range is a range of **daily means**, not intraday extremes.

The model is a heuristic, not a solved energy balance model:

```
latitude baseline = 27 - 0.22 * abs(latitude) - 0.0018 * latitude^2
seasonal response = 0.055 * (daily solar at day - 28 - annual mean solar)
T = clamp(baseline + seasonal response, -65, 55) degrees C
```

The 28-day lag is illustrative. Land/ocean heat storage, altitude, atmospheric circulation, cloud cover, urban heating and ocean currents are not simulated. Longitude identifies the selected point but does not change its temperature estimate. Annual mean solar is subtracted at each obliquity, so this model primarily changes seasonal amplitude and timing; it does **not** predict the full change in annual-mean climate at a different tilt. The safety clamps can also affect annual means at extreme settings.

v0.2 retains v0.1's coefficients deliberately. It makes the interpretation explicit rather than raising a few coefficients to make selected cities look correct. Fractional days now use a continuous lag, and each annual profile contains all 365 days.

## Real-world scale checks (not calibration data in the app)

- **Singapore, Changi, 1991–2020:** the official monthly 24-hour mean ranges from **26.8 to 28.6 C**; mean daily maximum ranges from **30.5 to 32.4 C**. These are different statistics. Source: Meteorological Service Singapore, *Climate of Singapore*, temperature discussion and climate-station means table: https://www.weather.gov.sg/climate-climate-of-singapore/
- **Taipei, 1991–2020:** Taiwan's TCCIP/NCDR station-data presentation gives an annual mean of **23.3 C** in its station-anomaly baseline table, based on CWA observations. Source: https://tccip.ncdr.nat.gov.tw/ds_01.aspx . Station history and processing matter; the page documents station relocation / series-joining caveats.
- With the app's latitude 25.033 N and tilt 23.44 degrees, the retained toy model gives an annual mean of about **20.36 C**, with daily-mean estimates from **13.37 to 25.97 C**. Thus the app's cool Taipei result is not explained solely by “mean versus maximum”: the model is also not locally calibrated.

These historical normals are not current weather observations and do not validate the counterfactual 90-degree climate.

## Astronomy and the Earth-centred scene

- The model uses a 365-day circular orbit, with the March-equinox phase anchored at model day 80. Exact model quarter-cycle positions are 80, 171.25, 262.5 and 353.75. Calendar labels are approximate, not an ephemeris.
- Solar declination is `asin(sin(tilt) * sin(orbital longitude))`.
- Daily mean incoming solar energy is top-of-atmosphere (TOA), not surface irradiance. The solar constant is 1361 W/m2. The globe-wide area-weighted daily mean is 1361/4 W/m2 for this circular-orbit model.
- Daylight uses an ideal point Sun without atmospheric refraction. The sunset calculation uses `cos(zenith) = a + b*cos(hour angle)` rather than singular tangents. When the Sun is exactly on the horizon all day, 12 h is an explicit reporting convention; effective incoming energy is zero. This occurs at the equator at an exact 90-degree-obliquity solstice, and at a pole at an exact equinox.
- The golden subsolar marker is aligned with the light direction. The terminator is a great circle perpendicular to that direction. The axis, angle arc and N/S labels expose the geometry.
- The scene keeps Earth at the origin and moves the Sun direction around it for inspection. Sizes and distances are not to scale; this is not a claim that the Sun orbits Earth.
- Rotation is a freely controlled phase around the tilted local axis. Geographic longitude, the rotating surface, the selected marker and the subsolar meridian are consistent. The phase is not tied to UTC or a historical ephemeris.
- Geographic markers now follow the equirectangular texture convention of Three.js SphereGeometry: +Y is north, +X is longitude 0 and -Z is longitude 90 E.

## Diurnal experiment (v0.3)

The scene uses `Rx(obliquity) * Ry(rotation)`; its polar axis therefore does not precess or swing around the orbit-plane normal as the surface spins. A geographic surface normal `n` and the rotating-frame unit Sun vector `s` give:

```
mu = dot(n, s)
elevation = asin(clamp(mu, -1, 1))
instantaneous horizontal TOA flux = 1361 * max(0, mu) W/m2
```

The independent hour-angle expression used for the Day graph is
`mu = sin(latitude)*sin(declination) + cos(latitude)*cos(declination)*cos(hour angle)`.
Here hour angle is `15 * (local apparent solar hours - 12)` degrees. For a defined subsolar meridian, local solar hours are `wrap24(12 + (longitude - subsolar longitude)/15)`. No equation-of-time or time-zone conversion is claimed. Solar-noon buttons set this geometric hour, not a civil clock. The noon position need not be overhead unless latitude equals declination.

The displayed Sun position, instantaneous shader and selected-point computation all use the same rotating-frame direction. Their agreement with actual Three.js rotations is tested. Numerically averaging instantaneous flux over 1,440 evenly spaced rotation phases agrees with the existing analytic daily-mean insolation within 0.01 W/m2 across the tested tilts, latitudes and seasons. This is a mathematical consistency check, not climate calibration.

**Frozen-date convention:** a diurnal experiment makes one full turn while holding the orbital date and declination fixed. At x1 that takes 30 real seconds, not 24 real hours. Year playback instead changes only the seasonal date. These independent experiments intentionally do not implement a sidereal clock, real-time ephemeris or a coupled 365-day continuous spin animation. Manual date or rotation changes pause playback, and hidden-tab elapsed time is not accumulated.

**Degeneracies:** at a geographic pole there is no unique local longitude/time meridian. When the Sun is exactly over a pole, the subsolar longitude is likewise undefined for the entire globe. These cases display `Undefined`, disable solar-noon/midnight targeting and use nominal 0–24 rotation hours on the flat Day graph. At an exact geometric horizon the direct horizontal flux is zero. Numerical cosine residuals below 1e-12 are snapped to zero.

The daily temperature estimate has no hourly component. Moving the rotation control must not change temperature, geometric day length, daily solar or annual profiles. No diurnal temperature cycle is inferred from the instantaneous flux.

Background references (definitions / implementation conventions, not a claim to implement NOAA's full calculator):
- NOAA/GML Solar Calculator glossary, solar time, solar noon and zenith angle: https://gml.noaa.gov/grad/solcalc/glossary.html
- Three.js Euler (intrinsic rotations): https://threejs.org/docs/pages/Euler.html
- Three.js matrix transformations and local/world matrices: https://threejs.org/manual/pages/matrix-transformations.html

## Comparison and colour scales

The optional dashed annual curve runs the **same** model at Earth's 23.44 degrees. It is not a measured-climate curve. Both curves use the same chart scale.

Surface legends use the same numerical ranges as the geometry: daily and instantaneous solar 0–1361 W/m2, daylight 0–24 h, and temperature -65–55 C. The solar scale therefore does not saturate prematurely near 90-degree obliquity.

## Visual resources and remaining limits

The decorative Earth texture still loads from the existing threejs.org URL at runtime; failure leaves the scientific modes usable. This release removes the remote font request and uses local/system font fallbacks. Cloud physics, real-time weather, station-calibrated climate, quality presets, dual-globe rendering and deployment are outside this release.
