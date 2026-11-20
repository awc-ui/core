---
title: 'Gate-7 re-check: text-field, number-field, otp-field (s7-1 findings)'
type: 'chore'
created: '2026-11-15'
status: 'ready-for-dev'
story_key: '7-14-recheck-text-number-otp-fields'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r1 · android lane a5 (emulator-5564) · simulator AWC-r1'
lab: 'work/audit (your folder: work/audit/s7-14)'
depends_on: ['9-6-otp-field-live-frame-and-border-motion', '9-7-number-field-step-capture-and-extra-actions', '9-8-text-field-member-tests-and-throttle-sample']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-text-field (S71-05, S71-07), md-number-field (S71-02, S71-04, S71-05), md-otp-field (S71-01, S71-03, S71-05); S71-08 for all three.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-1 (PROGRESS.md, tools, lab probes). Re-check each finding on a new snapshot, re-run every suite the fixes touched, repeat the Laboratory probes of S71-01 and S71-02, and correct the doc counts named in S71-08; the other s7-1 gate results stand.

## Boundaries & Constraints

**Always:** Be skeptical: a claim is evidence only after you matched it to a log or re-ran it. New findings go to DEFECTS.md with evidence and a suggested fix. The rules in project-context.md apply.

**Never:** Never edit product code or tests. Never accept a `::part` exception where a typed target is implementable.

</intent-contract>

## Code Map

- `work/audit/AUDIT-PROTOCOL.md` -- your procedure
- `work/audit/DEFECTS.md` -- findings and their status lines
- `work/audit/r1`..`r6` -- earlier reviewers' scripts and probes you can reuse
- `docs/native-parity/audit/` -- verdict docs

## Tasks & Acceptance

**Execution:**
- [ ] Fresh snapshot of canonical; contract matrix per component
- [ ] Re-run: Swift paint and states (macOS), Android tests, iOS harness on iPhone 26.3 (states x3) plus one more runtime, Laboratory probes through 4177, examples compile, tools/ax
- [ ] Decide each proposed exception; record new findings in DEFECTS.md
- [ ] Write `docs/native-parity/audit/<tag>.md` and update the AUDIT.md cells through one main-queue install

**Acceptance Criteria:**
- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 02:37 UTC: scope added after this file was written (9-17, 9-18, S71-03))
- This re-check starts when stories 9-6, 9-17 and 9-18 are in review (the coordinator launches it then). Two of them were created after this file and have no audit of their own, so this re-check is their independent check:
  - 9-17, finding C66-01: on iOS the label notch of an outlined field sits on the wrong side in RTL. Check `md-text-field` and `md-number-field`, outlined, RTL, iPhone 26.3 and iOS 18.6, with the paint check that story adds.
  - 9-18, finding C96-01: the TextField and NumberField states suites kept frames of earlier phases (`samples = carried + samples.filter ...`), so a phase could pass on frames that were not its own. Story 9-6 fixed the same line in the OTP suite. Confirm that the three suites no longer carry such frames (read the code and run a mutation: a phase that draws nothing must fail), and give a verdict on every `S918-0n` finding that story records.
- Story 9-6 grew beyond its first scope: finding S71-03 (iOS key path of the OTP field: Backspace x3, Home, End, Delete at 0, paste) is part of it. Its summary says some iOS runs still need a second attempt for one frame (Tab-out RTL, type-12 on iOS 18.6) and that the suite's attempt loop absorbs them. Judge that by the audit protocol: report how often the first attempt fails over at least 5 runs per iOS version, and whether the attempt rule is the same one the other states suites use.
- iOS 18.6 is part of this re-check: use an iPhone on iOS 18.6 beside AWC-r1.

### Coordinator note (2026-11-17 06:33 UTC: one more start condition, story 9-20 (S918-01); canonical has shim v5 and keyArrivals)
- One more start condition: story `9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late` (new on 11-17). Story 9-18 is in `review` with the carry fix installed (C96-01, job 9-18-100) and left DEFECTS S918-01 open: on canonical the TextField states suite has 1 to 4 FAIL lines per run on iPhone 26.3 and on iOS 18.6 (job 9-18-009). Story 9-20 looks for the cause and fixes it. You start when 9-6, 9-17, 9-18 and 9-20 are all in `review`.
- Re-check of S918-01 with your own runs on canonical: the TextField states suite 10 times on iPhone 26.3 and 5 times on iOS 18.6, and the mutation run that story 9-20 names. One run with a FAIL line is a FAIL for md-text-field.
- Canonical changed on 11-17: iOS shim v5 (story 9-10, 02:55 UTC) and `AWCShimTouch.keyArrivals` (story 9-6, 06:07 UTC, job `9-6-201-install-otp-keyarrivals`). Take your numbers on canonical as it is when you run and say so in the record.

### Coordinator note (2026-11-18 04:53 UTC: 9-6 is in review; three points for the OTP re-check)
Story 9-6 is in review (2026-11-18, evidence check 0 hard failures, 119 evidence lines). For your re-check of md-otp-field, three points its last session left for the auditor:
- S96-01 (DEFECTS.md): on canonical iOS 26.3 the states suite gave 1369, 1370, 1370 of 1370 (job 9-6-260); the one miss is `paste-12-34-56x`, 1 of 114 frames, during a main-thread stall of about 89 ms. Job 9-6-250 measured the pasteboard reads (median 3.4 ms, max 32.8 once), so the reads are not the stall; where the 89 ms are spent is not measured. Judge it with your own runs (paste case 20 times on iPhone 26.3; how often and how long the stall is) and say whether it blocks; if the stall is inside UIKit it belongs to the cause class of story 9-23 (rule on it together with the helper of 9-23 once that is installed).
- The part-1 extra checks (six digits typed without a pause, Backspace six times, paste with a first-responder check one turn later) were not added as new fixture cases; the suite covers type-3456-complete, Backspace three times in one turn, both paste cases and ax with 0 open. Decide whether that covers the s7-1 findings S71-01, S71-03, S71-05 or whether a case is missing (then it is a finding).
- One macOS line (job 9-6-201, run 4, 1369) is marked as explained by host load 110 to 190 without a measured cause; job 9-6-212 passed 4 of 4 at 1370. Re-run macOS five times and say what you see.
This audit still waits for story 9-20 (md-text-field), which waits for the install of story 9-23.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: the 9-23 result and the rules for iOS simulator misses)
Result of the harness story 9-23 and what it means for this audit (its E report, Session 14 of its Dev Agent Record, has the numbers).
1. There is no harness helper and no change of the iOS build: the iOS simulator runs are judged as they are. Nothing from 9-23 is installed.
2. Measured on iPhone 26.3 with the text field: UIKit's own turn at a focus change takes 12-21 ms inside a main-thread block of 18-35 ms; the product learns of a tab-out 19-27 ms after the key; the first changed frame comes 41 ms after the key (26-54). The first focus of the process blocks 370-425 ms and is hidden by the repeat of the case in the text-field suite; what runs in it is to be sampled (9-23 task F). -O against -Onone changes nothing for the text field, select or autocomplete; for the table it does (story 9-16).
3. Rules for the verdict. A miss counts unless it has a proven cause that separates the failing attempts from the passing ones and that the product does not start; 'the simulator is slow' is not such a cause. Do not accept a repeat or a wider window on trust: check what it hides. Runs must print load1max; a run above 30 is a class of its own, neither for nor against; make your own runs behind a load gate (wait until the 1-minute load is below 20, at most 15 minutes, no artificial load).

### Coordinator note (Coordinator note 2026-11-19 18:59 UTC: two user decisions for this audit)
Two user decisions of 2026-11-19 apply to this audit.
(1) The iOS states comparison at the delivered input (text field and select) and the diagnostics on FAIL lines are in canonical (installed by 9-38). Cost, to be written into the audit docs as a limit: a 17 ms delay in select is no longer caught; 33 ms is caught 3 of 3.
(2) The class 'UIKit focus turn':
User decision (2026-11-19, asked in the conversation): a FAIL line of the class 'UIKit focus turn' is counted and reported, with the measurement that shows it comes from iOS, and is written into the audit as a native difference. It does not make the component FAIL.

How the class is decided (the rule is in claude-runner/PARALLEL.md, 'User decisions on classes'): per line, from the numbers on that line. The diagnostics must show that the main thread was inside UIKit's focus change (becomeFirstResponder, the keyboard task queue) for a bracket that covers the missed frame, and give the component's own share of that turn in ms. A line without that proof is not of the class and stays a finding. No list of check names is exempt, no limit is widened, nothing is retried. The audit gives: how many lines of the class in how many runs, the bracket in ms, and the lines that are NOT of the class as open findings.

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

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

