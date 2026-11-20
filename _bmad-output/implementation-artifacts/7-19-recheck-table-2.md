---
title: 'Gate-7 re-check: table (s7-15 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-19-recheck-table-2'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r6 · android lane a1 (emulator-5556) · simulators AWC-r6 (iPhone 26.3), AWC-r6-ipad and an iPhone on iOS 18.6'
lab: 'work/audit (your folder: work/audit/s7-19)'
depends_on: ['9-16-table-ios-sort-click-late-start-and-web-role-race']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-table (S7-15-01, S7-15-02).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folders: work/audit/s7-15 and work/audit/s7-9. Re-check the two findings on a new snapshot: Table states on iPhone 26.3 five times and on iOS 18.6 twice (every run 3862/3862), once on macOS, on iPad and on Android; tools/ax md-table three times on macOS and once on iOS and on Android (the same Web role in every capture, 0 open). The verdicts of md-table-pagination and md-table-cell and the other gate results of s7-15 stand.

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

### Coordinator note (2026-11-17 02:37 UTC: extra finding C910-01 (story 9-15))
- This re-check starts when story 9-16 is in review and the iOS shim v5 of story 9-10 is installed on canonical (the coordinator launches it then).
- One extra finding, because no other audit owns it: C910-01 (iPad: the focus system gave Tab to the first focus group; the Table states suite on the iPad failed its Tab-10 to Tab-17 focus names once the key await ended at delivery). Fixed by story 9-15 in `NativeFocusBridge.swift` (in review; DEFECTS.md line "Status 2026-11-17 (story 9-15): C910-01 ready for re-check"). Run the Table states suite on AWC-r6-ipad five times on canonical with shim v5 installed and report the failures per round; give the verdict for C910-01 in DEFECTS.md.
- `NativeFocusBridge.swift` is shared by every component with keyboard focus on iOS. Run one other iPad states suite that uses Tab (TextField or NavigationRail) once before the verdict and compare its failing checks with story 9-15 job `...-012-regress` (Button 1, TextField 6 before and after the fix).

### Coordinator note (Coordinator note 2026-11-19 07:43 UTC: what 9-16 installed; open residual and its rates; scroller pin; load gate)
What changed since the last table audit, for your re-check. Story 9-16 installed two things: the fix of the first sort click (the flip start; job 100) and the accessibility announce posted through the platform call (job 101; the first AccessibilityNotification.post with an AttributedString cost 25-37 ms inside the click turn); canonical after both: iPhone 26.3 three runs and iOS 18.6 two runs at 3862/3862 (job 102). It also made `-AppleShowScrollBars WhenScrolling` the default fixture argument of the macOS runner: with a mouse connected macOS shows legacy scrollers of 15 px and the frozen-scroll cases fail (control 033 fails, 034 and 103 pass); the always-visible scroller mode is NOT a tested configuration: record that as an open question for the user, not as a pass. Open finding to re-check with your own runs: S7-15-01 residual, a single frame at the sort click (2 of 10 runs in the A/B of 9-16, 0 of 5 on canonical, 0 of 10 in the base arm of story 9-38 behind a load gate; under the 90 percent rule the same single frame is out in every run). Story 9-38 also found that the table suite catches a product delay of 33 ms but not of 17 ms; that is the shared window, not a table defect: say so in your report. Make your iOS runs behind a load gate (1-minute load below 20) and print load1max.

### Coordinator note (Coordinator note 2026-11-19 15:09 UTC: accessibility capture and load rules; the scroller mode as a stated limit)
Two additions to the earlier note. (1) Accessibility: build AWCLivePreview in your snapshot before the accessibility job and read what was captured, not the exit code (the audit s7-22 had a job that exited 0 and captured nothing). If you reuse captures of an earlier audit, say which, and show that the sources that feed accessibility are unchanged. (2) Load: PARALLEL.md has new lines of 2026-11-19 under Load discipline (no simulator shutdown at the end of a job; a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported). The macOS runner pins the overlay scroller style since the install of story 9-16; the always-visible scroller mode is not a tested configuration unless the user decides so (question open with the user): write that sentence into the audit doc as a limit of the evidence.

### Coordinator note (Coordinator correction 2026-11-19 15:25 UTC: simulators are shut down on exit as before; the no-shutdown line of 14:10 is withdrawn)
Correction of a coordinator rule. At 14:10 UTC I wrote into PARALLEL.md (and into some notes) that a job must not shut its simulator down at the end. That was wrong: it contradicts the rule of 2026-10-31 (every job that boots a simulator shuts it down on exit; never more than one booted simulator per fork), which exists because the Mac ran out of file descriptors and had to be rebooted, and it would stall the labs that wait until no simulator is booted. The line is withdrawn in PARALLEL.md. Shut your simulator down on exit as before (trap on EXIT). If you took a shutdown line out of a job script or a lab common since 14:10, put it back before you queue the next job, and say in your report that you did. The other new line under Load discipline stays: a failing check is class 'load' only when the load in the minute around it was above 30; a run with such a miss is repeated and all numbers are reported.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 3 DONE. status done. Verdict installed (main job 7-19-recheck-table-2-100-install-audit): md-table Gate 7 (s7-19, 2026-11-19) FAIL (blocking S7-15-01 residual; S9-16-03 open). S7-15-02 closed, C910-01 closed. Pagination/cell verdicts stand.
- Evidence: macOS paint 7403/7403, states 3859/3859; iPhone states 8 runs (3829,3861,3862x5,3858 of 3862; s2 quiet-run miss = residual); iOS18 2x 3862; iPad 5 rounds (one with 5 load fails); Android 1/1,1/1,3/3; ax mac x3, ios (008), android (A003) all 0 open, Web role treegrid always.
- Findings in DEFECTS.md: S7-19-01 (tools/ax empty capture reported as pass), S7-19-02 (ax configure timeout at load), status lines for S7-15-01/02, C910-01, S9-16-03.
- Doc: work/audit/s7-19/docs/md-table-section.md (installed into docs/native-parity/audit/md-table.md).
- Limits: always-visible scroller mode not tested (open question with user); table suite catches a 33 ms product delay not 17 ms (shared window).

## Review Triage Log

