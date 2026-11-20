# `md-menu` (with `md-menu-item`, `md-menu-item-group`, `md-sub-menu-item`) — gate 7 independent audit

**Superseded verdict (re-check 2026-11-06): FAIL (macOS R4-16 reopened; iOS R4-27)**

R4-12 (the 16 CSS parts), R4-13 (`setComboboxElement` / `setVirtualProvider`), R4-14 (four hooks without a Chrome comparison), R4-15
(undocumented group-shape hooks, by decision), R4-16 (states failures on macOS and iOS 18.6), R4-17 (Android Laboratory no-op update) and
R4-21 (tools/ax Web reference) are re-checked below.

Reviewer: gate-7 reviewer r4. First audit 2026-10-31 (FAIL); re-check 2026-11-06 after the fix forks marked the r4 findings fixed
(d4: R4-01, 02, 04–10, 17, 18, 20; di: R4-11, R4-19; n2: R4-12–16, R4-21; R4-03 is still open, owner d3). Independent of the
implementing forks; no product code, tests or fixtures were changed.

Re-check snapshot: `work/audit/r4-tree`, refreshed from the canonical tree by job `r4-050-snapshot2` on 2026-11-06 16:03 UTC (rsync,
83 install jobs present, latest `di-045-install-ax-runtime`; file manifest `work/audit/r4/snap2/manifest.sha256`; no git commands).
Build products were rebuilt incrementally in the private tree. Devices: macOS (AppKit host), iOS simulator `AWC-r4` (iPhone 17 Pro,
iOS 26.3.1), Android emulator `emulator-5566` (AwcNative7, API 36), Chrome 153.0.8010.36 for the tools/ax Web reference.
Timing-sensitive suites (states/motion/stack, iOS harness, Android device runs, tools/ax) ran through `tools/slot.sh timing 4`;
the simulator was shut down on every job exit. Raw outputs: `work/audit/r4/runs2/` (first audit: `runs/`); job logs
`claude-runner/done/r4-05*`, `r4-A05*`, `r4-06*`.

## Re-check 2026-11-17

**Verdict (re-check 2026-11-17): FAIL (S7-6-02)** — gate-7 reviewer s7-6 (previous: re-check 2026-11-06 FAIL, gate-7 reviewer r4).

Snapshot `work/audit/s7-6-tree` (job `s7-6-001-snapshot`), canonical with iOS shim v5. Lanes: Mac r5, Android a6 (emulator-5566), simulators AWC-r5 (iPhone 26.3) and AWC-r5-18 (iOS 18.6). Jobs that ran across the Mac sleep of 2026-11-17 were repeated after the wake; counts below come only from the repeated jobs.

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | Menu paint 9092/9092 (`s7-6-002-swift`); states x2 | `s7-6-009` | 2523/2524, 2524/2524 (S7-6-02); virtual 18/18 |
| iOS 26.3 | Menu paint 9092; states x3; virtual | `s7-6-003-ios26` | 9092/9092; 2523/2524, 2524, 2524; 18/18 |
| iOS 18.6 | Menu states, virtual | `s7-6-004-ios18` | 2523/2524; 18/18 |
| Android | `s7-6-A001-android` | 28/28 tests |
- Gate 1: matrix regenerated (`s7-6-009`, `work/audit/s7-6/gate1/matrix.log`): every property, event, method, slot, hook and part has Swift, Compose and Laboratory hits; test hits missing only for two menu hooks (S7-6-03, non-blocking).
- Laboratory (gate 3): `s7-6-005-lab-web` 891 studio / 12 compiler / 561 spec / e2e ok; `s7-6-008`, `s7-6-009` live probes (children2 22 ok, 0 fail; the 3 LIVE_COMMAND_TIMEOUT failures of `s7-6-008` at load 119 did not repeat); live selection 20/20 runs 38/38 (`s7-6-009`); examples: Kotlin compile ok (`s7-6-A003-examples-kotlin`), Swift typecheck in `s7-6-002-swift`.
- Gate 6: tools/ax macOS/Web/iOS exit 0 (`s7-6-006`); Android 0 open findings on 4 components (`s7-6-A004-ax-android-repeat`); checkpoint hashes: 19 SAME, 0 DIFF (`work/audit/s7-6/hashcheck.py`).
- Exceptions: none proposed, none accepted.
- R4-16, R4-23 (both menu paint oracles by default), R4-27 (virtual 18/18 on all runtimes) verified. S7-6-02: one motion or flat-pixel check fails in 3 of 6 states runs at normal load, a different case each time (blocking); S7-6-03 non-blocking.


## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | md-menu 16/2/7/2/8 + 3 parts, md-menu-item 15/1/0/2/5 + 7 parts, group 2/0/0/1/0, sub-menu-item 9/1/1/2/0 + 6 parts; IR = CEM = inventory = source; all 16 parts now typed (`AWCMenuPart`/`AWCMenuItemPart`/`AWCSubMenuItemPart`, Compose `NativeMenuParts.kt`, Laboratory `MENU_*_PARTS`); both former unsupported methods implemented; R4-15 settled by a recorded decision |
| 2 Implementation | PASS | |
| 3 Laboratory | PASS | live previews of all four tags, retained and no-op updates, lifecycle methods with results, `reposition`, `collapse`, 46 + 46 examples compile |
| 4 Behaviour | **FAIL** (iOS) | states runs pass on three platforms; the virtual-provider / combobox suite passes on macOS (18/18) and Android but does not compile for iOS (R4-27) |
| 5 Visual | **FAIL** (macOS) | 138 + 17 (`menu-r4-paint`: parts, viewport-margin, section-gap, inline fill) Chrome cases pass on three platforms; macOS states keep the reduced click-radio phase-shot failure (R4-16) |
| 6 Runtime + AX | **FAIL** (iOS) | macOS, iPhone 26.3, iPhone 16 Pro 18.6 (states), Android; tools/ax 3 cases 0 open; iOS virtual suite unverified (R4-27) |
| 7 Final audit | FAIL | R4-16 (reopened), R4-27 |

## Re-check of the 2026-10-31 findings

- **R4-12 — VERIFIED.** All 16 parts have typed native styling on SwiftUI and Compose and Laboratory targets; the 17 Chrome cases of
  `menu-r4-paint.json` (byte-identical Swift fixture and Android asset; Chrome 153, 2026-10-31) cover every part: macOS 790/790,
  iPhone 790/790, Android **790/790** (r4-A052).
- **R4-13 — VERIFIED.** `handle.setComboboxElement(id)` / `handle.setVirtualProvider(_:)` on both platforms (declared supported in
  NativeSupport.json / support.json); `NativeMenuVirtualIntegration` (10,000-row provider, 8-row window, combobox) macOS 18/18,
  iPhone **does not compile for the simulator** (main-actor isolation errors in the fixture; `runs2/ios/run-r4j-NativeMenuVirtualIntegration.log`); Android `virtualProviderAndComboboxFollowTheSource` pass (r4-A050).
- **R4-14 — VERIFIED.** `hook-menu-viewport-margin-height/-width`, `hook-menu-section-gap(-default)`, `inline-fill-*` Chrome cases in
  `menu-r4-paint` pass on the three platforms (above).
- **R4-15 — RESOLVED BY DECISION** (accepted): md-menu.md records that the group-shape hooks are implemented natively and compared in
  `hook-group-shape`, and that the Laboratory exposes only CEM hooks until the source owner documents them in the CEM (alternative
  recorded). The md-menu-item-group readme already lists `--md-menu-group-container-shape`; the CEM still does not (source-owner item).
- **R4-16 — PARTIALLY FIXED, reopened.** The disabled-row hover layer is fixed: macOS no longer fails `pointer-item hover-disabled`, and iOS 18.6 (iPhone 16 Pro clone, r4-055) passes 2,524/2,524 where it failed twice before. The second part still fails on canonical code: macOS `NativeMenuStatesIntegration` 2,523/2,524 — `selection-keep-open (reduced) click-radio flat pixels` (4,474/175,894 pixels > 6 levels, worst 7 at (25,211)), byte-for-byte the first-audit signature; n2's own install gate recorded the same failure (`n2-lab/install-main/j64/menu-states.log`) and fx reproduced it in isolation (`integration/i4/isolated/NativeMenuStatesIntegration-2.log`). Android and iOS pass this run.**
- **R4-17 — VERIFIED.** Android `{quick:false}` (md-menu) and `{disabled:false}` (md-menu-item, md-sub-menu-item), all unchanged → 200,
  sessions alive (r4-051a); `LivePreviewNoOpUpdateHostTest#menu`, `#menuItem` pass.
- **R4-21 — VERIFIED.** tools/ax expectation for case `open` tied to the recorded initial-open decision (`expectations.mjs` line 109).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeMenuPaintIntegration` (138) | 8,302 | **8,302/8,302** | r4-051 |
| macOS `NativeMenuPaintIntegration` `AWC_MENU_FIXTURE=menu-r4-paint` (17) | n2 | **790/790** | r4-055 |
| macOS `NativeMenuStatesIntegration` (26 + 26 reduced) | 2,523 / 2,522 of 2,524 (r4 10-31) | **2,523/2,524 — `selection-keep-open (reduced) click-radio flat pixels` (4,474/175,894 pixels > 6 levels, worst 7), identical to the first audit and to n2's own install gate `n2-lab/install-main/j64/menu-states.log`** | r4-052 |
| macOS `NativeMenuVirtualIntegration` | n2 | **18/18** | r4-055 |
| Android `NativeMenuPaintTest` / `NativeMenuStatesTest` | 8,302 / 2,524 | **8,302/8,302**, **2,524/2,524** | r4-A050 |
| Android `NativeMenuPaintTest` menuFixture=menu-r4-paint | n2 | **790/790** | r4-A052 |
| Android `NativeMenuVirtualTest`, `LivePreviewMenuHostTest` | new / 4 | pass, **4/4** (7/7 tests in the run) | r4-A050 |
| iOS iPhone 17 Pro 26.3 paint / states | 8,302 / 2,524 | **8,302/8,302**, **2,524/2,524** | r4-053 |
| iOS iPhone 17 Pro 26.3 menu-r4 paint / virtual | n2 | **790/790**, ****does not compile for the simulator** (main-actor isolation errors in the fixture; `runs2/ios/run-r4j-NativeMenuVirtualIntegration.log`)** | r4-055 |
| iOS iPhone 16 Pro 18.6 states (the R4-16 runtime) | 2,522/2,524 (r4 10-31; di full18 11-05) | **2,524/2,524 (hover-disabled fixed)** | r4-055 |

Accepted test allowances (unchanged): fallback-glyph advance widening outside Roboto on Android/iOS; phase shots across Chrome's capture
window; iOS +2-frame envelope for HID delivery; Android activation-exit window widened by Chrome's 150 ms timer jitter.

## Gate 3 — Laboratory

4177 probe (r4-051a): md-menu on both platforms — update `{quick:true}`, `show()` (callId) → `mdOpen`, `reposition()`, `close()` → `mdClose`,
results `fulfilled`; md-menu-item `{headline, badge}`, md-menu-item-group `{label}`, md-sub-menu-item `{headline}` + `collapse()` (22/22 steps).
Examples regenerated (46 SwiftUI + 46 Compose, incl. the part examples): Swift 0 errors (r4-052a); Compose BUILD SUCCESSFUL (r4-A051). Studio
110/110 (r4-052a); SwiftUI `test-live-menu` 43/43.

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-menu/report.md`): 3 cases — macOS pass (5 accepted), iOS pass (1 accepted), Android pass (7 accepted), **0 open**.
The five md-menu expectations (Android group label as text; expanded state on the roleless md-button anchor; menu name and first-row
Tab stop with auto-focus off; menu name in case `open` from the initial-open gap) match recorded decisions and are accepted.

## Exception decisions

No exception records needed: R4-13 was implemented rather than excepted; R4-15 is a recorded, reversible decision (accepted).

## Findings

- **R4-16** (gates 5/6, macOS, blocking — reopened): `selection-keep-open (reduced) click-radio` phase shot still fails (2,523/2,524).
- **R4-27** (gate 6 iOS, blocking): `NativeMenuVirtualIntegration` (the R4-13 virtual-provider / combobox suite) does not compile for the iOS simulator (main-actor isolation), so the new native APIs are unverified on iOS.
- Non-blocking: R4-23 (`NativeMenuVirtualIntegration` is not in `test-native-views.sh`'s fixture list and `menu-r4-paint` runs only when selected by `AWC_MENU_FIXTURE` / `menuFixture`, so integration runs do not cover R4-12/13/14).

## History

First audit 2026-10-31: FAIL (R4-12–17; R4-21 non-blocking); `work/audit/r4/runs/`, `work/audit/r4/audit/md-menu.md`.
