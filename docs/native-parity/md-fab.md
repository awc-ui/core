# FAB migration audit

Status: native implementation, focused Web/macOS SwiftUI/Android checks and Laboratory browser checkpoints passed. iOS simulator execution (iPhone 17 Pro iOS 26.3, iPhone 16 Pro iOS 18.6, gate 6) passed; the gate-7 verdict is in AUDIT.md.

## Source and implementation

The [source review](md-fab-source-review.md) covers all ten properties, one named icon slot, the `mdClick` event, asynchronous `setMenuIcon` method, three rendered parts and five appearance hooks. Both native implementations now preserve those surfaces, including optional versus explicit `extended`, label-driven sizing, source density steps, disabled/soft-disabled behavior, lowered palettes/elevation, RTL padding, authored slot fallback and temporary icon restoration.

`AWCFabAppearance` exposes containerColor, iconColor, iconSize, cornerRadius and labelColor. SwiftUI applies it through `.awcFabAppearance`; Compose uses `AWCFabAppearanceScope`. Public scoped controllers implement the temporary menu icon without mutating the authored icon or slot. Native activation carries actual input metadata; no fabricated selected state or change event is emitted.

The Laboratory exposes the ten properties, five style fields, text/symbol icon content and the real method control. Live/snapshot hosts accept appearance defaults and local overrides. A method acknowledgment follows actual controller invocation, not merely the next captured frame.

## Evidence

- The hydrated Web reference contains56 geometry cases and five method states, with source tests and file hashes in workspace `outputs/native-parity/md-fab/web-evidence.json`.
- SwiftUI:141 FAB contracts passed within the overlapping1,072-check shared runner;94 actual native view checks passed, including geometry, authored color pixels, state transitions, held pointer/keyboard/accessibility activation, cancellation, disabled behavior and temporary icon set/clear. The live-host JSON method/frame check passed and all preview products rebuilt. See [SwiftUI audit](../../packages/native-ios/audits/md-fab.md).
- Android:69 unit tests passed, including five FAB contracts; all11 scoped FAB/device-host cases and25 existing button/icon regression cases passed. The combined report retains one unrelated Divider asset-packaging failure and its later successful focused correction. See [Android audit](../../packages/native-android/audits/md-fab.md).
- Ten generated Swift and ten Kotlin Usage/API examples compiled against the public native APIs. Exact sources, commands, result logs and hashes are preserved in `outputs/native-parity/md-fab/examples/verification.json`.
- Laboratory browser checks: all ten properties remain available on both native platforms; all five shared style fields were edited. Both native method controls acknowledged `setMenuIcon`, and clearing the override restored authored Material Symbol content after reconnection. Actual preview-image clicks emitted `mdClick` on SwiftUI and Android; SwiftUI retained native pointer metadata. Captures and `browser-verification.json` are retained.
- A default labelled `New project` FAB measured 147.97×56 on Web and 148×56 on SwiftUI. With icon size 40, the measured width was 164 on SwiftUI and 165 on Android; both retained source padding 16/20, gap 12 and height 56. This text-shaping difference remains explicit rather than a claim of identical rasterization.
- Source tests, shared-integration tests, native cases and fixture combinations are different measures; overlapping totals are not added into a unique test count.

## Elevation (2026-10-28)

The FAB's shadow is the source `box-shadow: var(--md-sys-elevation-N)` (level 3, hover 4; lowered 1, hover 2; disabled
0), drawn from the theme token outside the border box and interpolated between levels like the CSS transition (280 ms):
SwiftUI `AWCElevationShadow` on `AWCNativeBoxShadow` (`.outer`), Compose `awcElevationLayers` + `accordionShadow`. It
replaces the platform shadows (`.shadow(...)`), which were too short against Chrome (Android raised FABs 9 levels off).
The 37 Chrome FAB paint cases (variants, sizes, lowered, dark, RTL, extended) pass on macOS and Android in the md-button
paint runs ([md-button.md](md-button.md)).

## Remaining boundaries and gates

Native points/dp, physical-pixel rounding, text shaping and elevation rasterization are measured platform boundaries. CSS selectors and DOM MouseEvent objects have typed appearance and native event counterparts. FAB Menu's anchor choreography is verified with that separate component, not inferred from standalone `setMenuIcon`.

iOS simulator execution is recorded below (gate 6); the simulator suites do not exercise VoiceOver itself. The independent final cross-component audit remains an explicit gate.

<!-- fi:ios-gate6:start -->
## Reduced motion (gate-7 decision)

Under `prefers-reduced-motion: reduce` the FAB has no motion: besides the host and state-layer transitions, the extend/collapse label morph (max-inline-size, margin, opacity) and the menu-icon cross-fade are now covered by the REDUCED MOTION block (`md-fab.reduced-motion.e2e.ts`). SwiftUI and Compose honour the same setting (system, or the AWC reduced-motion override); Chrome 153 reduced record `fab-extend-motion-*`. md-ripple's wave keeps its own rule (it ignores reduced motion on every platform).

## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeFabViewIntegration` | **94/94** | **94/94** | **94/94** |
| **Total** | **94/94** | **94/94** | **94/94** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
