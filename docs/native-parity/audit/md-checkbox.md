# md-checkbox — gate 7 independent audit

**Verdict: FAIL (findings R4-06, R4-07, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-checkbox (no supporting tags). Snapshot audited: `work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time,
job r4-001; 42 install jobs, latest fx-072). Re-runs by r4 on that snapshot (Mac lane r4, Android lane a6 / emulator-5566,
simulator AWC-r4 = iPhone 17 Pro, iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

Stale: checkpoint hashes in `outputs/native-parity/md-checkbox/{native-swift,native-android,laboratory}/checkpoint.json`
do not match the canonical `NativeCheckbox.swift`, `NativeCheckbox.kt`, `NativeCheckboxParityTest.kt`,
`NativeCheckboxPaintIntegration.swift`; the shared dispatch/focus files changed 2026-10-30 23:12 (after the iOS r8 runs
and the 2026-10-29 tools/ax report). Counts below are r4 re-runs. Oracles: `checkbox-web-*.json` (Swift) and
`CheckboxWeb*.json` (Android) byte-identical; case-for-case equal to `outputs/native-parity/md-checkbox/web-oracle/`.

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: 12 properties, 2 events, 4 methods, 0 slots, 14 hooks, 5 parts (AUDIT 12/2/4/0/14).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 12 properties (`valueMissingLabel`, `error`, `errorText`, `supportingText`, `checked`, `indeterminate`, `disabled`, `softDisabled`, `required`, `name`, `value`, `density`) | NativeCheckbox.swift + SelectionControl.swift | NativeCheckbox.kt + SelectionControl.kt | `CHECKBOX_UPDATE_PROPERTIES` | checkbox-web-paint (261), states (12 runs + reduced), host test |
| 2 events (`mdChange` cancelable `{checked, indeterminate}`, `mdValidityChange`) | yes | yes | event stream | states runs, host test |
| 4 methods (`getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity`) | controller | controller | `nativeSelectionMethod` | validation paint cases, `checkboxReportShowsTheSupportLine` |
| 14 hooks / 5 parts (`target`, `state-layer`, `container`, `icon`, `supporting-text`) | `AWCCheckboxAppearance` / part appearance | same | selection-appearance.js | paint cases |

All rows have all four (`work/audit/r4/matrix/md-checkbox.txt`). Gaps: the key-repeat filter (source C1 fix,
`md-checkbox.tsx:315`) is tested on Android (`heldSpaceTogglesOnce`) but not on macOS/iOS (R4-06); the
"Observed, not changed (decisions needed)" items of the source review (aria-invalid at rest when required;
`<fieldset disabled>` painted enabled and tabbable) are not decided or recorded as decisions (R4-07).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeCheckboxPaintIntegration` | 6,019/6,019 | **6,019/6,019** (0 skipped) | r4-006 |
| macOS `NativeCheckboxStatesIntegration` | 34,938/34,938 | **35,538/35,538** (per-frame count) | r4-006 |
| Android `NativeCheckboxParityTest` | 5,759/5,759 | **5,759/5,759** | r4-A002 |
| Android `NativeCheckboxInteractionTest` (+ `heldSpaceTogglesOnce`) | 23,310/23,310 | **23,310/23,310**, held-Space ok | r4-A002 |
| iOS sim paint | 6,019/6,019 | **6,019/6,019** (0 skipped) | r4-011 |
| iOS sim states | 17,766/17,766 | **17,856/17,856** | r4-011 |

## Gate 3 — Laboratory

- 4177 probe (r4-002a): SwiftUI + Compose sessions; update `{checked:false, indeterminate:true}` accepted;
  `checkValidity()` → `true`; `setCustomValidity` + `getValidity` → `mdValidityChange {valid:false}`.
- **R4-17**: Android no-op update `{softDisabled:false}` → 502, session lost (r4-006a); SwiftUI accepts.
- Examples (118 + 118, regenerated, byte-identical to the gate-3 set): Swift typecheck 0 errors (r4-007); Compose
  BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced). Studio 110/110 (r4-008); `LivePreviewSelectionHostTest` 4/4 (r4-A002); `test-live-selection` **failed once** in r4-020 (checkbox "valid again hides the message": the frame was read before the retained `{checked:true}` update rendered, under load); two reruns 38/38 (r4-034) — not counted.

## Gate 6 — runtime and accessibility

- iOS re-run on iPhone 17 Pro 26.3 only; the documented iPad / iOS 18.6 r8 runs (17,778 / 17,748 states) predate the
  2026-10-30 shared changes.
- tools/ax re-run: 8 cases (unchecked, checked, indeterminate, disabled, soft-disabled, error, error-appears, required): macOS pass (1 accepted; indeterminate = `AXValue 2`), iOS pass, Android pass; 0 open. Expectation `required` (macOS `AXRequired`, Chrome drops it) **accepted** as convention.
- md-checkbox.md "Differences and limits" still says macOS has no mixed state; the 2026-10-29 capture and the r4 re-run show
  `AXValue 2` for indeterminate (stale statement, R4-18).

## Exceptions

None proposed. Space-on-keydown and Enter-inert follow the source. Nothing accepted as a waiver.

## Findings

- **R4-06** (gate 4): macOS/iOS key-repeat filter untested.
- **R4-07** (gate 1): open decisions in the source review not decided/recorded.
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-18 (hygiene): stale checkpoints, duplicate gate-6 AUDIT entries, stale "no mixed state" statement.
