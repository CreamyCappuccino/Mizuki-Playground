# What the numbers mean (v0.2)

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
- There is no time-of-day spin simulation yet. Subsolar latitude is physical in the model, but subsolar longitude is an illustrative scene orientation.
- Geographic markers now follow the equirectangular texture convention of Three.js SphereGeometry: +Y is north, +X is longitude 0 and -Z is longitude 90 E.

## Comparison and colour scales

The optional dashed annual curve runs the **same** model at Earth's 23.44 degrees. It is not a measured-climate curve. Both curves use the same chart scale.

Surface legends use the same numerical ranges as the geometry: solar 0–1361 W/m2, daylight 0–24 h, and temperature -65–55 C. The solar scale therefore does not saturate prematurely near 90-degree obliquity.

## Visual resources and remaining limits

The decorative Earth texture still loads from the existing threejs.org URL at runtime; failure leaves the scientific modes usable. This release removes the remote font request and uses local/system font fallbacks. Cloud physics, real-time weather, station-calibrated climate, quality presets, dual-globe rendering and deployment are outside this release.
