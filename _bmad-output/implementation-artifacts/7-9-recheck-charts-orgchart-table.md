---
title: 'Gate-7 re-check: charts, organization chart, table'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-9-recheck-charts-orgchart-table'
epic: 7
model: 'sonnet'
wave: 4
lanes: 'mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5'
lab: 'work/audit (your folder: work/audit/s7-9)'
depends_on: ['4-2-md-table-open-items', '4-3-charts-and-org-chart-parts']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-area-chart, md-bar-chart, md-line-chart, md-pie-chart, md-sparkline, md-organization-chart, md-table family: R5-01..R5-17.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r5.

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

### Coordinator note (2026-11-15 09:30 UTC)

- R5-01: the `POST /api/native-live/session?platform=ios` probe on port 4177 was never re-run, because dev stories may not touch 4177. Run it once through a main-queue job, read-only.
- R5-17: re-confirm the accepted entries in `patch-ax-chart.py`. Story 4-3 found the Laboratory part examples already on canonical (`r5PartExample`, `visualParts`).

## Dev Agent Record

### Current state
- Session 3 (s7-9, 2026-11-16). ALL own re-runs done; verdicts decided; install job queued: queue/s7-9-008-install-audit-charts-orgchart-table.sh (main queue; docs from work/audit/s7-9/docs/, AUDIT.md cells, DEFECTS status lines, all anchored with rollback).
- Verdicts: 5 charts PASS, md-organization-chart PASS, md-table + md-table-pagination FAIL (blocking R5-18, new in DEFECTS.md: host-tab patch never installed on canonical, macOS ax focus open 3/3), md-table-cell FAIL non-blocking (R5-12 no AX rowSpan assertion), other 8 table tags PASS.
- EVIDENCE | s7-9-002-macos | macOS | chart paint 1045/1045, org paint 1644/1644, org states 1253/1253, table paint 7403/7403, table states 3859/3859 | all pass
- EVIDENCE | s7-9-003-ios-iphone | iPhone 26.3 | chart paint 1045/1045, motion 98/98, org 1644/1644 + 1253/1253, table paint 7400/7400, table states 3862/3862 x3
- EVIDENCE | s7-9-004-ios18 | iOS 18 | same counts, table states 3862/3862 x1
- EVIDENCE | s7-9-A003-android | Android emulator-5566 | 11 classes BUILD SUCCESSFUL
- EVIDENCE | s7-9-005-lab-ax | Laboratory | 4177 probes 50 ok / 0 fail, POST session 200 (R5-01 ok), test-live-table 107, charts 57; examples s7-9-006 typecheck 103/93/22, s7-9-A004 compile 103/93/22
- EVIDENCE | s7-9-A005-ax-android | Android ax | 17 tags pass, 0 open; s7-9-007 macOS pagination focus open x2 more runs
- INSTALLED: s7-9-008 exit 0 (17 AUDIT rows, 17 DEFECTS status lines, 7 audit docs). Status done. Old NEXT (obsolete): check done/s7-9-008-install-audit-charts-orgchart-table.exit and .log (expects "installed", counts 17 in AUDIT.md? grep -c prints rows done). If exit 0: verify with grep "s7-9" in AUDIT.md, set status done. If the script aborted (rollback), read the ABORT message, fix the script, requeue.
- Do not repeat any s7-9 job 001-007 / A003-A005.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

