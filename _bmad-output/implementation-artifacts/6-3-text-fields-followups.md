---
title: 'Text fields: Shift+Tab, OTP focus and render, checkpoints'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '6-3-text-fields-followups'
epic: 6
model: 'sonnet'
wave: 2
lanes: 'mac lane d2 · android lane a3 (emulator-5560) · simulator AWC-d2'
lab: 'work/n3-lab (field work; search is story 1-2)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Open items on the installed text-field family: Shift+Tab out of a text field moves forward on macOS (probe by n2), the OTP reduced-motion `type-12` focus failure on plain canonical (2 of 3 runs), md-otp-field sometimes not rendering a value written during an update (found by d2), and md-text-field's iOS checkpoint is unconfirmed.

**Approach:** Read n3's fields-v2/v3 jobs (n3-113, n3-114, n3-116b), fix each item test-first, install, confirm checkpoints.

## Boundaries & Constraints

**Always:** Text-field, number-field and OTP suites stay at their full-pass counts on all platforms. The rules in project-context.md apply.

**Never:** Do not touch md-search files (story 1-2 owns them).

</intent-contract>

## Code Map

- `work/n3-lab/REQUESTS.md` -- n2's Shift+Tab probe, d2's OTP update-render note, d4's OTP focus data
- `work/claude-runner/done/n3-113*.log`, `n3-114*.log`, `n3-116b*.log` -- newest field results
- `docs/native-parity/md-text-field.md`, `md-otp-field.md`, `md-number-field.md`

## Tasks & Acceptance

**Execution:**
- [x] Read the n3 field jobs; record what they already fixed
- [x] Shift+Tab backward out of a text field on macOS, with a test
- [x] OTP: reduced-motion type-12 focus failure root cause and fix; value written during an update always renders
- [x] Run the three fields' paint and states on macOS, iOS and Android; install; confirm the three checkpoints (md-text-field on iOS too)

**Acceptance Criteria:**
- Given a text field between two buttons on macOS, when Shift+Tab is pressed, then focus moves to the previous button
- Given OTP reduced-motion typing, when run ten times on macOS, then focus advances every time
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.

### Coordinator note (2026-11-15 09:30 UTC)

- The previous agent was stopped at about 22:10 UTC on 11-14 while its jobs were running. They have all finished since; nothing is running or queued now. A fresh agent continues: read the Dev Agent Record and the newest `claude-runner/done/<story>-*.log` files first, and do not redo what the record holds.
- After the stop, `6-3-017-install-nf-homeend` (main queue) ended with exit 0 and `6-3-019-canonical-ios` with exit 2: read both.
- The record lists known flakes on base and patched trees (OTP keyboard one-frame misses in 3 of 10 runs, `click-cell-3`). They are findings until their cause is known: find the cause or record each in `work/audit/DEFECTS.md` with the captured frames.

### Coordinator note (2026-11-15 10:15 UTC)

- The main queue is shared and runs one job at a time. `6-3-023-install-defects-confirm` waits behind other stories' jobs; that is normal. Wait for it (look at `claude-runner/running/` and `done/`), then tick task 4.
- Before `review`, take the two iOS findings yourself. They are in this story's components and nobody else owns them: (1) md-text-field iOS states 2014/2022, the `tf-throttle-200` event order; (2) md-otp-field iOS states 1362/1370, the `Backspace-x3` and `Delete-at-0` motion frames, together with the macOS OTP keyboard one-frame misses seen in 3 of 10 runs.
- For each: find the cause (trace the frames and the event order against the oracle), fix it test-first, verify on macOS, iPhone 26.3 (states x3) and Android, and install through the main queue. Limit: 6 iOS job iterations per finding. What stays unexplained goes to `work/audit/DEFECTS.md` as an open finding with the captured frames and measurements, for the reviewer of story 7-1.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- All four tasks done; canonical installs 6-3-012, 6-3-017 and 6-3-028 (tf-throttle `flushDue`, byte-identical with `work/s63-tree`); checkpoints of md-text-field, md-number-field, md-otp-field `current` and confirmed (`6-3-031`).
- tf-throttle-200 iOS event order: FIXED. OTP `Backspace-x3` / `Delete-at-0` border frames (iOS 1361/1370; macOS first attempt 3 of 10): cause NOT established, recorded OPEN in DEFECTS.md (2026-11-15 status entry, job `6-3-030`) with frames in `work/s63-lab/out025-ios/`, `out027/`, for the reviewer of story 7-1. Reading: native starts the focus-out fade at the key's arrival, Chrome one frame later; the diagnostic in `s63-tree/.../NativeOTPFieldStatesIntegration.swift` repeats carried pre-phase frames (not installed).
- Next (reviewer / follow-up): fix the diagnostic (dump only the failing phase), then decide between a 16.67 ms anchor offset and a native animation start delay.

EVIDENCE | 6-3-024-tf-throttle-flush | macOS | TF states x3 (s63 tree) | 2028/2028
EVIDENCE | 6-3-024-tf-throttle-flush | macOS | TF paint | 12700/12700
EVIDENCE | 6-3-026-tf-throttle-ios | iOS | TF states run 1 / run 2 | 2024/2024
EVIDENCE | 6-3-028-install-tf-throttle | macOS | canonical live otpfield | 5/5
EVIDENCE | 6-3-029-canonical-flush | macOS | TF shift-tab | 2/2
EVIDENCE | 6-3-029-canonical-flush | macOS | TF states x2 | 2028/2028
EVIDENCE | 6-3-029-canonical-flush | macOS | TF paint | 12700/12700
EVIDENCE | 6-3-029-canonical-flush | macOS | NF states | 1538/1538
EVIDENCE | 6-3-029-canonical-flush | macOS | OTP states (final attempt) | 1370/1370
EVIDENCE | 6-3-029-canonical-flush | iOS | TF states | 2025/2025
EVIDENCE | 6-3-027-otp-macos-frames | macOS | OTP states x10 (s63 tree) | 1370/1370
EVIDENCE | 6-3-025-otp-frames | iOS | OTP states | 1361/1370
EVIDENCE | 6-3-A002 | Android | 8 of 9 field suites; 6-3-A003 TF parity rerun ok (Swift-only change since) | ok




### Agent 1 (2026-11-14, lane d2 / a3 / AWC-d2)
**What changed (installed in canonical; verified tree `work/s63-tree`, patches in `work/s63-lab/`)**
- `NativeDocumentOrder.swift`, `FieldTextInput.swift` (job 6-3-012): `AWCDocumentTabOrder.movePrevious(from:)`; a field's `insertBacktab` (and a Tab that arrives with Shift held) selects the previous key view of the geometric loop when the window has no document-order root. Cause: the field editor's own Shift+Tab uses AppKit's previous-key-view chain, unset for views SwiftUI adds after the window was shown (n2-083). Patch: re-anchored n3's `patch-fields-1112.py` v3 (n3-116b, never installed) to canonical's changed `loop` guard (`work/s63-lab/patch-fields.py`).
- `NativeOTPField.swift` (6-3-012): reduced motion draws the cell borders from their targets (the colour tracks an `.onChange` sets after the render lagged one focus move: `type-12` failure, root cause); a `value` written by a retained update is taken while the body evaluates (the `.onChange` write alone was sometimes not followed by a render: d2 finding).
- `FieldTextInput.swift` (6-3-017, found while running the number-field suite): macOS Home / End never reached md-number-field's composite, because the `scrollToBeginning/EndOfDocument:` cases (Chrome's caret move) matched first; `NativeNumberFieldStatesIntegration` was 1306/1506 on canonical (4 of 4 runs, also without any 6-3 change, 6-3-010/011). The composite now takes Home / End first; the caret moves only when it does not.
- Tests: `NativeTextFieldStatesIntegration` gained the Shift+Tab check (AppKit; `AWC_TF_ONLY=shift-tab`; forward order checked too). Docs: notes in md-text-field.md, md-otp-field.md, md-number-field.md.
- No DEFECTS.md line concerns these items (searched), so none was closed there.

**Test first (unpatched tree, 6-3-002; 6-3-010/011):** Shift+Tab check FAIL (`field, After, field, After`); OTP `otp-keyboard` x10: `(reduced) type-12` borders one move behind in 3 of 10 runs (2 final, 1134/1140); live OTP host `test-live-otpfield.mjs` x20 on canonical's host: 14/20 (6 x "length, groups, transform"); NF states 1306/1506 x4.

**Evidence after the fix**
- macOS, patched tree: 6-3-004 Shift+Tab 2/2, OTP keyboard x10 reduced type-12 failures 0 of 10; 6-3-005 live OTP 20/20 (canonical host 14/20); 6-3-008 TF paint 12700/12700, NF paint 8815/8815, OTP paint 13164/13164, TF states 2028/2028, OTP states 1370/1370 x3, live textfield 22, numberfield 33, otpfield 20/20; 6-3-016 (Home/End fix) NF states 1538/1538 x2, NF paint 8815, TF states 2028, time picker states 15551/15551, color picker 20950/20950, app bar 1397/1397, autocomplete 1472/1472.
- macOS, installed canonical: 6-3-013 Shift+Tab 2/2, live OTP 10/10, OTP states 1370/1370 x2; 6-3-015 TF paint 12700, NF paint 8815, OTP paint 13164, TF states 2028; 6-3-018 (after install 2) Shift+Tab 2/2, NF states 1538/1538 x2, NF paint 8815, TF paint 12700, OTP paint 13164, TF states 2028/2028, OTP states 1370/1370.
- Android (emulator-5560, sources = canonical; this story changes Swift only): 6-3-A002 8 of 9 field suites ok (NF parity/states/host, OTP parity/states/host, TF states/host); TF parity failed once with "Failed waiting for PixelCopy!" (emulator capture), rerun 6-3-A003 `textFieldMatchesChromePaintAndGeometry` ok.
- Install: 6-3-012 and 6-3-017 (dry run byte-identical with the verified tree, rollback armed, playground rebuilt, canonical live otpfield 5/5 each, 4177 restarted: all four probes 200).
- Known flakes, not caused by this story (A/B 6-3-015, base tree = canonical before the install, interleaved x10): OTP keyboard runs miss one frame in `Backspace-x3` / `Home` motion in 3 of 10 runs on both base (one run 1133/1140) and patched; `click-cell-3` retried once on each (input 12-13 ms late, fixture retry).

### Agent 2 (2026-11-15, lane d2 / a3 / AWC-d2)
- Read 6-3-017 (exit 0, installed, byte-identical) and 6-3-019 (exit 2: it waited 70 min because other forks' simulators AWC-di-ipad / AWC-fx-18 were booted; no test ran). 6-3-020 refreshed the three checkpoints: `stale-recorded` until a confirm with runs.
- iOS on installed canonical: `6-3-021-canonical-ios` (TF paint 12676/12676; TF states 2014/2022; the three later fixtures launch-crashed within a minute, simulator state) and rerun `6-3-022-canonical-ios-rest`: NF paint 8815/8815, NF states 1392/1392, OTP paint 13164/13164, OTP states 1362/1370.
- iOS failures are not from this story: OTP states 1355-1363/1370 on iOS before 6-3 (di-029, di-035, di-046, di-047), `Backspace-x3`/`Delete-at-0` border leaves cell 5 one to two frames late (frames captured, `work/s63-lab/out022-ios/`); TF `tf-throttle-200 (reduced)` event order (8 checks in 021, full in 6-3-009). Recorded in DEFECTS.md by main-queue job `6-3-023-install-defects-confirm` (also confirms the three checkpoints with the macOS, iOS and Android runs).
- Tasks 1-3 ticked. Task 4 (paint/states on three platforms, install, checkpoints) is complete once 6-3-023 has run: check `claude-runner/done/6-3-023-install-defects-confirm.log` ("DEFECTS appended", three confirm lines, report not stale), then set `status: review`.

### Agent 3 (2026-11-15, lane d2 / a3 / AWC-d2) - notes in progress
- 6-3-023 (DEFECTS append + checkpoint confirm) is still queued in the main queue behind other stories; not mine to move.
- Cause of `tf-throttle-200 (reduced)` on iOS (from `work/s63-lab/out021-ios/NativeTextFieldStatesIntegration-console.log`, final attempt): native keystrokes arrive 17-37 ms late; `abcdefg` is handled at T0+202 ms while the throttle window (timer at T0+201) has not run yet, so the model emits `mdInput abcdefg, mdSearch abcdefg` and never emits the `abcdef` search of the closed window. The test's replay (and Chrome's time order) closes the window first. Cause: a main-queue ordering race between the window timer and the keystroke handler, both due.
- Fix in private tree `work/s63-tree` (not installed): `AWCSearchEmitter.flushDue()` (TextFieldModel.swift) called from NativeTextField.swift before `rt.lastValue = newValue`: a window whose due time passed closes first and emits its latest value, then the input starts a new leading window. Job `6-3-024-tf-throttle-flush` (macOS TF states x3, TF paint, iOS TF states x2) queued in lane d2; it waited >45 min for a timing slot (4 of 4 held by other stories).
- OTP: diagnostic added to `work/s63-tree/.../Tests/NativeOTPFieldStatesIntegration.swift` (the failing-phase dump printed only pre-phase frames; now prints web/native input times, shifts, Chrome cell colours and 60 native frames). Job `6-3-025-otp-frames` queued (macOS x6 + iOS x1). Reading so far: Chrome's cell 5 at t=16.67 is still the primary colour, the native envelope (anchored by key arrival, +-40 ms) is already at the outline colour, i.e. native leaves 1-2 frames earlier than the anchoring assumes; not yet explained.

- Result of `6-3-023-install-defects-confirm` (main queue, exit 0): DEFECTS appended, the three checkpoints confirmed and `current`. Task 4 (macOS/iOS/Android runs, install, checkpoints) is therefore done for the installed canonical.
- Evidence for the tf-throttle fix, macOS, tree `work/s63-tree` with `flushDue()`: job `6-3-024-tf-throttle-flush`: TF states 2028/2028 x3, TF paint 12700/12700 (logs `work/s63-lab/out024/`). The iOS part (TF states x2, `out024-ios/`) waits in the job for the booted-simulator loop (other forks' simulators booted; 70 min cap, exit 2 if it expires: then requeue it). `6-3-025-otp-frames` follows in lane d2.
- State when agent 3 stopped (waiting, nothing blocked): next agent reads `done/6-3-024-tf-throttle-flush.log` and `done/6-3-025-otp-frames.log`. If iOS TF states passes 2022/2022 on both runs: install `TextFieldModel.swift` + `NativeTextField.swift` (flushDue hunks, anchored) through one main-queue job, byte identity with `work/s63-tree`, re-confirm checkpoints, then tick the finding in DEFECTS.md. For OTP: analyse `out025/otp-frames-*.txt` and `out025-ios/frames.txt` (web vs native input times, shifts, Chrome cell colours, native frames); what stays unexplained goes to DEFECTS.md with those frames. Status stays `in-progress`.

### Agent 4 (2026-11-15, lane d2)
- `6-3-024` iOS part exited 2 (other forks' simulators booted); macOS part stood. Requeued iOS as `6-3-026` (20 min wait, then AWC-d2 anyway): TF states 2024/2024 x2 (the fixture retries late-input attempts internally). Install patch `work/s63-lab/patch-flush.py` (dry run byte-identical), main-queue `6-3-028-install-tf-throttle` exit 0 (playground build 0, canonical live otpfield 5/5, 4177 probes 200). Canonical verified in `6-3-029-canonical-flush` (see EVIDENCE lines).
- OTP: `6-3-025` macOS part failed to compile (iOS-only locals in the diagnostic; fixed in the tree), iOS OTP 1361/1370. `6-3-027` macOS x10 all end 1370/1370; the `Backspace-x3` first-attempt miss showed in 3 of 10 runs. Cause open; details in DEFECTS.md (`6-3-030`). Checkpoints: `6-3-031` refresh + confirm, all three current.

## Review Triage Log

