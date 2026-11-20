---
title: 'Gate-7 audit: select, multi-select, autocomplete'
type: 'chore'
created: '2026-11-13'
status: 'ready-for-dev'
story_key: '7-2-audit-select-family-autocomplete'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r2 · android lane a4 (emulator-5562) · simulator AWC-r2'
lab: 'work/audit (your folder: work/audit/s7-2)'
depends_on: ['6-1-select-family-finish']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-select (+md-select-option), md-multi-select, md-autocomplete.

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

### Coordinator note (2026-11-17 02:37 UTC: scope added after this file was written (6-6, 6-7, 9-17, 9-19))
- This audit starts when stories 6-1, 9-17 and 9-19 are in review (the coordinator launches it then). Besides story 6-1, the select family was changed by stories 6-6 (iOS timing, installed through the second install of 6-1), 6-7 (accessibility and autocomplete), 9-17 and 9-19. None of these has an audit of its own: this audit is their independent check.
- Findings to give a verdict on, each by its own run, all in `work/audit/DEFECTS.md`: S66-18-01, S66-18-02, S66-18-03 (iOS 18.6 residuals of select and multi-select), C66-01 (iOS RTL outlined field: the label notch on the wrong side; check select, multi-select and autocomplete, outlined, RTL, iPhone 26.3 and iOS 18.6), C66-02 (iOS: a click on the clear button lost now and then), C66-03 (macOS reduced-pointer pick lost now and then). For the two intermittent ones run the case at least 20 times and report the count.
- iOS 18.6 is part of this audit: use an iPhone on iOS 18.6 beside AWC-r2 (create it as PARALLEL.md describes if it does not exist).

### Coordinator note (2026-11-18 13:13 UTC coordinator: start after 6-1 and 9-29; what to re-run)
Start condition changed: this audit starts when stories 6-1 and 9-29 are in review. Story 9-19 fixed the lost clear click C66-02 (fix 3 in NativeInspection.swift, installed by its job 130); the rest moved to story 9-29.
What the audit will meet, by DEFECTS id: S61-IOS-01, S66-18-01, S66-18-02, S66-18-03, S919-01, S919-02, and C66-03 (not reproduced: 0 lost in 100 macOS runs before, 50 of 50 after).
Run your own: select, multi and autocomplete states x3 on iPhone 26.3 and x2 on iOS 18.6; the clear loop 50 times on iPhone 26.3 (0 lost); the macOS pick loop 50 times; the macOS select-all loop 50 times.
A class that story 9-29 names harness cost is judged by the coordinator decision written after story 9-23; it will be a later note here. Without that note such a miss counts as a miss.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: the 9-23 result and the rules for iOS simulator misses)
Result of the harness story 9-23 and what it means for this audit (its E report, Session 14 of its Dev Agent Record, has the numbers).
1. There is no harness helper and no change of the iOS build: the iOS simulator runs are judged as they are. Nothing from 9-23 is installed.
2. Measured on iPhone 26.3 with the text field: UIKit's own turn at a focus change takes 12-21 ms inside a main-thread block of 18-35 ms; the product learns of a tab-out 19-27 ms after the key; the first changed frame comes 41 ms after the key (26-54). The first focus of the process blocks 370-425 ms and is hidden by the repeat of the case in the text-field suite; what runs in it is to be sampled (9-23 task F). -O against -Onone changes nothing for the text field, select or autocomplete; for the table it does (story 9-16).
3. Rules for the verdict. A miss counts unless it has a proven cause that separates the failing attempts from the passing ones and that the product does not start; 'the simulator is slow' is not such a cause. Do not accept a repeat or a wider window on trust: check what it hides. Runs must print load1max; a run above 30 is a class of its own, neither for nor against; make your own runs behind a load gate (wait until the 1-minute load is below 20, at most 15 minutes, no artificial load).

### Coordinator note (Coordinator note 2026-11-19 00:16 UTC: this audit follows stories 9-34, 9-35 and 9-36)
Order of work for this audit. It starts only when stories 9-34 (autocomplete caret clock), 9-35 (flat-pixels check, shot time) and 9-36 (single-frame misses after a key or click opens the menu) are in review and stories 9-29, 9-19 and 6-1 have had their closing sessions. Besides the full gate-7 work for md-select, md-multi-select and md-autocomplete: re-check each of those three fixes with your own runs behind the load gate (autocomplete states macOS x5 and iPhone 26.3 x5; the select keyboard subset x10 on iPhone 26.3 and iOS 18.6; ltr and rtl select-all x10 per runtime), repeat the 33 ms caret mutation and the +17, -17 and +33 ms flat-pixels shifts yourself, and count every miss.

### Coordinator note (Coordinator note 2026-11-19 20:38 UTC: user decision 'one frame, rare'; class from existing runs first)
NEW USER DECISION (2026-11-19, 20:35 UTC), to make the work faster: the class 'one frame, rare' on the iOS simulators. The full rule is in claude-runner/PARALLEL.md, 'User decisions on classes', item (e). Read it before anything else. In short: a FAIL line on an iOS simulator does not count against the component when all four are shown with numbers: (1) the check passes with the native samples shifted by at most one frame (16.7 ms); (2) the same check fails in at most 1 of 5 runs on that runtime over at least 10 runs, every run counted; (3) a +33 ms mutation of the same motion fails 3 of 3 on an iOS simulator on the same tree; (4) the audit doc and DEFECTS.md carry the numbers. Not covered: more than 1 of 5 runs, more than one frame, a lost click or event, a wrong end state, paint at rest, macOS, Android. Tests are not changed, no limit is widened, nothing is retried, counts are reported as they are.

What it means for this story or audit:
- First class what your existing runs already show. Make one table: check, runtime, k of n runs, the shifted comparison, the mutation job. Queue new runs only for what the table lacks (a missing shifted comparison can usually be computed from logged samples; a missing mutation is one short job).
- Stop looking for the cause of a miss that the class covers. Keep looking only for what it does not cover, and say in your summary which lines those are.
- A fix that is ready and clean in its regression is still installed, under the name the coordinator gave it.
- An audit gives PASS when every remaining FAIL line is of a decided class with its proof (this one, or 'UIKit focus turn') and nothing else is open; the audit doc lists every such line with its numbers.

### Coordinator note (Coordinator note 2026-11-19 20:52 UTC: the class is decided by your own runs; 9-29's closure is provisional)
For this audit, on the class 'one frame, rare' (PARALLEL.md item (e), with the addition of 2026-11-19 about proof, counting and who decides).
- Story 9-29 wrote two select lines as 'closed as one frame, rare' (iPhone 26.3, select-keyboard-ltr arrowdown-open t=83 and select-keyboard-rtl arrowdown-open t=49). Its rate (4 of 30 and 5 of 30) is pooled over three jobs with diagnostic hooks or experiment arms, one of them at 4 of 10. That closure is provisional. YOU decide from your own runs: at least 10 runs per iOS runtime of the select, multi-select and autocomplete states suites on your snapshot, a rate per check, and the per-frame shift proof for every failing line. A check above 1 of 5 is open again.
- Story 9-38 installs the comparison at the delivered input for the select test. Take your snapshot after that install; the keyboard-open misses were 0 of 10 runs in that arm, so the two lines may not show at all.
- Lines no class covers stay findings: reduced-motion enter opacity t=33 on iPhone (10 of 20), the iOS 18.6 select misses (9-36), the autocomplete caret (9-34), the select-all flat pixels (9-35).

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

