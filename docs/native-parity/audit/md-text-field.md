# md-text-field — gate-7 independent audit

Reviewer: gate-7 reviewer s7-1 (story 7-1-audit-text-number-otp-fields), 2026-11-15. First gate-7 audit of the component. Everything below was
re-run by s7-1 on a fresh snapshot `work/audit/s7-1-tree` (taken 2026-11-15 15:01 UTC; 232 install jobs, latest 6-3-028 / s7-7-010 / 1-2-md-search A026; manifest
`work/audit/s7-1/snap/`). Outputs: `work/audit/s7-1/` (swift/, ios/, android/, lab/, web/, ax/, ax-nf/, examples/, gate1/). Mac lane r1, Android lane a5
(emulator-5564, AwcNative6), simulators AWC-r1 (iPhone 17 Pro, iOS 26.3) and AWC-r1-ios18 (iPhone 16 Pro, iOS 18.6). Timing runs went through `tools/slot.sh timing 4`.
Jobs: s7-1-001-snapshot, -003-swift, -003b-lab-web, -003c-lab-probe2, -003d-lab-probe3, -003e-own-server, -003f/-003g-otp-inspection, -004-ios, -005-ios-states-more,
-006-ax-mac-ios, -006b-ax-nf-mac-x6, -007-ax-compare, -008-mac-states-x4; a5: s7-1-A001-android, -A002-ax-android, -A003-examples-kotlin, -A004-ax-android-rerun.

## Checkpoint freshness
`outputs/native-parity/md-text-field/native/checkpoint.json` pins 26 files; all match the snapshot (0 differ) but the file carries a `checkpointRefresh` of 2026-11-15T16:56+02: the
pins were re-written to canonical without re-running the evidence. The re-runs below are therefore the first evidence on today's sources (finding S71-08).

## Re-run counts (claimed -> re-run)
| Suite | Claimed (doc / checkpoint) | s7-1 re-run |
|---|---|---|
| Paint (Chrome 153 oracles, 415 cases) macOS / iOS 26.3 / iOS 18.6 / Android | 12,700 / 12,676 / - / 11,333 | 12,700/12,700 (s7-1-003) / 12,676/12,676 (s7-1-004) / 12,676/12,676 (s7-1-005) / 11,333/11,333 (A001) |
| States macOS | 2,026 | 2028/2028 (003), run 2 under load 2020/2028, then 2028/2028 x4 (008); the doc is 2 checks behind (Shift+Tab, 6-3) |
| States iOS 26.3 x3 | 2,026 | 2024/2024, 2024/2024, 2025/2025 (final attempts; earlier attempts print tf-throttle-200 and press-focus FAIL lines, see S71-07) |
| States iOS 18.6 x2 | - | 2024/2024, 2024/2024 |
| States Android (emulator-5564) | 954 | 954/954 (A001); `LivePreviewTextFieldHostTest` ok |
| Behavior / Focus / Inspection views macOS and iOS 26.3 | - | 35 / 68 / 88 pass (both); NativeBehaviorMain 164 pass |
| SwiftUI live host `test-live-textfield.mjs` | 22/22 | 22 checks passed |
| Laboratory 4177 probes iOS (macOS SwiftUI) + Android | retained updates, seven methods with results | update, click, setCustomValidity / checkValidity / getValidity / reportValidity / select / clear all 200 with results on both platforms (3 repeats) |
| Studio / compiler / Web spec / Web e2e (this tag) | 827/829 | 886/886, 12/12, 277/277 (3 tags), e2e 70/70 |
| Examples (copied Swift / Kotlin) | - | generic generator, 30 cases: Swift typecheck exit 0; Kotlin compile BUILD SUCCESSFUL (3 files, 134 cases for the 3 tags) |
| tools/ax web+macOS+iOS+Android | 0 open | 5 cases: 0 open findings (s7-1-007, after the Android rerun A004) |


## Gate 1 contract matrix
`work/audit/s7-1/tools/matrix.py` (r1's v2 extractor with the three field files) over `packages/core/src/components` (contract: `gate1/contract.json`; table: `gate1/matrix/md-text-field.md`,
92 rows). Every row has a SwiftUI and a Compose implementation and a Laboratory exposure. Test column (Swift / Android / Laboratory) gaps that remain after checking
the oracle JSON (`Tests/Fixtures/*field*.json`, `androidTest/assets/*Field*.json`), where hooks are exercised through the cases' `hooks` and attributes through the `html` of the states runs:
- No test on any platform and no Laboratory test: `enterKeyHint`, `autoCapitalize`, `spellcheck`, `showPasswordLabel`, `hidePasswordLabel`, `speechLang`; slot `clear-icon`, `password-toggle-icon`.
- Laboratory tests only, no Swift/Android fixture: `parser`, `formatOn`, `inputRole`, `inputExpanded`, `inputAriaAutocomplete`, event `mdSpeechResult`, slot `speech-icon`.
- `pattern`: Swift fixtures only, no Android case.
All are implemented in both renderers (`TextFieldModel.swift`, `NativeTextField.kt`); the gap is the test (finding S71-05).
CSS hooks that the matcher lists as "no Android test" (error-color, filled-pill, focus-inset, optical-nudge) are exercised: every hook is a key of 6 Chrome paint cases in the shared fixtures; not a gap.

## Exceptions
None proposed; none accepted.

## Findings
- **S71-05** (blocking, gate 1/2): members without a test, listed above.
- **S71-07** (non-blocking, test defect): `tf-throttle-200` is load sensitive: macOS run 2 of s7-1-003 failed with 13 events vs 12 (2020/2028), and the iOS runs print 13-vs-12 attempts before passing. Cause found: Chrome's seventh key lands 16.7 ms before the 200 ms throttle window closes (+183 ms), the native keys drift to +202 ms under load and land after it, so the source's own logic (trailing emit does not restart the window) produces the extra leading mdSearch; the retry rule in the fixture (`maxLate`) did not catch a 20 ms slip. Product logic matches the source.
- **S71-08** (non-blocking): checkpoint re-pinned, not re-run; doc counts stale (2026 vs 2028).

## Verdict
FAIL (gate 7, s7-1, 2026-11-15): blocking finding S71-05 only; everything that was re-run passes. Re-check after the missing tests exist.
