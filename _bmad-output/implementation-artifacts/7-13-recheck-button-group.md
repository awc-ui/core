---
title: 'Gate-7 re-check: button-group (R1-17)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-13-recheck-button-group'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane fi2 · android lane a1 (emulator-5556) · simulators AWC-fi2 and AWC-fi2-ios18'
lab: 'work/audit (your folder: work/audit/s7-13)'
depends_on: ['9-5-button-group-ios18-lost-frame']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-button-group: R1-17 and the R1-09 Status lines.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-7. Run family states five times on iOS 18.6 and three times on iOS 26.3; the other s7-7 verdicts stand.

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

### Current state
- DONE (s7-13, 2026-11-16). Verdict PASS for md-button-group; R1-17 closed (FIXED, verified), R1-09 Status lines verified (residual in AUDIT rows of md-fab/icon-button/split-button noted, non-blocking).
- Installed by main-queue s7-13-100-install-audit (exit 0): audit doc, AUDIT.md cell (Gate 7 (s7-13, 2026-11-16, re-check 4): PASS), DEFECTS lines, checkpoint refreshed.
- md-button-group checkpoint reports stale-recorded only because of later installs by other stories (newest 2026-11-16T00:35); coordinator may refresh again with tools/checkpoint-refresh.py refresh --tags md-button-group.
- Nothing in flight. No next step.

_The agent writes below: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log


### Evidence log (s7-13)
EVIDENCE | s7-13-A001-android | Android emu-5556 | button family states | 18241/18241
EVIDENCE | s7-13-A001-android | Android emu-5556 | button family paint | 974/974
EVIDENCE | s7-13-002-ios18-x5 run 1 | iOS 18.6 | NativeButtonFamilyStatesIntegration | 27479/27479
Notes: canonical NativeButtonFamilyStatesIntegration.swift sha be6ceabb... equals s95-tree; snapshot diff vs s7-7 tree = work/audit/s7-13/snap/sampler-fix.diff (test-only, no product change). Sources differ from s95-tree only in Accordion/Avatar/DocumentOrder/AWCHarnessInput (other stories). Slot wait on timing pool took ~35 min before run 1 (load 130-500).
EVIDENCE | s7-13-002-ios18-x5 | iOS 18.6 | NativeButtonFamilyStatesIntegration run1-5 | 27479/27479, 27739/27739, 29440/29440, 27881/27881, 27614/27614
EVIDENCE | s7-13-003-ios26-x3 | iOS 26.3 | NativeButtonFamilyStatesIntegration run1-3 | 26614/26614, 26711/26711, 26588/26588
EVIDENCE | s7-13-004-macos | macOS | family paint / group view | 974/974 / 87/87
EVIDENCE | s7-13-006-repro2-ios18 | iOS 18.6 | reproducer old behaviour drop 43:32 | FAIL 2/2 (221.90 vs 223.92-225.05); fix 007: 683/683, 686/686, 685/685
EVIDENCE | s7-13-100-install-audit | docs | AUDIT cell + doc + DEFECTS | exit 0, dry exit 0
