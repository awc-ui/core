---
title: 'Gate-7 audit: navigation-rail, app-bar'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-4-audit-navigation-rail-and-app-bar'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r4 · android lane a6 (emulator-5566) · simulator AWC-r4'
lab: 'work/audit (your folder: work/audit/s7-4)'
depends_on: ['6-4-shared-bindings-and-nav-residuals']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-navigation-rail (+md-navigation-rail-tab), md-app-bar.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts.

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

### Coordinator note (Coordinator note 2026-11-16 14:00 UTC: all Mac queues stopped at 13:35:04 UTC; what to redo)
At 13:35:04 UTC on 2026-11-16 (15:35:04 Mac time) every process of the runner process group got SIGTERM. The main runner, all lanes and all running jobs stopped (`claude-runner/KNOWN-CAUSES.md` row 34: `kill 0` in a helper trap of job 9-9-003). The coordinator stopped all chains at about 13:56 UTC. Your chain is relaunched only after the user has started the runner and the lanes are back, so when you read this the queues work again. Since the restart each lane job runs in its own process group. Results written before 13:35:04 are valid. A job stopped by the event has `.exit` 143 and a last log line written by the coordinator. Before you queue such a job again (new number), check your private tree for half-applied state: files the job trap restores, diagnostic lines left in tests, half-applied patches.

For this story: job `s7-4-004-ios18` was stopped during its iOS 18 run and gave no result. Queue it again under a new number. Verdicts are still open for md-app-bar, md-navigation-rail and md-navigation-rail-tab.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 4 (s7-4): DONE. Verdicts installed 2026-11-16 by main-queue job s7-4-009-install-audit-nav (AUDIT.md cells, docs/native-parity/audit/md-app-bar.md and md-navigation-rail.md, DEFECTS status lines).
- md-app-bar: PASS WITH ACCEPTED EXCEPTIONS (ax banner landmark / android searchbox conventions). md-navigation-rail: FAIL (S7-4-01, S7-4-02). md-navigation-rail-tab: FAIL (S7-4-01).
- Evidence: EVIDENCE | s7-4-006-ios-pad | iPad 26.3 | NativeNavigationRailStatesIntegration | 541501/541501 ; EVIDENCE | s7-4-007-ios18 | iOS 18.6 | NativeNavigationRailStatesIntegration | 540115/540167 ; app-bar iPad 2217/2217, 1397/1397 x2, iOS 18 1397/1397; rail paint iPad 19563/19563; ax android compare 0 open findings (s7-4-008).
- S7-4-02 is phone-specific (iPad passes, iPhone x3 and iOS 18 phone fail the same RTL release ripple cells).
- Next (for a fix story): after S7-4-01/02 are fixed, re-run rail states on iPhone x3 + iOS 18 and flip the rail verdicts.


## Review Triage Log

