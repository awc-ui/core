---
title: 'md-text-field: native tests for the untested members, throttle boundary sample (S71-05, S71-07)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-8-text-field-member-tests-and-throttle-sample'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n4 · android lane a6 (emulator-5566) · simulator AWC-n4'
lab: 'work/s98-lab (create it; private tree work/s98-tree = a copy of canonical; the reviewer's evidence is in work/audit/s7-1)'
depends_on: ['7-1-audit-text-number-otp-fields']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-7 audit s7-1 failed md-text-field on S71-05 (blocking): members implemented in SwiftUI and Compose and exercised by no native test. No native test: `enterKeyHint`, `autoCapitalize`, `spellcheck`, `showPasswordLabel`, `hidePasswordLabel`, `speechLang` and the slots `clear-icon` and `password-toggle-icon`. Exercised only by the Laboratory: `parser`, `formatOn`, `inputRole`, `inputExpanded`, `inputAriaAutocomplete`, `mdSpeechResult` and the slot `speech-icon`. `pattern` has a Swift test and no Android test. S71-07 (non-blocking, a test defect): `tf-throttle-200` in `NativeTextFieldStatesIntegration` gives 13 events against 12 under load. Chrome's seventh key lands 16.7 ms before the 200 ms window closes; under load the native key slips to +202 ms and lands after it, and the product then does what the source does for those key times.

**Approach:** S71-05: one Swift fixture case and one Android case per member: accessibility labels through inspection, keyboard hints through the host model, slots through paint or inspection, the event through the host's event log. A case must fail when the member is ignored; prove it once per member by a mutation in the private tree (disable the member, run the case, restore). If a case shows a difference from the source contract, fix the product in this story with that case as the failing test. S71-07: extend the existing `replay` comparison (the sequence the source produces for the delivered key times) to `lateness > 12`, or place the last key at least 40 ms before the window ends. State which one and why.

## Boundaries & Constraints

**Always:** Each member has a Swift case and an Android case with a recorded mutation failure. `tf-throttle-200` passes five macOS runs with a second suite running in the same job and five runs without, and three runs on iPhone 26.3. The rules in project-context.md apply.

**Never:** Do not change the product to make a new case pass unless the case shows a difference from the source contract. Do not widen the throttle tolerance. Do not touch md-otp-field or md-number-field files (stories 9-6 and 9-7 own them). Many components compose md-text-field: after any product change run the number-field, search and select paint suites on macOS as well.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- section 'gate-7 audit s7-1', rows S71-05, S71-07, S71-08
- `work/audit/s7-1/gate1/` (contract.json, the matrix, words-*.txt) and the fixture search in `work/audit/s7-1/docs`
- `work/audit/s7-1/swift` and jobs `s7-1-003`, `s7-1-008` for the throttle runs
- `packages/native-ios/Sources/AWCUI/NativeTextField.swift`, `NativeTextFieldStatesIntegration`, `test-live-textfield.mjs`, the Compose text field and its tests (find the paths with `ls | grep -i`)

## Tasks & Acceptance

**Execution:**
- [x] Read the gate-1 matrix; write the list of members with the test that will cover each one into the Dev Agent Record
- [x] Swift cases on macOS and iPhone 26.3, one mutation run per member
- [x] Android cases, one mutation run per member
- [x] S71-07: the throttle sample; macOS x5 under load and x5 without, iPhone 26.3 x3
- [x] One main-queue install (dry run, rollback, byte identity); text-field paint and states on macOS, iPhone 26.3 and Android after the install; DEFECTS.md status lines `ready for re-check` for the text-field part of S71-05 and for S71-07; refresh and confirm the md-text-field checkpoint (S71-08)

**Acceptance Criteria:**
- Given each member named in S71-05 for md-text-field, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given `tf-throttle-200`, when it runs five times on macOS under load and five times without, then every run passes without a retry
- Given the install, when the md-text-field suites run on macOS, iPhone 26.3 and Android, then the counts equal the s7-1 counts plus the new cases
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-16 14:00 UTC: all Mac queues stopped at 13:35:04 UTC; what to redo)
At 13:35:04 UTC on 2026-11-16 (15:35:04 Mac time) every process of the runner process group got SIGTERM. The main runner, all lanes and all running jobs stopped (`claude-runner/KNOWN-CAUSES.md` row 34: `kill 0` in a helper trap of job 9-9-003). The coordinator stopped all chains at about 13:56 UTC. Your chain is relaunched only after the user has started the runner and the lanes are back, so when you read this the queues work again. Since the restart each lane job runs in its own process group. Results written before 13:35:04 are valid. A job stopped by the event has `.exit` 143 and a last log line written by the coordinator. Before you queue such a job again (new number), check your private tree for half-applied state: files the job trap restores, diagnostic lines left in tests, half-applied patches.

For this story: main-queue job `...-100-install-text-field-members` was stopped after the install itself. Done: file install with byte identity ("installed identical"), the three DEFECTS.md lines, NativeTextFieldStatesIntegration 2050/2050 twice, NativeTextFieldPaintIntegration 12700/12700, NativeNumberFieldPaintIntegration 8815/8815. Not run: NativeSearchPaintIntegration, NativeSelectPaintIntegration and `tools/checkpoint-refresh.py refresh --tags md-text-field`. Queue a main-queue job with only these remaining steps. Do not run the install part again: its pre-image check would now fail because the files are already installed.

## Dev Agent Record

### Current state
Session 4 (2026-11-16). ALL DONE. Canonical installed byte-identical (-100); install -100 (stopped by kill-0 event after the install; results re-run cleanly in -103: TF states 2050 x2, TF paint 12700, NF paint 8815); remainder ran in -102 (search paint 7186/7186, select paint 1577/1577, checkpoint md-text-field refreshed). Evidence for macOS, iOS, Android is below; all tasks ticked.
OPEN: inputAriaAutocomplete parsed/exposed but applied on neither platform (no native API): exception candidate for gate 7. iOS throttle runs pass through the suite's own 3-attempt loop.
NEXT: none; coordinator reviews. Verify: python3 $HOME/mnt/p/work/bmad-coord/verify_evidence.py 9-8-text-field-member-tests-and-throttle-sample

### Member plan (S71-05, md-text-field)
| member | Swift case | Android case | how |
|---|---|---|---|
| enterKeyHint, autoCapitalize, spellcheck | memberCases hints | keyboardHints | input inspection values from the applied input config / KeyboardOptions |
| showPasswordLabel, hidePasswordLabel | memberCases (click toggles) | passwordLabelsAndSpeechLang | password-toggle label metric + content description |
| speechLang | memberCases | passwordLabelsAndSpeechLang | speech part `lang` (same property as the recogniser) |
| slots clear-icon, password-toggle-icon, speech-icon | memberCases slot cases | slots | button `icon` = slot/default; Android testTag in slot content |
| pattern | existing | pattern | checkValidity on pattern mismatch |
| parser, formatOn | memberCases formatting (uppercase formatter, lowercase parser) | parserFormatOnAndRole | shown text and last mdInput detail |
| inputRole, inputExpanded, inputAriaAutocomplete | memberCases combobox | parserFormatOnAndRole | input inspection role/expanded/ariaAutocomplete |
| mdSpeechResult | memberCases external speech clicks | speechResultEvent | event log |
Finding: Compose ignored autoCapitalize and spellcheck (capitalization hard-coded None, autoCorrect default). Fixed in the tree (Web contract: autocapitalize / spellcheck). Decision, reversible: spellcheck maps to KeyboardOptions.autoCorrectEnabled (default true = unchanged default).
S71-07 decision: replay is applied whenever the delivered cadence differs from Chrome's by more than 12 ms on any attempt (was: final attempt only); no tolerance widened.


### Evidence (session 1 jobs, read in session 2)
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-002-mac-members | macOS | Text field native states (members) | 18/18
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation enterKeyHint (must fail) | 16/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation autoCapitalize (must fail) | 16/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation spellcheck (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation showPasswordLabel (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation hidePasswordLabel (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation speechLang (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation clear-icon (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation password-toggle-icon (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-003-mac-mutations-swift | macOS | mutation speech-icon (must fail) | 17/18 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-005-ios-members-throttle | iOS | Text field native states (members) | 18/18
Superseded by -006/-007 (throttle fix applied after these): -004 loaded run 4 failed 93/101 (tf-throttle-200 13 vs 12); iOS throttle runs -005 passed 102/102 only after a retried attempt.
Android -A001 baseline: passwordLabelsAndSpeechLang, keyboardHints, pattern ok; slots failed (test defect, merged semantics), fixed in A003.
Android -A002 mutations enterKeyHint, autoCapitalize, spellcheck, showPasswordLabel, hidePasswordLabel, speechLang each failed 2 of 4 tests (the slots baseline failure included); slot/pattern mutations repeated in A003.

### Evidence (session 3 jobs)
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 loaded run 1) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 loaded run 2) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 loaded run 3) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 loaded run 4) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 loaded run 5) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-006-mac-throttle-x10-b | macOS | Text field native states (tf-throttle-200 plain runs 1-5) | 98/98
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-007-ios-throttle-b | iOS | Text field native states (tf-throttle-200 run 1) | 102/102
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-007-ios-throttle-b | iOS | Text field native states (tf-throttle-200 run 2) | 102/102
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-007-ios-throttle-b | iOS | Text field native states (tf-throttle-200 run 3) | 102/102
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | Text field native states (members, 14 members) | 28/28
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation parser (must fail) | 27/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation formatOn (must fail) | 27/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation inputRole (must fail) | 27/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation inputExpanded (must fail) | 27/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation inputAriaAutocomplete (must fail) | 27/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-008-mac-members2-mut | macOS | mutation mdSpeechResult (must fail) | 26/28 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-009-ios-members2 | iOS | Text field native states (members, 14 members) | 28/28
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | NativeTextFieldMembersTest | 6/6
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A003-android-members-rerun | Android | mutation clear-icon (must fail) | 3/4 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A003-android-members-rerun | Android | mutation password-toggle-icon (must fail) | 3/4 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A003-android-members-rerun | Android | mutation speech-icon (must fail) | 3/4 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A003-android-members-rerun | Android | mutation pattern (must fail) | 3/4 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation parser (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation formatOn (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation inputRole (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation inputExpanded (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation inputAriaAutocomplete (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A005-android-members2-rerun | Android | mutation mdSpeechResult (must fail) | 5/6 explained: mutated run must fail, the failing case proves the member is tested
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-101-ios-post-install | iOS | Text field native states (canonical, full) | 2052/2052
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-101-ios-post-install | iOS | Text field native states (canonical, members) | 28/28
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A006-android-post-install | Android | NativeTextFieldMembersTest (canonical) | 6/6
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A006-android-post-install | Android | NativeTextFieldParityTest (canonical) | 1/1
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-A006-android-post-install | Android | NativeTextFieldStatesTest (canonical) | 1/1
Android mutations for enterKeyHint, autoCapitalize, spellcheck, showPasswordLabel, hidePasswordLabel, speechLang: A002 (2 of 4 tests failed, slots baseline defect fixed since); they hold in the A005 baseline (6/6) and were not re-mutated.
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-102-install-rest | macOS | Search native paint (canonical) | 7186/7186
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-102-install-rest | macOS | Select native paint (canonical) | 1577/1577
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-103-post-install-rerun | macOS | Text field native states (canonical, run 1) | 2050/2050
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-103-post-install-rerun | macOS | Text field native states (canonical, run 2) | 2050/2050
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-103-post-install-rerun | macOS | Text field native paint (canonical) | 12700/12700
EVIDENCE | 9-8-text-field-member-tests-and-throttle-sample-103-post-install-rerun | macOS | Number field native paint (canonical) | 8815/8815

## Review Triage Log

