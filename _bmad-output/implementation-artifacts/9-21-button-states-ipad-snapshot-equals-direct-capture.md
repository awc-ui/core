---
title: 'Button states suite on the iPad: the check `iOS snapshot frame equals a direct capture` fails in every run (645/646)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-21-button-states-ipad-snapshot-equals-direct-capture'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane di · no Android lane · simulators AWC-di (iPhone 26.3) and AWC-di-ipad (both exist); an iPhone on iOS 18.6 for one run (create it as PARALLEL.md describes if lane di has none)'
lab: 'work/s921-lab (create it; private tree work/s921-tree = a copy of canonical; the logs of the earlier runs are in work/s910-lab/out/012 and work/s910-lab/out/033)'
depends_on: ['9-10-ios-shim-key-await-regression-and-install']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** On the iPad simulator `NativeButtonStatesIntegration` passes 645 of 646 checks in every run on record. The failing check is `iOS snapshot frame equals a direct capture (pointer-filled-sm-light-ltr rest)`: story 9-10 jobs 012 and 033 (before and after the shim change) and story 9-15 job 012 (before and after its change). The check compares the frame that the suite's snapshot path returns with a direct capture of the same view. Nobody has looked at the two images. md-button has a gate-7 PASS from an audit that ran on the iPhone, and the final integration run 8-1 will meet this failure on the iPad. Until the cause is known it is not clear whether the product draws differently on the iPad or the two capture paths differ there. A sweep under load (job 6-4-005) once showed `NativeButtonStates 644/645`; the platform is in that log.

**Approach:** Rate first: the suite three times on the iPad, three times on iPhone 26.3, once on iOS 18.6 and once on macOS, on canonical, with the failing checks by name. Then write both images of the failing check to files and compare them: how many pixels differ, where, and by how much. Check the simple causes with numbers: the scale factor and the size of the view on the iPad against the iPhone, a position that is not on a whole pixel, the time between the two captures (the rest case is the first case of the run; run it as the second case too), and whether other iOS states suites have the same self-check and pass it on the iPad. A cause in the capture path gets a fix there, with the check failing before and passing after and one run with a deliberately wrong frame that the check still catches. A cause in the product gets a product fix and a paint check that fails before it.

## Boundaries & Constraints

**Always:** After the change the Button states suite passes 646/646 three times on the iPad and three times on iPhone 26.3, once on iOS 18.6, and macOS is unchanged; the other suites that have the same self-check still pass on the iPad. The rules in project-context.md apply. The rules in project-context.md apply.

**Never:** Do not remove or weaken the check, skip the case, widen a tolerance or add a retry. Do not edit `apps/native-ios-parity/Shim/AppKitShim.swift` on canonical; if the cause is in the shim, keep the change in the private tree and report it in the open items. Do not change the Web fixtures. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/s910-lab/out/033/AWC-di-ipad-NativeButtonStatesIntegration-before.log` and `-after5.log` (the failing line and the run's console path); `work/s910-lab/reg.sh` (how story 9-10 ran the suites on the iPad)
- `NativeButtonStatesIntegration.swift`; find it and the snapshot helper with `grep -rl 'equals a direct capture' packages apps`
- the Dev Agent Record of story `9-15` (job 012-regress: Button 1 failing check before and after) and the coordinator note of 11-17 in story `9-10`
- `work/claude-runner/PARALLEL.md` (simulators per lane, timing slots); the note in story `8-1` about sweep job `6-4-005`

## Tasks & Acceptance

**Execution:**
- [x] Rate on canonical: Button states three runs on the iPad, three on iPhone 26.3, one on iOS 18.6, one on macOS; failing checks by name
- [x] Both images of the failing check written to files; the difference in numbers (count, place, size); the causes checked one by one with their numbers
- [x] The fix in the private tree; the check failing before and passing after; for a capture fix one run with a deliberately wrong frame that the check catches
- [x] Regression once on the iPad and on iPhone 26.3: ButtonFamily states and every other iOS states suite that has the same self-check
- [x] One main-queue install as an anchored patch (dry run, rollback, byte identity); the runs on canonical; a DEFECTS.md line `S921-01` with the cause and the status; refresh and confirm the checkpoint of md-button; a KNOWN-CAUSES line

**Acceptance Criteria:**
- Given canonical after the install, when the Button states suite runs three times on the iPad and three times on iPhone 26.3, then every run passes 646/646, and the record has the rate before the change
- Given the two images of the failing check before the change, when a reader opens the Dev Agent Record, then it says how many pixels differ, where, and what the cause is
- Given the changed capture path or product, when a deliberately wrong frame or the unfixed product is used, then the check fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 19:34 UTC: more stories in parallel; build slot; boot inside the timing slot)
The user asked for more stories in parallel. Up to 9 chains run from now, so the Mac is shared by more jobs. Three things for your jobs (PARALLEL.md, section 'Load discipline', paragraphs of today):
1. Every build that is a step of its own goes through `tools/slot.sh build 2 <cmd...>` (still -j 4). Take the build slot before the timing slot, never inside it. Change your lab's common script once; jobs already queued stay as they are.
2. Boot your simulator inside the timing slot, not before it. The timing pool is capped at 2 for now (tools/timing.cap); the coordinator raises it when the load record allows.
3. Class every failing check by the load of its minute from claude-runner/load/load-<UTC day>.log and repeat runs with a 'load' miss ('Load and evidence').

### Coordinator note (Coordinator note 2026-11-19 23:07 UTC: install named; conditions before it)
The chain ended at its session limit with jobs 003-fix-short (running) and 004-fix-full (queued, lane di). Read both logs fully (004 only greps 003 for 'checks passed').

Install: allowed under the name 'button states: frame capture by full-host snapshot in a clipping box (two test files)'. It is a capture-path fix as the story's Approach foresees; the shim is not touched. Conditions, all with numbers in the record:
1. 003: the failing case passes on the iPad and on iPhone 26.3.
2. 004: Button states iPad 646/646 x3, iPhone 26.3 646/646 x3, iOS 18.6 646/646; macOS 645/645 unchanged. A failing check counts as class 'load' only when the load in its minute was above 30 (read claude-runner/load/load-YYYYMMDD.log); such a run is repeated and both runs are written down. Any other failing check needs its own class before the install.
3. Button family states on the iPad and on iPhone 26.3: the count after the fix against the count on canonical before it. If the record has no canonical count for the family suite, run it once on canonical (same job, same boot) and write both.
4. The wrong-frame mutation (1 pt offset) fails the self-check on the iPad. If it passes, stop: that is a finding about the check, write it in the open items and do not install.
5. Say in the record whether the other iOS states suites take their frames the same way (resizableSnapshotView) and whether they carry the same self-check. Do not change them in this story; a suite without the self-check is an open item for the coordinator, one line.
6. From the logs only (no extra job): whether the motion samples land at the same times as before the fix (late samples or sample times, if the suite prints them). If it prints neither, say so.

Then the main-queue install as an anchored patch (dry run, rollback, byte identity against the tested files without the mutation), three iPad runs and one iPhone run on canonical, DEFECTS.md S921-01, the KNOWN-CAUSES line, the md-button checkpoint refresh, EVIDENCE lines, verify_evidence.py, status review. Hard failures of the verifier are answered by hand, each with its own true reason.

Reminders: every build step through tools/slot.sh build 2 before the timing slot; boot once per job inside the timing slot, bootstatus -b and 60 s before the first timed run; simulators shut down on exit; the timing pool is at 2.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 7. All tasks done; status review. Fix installed on canonical (110-install, byte-identical, rollback verified), canonical runs done (111-canon-runs), md-button checkpoint refreshed and confirmed (120-checkpoint, 121-confirm: current 24/24 pins), DEFECTS S921-01 and KNOWN-CAUSES line written.
- RATE BEFORE (002-rate): iPad 645, 642 (load 447), 645 of 646; iPhone 26.3 646, 644 (load), 646; iOS 18.6 646; macOS 645/645.
- CAUSE: iPad scale 2: one pixel of 300x176 differs at (48,92), alpha 193 vs 194; iPhone scale 3: 0. resizableSnapshotView re-composites an edge pixel; full-host snapshotView in a clipping box: 0 differ. Test-file fix only; shim untouched.
- Open items: none. Shim untouched; no other states suite has the self-check.
- Conditions: (1) 005 case 37/37 iPad+iPhone. (2) 006 Button iPad 646x3, iPhone 646x3, 18.6 646, macOS 645/645; no failures, no load class needed. (3) Family after fix iPad 28166, iPhone 27934; canonical before on record: iPad 28128 (1-4 012-regress-base), 26459/26295 (9-10 012), iPhone 26526/26813 (9-10 010); all pass, count varies per run on canonical too. (4) mutation fails on iPad (006). (5) Only Button states and ButtonFamily states use resizableSnapshotView/snapshotView/drawHierarchy (grep of 29 *States* test files: 1 each in these two); both carry the self-check; no other states suite has the self-check: nothing open. (6) Logs print no motion sample times or late samples (grep late/sample = 0): not measurable from logs.

EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-111-canon-runs | iOS-simulator iPad 26.3 | NativeButtonStates canonical after install (3 runs) | 646/646, 646/646, 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-111-canon-runs | iOS-simulator iPhone 26.3 | NativeButtonStates canonical after install | 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPad 26.3 | NativeButtonStates after fix (3 runs) | 646/646, 646/646, 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPhone 26.3 | NativeButtonStates after fix (3 runs) | 646/646, 646/646, 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPhone 18.6 | NativeButtonStates after fix | 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | macOS | NativeButtonStates unchanged | 645/645
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPad 26.3 | NativeButtonFamilyStates after fix | 28166/28166
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPhone 26.3 | NativeButtonFamilyStates after fix | 27934/27934
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-006-fix-full | iOS-simulator iPad 26.3 | NativeButtonStates mutation 1pt wrong frame (check must fail) | 36/37 explained: the deliberately wrong 1 pt frame must make the self-check fail

(005-fix-short: job exit 1 from its script end, case 37/37 on iPad and iPhone; superseded by the full runs of 006-fix-full, not cited) evidence-not-cited | 9-21-button-states-ipad-snapshot-equals-direct-capture-005-fix-short | iOS-simulator iPad 26.3 | NativeButtonStates case pointer-filled-sm-light-ltr (fix) | 37/37
(005-fix-short: job exit 1 from its script end, case 37/37 on iPad and iPhone; superseded by the full runs of 006-fix-full, not cited) evidence-not-cited | 9-21-button-states-ipad-snapshot-equals-direct-capture-005-fix-short | iOS-simulator iPhone 26.3 | NativeButtonStates case pointer-filled-sm-light-ltr (fix) | 37/37
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-002-rate | iOS-simulator iPad 26.3 | NativeButtonStates before fix (3 runs) | 645/646, 642/646, 645/646 explained: before the fix the snapshot self-check failed in each run (S921-01), one pixel alpha 193 vs 194
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-002-rate | iOS-simulator iPhone 26.3 | NativeButtonStates before fix (3 runs) | 646/646, 644/646, 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-002-rate | iOS-simulator iPhone 18.6 | NativeButtonStates before fix | 646/646
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-002-rate | macOS | NativeButtonStates | 645/645
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-001-diag | iOS-simulator iPad 26.3 | NativeButtonStates case pointer-filled-sm-light-ltr (diag) | 36/37 explained: diag before the fix, the snapshot self-check failed on the iPad (S921-01)
EVIDENCE | 9-21-button-states-ipad-snapshot-equals-direct-capture-001-diag | iOS-simulator iPhone 26.3 | NativeButtonStates case pointer-filled-sm-light-ltr (diag) | 37/37

## Review Triage Log

