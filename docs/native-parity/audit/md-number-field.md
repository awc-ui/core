# md-number-field — gate-7 independent audit

Reviewer: gate-7 reviewer s7-1 (story 7-1-audit-text-number-otp-fields), 2026-11-15. First gate-7 audit of the component. Everything below was
re-run by s7-1 on a fresh snapshot `work/audit/s7-1-tree` (taken 2026-11-15 15:01 UTC; 232 install jobs, latest 6-3-028 / s7-7-010 / 1-2-md-search A026; manifest
`work/audit/s7-1/snap/`). Outputs: `work/audit/s7-1/` (swift/, ios/, android/, lab/, web/, ax/, ax-nf/, examples/, gate1/). Mac lane r1, Android lane a5
(emulator-5564, AwcNative6), simulators AWC-r1 (iPhone 17 Pro, iOS 26.3) and AWC-r1-ios18 (iPhone 16 Pro, iOS 18.6). Timing runs went through `tools/slot.sh timing 4`.
Jobs: s7-1-001-snapshot, -003-swift, -003b-lab-web, -003c-lab-probe2, -003d-lab-probe3, -003e-own-server, -003f/-003g-otp-inspection, -004-ios, -005-ios-states-more,
-006-ax-mac-ios, -006b-ax-nf-mac-x6, -007-ax-compare, -008-mac-states-x4; a5: s7-1-A001-android, -A002-ax-android, -A003-examples-kotlin, -A004-ax-android-rerun.

## Checkpoint freshness
`outputs/native-parity/md-number-field/native/checkpoint.json` pins 24 files; all match the snapshot (0 differ) but the file carries a `checkpointRefresh` of 2026-11-15T16:56+02: the
pins were re-written to canonical without re-running the evidence. The re-runs below are therefore the first evidence on today's sources (finding S71-08).

## Re-run counts (claimed -> re-run)
| Suite | Claimed | s7-1 re-run |
|---|---|---|
| Paint (220 Chrome cases) macOS / iOS 26.3 / Android | 8,815 / 8,815 / 8,203 | 8,815/8,815 (003) / 8,815/8,815 (004) / 8,203/8,203 (A001) |
| States macOS x2 | 1,538 | 1538/1538, 1538/1538 |
| States iOS 26.3 x3 / iOS 18.6 x2 | 1,392 | 1392/1392 x5 |
| States Android | 1,096 | 1096/1096; `LivePreviewNumberFieldHostTest` ok |
| SwiftUI live host `test-live-numberfield.mjs` | 33/33 | 33 checks passed |
| Laboratory 4177 + own server 4197 (macOS SwiftUI) / Android probes | retained updates of every property, methods with results | update of `step` NOT applied to stepUp()/stepDown() on SwiftUI (S71-02); Android correct; validity methods ok on both |
| Studio / compiler / Web spec / e2e | 827/829 | 886/886, 12/12, 277/277 (3 tags), e2e 21/21 |
| Examples | - | Swift typecheck exit 0, Kotlin compile ok (generic, 15 cases) |
| tools/ax web+macOS+iOS+Android | 0 open | 6 cases 0 open findings; macOS x6 re-runs (s7-1-006b): 0 findings each, extra actions seen in 7 of 36 case processes |


## Gate 1 contract matrix
`work/audit/s7-1/tools/matrix.py` (r1's v2 extractor with the three field files) over `packages/core/src/components` (contract: `gate1/contract.json`; table: `gate1/matrix/md-number-field.md`,
44 rows). Every row has a SwiftUI and a Compose implementation and a Laboratory exposure. Test column (Swift / Android / Laboratory) gaps that remain after checking
the oracle JSON (`Tests/Fixtures/*field*.json`, `androidTest/assets/*Field*.json`), where hooks are exercised through the cases' `hooks` and attributes through the `html` of the states runs:
- No test anywhere: `allowOutOfRange`, `decrementLabel`. Laboratory test only: `snapOnStep`, `incrementLabel`. Methods `stepUp` / `stepDown`: Android and Laboratory tests, no Swift test.
All are implemented in both renderers; the missing `stepUp`/`stepDown` Swift test is exactly the gap that hides S71-02 (finding S71-05).
CSS hooks that the matcher lists as "no Android test" (error-color, filled-pill, focus-inset, optical-nudge) are exercised: every hook is a key of 6 Chrome paint cases in the shared fixtures; not a gap.

## Exceptions
**Proposed record under judgement: the macOS extra-actions behaviour** (`docs/native-parity/md-number-field.md`, decision 2026-11-07 n3, evidence `outputs/native-parity/_ax-n3-nf-decision/`, listed under "Remaining" as SwiftUI platform behaviour; the doc says "Exceptions: none proposed").
- Source behaviour: the Web field exposes a spinbutton input and two `tabindex=-1` steppers; no extra actions. Platform/API: macOS Accessibility, SwiftUI synthesized accessibility nodes. Technical reason: nondeterministic per process; user impact: VoiceOver lists AXIncrement/AXDecrement/AXDelete/AXShowMenu/AXCancel on a stepper group or support text and can lose one stepper button (the value stays adjustable through the input).
- Measured again: tools/ax macOS x6 (36 case processes, `ax-nf/`): the five-action set appears on the stepper group in 7 of 36 (19%), never in the disabled case; the record's rate is 5/24 (21%); no tools/ax finding in any of the six runs.
- **Decision: NOT accepted as an exception.** The record's own evidence refutes "platform behaviour": a SwiftUI app without AWCUI composed like the field shows it in 0/272 processes, md-icon-button in 0/24, md-text-field in 0/10; the bisect removed none of the AWCUI factors tried. Policy: do not waive implementable gaps as platform differences; the cause lies in how AWCUI composes the stepper nodes and has not been found. No tested native equivalent, no reviewer acceptance fields. It stays a finding (S71-04, non-blocking: no tools/ax finding, actions are no-ops) with the next bisect steps.

## Findings
- **S71-02** (blocking, gate 3/4): SwiftUI `stepUp()` / `stepDown()` use the properties of the first render. Probe on the Laboratory (4177 and an own server on the tree, jobs 003c/003d/003e): created with value 7, min 0, max 10, step 2 -> stepUp, stepUp, stepDown give 9, 10, 8 (source: `base + step`, clamped); the same field with `step: 2` sent as a retained update gives 8, 9, 8 (step 1); an update to step 3 gives 8, 9, 8. Android gives 9, 10, 8 in both ways. Cause: `NativeNumberField.swift` `start()` (line ~327) installs `rt.step = { ... model.stepAmount ... }` once; the closure captures the view value of the first render, so later `node.properties` are not seen. Fix: build the model at call time from the current node (store the latest node on `rt` in body), and add a test (update `step`/`min`/`max`/`snapOnStep`, then `stepUp`) to the Swift live host and the states fixture; check the other closures installed in `start()` (`validityBox.evaluate`) for the same capture.
- **S71-04** (non-blocking): extra-actions exception not accepted, see above. Next steps: bisect against the standalone repro by adding AWCUI's `AWCNativeView` host wrappers one at a time; try `.accessibilityRepresentation` / `.accessibilityElement(children: .contain)` on the stepper group or AppKit `NSAccessibilityElement` buttons.
- **S71-05** (blocking, gate 1/2): members without a test (above).
- **S71-08** (non-blocking): checkpoint re-pinned, not re-run.

## Verdict
FAIL (gate 7, s7-1, 2026-11-15): blocking findings S71-02, S71-05. The macOS extra-actions record is rejected as an exception (S71-04).
