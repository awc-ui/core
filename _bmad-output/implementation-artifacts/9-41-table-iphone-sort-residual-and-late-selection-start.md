---
title: 'md-table on the iPhone: one sort motion starts a frame late in one of eight runs (S7-15-01 residual) and the selection motion after a click starts late (S9-16-03, S9-16-04)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-41-table-iphone-sort-residual-and-late-selection-start'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d6 · no Android lane · simulators AWC-d6 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-d6-ipad'
lab: 'work/s941-lab (create it; private tree work/s941-tree = a copy of canonical made AFTER the install of story 9-38; the earlier work is in work/s916-lab and work/s916-tree (jobs 018, 020, 024, 026, 032 of story 9-16), the reviewer's runs are in work/audit/s7-19)'
depends_on: ['9-38-ios-states-checks-phase-of-the-display-grid', '9-16-table-ios-sort-click-late-start-and-web-role-race']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 re-check 7-19 left md-table at FAIL. Blocking is the residual of S7-15-01: on iPhone 26.3 the case tb-sort-ltr [3] click-dessert misses the order motion (38/44 frames) in one of eight runs, in a quiet minute; base and fix of story 9-16 share it (18/22 each), and a -O build shows it less often (2 of 1010 checks against 9 of 1010). Open beside it are S9-16-03 and S9-16-04: case tb-pagination-rtl [0] select-row-0, check motion selected:pg1-0, the native value stays 0.00 at +33 and +50 ms where the Web value is 0.33 and 0.62 (one run in about a hundred in the loop of job 024, seen again in two reviewer runs at load above 100). Both are a native motion that starts late after a pointer click on the iPhone. Story 9-38 measured that the iOS harness delivers a pointer or a key 0 to 22 ms after the time the test plans for it, and that the comparison held this delay against the component; on 2026-11-19 the user agreed to compare at the delivered input for text field and select. The table test still compares at the planned time. The reviewer also found that the table states suite passes when a motion starts 17 ms late.

**Approach:** First class the misses with the diagnostics of story 9-38 (they are in canonical after its install). Run the table states suite on iPhone 26.3 until each of the two cases has missed three times (at most 60 runs for the sort case, at most 300 loops of the single pagination case; load rule of PARALLEL.md) and read on every FAIL line the delivery delay of the click, the stall bracket and the class. Then one of three ways. (a) The delivery delay explains the misses, that is, the miss disappears when the Web samples are timed against the delivered click: build the arm that compares at the delivered input in the table test, as story 9-38 did for text field and select, and run pairs of base against arm (ten pairs on iPhone 26.3, five on iOS 18.6, five on iPad), the +33 ms mutation of the sort motion and of the selection motion (each must fail three of three) and the +17 ms mutation (report what it does). This arm changes what the canonical test measures: this story does NOT install it; end with status blocked and the pair table, and the coordinator asks the user. (b) A stall inside UIKit or the render server covers the missed frame: name the call from a sample of the missing turn and say whether the product can avoid it; the class UIKit focus turn applies only with its proof on the line. (c) The product starts the motion late, by work of our own between the click and the first motion write: fix it in the product, with pairs and mutations as above. For the 17 ms finding say which window lets a 17 ms delay pass and whether a check of the crossing offset, as story 9-31 added to the list suite, catches it without failing unmodified runs (twenty runs).

## Boundaries & Constraints

**Always:** Every miss of the two cases has a class with its numbers. For way (a) the pair table and both mutation results exist and the story is blocked for the user's answer. For way (b) or (c) the fix or the documented class is in the tree and the table states suite passes five times on iPhone 26.3, three times on iOS 18.6 and three times on iPad with every remaining miss classed. The rules in project-context.md apply.

**Never:** Do not widen a limit, do not retry, do not list a check as a known gap. Do not pass a time from the test into the product (the motion clock at the delivered input inside the product is a closed question). Do not install a change of what the test measures without the coordinator's note that names it. Regression before any install (table paint and states once on macOS; states on iPhone 26.3, iOS 18.6 and iPad); no install while a regression difference has no class. Every build step through tools/slot.sh build 2, every timing run through tools/slot.sh timing 4, the simulator booted inside the timing slot. Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build; a new diagnostic gets a short trial job first. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- `packages/native-ios/Tests/NativeTableStatesIntegration.swift` and the table sources under `packages/native-ios/Sources/AWCUI`
- the Dev Agent Record of story `9-38` (comparison at the delivered input, diagnostics on FAIL lines, its paragraph in PARALLEL.md after the install) and of story `9-16` (jobs 018, 020, 024, 026, 032)
- `work/audit/DEFECTS.md` (S7-15-01 with its status lines, S9-16-03, S9-16-04), `work/audit/s7-19`, `claude-runner/KNOWN-CAUSES.md`, `claude-runner/PARALLEL.md` (Load discipline, User decisions on classes)

## Tasks & Acceptance

**Execution:**
- [ ] The class of each miss: three misses of the sort case and three of the pagination case with the diagnostics on the FAIL lines and the load of the minute next to each
- [ ] The way chosen (a, b or c) with its proof; pairs and the two mutations
- [ ] The 17 ms finding: the window that lets it pass; a crossing-offset check tried on twenty unmodified runs
- [ ] Way (a): status blocked with the pair table for the coordinator. Ways (b) and (c): one main-queue install (dry run, backup, byte identity), the suite three times per runtime on canonical, DEFECTS.md entries `ready for re-check`, a KNOWN-CAUSES.md row, the md-table checkpoint refreshed

**Acceptance Criteria:**
- Given the diagnostics of story 9-38, when the two cases miss, then every FAIL line carries the delivery delay, the stall bracket and a class
- Given the chosen way, when base and arm run in pairs, then the table shows the misses of each arm per runtime and the +33 ms mutation fails three of three in the arm
- Given the record, when a reader asks why the sort motion started late in one of eight runs, then it names the cause with numbers and says whether the test, the system or the product is at fault
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-19 20:39 UTC: start with the class from existing runs)
Start note. Begin with the class 'one frame, rare' (note above), before the diagnostics way of the story text:
1. S7-15-01 residual (tb-sort-ltr [3] click-dessert order motion): from the runs that exist (audit 7-19: 8 iPhone runs, 2 on iOS 18.6, 5 on iPad; story 9-16: jobs 018, 020, 032) make the table: k of n per runtime, and the shifted comparison from the logged samples of every missing run. If no +33 ms mutation of the sort motion on an iOS simulator exists, queue one (3 runs; it must fail 3 of 3). If the class holds: DEFECTS.md 'closed as one frame, rare', the line into md-table.md by one docs install named 'audit docs: one-frame-rare lines of md-table (docs only)', then status review; audit 7-25 follows.
2. S9-16-03 and S9-16-04 (selection motion starts two to three frames late, about one run in a hundred) are NOT covered by the class (more than one frame). For these only, the ways (a), (b), (c) of the story text apply, after the install of story 9-38. If they do not show in 100 loops on canonical after that install, say so with the count and leave them open as 'not reproduced after 9-38'.
3. The 17 ms finding stays as written.
Do not make your private tree before the 9-38 install has landed (its paragraph in PARALLEL.md); step 1 needs logs only.

### Coordinator note (Coordinator note 2026-11-19 20:42 UTC: do not wait for 9-38; mutation and runs now; way (a) closed for the table)
Decision after session 1 (class table from logs: tb-sort-ltr [3] on iPhone 26.3 fails in 4 of 55 runs and passes with a one-frame shift; tb-sort-rtl [3] on iPhone and 4 of 5 tb-contract [0] misses the same).

1. Do NOT wait for the 9-38 install any longer. It changes the text-field and select tests and the shim's FAIL-line diagnostics, not the table suite; audit 7-25 runs the full set on the canonical tree of its day anyway. Make work/s941-tree from canonical now.
2. Queue what the class still lacks: the +33 ms mutation of the table sort motion, 3 runs on an iPhone simulator (all must fail); 6 more runs on iOS 18.6 and 4 more on iPad of the table states suite, to reach 10 each. Boot once per job, inside the timing slot; class failing checks by the load of their minute.
3. If the class holds for tb-sort-ltr [3], tb-sort-rtl [3] on iPhone and tb-contract [0]: write the DEFECTS.md lines ('closed as one frame, rare (user decision 2026-11-19)', with k of n and the shifted comparison) and the md-table.md lines by ONE main-queue docs install named 'audit docs: one-frame-rare lines of md-table (docs only)'.
4. Not covered, so still owed here: (a) tb-sort-rtl [3] on iPad (input to t0 96 ms, 6 to 7 bad frames when shifted): say what the 96 ms are (one sample of that turn; our own work in ms; UIKit work in ms) and how often in 10 runs; (b) tb-contract [0] fix-run6 (5 bad frames when shifted): how often in how many runs, and what differs in that run; (c) S9-16-03 and S9-16-04: 100 loops of tb-pagination-rtl [0] select-row-0 on canonical, count and class.
5. Way (a) of the story text is CLOSED for the table: in job 9-38-008-mut33 the arm that compares at the delivered input passed the +33 ms mutation of the table suite 3 of 3, so it has no sensitivity there. Do not build it.
6. The 17 ms finding stays as written. Then verify_evidence and status review if only documented or classed lines remain; otherwise blocked with the list.

### Coordinator note (Coordinator note 2026-11-20 07:01 UTC: slot.sh was not executable 06:52-06:59 UTC (and 02:47-02:50); runs in those windows have no result)
Coordinator fault, and what it means for your runs. tools/slot.sh was not executable in two windows today: from 02:47:30 to about 02:50 UTC and from 06:52:18 to 06:59:36 UTC (I swapped the script in from the device mount and the new file had no exec bit; restored by job 927, and the swap procedure now sets the mode). A run in those windows that called tools/slot.sh directly ended at once with 'Permission denied' (exit 126) and has NO result. An empty log is not a pass and not 'mutation not detected': count nothing from such a run, and repeat it. Find them with: grep -l 'slot.sh: Permission denied' in your lab's run logs. Calling it as 'bash tools/slot.sh' or directly both work again.

Yours (you found it yourself, thank you): out004 u13 to u20 and m17c-1 to 3 have no result; job 005 repeats them. Two more points for the rest of the story. (1) A lost click or a lost rowclick event is never rule (e) and is not closed by a docs install: tb-hover-select-ltr [7] on iOS 18.6 and the lost click in select-row-0 (2 of 100) need a class from a cause. Story 9-38 installed diagnostics on the FAIL lines of the table test at 05:01 UTC (PARALLEL.md says how to read them): run the pagination loop and the hover-select case on canonical as it is now until each lost click is caught at least twice, and say from the line whether the touch reached the view (then the product lost it: a product finding) or did not (then the harness or UIKit dropped it: say which, with the proof). (2) The docs-only install 'audit docs: one-frame-rare lines of md-table (docs only)' may carry only lines that meet all four numbers of rule (e), counted per check; the lines you list as uncovered stay open in DEFECTS.md with their numbers. Then review; audit 7-25 follows.

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

## Dev Agent Record

### Current state
- Session 7 (this run's session 1). Tree work/s941-tree, lab work/s941-lab. Jobs 001-005 DONE (005-xoff2 exit 0).
- DONE: class from 75 iPhone runs: tb-sort-ltr [3] 7/75, tb-sort-rtl [3] 4/75, all pass shifted by 16.7 ms (1 bad frame); +33 mut 3/3 (001-mut33); iOS 18.6 0/10, iPad runs 10. 17 ms finding done (below).
- 17 ms finding: +17 ms mutation passes the table suite unmodified (m17-1..3: 0 fails; 3 runs, 98 log lines each); the +-33 ms probe window plus the 90 percent frame rule absorb it. Crossing-offset check does NOT work: natural order offsets over 20 unmodified runs are 14.4..147.7 ms, mutation 32.8..150.6 ms; limit 17 fails unmodified runs on every order key and the mutation 3/3 (m17c-1..3, 50-55 fails each). Not a usable check.
- DONE: main job 006-install-docs exit 0 ("installed": DEFECTS.md status line under S7-15-01 + md-table.md section; backups .bak-941-*). Covers tb-sort-ltr [3], tb-sort-rtl [3] iPhone only.
- Unmodified 20 runs (u1..u20): misses u1,u9 sort-rtl [3]; u14,u17,u20 sort-ltr [3]; u20 tb-contract [0] (5 bad frames shifted, not covered).
- NOT covered (open, in DEFECTS): tb-contract [0] (2 runs 5 bad frames shifted), tb-sort-rtl [3] iPad 96 ms, tb-hover-select-ltr [7] lost rowclick iOS 18.6, lost click select-row-0 (2/100), late selection motion (1/100), click-prev phase shot (8/100).
- IN FLIGHT (queue-d6): 007-pgloop-canon (iPhone, tb-pagination-rtl, up to 150 loops, stops at 2 lost clicks; tree s941-tree-c = s941-tree + canonical test and shim with 9-38 diagnostics) and 008-hover-ios18 (iOS 18.6, tb-hover-select-ltr, up to 40 runs). Results: out007-pgloop-canon/summary.txt, out008-hover-ios18/summary.txt (FAIL lines carry [DG gap d ph brk n]). Next: read them, class each lost click (touch reached the view = product finding; else harness/UIKit with proof), append DEFECTS lines, KNOWN-CAUSES rows (slot.sh exec bit; crossing check not usable), EVIDENCE lines, verify_evidence.py, then review or blocked with the open list.

### Class table (existing runs, iPhone 26.3 unless named; case, check, k of n, shifted comparison)
Runs counted on iPhone 26.3: 9-16 job 018 (20), 020 (24), 032 (3), 7-19 jobs 003+007 (8) = 55 runs; the fixed tree (base-less: 018 fix, 020 fix, 032, 7-19 canonical) = 33 runs.
Shifted comparison = the test's own check (web value inside min/max of the native probe at -33..+33 ms, tolerance 0.2, 90 percent of frames) recomputed from the logged DIAG samples with the native clock shifted by 16.7 ms earlier (first 14 Web frames, where all misses lie).
| check | k of n (all 55 / fixed tree 33) | at shift 0 bad frames | at shift -16.7 | verdict |
|---|---|---|---|---|
| tb-sort-ltr [3] click-dessert order:n0.1.1 | 4/55 (7%) / 4/33 (12%): 020 fix run7, 032 run1, 032 run2, 7-19 s2 | 5-7 | 1 (the Web frame at 16 ms, 4.00 spike, in every run) | passes shifted; rate under 1 in 5 |
| tb-sort-rtl [3] click-dessert order:n0.1.0/.1.1 (iPhone) | 2/55: 020 base run1, 032 run2 | 5-9 | 1-2 | passes shifted |
| tb-contract [0] click-calories-default-desc order:n0.1.1.0 | 5/55: 020 base run1, base run10, fix run6, fix run7, 7-19 s8 (+ canon run2) | 7-8 | 1, but fix run6 has 5 (input to t0 79 ms) | 4 of 5 pass shifted; fix run6 is larger than one frame |
| tb-sort-rtl [3] click-dessert (iPad) | 1/6 (7-19 s3; sort-ltr 0/6) | 7-8 | 6-7 | NOT covered: input to t0 96 ms, more than one frame |
| tb-pagination-rtl [0] select-row-0 selected:pg1-0 (S9-16-03/04 family) | 2/24 in job 020 (fix run4, base run9) | 12 | 12 at -17 and +17 | NOT covered: native motion misses 2-3 frames |
| tb-hover-select-rtl [5],[6] head checkbox (7-19 s1, load 600) | 1/8 | 10-12 | 10-12 | not covered; load class (load1max 608) |
Native input to t0 on the sort misses: 47, 49, 52, 67, 68 ms (the native motion is about one frame behind the compared time; Web holds 100 ms before the curve, native starts one frame late).
iOS 18.6: 0 sort misses in 4 runs (7-19 s1 s2, 032 run1 run2): n under 10, runs missing. iPad sort-ltr [3]: 0/6.
Mutation: no +33 ms mutation of the TABLE sort motion exists. Job 9-38 008-mut33 mutated the compare time in the table test at the proto arm and 3 of 3 proto runs passed (0 fails), base 1 run showed the natural tb-sort-ltr miss; that cannot be used as the class proof (finding: the delivered-input arm of 9-38 does not see +33 ms in the table suite, and the story text way (a) would need that arm to fail 3 of 3).
Result: size and rate hold for tb-sort-ltr [3] on iPhone 26.3 at 4/55 (12 percent of the fixed tree); sensitivity (3) and iOS 18.6 / iPad run counts (2) are missing, so the class is not yet closed and DEFECTS.md / md-table.md are not changed.

EVIDENCE | 7-19-recheck-table-2-003-ios-iphone-ios18 | iphone | NativeTableStatesIntegration s2 | 3861/3862
EVIDENCE | 7-19-recheck-table-2-007-ios-iphone-repeat | iphone | NativeTableStatesIntegration s8 | 3858/3862
EVIDENCE | 7-19-recheck-table-2-004-ios-ipad | ipad | NativeTableStatesIntegration s3 | 3857/3862
EVIDENCE | 9-16-table-ios-sort-click-late-start-and-web-role-race-032-ann-regress | iphone | NativeTableStatesIntegration run2 | 3859/3862
EVIDENCE | 9-38-ios-states-checks-phase-of-the-display-grid-008-mut33 | iphone | NativeTableStatesIntegration mut33-tb-proto-1 | 207/207

EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-001-mut33 | iphone | NativeTableStatesIntegration mut33-tb-1..3 (3 fails of 3, tb-sort-ltr [3]) | 3/3
EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-002-runs | ios18 | NativeTableStatesIntegration run1-6 (5 runs without fail line) | 5/6
EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-002-runs | ipad | NativeTableStatesIntegration run1-4 (3 runs without fail line) | 3/4

EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-003-pgloop | iphone | NativeTableStatesIntegration pagination loop r1-r100 (select-row-0: 97 clean, 2 lost click, 1 late motion) | 97/100

EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-005-xoff2 | iphone | NativeTableStatesIntegration m17-1..3 (+17 ms mutation, no limit: 0 fails, not detected) | 0/3
EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-005-xoff2 | iphone | NativeTableStatesIntegration m17c-1..3 (+17 ms mutation, crossing limit 17: fails) | 3/3
EVIDENCE | 9-41-table-iphone-sort-residual-and-late-selection-start-005-xoff2 | iphone | NativeTableStatesIntegration u13-u20 (unmodified, runs without fail line) | 5/8

## Review Triage Log
