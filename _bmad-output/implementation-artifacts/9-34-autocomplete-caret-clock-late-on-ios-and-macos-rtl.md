---
title: 'md-autocomplete: the caret rotation starts late on the iOS simulators; the patch that starts it at the open write fails ac-multiple-rtl click-open on macOS'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and the iOS 18.6 simulator of lane n2 (both exist; story 9-29 used them)'
lab: 'work/s934-lab (create it; private tree work/s934-tree = a copy of canonical; the lab of story 9-29 is work/s929-lab with ac-since-patch.py, the patched copy NativeAutocomplete.swift.with-since-patch, the run scripts ac-since-run.sh and the out folders of jobs 078, 079, 110, 130 and 140)'
depends_on: ['9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** On the iOS simulators the caret of md-autocomplete starts its 200 ms rotation late: before any change 0 of 10 runs of `NativeAutocompleteStatesIntegration` are clean on iPhone 26.3 (caret checks type-a, ac-multiple-ltr click-open, enter caret at t=66). Story 9-29 found the cause: `AWCSelectCaret` in `NativeAutocomplete.swift` gets no start time, so the rotation starts at the SwiftUI onChange after the options render, while md-select passes `rt.openWriteAt`. The patch that passes `rt.openWriteAt` gives 1472, 1472, 1472, 1471, 1472 of 1472 on iPhone 26.3 (job 078) and 1471 and 1472 on iOS 18.6 (job 079). On macOS the same patch fails ac-multiple-rtl click-open caret at t=199 in 4 of 5 runs (jobs 110 and 140; 1472 of 1472 in every run before the patch) and passes when debug logging is on (job 130, 2 of 2). The trace of job 130: rtl and ltr click-open each show one open write and a caret start 15 to 18 ms later, stamped at the write time. The patch was installed once before its macOS regression and rolled back; canonical `NativeAutocomplete.swift` has md5 929438ff again. The 33 ms mutation of job 140 was a no-op, so no mutation result exists. Open single frames with the patch: job 078 run 4 (reduced escape opacity t=33) and job 079 run 1 (ac-multiple-ltr click-open motion t=149); they belong to story 9-36.

**Approach:** First say what the Web does. From the Web traces of ac-multiple-rtl click-open, ac-multiple-ltr click-open and a select click-open: the time from the click to the first changed caret frame and the caret series up to t=216. The Web caret is a transition that starts at the first frame after the open state flips. Then print the native caret series around t=150 to 216 for rtl and ltr on macOS, with and without the patch, three runs each; printing must not change timing (collect into a buffer and print after the case: job 130 passed only with logging on). Say what the native start time has to be so that macOS and iOS both match: the write time, the first frame after the write, or the lead that NativeSelect uses; and say why rtl at t=199 differs from ltr. Make the patch from that, with a short trial job first. Prove it with a real mutation: the caret start delayed by 33 ms must fail in every run on macOS and on iPhone 26.3.

## Boundaries & Constraints

**Always:** With the reworked patch in the private tree: autocomplete states on macOS five times with 0 caret misses, on iPhone 26.3 five times and on iOS 18.6 twice with no caret miss; select and multi-select states once on macOS and iPhone 26.3 unchanged; the 33 ms mutation fails in every run. Then one install and the same counts on canonical. The rules in project-context.md apply.

**Never:** Regression before the install, never the other way round. No platform switch in the product without a measured reason written into the record. Do not widen a tolerance or add a retry. Leave no logging in the product code. Do not touch the flat-pixels check (story 9-35) or the select keyboard misses (story 9-36). Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- the Dev Agent Record of story `9-29` (caret sections; jobs 078, 079, 100, 110, 120-rollback, 130, 140) and `work/s929-lab`
- `packages/native-ios/Sources/AWCUI/NativeAutocomplete.swift` (AWCSelectCaret call, setOpen), `NativeSelect.swift` (how the caret gets its start time) and `packages/native-ios/Tests/NativeAutocompleteStatesIntegration.swift`
- `work/audit/DEFECTS.md` (the caret finding of 9-29), `work/claude-runner/KNOWN-CAUSES.md` (rows 25 and 26: caret clock at openWriteAt)

## Tasks & Acceptance

**Execution:**
- [ ] The Web timeline of the caret for the three click-open cases; the native series on macOS, rtl and ltr, with and without the patch (buffered prints)
- [ ] The reworked patch in the private tree; short trial; the reason for the chosen start time in the record
- [ ] A real 33 ms mutation of the caret start: it fails in every run of three on macOS and on iPhone 26.3
- [ ] Regression in the private tree: autocomplete states macOS x5, iPhone 26.3 x5, iOS 18.6 x2; select and multi-select states once on macOS and iPhone 26.3; autocomplete paint once
- [ ] One main-queue install (dry run, backup in the lab, byte identity); canonical autocomplete states macOS x3 and iPhone 26.3 x3; DEFECTS.md status line; KNOWN-CAUSES.md row; refresh and confirm the md-autocomplete checkpoint

**Acceptance Criteria:**
- Given the reworked patch, when autocomplete states run five times on macOS, then no run has a caret miss, and five runs on iPhone 26.3 and two on iOS 18.6 have none either
- Given a build whose caret start is delayed by 33 ms, when the suite runs three times on macOS and on iPhone 26.3, then every run fails a caret check
- Given the record, when a reader asks why rtl failed at t=199 with the first patch, then it gives the measured reason
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 15:23 UTC: added finding: autocomplete keyboard typing fails on a macOS release build (typed keys land differently))
Added finding for this story, from story 1-2 job 162 (macOS, every fixture on a release build). NativeAutocompleteStatesIntegration fails 48 checks on a release build where debug passes 1472/1472, at a load of 9: in ac-keyboard-ltr the typed keys land differently (input text 'daap' against 'ap'; rows [] against [Apple, Apricot]; surface, live status and open follow from that), plus type-a motion 7/48 frames and ac-multiple-rtl click-open caret at t=166. Release is what users run, so this is a finding to explain: is it the product (the order of key handling on an optimized build: a race between the key handler and a state write, an await that resumes earlier) or the test (a harness step that exists only under DEBUG, a timing assumption)? Per-fixture logs: work/n3-lab/search2/out/1-2-162. How a release build of a fixture is made: the job script claude-runner/done/1-2-md-search-finish-and-install-162-macrel-all-full.sh.
Do it after the caret clock: three release runs of ac-keyboard-ltr to reproduce; print the key events as the product receives them (key, time, input text after each) on release and on debug; name the cause. A product cause is fixed in the private tree with pairs on both builds. No change to canonical build scripts. The DEFECTS.md entry is filed by story 1-2; add your status lines under it.
Also new today: PARALLEL.md, Load discipline (no simulator shutdown at the end of a job; a failing check is class 'load' only when the load in the minute around it was above 30).

### Coordinator note (Coordinator correction 2026-11-19 15:25 UTC: simulators are shut down on exit as before; the no-shutdown line of 14:10 is withdrawn)
Correction of a coordinator rule. At 14:10 UTC I wrote into PARALLEL.md (and into some notes) that a job must not shut its simulator down at the end. That was wrong: it contradicts the rule of 2026-10-31 (every job that boots a simulator shuts it down on exit; never more than one booted simulator per fork), which exists because the Mac ran out of file descriptors and had to be rebooted, and it would stall the labs that wait until no simulator is booted. The line is withdrawn in PARALLEL.md. Shut your simulator down on exit as before (trap on EXIT). If you took a shutdown line out of a job script or a lab common since 14:10, put it back before you queue the next job, and say in your report that you did. The other new line under Load discipline stays: a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported.

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-20 04:55 UTC: install 009 is provisional; the macOS mutation result must be explained; the iPhone click-open caret stays in this story; the platform switch needs the recordings compared, then one rule and the comparison at the delivered input)
Job 009 has installed the 'plat' patch (canonical NativeAutocomplete.swift md5 fc05d21a, byte identical to the tree). I read the record. The install went in before two of this story's own Always lines were met and with a platform switch whose written reason does not hold as it stands. I do not roll it back now (macOS is 1472/1472 x5 with it and behaves as p17 did there), but it is PROVISIONAL: write that word into the DEFECTS.md line of this story, and the story does not go to review before the three points below are answered. From now on the install task needs every Always line met, or a coordinator note.

1. The 33 ms mutation on macOS. With p17 it failed 3 of 3 (job 003: 1471, 1469, 1470 of 1472). With plat, whose macOS arm is the same lead of one frame, it passes 3 of 3 (job 007). Two builds with the same macOS behaviour cannot differ like that: show the mutated line of job 007 and which platform arm it sits in, and a proof that the delayed code ran on macOS. Then repeat: it must fail 3 of 3. 'Not discriminating, recorded' is not an answer; a mutation run that passes is a finding about the test, or about the job, until it is explained.

2. iPhone 26.3, ac-multiple-ltr click-open caret t=183, 3 of 5 runs with plat at loads of 15 to 48 (native [0.000, 0.69] against web 0.73). This is the caret this story is about; it is not handed to 9-36 (9-36 is the select keyboard open). It stays here, open, until it has a class.

3. The platform switch. The record says 'Web starts the caret one frame after the write on macOS, at the write on iOS'. Chrome is one browser: say whether the iOS and the macOS fixtures of this suite are different recordings, and give for click-open, from each recording, the time of the open write and of the first caret frame that moved. If the recordings agree, the difference between the platforms is not in the Web. It is then in the test's clock on iOS: the delivery delay of 0 to 22 ms that story 9-38 measured (part (a)), which makes native look late on iOS and makes a product without the frame look right there. In that case the iOS arm (lead 0) is a compensation for the harness inside the product, and the product must have one rule, the Web's.
Trial for that case, private tree only: product p17 on every platform, and the autocomplete states test compared at the delivered input the way work/s938-tree does it for select (take the method from its test files; do not touch the shim). Runs: iPhone 26.3 x5, iOS 18.6 x2, the 33 ms mutation x3 on iPhone, macOS x3. If point 2 goes away and the mutation fails 3 of 3, that is the answer, and the second install is named now: 'autocomplete: caret one frame after the open write on every platform (product)'. Its test half (the comparison at the delivered input in the autocomplete test file) is a change of the test method in a further file: it waits for my note after I have asked the user. If the trial does not clear point 2, report the table (arm, runtime, k of n, offset from the time stamp, offset from the delivered input) and end with the words coordinator decision.

4. Meanwhile, as planned: canonical autocomplete states x3 on macOS and x3 on iPhone 26.3 with the provisional install, EVIDENCE lines, the checkpoint; the release-build ac-keyboard-ltr finding (note of 15:23); verify_evidence by hand. Build steps through tools/slot.sh build 2; boot once per job inside the timing slot (the slot is first come, first served since 02:47 UTC; PARALLEL.md, paragraph of 02:50). You may use the one opus session for point 3.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator decision 2026-11-20 09:33 UTC: the lead does not move the iPhone click-open miss; product goes to p17 on every platform after one pair job; the click-open hole is an offset to find (A delivered input, B our work, C focus turn))
Decision on the iPhone click-open caret and on the product arm.

1. What your table says. The t=183 miss on iPhone 26.3 by arm: p0 1 of 5, plat 3 of 5, p8 2 of 5, p17 6 of 10. plat on iOS IS p0 (lead 0), and they give 1 of 5 and 3 of 5: so these numbers are noise around a rate of roughly a half, and the lead (0, 8 or 17 ms) does not move this miss. The caret lead is not its cause. So the platform switch that install 009 put into canonical has no measured reason on iOS, and one Web recording serves both platforms (the caret starts 33.3 ms after mdOpen in it). The product rule is therefore the single one, p17 on every platform.

2. Second install, product only: 'autocomplete: caret one frame after the open write on every platform (product)'. It replaces plat. Before it, one pair job on iPhone 26.3 in quiet minutes: plat and p17 alternating, ten runs each (two jobs of five pairs; an iOS job holds the timing slot from boot to shutdown), counted per check (ltr click-open t=183, rtl click-open t=166, type-a, enter caret). Install p17 unless p17 is worse than plat on one check by four runs of ten or more. If it is that much worse, do not install: that would be a measured platform difference with one Web recording, which can only be the test's clock on iOS; write the table and end with the words coordinator decision. In hand for p17 already: macOS x5 1472/1472 and the +33 ms mutation 3 of 3 (job 003), iPhone mutation 3 of 3 (job 014), iOS 18.6 x2. Still needed with p17: select and multi-select states once on macOS and once on iPhone 26.3 (the story's Always line). After the install: canonical x3 on macOS and x3 on iPhone 26.3, the DEFECTS line without the word PROVISIONAL, the checkpoint.

3. The iPhone click-open caret itself (about half of the runs; native samples [0.000, 0.69] against web 0.73: no native sample between the start and 0.69) stays in this story as an offset to find, apart from the lead. Its shape is a hole in the native frames right after the click, as in the search (S1-2-B2), not a late clock. From ten launches of the ltr click-open case alone, failing and passing: the times and values of every native caret sample from the click to t=250, the time the touch reached the view (the delivered input, as the select test measures it since the 9-38 install), the open write, the first frame after it, and one main-thread sample of the hole in a failing launch (what runs there: the mount of the menu surface, a layout of ours, or UIKit's focus work). Then one of: (A) measured from the delivered input the caret is inside the window: the miss is the test's delivery delay; the comparison at the delivered input in the autocomplete test is a test-method change that waits for the user; write the numbers. (B) our own work fills the hole: a product finding with the stack share; fix it here if it is small and proven by pairs, else write it for a follow-up. (C) UIKit's focus turn with no frame of ours: the user decision 'UIKit focus turn' with the bracket as proof on the line. You may use the one opus session for this point.

4. Say in one paragraph what job 011 and job 003 mutate (which motion, which file), since one failed 3 of 3 on macOS and the other 1 of 3: if the type-a caret series can be 33 ms late and pass two runs of three on macOS, that is a test-sensitivity finding of its own (write it into DEFECTS.md as open; a stricter check is a follow-up story, not this one).

5. The 18 verify_evidence hard failures by hand, each with its own reason; the release-build ac-keyboard-ltr finding of the 15:23 note. Then review.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Newest Handover note = coordinator decision 2026-11-20 09:33 UTC: product goes to p17 on every platform unless p17 is worse than plat on one check by 4 runs of 10; point 3 (iPhone click-open hole, A/B/C) and points 4, 5 remain.
- In canonical: install 009 (plat, md5 fc05d21a) PROVISIONAL. In hand for p17: macOS x5 1472/1472 + m33 3/3 (job 003), iPhone m33 3/3 (014), iOS 18.6 x2; still needed with p17: select + multi-select states once on macOS (003 has them: 1030/1030, 871/872) and once on iPhone 26.3.
- In flight (session 2026-11-20 09:35 UTC): jobs 020 (build plat+p17 into .build-plat/.build-p17, 5 alternating pairs iPhone 26.3, one held slot), 021 (5 more pairs, reuses builds), 022 (macOS: m33 vs m33plat side by side on ac-keyboard-ltr x3 each, prints mutated line = coordinator point 1). Scripts: s934-lab/pair-body.sh, queue-n2 jobs. Outputs s934-lab/out/020-plat, 020-p17, 021-*, 022.
- Point 1 observation (not yet a reason): 007 m33plat binary differs from plat binary; the mutation sits in shared AWCSelectCaret (NativeSelect.swift), identical for both arms; job 022 decides.
- Next: read the logs (grep SUMMARY, FAIL), count per check (ltr click-open t=183, rtl click-open t=166, type-a, enter caret) per arm over 10 pairs; if p17 not worse by >=4 of 10 on any check -> install p17 (main queue, anchored edit of NativeAutocomplete.swift, byte identity with tree), then canonical x3 macOS + x3 iPhone, DEFECTS line without PROVISIONAL, checkpoint-refresh.
- Then point 3 (not started: ten ltr click-open launches with native caret samples to t=250, delivered-input time, open write, first frame, one main-thread sample), point 4 (paragraph on jobs 003/011 mutations), point 5 (18 verify_evidence failures by hand; release-build ac-keyboard-ltr finding), verify_evidence.py.

### Session 1 notes (2026-11-20)
- Web recording (outputs/native-parity/md-autocomplete/web-oracle/web-states.json, one Mac Chrome 153 recording, used by iOS and macOS fixtures alike): ac-multiple-ltr click-open mdOpen t=400.1, caret transform anim startTime 433.4 (+33.3), first moved caret frame 466.7 (+66.6); ac-multiple-rtl mdOpen 416.8, caret start 450.1 (+33.3), first moved 483.4 (+66.6); ac-keyboard-ltr type-a mdOpen 733.2, caret start 749.9 (+16.7), first sample 783.2 already moved (0.29). Label anim of click-open starts at the mdOpen time (400.0). So: Web caret starts 2 frames after mdOpen on click-open and 1 frame after on type-a; the recording is the same for both platforms.
- HYPOTHESIS (not yet measured as a reason), rtl failed with the write-time patch (p0) on macOS: see job 001/005 lines (first native sample after the click, rtl mdOpen is 16.7 ms later than ltr in the Web, so the envelope at t=199 has no room for an earlier start).

_Evidence_
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-003-mac-regress-m33 | macos | NativeAutocompleteStatesIntegration p17 x5 | 1472/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-003-mac-regress-m33 | macos | NativeSelectStatesIntegration p17 | 1030/1030
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-002-ios-p17-m33 | ios26.3 | NativeAutocompleteStatesIntegration m33 mutation run 1 (fails caret) | 1463/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-001-mac-series | macos | NativeAutocompleteStatesIntegration p17 caret start (normal motion only, AWC_AC_REDUCED=0) | 736/736
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-001-mac-series | macos | NativeAutocompleteStatesIntegration ac-multiple-rtl click-open series base x3 | 122/122
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-001-mac-series | macos | NativeAutocompleteStatesIntegration ac-multiple-rtl click-open series p0 x3 | 122/122 (explained: load 80-340, first sample after the click, check cannot discriminate)
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-002-ios-p17-m33 | ios26.3 | NativeAutocompleteStatesIntegration p17 run 1 | 1444/1451 (explained: load 400-800, class load, to be repeated)

EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-003-mac-regress-m33 | macos | NativeAutocompleteStatesIntegration m33 mutation x3 (each fails a caret check) | 1471/1472, 1469/1472, 1470/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-003-mac-regress-m33 | macos | NativeAutocompletePaintIntegration p17 | 511/511
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-003-mac-regress-m33 | macos | NativeMultiSelectStatesIntegration p17 | 871/872 (flat pixels check of story 9-35, not caret)
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-004-ios-p17-repeat-p8 | ios26.3 | NativeAutocompleteStatesIntegration p17 repeat x5 (caret miss ltr t=183 in run 1 only, load 85) | 1469/1472, 1471, 1470, 1470, 1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-004-ios-p17-repeat-p8 | ios26.3 | NativeAutocompleteStatesIntegration p8 x5 (caret miss ltr t=183 in runs 2 and 5) | 1470/1472, 1469, 1471, 1469, 1468
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-004-ios-p17-repeat-p8 | ios18.6 | NativeAutocompleteStatesIntegration p8 x2 (no caret miss) | 1470/1472, 1470

EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-005-mac-p0-regress | macos | NativeAutocompleteStatesIntegration p0 x5 (rtl click-open caret miss in 4 of 5, loads 6-28) | 1471/1472, 1470, 1471, 1471, 1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-005-mac-p0-regress | macos | NativeSelectStatesIntegration p0 | 1030/1030
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-005-mac-p0-regress | macos | NativeMultiSelectStatesIntegration p0 | 872/872
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-006-ios-p0-m33p0 | ios26.3 | NativeAutocompleteStatesIntegration p0 x5 (caret miss ltr t=183 run 1 only, load 178) | 1469/1472, 1472, 1472, 1471, 1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-006-ios-p0-m33p0 | ios18.6 | NativeAutocompleteStatesIntegration p0 x2 | 1471/1472, 1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-006-ios-p0-m33p0 | ios26.3 | NativeAutocompleteStatesIntegration m33p0 mutation x3 (each fails caret) | 1465/1472 x3
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-007-mac-plat | macos | NativeAutocompleteStatesIntegration plat x5 | 1472/1472 x5
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-007-mac-plat | macos | NativeSelectStatesIntegration plat | 1030/1030
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-007-mac-plat | macos | NativeAutocompletePaintIntegration plat | 511/511
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-007-mac-plat | macos | NativeMultiSelectStatesIntegration plat (flat pixels, story 9-35) | 871/872
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-007-mac-plat | macos | NativeAutocompleteStatesIntegration m33plat mutation x3 (not discriminating, no caret miss) | 1472/1472 x3
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-008-ios-plat | ios26.3 | NativeAutocompleteStatesIntegration plat x5 (ac-multiple-ltr click-open caret t=183 in runs 1,3,4: stale first sample, story 9-36) | 1470/1472, 1472/1472, 1467/1472, 1467/1472, 1471/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-008-ios-plat | ios18.6 | NativeAutocompleteStatesIntegration plat x2 (no caret miss) | 1470/1472, 1470/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-008-ios-plat | ios26.3 | NativeAutocompleteStatesIntegration m33plat mutation x3 (each fails caret checks) | 1467/1472, 1466/1472, 1465/1472

EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-013-canon-inst-regress | macos | NativeAutocompleteStatesIntegration canonical plat x3 (run 2 one miss, load 31) | 1472/1472, 1471/1472, 1472/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-013-canon-inst-regress | ios26.3 | NativeAutocompleteStatesIntegration canonical plat x3 (caret misses ltr t=183 run 1, rtl t=166 run 2) | 1469/1472, 1469/1472, 1471/1472

EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-014-ios-p17-trial | ios26.3 | NativeAutocompleteStatesIntegration p17 x10 (ltr click-open caret t=183 in 6 of 10, rtl t=166 in 3 of 10) | 1468/1472, 1472, 1469, 1469, 1468, 1469, 1470, 1469, 1472, 1469
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-014-ios-p17-trial | ios18.6 | NativeAutocompleteStatesIntegration p17 x2 (one caret miss type-a t=149) | 1470/1472, 1471/1472
EVIDENCE | 9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl-014-ios-p17-trial | ios26.3 | NativeAutocompleteStatesIntegration m33 mutation x3 (each fails caret) | 1467/1472, 1468/1472, 1466/1472

## Review Triage Log

