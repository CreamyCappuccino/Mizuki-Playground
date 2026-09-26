# Experiment state format — schema 3, with schema 1/2 migration

A reproducible scientific experiment is distinct from display preferences, a cached solution and civil time.

## URL

A complete link contains an app origin/path and a `#lab=3&…` fragment. The serializer removes arbitrary query parameters and credentials. Sharing is user-initiated; playback does not continuously replace browser history. Existing non-experiment fragments are ignored.

Fields: `a`, `b` (tilts 0–90°); `day` (1 ≤ day < 366, fractional allowed); `spin` (0–360°, 360 normalizes to 0); `lat`, `lon` (paired selected coordinates); `dual`, `ref`, `guides` (0/1); `layer` (normal/instant/insolation/daylight/temperature); `model` (energy-balance/illustrative); `heat` (2.5/10/50); `geo` (`classic`/`idealized-land`/`idealized-ocean`); `view` (earth/orbit); `period` (year/day); `chart` (temperature/insolation/daylight); `speed` (1/4/12).

Missing known fields use `DEFAULT_EXPERIMENT`, not current UI state. Unknown keys are ignored and never assigned to objects. Duplicate owned keys, invalid owned values, unsupported versions and payloads over 4096 characters reject the entire experiment. A partial coordinate pair is rejected. Scientific place labels come from exact known coordinates or the neutral custom-point label; URL text is never HTML or an executable expression.

## File

UTF-8 JSON envelope: `application: "earth-axial-tilt"`, `version: 3`, `state: ExperimentState`. Input size is checked before reading; the same validator applies. Exported files contain no image, user account, location access request or thermal array.

## State application

Validate → load Compare if required → verify this is still the newest operation → apply owned fields → pause → synchronize all controls → recompute thermal results → frame the view. A newer direct edit, newer link or newer file cancels older pending imports. Invalid data leaves the previous scientific state unchanged. Undo restores one previous validated state, not an arbitrary history.

No locale, text size, quality, Basic/All, Focus, camera pose or playback is imported. Schema 1 migrates to eccentricity=perihelion=axisAzimuth=0 for both worlds and Classic climate. Schema 2 retains its orbital fields but migrates to Classic climate. Schema 3 adds `geo` in URLs and `climateProfile` in JSON. Eccentricity must be within 0–0.3; finite angles must be within 0–360° (360 normalizes to 0). Omitted orbital parameters use zero defaults. Unknown future versions are rejected. Illustrative temperature with a non-Classic profile is invalid and rejects the whole experiment; profile switching belongs to Thermal EBM. Each restored orbit/profile recomputes its full annual forcing; cached thermal arrays are never imported. The fixed 365-day model year and day-80 spring reference apply independently to each world. Fast/Slow presets are successive runs, not unequal A/B heat capacities. Formal 1.0 device acceptance and public deployment remain separate gates.
