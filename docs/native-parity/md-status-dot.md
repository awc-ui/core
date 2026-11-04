# Status Dot migration checkpoint

Status: Web source, dedicated SwiftUI and Compose renderers, real preview hosts
and compiled native examples have passed focused checks. Laboratory property,
style, geometry and refreshed enum-dropdown checks have also passed. iOS
execution, accessibility review and the independent final audit remain open.

## Implemented contract

Both native implementations expose `state`, `size`, `inline`, `shape`, `live`,
`label` and `density`. All eight Web appearance hooks have typed counterparts:
size, color, pulse color, outline color/width, logical end/block-end inset and
pulse duration. Insets support an absolute length plus a fraction of the parent
dimension. Zero dimensions/duration and RGBA colors are preserved.

The [Web review](md-status-dot-source-review.md) records the measured contract.
There are no public events, methods, slots or CSS parts to migrate. Labels are
accessibility-only. `.awcStatusDotOverlay` and `AWCStatusDotHost` retain the actual
parent's intrinsic dimensions and place the dot at its logical corner or circular
rim. Inline mode uses ordinary layout and ignores anchor insets. Local direction
and inherited density follow the source rather than resetting at component
boundaries.

Both renderers use theme roles for neutral/offline/invisible colors, preserve
source fixed status colors, and snap exterior outlines to physical pixels.
Live pulse timing follows the source's two independently eased intervals. Its
halo is exterior-only, so it does not alter translucent fill colors. Zero
duration restores static paint, including the invisible inset ring. Hidden and
zero-size inspection results do not fall back to parent bounds.

The Laboratory profile exposes all seven properties and eight appearance
controls; matching native examples use the same actual parent and inline recipe.
These declarations are separately verified from interactive Laboratory acceptance.

The focused Laboratory record now verifies all seven properties and eight hooks
on Android, with matching Swift geometry: the styled RTL dot is 20×20 at 480/41;
the zero-size case is 0×0 at 480/61; inline mode is 20×20 at 454/46. The corresponding
native unit is pt or dp. `laboratory-proof.json` and `android-styled.png` retain
the actual observations.

The prior freeform size/state inputs exposed a documentation extraction gap:
exported aliases were indexed but omitted from the generated type models.
The normal docs generator now includes those source declarations, and the merged
editor regression verifies all six state values and three size values. A fresh
Laboratory reload, after the component documentation settled, confirmed the
three size options and six state options with no console errors. The served
documentation endpoint was independently checked to return the source aliases
with HTTP 200 and `Cache-Control: no-store`.

## Recorded verification

Artifacts live under `outputs/native-parity/md-status-dot`.

- Web: 36 Stencil/Jest/axe checks; 100 hydrated configurations per theme.
  Validation of the recorded oracle passes 1,484 assertions; this is distinct
  from the browser fixture count.
- [SwiftUI/macOS](../../packages/native-ios/audits/md-status-dot.md):
  1,687 contract and 1,001 actual-render checks, including 196 visible records,
  four hidden cases, actual RGBA pixels and pulse lifecycle. Fifteen real-host
  checks additionally verify transport, anchored/inline geometry and scoped
  zero/hidden inspection.
- [Android](../../packages/native-android/audits/md-status-dot.md):
  91 unit tests, three renderer device methods covering all 200 source fixtures,
  one real-host method covering seven scenarios, and two Badge regressions.
  The original failed host attempt exposed and repaired a stale forced-inline
  preview fixture; its logs are retained.
- Shared controls, normalization, transport and compiler/server checks: 165 passed.
- Eleven Swift and eleven Kotlin generated examples compile.
  `examples/verification.json` contains compiler commands, source and log hashes.
- Source-derived enum documentation/editor checks: 28 related tests passed,
  recorded in `enum-tests.log`; no values were hardcoded into platform controls.

The Swift standalone runner shares contract cases with its XCTest wrapper.
Installed Command Line Tools do not supply XCTest or an iOS SDK. macOS rendering
is not an iOS runtime pass. VoiceOver/TalkBack, changed OS motion/contrast
preferences and the separate final review remain explicitly open.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeStatusDotViewIntegration` | **1687/1687** | **1687/1687** | **1687/1687** |
| **Total** | **1687/1687** | **1687/1687** | **1687/1687** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
