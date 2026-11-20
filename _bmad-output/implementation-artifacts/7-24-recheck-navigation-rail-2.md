---
title: 'Gate-7 re-check: navigation-rail (members test hang found by story 9-16)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-24-recheck-navigation-rail-2'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r4 · android lane a6 (emulator-5566) · simulator AWC-r4'
lab: 'work/audit (your folder: work/audit/s7-24)'
depends_on: ['9-40-navigation-rail-members-test-hangs-on-macos']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-navigation-rail (the members fixture hung in half of its macOS runs).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-18. Re-check on a new snapshot: the members fixture twenty times on macOS (every run 21/21, under 120 s), your own mutation of each of the four members (each must fail), rail states and paint once per platform, the Android rail classes once. Build AWCLivePreview in the snapshot before any accessibility job and read the capture, not the exit code. If story 9-40 changed product code, check the changed behaviour against the Web contract in the Laboratory. The other gate results of s7-18 stand.

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

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: launch; side task from 9-40; build slot)
Launch note.
1. Re-check the rail as the story says (S9-40-01: the members test, fixed in the test file by story 9-40, install job 100; canonical 3/3 at 21/21 in 12 to 13 s).
2. Build AWCLivePreview in your snapshot before every accessibility job and read the capture, not the exit code: tools/ax reports an empty capture as a pass (S7-19-01, found by audit 7-19).
3. Side task owed from story 9-40, NOT part of the rail verdict: on macOS the fixtures CardStates (169842/169853) and TransferListPaint (2386/2388) failed in one run each at load 170 to 220. Both components are PASS in the ledger. Run each fixture twice on macOS with the load rule applied (alarm long enough: they end by themselves). Report the numbers in your Handover under their own heading. If a miss shows in a quiet minute, file it in DEFECTS.md against md-card or md-transfer-list and say so; do not change those components' rows yourself.
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

### Current state
- Session 4 (s7-24) FINISHED. status done. md-navigation-rail Gate 7 PASS, dated 2026-11-20, installed by job 100-install-audit (exit 0, AUDIT.md row + docs/native-parity/audit/md-navigation-rail.md, inventory test 2/0).
- Evidence: members x20 21/21 (process 10-11 s; runs 1 and 12 wall 197/695 s = timing-slot wait only), 4 mutations fail, macOS paint 19563, states 543503, iPhone states x3 pass, iOS 18.6 542435/542435, Android paint 19416/0 x3, Laboratory probe 6/6, examples 68+68, ax read (28 files, 0 error rows).
- Side task (9-40): CardStates 174047/172055 and TransferListPaint 2388/2388 all pass, no miss, nothing filed.
- DEFECTS.md: S9-40-01 closed with the evidence. No new findings.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

