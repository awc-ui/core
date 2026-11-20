---
title: 'Gate-7 re-check: slider, rating, stepper'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-5-recheck-slider-rating-stepper'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r6 · android lane a6 (emulator-5566) · simulator AWC-r6'
lab: 'work/audit (your folder: work/audit/s7-5)'
depends_on: ['5-3-stepper-landmark-and-wrapper-parts']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-slider, md-rating, md-stepper (+md-step): R6-03, R6-04, R6-05, R6-07, R6-11, R6-13.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r6.

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
- Session 3 (2026-11-16). status DONE. Reviewer s7-5. Verdicts in AUDIT.md (installed by main-queue s7-5-008-install-audit, exit 0, 3x ok, 3x byte-identical): md-slider PASS, md-rating PASS, md-stepper(+md-step) FAIL (s7-5-01 iPhone 26.3 FaViews 406/494, UIScreen width viewport in NativeStepper.swift:377). Findings s7-5-01..03 in DEFECTS.md.
- EVIDENCE | s7-5-008-install-audit | macOS | install AUDIT rows + docs | 3/3
- Incident: s7-5-007 truncated AUDIT.md to 0 bytes (script wrote before reading). Restored byte-identical from the job's own backup (work/audit/s7-5/install-backup-20261116-032927/AUDIT.md, 77411 bytes) within ~4 minutes; script fixed; 008 succeeded. Other agents' AUDIT.md edits made in that window (01:29 UTC) would have been lost: none seen (file mtime stayed 01:29:27 until restore).
- Not done: ios18 FaViews; Android 4177 Lab probe (no ANDROID_HOME, s7-5-02).
- Earlier evidence: s7-5-002 macOS 494/494; s7-5-003 iOS SR 444/444, stepper 222/222; s7-5-A003/A005 Android pass; s7-5-004 Lab; s7-5-005 ax.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

