---
title: 'Gate-7 re-check: switch (test sensitivity finding of story 9-31)'
type: 'chore'
created: '2026-11-15'
status: 'in-progress'
story_key: '7-23-recheck-switch'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r3 · android lane a5 (emulator-5564) · simulators AWC-r3 and AWC-r3-18'
lab: 'work/audit (your folder: work/audit/s7-23)'
depends_on: ['9-39-switch-states-suite-passes-a-33ms-delay']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-switch (the finding that its states suite passed a 33 ms delay).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Re-check the finding on a new snapshot: your own mutation runs of 17, 33 and 50 ms on the switch states suite (three each on macOS; 33 ms must fail every run), the unmutated suite ten times on macOS and three times on iPhone 26.3 and twice on iOS 18.6 behind a load gate (1-minute load below 20, load1max printed), switch paint once per platform, the Android switch classes once. Compare the check added by story 9-39 with the one in the list suite (early limit -34 ms, late limit 17 ms) and say whether a miss it shows on the product is a product finding. The other gate results of md-switch from its last audit stand unless a run contradicts them.

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

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- (session 3, s7-23, lane r3 / a5, sims AWC-r3, AWC-r3-18; folder work/audit/s7-23, tree work/audit/s7-23-tree)
- DONE (matched to done/ logs): 001 snapshot+builds, paint macOS 10447/10447; 002 mutations macOS +17/+33/+50 ms FAIL 3/3 each (33 ms: 28 crossfails, max offset 34.2-34.5 vs +17); 003 unmutated x10 macOS all pass (31.6k-33k checks, offsets max 9.7-10.2, gate loads <20); A001 android 17 tests 0 failures, paint 10447, states 26285.
- DONE 004-ios26: paint26 10447/10447; states x3 pass 16870/16768/16792, CROSS 74 measured; iOS check is print-only, offsets max 21.2/20.3/24.6 > 17 -> filed S723-01 (non-blocking test-sensitivity) in DEFECTS.md.
- IN FLIGHT: r3 queue: 005-ios18 (running), 006-lab-ax (queued). a5 queue: A004-ax-android (waits for 006), A005-examples-kotlin (waits for examples from 006). A002/A003 failed only because 006 had not run (exit 3).
- NEXT: when 005, 006, A004, A005 done: read logs (tail/grep), add iOS18 result to S723-01, write docs/native-parity/audit/md-switch.md + AUDIT.md cell via main-queue job queue/s7-23-100-install-audit-switch.sh (anchored edit, pre-image check), set status done. Verdict leaning: md-switch PASS (macOS/Android sensitive, S723-01 non-blocking) unless 005/006/A004 contradict.
- Compare 9-39 check vs list suite: identical limits (early -34, late +17, level 0.04, unmeasurable counted when Chrome gap >34 ms); both enforced macOS-only in effect for switch; list enforces on iOS (hence S931 fails).

## Review Triage Log

