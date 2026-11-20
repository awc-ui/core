---
title: 'md-number-field: stepUp and stepDown after property updates, macOS extra actions (S71-02, S71-04, S71-05)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-7-number-field-step-capture-and-extra-actions'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n1 · android lane a2 (emulator-5558) · simulator AWC-n1'
lab: 'work/s97-lab (create it; private tree work/s97-tree = a copy of canonical; the reviewer's evidence is in work/audit/s7-1)'
depends_on: ['7-1-audit-text-number-otp-fields']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-7 audit s7-1 failed md-number-field. S71-02 (blocking): on SwiftUI `stepUp()` and `stepDown()` ignore property updates. Created with min 0, max 10, step 2 and value 7 they give 9, 10, 8, as the source does; after a retained update that sets `step` to 2 they still step by 1 (8, 9, 8). Cause: `start()` in `NativeNumberField.swift` sets `rt.step = { ... model.stepAmount ... }` once, and the closure keeps the node of the first render. Android is correct. S71-04 (non-blocking, the exception was rejected): on macOS the stepper group exposes a set of five accessibility actions in 7 of 36 case processes. The earlier extra-actions record (n3, 2026-11-07) is not a valid exception, because its own standalone repro shows 0 of 272; the cause is therefore in the AWCUI composition. S71-05 (blocking): `allowOutOfRange` and `decrementLabel` have no native test, `snapOnStep` and `incrementLabel` are exercised only by the Laboratory, and `stepUp`/`stepDown` have no Swift test.

**Approach:** S71-02: read the current node at call time (store it on `rt` in `body`). Then check `validityBox.evaluate` and every other closure that `start()` sets for the same capture, and fix each one with a test. Test: update `step`, `min`, `max` and `snapOnStep`, then call `stepUp` and `stepDown`, in `test-live-numberfield.mjs` and in the states fixture. S71-04: bisect against the standalone repro by adding the AWCUI host wrappers one at a time until the five-action set appears. Then remove the cause, or build the stepper group with `.accessibilityRepresentation` or with explicit AppKit `NSAccessibilityElement` buttons. If the bisect ends at a platform behaviour, write a new exception proposal that carries the repro, and mark it pending gate-7 review. S71-05: one Swift fixture case and one Android case per member.

## Boundaries & Constraints

**Always:** The update-then-step case fails on canonical SwiftUI and passes after the change; Android passes before and after. tools/ax on macOS x6 shows the five-action set in 0 of 36 case processes, or the exception proposal has a repro that shows the set without AWCUI. Each new member case fails when the member is ignored (one mutation run per member). The rules in project-context.md apply.

**Never:** Do not change the source contract or the Android stepping code. Do not use the n3 extra-actions record as an exception. Do not touch md-otp-field or md-text-field files (stories 9-6 and 9-8 own them). md-number-field composes md-text-field: if a fix needs a change in a text-field file, stop that task and write what is needed into the Handover for the coordinator.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- section 'gate-7 audit s7-1', rows S71-02, S71-04, S71-05, S71-08
- `work/audit/s7-1/lab/lab-probe2-own.log` (own server, tree), `work/audit/s7-1/ax-nf/` (job s7-1-006b), `outputs/native-parity/_ax-n3-nf-decision` (the rejected record and its standalone repro)
- `work/audit/s7-1/gate1/` (contract.json, the matrix, words-*.txt) for the members of S71-05
- `packages/native-ios/Sources/AWCUI/NativeNumberField.swift`, `test-live-numberfield.mjs` (find the paths with `ls | grep -i`)

## Tasks & Acceptance

**Execution:**
- [x] S71-02: the failing live test and states case on your own server; fix; number-field states and paint on macOS, iPhone 26.3 and Android
- [x] The other closures set in `start()`: list them, fix and test each one that captures the first node
- [x] S71-04: bisect, name the cause, then the fix or the exception proposal; tools/ax on macOS x6
- [x] S71-05: Swift and Android cases for `allowOutOfRange`, `decrementLabel`, `snapOnStep`, `incrementLabel`, `stepUp` and `stepDown`, with one mutation run per member
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status lines `ready for re-check` for S71-02, S71-04 and the number-field part of S71-05; refresh and confirm the md-number-field checkpoint with the runs after the install (S71-08)

**Acceptance Criteria:**
- Given a SwiftUI number field whose `step`, `min`, `max` or `snapOnStep` was updated after creation, when `stepUp()` or `stepDown()` is called, then the value is the one the source gives, and the same case failed on canonical
- Given the macOS accessibility check runs six times, when the stepper group is read, then no case process shows the five-action set, or an exception proposal with a repro outside AWCUI is pending gate-7 review
- Given each member named in S71-05 for md-number-field, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (11:08 UTC 2026-11-16, high Mac load 09:20-11:25 UTC)
- From about 09:20 to about 11:25 UTC on 2026-11-16 the Mac ran a deliberate CPU load: story 6-4 measured a stall with 12 busy loops in its jobs 015 to 018, and the load average was 270 to 1000 (normal is 50 to 70). A timing, motion, states or focus failure of any run inside that window is suspect, also on a simulator or an emulator. Do not record it as a finding and do not build a conclusion on it: look at the load line of the job, and repeat the run once the 1-minute load is back below about 150. Paint and geometry results are not affected.

## Dev Agent Record

### Current state
- Session 6. All done: install job 100 (byte identity ok), post-install runs 101 on canonical all pass, checkpoint confirmed by 102 (S71-08). Tasks ticked; status review.
- Next: coordinator review only. verify_evidence.py must end with hard failures: 0.

EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-101-post-install-runs | macOS | Number field native paint (canonical) | 8815/8815
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-101-post-install-runs | macOS | Number field native states (canonical) | 1549/1549
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-101-post-install-runs | macOS | md-number-field live host test-live-numberfield (canonical) | 46/46
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-101-post-install-runs | macOS | tools/ax md-number-field extra-actions set absent (canonical, x6) | 36/36

EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-007-ax-final | macOS | tools/ax md-number-field extra-actions set absent (36 case processes) | 36/36
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-007-ax-final | macOS | NativeNumberFieldStatesIntegration with accessibilityRepresentation | 1549/1549
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-007-ax-final | macOS | live host test-live-numberfield with accessibilityRepresentation | 46/46

EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-002-fixture-baseline-fix | macOS | NativeNumberFieldStatesIntegration members on canonical product (must fail: step, max, min, snapOnStep) explained: mutation or canonical run must fail | 4/8
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-002-fixture-baseline-fix | macOS | NativeNumberFieldStatesIntegration members after fix | 11/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-002-fixture-baseline-fix | macOS | NativeNumberFieldStatesIntegration full (oracle + members) | 1549/1549
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members mutation snapOnStep (fails as required) explained: mutation or canonical run must fail | 10/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members mutation allowOutOfRange (fails as required) explained: mutation or canonical run must fail | 10/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members mutation incrementLabel (fails as required) explained: mutation or canonical run must fail | 9/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members mutation decrementLabel (fails as required) explained: mutation or canonical run must fail | 9/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members mutation stepUp/stepDown (fails as required) explained: mutation or canonical run must fail | 5/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | members after restore | 11/11
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A001-members | Android | NativeNumberFieldMembersTest unmutated | 1/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A001-members | Android | NativeNumberFieldMembersTest restored after mutations | 1/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | live host test-live-numberfield on canonical binary (must fail: step update case) explained: mutation or canonical run must fail | 0/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-003-mutations-live | macOS | live host test-live-numberfield after fix | 46/46
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-004-ios-paint | macOS | Number field native paint | 8815/8815
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-004-ios-paint | iOS | NativeNumberFieldStatesIntegration (iPhone 26.3 AWC-n1) | 1403/1403
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A002-nf-suites | Android | NativeNumberFieldStatesTest | 1/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A002-nf-suites | Android | NativeNumberFieldParityTest | 1/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A002-nf-suites | Android | LivePreviewNumberFieldHostTest | 1/1
EVIDENCE | 9-7-number-field-step-capture-and-extra-actions-A002-nf-suites | Android | NativeNumberFieldMembersTest | 1/1
(Android mutations stepUpDown, snapOnStep, allowOutOfRange, incrementLabel, decrementLabel each failed 1/1 in A001; stepUpDown message: expected [9,10,8] but was [7,7,7].)


## Review Triage Log

