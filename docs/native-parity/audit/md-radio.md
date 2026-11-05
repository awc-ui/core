# md-radio — gate 7 independent audit

**Verdict: FAIL (findings R4-07, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-radio (no supporting tags). Snapshot audited: `work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time,
job r4-001). Re-runs by r4 on that snapshot (Mac lane r4, Android lane a6 / emulator-5566, simulator AWC-r4 = iPhone 17 Pro,
iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

Stale: checkpoint hashes (`outputs/native-parity/md-radio/*/checkpoint.json`) do not match canonical `NativeRadio.swift`,
`NativeRadio.kt`, `NativeRadioParityTest.kt`, `NativeRadioPaintIntegration.swift`; shared dispatch/focus files changed
2026-10-30 23:12 (after iOS r8 and tools/ax 2026-10-29). Counts below are r4 re-runs. Oracles `radio-web-*.json` /
`RadioWeb*.json` (incl. `radio-web-group`) byte-identical and case-for-case equal to `outputs/native-parity/md-radio/web-oracle/`.

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: 8 properties, 4 events, 8 methods, 0 slots, 7 hooks, 4 parts (AUDIT 8/4/8/0/7).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 8 properties (`valueMissingLabel`, `checked`, `disabled`, `softDisabled`, `required`, `name`, `value`, `density`) | NativeRadio.swift + group registry | NativeRadio.kt | `RADIO_UPDATE_PROPERTIES` | radio-web-paint (161), states (10 runs), group (6), host test |
| 4 events (`mdChange` `{checked, value}`, `mdFocus`, `mdBlur`, `mdValidityChange`) | yes | yes | event stream: `select()` → `mdChange`; `setFocus()` → `mdFocus`, `setBlur()` → `mdBlur` (SwiftUI, r4-004b) | states/group runs |
| 8 methods (`syncValidityFromGroup`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity`, `setFocus`, `setBlur`, `select`) | controller | controller | `nativeSelectionMethod` | `radioReportSelectAndFocusMethods`, validation paint cases |
| 7 hooks / 4 parts (`state-layer`, `container`, `outer-circle`, `inner-circle`) | `AWCRadioAppearance` / parts | same | selection-appearance.js | paint cases |

All rows have all four (`matrix/md-radio.txt`; the two "lab=0" grep hits for mdFocus/mdBlur are generic event
plumbing, confirmed live). Noted, not findings: native groups are scoped to the native tree/`AWCNativeScope` (Android:
the window) instead of the document — a named equivalent of the source's name-scoped group; the `required` group rule is
checked natively against the source rule (no Chrome oracle run for it).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeRadioPaintIntegration` | 3,335/3,335 | **3,335/3,335** (0 skipped) | r4-006 |
| macOS `NativeRadioStatesIntegration` | — (doc gives none for macOS) | **21,780/21,780** | r4-006 |
| Android `NativeRadioParityTest` | 3,177/3,177 | **3,177/3,177** | r4-A002 |
| Android `NativeRadioInteractionTest` (states + group) | — | **16,131/16,131** + group **121/121** | r4-A002 |
| iOS sim paint | 3,335/3,335 | **3,335/3,335** (0 skipped) | r4-011 |
| iOS sim states | 11,362/11,362 | **11,387/11,387** | r4-011 |

## Gate 3 — Laboratory

- 4177 probe (r4-002a): SwiftUI + Compose sessions; update `{checked:false}`; `select()` → `mdChange {checked:true}`;
  `checkValidity()` → `true` (both platforms). SwiftUI `setFocus`/`setBlur` → `mdFocus`/`mdBlur` (r4-004b).
- **R4-17**: on Android every retained update that leaves the value unchanged (`{softDisabled:false}`) returns
  `502 ANDROID_HOST_FAILED` and drops the session (3/3 in r4-005c, again in r4-006a); changed values (`checked`,
  `softDisabled:true`, `disabled`, `required`, `density`, `value`) succeed; SwiftUI accepts all. The Android
  `setFocus`/`setBlur` event check could therefore not be run in that session.
- Examples 118 + 118 (Swift typecheck 0 errors, r4-007; Compose BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced)); Studio 110/110; host test 4/4; **failed once** in r4-020 (checkbox "valid again hides the message": the frame was read before the retained `{checked:true}` update rendered, under load); two reruns 38/38 (r4-034) — not counted.

## Gate 6 — runtime and accessibility

- iOS re-run on iPhone 17 Pro 26.3 only; documented iPad/18.6 r8 runs predate the 2026-10-30 shared changes.
- tools/ax re-run: 5 cases (unchecked, checked, disabled, soft-disabled, required): macOS pass (1 accepted), iOS pass, Android pass; 0 open. Expectation `required` (macOS `AXRequired`) **accepted** as convention.

## Exceptions

None proposed. Document-order arrow navigation (rendered order) and per-scope groups reviewed as named equivalents.

## Findings

- **R4-07** (gate 1): the shared `<fieldset disabled>` decision (`formDisabledCallback`, same code as checkbox/switch) is
  undecided; the radio review does not mention it.
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-18 (hygiene): stale checkpoints; duplicate gate-6 AUDIT entries.
