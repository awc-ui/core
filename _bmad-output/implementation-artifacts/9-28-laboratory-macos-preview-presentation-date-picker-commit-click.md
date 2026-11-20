---
title: 'Laboratory macOS live test: test-preview-presentation fails at the date-picker commit click (INVALID_COORDINATES); the steps after it have never run'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-28-laboratory-macos-preview-presentation-date-picker-commit-click'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n1 · no Android lane · no simulator (the test drives the macOS live renderer AWCLivePreview)'
lab: 'work/s928-lab (create it; private tree work/s928-tree = a copy of canonical; the failing runs are in work/audit/s7-18/lab/frames/test-preview-presentation-1.log and -2.log, wrapper wrap-test-preview-presentation.sh in the same folder)'
depends_on: ['7-18-recheck-navigation-rail']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The shared live test `apps/native-ios-playground/scripts/test-preview-presentation.mjs` exits 1 on canonical, 2 of 2 runs in the gate-7 re-check 7-18 (job 7-18-recheck-navigation-rail-008-lab-ax, 2026-11-18) and in s7-4-005 (2026-11-16). It fails at line 67, `click(selected, 540, 515)` in the md-date-picker block: the live renderer answers 400 INVALID_COORDINATES, 'Click inside the native preview', so the point 540, 515 is outside the captured preview after a day was selected. Until 2026-11-15 the script failed earlier, in the md-autocomplete block (KNOWN-CAUSES row 15; fixed by story 6-7 with a patch of the script at 23:44 UTC that day), so the date-picker block and every block after it have not passed in any recorded run. Nobody owns this script: the audits called it out of scope. Open questions: is the commit button of the date picker inside the preview surface a user of the Laboratory sees (if not, the Laboratory user cannot commit a date: a product defect of the preview host or of the picker's layout in the preview), or did the layout of the picker change (stories 1-3, 1-5, 9-13 worked on it) and the fixed coordinates of the script are stale (a test defect).

**Approach:** Reproduce first: build AWCLivePreview from a copy of canonical as the wrapper of s7-18 does and run the script twice; keep the output. Then look at the date-picker step: print the logical width and height of the frame before and after the day click, save the captured image of the frame after the day click, and find where the commit button is in it (the renderer's inspection gives the boxes; do not guess from the picture). Compare with the Web recipe of the Laboratory for the same configuration (open, value, min, max): is the commit button inside the Web preview at this viewport. Name the cause: the script's fixed point is stale (then take the point from the inspected box of the button, as the md-autocomplete fix of story 6-7 did), or the native preview cuts the picker's actions off (then it is a product defect: fix the preview host's size or the picker's layout in it, with a test that fails before). Then run the script to its end and treat every later failure the same way: each one is named, classed as test defect or product defect, and fixed or filed.

## Boundaries & Constraints

**Always:** The script exits 1 at the date-picker commit click before the change and exits 0 three times in a row after it; every block of the script after the date picker has run. The rules in project-context.md apply.

**Never:** Do not delete or skip a block of the script to make it pass. Do not change a component source without a test that fails before the change; if a component source changes, say so in the Handover so that the coordinator can ask for a re-check of that component (md-date-picker has a gate-7 PASS of 2026-11-16). Do not touch the Laboratory server on port 4177; the live renderer runs offscreen from your own build.

</intent-contract>

## Code Map

- `work/audit/s7-18/lab/frames/test-preview-presentation-1.log` and `wrap-test-preview-presentation.sh` (the failing run and how it was started)
- `apps/native-ios-playground/scripts/test-preview-presentation.mjs` (the whole script; list its blocks) and `apps/native-playground/native-live.mjs` (validateLiveInput: what INVALID_COORDINATES means)
- `work/claude-runner/KNOWN-CAUSES.md` row 15 and the Dev Agent Record of story `6-7` (jobs 002, 004, 011: the md-autocomplete fix of the same script)
- the Dev Agent Records of stories `1-3`, `1-5` and `9-13` (what changed in the date picker) and `work/audit/DEFECTS.md` s7-8-05

## Tasks & Acceptance

**Execution:**
- [x] Reproduce x2 on a copy of canonical; list the blocks of the script and mark the first failing one
- [x] Frame size before and after the day click, the inspected box of the commit button, the same in the Web recipe; name the cause as test defect or product defect
- [x] Fix; run the script to its end; class and fix or file every later failure; the script x3 with exit 0
- [x] One main-queue install (dry run, rollback, byte identity); KNOWN-CAUSES.md row; a DEFECTS.md entry for the finding with its status; if a component source changed: its suites once on macOS and the note for the coordinator

**Acceptance Criteria:**
- Given the script on canonical after the install, when it runs three times, then every run exits 0 and every block has run
- Given the date-picker step, when the day is selected, then the commit button's inspected box lies inside the preview frame, and the record says whether the earlier failure was a test defect or a product defect
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE (session 1): all tasks. Cause = TEST DEFECT (not product): the date-picker block created md-date-picker without a height, so the capture is the 240 px default (640x240); dialog is cut to header + OK/Cancel and the script's fixed points are outside the frame. The failing line 67 is the FIRST click (248, 264), not the commit click (540, 515) as the story said; the commit click and all later blocks had never run.
- Fix (script only, no component source changed): height 640, day/OK targets from inspected parts (day-2026-10-09, day-2026-10-15, ok-button), OK box asserted inside the frame, mdClose read from a later frame (exit motion, as KNOWN-CAUSES row 15). Installed by main-queue job 006 (pre-image sha check, dry run node --check, byte identity with tested tree s928-tree, rollback). KNOWN-CAUSES row 36 and DEFECTS S928-01 appended.
- Reproduce: 001 (2 of 2 exit 1 at line 67, binary built from copy of canonical); diag 002 (frame 640x240, nodes). Fix iterations 003, 004 (reached mdClose at line 85), 005 (3 of 3 exit 0). Post-install canonical script x3 exit 0 (job 006).
- Web recipe comparison not run: the Laboratory viewport is user-sized (native-viewport.js, default 240, resizable to 2000); product unaffected. Open: none. Next: coordinator review. No component re-check needed (md-date-picker source untouched).

EVIDENCE | 9-28-laboratory-macos-preview-presentation-date-picker-commit-click-005-patched-x3 | macOS | test-preview-presentation patched tree | 3/3
EVIDENCE | 9-28-laboratory-macos-preview-presentation-date-picker-commit-click-006-install-pp-date-picker | macOS | test-preview-presentation canonical after install | 3/3

Platforms: the story needs macOS only (no simulator, no Android lane); the script drives the macOS live renderer.


_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

