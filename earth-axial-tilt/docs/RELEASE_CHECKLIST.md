# v1.0 acceptance checklist

**Status: release candidate. Do not tick an observation that was not performed.**

## Automated evidence

The workflow for the exact candidate HEAD is authoritative. Check both jobs: Chromium verification and macOS WebKit. Read failures and screenshots, not only the final green badge. The golden reference is pinned to Chromium fonts; WebKit exercises behaviour separately.

## Required physical iPhone / Safari observations — pending

Record device, iOS/Safari version, candidate commit, date and result when actually tested.

- [ ] Portrait and landscape; browser chrome/safe-area does not trap controls.
- [ ] Japanese and English, including Large text and Basic/All.
- [ ] Single Earth drag and pinch; taps pick a location, drags do not.
- [ ] Day, year and coupled playback start/stop; background/foreground does not jump a year.
- [ ] A/B comparison: both globes visible, angle entry and A−B values usable.
- [ ] Orbit overview in single and dual modes; all seasonal controls reachable.
- [ ] Focus enters/exits for single and dual without losing settings.
- [ ] Atlas opens/closes, touch selection works, vertical swipes scroll.
- [ ] ? explanation opens by tap and has a usable close/return path.
- [ ] Reload retains language/text/tool preferences; no repeated crash/context loss in ordinary use.

Do not treat macOS Playwright WebKit or a Chromium iPhone viewport as an on-device test. If an issue is found, fix it and repeat the affected flows before removing the RC suffix.

## Publication — separate authorization

- [ ] Ushio explicitly authorizes a public website deployment.
- [ ] Confirm intended destination and relative hosting path.
- [ ] Inspect the production build and attribution at that destination.

A public code repository is not permission to deploy a live site automatically.
