---
title: 'Gate-7 re-check: stepper (s7-5 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-16-recheck-stepper'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane r6 · android lane a6 (emulator-5566) · simulators AWC-r6 (iPhone 26.3), AWC-r6-ipad and an iPhone on iOS 18.6'
lab: 'work/audit (your folder: work/audit/s7-16)'
depends_on: ['9-12-stepper-ios-width-from-host']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-stepper (+md-step): s7-5-01; s7-5-02 (Laboratory Android probe) and s7-5-03 (probe expectation).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/s7-5 (probe-lab.mjs). Re-run NativeFaViewsIntegration on iPhone 26.3 twice and on iPad 26.3 and iOS 18.6 once each, the new phone-viewport oracle cases on every platform, and the stepper suites the fix touched. Repeat the Laboratory probe with the corrected goTo expectation; repeat the Android Laboratory probe only when a coordinator note in your Handover says that port 4177 reports Android as available. The other s7-5 results stand.

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

### Coordinator note (09:44 UTC 2026-11-16, Laboratory repaired)
- The Laboratory server on port 4177 was restarted by the coordinator at 09:43 UTC on 2026-11-16 with the Android SDK variables (main-queue job `881-coord-laboratory-restart`, exit 0). `/api/native-live/status?platform=android` now answers `"available":true` ("Real Jetpack Compose on emulator-5554"), and the playground APK on emulator-5554 was reinstalled from canonical. So the Android Laboratory probe is no longer blocked by finding s7-5-02: run it as AUDIT-PROTOCOL.md describes. This replaces what an earlier note says about recording the Android probe as not run.

### Coordinator note (11:08 UTC 2026-11-16, high Mac load 09:20-11:25 UTC)
- From about 09:20 to about 11:25 UTC on 2026-11-16 the Mac ran a deliberate CPU load: story 6-4 measured a stall with 12 busy loops in its jobs 015 to 018, and the load average was 270 to 1000 (normal is 50 to 70). A timing, motion, states or focus failure of any run inside that window is suspect, also on a simulator or an emulator. Do not record it as a finding and do not build a conclusion on it: look at the load line of the job, and repeat the run once the 1-minute load is back below about 150. Paint and geometry results are not affected.

## Dev Agent Record

### Current state
- DONE (session 3, s7-16, 2026-11-16). md-stepper (+md-step) verdict PASS written: work/audit/s7-16/docs/md-stepper.md, installed by main-queue job s7-16-100-install-audit-stepper (exit 0, AUDIT.md cell + docs/native-parity/audit/md-stepper.md). DEFECTS.md status lines added for s7-5-01/02/03 (all VERIFIED).
- Evidence: EVIDENCE | s7-16-002-macos | macOS | NativeFaViewsIntegration | 506/506; EVIDENCE | s7-16-003-ios-iphone | iPhone 26.3 | NativeFaViewsIntegration x2 | 506/506; EVIDENCE | s7-16-004-ios-ipad-ios18 | iPad 26.3 and iOS 18.6 | NativeFaViewsIntegration | 506/506 each; EVIDENCE | s7-16-003-ios-iphone | iPhone 26.3 | NativeStepperIntegration | 222/222; EVIDENCE | s7-16-A001-android | Android | StepperParity+Views | ok (93/93); EVIDENCE | s7-16-A002-android-standalone | Android | LivePreviewStepperHostTest | ok; EVIDENCE | s7-16-007-lab-rerun | Laboratory | probe | 8/8.
- Open: none. Non-blocking: 4 Web `controls` relation ax findings (DEFECTS line ~468), not native.

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

