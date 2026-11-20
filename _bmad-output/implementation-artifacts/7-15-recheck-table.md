---
title: 'Gate-7 re-check: table, table-pagination, table-cell (s7-9 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-15-recheck-table'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5'
lab: 'work/audit (your folder: work/audit/s7-15)'
depends_on: ['9-11-table-pagination-macos-tab-and-rowspan-semantics']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-table (R5-18), md-table-pagination (R5-18), md-table-cell (R5-12).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-9. Re-check the two findings on a new snapshot: tools/ax macOS for md-table-pagination three times, md-otp-field and md-autocomplete macOS tools/ax once (same host branch), the rowSpan assertions on each platform, table paint and states once per platform; the other s7-9 gate results stand.

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
- Reviewer s7-15 finished (session 3). Verdicts installed by main job 7-15-100-install-audit-table (AUDIT.md 3 cells, audit/md-table.md section, DEFECTS.md).
- md-table FAIL (S7-15-01 iOS click-calories motion order 2 checks in 3 of 6 iOS runs; S7-15-02 web role table/treegrid flips, tools/ax macOS name/focus open). md-table-pagination PASS (R5-18 FIXED, ax x3 0 open). md-table-cell PASS (R5-12 FIXED, span 2 on web/macOS/iOS/Android).
- Evidence jobs: 7-15-002-macos-table, 003-ax-mac, 004-ios, 005-rerun, A002-android, A004-ax-android-web (A001/A003 produced no usable result).
- Nothing in flight. Next: coordinator routes S7-15-01 / S7-15-02 to fix owners (d5 for table); re-check after fix.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

EVIDENCE | 7-15-002-macos-table | macOS | table paint | 7403/7403
EVIDENCE | 7-15-002-macos-table | macOS | table states | 3858/3859
EVIDENCE | 7-15-004-ios | iPhone 26.3 | table paint | 7400/7400
EVIDENCE | 7-15-004-ios | iPhone 26.3 | table states run 1,2,3 | 3862/3862, 3862/3862, 3860/3862
EVIDENCE | 7-15-004-ios | iOS 18.6 | table states | 3860/3862
EVIDENCE | 7-15-005-rerun | macOS | table states r2,r3 | 3859/3859, 3859/3859
EVIDENCE | 7-15-005-rerun | iPhone 26.3 | table states s4,s5 | 3862/3862, 3860/3862
EVIDENCE | 7-15-A002-android | Android | NativeTablePaintTest | 1/1
EVIDENCE | 7-15-A002-android | Android | NativeTableStatesTest | 1/1
EVIDENCE | 7-15-A002-android | Android | LivePreviewTableHostTest | 3/3
EVIDENCE | 7-15-A004-ax-android-web | Android | tools/ax md-table family | 7 cases, md-table 5 open (macOS, S7-15-02)

## Review Triage Log

