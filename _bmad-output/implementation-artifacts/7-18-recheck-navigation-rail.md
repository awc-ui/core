---
title: 'Gate-7 re-check: navigation-rail, navigation-rail-tab (s7-4 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-18-recheck-navigation-rail'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r4 · android lane a6 (emulator-5566) · simulators AWC-r4 (iPhone 26.3), AWC-r4-ipad and an iPhone on iOS 18.6'
lab: 'work/audit (your folder: work/audit/s7-18)'
depends_on: ['9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-navigation-rail (S7-4-01, S7-4-02), md-navigation-rail-tab (S7-4-01).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-4 (tools/ios-run.sh, tools/matrix.py, tools/probe-lab.mjs). Re-check the two findings on a new snapshot: rail states on iPhone 26.3 three times, on iOS 18.6 twice and on iPad 26.3 once; rail states and paint once on macOS and on Android; the matrix rows of the four members with their new tests (repeat one mutation run yourself); tools/ax for the rail once per platform. The md-app-bar verdict and the other s7-4 gate results stand.

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

### Coordinator note (2026-11-17 07:29 UTC: 9-14 is in review; what to re-check)
- Story 9-14 is in `review` (11-17 07:2x UTC). Start when the coordinator launches you.
- S7-4-02 (phone RTL release ripple): story 9-14 names the test harness as the cause (`AWCShimTouch.onScreen` in the iOS shim, jobs 012 and 013) and installed the fix (job `9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-100-install`). Check that claim yourself: the rail states suite on canonical three times on iPhone 26.3, twice on iOS 18.6 and once on the iPad, and one run on a private copy with the `onScreen` fix taken out, which must show the RTL release failure again. A cause in the harness needs this proof in both directions.
- S7-4-01 (member tests): run the member tests on macOS and Android and one of their mutation runs on each platform.
- S914-01 (Android overflow trigger content not centred, found by story 9-14): re-check it with your own paint run and look at the same trigger on SwiftUI.
- Story 9-14 reports that md-navigation-rail-tab has no checkpoint file. Say whether one is required (how the other child components, for example md-table-cell, are handled) and write a finding if it is.
- Canonical has the iOS shim v5, keyArrivals and the onScreen fix. Take your numbers on canonical as it is when you run and say so in the record. For a finding that a dev story calls intermittent: at least 20 runs of that case.

### Coordinator note (2026-11-18 04:30 UTC: link to the Mac was down 00:00-04:25 UTC; the Mac did not sleep; job results are valid)
Between about 00:00 and 04:25 UTC on 2026-11-18 the link between the agents and the Mac was down (device calls answered 'not connected to the bridge'). The Mac itself did not sleep: the power log has no sleep or wake line since 18:43 UTC on 11-17 (coordinator jobs 889 and 890), it was on AC power, and the lanes kept running jobs through the whole gap. Sessions that started in the gap ended without work, and the coordinator stopped the other runs at 00:13 UTC so that no session was spent on a dead link. Your jobs that were in flight have all finished; their results are valid under the usual rules (the load written next to each run). Nothing was restarted on the Mac. Continue from your Current state; read the logs of the jobs that finished in the gap first.

## Dev Agent Record

### Current state
- Session 2 (s7-18). ALL re-runs done and read; verdict PASS (rail + rail-tab) written to work/audit/s7-18/docs/md-navigation-rail.md; DEFECTS: S7-18-01 filed (non-blocking), status lines for S7-4-01/02, S914-01 are in the install job.
- Evidence: nofix proof 009 fails RTL release (539149/539220, 540980/541042); iPhone 26.3 11 runs, 3 with one non-RTL failed check; lab probe 012 6/6; Kotlin examples A005 BUILD SUCCESSFUL.
- Install s7-18-001-install-audit-nav done (installed, 2 AUDIT rows).
- Nothing left.
EVIDENCE | 7-18-recheck-navigation-rail-009-ios-nofix-proof-v2 | iPhone26.3 | rail states nofix | 539149/539220
EVIDENCE | 7-18-recheck-navigation-rail-011-ios-iphone-more | iPhone26.3 | rail states x8 | 7 of 8 full pass
EVIDENCE | 7-18-recheck-navigation-rail-012-lab-probe-rerun2 | Laboratory | probe-lab | 6/6

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

