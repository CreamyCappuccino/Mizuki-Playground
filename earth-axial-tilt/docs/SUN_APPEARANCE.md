# Sun appearance follow-up

The close-up direction marker and the central Sun in Orbit Overview are separate
scene objects. Both now use `scene/sunAppearance.ts`. This replaces the overview's
high-contrast sinusoidal pattern and the marker's spherical UV gradient with a
view-dependent warm white centre, a yellow/orange rim, and subtle seamless 3D
noise. Unresolved fine detail fades using screen derivatives to reduce shimmer.

The opaque sphere and two soft additive halos have separate resources. Halo
radii are 1.4 and 1.85 times the core radius, with depth testing on: a foreground
Earth can occlude the glow. Each pair of static 128-square RGBA textures owns
131,072 CPU-side array bytes, not a total GPU/heap measurement. Existing scene
traversal releases their materials, maps and geometry. There is no animation,
network asset fetch, added light, or continuous redraw.

Sun positions, core display radii, compact-view scale, orbit, sunlight, climate,
state formats and dependency versions are unchanged. This is an artistic glyph,
not observed photospheric data. Unit tests cover both radii, bounds, deterministic
textures and occlusion flags; the real-browser sun suite captures Orbit Overview
on desktop and Japanese Large mobile and switches both views without changing
solar readouts. Existing complete Chromium and configured WebKit suites remain.
