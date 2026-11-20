# `md-switch` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS**

R4-06 (held-Space key repeat untested — the new macOS test found and the fix closed a real defect), R4-07 (shared selection-control
decisions) and R4-17 (Android Laboratory no-op update) are verified fixed. Every suite passes on macOS, the iOS simulator and Android.

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

## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 12 properties, 3 events, 5 methods, 2 slots, 12 hooks, 4 parts; IR = CEM = inventory = source (sha256 tsx+css `8997d02e…`); every row has SwiftUI, Compose, Laboratory and a test (`work/audit/r4/matrix2/md-switch.txt`); decisions recorded (R4-07) |
| 2 Implementation | PASS | dedicated renderers; key-repeat filter now reads the routed event (`AWCNativeKeyRouting`) |
| 3 Laboratory | PASS | live SwiftUI + Compose previews, retained updates incl. no-op updates, methods with results, 118 + 118 selection examples compile |
| 4 Behaviour | PASS | states suites incl. held-Space repeats (Swift) and `NativeSwitchKeyRepeatTest` (Android) |
| 5 Visual | PASS | 430 Chrome paint cases on three platforms |
| 6 Runtime + AX | PASS | macOS, iPhone 26.3, Android; tools/ax 5 cases |
| 7 Final audit | PASS | all r4 findings verified |

## Re-check of the 2026-10-31 findings

- **R4-06 — VERIFIED.** `NativeSwitchStatesIntegration` now sends AppKit key repeats for a held Space and expects one toggle; macOS
  32,055/32,055, iPhone 16,611/16,611; Android `NativeSwitchKeyRepeatTest` (`heldSpaceTogglesOnce`, `heldEnterNeverToggles`) pass (r4-A050).
- **R4-07 — VERIFIED.** md-switch-source-review.md "Decisions (autonomous, 2026-10-31, reversible)" points to the shared decisions in
  md-checkbox-source-review.md (`aria-invalid` at rest per component policy; `<fieldset disabled>` → per-control `disabled`, alternative and
  revert recorded).
- **R4-17 — VERIFIED.** 4177 matrix (r4-051a): Android `{softDisabled:false}` (unchanged) and `{softDisabled:true}` both 200, frames 200,
  session alive (13/13 and 8/8 over all r4 tags); `LivePreviewNoOpUpdateHostTest` 9/9 tests pass (r4-A050).
- R4-18 — hygiene re-checked: one gate-6 entry in the AUDIT row; md-switch.md stale statements removed. The checkpoint.json files were
  re-pinned on 10-31 but later installs (d4-019/023/034, di-030/032) changed shared files again, so their hashes are stale (non-blocking).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeSwitchPaintIntegration` (430 cases) | 10,447 | **10,447/10,447** (0 skipped) | r4-051 |
| macOS `NativeSwitchStatesIntegration` (17 runs + key repeats) | 31,611 (d4) | **32,055/32,055** | r4-052 |
| Android `NativeSwitchParityTest` / `NativeSwitchInteractionTest` | 10,447 / 26,285 | **10,447/10,447**, **26,285/26,285** | r4-A050 |
| Android `NativeSwitchKeyRepeatTest`, `LivePreviewSelectionHostTest`, `LivePreviewNoOpUpdateHostTest` | new | all pass (23/23 tests in the selection run) | r4-A050 |
| iOS sim paint / states (iPhone 17 Pro 26.3) | 10,447 / 16,513 | **10,447/10,447**, **16,611/16,611** | r4-053 |

## Gate 3 — Laboratory

4177 probe (r4-051a): SwiftUI + Compose sessions, update `{selected:false}`, `checkValidity()` → `true`, `setCustomValidity` +
`reportValidity` → `mdValidityChange {valid:false}` on both (64/64 probe steps ok); no-op/changing update matrix 13/13 Android and iOS.
Examples regenerated from the snapshot (118 SwiftUI + 118 Compose selection examples, changed since 10-31 by the chip part work):
`swiftc -typecheck` 0 errors (r4-052a); `:app:compileDebugAndroidTestKotlin` BUILD SUCCESSFUL, example classes produced (r4-A051).
Studio 110/110 (r4-052a); SwiftUI live host `test-live-selection` **38/38 in 4 of 6 runs**; 2 runs (r4-052a, r4-056 run 3) failed "valid again hides the message" (md-checkbox, R4-26).

## Gate 6 — runtime and accessibility

tools/ax re-run (r4-052b macOS/Web/iOS, r4-A060 Android, compare r4-061; `work/audit/r4/runs2/ax/md-switch/report.md`): 5 cases (off, on, disabled, soft-disabled, required) — macOS pass (1 accepted), iOS pass, Android pass, **0 open**. The macOS captures carry full AX trees (the coordinator's screen-lock caveat did not affect this run).
Expectation reviewed and accepted (convention): macOS `AXRequired` where Chrome drops `aria-required` for the switch role.
iOS: re-run on iPhone 17 Pro 26.3; the iPad 26.3 / iOS 18.6 evidence of di's full runs after di-030/032 (`outputs/native-parity/_ios/di/`)
is on code that predates only the later d4/n2/di-045 installs.

## Exception decisions

No exception record proposed. Accepted conventions: Compose `Role.Switch` vs AppKit `AXCheckBox`+`AXSwitch`, Enter inert, Space on
key-down (source behaviour).

## Findings

None blocking. Non-blocking: R4-18 (checkpoint hashes stale again after later installs).

## History

First audit 2026-10-31: FAIL (R4-06, R4-07, R4-17; R4-18 hygiene). Its matrix and counts are in `work/audit/r4/runs/` and the
first version of this file (`work/audit/r4/audit/md-switch.md`).
