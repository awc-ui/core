# `md-bottom-sheet` — gate 7 independent audit

**Superseded verdict (re-check 2026-11-06): FAIL (gate 6 macOS: R4-03 open)**

R4-01 (slotted content shrink), R4-02 (Android local density), R4-04 (decisions) and R4-17 (Android Laboratory no-op update) are verified
fixed, and every paint/motion/stack suite passes on macOS, the iOS simulator and Android. The modal sheet is still exposed to macOS
assistive technology as a plain named group without dialog role or modal state (R4-03, owner d3); the tools/ax "Decision 7" expectations
that hide it remain rejected.

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

**Verdict (re-check 2026-11-17): PASS** — gate-7 reviewer s7-6 (previous: re-check 2026-11-06 FAIL, gate-7 reviewer r4).

Snapshot `work/audit/s7-6-tree` (job `s7-6-001-snapshot`), canonical with iOS shim v5. Lanes: Mac r5, Android a6 (emulator-5566), simulators AWC-r5 (iPhone 26.3) and AWC-r5-18 (iOS 18.6). Jobs that ran across the Mac sleep of 2026-11-17 were repeated after the wake; counts below come only from the repeated jobs.

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | Bottom sheet paint / motion / modal stack | `s7-6-002-swift` | 1948/1948, 15663/15663, 149/149 |
| iOS 26.3 | paint / motion / stack | `s7-6-003-ios26` | 1948 full, 21466 motion, 149 |
| iOS 18.6 | motion / stack | `s7-6-004-ios18` | 21817, 149 |
| Android | `s7-6-A001-android` | 28/28 tests |
- Gate 1: matrix regenerated (`s7-6-009`, `work/audit/s7-6/gate1/matrix.log`): every property, event, method, slot, hook and part has Swift, Compose and Laboratory hits; test hits missing only for two menu hooks (S7-6-03, non-blocking).
- Laboratory (gate 3): `s7-6-005-lab-web` 891 studio / 12 compiler / 561 spec / e2e ok; `s7-6-008`, `s7-6-009` live probes (children2 22 ok, 0 fail; the 3 LIVE_COMMAND_TIMEOUT failures of `s7-6-008` at load 119 did not repeat); live selection 20/20 runs 38/38 (`s7-6-009`); examples: Kotlin compile ok (`s7-6-A003-examples-kotlin`), Swift typecheck in `s7-6-002-swift`.
- Gate 6: tools/ax macOS/Web/iOS exit 0 (`s7-6-006`); Android 0 open findings on 4 components (`s7-6-A004-ax-android-repeat`); checkpoint hashes: 19 SAME, 0 DIFF (`work/audit/s7-6/hashcheck.py`).
- Exceptions: none proposed, none accepted.
- R4-03 (dialog role/modal on macOS) and the stacking suite verified; a11y 22/22 (`NativeContainerAccessibilityIntegration`).


## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 13 properties, 3 events, 2 methods, 4 slots, 16 hooks, 11 parts; IR = CEM = inventory = source (`6a24877c…`); every row has all four (`matrix2/md-bottom-sheet.txt`); decisions recorded (R4-04) |
| 2 Implementation | PASS | flex-shrink content column (`AWCSheetFlexColumn`) on both platforms; nearest-rung density tokens on Compose |
| 3 Laboratory | PASS | live previews, retained and no-op updates, `show`/`close` with results, 111 + 111 modal examples compile |
| 4 Behaviour | PASS | motion/drag/events/focus runs, six-order modal stack |
| 5 Visual | PASS | 126 Chrome paint cases incl. the shrunk body and the local-density parts (no skips) |
| 6 Runtime + AX | **FAIL** | runtime passes on macOS, iPhone 26.3, Android; macOS AX role/modal = R4-03 |
| 7 Final audit | FAIL | R4-03 |

## Re-check of the 2026-10-31 findings

- **R4-01 — VERIFIED.** `NativeBottomSheetPaintIntegration.swift` and `NativeBottomSheetParityTest.kt` now compare the full body box against
  Chrome's shrunk block (the "Known difference" skips are gone): macOS **1,948/1,948**, Android **1,816/1,816** (r4-A050), iPhone 1,948/1,948.
- **R4-02 — VERIFIED.** The `local-density-wins` part skip is removed; Android paint now compares those parts (1,807 → 1,816 checks), pass.
- **R4-03 — STILL OPEN** (owner d3). The r4-052b macOS capture still reports `group:Project details` with no dialog subrole and no modal state; only the two Decision-7 expectations keep the tool report green.
- **R4-04 — VERIFIED.** md-bottom-sheet-source-review.md "Decisions (autonomous, 2026-10-31, reversible)": dialog-over-sheet paint order
  (Chrome's z-index order; alternative open order; revert path) and the 0.8 dragging-indicator opacity (render what Chrome renders);
  Escape protection across the family is decided in md-side-sheet-source-review.md (each component keeps its source contract).
- **R4-17 — VERIFIED.** Android `{scrimDismissible:true}` (unchanged) → 200, session alive (r4-051a); `LivePreviewNoOpUpdateHostTest#bottomSheet`.
- R4-18 — hygiene: single gate-6 entry; checkpoint hashes stale again after d4-023/034 (non-blocking). New stale text (R4-24): md-bottom-sheet.md
  still lists "The 0.8 dragging indicator (open decision)" and "Android density hand-off … reported as a deviation", both resolved.

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeBottomSheetPaintIntegration` (126) | 1,948 | **1,948/1,948** | r4-051 |
| macOS `NativeBottomSheetMotionIntegration` (15 + 2 runs) | 13,766 (d4) | **14,966/14,966** (per-frame count) | r4-052 |
| macOS `NativeModalStackIntegration` (13 mixed runs) | 149 | **149/149** | r4-052 |
| Android `NativeBottomSheetParityTest` / `NativeBottomSheetMotionTest` / `NativeModalStackTest` | 1,807 / 7,378 / 149 | **1,816/1,816**, **7,378/7,378**, **149/149** | r4-A050 |
| Android `LivePreviewModalHostTest` | 8 | **8/8** (13 tests in the modal run) | r4-A050 |
| iOS sim paint / motion / stack (iPhone 17 Pro 26.3) | 1,948 / 21,282 / 149 | **1,948/1,948**, **21,447/21,447**, **149/149** | r4-053 |

## Gate 3 — Laboratory

4177 probe (r4-051a): both platforms; update `{headline:'Audit headline'}`; `show()` (callId) → `mdOpen`, `close()` → `mdClose`, method
results `fulfilled`; no-op/changing update matrix 8/8 on Android and iOS. Modal examples (111 + 111, unchanged since 10-31): Swift
0 errors (r4-052a); Compose BUILD SUCCESSFUL (r4-A051). Studio 110/110 (r4-052a); SwiftUI `test-live-modal` 63/63.

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-bottom-sheet/report.md`): 1 case — iOS pass, Android pass (`dialog:Project details`); macOS "pass" only through the two Decision-7 expectations, which r4 rejects (R4-03).
The two macOS expectations "role dialog → group" / "modal: true → ∅" (Decision 7, `tools/ax/expectations.mjs`) stay **rejected**: the
library already vends an AppKit accessibility container for a role SwiftUI lacks (`AXMenu` for md-menu / md-fab-menu); the same bridge can
report the dialog subrole and `AXModal`. The 40 pt close-button touch-target note follows the source size (informational).

## Exception decisions

No exception record proposed. "Decision 7" functions as a waiver and is rejected (R4-03).

## Findings

- **R4-03** (gate 6, macOS, blocking, owner d3): modal sheet without dialog role / modal state.
- Non-blocking: R4-24 (md-bottom-sheet.md still lists the decided 0.8-indicator item as "open decision" and the fixed Android density hand-off as a deviation); R4-18.

## History

First audit 2026-10-31: FAIL (R4-01, 02, 03, 04, 17; R4-18 hygiene); `work/audit/r4/runs/`, `work/audit/r4/audit/md-bottom-sheet.md`.
