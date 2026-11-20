# md-otp-field — gate-7 independent audit

Reviewer: gate-7 reviewer s7-1 (story 7-1-audit-text-number-otp-fields), 2026-11-15. First gate-7 audit of the component. Everything below was
re-run by s7-1 on a fresh snapshot `work/audit/s7-1-tree` (taken 2026-11-15 15:01 UTC; 232 install jobs, latest 6-3-028 / s7-7-010 / 1-2-md-search A026; manifest
`work/audit/s7-1/snap/`). Outputs: `work/audit/s7-1/` (swift/, ios/, android/, lab/, web/, ax/, ax-nf/, examples/, gate1/). Mac lane r1, Android lane a5
(emulator-5564, AwcNative6), simulators AWC-r1 (iPhone 17 Pro, iOS 26.3) and AWC-r1-ios18 (iPhone 16 Pro, iOS 18.6). Timing runs went through `tools/slot.sh timing 4`.
Jobs: s7-1-001-snapshot, -003-swift, -003b-lab-web, -003c-lab-probe2, -003d-lab-probe3, -003e-own-server, -003f/-003g-otp-inspection, -004-ios, -005-ios-states-more,
-006-ax-mac-ios, -006b-ax-nf-mac-x6, -007-ax-compare, -008-mac-states-x4; a5: s7-1-A001-android, -A002-ax-android, -A003-examples-kotlin, -A004-ax-android-rerun.

## Checkpoint freshness
`outputs/native-parity/md-otp-field/native/checkpoint.json` pins 21 files; all match the snapshot (0 differ) but the file carries a `checkpointRefresh` of 2026-11-15T16:56+02: the
pins were re-written to canonical without re-running the evidence. The re-runs below are therefore the first evidence on today's sources (finding S71-08).

## Re-run counts (claimed -> re-run)
| Suite | Claimed | s7-1 re-run |
|---|---|---|
| Paint (177 Chrome cases) macOS / iOS 26.3 / iOS 18.6 (TF only) / Android | 13,164 / 13,164 / - / 12,933 | 13,164/13,164 (003) / 13,164/13,164 (004) / - / 12,933/12,933 (A001) |
| States macOS | 1,370 | 1370/1370 (003 run 1); run 2 under load 1369/1370 (otp-keyboard-ltr Backspace-x3 2/96 frames, Home 1/60 outside the envelope); x4 (008): 1370/1370 each, but 3 of 4 runs print failing first attempts (Backspace-x3, click-cell-3-lands-first-empty 16/96 frames, border still unfocused) before the fixture retry passes |
| States iOS 26.3 x3 | 1,361-1,362 of 1,370 (open) | 1361/1370, 1361/1370, 1362/1370: FAIL every time (Backspace-x3 and Delete-at-0 motion in ltr/rtl and reduced, paste-12-34-56x 2/114 frames) |
| States iOS 18.6 x2 | - | 1362/1370, 1362/1370: FAIL |
| States Android | 1,370 | 1370/1370; `LivePreviewOTPFieldHostTest` ok |
| SwiftUI live host `test-live-otpfield.mjs` | 27/27 | 27 checks passed |
| Laboratory macOS SwiftUI preview of md-otp-field (4177 and own server 4197) | opens, retained update, methods | **502 INVALID_LIVE_FRAME on every create** (S71-01); Android preview: create, update, click, clear / validity methods 200 |
| Studio / compiler / Web spec / e2e | 827/829 | 886/886, 12/12, 277/277 (3 tags), e2e 15/15 |
| Examples | - | Swift typecheck exit 0, Kotlin compile ok (generic, 19 cases) |
| tools/ax web+macOS+iOS+Android | 0 open | 5 cases 0 open findings |


## Gate 1 contract matrix
`work/audit/s7-1/tools/matrix.py` (r1's v2 extractor with the three field files) over `packages/core/src/components` (contract: `gate1/contract.json`; table: `gate1/matrix/md-otp-field.md`,
44 rows). Every row has a SwiftUI and a Compose implementation and a Laboratory exposure. Test column (Swift / Android / Laboratory) gaps that remain after checking
the oracle JSON (`Tests/Fixtures/*field*.json`, `androidTest/assets/*Field*.json`), where hooks are exercised through the cases' `hooks` and attributes through the `html` of the states runs:
- No test on any platform: `cellLabelTemplate`. Native fixtures mention `autoSubmit`, `inputMode` and `mdInvalidInput`, no Laboratory test mentions them (non-blocking).
Implemented in both renderers (finding S71-05).
CSS hooks that the matcher lists as "no Android test" (error-color, filled-pill, focus-inset, optical-nudge) are exercised: every hook is a key of 6 Chrome paint cases in the shared fixtures; not a gap.

## Exceptions
None proposed; none accepted.

## Findings
- **S71-01** (blocking, gate 3): the Laboratory cannot open md-otp-field on the macOS SwiftUI host: `POST /api/native-live/session?platform=ios` returns 502 `INVALID_LIVE_FRAME` ("The native renderer returned invalid layout measurements") for the recipe, an empty property set and every variant tried (3 repeats on 4177, once on an own server from the tree; jobs 003c-003e). Cause (003f/003g, host stdio frame run through `validateNativeInspection`): each `component.cell-N` node's metrics carry `border: "#79747EFF"` (a colour string, plus `borderWidth`); `native-inspection.mjs` `validateMetrics` requires `border` to be four numbers, so all six cells fail (`node fails alone: component.cell-0..5`). `test-live-otpfield.mjs` talks to the host directly and reads `metric(f,'cell-5','border')` as a colour, so no test sees the server's validation; the 2026-10-27 112/112 sweep predates it. Fix: emit the colour under a name the schema does not own (`borderColor`) and update the host test and `NativeOTPField.swift` metrics, or let `validateMetrics` accept the OTP key; add a server-level test that creates every component through the SwiftUI host.
- **S71-03** (blocking, gates 5/6; already open as 6-3's finding, cause still unproven): iOS states 1361-1362/1370 on 26.3 and 1362/1370 on 18.6 in 5 of 5 runs; macOS needs the fixture's retry in 3 of 4 runs and failed after retries once (1369/1370). Chrome starts the cell border fade one frame after the key, native at key arrival (6-3's measurement: native first in-phase frame t=56 ms with cell 5 already [114,102,140], Chrome's [103,80,164] and [110,95,149] at 16.7/33.3 ms). Fix: start the focus-out border transition on the next display frame after Backspace/Delete/paste, then correct the diagnostic's carried frames; keep the envelope.
- **S71-05** (blocking, gate 1/2): `cellLabelTemplate` has no test.
- **S71-08** (non-blocking): checkpoint re-pinned, not re-run; the checkpoint's iOS states line [1370, 9] is the open S71-03.

## Verdict
FAIL (gate 7, s7-1, 2026-11-15): blocking findings S71-01, S71-03, S71-05.
