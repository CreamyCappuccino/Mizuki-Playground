# 1.1.0-rc.1 verification checkpoint

## Executed checkpoint

- Source commit: `da4bd1c027501978859744dd6c1725db82010b02` on `mizuki/earth-first-11`.
- GitHub Actions [Earth Axial Tilt CI #40](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36190217655): **success**.
- Reproducible npm ci, document/translation checks, TypeScript, **114 unit tests**, production build.
- Ubuntu Chromium: **64 passed** (entire suite, including 8 v1.1 tests).
- Selected macOS WebKit suites v06–v11: **41 passed**, 1 intentional skip (Chromium-specific golden image). Each suite ran in a fresh browser process; failures were not ignored.

## New behavior exercised

Complete preset application and one-step undo; paused restoration; every scientific state field; Japanese and Large preferences preserved; malformed/future/duplicate/partial payload rejection; JSON export and import; clipboard-denial fallback; stale link feedback; newer user edits overriding a pending comparison import; invalid newer hash cancelling an older valid import; narrow Japanese layouts.

No source under `src/physics/` was changed from the preceding Earth-first baseline `94f1c8c44ab5de9a2b6688a7db441319cd28e327`. There is no new climate calibration or new planet.

## Visual observations

Downloaded the CI artifacts and inspected the Japanese workbench screenshot from macOS WebKit at phone width. The question, observation instructions, prepare/undo buttons and portable-settings controls remain readable; longer explanations wrap rather than shrinking.

Artifacts:
- [Chromium #40](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36190217655/artifacts/10888410372)
- [WebKit #40](https://github.com/CreamyCappuccino/Mizuki-Playground/actions/runs/36190217655/artifacts/10887812434)

Artifact retention is seven days. Source/tests remain in Git after artifact expiry. The snapshot workflow used only to assemble the isolated development workspace was removed before this verification.

## Limits and remaining gate

Local unit/build verification succeeded with the same installed dependency graph. Local browser navigation in the assistant's container was denied by administrator policy; it was not bypassed and is not counted as application verification. Real browser verification above was executed in GitHub Actions.

Automated macOS WebKit and phone-width screenshots are not a physical iPhone running Safari. The on-device acceptance in [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md) remains open. No website deployment, new account, remote settings service or geolocation access was added.

Later documentation commits do not retroactively change the tested SHA above. For any final/main HEAD, use its own GitHub Actions run as the completion authority.
