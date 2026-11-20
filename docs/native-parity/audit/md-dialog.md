# Gate 7 audit — `md-dialog`

Reviewer: gate-7 reviewer s7-8, 2026-11-15 (re-check of the r3 audit of 2026-10-31). Independent of the implementing forks; no product code changed.

**Verdict: PASS** — every gate met by current re-runs.

r3-07 (forced colours), r3-21 and r3-23 (iOS `basic-ok mdClose` timing) re-verified: dialog motion passes on every runtime, and the dialog is unaffected by the accordion stacking residuals (modal layer, top-layer dialogs).

## Method

- Snapshot `work/audit/s7-8-tree` (job `s7-8-001-snapshot`, 2026-11-15 13:18 Mac time, canonical after `3-1-019-install-defects-cardkb`). Reviewer lanes: Mac fi3, Android a2 (emulator-5558), simulators AWC-fi3 (iPhone 17 Pro, iOS 26.3) and AWC-fi3-ios18 (iPhone 16 Pro, iOS 18.6).
- Contract: gate-1 presence matrix regenerated from `packages/core` and the inventory (`s7-8-009-inventory`, `audit/s7-8/tools/matrix.py`, `audit/s7-8/out/matrix.txt`): every property, event, method, slot, part and hook of the tag has SwiftUI, Compose and Laboratory hits; the 59 hooks and parts of md-list-item / md-list / md-accordion-item that have no token hit in Swift/Kotlin test sources are all named in the Chrome oracle fixture JSON (list-web-fixtures / list-web-paint / accordion-web-appearance) and covered by the parts and paint suites.
- Everything below was re-run on the snapshot, not taken from earlier docs. Timing suites ran through `tools/slot.sh timing 4`. Machine load average was 25-45 during the runs.

## Re-run evidence

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | `NativeDialogPaintIntegration` / `NativeDialogMotionIntegration` / `NativeModalStackIntegration` | `s7-8-003`, `s7-8-004` | 2249/2249, 10204/10204, 149/149 |
| iOS 26.3 | same three | `s7-8-005-ios26` | 2249/2249, 12851/12851, 149/149 |
| iOS 18.6 | same three | `s7-8-006-ios18` | 2249/2249, 12956/12956, 149/149 |
| Android | dialog-paint 2081, dialog-motion 4860, modal-stack 149 checks; `NativeDialogParityTest`, `LivePreviewModalHostTest` | `s7-8-A001`, `s7-8-A002` | 0 failures |
| Laboratory | `show`, `whenClosed`, `close`, method results with `mdOpen`/`mdClose` on iOS and Android; modal host | `s7-8-007-ax-lab`, `s7-8-0065` (`test-live-modal` 63 checks) | pass |
| Examples | 180 Swift typecheck, Kotlin compile | `s7-8-0065`, `s7-8-A008` | 0 errors |
| tools/ax | 1 case | `s7-8-007`, `s7-8-A007` | pass on all platforms, 2 accepted conventions on Android |

## Open items

None. iPad 26.3 not re-run.

Previous audit: r3, 2026-10-31 (FAIL; r3-01..r3-26 all re-checked above). Findings and suggested fixes: `work/audit/DEFECTS.md`, section "Gate-7 re-check s7-8".
