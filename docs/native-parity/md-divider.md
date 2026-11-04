# Divider migration audit

Status: source review, native implementation, measured Web/macOS SwiftUI/Android comparisons and Laboratory checkpoints passed. Independent final review and iOS execution remain pending.

## Source contract and corrected behavior

`md-divider` declares four boolean properties (`inset`, `insetStart`, `insetEnd`, `vertical`), no events, no methods, no slots, one real inner painted `divider` part, and four public style hooks. The new native renderers replace the prior generic system dividers, which used unrelated colors, fixed vertical lengths (Swift56 / Android48), incomplete vertical insets and incorrect combined-flag behavior.

| Web surface | Native counterpart |
| --- | --- |
| Four properties | Same camelCase keys, live-updatable; all four right-panel editors remain enabled |
| Horizontal line | Full proposed width and authored thickness; insets affect only the painted part |
| Vertical line | Authored thickness, proposed parent height, one text-em minimum rather than a fixed48/56 height |
| Middle/start/end inset | Exact source cascade: `insetEnd` wins over `insetStart`, which wins over `inset`; flags do not combine by OR |
| RTL | Leading/trailing horizontal margins reverse; vertical top/bottom margins remain unchanged |
| `--md-divider-color` | `AWCDividerAppearance.color`, overriding the current outline-variant token |
| `--md-divider-thickness` | `thickness`, finite and nonnegative, including explicit zero |
| `--md-divider-inset-start/end` | `insetStart` / `insetEnd`, finite signed dimensions; negative margins extend the line |
| `::part(divider)` | Actual measured native inner line, with its own bounds and margins |
| Hidden host | `hidden:true` removes the native rendered subtree; conditional native composition is also available |
| Accessibility | Native separator label and horizontal/vertical value; screen-reader execution and exact platform role mapping are not yet certified |

SwiftUI uses `.awcDividerAppearance`; Compose uses `AWCDividerAppearanceScope`. Nested scopes merge fieldwise. Native hosts accept `dividerAppearanceDefaults` and `dividerAppearance`; the override applies only supplied valid fields. There are no invented events or imperative methods.

## Current evidence

- Source suite:14/14 tests passed using Jest with the Stencil preset.
- Browser source oracle:45 hydrated cases, including all8 flag combinations in both orientations and directions, custom color/thickness, zero thickness, negative/oversized insets in LTR and RTL, vertical minimum and hidden state. Captured JSON is checked in for reproducible native comparisons.
- Shared controls, style transport and examples:126/126 relevant tests passed. This includes all seven usage languages and an example targeting the real inner line.
- Android: 69 unit tests passed, including two Divider contracts. Both final focused device methods passed against all 45 browser fixtures, including effective physical-pixel margins and coordinate limits. All 93 captured build/source inputs stayed unchanged during the run. Raw reports, logs and hashes are retained in `android/final-45/`.
- Swift library and host adapters compile. The separate `test-native-divider.sh` runner passed276 actual SwiftUI checks against all45 fixtures, including authored color pixels, zero-area lines, hidden state and appearance validation. This exposed and corrected double-mirroring in SwiftUI's RTL custom layout.
- Seven generated Swift and seven Kotlin examples compiled successfully; commands, exact sources and hashes are retained in `examples/verification.json`.
- Laboratory now uses one centered300×96 context on all three platforms. The prior Web captions and forced280px width were removed, and native hosts use the same explicit parent dimensions.
- Browser integration: all four properties are enabled. Shared style edits set color `#123456`, thickness 3, start inset 12 and end inset 28. Web measured a 3×56 painted line inside the 3×96 vertical host; both actual native frame inspectors measured 3×96. Switching SwiftUI to horizontal and dark theme produced 300×3. Separate native fixture tests verify the corresponding inner line and color pixels. Captures and `browser-verification.json` are retained.

External artifacts: `outputs/native-parity/md-divider` in the task workspace. `web-evidence.json` records source/artifact hashes, runtime, test command and fixture count. Checked-in fixtures are `packages/native-ios/Tests/Fixtures/DividerWebGeometry.json` and `apps/native-android-playground/src/androidTest/assets/DividerWebGeometry.json`.

## Boundaries still requiring review

Native lengths use points/dp rather than CSS pixels, and Compose rounds layout to device pixels. Android rejects unrepresentable layout coordinates by constraining internal paint dimensions to its finite integer layout range; ordinary editable dimensions are unaffected. SwiftUI's intrinsic vertical minimum uses a scalable16pt body em; Compose uses the inherited `LocalTextStyle` font size. Browser CSS font inheritance has no identical SwiftUI introspection API. Explicit parent dimensions are used for the comparison fixtures.

CSS selector execution is replaced by a typed appearance API, and colors use resolved six-digit hex values. Browser `forced-colors` maps to increased-contrast ink on SwiftUI; equivalent Android high-contrast behavior and actual assistive-technology execution still need review. These are recorded gaps/boundaries, not accepted exceptions. No iOS SDK, simulator or connected iOS device is available; macOS SwiftUI checks cannot certify iOS.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeDividerViewIntegration` | **276/276** | **276/276** | **276/276** |
| **Total** | **276/276** | **276/276** | **276/276** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
