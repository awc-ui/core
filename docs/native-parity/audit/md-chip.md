# `md-chip` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS**

R4-02 (Android local density), R4-08 (Android arrow keys), R4-09 (`::part(primary)`), R4-10 (keyboard ripple box), R4-11 (iOS states
timing) and R4-17 (Android Laboratory no-op update) are verified fixed. Every suite passes on macOS, the iOS simulator and Android.

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
| 1 Source contract | PASS | 14 properties, 3 events, 0 methods, 3 slots, 12 hooks, 8 parts (all 8 now typed natively, incl. `primary`); IR = CEM = inventory = source (`2cce8253…`) |
| 2 Implementation | PASS | dedicated renderers; nearest-rung density tokens on Compose; arrows no longer move focus on Android |
| 3 Laboratory | PASS | live previews, retained and no-op updates, part examples, examples compile |
| 4 Behaviour | PASS | interaction runs incl. ArrowRight (Android) and the width-changing keyboard ripple (no skip) |
| 5 Visual | PASS | 453 Chrome paint cases (new `parts-primary`) on three platforms |
| 6 Runtime + AX | PASS | macOS, iPhone 26.3, Android; tools/ax 6 cases |
| 7 Final audit | PASS | all r4 findings verified |

## Re-check of the 2026-10-31 findings

- **R4-02 — VERIFIED.** The `density-local-wins` skip is gone from `NativeChipParityTest.kt`; Compose takes spacing tokens from the nearest
  defining rung (`AWCSpacingTokens`, `LocalAWCDensityRungs`); Android paint grew from 11,786 to **11,840/11,840** checks (r4-A050).
- **R4-08 — VERIFIED.** `NativeChipInteractionTest` sends ArrowRight and checks that focus stays (Chrome parity); 36,678/36,678.
- **R4-09 — VERIFIED.** Typed `::part(primary)` on SwiftUI and Compose (background, outline), Laboratory part target and example, Chrome
  case `parts-primary` in the shared oracle: macOS paint **9,954/9,954**, Android 11,840/11,840, iPhone 9,954/9,954.
- **R4-10 — VERIFIED.** The width-changing keyboard ripple check is no longer skipped (`startBox`); macOS states 149,580/149,580.
- **R4-11 — VERIFIED** on the r4 iPhone 26.3 run: 159,589/159,589 (di's harness patches: host pointer at delivery, phase clocks); di's own
  iPad 159,190/159,190 and iOS 18.6 157,093/157,093 runs (`outputs/native-parity/_ios/di/console-full{ipad,18}-NativeChipStatesIntegration.log`).
- **R4-17 — VERIFIED** (`{softDisabled:false}` on Android → 200, session alive; `LivePreviewNoOpUpdateHostTest#chip`).
- R4-18 — hygiene: single gate-6 entry; three checkpoint entries name files that no longer exist (recorded as notFound by d4) and the
  hashes are stale again after d4-019 (non-blocking).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeChipPaintIntegration` (453) | 9,954 (d4) | **9,954/9,954** | r4-051 |
| macOS `NativeChipStatesIntegration` (45 + 5 runs) | 147,893 (d4) | **149,580/149,580** | r4-052 |
| Android `NativeChipParityTest` / `NativeChipInteractionTest` | 11,786 / 36,754 | **11,840/11,840**, **36,678/36,678** | r4-A050 |
| Android `NativeChipGlyphTest`, `NativeChipRemoveSemanticsTest` | pass | pass (4/4 tests) | r4-A050 |
| iOS sim paint / states (iPhone 17 Pro 26.3) | 9,954 / 157,707 (di) | **9,954/9,954**, **159,589/159,589** | r4-053 |

Accepted test allowances: Android label advances within 1 px of Chrome (font shaping); phase shots compared inside Chrome's recorded capture window.

## Gate 3 — Laboratory

4177 probe (r4-051a): sessions on both platforms; update `{label:'Audit chip', selected:true}`; no-op `{softDisabled:false}` accepted.
Examples (selection set incl. chip part examples): Swift 0 errors (r4-052a); Compose BUILD SUCCESSFUL. Studio 110/110 (r4-052a); `chipHooksAndRetainedUpdates`
pass; `test-live-selection` **38/38 in 4 of 6 runs**; 2 runs (r4-052a, r4-056 run 3) failed "valid again hides the message" (md-checkbox, R4-26).

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-chip/report.md`): 6 cases — macOS pass (2 accepted), iOS pass, Android pass, **0 open**.
Expectation accepted: macOS "group disabled → ∅" (AppKit groups carry no enabled state; the chip control reports `AXEnabled false`).
Touch-target notes follow the source sizes (informational).

## Exception decisions

None proposed; none needed after R4-08 and R4-09.

## Findings

None blocking. Non-blocking: R4-18 (checkpoint hashes stale again; three entries name removed files).

## History

First audit 2026-10-31: FAIL (R4-02, 08, 09, 10, 11, 17; R4-18 hygiene); `work/audit/r4/runs/`, `work/audit/r4/audit/md-chip.md`.
