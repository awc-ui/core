---
title: 'Gate-7 audit: text-field, number-field, otp-field'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-1-audit-text-number-otp-fields'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane r1 · android lane a5 (emulator-5564) · simulator AWC-r1'
lab: 'work/audit (your folder: work/audit/s7-1)'
depends_on: ['6-3-text-fields-followups']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-text-field, md-number-field, md-otp-field.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. The number-field macOS extra-actions behaviour is documented as SwiftUI platform behaviour with evidence in outputs/native-parity/_ax-n3-nf-decision; judge that record.

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

### Coordinator note (2026-11-15 17:12 UTC)
- The previous session was stopped by the coordinator at 17:12 UTC to switch this story to the short-session rules (project-context.md, section 'Sessions and tokens'). It could not write its last notes. Its jobs keep running. Read the summary lines of the jobs below first (grep and tail, not whole logs), then continue from them.
- Notes are current to 16:59 UTC. In the main queue: s7-1-010-install-audit (queued 16:59, after the 6-5, 4-2 and 6-2 installs); its dry run s7-1-009-dry-install passed at 16:58. What is left: read the install job's result, check the AUDIT.md cells and the three audit docs, set `status: done` and give the verdict per component.

## Dev Agent Record

### Current state
- DONE 2026-11-15 (session 2). Install s7-1-010-install-audit exit 0: 3 audit docs, 3 AUDIT.md cells (Gate 7 (s7-1, 2026-11-15): FAIL for md-text-field, md-number-field, md-otp-field), DEFECTS S71-01..08 verified present.
- Blocking findings: S71-01 otp Lab macOS 502, S71-02 NF stale stepUp closure, S71-03 otp iOS states, S71-05 untested members. Exception NF macOS extra actions rejected (S71-04).
- Next (after coordinator routes fixes): re-check S71-01..05 on a new snapshot and flip verdicts via a new install. Lane r1, a5, AWC-r1.

### Evidence
EVIDENCE | s7-1-003-swift | macOS | NativeTextFieldPaintIntegration | 12700/12700
EVIDENCE | s7-1-003-swift | macOS | NativeNumberFieldPaintIntegration | 8815/8815
EVIDENCE | s7-1-003-swift | macOS | NativeOTPFieldPaintIntegration | 13164/13164
EVIDENCE | s7-1-003-swift | macOS | NativeTextFieldStatesIntegration run1 | 2028/2028
EVIDENCE | s7-1-003-swift | macOS | NativeNumberFieldStatesIntegration run1 | 1538/1538
EVIDENCE | s7-1-003-swift | macOS | NativeOTPFieldStatesIntegration run1 | 1370/1370
EVIDENCE | s7-1-003-swift | macOS | NativeTextFieldStatesIntegration run2 (load 100+) | 2020/2028
EVIDENCE | s7-1-003-swift | macOS | NativeOTPFieldStatesIntegration run2 | 1369/1370
EVIDENCE | s7-1-003-swift | macOS | live hosts text/number/otp | 22/22, 33/33, 27/27
EVIDENCE | s7-1-004-ios | iOS 26.3 | text/number/otp paint | 12676/12676, 8815/8815, 13164/13164
EVIDENCE | s7-1-004-ios | iOS 26.3 | TextField/NumberField/OTP states run1 | 2024/2024, 1392/1392, 1361/1370
EVIDENCE | s7-1-005-ios-states-more | iOS 26.3 | OTP states run2, run3 | 1361/1370, 1362/1370
EVIDENCE | s7-1-005-ios-states-more | iOS 18.6 | OTP states run1, run2 | 1362/1370, 1362/1370
EVIDENCE | s7-1-005-ios-states-more | iOS 18.6 | TextField states, NumberField states, TF paint | 2024/2024 x2, 1392/1392 x2, 12676/12676
EVIDENCE | s7-1-008-mac-states-x4 | macOS | TextField states x4, OTP states x4 | 2028/2028 x4, 1370/1370 x4 (retries in 3)
EVIDENCE | s7-1-A001-android | Android emulator-5564 | text/number/otp paint | 11333/11333, 8203/8203, 12933/12933
EVIDENCE | s7-1-A001-android | Android emulator-5564 | text/number/otp states | 954/954, 1096/1096, 1370/1370
EVIDENCE | s7-1-A001-android | Android emulator-5564 | 15 device test methods | 15/15
EVIDENCE | s7-1-003b-lab-web | Web/Studio | studio, compiler, spec, e2e | 886/886, 12/12, 277/277, 106/106
EVIDENCE | s7-1-007-ax-compare | all four | tools/ax text 5, number 6, otp 5 cases | 0 open findings
EVIDENCE | s7-1-A003-examples-kotlin | Android | Compose examples compile | BUILD SUCCESSFUL (3 files)

### Dev Agent Record (notes)
- Findings S71-01..08 in work/audit/DEFECTS.md (section 2026-11-15 gate-7 audit s7-1). Docs: work/audit/s7-1/docs/md-{text,number,otp}-field.md (installed to docs/native-parity/audit/ by s7-1-010).
- Facts for the next agent: Android ax must run after the macOS capture in the same out dir (the Android host copies the macOS node); the fi-lab iOS harness exits 0 even when checks fail, read the 'checks passed' line; my own Laboratory server recipe is s7-1-003e-own-server.sh (PORT=4197, killed on exit).

## Review Triage Log

