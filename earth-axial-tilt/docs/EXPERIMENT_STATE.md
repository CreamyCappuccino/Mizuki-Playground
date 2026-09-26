# Experiment state format — schema 2, with schema 1 migration

A reproducible scientific experiment is distinct from display preferences, a cached solution and civil time.

## URL

A complete link contains an app origin/path and a `#lab=2&…` fragment. The serializer removes arbitrary query parameters and credentials. Sharing is user-initiated; playback does not continuously replace browser history. Existing non-experiment fragments are ignored.

Fields: `a`, `b` (tilts 0–90°); `day` (1 ≤ day < 366, fractional allowed); `spin` (0–360°, 360 normalizes to 0); `lat`, `lon` (paired selected coordinates); `dual`, `ref`, `guides` (0/1); `layer` (normal/instant/insolation/daylight/temperature); `model` (energy-balance/illustrative); `heat` (2.5/10/50); `view` (earth/orbit); `period` (year/day); `chart` (temperature/insolation/daylight); `speed` (1/4/12).

Missing known fields use `DEFAULT_EXPERIMENT`, not current UI state. Unknown keys are ignored and never assigned to objects. Duplicate owned keys, invalid owned values, unsupported versions and payloads over 4096 characters reject the entire experiment. A partial coordinate pair is rejected. Scientific place labels come from exact known coordinates or the neutral custom-point label; URL text is never HTML or an executable expression.

## File

UTF-8 JSON envelope: `application: "earth-axial-tilt"`, `version: 2`, `state: ExperimentState`. Input size is checked before reading; the same validator applies. Exported files contain no image, user account, location access request or thermal array.

## State application

Validate → load Compare if required → verify this is still the newest operation → apply owned fields → pause → synchronize all controls → recompute thermal results → frame the view. A newer direct edit, newer link or newer file cancels older pending imports. Invalid data leaves the previous scientific state unchanged. Undo restores one previous validated state, not an arbitrary history.

No locale, text size, quality, Basic/All, Focus, camera pose or playback is imported. Schema 1 migrates to eccentricity=perihelion=axisAzimuth=0 for both worlds, even if unknown orbital fields were present. Schema 2 adds `e`, `peri`, `axis`, `be`, `bperi`, `baxis` in URLs, and `eccentricity`, `perihelion`, `axisAzimuth` plus B-suffixed fields in JSON. Eccentricity must be within 0–0.3; finite angles must be within 0–360° (360 normalizes to 0). Omitted parameters use the classic zero defaults. Unknown future versions are rejected. Each restored orbit recomputes its full annual forcing; cached thermal arrays are never imported. The fixed 365-day model year and day-80 spring reference apply independently to each world. Fast/Slow presets are successive runs, not unequal A/B heat capacities. Formal 1.0 device acceptance and public deployment remain separate gates.
