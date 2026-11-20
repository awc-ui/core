---
title: 'Final integration run on canonical'
type: 'chore'
created: '2026-11-13'
status: 'ready-for-dev'
story_key: '8-1-final-integration-run'
epic: 8
model: 'sonnet'
wave: 5
lanes: 'mac lane fx · android lane a1 (emulator-5556) · simulator AWC-fx'
lab: 'work/fx-lab (integrate-*.sh), work/n3-lab/hyg'
depends_on: ['7-9-recheck-charts-orgchart-table']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** After all fix stories land, canonical needs one full integration run (i6) to prove nothing regressed across components.

**Approach:** Snapshot canonical and run every suite as i5 did; route each regression to a new story proposal.

## Boundaries & Constraints

**Always:** Record results in work/claude-runner/INTEGRATION.md. A failure that passes in isolation is still listed with its cause. The rules in project-context.md apply.

**Never:** Do not fix product code here; propose stories.

</intent-contract>

## Code Map

- `work/fx-lab/integrate-snapshot.sh`, `integrate-swift.sh`, `integrate-android.sh`
- `work/claude-runner/INTEGRATION.md` -- i1..i5
- `tools/checkpoint-refresh.py`

## Tasks & Acceptance

**Execution:**
- [ ] Snapshot; Studio, compiler, all Swift fixtures, scripts, live hosts, Web spec and e2e for touched tags, Android device and unit suites
- [ ] Isolated reruns for every failure; classify each
- [ ] checkpoint-refresh report for all components; list stale ones
- [ ] Write the i6 row and a list of proposed follow-up stories in this file

**Acceptance Criteria:**
- Given canonical after all installs, when i6 runs, then every suite's result and every failure's cause is recorded

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 02:37 UTC: points collected by the coordinator for the final run)
- Start: this story starts only when every gate-7 audit and re-check has its verdict (7-2, 7-3, 7-6, 7-12, 7-14, 7-17, 7-18, 7-19 are still to run on this date), not after 7-9 alone as `depends_on` says. The coordinator launches it then.
- Stories with no audit of their own; this run is their independent check: 2-2 (TimelineView tick-skip, remaining sites), 4-1 (r5 post-install verification), 6-5 (macOS harness: key-window loss), 9-10 (iOS key shim v5). For each one name in the i6 row the suites whose results prove it, with the counts. A failure that belongs to one of them is a finding.
- Checkpoints: `md-button-group` and `md-toolbar` were recorded stale after later installs. Refresh and report them.
- Timeouts seen in sweep `6-4-005` under sweep load: MenuStates, ButtonFamilyStates, ChartPaint (rc=142), and NativeButtonStates 644/645. Run these four alone at normal load and classify.
- Android `datePickerMatchesChromePaintAndGeometry` failed also in job n4-A042 (story 9-13 made the year-scroll default a decision, Decision 9); confirm the default run passes.
- Search states 764/766 at load 387 in job `9-4-...-024-mac-regression`: repeat at normal load (also a point for audit 7-17).
- `test-preview-presentation` exited 1 in an earlier run: run it and classify.
- tools/ax: 4 Web `controls` relation findings of `md-stepper` were open; story 9-11 left reviewer notes in its Handover. Read both and state whether each is closed.
- Story 9-10 has 49 EVIDENCE lines whose counts are comparisons, not passes; check that its final evidence check has no hard failure once it is in review.
- Runner: lane n2 started a job a second time 2 s after it had exited 0 (jobs n2-020, n2-055, 6-6-043). Look at `runner-lane.sh` for the cause; if it is a race on the rename into `running/`, propose the fix in this file, do not change the runner while other jobs run.
- Files to list for clean-up in your report (do not delete them; the coordinator asks the user): `implementation-artifacts/5-3-stepper-landmark-and-wrapper-parts.md.add`, `implementation-artifacts/7-7-recheck-button-family.md.tmp`, leftover `.sh.tmp` files in `claude-runner/queue-a3` (3) and `queue-n3` (1), stray Swift copies in `work/n2-lab/out/s66-048/stray/`, and the private trees and labs of finished stories (`work/s*-tree`, `work/s*-lab`).
- For story 8-2 (ledger): the AUDIT.md rows of `md-fab`, `md-icon-button` and `md-split-button` still carry the words "final audit pending" although their gate-7 verdict is written; every DEFECTS.md line that says "ready for re-check" must end with the verdict of the audit that re-checked it.

### Coordinator note (2026-11-17 06:36 UTC: independent check for story 9-21 and for the evidence record of 9-10)
- Two fix stories were added on 11-17 that no gate-7 re-check covers; you are their independent check: `9-21-button-states-ipad-snapshot-equals-direct-capture` (Button states on the iPad, 645/646 in every run before it; re-run the suite three times on the iPad and three times on iPhone 26.3 on canonical) and the evidence record of `9-10` (coordinator note of 11-17 in that story: 49 flagged comparison lines stay unmarked; list them in your report and say for each suite which story's later run on canonical supersedes it).
- Clean-up list, one more item: `claude-runner/queue/9-10-ios-shim-key-await-regression-and-install-100-install.sh.hold`.

### Coordinator note (2026-11-18 05:59 UTC: S7-18-01 and the rule for one-check intermittents; test-preview-presentation; fresh ax captures)
Three items from the re-checks of 2026-11-18 for this final run:
- One-check intermittents on iPhone 26.3 were judged differently by two audits: S7-6-02 (md-menu, 3 of 6 runs) is blocking, S7-18-01 (md-navigation-rail, 1 failed check in 3 of 11 whole-suite runs: two 'native frames cover the samples' checks, one at load 431, and one 'focus t+66 tab2' sample) is non-blocking with the reading 'likely frame-capture gaps under load'. That reading has no run that proves it. In this final run, after the install of story 9-23: NativeNavigationRailStatesIntegration five times on iPhone 26.3 through `slot.sh timing`, with the load at the start and the end of each run. Every run complete = S7-18-01 closed. A miss at ordinary load = a blocking finding for md-navigation-rail (the PASS of s7-18 is reopened), unless the miss lies inside a bracketed UIKit interval of story 9-23 and its helper covers it. Apply the same rule to every states suite on iPhone 26.3 in this run: a suite that misses at ordinary load without a proven harness cause cannot keep its PASS.
- `apps/native-ios-playground/scripts/test-preview-presentation.mjs` exits 1 on canonical at the date-picker commit click (story 9-28 owns it). Run it three times here; exit 0 and every block run is required. If 9-28 changed a component source, re-run that component's suites once.
- md-dialog Android ax: 0 open on a fresh capture (job 9-24-005-dialog-ax); the 7 open in the s7-12 compare run were a stale capture. Use fresh captures for every ax comparison in this run.

### Coordinator note (2026-11-18 11:11 UTC - coordinator: stray backup files in the canonical tree)
Tree hygiene before the final audit: list files in the canonical tree that an install job left behind (find with the names *.bak*, *.orig, *.rej outside node_modules and build folders) and say for each whether it is needed. Known on 2026-11-18: apps/native-ios-parity/Shim/AppKitShim.swift.orig (left by an earlier shim install; not compiled). The backup NativeCheckbox.swift.bak926 of the 9-26 install was moved by the coordinator from packages/native-ios/Sources/AWCUI to work/s926-lab on 2026-11-18. Install jobs must keep their backups in the story's lab folder, not next to the source.

### Coordinator note (2026-11-18 11:34 UTC - coordinator: 9-28 in review; Laboratory date-picker preview check)
From story 9-28 (review): apps/native-ios-playground/scripts/test-preview-presentation.mjs failed in the md-date-picker block because the block created the picker at the 240 px default capture height, where the dialog is clipped and the fixed click points fall outside the frame (test defect; script fixed and installed, 3/3 on canonical; KNOWN-CAUSES row 36, DEFECTS S928-01). The Web recipe comparison was not run in 9-28. Check in the final run: (1) the script x3 exit 0 on canonical; (2) in the Laboratory itself (probe through a main-queue job, not on port 4177 from a test), the md-date-picker dialog at the Laboratory's own preview size is fully visible and can be committed, and looks as the Web recipe does: the 240 px clipping must be a property of the old test only, not of the Laboratory preview.

### Coordinator note (Coordinator note 2026-11-18 21:24 UTC: the 9-23 result and the rules for iOS simulator misses)
Result of the harness story 9-23 and what it means for this audit (its E report, Session 14 of its Dev Agent Record, has the numbers).
1. There is no harness helper and no change of the iOS build: the iOS simulator runs are judged as they are. Nothing from 9-23 is installed.
2. Measured on iPhone 26.3 with the text field: UIKit's own turn at a focus change takes 12-21 ms inside a main-thread block of 18-35 ms; the product learns of a tab-out 19-27 ms after the key; the first changed frame comes 41 ms after the key (26-54). The first focus of the process blocks 370-425 ms and is hidden by the repeat of the case in the text-field suite; what runs in it is to be sampled (9-23 task F). -O against -Onone changes nothing for the text field, select or autocomplete; for the table it does (story 9-16).
3. Rules for the verdict. A miss counts unless it has a proven cause that separates the failing attempts from the passing ones and that the product does not start; 'the simulator is slow' is not such a cause. Do not accept a repeat or a wider window on trust: check what it hides. Runs must print load1max; a run above 30 is a class of its own, neither for nor against; make your own runs behind a load gate (wait until the 1-minute load is below 20, at most 15 minutes, no artificial load).

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

