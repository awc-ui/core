# Gate 7 audit — `md-date-picker`

Reviewer: gate-7 reviewer s7-11, 2026-11-16. Independent of the implementing forks; no product code changed.

**Verdict: PASS WITH ACCEPTED EXCEPTIONS** — one accepted exception (Arabic / Hebrew fallback fonts) and one open, non-blocking finding (s7-11-01, intermittent Android live-host test, see DEFECTS.md).

## Method

- Snapshot `work/audit/s7-11-tree` of canonical (job `s7-11-001-snapshot-macos`, 2026-11-16), after the 1-3 reopen (paint test default D9). Lanes: Mac r2, Android a5 (emulator-5564), simulators AWC-r2, AWC-r2-pad, AWC-r2-18.
- Contract matrix: `audit/s7-11/matrix.json` (149 rows, name matching). Gaps it lists are naming artefacts (labels and events are exercised by the paint/states suites and the Laboratory probe; parts go through the typed part API). Parts `month-menu-viewport`, `year-menu-viewport` and `docked-below-nav` are named only in oracle JSON, not in sources: they are supporting md-menu / md-dialog parts, covered by the paint cases' box checks.
- Checkpoint: 27 of 27 pinned hashes match canonical; the three oracle files the script reported "missing" exist under `web-oracle-mac/` (path resolution in my checker). The 2026-11-16 refresh records a test-only change (`NativeDatePickerPaintIntegration.swift`), confirmed by 1-3 runs.

## Re-run evidence

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | paint (default), paint reduced, states | `s7-11-001-snapshot-macos` | 37,183/37,183; 37,789/37,789; 10,417/10,417 |
| iPhone 26.3 | paint, states x3 | `s7-11-002-ios-iphone` | 37,181/37,181; 10,417/10,417 three times |
| iPad 26.3 | paint (first run in `s7-11-006-ios-ipad` died with "install failed", its summary line was a stale console and is not evidence), states x3 | `s7-11-007-ios-dp-paint-rerun`, `s7-11-006-ios-ipad` | 37,181/37,181; 10,417/10,417 three times |
| iOS 18.6 | paint (same install failure in `s7-11-003-ios-ios18`), states | `s7-11-007-ios-dp-paint-rerun`, `s7-11-003-ios-ios18` | 37,181/37,181; 10,417/10,417 |
| Android | `NativeDatePickerPaintTest` | `s7-11-A001-android`, `s7-11-A004-dp-rerun` | without `awcDpD9=1`: 606 of 32042 fail in `hook-year-block-size` (recorded cause, DEFECTS 2026-11-14 / 1-5, not a product defect); with `awcDpD9=1`: 31,436/31,436 |
| Android | `NativeDatePickerStatesTest` | `s7-11-A001-android` | 10,417/10,417 |
| Android | `LivePreviewDatePickerHostTest` | `s7-11-A001-android`, `s7-11-A004-dp-rerun` x3 | first run: `datePickerViewportHooksMethodsAndUpdates` FAIL (HTTP 400 "Native request failed."); 3 of 3 reruns ok. Finding s7-11-01 |
| Laboratory | `test-live-date-picker` 42/42, node suites, 4177 probes (iOS and Android: session, update, show, getValidity, checkValidity, setCustomValidity, close, clear, focusInput, frame) | `s7-11-005-lab-ax` | all ok |
| Examples | 28 Swift typecheck, 28 Kotlin compile (class files produced) | `s7-11-004-examples-swift`, `s7-11-A006-examples-kotlin2` | 0 errors |
| tools/ax | 3 cases | `s7-11-005-lab-ax`, `s7-11-A003-ax-android` | macOS pass (7 accepted), iOS pass (5 accepted), Android compare 0 open |

The claimed counts in `md-date-picker.md` match these logs (37,183 / 37,789 / 10,417 / 37,181 / 31,436).

## Exception decision: fallback fonts of Arabic and Hebrew labels

**Accepted.** All fields of the policy are present (source behaviour, platform and API, technical reason, user impact, tested native equivalent, evidence, reviewer slot). The source styles the toggle in Roboto only, so every platform draws Arabic and Hebrew runs with its own fallback face; the Apple faces Chrome picks on macOS (Geeza Pro, Lucida Grande) cannot be bundled, and Android and iOS do not carry them. A bundled open face would not reproduce Chrome's metrics either. The user impact is limited to the width of the month toggle (about 5-15 px); every other box and all flat pixels of those cases are checked, and the width is recorded, not counted as passed. Arabic on Apple platforms matches Chrome already.

## Finding

s7-11-01 (M, open, not blocking this verdict): `LivePreviewDatePickerHostTest.datePickerViewportHooksMethodsAndUpdates` failed once on a loaded run (HTTP 400 from the debug host, error body only "Native request failed.") and passed 3 of 3 afterwards. The same test failed on 2026-11-14 (`1-3-...-A006-lab-and-ax-android`, AwcNative5). Cause not established. Because the failure vanishes on rerun it stays a finding until the cause is known; the verdict should be re-checked when it is closed.
