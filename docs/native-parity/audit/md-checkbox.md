# `md-checkbox` — gate 7 independent audit

**Superseded verdict (re-check 2026-11-06): FAIL (gate 3: R4-26)**

R4-06 (macOS held-Space key repeat untested), R4-07 (open source decisions) and R4-17 (Android Laboratory no-op update) are verified
fixed, and every paint/states suite passes on macOS, the iOS simulator and Android. The SwiftUI Laboratory live host, however,
fails intermittently on the checkbox's validation message (R4-26), so gate 3 is not met until its cause is known.

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

**Verdict (re-check 2026-11-17): FAIL (S7-6-01)** — gate-7 reviewer s7-6 (previous: re-check 2026-11-06 FAIL, gate-7 reviewer r4).

Snapshot `work/audit/s7-6-tree` (job `s7-6-001-snapshot`), canonical with iOS shim v5. Lanes: Mac r5, Android a6 (emulator-5566), simulators AWC-r5 (iPhone 26.3) and AWC-r5-18 (iOS 18.6). Jobs that ran across the Mac sleep of 2026-11-17 were repeated after the wake; counts below come only from the repeated jobs.

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | NativeCheckboxPaintIntegration | `s7-6-002-swift` | 6019/6019 |
| iOS 26.3 | Checkbox paint; states x3 | `s7-6-003-ios26` | 6019/6019; 17851/17852, 17971/17972, 17977/17978 (S7-6-01) |
| iOS 18.6 | Checkbox states | `s7-6-004-ios18` | 17480/17480 |
| Android | `s7-6-A001-android` | 28/28 tests |
- Gate 1: matrix regenerated (`s7-6-009`, `work/audit/s7-6/gate1/matrix.log`): every property, event, method, slot, hook and part has Swift, Compose and Laboratory hits; test hits missing only for two menu hooks (S7-6-03, non-blocking).
- Laboratory (gate 3): `s7-6-005-lab-web` 891 studio / 12 compiler / 561 spec / e2e ok; `s7-6-008`, `s7-6-009` live probes (children2 22 ok, 0 fail; the 3 LIVE_COMMAND_TIMEOUT failures of `s7-6-008` at load 119 did not repeat); live selection 20/20 runs 38/38 (`s7-6-009`); examples: Kotlin compile ok (`s7-6-A003-examples-kotlin`), Swift typecheck in `s7-6-002-swift`.
- Gate 6: tools/ax macOS/Web/iOS exit 0 (`s7-6-006`); Android 0 open findings on 4 components (`s7-6-A004-ax-android-repeat`); checkpoint hashes: 19 SAME, 0 DIFF (`work/audit/s7-6/hashcheck.py`).
- Exceptions: none proposed, none accepted.
- R4-26 (live selection intermittent): 20/20 runs pass, so the earlier finding is verified. New finding S7-6-01 (iOS 26.3 pointer-light glyph opacity, 1 check per run in 3 of 3 runs) blocks the verdict.


## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 12 properties, 2 events, 4 methods, 0 slots, 14 hooks, 5 parts; IR = CEM = inventory = source (`b8671637…`); every row has SwiftUI, Compose, Laboratory and a test (`matrix2/md-checkbox.txt`); "Decisions (autonomous, 2026-10-31, reversible)" recorded |
| 2 Implementation | PASS | dedicated renderers; repeat filter on the routed event |
| 3 Laboratory | **FAIL** | live previews, retained and no-op updates, methods with results and examples pass; the SwiftUI live host fails intermittently on the checkbox support line (R4-26) |
| 4 Behaviour | PASS | states incl. held-Space repeats (Swift) and `heldSpaceTogglesOnce` (Android) |
| 5 Visual | PASS | 261 Chrome paint cases on three platforms |
| 6 Runtime + AX | PASS | macOS, iPhone 26.3, Android; tools/ax 8 cases |
| 7 Final audit | FAIL | gate 3: R4-26 |

## Re-check of the 2026-10-31 findings

- **R4-06 — VERIFIED.** The Swift states suite now sends AppKit repeats for a held Space (one `mdChange`); macOS 34,130/34,130,
  iPhone 17,714/17,714; Android `heldSpaceTogglesOnce` passes (r4-A050).
- **R4-07 — VERIFIED.** md-checkbox-source-review.md "Decisions (autonomous, 2026-10-31, reversible)": `aria-invalid` at rest follows each
  component's source policy; `<fieldset disabled>` maps to the per-control `disabled` contract (Web paint gap reported to the source owner);
  alternatives and revert paths recorded; referenced from the switch and radio reviews.
- **R4-17 — VERIFIED** (see md-switch: Android no-op updates 13/13 + 8/8, `LivePreviewNoOpUpdateHostTest` pass).
- R4-18 — hygiene: single gate-6 entry; the stale "no mixed state" statement is gone; checkpoint hashes stale again after later installs (non-blocking).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeCheckboxPaintIntegration` (261) | 6,019 | **6,019/6,019** (0 skipped) | r4-051 |
| macOS `NativeCheckboxStatesIntegration` | 35,636 (d4) | **34,130/34,130** | r4-052 |
| Android `NativeCheckboxParityTest` / `NativeCheckboxInteractionTest` (+ held Space) | 5,759 / 23,310 | **5,759/5,759**, **23,310/23,310**, held-Space ok | r4-A050 |
| iOS sim paint / states (iPhone 17 Pro 26.3) | 6,019 / 17,856 | **6,019/6,019**, **17,714/17,714** | r4-053 |

## Gate 3 — Laboratory

4177 probe (r4-051a): sessions on both platforms; update `{checked:false, indeterminate:true}`; `checkValidity()` → `true`;
`setCustomValidity` + `getValidity` → `mdValidityChange {valid:false}`; no-op updates `{softDisabled:false}` accepted on Android and iOS.
Examples 118 + 118 (selection set): Swift 0 errors (r4-052a); Compose BUILD SUCCESSFUL (r4-A051). Studio 110/110 (r4-052a); `test-live-selection` **38/38 in 4 of 6 runs**; 2 runs (r4-052a, r4-056 run 3) failed "valid again hides the message" (md-checkbox, R4-26).

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-checkbox/report.md`): 8 cases — macOS pass (1 accepted), iOS pass, Android pass, **0 open**.
Expectation accepted (convention): macOS `AXRequired`. Indeterminate is `AXValue 2` on macOS, "Mixed" on iOS, "Partially checked" on Android.

## Exception decisions

None proposed. Space on key-down and Enter inert follow the source.

## Findings

- **R4-26** (gate 3, blocking until its cause is known — PARALLEL.md load rule): the SwiftUI live host `test-live-selection.mjs` fails intermittently at "valid again hides the message": after `reportValidity()` and a retained `{checked:true}` update, the next frame still shows the checkbox support line (2 of 6 runs on this snapshot, 1 of 3 in the first audit). Either a one-frame lag in clearing the validation message (product) or a frame read before the update renders (test).
- Non-blocking: R4-18 (checkpoint hashes stale again).

## History

First audit 2026-10-31: FAIL (R4-06, R4-07, R4-17; R4-18 hygiene); `work/audit/r4/runs/`, `work/audit/r4/audit/md-checkbox.md`.
