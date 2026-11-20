---
title: 'Gate-7 audit: color-picker, time-picker'
type: 'chore'
created: '2026-11-13'
status: 'ready-for-dev'
story_key: '7-3-audit-color-and-time-picker'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r3 · android lane a5 (emulator-5564) · simulator AWC-r3'
lab: 'work/audit (your folder: work/audit/s7-3)'
depends_on: ['6-2-pickers-audit-readiness']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-color-picker, md-time-picker.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts.

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

### Coordinator note (2026-11-17 02:37 UTC: extra re-check s7-11-01 (story 9-13))
- One extra re-check, because no other audit owns it: finding s7-11-01 of `md-date-picker` (Android Laboratory host test `LivePreviewDatePickerHostTest`, intermittent HTTP 400), fixed by story 9-13 (in review; DEFECTS.md line "2026-11-17 (9-13): ready for re-check"). On your Android lane run `LivePreviewDatePickerHostTest` alone 30 times and the sequence LivePreviewMenu/Tooltip/DatePickerHostTest 30 times, as job `9-13-date-picker-android-live-host-400-and-paint-default-A004-loop-after-fix` did, and run `NativeDatePickerPaintTest` once with no flags. Write the verdict for s7-11-01 into DEFECTS.md and, if it holds, into the `md-date-picker` row of AUDIT.md as a dated addition; the gate-7 verdict of `md-date-picker` itself (PASS, audit 7-11) is re-opened only if the test fails for a product reason.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: the 9-23 result and the rules for iOS simulator misses)
Result of the harness story 9-23 and what it means for this audit (its E report, Session 14 of its Dev Agent Record, has the numbers).
1. There is no harness helper and no change of the iOS build: the iOS simulator runs are judged as they are. Nothing from 9-23 is installed.
2. Measured on iPhone 26.3 with the text field: UIKit's own turn at a focus change takes 12-21 ms inside a main-thread block of 18-35 ms; the product learns of a tab-out 19-27 ms after the key; the first changed frame comes 41 ms after the key (26-54). The first focus of the process blocks 370-425 ms and is hidden by the repeat of the case in the text-field suite; what runs in it is to be sampled (9-23 task F). -O against -Onone changes nothing for the text field, select or autocomplete; for the table it does (story 9-16).
3. Rules for the verdict. A miss counts unless it has a proven cause that separates the failing attempts from the passing ones and that the product does not start; 'the simulator is slow' is not such a cause. Do not accept a repeat or a wider window on trust: check what it hides. Runs must print load1max; a run above 30 is a class of its own, neither for nor against; make your own runs behind a load gate (wait until the 1-minute load is below 20, at most 15 minutes, no artificial load).

### Coordinator note (Coordinator note 2026-11-18 22:46 UTC: this audit follows stories 9-32 and 9-33)
Order of work for this audit. It starts only when stories 9-32 (time picker on the iOS simulators: S62-01 to S62-07) and 9-33 (colour picker: S62-09, S62-10, the macOS miss of job 120) are in review and story 6-2 has had its closing session. Besides the full gate-7 work for both components: re-check every S62 finding against the fix or the class those stories give (a per-frame capture of a failing and a passing attempt must exist for each); if focusaftermode was installed, make your own run of the 100 ms key test and compare the focus and blur event order with the Web trace; make your own states runs behind the load gate (iPhone 26.3 x3, iPad x2, iOS 18.6 x2 per component) and count every miss.

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

