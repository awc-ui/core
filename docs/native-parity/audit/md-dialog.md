# Gate 7 audit — `md-dialog`

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — findings r3-07, r3-08, r3-09, r3-21 (+ r3-23 to confirm). Every macOS and Android suite re-ran green, and the
Laboratory lifecycle methods work on both platforms; the failures are the unimplemented forced-colours branch, the undecided
dialog-over-sheet paint order, the unmapped close-button cursor and stale policy notes.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest `fx-072-install-orgchart-apk`).
- Contract: `packages/core/src/components/md-dialog/` + regenerated inventory (`r3-006`): 13 properties (the baseline had 12;
  `dialogAriaLabel` was added since and is implemented on both platforms, in the Laboratory update list and in one paint
  oracle case), 3 events (`mdOpen`, `mdClose`, `mdCancel`), 3 methods (`show`, `close`, `whenClosed`), 5 slots, 11 parts, 10 hooks.
- Hash check of `outputs/native-parity/md-dialog/{native-swift,native-android,laboratory}/checkpoint.json`: shared files changed
  since — prior counts are stale; the r3 re-runs are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | **finding r3-08** | matrix below; the dialog-over-sheet paint order is still an "open CSS-intent decision" (`native-modal-layer.md`), not recorded as decided |
| 2 Implementation | **findings r3-07, r3-09** | forced colours (2px CanvasText container border, CanvasText divider, ButtonText close button) not implemented; close-button `cursor: pointer` not mapped |
| 3 Laboratory | pass | `modal-appearance.js` 10 hooks + 11 parts; retained update; `show`/`whenClosed`/`close` with call IDs and results on both platforms; 111+111 examples |
| 4 Behaviour | pass | motion/events/focus/methods (Swift 9,748, Android 4,860), six-order mixed modal stack 149/149 on both |
| 5 Visual | pass | 150 paint cases (basic/icon/fullscreen, light/dark, LTR/RTL, densities, locales, labels) |
| 6 Runtime + a11y | pass with caveat r3-23 (+ r3-21) | iOS 26.3: paint 2,249/2,249, stack 149/149, motion 13,508/13,517 then 13,563/13,564 — the remaining check is `basic-ok mdClose` 40–45 ms after its step in both runs, under load average 100–220 with 17 booted simulators; tools/ax 0 open findings (3 + 2 accepted conventions) |
| 7 Final audit | FAIL | this document |

## Source contract matrix (summary)

| Family | Count | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- | --- |
| Properties (open, headline, dialogAriaLabel, icon, fullscreen, scrimDismissible, locale, closeLabel, cancelLabel, okLabel, divider, headerDivider, density) | 13 | `NativeDialog.swift` | `NativeDialog.kt` | retained updates (`DIALOG_UPDATE_PROPERTIES`) | paint 150 cases (locale 6, labels 2 each, dialogAriaLabel 1), motion/events (scrimDismissible) |
| Events mdOpen, mdClose, mdCancel (void) | 3 | yes | yes | event log | motion/events runs, modal stack |
| Methods show, close, whenClosed | 3 | `AWCDialogController` | `AWCDialogController` | call IDs + method results | motion suites, live hosts (Swift 63 checks), lab probe |
| Slots default, actions, headline, header-action, icon | 5 | `AWCDialogSlots` | slot registry | default + headline text slots | paint cases |
| Parts (scrim, container, header, icon, headline, content, divider, actions, cancel-button, ok-button, close-button) | 11 | `AWCDialogPart` | `AWCDialogPart` | Styles panel | paint part boxes (all 11 referenced in both suites) |
| Hooks | 10 | `AWCDialogAppearance` | same | `modal-appearance.js` | all 10 in `dialog-web-paint.json` |
| `:host([hidden])` | — | handled | handled | — | hidden case |
| `@media (prefers-reduced-motion)` | — | handled | handled | — | `dialog-web-motion-reduced` |
| `@media (forced-colors)` | — | **none** | **none** | — | **none** |

## Exception and expectation decisions

| Item | Decision |
| --- | --- |
| tools/ax macOS: alertdialog → named group, no AXModal, description = following text (Decision 7) | Accepted as a convention: the native modality (focus trap, background hidden from accessibility, Escape/scrim dismissal) is executed by the motion/focus suites and the modal stack; the name and message are read in order. Recommendation (not a finding): an AppKit container element with an explicit subrole could carry `AXApplicationDialog`. |
| tools/ax Android: alertdialog → pane (paneTitle), no described-by (Decision 8) | Accepted: Android has no alert-dialog role or described-by relation; paneTitle is the platform convention, announced on appearance. |
| Escape protection differs across the modal family (dialog: `scrimDismissible=false` blocks only the scrim) | Not an exception: follows the source exactly. |
| Hover not re-hit-tested when the surface moves under a still pointer | Not an exception: measured Chrome behaviour, reproduced. |

## Re-run counts (claimed → r3)

| Suite | Claimed | r3 | Job |
| --- | --- | --- | --- |
| macOS `NativeDialogPaintIntegration` | 2,249/2,249 | **2,249/2,249** | `r3-009` |
| macOS `NativeDialogMotionIntegration` | 9,550 … 9,944 (frame-dependent) | **9,748/9,748** | `r3-009` |
| macOS `NativeModalStackIntegration` | 149/149 | **149/149** | `r3-009` |
| Android `NativeDialogParityTest` / `NativeDialogMotionTest` / `NativeModalStackTest` | 2,081 / 4,860 / 149 | **2,081 / 4,860 / 149** | `r3-A002`, `r3-A006` |
| Android `LivePreviewModalHostTest` | 44 | **8/8 methods** | `r3-A002` |
| SwiftUI live host `test-live-modal.mjs` | 63 | **63/63** | `r3-0106` |
| iOS paint / motion / stack (iPhone 17 Pro, iOS 26.3, AWC-r3) | 15,918/15,918 | **2,249/2,249 · 13,508/13,517 (run 1), 13,563/13,564 (run 2) · 149/149** | `r3-011`, `r3-013` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 15,768/15,768 / 16,010/16,010 | **2,249/2,249 · 13,417/13,417 · 149/149** / **2,249/2,249 · 13,617/13,617 · 149/149** | `r3-014` |
| Swift / Kotlin examples (modal family) | 111 / 111 | **111 typecheck, 0 errors / 111 compile** | `r3-010`, `r3-A007` |
| tools/ax open | pass, 3 accepted (macOS), 2 accepted (Android) | **same** (0 open; iOS 40 pt action targets reported as info) | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

`lab-probe.mjs` (`r3-0105`), both platforms: session opens (Android reports no inspection nodes while closed, as recorded in
`laboratory-sweep.md`), `update {headline}` 200, `show()` accepted → `mdOpen`, `whenClosed()` accepted and pending, results
`show` fulfilled; `close()` accepted → `mdClose`, results `close` and `whenClosed` fulfilled.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-dialog/report.md`): macOS exposes a group "Project details" (3 accepted entries, above),
iOS the two actions and the title/message text inside a modal container, Android a pane "Project details" (2 accepted entries); Tab
is trapped OK → Cancel → OK → Cancel on every platform, as on Web.

## Findings

- **r3-07** (gates 2, 5) forced colours (2px CanvasText container border, CanvasText divider, ButtonText close button) not implemented or tested.
- **r3-08** (gate 1) dialog-over-sheet paint order still an "open CSS-intent decision" (`native-modal-layer.md`).
- **r3-09** (gate 2) close button `cursor: pointer` not mapped.
- **r3-21** (gate 7) released policy notes still say iOS/VoiceOver execution is unverified.
- **r3-23** (gate 6, to confirm) iPhone 26.3 `basic-ok mdClose` 40–45 ms after its step in both r3 runs under heavy load; the same suite passes on iOS 18.6 (13,417/13,417) and iPad 26.3 (13,617/13,617), and fi saw 0 failures with fewer simulators. Needs one isolated iPhone run.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
