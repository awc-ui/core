# md-button — gate-7 independent audit

Reviewer: gate-7 reviewer r1. Round 1: 2026-10-31 (all seven FAIL, defects R1-01…R1-11 in
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section r1). **Re-check (round 2): 2026-11-09**, after the fixes marked FIXED there
(fx-089-install-button-family, di-054-install-residual-harness, d4-016-install-r104, n3-051). Everything was re-run by r1 on a fresh snapshot
`work/audit/r1-tree` of the canonical tree taken 2026-11-09 13:42 UTC (latest installs n5-057, n2-082, d6-049, di-054, fx-090, fx-089; hash
manifest `work/audit/r1/v2/snap/manifest.sha256`); the Laboratory probes use the running 4177 server. Timing runs went through
`tools/slot.sh timing 4`; Mac load average 5–12. Job logs `work/claude-runner/done/r1-02[0-6]*.log`, `r1-A02[0-6]*.log`; outputs
`work/audit/r1/v2/` (swift/, ios/, android/, lab/, web/, ax/, examples/, gate1/). Simulators: AWC-r1 (iPhone 17 Pro, iOS 26.3.1) and
AWC-r1-ios18 (iPhone 16 Pro, iOS 18.6); Android emulator-5564 (AwcNative6, API 36).

The seven `checkpoint.json` files (fx-089, 2026-11-07) are already stale against this snapshot (shared `AWCNativeView.swift`,
`NativeFocusBridge.swift`, `AWCComponent.kt` changed for all seven; also `NativeFab.swift`/`.kt`, `NativeIconButton.swift`), and they record
iOS states failures themselves (fab 32, group 2, icon 4, segmented 3, split 1; md-button's has no results): the counts below are r1's re-runs.
The coordinator's note that fx-092/fx-093 confirmed the family checkpoints does not match the logs: fx-091 found its own iOS gate unmet and
did not queue fx-092 (no fx-092 job exists in `claude-runner/done`), and fx-093 exited "fx-092 exit '': no records".

## Verdict (re-check 2026-11-09): PASS

All round-1 findings for md-button are verified fixed: **R1-01** (iOS states 645/645 on iOS 26.3 and twice on iOS 18.6), **R1-02** (form
submit/reset: Android `NativeButtonBehaviorTest` 5/5 + `NativeAutomaticFormTest` 6/6, `NativeBehaviorViewIntegration` 35/35 on macOS and iOS),
**R1-04** (retained Laboratory updates), R1-09/R1-10 (docs refreshed; a checkpoint exists — stale now, see header). No exception is
proposed or needed. Non-blocking: R1-14 (bracket span limit in the iOS harness), R1-10 note (md-button's checkpoint has no results section).

## Component notes

- Gate 1: contract unchanged (24 properties, 2 events, 0 methods, 4 slots, 6 parts, 28 hooks = 64 rows); r1's regenerated matrix
  (`work/audit/r1/v2/gate1/matrix/md-button.md`) has no empty column.
- Gates 2/4/5: Chrome 153 paint 1086 / states 645 on macOS, iOS 26.3 (645, one `BRACKET` match: pointer-filled-xl click2) and iOS 18.6
  (645 ×2, one `BRACKET`); Android 712 / 645; behaviour composition fixed (above). Web e2e 23/23.
- Gate 3: retained `variant` update applied on both hosts (frame changes); `mdClick` detail `{value, toggle, selected, href, target}`; 15 + 15
  md-button examples compile.
- Gate 6: iOS runtime above; tools/ax 8 cases, 0 open.

## Shared re-check results (all seven tags)

| Suite | macOS (r1-022) | iOS 26.3 (r1-023) | iOS 18.6 (r1-023) | Android (r1-A021) |
|---|---|---|---|---|
| Chrome 153 family paint (`NativeButtonFamilyPaintIntegration` / `NativeButtonFamilyPaintTest`) | **974/974** | **974/974** | — | **974/974** |
| Chrome 153 family states + reduced motion (`NativeButtonFamilyStatesIntegration` / `NativeButtonFamilyStatesTest`) | **26826/26826** | 24530/24577 (47 fail) | 25710/25732 (22 fail) | **18241/18241** |
| md-button Chrome paint / states | **1086/1086**, **645/645** | **1086/1086**, **645/645** | **645/645**, **645/645** | **712/712**, **645/645** |
| View suites (appearance 24, focus 68, inspection 88, icon 284, group 87, fab 94, fab-menu 19 + 134 + 27, segmented 370, split 945, behaviour 35) | all pass | all pass | — | 133/133 device methods (22 classes incl. `LivePreviewButtonFamilyHostTest` 9, `LivePreviewHostTest` 19, `NativeButtonBehaviorTest` 5, `NativeAutomaticFormTest` 6) |
| Contract mains (ButtonMain 1073, BehaviorMain 164) | pass | pass | — | native-ui unit 195/195 |
| Live SwiftUI hosts (fab, fab-menu 24, icon-button, button-group, segmented 12, split 13, preview) + button-hosts 2 | all pass | — | — | — |
| Web (r1-024) | spec 612/612 (11 suites of the 9 tags); e2e button 23, group 8, fab 29, fab-menu 18, item 5, icon 4, segmented 10, set 3, split 12 — all pass; native-compiler 12/12; Studio 865/868 (the 3 failures are md-*-chart / md-organization-chart tests, outside this family) | | | |
| tools/ax (r1-025, r1-A023) | 30 cases on macOS, iOS and Android: 0 open findings, 0 accepted expectations; reports identical to the installed ones | | | |
| Copied examples (r1-022, r1-A022/A026) | r1 generic generator 84 + fork generators 67 per platform: 13 Swift files typecheck (exit 0); 13 Kotlin files compile in the playground app (`:app:compileDebugKotlin`; 44 `r1ex` classes built 2026-11-09 16:46) | | | |
| Laboratory (r1-024) | retained `update` → 200 on all 14 sessions (7 tags × SwiftUI/Android); clicks emit the source events with child identity (group: `md-button`/`segment-0` on both hosts); `setMenuIcon`, `show`/`whenClosed`/`close` fulfilled with `mdOpen`/`mdClose`; open md-fab-menu `component` = item stack 164×152 on both; default md-split-button 232.5×56 SwiftUI / 232×56 Android vs Web 232.219 | | | |

iOS family-states failures by tag (r1-023): **md-fab** 26.3: 33 extend/collapse motion boxes + 5 `click2` shots (fab-pointer-large mean 8.25,
>6: 7860/17297, one frame in the window); 18.6: 12 motion boxes + 3 `click2`; **md-button-group** `bg-disabled-child/enter` box 221.73 vs Chrome
219.45–220.11 (26.3 ×3, 18.6 ×1); **md-icon-button** `click2` (26.3: ib-pointer-filled, ib-pointer-xl; 18.6: ib-pointer-dark-filled,
ib-pointer-toggle-filled); **md-segmented-button** `click2` (26.3: seg-pointer-select; 18.6: seg-pointer-select, -no-checkmark, -rtl,
reduced/seg-pointer-select); **md-split-button** 26.3: split-pointer-leading-filled/click2, split-pointer-trailing-rtl/click2 (>6: 1404),
split-keyboard/enter (mean 2.88, >6: 3961); 18.6: none. **md-fab-menu: none on either runtime.** Console logs:
`work/audit/r1/v2/ios/console-g7v2-{i-buttonfamilystates,o-familystates}.log`.

Harness corrections reviewed (gate 5): ios-harness.md items 46 (blend of two straddling frames, `BRACKET`) and 47 (iOS md-button captures two
display frames past Chrome's window) are iOS-only, documented with probes (`NativeIOSTimelineDateProbe`) and keep the pixel thresholds; r1
accepts them as capture corrections, not exceptions — with one limit filed as R1-14 (a bracket may span frames 42.5 ms apart when the captures
in between are identical). The family states fixture on canonical still uses fx's p4 midpoint candidate (all platforms); di's port (p5,
fx-092) was never installed.

## Exceptions

None accepted or pending for this component (round-1 proposals: md-fab-menu's two were rejected and the behaviours were since made equal).

## Findings

Open and verified items with evidence and suggested fixes: [DEFECTS.md](../../../../audit/DEFECTS.md) (section r1, re-check lines dated
2026-11-09). Round-1 record of this audit: `work/audit/r1/docs/md-button.md`.
