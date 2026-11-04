# md-switch — gate 7 independent audit

**Verdict: FAIL (findings R4-06, R4-07, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-switch (no supporting tags). Snapshot audited: `work/audit/r4-tree`, a copy of the canonical tree taken
2026-10-31 02:12 (Mac time) by job r4-001 (42 install jobs, latest fx-072-install-orgchart-apk). All re-runs below were
made by r4 on that snapshot (Mac lane r4, Android lane a6 / emulator-5566, simulator AWC-r4 = iPhone 17 Pro, iOS 26.3.1).
Lab working files: `work/audit/r4/` (PROGRESS.md, runs/, matrix/, examples/).

## Evidence freshness

The existing evidence is stale: the source hashes in `outputs/native-parity/md-switch/native-swift/checkpoint.json`,
`native-android/checkpoint.json` and `laboratory/checkpoint.json` no longer match the canonical `NativeSwitch.swift`,
`SwitchAppearance.swift`, `NativeSwitch.kt`, `NativeSwitchParityTest.kt` and `NativeSwitchPaintIntegration.swift`
(changed after 2026-10-26), and the shared dispatch/focus files (`AWCNativeView.swift`, `NativeFocus.swift`,
`NativeFocusBridge.swift`, `AWCComponent.kt`) changed on 2026-10-30 23:12, after the documented iOS gate-6 runs
(`fi-tree-r8`) and the tools/ax report (2026-10-29 11:11). The counts below therefore come from r4 re-runs.
Shared oracles: `Tests/Fixtures/switch-web-*.json` and the Android assets `SwitchWeb*.json` are byte-identical; they equal
`outputs/native-parity/md-switch/web-oracle/web-*.json` case for case (the fixtures add only source/common hashes).

## Gate 1 — source contract matrix

Source: `packages/core/src/components/md-switch/md-switch.tsx/.css`; IR `packages/native-compiler/generated/ir/md-switch.json`
is current (its sha256 = tsx + css of the snapshot); CEM, IR and `current-inventory.json` (r4-004a) agree: 12 properties,
3 events, 5 methods, 2 slots, 12 hooks, 4 parts (AUDIT row 12/3/5/2/12).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 12 properties (`valueMissingLabel`, `selected`, `disabled`, `softDisabled`, `required`, `name`, `value`, `icons`, `showOnlySelectedIcon`, `selectedIcon`, `unselectedIcon`, `density` 0…−4) | NativeSwitch.swift, SelectionControl.swift | NativeSwitch.kt, SelectionControl.kt | retained updates (`SWITCH_UPDATE_PROPERTIES`) | switch-web-paint (430 cases), switch-web-states, LivePreviewSelectionHostTest, selection-integration.test.mjs |
| 3 events (`mdInput` cancelable `{selected}`, `mdChange` `{selected}`, `mdValidityChange`) | yes | yes | event stream (probe: `mdValidityChange` after `setCustomValidity`) | states runs (payload, order, cancellation) |
| 5 methods (`setFocus`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity`) | `AWCSelectionControlController` | same | `nativeSelectionMethod` | validation paint cases, host test |
| 2 slots (`selected-icon`, `unselected-icon`) | yes | yes | content slots | paint cases |
| 12 hooks | `AWCSwitchAppearance` | same | selection-appearance.js | paint hook cases |
| 4 parts (`track`, `state-layer`, `handle`, `icon`) | `AWCSwitchPartAppearance` | same | `SELECTION_PARTS` | paint part cases |

Every row has all four. Full grep matrix: `work/audit/r4/matrix/md-switch.txt`.
Open behaviour gap: the source ignores key-repeat keydown (`md-switch.tsx:321`, spec test "ignores auto-repeat
keydown"); both native filters exist but **no native test** sends a repeat (R4-06).
Open decision: the `<fieldset disabled>` behaviour shared through `formDisabledCallback` is undecided (R4-07).

## Gates 2, 4, 5 — re-runs (claimed vs r4)

| Suite | Claimed (docs/AUDIT) | r4 result | Job |
|---|---|---|---|
| macOS `NativeSwitchPaintIntegration` (430 cases) | 10,447/10,447 | **10,447/10,447** (0 skipped) | r4-006 |
| macOS `NativeSwitchStatesIntegration` (17 runs) | 28,963/28,963 | **28,765/28,765** (per-frame sample count) | r4-006 |
| Android `NativeSwitchParityTest` | 10,447/10,447 | **10,447/10,447** | r4-A002 |
| Android `NativeSwitchInteractionTest` | 26,285/26,285 | **26,285/26,285** | r4-A002 |
| iOS sim (AWC-r4, iPhone 17 Pro 26.3) paint | 10,447/10,447 | **10,447/10,447** (0 skipped) | r4-011 |
| iOS sim states | 16,579/16,579 | **16,513/16,513** | r4-011 |

## Gate 3 — Laboratory

- Live previews through the running server (127.0.0.1:4177, job r4-002a, `runs/lab/probe.log`): SwiftUI and Compose
  sessions open; retained update `{selected:false}` accepted; `checkValidity()` → `true`, `setCustomValidity('Audit error')`
  + `reportValidity()` → `mdValidityChange {valid:false, validationMessage:"Audit error"}` and the supporting line grows
  the host (48 → 66 pt). 
- **R4-17**: on Android a retained update that does not change the value (`{softDisabled:false}`) returns
  `502 ANDROID_HOST_FAILED` and the session is lost (r4-006a `runs/lab/update-matrix-android.log`); the SwiftUI host accepts it.
- Copied examples regenerated from the snapshot's released policies (118 SwiftUI + 118 Compose, byte-identical to the
  gate-3 set): `swiftc -typecheck` 0 errors (r4-007); Compose `:app:compileDebugAndroidTestKotlin` BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced) (r4-A006/A007).
- Studio: selection/modal/menu integration + native method/property/live suites 110/110 (r4-008);
  Android `LivePreviewSelectionHostTest` 4/4 (r4-A002); SwiftUI live host `test-live-selection` **failed once** in r4-020 (checkbox "valid again hides the message": the frame was read before the retained `{checked:true}` update rendered, under load); two reruns 38/38 (r4-034) — not counted (r4-020).

## Gate 6 — runtime and accessibility

- macOS and Android: above. iOS: r4 re-ran iPhone 17 Pro / iOS 26.3 only (table above). The documented iPad Pro 11
  (26.3) and iPhone 16 Pro (18.6) runs (`outputs/native-parity/_ios/fi/console-r8p-*`, `r8o-*`, 27,098 and 27,044 checks)
  exist but predate the 2026-10-30 23:12 shared-file changes; not re-run by r4.
- tools/ax re-run (r4-020/A005/021, `work/audit/r4/runs/ax/md-switch/report.md`): 5 cases (off, on, disabled, soft-disabled, required): macOS pass (1 accepted), iOS pass, Android pass; 0 open.
- Expectation reviewed and **accepted** as a convention: macOS reports `AXRequired` where Chrome drops `aria-required` for
  the switch role (the native side follows the source; iOS has no required channel).

## Exceptions

No exception record was proposed for md-switch. Documented differences reviewed: Compose `Role.Switch` vs AppKit
`AXCheckBox`+`AXSwitch` subrole (platform role mapping, accepted as convention — tools/ax F2); Enter inert, Space on
key-down (source behaviour). None accepted as a waiver of R4-06/R4-07/R4-17.

## Findings

- **R4-06** (gate 4): held-Space key-repeat filter untested on macOS and Android.
- **R4-07** (gate 1, docs): shared `<fieldset disabled>` decision undecided (recorded only in the checkbox review).
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-18 (hygiene, non-blocking): stale checkpoint hashes; AUDIT row has two different gate-6 entries; md-switch.md still
  says the iOS compile check was not run; `NativeSwitchParityTest.kt` header says validation cases are skipped (they run).
