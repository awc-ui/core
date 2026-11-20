---
title: 'Gate-7 re-check: divider, avatar, card, list, accordion, dialog'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-8-recheck-containment'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane fi3 · android lane a2 (emulator-5558) · simulator AWC-fi3'
lab: 'work/audit (your folder: work/audit/s7-8)'
depends_on: ['3-1-containment-batch-install-and-stacking']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-divider, md-avatar, md-card, md-list (+item), md-accordion (+item), md-dialog: r3-01..r3-26.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r3.

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
- [x] Fresh snapshot of canonical; contract matrix per component
- [x] Re-run: Swift paint and states (macOS), Android tests, iOS harness on iPhone 26.3 (states x3) plus one more runtime, Laboratory probes through 4177, examples compile, tools/ax
- [x] Decide each proposed exception; record new findings in DEFECTS.md
- [x] Write `docs/native-parity/audit/<tag>.md` and update the AUDIT.md cells through one main-queue install

**Acceptance Criteria:**
- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-15 09:30 UTC)

- Story 3-1 installed batch 3 (`3-1-007-install-batch3`). It proposes an exception for r3-19 mechanism 2 (the viewport layer was not built): decide it on its merits, and if you reject it, say what must be built.
- Check the two findings 3-1 worked on last: iOS card lifecycle `authored-keyboard` and the Android list caret sample.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state

- Session 1 finished 2026-11-15 ~15:10 UTC. All 6 components have a dated gate-7 verdict in AUDIT.md (install `s7-8-100-install-audit-s7-8`, exit 0, 6 docs identical, inventory test 2/2 before and after). Docs: docs/native-parity/audit/<tag>.md (staged in work/audit/s7-8/docs). Findings: work/audit/DEFECTS.md section "Gate-7 re-check s7-8" (s7-8-01..05).
- Verdicts: md-divider PASS; md-card PASS; md-dialog PASS; md-avatar FAIL (s7-8-01 iOS forced-colors avatar, 3/3 deterministic); md-list(+item) FAIL (s7-8-02 Android NativeListStatesTest load-sensitive, cause unproven); md-accordion(+item) FAIL (s7-8-03 macOS AX relation; s7-8-04 the r3-19 exception proposal is REJECTED, mechanism 2 must be built).
- Coordinator items: exception decided (rejected, what to build is in s7-8-04); iOS card `authored-keyboard` passes (32/32 iPhone 26.3 and iOS 18.6, macOS 32/32); Android list caret sample reproduces under load (A002) and passes isolated 2/2 (A006).
- Next (after fixes land): re-check s7-8-01 (`NativeForcedAppearanceIntegration` on AWC-fi3 and AWC-fi3-ios18 via `work/audit/s7-8/bin/ios.sh`), s7-8-02 (`bin/android.sh liststates NativeListStatesTest`, plus a loaded run), s7-8-03 (`node tools/ax/run.mjs --tags md-accordion --platforms macos,web,compare`), s7-8-04 (stacking suites + new Chrome probes), then flip the three verdicts through one main-queue install like `s7-8-100`. Not run: iPad 26.3, iOS 18.6 divider.

### Evidence so far (session 1)

EVIDENCE | s7-8-001-snapshot | macOS | snapshot work/audit/s7-8-tree (220 installs, latest 3-1-019-install-defects-cardkb / 6-3-023) | done
EVIDENCE | s7-8-003-swift-paint | macOS | divider-script | 276/276
EVIDENCE | s7-8-003-swift-paint | macOS | NativeAvatarIntegration | 2950/2950
EVIDENCE | s7-8-003-swift-paint | macOS | NativeAvatarLazyIntegration | 3/3
EVIDENCE | s7-8-003-swift-paint | macOS | NativeCardPaintIntegration | 6912/6912
EVIDENCE | s7-8-003-swift-paint | macOS | NativeListPaintIntegration | 29418/29418
EVIDENCE | s7-8-003-swift-paint | macOS | NativeListPartsIntegration | 285/285
EVIDENCE | s7-8-003-swift-paint | macOS | NativeDialogPaintIntegration | 2249/2249
EVIDENCE | s7-8-003-swift-paint | macOS | NativeForcedAppearanceIntegration | 232/232
EVIDENCE | s7-8-003-swift-paint | macOS | NativeCursorHiddenIntegration | 56/56
EVIDENCE | s7-8-003-swift-paint | macOS | NativeAccordion Appearance 1478, Parts 8272, Renderer 567, Initialization 100, Placeholder 368, Scrolling 278 | all passed
EVIDENCE | s7-8-004-swift-timing | macOS | NativeCardStatesIntegration | 172561/172561
EVIDENCE | s7-8-004-swift-timing | macOS | NativeCardLifecycleIntegration | 32/32
EVIDENCE | s7-8-A001-android-paint | Android a2 | 28 paint/parity/host classes (avatar-parity 3124, card-paint 6699, dialog-paint 2081 checks, 0 failures) | 73/73 tests
EVIDENCE | s7-8-A002-android-timing | Android a2 | 15 timing classes (card-states 55810, card-lifecycle 30, dialog-motion 4860, modal-stack 149, floating 16466 checks, 0 failures) | 28/29 tests
- NativeDividerViewIntegration is not a macOS fixture name ("Unknown native view fixture"); divider macOS evidence is divider-script.
- FINDING (to file): Android NativeListStatesTest.listInteractionsMatchChrome fails again in s7-8-A002: 2 of 175282, expand-expand-standard-none-dark-rtl r1 panel opacity 0.85 vs Chrome [0.018, 0.797] and caret 128.7 vs [0.28, 108.3] at web 2016. Same family as 3-1-A006/A008 (load sensitive). Re-run isolated: s7-8-A006-liststates-rerun (2 runs, a2).
- Held: A004 examples kotlin (needs generate.mjs output from fi3 job 0065), AX compare (needs macOS/web captures from fi3 job 007; A005 android capture phase already running).
EVIDENCE | s7-8-004-swift-timing | macOS | all 17 fixtures exit 0: ListStates 119703/119703 (39 known gaps = input-latency), ListRoving 198/198, ListMethods 31/31, ListTooltip 9/9, DialogMotion 10204/10204, ModalStack 149/149, Stacking 12/12, Accordion State 65, Motion 716, Reorder 628, Lift 280, Shift 16884, States 46242, Floating 44186 | pass
EVIDENCE | s7-8-005-ios26 | iPhone 26.3 (AWC-fi3) | 30 fixtures: all exit 0 except NativeForcedAppearanceIntegration 228/232 (avatar forced av@[20,0.25] native 233 vs Chrome 255, 4 checks, light+dark). CardStates 190616, CardLifecycle 32/32 (authored-keyboard ok), ListStates 76497, DialogMotion 12851, Stacking 11/11, AccordionStates 55782, Floating 50912 | 
EVIDENCE | s7-8-006-ios18 | iOS 18.6 (AWC-fi3-ios18) | 13 fixtures all pass (CardStates 178844, ListStates 73926, DialogMotion 12956, Stacking 11/11, AccordionStates 54902, Floating 50288) | pass
EVIDENCE | s7-8-A006-liststates-rerun | Android a2 | NativeListStatesTest isolated x2 | 2/2 ok (the A002 failure is load-sensitive, as 3-1 recorded)
- NEW FINDING candidate: iOS NativeForcedAppearanceIntegration avatar 4 checks fail on iPhone 26.3 (macOS 232/232). Rerun queued: s7-8-008-ios-forced-rerun (2x iPhone, 1x iOS 18.6).
EVIDENCE | s7-8-005-ios26 | iPhone 26.3 | 30 containment fixtures | 29 pass, NativeForcedAppearanceIntegration 228/232
EVIDENCE | s7-8-0065-playground-live-examples | macOS | live accordion/avatar/card/list/modal/preview, 6 example generators, 7 Swift typechecks | pass except test-preview-presentation (md-autocomplete, s7-8-05) and the r3 accordion generator duplicate names (fixed in s7-8 copy, s7-8-010 ok)
EVIDENCE | s7-8-A007-ax-android-compare | all | tools/ax 6 components | md-accordion macOS 2 open relation, rest pass
EVIDENCE | s7-8-A008-examples-kotlin | Android | Kotlin examples compile | exit 0
EVIDENCE | s7-8-100-install-audit-s7-8 | docs | 6 audit docs + 6 AUDIT.md cells | exit 0

## Review Triage Log

