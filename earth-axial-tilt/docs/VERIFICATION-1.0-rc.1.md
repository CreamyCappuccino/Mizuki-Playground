# v1.0.0-rc.1 — verified implementation checkpoint

## Exact code / CI evidence

- Code checkpoint: `8b5b7576f0f2e69f8f9170da166194d637b987af`.
- GitHub Actions [run #30](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36153849477), `workflow_dispatch`, branch `mizuki/earth-v1-release`: **success**, completed 2026-09-25 15:27 UTC.
- Chromium verification job: `108133487568`, Ubuntu 24.04. Reproducible `npm ci`, documentation/translation checks, typecheck, 98 unit tests, production build and **55 browser tests passed**.
- macOS WebKit job: `108133487132`. Five separately launched suites: **6 + 7 + 6 + 8 + 5 = 32 passed**. One intentional skip: the Chromium-specific static screenshot golden. No functional test was changed to an expected failure.
- Chromium screenshots: [artifact 10872528429](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36153849477/artifacts/10872528429).
- WebKit screenshots: [artifact 10873186169](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36153849477/artifacts/10873186169).

These links are a historical verified checkpoint, not an instruction to skip checking a later HEAD. Documentation-only commits after this checkpoint do not change the app, but the final main-branch CI must still succeed before reporting that final HEAD as verified and pulling the Mac.

## What was actually inspected

Actual CI-rendered images were inspected for the double Earth, dual solar orbit, Japanese Large mobile layout, compact phone Focus view, and the Japanese comparison-panel golden. The A=B capture comparison decodes image pixels rather than comparing PNG byte streams. Its tolerance covers measured sparse texture-edge interpolation differences, not misplaced geometry. Native pointing is checked within a calculated CSS-pixel angular bound while unit coordinate transforms remain exact.

The local tool container ran type/unit/build checks on the same dependency graph, but its browser navigation to the app preview was blocked. It is not credited with the real WebGL screenshots; those came from CI.

## Fixes discovered during verification

- Kept the original independent day/year controls while adding a prograde, shared coupled clock.
- Repaired comparison/mobile inherited spacers and orbit transforms, selected-location scrolling, and compact Focus layout.
- Restored the correct keyboard focus after lazy Atlas dialogs close.
- Deferred ResizeObserver-triggered layout/framebuffer writes and avoided identical framebuffer reallocations / 4K texture reuploads.
- Labelled extreme temperatures in either world, including B when A remains moderate.
- Preserved application and shader error assertions. WebKit's hosted GPU allocation errors after multiple contexts were not ignored: suites now end their browser process between files and retain every failure. This bounds the test process, not proof of indefinite real-device stability.

## Remaining acceptance gate

**Physical iPhone Safari and sustained on-device memory/touch behaviour remain unobserved.** macOS Playwright WebKit is engine coverage, not a physical-device pass. The package/UI remain `1.0.0-rc.1`. Follow [the release checklist](RELEASE_CHECKLIST.md) before removing RC.

The website has not been deployed. Public hosting remains separately authorized by Ushio. No cloud/weather/other-planet extension is claimed in this release.
