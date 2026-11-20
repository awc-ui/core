---
title: 'tools/ax: an empty capture is reported as a pass (S7-19-01); the macOS configure step times out under load (S7-19-02)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-42-tools-ax-empty-capture-is-a-failure'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d4 · android lane a2 (its emulator as PARALLEL.md names it), for one capture · simulator AWC-d4 (iPhone 26.3), for one capture'
lab: 'work/s942-lab (create it; private tree work/s942-tree = a copy of canonical; the jobs that captured nothing are in claude-runner/done: 7-19-recheck-table-2-006 and A001, the accessibility jobs 009 and 010 of audit 7-22, job 026 of story 9-27)'
depends_on: ['9-16-table-ios-sort-click-late-start-and-web-role-race']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Three times in two days an accessibility job ended with exit 0 and a pass row although it had captured nothing: audit 7-22 (jobs 009 and 010, AWCLivePreview was not built in the snapshot), audit 7-19 (jobs 006 and A001, 0 cases captured on iOS and on Android) and story 9-27 (job 026, spawn ENOENT of AWCLivePreview, exit 0). The reviewers noticed and repeated the jobs, but a gate-6 result must not depend on a reader who notices an empty capture. The reviewer of 7-19 filed this as S7-19-01 (tools/ax, all platforms) and filed S7-19-02: the configure step of the macOS capture for md-table timed out once at high load.

**Approach:** Read tools/ax (the capture drivers per platform and summary.mjs) and list every place where a capture with zero cases, a missing preview binary, a spawn error or an empty file ends as a pass or as exit 0. Make each of them a failure: a FAIL row that names the reason (preview binary missing, 0 cases captured, capture file empty, configure timed out) and a non-zero exit of the capture command and of summary.mjs. Do not guess a minimum count: take the expected cases from the same source the capture iterates over, so that a capture with fewer cases than asked also fails and prints both numbers. For S7-19-02 find the wait that timed out, say whether its limit is a fixed number of seconds that load can exceed, and make the step report a named timeout failure (never a pass, never a silent skip); raise the limit only if the measured duration of the step on a quiet Mac is within a factor of two of it, and then give both numbers. Prove it with negative tests: a snapshot without AWCLivePreview, a capture file cut to zero bytes, a capture with one case removed; each must end non-zero with its reason. Then positive runs: md-table, md-list and md-navigation-rail once on macOS, one component once on the iPhone simulator and once on Android, each with the same open findings as in the last audit.

## Boundaries & Constraints

**Always:** The three negative tests end non-zero with a FAIL row that names the reason, and the positive captures on macOS, iOS and Android report the same findings as before. The rules in project-context.md apply.

**Never:** Do not change what tools/ax checks (roles, labels, states, actions) and do not change any component. Do not hide a failure behind a retry. Nothing goes to canonical unless the story's install task, under the name the coordinator gives it. Every build step through tools/slot.sh build 2; captures through tools/slot.sh timing 4 as PARALLEL.md says. Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build; a new diagnostic gets a short trial job first. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- `tools/ax` (the drivers and `summary.mjs`) and `apps/native-ios-playground` (AWCLivePreview) in the canonical tree
- `work/audit/DEFECTS.md` (S7-19-01, S7-19-02), `work/audit/s7-19`, `work/audit/s7-22`
- `claude-runner/PARALLEL.md` (the tools/ax lines, Load discipline)

## Tasks & Acceptance

**Execution:**
- [x] Every path that turns an empty or missing capture into a pass, with file and line
- [x] The failures with named reasons; the three negative tests
- [x] S7-19-02: the wait that timed out, its limit and its duration on a quiet Mac; a named timeout failure
- [x] Positive captures on macOS, iOS and Android; one main-queue install (dry run, backup, byte identity) under the coordinator's name for it; DEFECTS.md entries `ready for re-check`; a line in PARALLEL.md that an empty capture now fails

**Acceptance Criteria:**
- Given a snapshot without the preview binary, when the capture runs, then it ends non-zero with a FAIL row that names the missing binary
- Given a capture with fewer cases than asked, when summary.mjs runs, then it ends non-zero and prints both numbers
- Given the unchanged components, when the captures run after the change, then the findings equal those of the last audit
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-19 23:29 UTC: start; install named)
Start. This story is light on the Mac and does not wait for anything.

Install name, for the story's install task: 'tools/ax: an empty capture is a failure'. It may go to canonical when (1) the three negative tests end non-zero with a FAIL row that names the reason, (2) the positive captures on macOS, iOS and Android report the same findings as before the change (counts side by side in the record), and (3) the configure step of S7-19-02 has its measured time at a quiet minute and at a loaded one and a limit that follows from those numbers, not a retry.

Other audits and stories call tools/ax while you work: keep the change in the private tree until the install, and make the install one main-queue job (anchored patch, dry run, rollback, byte identity). After the install add one line to claude-runner/PARALLEL.md, in the tools/ax lines, saying that an empty capture now fails and with which reasons.

Reminders: build AWCLivePreview in your tree before any accessibility job and read the capture, not the exit code; every build step through tools/slot.sh build 2; captures through tools/slot.sh timing 4 (the machine-wide cap is 3 now), boot once per job inside the slot, bootstatus -b and 60 s before the first capture; simulators shut down on exit; emulator-5554 and port 4177 are the user's Laboratory and are not test targets.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 1. Tree work/s942-tree (changed: tools/ax run.mjs, macos.mjs, summary.mjs); lab work/s942-lab (install.sh, ax.orig = unchanged tools/ax, out/ = captures).
- Done: code change; negative tests N1 (no binary), N2 (zero-byte file), N3 (case removed) all exit 1 with named FAIL row, the unchanged tool exits 0 on N2/N3; positive captures macOS (md-table 4, md-list 3, md-navigation-rail 4), iOS (md-list 3), Android (md-list 3): 0 open findings, equal to the unchanged tool's compare on the same captures.
- S7-19-02: configure step measured 717-850 ms at load 26 to 327; fixed limit 30000 ms (about 35x), so not raised; a timeout is now a named FAIL with limit and load, no retry.
- Install done: main-queue job 9-42-tools-ax-empty-capture-is-a-failure-100-install-tools-ax-empty-capture-is-a-failure (pre-image check, dry run, backup in work/s942-lab/backup-*, byte identity of run/macos/summary.mjs: IDENTICAL x3, canonical smoke good=0 cut=1, PARALLEL.md line and DEFECTS.md status line appended). Status review.
- Next: reviewer re-checks S7-19-01/02; nothing left for the dev agent.

#### Changes and findings
- Paths that turned an empty capture into a pass (old code): macos.mjs spawn of a missing binary answered nothing and the run went on (9-27 job 026); run.mjs ended exit 0 whatever the captures; summary.mjs skipped a missing report and printed a pass row for a report with fewer cases than asked; platform with 0 cases printed 'not run'. Now each is a FAIL row with reason and exit 1; summary.mjs --require <platforms> fails a platform with 0 captured cases.
- Expected case counts come from the capture's own case list (CASES in cases.mjs, the asked list in run.mjs); messages print both numbers (for example 'report has 2 of 3 cases').
- Found on the way: a copied ios-build dir carries a stale module cache path (PCH error, harness exit 4); the new tool reported it as 'FAIL ios 0 of 3 cases captured' (job 004) instead of a pass. Android project copy needs ../../packages/native-android beside it.

#### Evidence
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-002-trial2 | macos | negative tests N1 no binary, N2 zero-byte file, N3 case removed (non-zero with reason) | 3/3
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-003-positive-macos | macos | tools/ax md-table captured, 0 open findings | 4/4
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-003-positive-macos | macos | tools/ax md-list captured, 0 open findings | 3/3
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-003-positive-macos | macos | tools/ax md-navigation-rail captured, 0 open findings | 4/4
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-005-positive-ios-retry | ios | tools/ax md-list capture (iPhone AWC-d4) | 3/3
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-A002-positive-android | android | tools/ax md-list capture (emulator-5558) | 3/3
EVIDENCE | 9-42-tools-ax-empty-capture-is-a-failure-100-install-tools-ax-empty-capture-is-a-failure | macos | canonical install byte-identical files (IDENTICAL) | 3/3

## Review Triage Log

