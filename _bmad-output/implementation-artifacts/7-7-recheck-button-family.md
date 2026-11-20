---
title: 'Gate-7 re-check: button-group, fab, icon-button, segmented-button, split-button'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-7-recheck-button-family'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane fi2 · android lane a1 (emulator-5556) · simulator AWC-fi2'
lab: 'work/audit (your folder: work/audit/s7-7)'
depends_on: ['2-1-button-family-ios-motion-and-captures']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: the five button-family components failing on iOS: R1-12, R1-13, R1-14, R1-16, R1-09, R1-10.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r1/v2. Run family states three times per iOS runtime.

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

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Session 1 (reviewer s7-7, 2026-11-15)
- Folder work/audit/s7-7; snapshot tree work/audit/s7-7-tree. Simulators created by job s7-7-002-sim: AWC-fi2 (iOS 26.3) 16C3E6BB-A0B1-4524-8320-9DD86B12BF44, AWC-fi2-ios18 (iOS 18.6) 11FBFDA3-CEA3-455D-A9B9-777C9534EC08.
- s7-7-001-snapshot (exit 0, 11:37 Mac): snapshot ok; checkpoint freshness: the six in-scope family checkpoints (button-group, fab, icon-button, segmented-button, split-button, plus fab-menu) all match the snapshot (0 differing files); out-of-scope md-button has 1 differing impl file (NativeButton.kt), noted only. 80 fix-job logs copied to s7-7/ref.
- Queued (adapted from r1 v2 scripts): s7-7-003-swift (macOS), s7-7-004-ios (26.3: family states x3; 18.6: family states x3), a1: s7-7-A001-android (emulator-5556). Next: lab/ax/examples jobs, contract matrix, verdicts.
- Also queued in fi2 behind 003/004: s7-7-005-lab-web, s7-7-006-ax-mac-ios, s7-7-007-gate1; a1: s7-7-A002-ax-android. STILL TO WRITE after 003 finishes: Kotlin examples compile (adapt done/r1-A022-examples-kotlin.sh with the s7-7 paths, queue-a1), DEFECTS/AUDIT/doc install job (adapt r1-027/r1-028), audit doc work/audit/s7-7/<tag>.md.
- 003 progress (11:38 start; check 11:5x): macOS family paint 974/974 and button paint 1086/1086 (match the claims). States fixtures running via slot.


## Review Triage Log


### Progress log (continued)
- s7-7-003-swift DONE exit 0 (Mac 13:12): macOS family paint 974/974, button paint 1086/1086, family states 29186/29186 (claims: fx-127 27819, canonical fx-128 29358; counts differ with fixture content: check at verdict), 15 view fixtures all exit 0, scripts button 1073 + behavior 164, playground build ok, button-hosts ok, 7 live host scripts exit 0, examples: generic 9 + fork 4 generated, Swift typecheck 13/13 exit 0. Logs work/audit/s7-7/swift/.
- s7-7-A001-android DONE exit 0 (emulator-5556): device 133/133, unit 195/195, family paint 974, family states 18241/18241 (matches fx-A084), button paint 712, states 645.
- s7-7-A002-ax-android failed instantly (ax dir did not exist yet; my bug). Fixed copy waits in work/audit/s7-7/pending/s7-7-A004-ax-android.sh: queue it to queue-a1 AFTER s7-7-006-ax-mac-ios ends. s7-7-A003-examples-kotlin queued in a1.
- s7-7-004-ios started Mac 13:12 (26.3 then 18.6, family states x3 each). Then 005 lab-web, 006 ax, 007 gate1 run in fi2.

### Progress log (session 1, later, Mac 15:10)
- s7-7-A003-examples-kotlin: 13 files / 364 cases compile, exit 0.
- s7-7-004-ios DONE (Mac 13:12-14:59; load 122 at start). iOS 26.3 family states x3: 26018/26018, 26659/26659, 26522/26522 (each with 1 BRACKET match, accepted per R1-14). iOS 26.3 family+button paint 974/974, 1086/1086, button states 646/646, all view suites + mains pass. iOS 18.6 family states x3: 27073/27074 (FAIL bg-keyboard-standard/key3-Enter box at +62 ms, native 221.90 vs Chrome 223.92-225.05, button-group width motion, run took 893 s vs 430 s for the others), 27519/27519, 27769/27769.  That failure is a finding until its cause is known (protocol). Rerun queued: s7-7-008-ios18-rerun (18.6 family states x2 on low load).
- s7-7-005-lab-web DONE exit 0: 4177 probes: retained update 200 + click + methods (setMenuIcon, show/whenClosed/close fulfilled) on iOS and Android for all 9 tags; split width 232.5; Studio 878/878, compiler 12/12, web spec 612/612, e2e all 9 tags pass.
- Gate-1 matrix job 007 and ax job 006 pending in fi2; after 006 ends, copy work/audit/s7-7/pending/s7-7-A004-ax-android.sh to queue-a1.
- Checkpoint freshness (001): md-button-group/fab/fab-menu/icon-button/segmented-button/split-button checkpoints current (0 differing files).

### Final (session 1, Mac 15:50)
- s7-7-008-ios18-rerun: iOS 18.6 family states 27876/27876 and 26730/26730 (18.6 total: 4 clean runs of 5). s7-7-A004-ax-android and ax compare: 0 open findings on all tags, reports identical to installed. s7-7-007-gate1: matrix identical to r1 round 2 (matcher artefacts only).
- s7-7-010-install-audit (main queue) installed: 5 audit docs (work/audit/s7-7/docs), 5 AUDIT.md cells "Gate 7 (s7-7, 2026-11-15, re-check 3)", DEFECTS.md re-check lines for R1-09/10/12/13/14/16 and new R1-17; inventory test 2/2; backup work/audit/DEFECTS.md.s77-before.
- Verdicts: md-fab PASS, md-icon-button PASS, md-segmented-button (+set) PASS, md-split-button PASS, md-button-group FAIL (R1-17: iOS 18.6 run 1, bg-keyboard-standard/key3-Enter width 221.90 vs 223.92-225.05; 1 of 5 runs; 0 of 3 on 26.3). R1-09 PARTIAL non-blocking (stale Status lines), R1-10, R1-12, R1-13, R1-14 verified fixed, R1-16 reopened as R1-17.
- Open: after R1-17 is fixed, re-run iOS 18.6 x5 and 26.3 x3 family states for md-button-group and flip its verdict. Lane/sim reuse: AWC-fi2 16C3E6BB..., AWC-fi2-ios18 11FBFDA3.... Job scripts in work/claude-runner/done/s7-7-*.sh.
