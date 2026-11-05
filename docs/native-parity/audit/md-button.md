# md-button — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking findings: **R1-01** (iOS 18.6 states 636/645; iOS 26.3 intermittent `click2`), **R1-02** (form submit/reset composition: Android
test fails, Swift behaviour fixture traps — cause in md-text-field, n3), **R1-04** (no retained Laboratory property updates). Non-blocking:
R1-09 (stale doc statements), R1-10 (no checkpoint.json; no md-button example evidence before this audit). The core renderer evidence
(Chrome 153 paint + states + reduced motion on macOS, iOS 26.3 and Android) re-runs at the claimed counts.

## Gate 1 — source contract

Contract re-extracted from `md-button.tsx`/`.css`: 24 properties, 2 events (`mdClick` cancelable, `mdChange`), 0 methods, 4 slots, 6 parts,
28 CSS hooks = 64 rows ([matrix](../../../../audit/r1/matrix/md-button.md)). Every row has a SwiftUI and a Compose implementation, a
Laboratory exposure (property editors from the catalog — both platforms declare all members; 28 appearance fields + the `stateLayerOpacity`
`::part()` field in `button-appearance.js`) and at least one test (Chrome paint/states fixtures, ButtonMain, Android paint/interaction and
unit tests). The source review's decision (link-mode focus mirrored by a host class) is recorded with its revert path. Native equivalents
declared in the iOS policy (HTML_FORM, CANCELABLE_EVENT, DOM_GLOBAL, SHADOW_DOM, DOM_QUERY): the HTML_FORM effect (submit/reset) is exactly
what R1-02 shows as currently unverified. Gate 1: met; gate-4 evidence for `type` is the open item.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS (r1-002) | r1 iOS 26.3 AWC-r1 (r1-006/008/012) | r1 Android emulator-5564 (r1-A001) |
|---|---|---|---|---|
| Chrome paint, 317 button + 37 FAB cases | 1086 / iOS 1086×3 / Android 712 | **1086/1086** | **1086/1086** | **712/712** (`NativeButtonPaintTest`) |
| Chrome states, 35 + 5 reduced runs | 645 / iOS 645, 645, **636 (18.6)** / Android 645 | **645/645** | 644/645, 645/645, 644/645, 644/645 (4 runs: r1-006, r1-008 ×2, r1-012) | **645/645** (`NativeButtonInteractionTest`) |
| iOS 18.6 states (iPhone 16 Pro) | 636/645 (fi r8o) | — | **641/645, 642/645** (r1-012, new simulator AWC-r1-ios18, iPhone 16 Pro iOS 18.6) | — |
| Button appearance view | 24 | **24/24** | **24/24** | `NativeButtonAppearanceTest` 7/7 |
| Focus view | 68 | **68/68** | **68/68** | `NativeButtonFocusTest` 8/8, `FocusAppearance` 2/2 |
| Inspection view | 88 | **88/88** | **88/88** | `NativeButtonInspectionTest` 4/4 |
| ButtonMain script (shared metric/appearance/slot/action) | 1073 | **1073/1073** | **1073/1073** | unit `NativeButtonContractTest` 6, `NativeButtonBehaviorTest` 6, `NativeButtonFocusTest` 4, `AWCButtonAppearanceTest` 3 — all pass (195/195 module) |
| BehaviorMain script | 164 | **164/164** | **164/164** | — |
| Behaviour view (forms, routing) | no count (traps) | **traps at check 6/36** | (fi: traps) | `NativeButtonBehaviorTest` **4/5** — form validation fails (R1-02) |
| Other Android device classes | — | — | — | Parity 8/8, ExpressiveMetrics 2/2, IconAlignment 1/1, KeyboardMorph 6/6 |
| Button appearance hosts script | 2 | **2/2** | — | — |
| Web | spec+e2e 280/280 (group+split incl.) | spec 610/610 (11 suites of the 9 r1 tags), e2e md-button **21/21** (r1-009) | | |

Every failing check is a `click2` flat-pixel shot (one frame off Chrome's capture window), a different case in each run: iOS 26.3 fails one
shot in 3 of 4 runs (pointer-filled-xl, link-filled-sm, pointer-tonal-sm-dark), iOS 18.6 fails 3–4 shots per run (r1 reproduces fi's
636/645 class). Load averages were 400–940; ios-harness.md "Open items 1" documents the mechanism (click taken from SwiftUI's gesture update
outside `AWCTouchPressRouter`).

## Gate 3 — Laboratory

Through the 4177 server (r1-003, r1-010): SwiftUI and Android sessions open; a pointer click returns one `mdClick` with the source detail
`{value, toggle, selected, href, target}` on both; a property edit (outlined, md) applied by opening a new session changes the frame and the
inspected border (0 → 1). The retained `update` command is refused for md-button on both hosts (**R1-04**). Copied examples: r1 generated the
md-button usage/theme/copied-recipe/event/slot/part examples (15 Swift + 15 Kotlin, `work/audit/r1/examples/generic/ButtonR1.*`) — Swift
typecheck exit 0 (r1-005), Kotlin `:app:compileDebugKotlin` BUILD SUCCESSFUL (r1-A003). Studio 807/807 and native-compiler 12/12 (r1-009).

## Gate 6 — runtime and accessibility

tools/ax re-run (r1-007 macOS/Web/iOS, r1-A005 Android): 8 cases, **0 open findings, 0 accepted expectations** on macOS, iOS and Android;
the report is identical to the installed one apart from its timestamp. Conventions used by the comparator (iOS toggle as switch trait,
Tab walk ending at ∅ on iOS, iOS 40 pt targets reported as info) are platform encodings, not hidden defects. iOS runtime: see R1-01.

## Exceptions

None proposed. Reviewed "known differences": Android whole-pixel content placement (border box compared to 1 dp) is an explained raster
difference; the "`::part(state-layer)` opacity has no Laboratory control" note is stale (R1-09).

## Findings

R1-01, R1-02, R1-04 (blocking); R1-09, R1-10 (non-blocking). Details and suggested fixes: [DEFECTS.md](../../../../audit/DEFECTS.md).
