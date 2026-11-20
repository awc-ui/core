---
title: 'Gate-7 audit: search'
type: 'chore'
created: '2026-11-15'
status: 'in-progress'
story_key: '7-17-audit-search'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r1 · android lane a3 (emulator-5560) · simulator AWC-r1'
lab: 'work/audit (your folder: work/audit/s7-17)'
depends_on: ['1-2-md-search-finish-and-install', '1-4-ipad-focus-entry-shared']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-search.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Split from 7-11, which covers md-transfer-list and md-date-picker.

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

### Coordinator note (2026-11-17 08:49 UTC: also waits for story 9-22; gap rule sensitivity; exception record)
- You start when story 1-2 and story `9-22-search-press-block-first-frame-after-focus` are both in `review` and the md-search batch is installed. 9-22 has no other audit: re-check its claims with your own runs (strict counts, three runs each on macOS, iPhone 26.3, iPad 26.3 and iOS 18.6; the two key checks; the 34 ms mutation run).
- The states suite of md-search uses the gap rule of the md-text-field suite since 11-17 (no PENDING branch). Story 1-2 measured that it catches a delay of 34 ms and not of 17 ms (job 076). Rule on whether that sensitivity is enough for a PASS, and say so in the verdict.
- If story 9-22 leaves an exception record (main-thread block of UIKit at the focus change): rule on it from its measurements; an exception without the distribution of the block and the numbers of each failing check is not acceptable.

### Coordinator note (2026-11-18 13:33 UTC coordinator: two points from story 1-2 to judge)
From story 1-2 (2026-11-18), to judge here: (a) the outside-click focus restore on iOS has a native-only 50 ms delay (Web has no such line; Chrome restores focus 733 ms after mdClose, 1-2 job 064). The stated reason: without it UIKit takes focus away in the turn of the click (4 of 20 misses at 0 ms, 1 of 20 at 50 ms; the remaining miss has main-thread blocks of 14 to 40 ms in the click turn, 1-2 job 112). Check that the delay is written in the documented native differences and run the outside-click loop yourself (20 runs on iPhone 26.3). (b) macOS leading-back-closes: 1-2 classed its 1-in-3 miss as a click that holds the main thread 49 to 50 ms (jobs 105, 109); repeat x10.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: the 9-23 result and the rules for iOS simulator misses)
Result of the harness story 9-23 and what it means for this audit (its E report, Session 14 of its Dev Agent Record, has the numbers).
1. There is no harness helper and no change of the iOS build: the iOS simulator runs are judged as they are. Nothing from 9-23 is installed.
2. Measured on iPhone 26.3 with the text field: UIKit's own turn at a focus change takes 12-21 ms inside a main-thread block of 18-35 ms; the product learns of a tab-out 19-27 ms after the key; the first changed frame comes 41 ms after the key (26-54). The first focus of the process blocks 370-425 ms and is hidden by the repeat of the case in the text-field suite; what runs in it is to be sampled (9-23 task F). -O against -Onone changes nothing for the text field, select or autocomplete; for the table it does (story 9-16).
3. Rules for the verdict. A miss counts unless it has a proven cause that separates the failing attempts from the passing ones and that the product does not start; 'the simulator is slow' is not such a cause. Do not accept a repeat or a wider window on trust: check what it hides. Runs must print load1max; a run above 30 is a class of its own, neither for nor against; make your own runs behind a load gate (wait until the 1-minute load is below 20, at most 15 minutes, no artificial load).

### Coordinator note (Coordinator note 2026-11-19 18:59 UTC: the user allows the release build for Search states evidence on macOS)
User decision (2026-11-19, asked in the conversation): YES, the Search states evidence on macOS may be taken on the release build (766/766 x3, jobs 155 to 157), with the debug result (764/766) written next to it in the audit. This holds for Search on macOS only; it is not a general rule for timing suites (table A showed no general gain). Task B2 (iOS 18.6 docked: the 50 ms between the focus callback and the open state write) stays as written.

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

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator note 2026-11-20 09:21 UTC: relaunch; answers to the three rulings (release build is user decision (d); B2 counted as it is; sensitivity by mutation))
Relaunch. Answers to the rulings you list as needed, so that the verdict does not wait for me:
1. Release-build evidence: decided by the user on 2026-11-19 (PARALLEL.md, 'User decisions on classes', item (d)): the Search states evidence on macOS may be taken on the release build, with the debug result written next to it. Search on macOS only. A macOS FAIL line that remains in your own release runs counts; macOS is never rule (e).
2. B2 (iOS 18.6, docked click-bar-focus; S1-2-B2) and the Escape-closes line are open findings of story 1-2 and are being worked in story 9-43 (sampling the 60 ms hole). Count them as they are in your own runs; do not wait for 9-43 and do not class them yourself beyond what your FAIL lines prove.
3. Gap sensitivity and the 50 ms delay: judge the suite by mutation, as the protocol says: your own +33 ms (or 34 ms) mutation of the open and of the close must fail 3 of 3 on macOS and on one iOS simulator, with a line that proves the delayed code ran in the app that was measured. A mutation that passes is a finding about the test (blocking for gate 5 of the platform it passes on), as it was for the switch.
4. Rule (e) per check and per runtime, from your own 10 runs per iOS runtime in quiet minutes (last line of the load record: load below 30 and boot=0). A check that repeats in both runs of a pair, like fullscreen-icon-trigger click-icon-opens 5/166, is outside it unless your ten runs say otherwise.
5. iOS jobs hold the timing slot once, from boot to shutdown, under about 40 minutes (PARALLEL.md, 08:12): split the ten runs into two jobs. Runs between 06:52:18 and 06:59:36 UTC that called tools/slot.sh directly have no result.
Write the verdict with every open finding listed with its numbers and a suggested fix; a re-check audit and fix stories follow from your findings.

## Dev Agent Record

### Current state
- Session 4 (2026-11-20 09:21 UTC): nothing queued by me. Reviewer s7-17, lane r1, a3, sim AWC-r1(+pad,-18). Work dir work/audit/s7-17, snapshot s7-17-tree.
- DONE Android (job s7-17-A001-android exit 0): paint 7050/7050, states 766/766; LivePreviewSearchHostTest exit 0 (count not read).
- DONE macOS job s7-17-001-snapshot-macos exit 0: paint-rel 7186/7186; states dbg 763/766; rel 765,764,764 /766. FAILS: fullscreen-contained click-bar-opens 1/172 (rel x3, dbg), docked-contained-ltr click-bar-focus 2/100, fullscreen-divided reduced click-bar-opens 3/166 (dbg), docked-clear-loading click-bar 1/76 (rel2). macOS: not coverable by rule e; need load class + ruling.
- PARTIAL s7-17-002-ios-iphone (log done/s7-17-002-ios-iphone.log, still running at 09:20 UTC, 3rd run probably): paint 7186/7186; states run1 759/766, run2 759/766 (7 FAILs each, motion 1-5 frames, e.g. fullscreen-icon-trigger click-icon-opens 5/166 in both runs, docked click-bar-focus 2/100, Escape-closes 1-3 frames).
- IN FLIGHT lane r1 serial: 002 then queued 003-ios-ios18, 004-ios-ipad, 005-lab-ax, 006-examples-swift.
- Next: grep SUMMARY/FAIL in claude-runner/done/s7-17-00*.log; contract matrix; class FAILs (claude-runner/load/load-<day>.log, rule e table; note icon-trigger 5/166 is >1 frame-class suspicious); extra jobs (outside-click x20 iPhone, leading-back-closes x10 macOS, 9-22 checks x3/runtime + 34 ms mutation, B2 x10, kotlin examples, ax android); docs/native-parity/audit/md-search.md; DEFECTS.md; one main-queue install for AUDIT.md.
- Still to rule: gap-rule sensitivity (34 caught/17 not), 50 ms outside-click delay documented, B2, release-build macOS evidence.

## Review Triage Log

