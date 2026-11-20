# Gate 7 audit — `md-accordion`

Reviewer: gate-7 reviewer s7-22, 2026-11-19 (re-check of s7-20; earlier history: s7-8, s7-12, s7-20 below). Independent of the implementing forks; no product code changed.

**Verdict: PASS** (Gate 7, s7-22, 2026-11-19). s7-20-01 (Android, accordion in a modal scope, story 9-30) is verified fixed; s7-12-01, s7-8-03, s7-8-04 stay closed; the r3-19 exception stays rejected. The contract matrix of s7-8 stands.

Method: snapshot `work/audit/s7-22-tree` of canonical (after the 9-30 install); lanes Mac fi3, Android a2 (emulator-5558), simulators AWC-fi3 and AWC-fi3-ios18. Jobs are `7-22-recheck-accordion-list-3-*` in `claude-runner/done`; ledger in the story file.

## Re-run evidence
| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| Swift sources | accordion sources of snapshot vs s7-20 snapshot | `-001`, `-002` | 27 files, 0 differ |
| macOS | accordion paint, states, floating timing suites | `-002-swift-accordion-timing` | pass |
| Android | unit tests 38/38; all 18 `NativeAccordion*` instrumented classes 39/39 (includes paint, states, floating) | `-A006-family-rerun` | pass |
| Android | modal-scope originals (Initialization, Dispatch) x3, each 10/10 | `-A007-modal-orig-x3-rerun` | pass |
| Android | own probe: defaultExpanded accordion in a real dialog, bottom sheet, side sheet; first mdItemToggle index 0 and 1, expanded true | `-A003-modal-probe` | 6/6 |
| Android | fix reverted in a copy of the snapshot: modal-scope tests fail | `-A004-fix-reverted` | fail as required |
| Android | dialog, bottom-sheet, side-sheet Motion + Parity classes | `-A009-modals-split` (m3a) | 6/6 |
| Android | `NativeModalStackTest` x2 | `-A009` (m3b, m3c) | 149 checks, 0 failures each (the cut in `-A008` was an infrastructure 'Connection refused', not a product failure) |
| Android | dialog-motion 4860/0, dialog-paint 2081/0, bottom-sheet-motion 7378/0 | `-A008` | valid |
| tools/ax | accordion default + exclusive, Android | `-A010-ax-android` | ok (captured in this audit). macOS, iOS and web were NOT captured in this audit: job `-010-ax-macos-web` exited 0 but captured nothing and job `-009` failed (AWCLivePreview is not built in the snapshot). The captures of s7-20 (2026-11-18, 0 open findings) are reused; allowed because the 27 Swift accordion sources are identical to the s7-20 snapshot |
| Laboratory | open + 3 updates on Android | `-009` | all 200 |

## Findings
None open. s7-20-01 closed by story 9-30.
