# Experiment state format — schema 2

A reproducible scientific experiment is distinct from display preferences, a cached solution and civil time.

## URL

A complete link contains an app origin/path and a `#lab=2&…` fragment. The serializer removes arbitrary query parameters and credentials. Sharing is user-initiated; playback does not continuously replace browser history. Existing non-experiment fragments are ignored.

Fields: `a`, `b` (tilts 0–90°); `ea`, `eb` (eccentricity 0–0.6); `pa`, `pb` (perihelion longitude 0–360°); `xa`, `xb` (axis orientation 0–360°); `day` (1 ≤ day < 366, fractional allowed); `spin` (0–360°, 360 normalizes to 0); `lat`, `lon` (paired selected coordinates); `dual`, `ref`, `guides` (0/1); `layer` (normal/instant/insolation/daylight/temperature); `model` (energy-balance/illustrative); `heat` (2.5/10/50); `view` (earth/orbit); `period` (year/day); `chart` (temperature/insolation/daylight); `speed` (1/4/12).

Missing known fields use `DEFAULT_EXPERIMENT`, not current UI state. Unknown keys are ignored and never assigned to objects. Duplicate owned keys, invalid owned values, unsupported versions and payloads over 4096 characters reject the entire experiment. A partial coordinate pair is rejected. Scientific place labels come from exact known coordinates or the neutral custom-point label; URL text is never HTML or an executable expression.

## File

UTF-8 JSON envelope: `application: "earth-axial-tilt"`, `version: 2`, `state: ExperimentState`. Input size is checked before reading; the same validator applies. Exported files contain no image, user account, location access request or thermal array.

Schema 1 URL/file data migrates by supplying the six schema 2 orbit fields from Earth Classic: eccentricity 0, perihelion longitude 0 and axis orientation 0 for both worlds. A schema 1 payload that claims schema 2 orbit fields is rejected rather than partly interpreted. Unknown schema versions and invalid owned values leave the entire current experiment unchanged.

## State application

Validate → load Compare if required → verify this is still the newest operation → apply owned fields → pause → synchronize all controls → recompute thermal results → frame the view. A newer direct edit, newer link or newer file cancels older pending imports. Invalid data leaves the previous scientific state unchanged. Undo restores one previous validated state, not an arbitrary history.

No locale, text size, quality, Basic/All, Focus, camera pose or playback is imported. Fast/Slow presets are successive runs, not unequal A/B heat capacities. Thermal arrays are recomputed for all orbit parameters and are never imported. Physical-device acceptance and public deployment remain separate gates.
