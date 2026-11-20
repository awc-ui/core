---
title: 'Gate-7 re-check: checkbox, menu (s7-6 findings)'
type: 'chore'
created: '2026-11-15'
status: 'ready-for-dev'
story_key: '7-21-recheck-checkbox-menu-2'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r5 · android lane a6 (emulator-5566) · simulators AWC-r5 (iPhone 26.3) and an iPhone on iOS 18.6'
lab: 'work/audit (your folder: work/audit/s7-21)'
depends_on: ['9-26-checkbox-iphone-pointer-glyph-opacity-one-sample', '9-27-menu-states-one-frame-misses-and-hook-tests']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-checkbox (S7-6-01), md-menu (+item, group, sub-menu-item) (S7-6-02, S7-6-03).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folders: work/audit/s7-6 and work/audit/r4. Re-check the three findings on a new snapshot: the checkbox states suite 20 times on iPhone 26.3, 5 times on iOS 18.6 and 5 times on macOS (every run full); the menu states suite 20 times on macOS, 20 times on iPhone 26.3 and 20 times on iOS 18.6 (every run 2524 of 2524); the 33 ms mutation of each fix story once (it must fail); the gate-1 matrix names a test for --md-menu-viewport-margin and --md-menu-section-gap on iOS and on Android; menu paint, virtual and a11y once per runtime; if a fix changed a source shared with the select family, their states suites once. Write the Mac load at the start of each run. The verdicts of md-bottom-sheet and md-side-sheet (PASS, s7-6) stand.

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

### Coordinator note (2026-11-18 11:11 UTC - coordinator: 9-26 in review; what to check for md-checkbox)
Story 9-26 (md-checkbox, S7-6-01) is in review, evidence 0 hard failures.
- Cause: the first render after checked flips drew the glyph at the end of its entrance (opacity 1.0 at web 3234, then 0.492 on the next frame), before apply() set glyphStart. Fix in NativeCheckbox.swift, installed on canonical by main-queue job 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample-006-install-fix (byte-identical to the tested tree).
- Dev numbers: before the fix 4 of 10 runs failed on iPhone 26.3; after it 20/20 (job 004-fix), iOS 18.6 5/5; the 33 ms late fade mutation fails in both runs; canonical after the install (job 007-canon): macOS states x3 pass, paint 6019/6019, iPhone 26.3 states x3 pass, live selection 38/38.
- Check on your own: the suite 20 runs per runtime as your story says; the mutation; and the components that embed the checkbox (find them with grep on NativeCheckbox in packages/native-ios/Sources: selection modes of list, table rows, menu or select options if they use it): one states run each on macOS and iPhone 26.3, to show that the changed first render did not move a sample there. There was no Android lane in 9-26: say in the audit page whether the Android checkbox has the same first-frame pattern (read the Compose source and run its states suite once).

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

