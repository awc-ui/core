# Icon Button migration audit

Status: implementation and integration review completed on Web, macOS SwiftUI and Android. iOS device/simulator execution and final catalog certification remain pending. This is an individual component record, not acceptance of the remaining catalog.

## Source contract

Reviewed `packages/core/src/components/md-icon-button/md-icon-button.tsx` and its CSS. The component declares 19 properties, one event, two slots, no public methods, three CSS parts and nine public CSS custom properties.

The SwiftUI and Compose adapters now implement all 19 declared properties. Native appearance has a dedicated `AWCIconButtonAppearance` type with `containerColor`, `iconColor`, `stateLayerColor`, `iconSize`, `cornerRadius`, `outlineColor`, `outlineWidth`, `width` and `height`. The Laboratory sends these same values to each renderer.

The component's behavior differs intentionally from `md-button`: safe navigation and toggle selection commit before `mdClick({selected})`. Cancellation marks that notification but cannot undo those effects. No `mdChange` or imperative source method is invented. Selected colors and shape can apply without toggle, while selected-slot content requires selected toggle mode.

Default and selected slots preserve authored symbols, text, explicitly empty elements and badge adornments. An empty element suppresses the fallback; incidental raw whitespace does not. Badges and avatars retain their own dimensions. Their complete internal parity remains part of their separate audits.

## Laboratory and documentation

- All 19 source property editors are present and enabled in both native previews after catalog regeneration.
- Both icon slots and the action's accessible name can be edited on all platforms.
- Nine shared style controls map to the exact source hooks; the controls preserve zero and fractional values and support resetting the component's style.
- Native selection updates the configuration and copyable usage code, and survives switching to the Web preview.
- Usage and API examples cover the event, both slots, all three parts and the appearance API.

The public native APIs replace DOM nodes, browser windows, CSS selector evaluation and DOM event objects with native composition, routing and event scopes. Exact boundaries are listed in the platform records; these are not exemptions for ordinary visual or interaction states.

## Verification evidence

- Web source suite: 58/58 tests passed using Jest directly with the repository's Stencil preset. The integrated Stencil runner stalled before results; its output is preserved and is not counted as a pass.
- Shared Laboratory integration: 132/132 tests passed.
- The focused documentation, slot, configuration and snippet review passed 87/87 tests. This overlaps the integration run; the counts are not summed.
- Native compiler: 12/12 tests passed.
- Eight generated Swift and eight Kotlin Usage/API examples compiled; six additional Swift authored-slot examples also typechecked.
- Browser comparison: Web and Android measured 96 × 96 for the authored default; all three renderers measured 80 × 56 after explicit style edits. Custom `star`/`check` slots, actual native activation, selected-state persistence, all 19 enabled property editors and light/dark rendering were checked. Android selection was checked again after installation of the final reviewed patch.
- Swift: 770 contract checks passed, including 281 Icon Button checks; 268 real Icon Button view checks, 68 focus checks and 88 existing Button inspection checks passed. The live host exercised all nine appearance fields, geometry/parts, pointer release, Space, exactly one source `mdClick` and explicit empty selected-slot content. Preview regressions also passed 23 slot contracts and 27 native preview/production checks.
- Android: 54 unit tests and 12 device tests passed, including 75 geometry and 32 palette subcases. Two focused overlay regressions passed after the final ripple and state-layer corrections. The earlier 12-test device run is not represented as a fresh full-suite run after those last changes.

Independent review found and required corrections for the Android selected/disabled outlined palette, explicit empty slot wrappers, ripple color and outlined state-layer bounds. These findings are retained as part of the audit rather than hidden by an aggregate pass count.

Platform records:

- [SwiftUI implementation and runtime record](../../packages/native-ios/audits/md-icon-button.md)
- [Android implementation and runtime record](../../packages/native-android/audits/md-icon-button.md)

External run artifacts are in `../../../../outputs/native-parity/md-icon-button` relative to this record: generated sources, compiler results, logs, `browser-verification.json` and screenshots. Example compilation and platform test records include source hashes. The final catalog audit must rerun shared-runtime gates after subsequent component migrations; these results describe the Icon Button checkpoint.

## Unverified gates

No iOS SDK, simulator or connected iOS device is available in this environment. The shared SwiftUI implementation and actual macOS native views are tested; UIKit focus, iOS keyboard behavior and VoiceOver execution are **not** certified by those tests. This remains an unverified platform gate, not an accepted migration exception.

The independent final catalog audit and dependent badge/avatar audits remain pending. Therefore this component is not labeled fully certified across all requested platforms.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeIconButtonViewIntegration` | **284/284** | **284/284** | **284/284** |
| **Total** | **284/284** | **284/284** | **284/284** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
