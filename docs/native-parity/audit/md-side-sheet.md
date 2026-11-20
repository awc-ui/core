# `md-side-sheet` — gate 7 independent audit

**Superseded verdict (re-check 2026-11-06): FAIL (gate 6: R4-03 open — macOS modal variant; new R4-25 — iOS Tab order)**

R4-04 (decisions), R4-05 (Tab order), R4-17 (Android Laboratory no-op update), R4-19 (iOS event timing) and R4-20 (modal-variant
accessibility case) are verified fixed, and every paint/motion/stack suite passes on macOS, the iOS simulator and Android. The new
tools/ax `modal` case shows the modal side sheet exposed on macOS as a named group without dialog role or modal state — the same gap as
R4-03 (owner d3), so the component cannot pass yet.

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
| macOS | Side sheet paint / motion / modal stack | `s7-6-002-swift` | 3057/3057, 9510/9510, 149/149 |
| iOS 26.3 | paint / motion / stack | `s7-6-003-ios26` | 3057 full, 11832 motion, 149 |
| iOS 18.6 | motion / stack | `s7-6-004-ios18` | 10926, 149 |
| Android | `s7-6-A001-android` | 28/28 tests |
- Gate 1: matrix regenerated (`s7-6-009`, `work/audit/s7-6/gate1/matrix.log`): every property, event, method, slot, hook and part has Swift, Compose and Laboratory hits; test hits missing only for two menu hooks (S7-6-03, non-blocking).
- Laboratory (gate 3): `s7-6-005-lab-web` 891 studio / 12 compiler / 561 spec / e2e ok; `s7-6-008`, `s7-6-009` live probes (children2 22 ok, 0 fail; the 3 LIVE_COMMAND_TIMEOUT failures of `s7-6-008` at load 119 did not repeat); live selection 20/20 runs 38/38 (`s7-6-009`); examples: Kotlin compile ok (`s7-6-A003-examples-kotlin`), Swift typecheck in `s7-6-002-swift`.
- Gate 6: tools/ax macOS/Web/iOS exit 0 (`s7-6-006`); Android 0 open findings on 4 components (`s7-6-A004-ax-android-repeat`); checkpoint hashes: 19 SAME, 0 DIFF (`work/audit/s7-6/hashcheck.py`).
- Exceptions: none proposed, none accepted.
- R4-03 and R4-25 (iOS Tab order) verified; a11y 22/22; tools/ax modal case clean.


## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 12 properties, 4 events, 3 methods, 5 slots, 9 hooks, 9 parts; IR = CEM = inventory = source (`b2bbfc21…`); every row has all four; decisions recorded (R4-04) |
| 2 Implementation | PASS | document-order Tab traversal on AppKit/UIKit (`NativeDocumentOrder.swift`) |
| 3 Laboratory | PASS | live previews, retained and no-op updates, `show`/`close`/`whenClosed` with results, modal examples compile |
| 4 Behaviour | PASS | motion/methods runs with Chrome's focus after every Tab (R4-05), six-order modal stack |
| 5 Visual | PASS | paint cases on three platforms |
| 6 Runtime + AX | **FAIL** | runtime passes on macOS, iPhone 26.3, Android; macOS modal-variant role/modal = R4-03; iOS Tab order in the Laboratory presentation = R4-25 |
| 7 Final audit | FAIL | R4-03, R4-25 |

## Re-check of the 2026-10-31 findings

- **R4-04 — VERIFIED.** md-side-sheet-source-review.md "Decisions (autonomous, 2026-10-31, reversible)": Escape protection (keep the
  source contract), colour hook with two defaults, back wrapper without a part, hard-coded English names, RTL motion — each with
  alternative / revert.
- **R4-05 — VERIFIED.** `NativeSideSheetMotionIntegration` now sends real Tab keys to the standard sheet and checks Chrome's focus after
  every step (no set comparison); macOS **9,285/9,285**, iPhone 11,955/11,955; the AppKit/UIKit key-view loop is filled in document order
  (`AWCModalScope` numbering, `NativeDocumentOrder.swift`).
- **R4-17 — VERIFIED.** Android `{closeable:true}` (unchanged) → 200, session alive; `LivePreviewNoOpUpdateHostTest#sideSheet`.
- **R4-19 — VERIFIED.** iPhone 26.3 11,955/11,955 on the r4 run (first audit: 2–4 event-timing failures in every run); di's iPad
  12,051/12,051 and iOS 18.6 12,024/12,024 (`outputs/native-parity/_ios/di/console-full{ipad,18}-NativeSideSheetMotionIntegration.log`).
  The fixtures now time an event from the delivery of its step's input (ios-harness.md item 31).
- **R4-20 — VERIFIED.** `tools/ax/cases.mjs` has a `modal` case (`variant: 'modal'`); r4 capture: iOS and Android pass; macOS reports role dialog → group and no modal state (R4-03).
- R4-18 — hygiene: single gate-6 entry; checkpoint hashes stale again after d4-034 (non-blocking).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeSideSheetPaintIntegration` | 3,057 | **3,057/3,057** | r4-051 |
| macOS `NativeSideSheetMotionIntegration` (incl. Tab order) | 8,955 (d4) | **9,285/9,285** | r4-052 |
| macOS `NativeModalStackIntegration` | 149 | **149/149** | r4-052 |
| Android `NativeSideSheetParityTest` / `NativeSideSheetMotionTest` / `NativeModalStackTest` | 2,703 / 4,258 / 149 | **2,703/2,703**, **4,258/4,258**, **149/149** | r4-A050 |
| Android `LivePreviewModalHostTest` | 8 | **8/8** | r4-A050 |
| iOS sim paint / motion / stack (iPhone 17 Pro 26.3) | 3,057 / 11,970 (di) / 149 | **3,057/3,057**, **11,955/11,955**, **149/149** | r4-053 |

## Gate 3 — Laboratory

4177 probe (r4-051a): both platforms; update `{headline}`; `show()` → `mdOpen`, `close()` → `mdClose`, results `fulfilled`; no-op
`{closeable:true}` accepted on Android and iOS. Modal examples 111 + 111: Swift 0 errors (r4-052a); Compose BUILD SUCCESSFUL. Studio 110/110 (r4-052a);
`test-live-modal` 63/63.

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-side-sheet/report.md`), 2 cases: **3 open findings.** Case `modal` (new, R4-20): macOS role dialog → group and modal: true → ∅ (R4-03); iOS and Android pass, the Tab trap matches Chrome everywhere. Case `open` (standard): macOS and Android pass, but **iOS now tabs Close → Open → ∅ → Close** where Chrome (and iOS in the first audit) go Open → Close — reproduced in 3 of 3 captures (r4-052b, r4-057 ×2) (R4-25).
Touch-target notes (40 pt close, 134 × 40 launcher) follow the source sizes (informational).

## Exception decisions

None proposed. No expectation covers the modal side sheet's macOS role; the Decision-7 expectations for dialog / bottom sheet stay
rejected (R4-03).

## Findings

- **R4-03** (gate 6, macOS, blocking, owner d3): the modal side sheet (`role=dialog`, `aria-modal`) is a plain named group on macOS.
- **R4-25** (gate 6 iOS focus order, blocking): in the tools/ax iOS presentation the standard sheet's Tab order is Close → Open (Chrome: Open → Close). The macOS SwiftUI Laboratory host and the iOS probe both declare the sheet before the launcher (`LiveRenderer/main.swift:437`, `tools/ax/ios/AccessibilityProbe.swift:30-35`); since d4-034 UIKit fills the key-view loop in that declaration order while AppKit still yields Chrome's order for the same tree. The fixture `NativeSideSheetMotionIntegration` (DOM-ordered tree) passes on iOS.
- Non-blocking: R4-18.

## History

First audit 2026-10-31: FAIL (R4-04, 05, 17, 19, 20; R4-18 hygiene); `work/audit/r4/runs/`, `work/audit/r4/audit/md-side-sheet.md`.
