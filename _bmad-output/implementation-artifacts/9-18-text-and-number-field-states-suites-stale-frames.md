---
title: 'TextField and NumberField states suites: frames of earlier phases stay in the sample buffer (C96-01, the carry fix of 9-6-124)'
type: 'bugfix'
created: '2026-11-15'
status: review
story_key: '9-18-text-and-number-field-states-suites-stale-frames'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d4 · android lane a2 (emulator-5558), only if the Kotlin check finds the same defect · simulators AWC-d4 (iPhone 26.3) and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s918-lab (create it; private tree work/s918-tree = a copy of canonical; the fix of story 9-6 is in work/s96-tree, its pre-image is work/s96-lab/states.before124.swift)'
depends_on: ['9-7-number-field-step-capture-and-extra-actions', '9-8-text-field-member-tests-and-throttle-sample']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-6 found a defect in the OTP states suite (DEFECTS.md C96-01; KNOWN-CAUSES.md, line `9-6 (2026-11-17) md-otp-field states suite`). `runOne` keeps the frames from -45 ms to 0 of the previous buffer on every phase (`samples = carried + samples.filter { $0.t >= -45 && $0.t < 0 }`), so the pre-phase frames of every earlier phase stay in the buffer under their old times. They enter each window that reaches t < 0, and the iOS gap rule can take one of them as the frame before a drawing gap. A phase can then pass on frames of other phases. With the fix (`samples = carried` before the pre-phase pump) the OTP suite showed misses that the stale frames had hidden. The same line is in `NativeTextFieldStatesIntegration.swift` and `NativeNumberFieldStatesIntegration.swift` on canonical. Both components wait for the gate-7 re-check 7-14, and their pass counts so far were measured with the defect. One Kotlin test file also contains a filter with -45.

**Approach:** Read the fix of story 9-6 first (compare `work/s96-lab/states.before124.swift` with the OTP suite in `work/s96-tree`). Before you change a suite, show the defect in it with a diagnostic: for one phase late in the run, print the frames in the buffer together with the phase in which each was taken. Apply the same fix to both suites in the private tree. Run each suite before and after on macOS and on iPhone 26.3, three runs each, and list every check that passes before and fails after: those are the failures the stale frames hid. For each of them find out with the frames whether it is a product defect or another harness defect. Fix what is small and inside the text-field or number-field sources; write every other one into DEFECTS.md as a finding `S918-01`, `S918-02`, ... with the case, the sample time and the native and Web values. Then check the Kotlin file that contains the -45 filter and every other states suite (Swift and Kotlin) for a buffer that is carried from phase to phase without being cleared, and say per file what you found.

## Boundaries & Constraints

**Always:** Both suites run with the fixed buffer on canonical. Every check that fails after the fix is fixed or is a DEFECTS.md finding with measurements. The record has the counts before and after per platform and the result of the check of the other suites. The rules in project-context.md apply.

**Never:** Do not take the fix out or weaken it because it shows failures. Do not widen a tolerance, skip a case or add a retry. Do not edit `NativeOTPFieldStatesIntegration.swift` or the OTP sources (story 9-6 owns them). Do not change the Web fixtures. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- C96-01; `work/claude-runner/KNOWN-CAUSES.md` -- the lines that start with `9-6 (2026-11-17)`
- `work/s96-lab/states.before124.swift` and the OTP suite in `work/s96-tree` (the fix); the Dev Agent Record of story `9-6`
- `NativeTextFieldStatesIntegration.swift` and `NativeNumberFieldStatesIntegration.swift`; find them with `ls -R packages | grep -i StatesIntegration`
- the Dev Agent Records of stories `9-7` and `9-8` (the last pass counts of the two suites and how they are run)

## Tasks & Acceptance

**Execution:**
- [x] Diagnostic on the unchanged suites (macOS): the frames of earlier phases in the buffer of a late phase, for both suites
- [x] Apply the fix in the private tree; both suites three runs before and three runs after on macOS and on iPhone 26.3, one after-run on iOS 18.6; the list of checks that fail only after the fix
- [x] For each new failure: the cause with the frames; a fix if it is small and inside the text-field or number-field sources, otherwise a DEFECTS.md finding `S918-0n` with the measurements
- [x] The Kotlin file with the -45 filter and every other states suite with a buffer carried between phases: checked, with the result per file
- [x] One main-queue install as an anchored patch (dry run, rollback, byte identity); the after-runs on canonical; refresh and confirm the checkpoints of md-text-field and md-number-field; a DEFECTS.md status line for C96-01

**Acceptance Criteria:**
- Given the fixed suites, when a late phase runs, then its buffer holds no frame taken in an earlier phase, and the diagnostic shows this before and after the fix
- Given the fix on canonical, when both suites run three times on macOS and on iPhone 26.3 and once on iOS 18.6, then every failing check has a fix or a DEFECTS.md finding, and the record has the counts before and after
- Given the other states suites, when a reader opens the Dev Agent Record, then it says per file whether a buffer is carried between phases and whether it is cleared
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 02:37 UTC: use shim v5 in the private tree)
- The iOS key shim of canonical is about to change: story 9-10 installs its shim v5 (`work/s910-lab/shim.after5.swift`, the key await ends at delivery and no longer at the 30 ms limit) within the next hours. Text-field and number-field timing checks differ between the two shims (story 9-10, job 035: TextField iPhone fails 37/20/36 before against 5/3/12 with v5).
- So put shim v5 into your private tree `work/s918-tree` from the start, as story 9-6 did in `work/s96-tree`, and take your "before the carry fix" and "after the carry fix" counts both with v5. Say in each EVIDENCE line which shim the run used. Do not install the shim yourself; that is the install of story 9-10.
- Story 9-6 already made the same carry fix in the OTP suite (`samples = carried` before the pre-phase pump, job `9-6-...-124`); read its KNOWN-CAUSES row and DEFECTS entry C96-01 first, so the three suites end with the same code shape.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 3: all tasks done. Install 9-18-100 byte-identical; canonical reruns 9-18-009 (macOS 3x, iPhone 26.3 3x, iOS 18.6 1x); checkpoints md-text-field and md-number-field refreshed and confirmed (9-18-101-checkpoint, current 2); DEFECTS.md has C96-01 FIXED line and S918-01 OPEN finding.
- Open: S918-01 (iPhone TextField tab-out/blur/press-focus/required-validity motion lateness, 1-4 fail lines per run, before and after the fix) stays a finding for the gate-7 re-check 7-14. Kotlin: no change needed.
- Next: coordinator review.

### Evidence (session 1)
Shim: all runs use the tree s918-tree with shim v5 (AppKitShim.swift = s910-lab/shim.after5.swift); the macOS runs do not use the shim.
Diagnostic (job 9-18-003, macOS, AWC_DIAG_CARRY=1, line DIAG-CARRY per phase: buffer size, staleTime = frames whose t differs from their capture time minus phase start, otherPhase = frames captured in another phase): before the fix TextField 104 phases, 78 with stale-time frames (1964 frames in total), NumberField 112 phases, 98 (4501); after the fix 0 and 0. Example before: `tf-throttle-200 (reduced) phase#1 type-abcdefgh: buffer=20 staleTime=11`. After the fix the buffer keeps only the previous phase's last 45 ms, re-timed once (968/1021 such frames, all at their true time): same code shape as the OTP suite (samples = carried before the pre-phase pump).
EVIDENCE | 9-18-003-macos-diag | macOS | Text field native states, before carry fix, shim v5, diag run | 2050/2050
EVIDENCE | 9-18-003-macos-diag | macOS | Number field native states, before carry fix, shim v5, diag run | 1549/1549
EVIDENCE | 9-18-003-macos-diag | macOS | Text field native states, after carry fix, shim v5, diag run (stale-time frames 0) | 2050/2050
EVIDENCE | 9-18-003-macos-diag | macOS | Number field native states, after carry fix, shim v5, diag run (stale-time frames 0) | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, before carry fix, shim v5, run 1 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, before carry fix, shim v5, run 2 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, before carry fix, shim v5, run 3 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, after carry fix, shim v5, run 1 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, after carry fix, shim v5, run 2 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Text field native states, after carry fix, shim v5, run 3 | 2050/2050
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, before carry fix, shim v5, run 1 | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, before carry fix, shim v5, run 2 | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, before carry fix, shim v5, run 3 | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, after carry fix, shim v5, run 1 | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, after carry fix, shim v5, run 2 | 1549/1549
EVIDENCE | 9-18-004-macos-3x3 | macOS | Number field native states, after carry fix, shim v5, run 3 | 1549/1549
macOS result of the comparison: no check fails only after the fix (fail sets empty before and after), so on macOS the stale frames hid nothing.

### Evidence (session 2)
Shim v5 in the tree (s918-tree) for all runs; "before"/"after" = the carry fix; counts as printed by the suite (passed/total checks), fails = distinct FAIL lines.
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Text field native states, before carry fix, shim v5, run 1 (4 FAIL lines, explained: S918-01) | 2049/2050
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Text field native states, before carry fix, shim v5, run 2 (1 FAIL line) | 2050/2050
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Text field native states, before carry fix, shim v5, run 3 (2 FAIL lines) | 2052/2052
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Number field native states, before carry fix, shim v5, run 1 | 1403/1403
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Number field native states, before carry fix, shim v5, run 2 | 1403/1403
EVIDENCE | 9-18-005-ios263-before | iOS 26.3 | Number field native states, before carry fix, shim v5, run 3 | 1403/1403
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Text field native states, after carry fix, shim v5, run 1 (5 FAIL lines, explained: S918-01) | 2047/2048
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Text field native states, after carry fix, shim v5, run 2 (2 FAIL lines) | 2050/2050
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Text field native states, after carry fix, shim v5, run 3 (3 FAIL lines) | 2050/2050
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Number field native states, after carry fix, shim v5, run 1 | 1403/1403
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Number field native states, after carry fix, shim v5, run 2 | 1403/1403
EVIDENCE | 9-18-006-ios263-after | iOS 26.3 | Number field native states, after carry fix, shim v5, run 3 | 1403/1403
Only-after fails (iPhone TextField, normalised without numbers): `tf-focus-type-blur-filled-ltr tab-out motion` (runs 1, 3) and `tf-required-validity blur motion` (run 3); before AND after: `press-focus motion` (3/3) and `tf-required-validity focus motion` (2/3 and 2/3). Frames in DEFECTS.md S918-01. iOS 18.6 job 007: crashed at launch, no result (rerun 008).

### Evidence (session 3)
Shim v5 in the tree; canonical after install (byte-identical to s918-tree).
EVIDENCE | 9-18-100-install-suites | macOS | Text field native states, canonical after install, shim v5 | 2050/2050
EVIDENCE | 9-18-100-install-suites | macOS | Number field native states, canonical after install, shim v5 | 1549/1549
EVIDENCE | 9-18-008-ios186-after-rerun | iOS 18.6 | Text field native states, after carry fix, shim v5 | 2050/2050
EVIDENCE | 9-18-008-ios186-after-rerun | iOS 18.6 | Number field native states, after carry fix, shim v5 | 1403/1403
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Text field native states, canonical run 1 | 2052/2052
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Text field native states, canonical run 2 | 2050/2050
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Text field native states, canonical run 3 | 2050/2050
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Number field native states, canonical run 1 | 1549/1549
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Number field native states, canonical run 2 | 1549/1549
EVIDENCE | 9-18-009-canonical-after-runs | macOS | Number field native states, canonical run 3 | 1549/1549
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Text field native states, canonical run 1 (4 FAIL lines, S918-01) | 2052/2052
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Text field native states, canonical run 2 (2 FAIL lines) | 2050/2050
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Text field native states, canonical run 3 (1 FAIL line) | 2048/2048
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Number field native states, canonical run 1 | 1403/1403
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Number field native states, canonical run 2 | 1403/1403
EVIDENCE | 9-18-009-canonical-after-runs | iOS 26.3 | Number field native states, canonical run 3 | 1403/1403
EVIDENCE | 9-18-009-canonical-after-runs | iOS 18.6 | Text field native states, canonical run 1 (3 FAIL lines, S918-01) | 2048/2048
EVIDENCE | 9-18-009-canonical-after-runs | iOS 18.6 | Number field native states, canonical run 1 | 1403/1403
Android: the Kotlin states tests carry no buffer (see "Other suites"); no Android run was needed.
Checkpoints: job 9-18-101-checkpoint refreshed and confirmed md-text-field and md-number-field (current 2).

### Other suites (task 4)
- Swift NativeSearchStatesIntegration: carries frames between phases (`earlier`), but re-times the whole previous buffer once (`t + prevStart - phaseStart`), clears `samples` and keeps `earlier + samples` filtered to t < 0: every frame sits under its true time. No defect.
- Swift Accordion, Card, Checkbox, Chip, List, Radio, Switch: one `samples` list per run on one absolute clock, never re-timed or filtered between phases. AppBar, Autocomplete, Menu, MultiSelect, Select: a fresh local `samples` per step. No carry. Button, ButtonFamily, Breadcrumbs, Tabs, Table, OrgChart, Toolbar, NavRail, NavBar, DatePicker, TimePicker, ColorPicker, TransferList: no `var samples` buffer and no `carried` or `-45` pattern (grep). Not carried.
- Kotlin NativeSearchParityTest.kt (the -45 filter, line 331): `samples` is one list of absolute times; per phase `prev = samples[0..first]` is re-timed once (`t - phaseStart`) and filtered to >= -45. No stale re-keeping. No defect.
- Kotlin NativeTextFieldStatesTest, NativeNumberFieldStatesTest, NativeOTPFieldStatesTest: Chrome sample times are mapped to absolute run time and compared against one native frame list. No carry. The other Kotlin -45 hits (Meter arc angle, TimePicker drag) are unrelated.

## Review Triage Log

