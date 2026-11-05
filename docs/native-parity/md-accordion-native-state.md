# Accordion native state and motion checkpoint

Status: internal Swift and Compose state/motion foundations are implemented and
checked against the actual Web component. An incomplete internal
[SwiftUI renderer checkpoint](md-accordion-swift-renderer.md) now exercises
default geometry/paint, actual initial event dispatch, retained capped scrolling
and native interactions on macOS;
the dedicated Compose renderer and complete renderer acceptance are still
pending. The Laboratory continues to use its earlier simplified adapters. This
checkpoint does **not** release additional support claims or accept Accordion
or Accordion Item as completely migrated.

## Ported orchestration

Both native models retain item identity independently of display index. They
implement initial default selection, authored expanded state, exclusive and
keep-one coordination, disabled versus locked-open activation, direct property
updates, focus requests, keyboard activation and reordering, dynamic membership,
region policy, original-order event payloads and ownership transfer/restoration.
Only direct children participate in a group. A stale old owner cannot restore
its values over a new owner. Item event delivery can stop before parent
coordination without reversing the already committed local state.

Pointer state uses physical viewport points/dp, stable start rectangles and
sibling centers. Reorder cancellation restores order; disabling reordering or
changing membership cancels pending drag state. Floating movement is unclamped,
with separate initial coordinates and current coordinates, optional stacking,
and source-compatible start/move/end payloads. Terminal pointer coordinates are
reported separately from the last rendered position. Disconnection cancels
active resources and rejects stale pointer operations.

The models are not themselves pointer/focus/accessibility bridges. Actual
native input delivery, native content retention, overlay placement, accessibility
and event-dispatch ancestry still require the dedicated renderer and host tests.

## Motion

All five presets have native timing and interpolation models. Disclosure,
shape and spatial motion use their configured duration; color, font-axis and
opacity effects have a separate bounded clock. Reduced motion and zero-duration
overrides snap to the final state. Spatial curves retain the expressive
overshoot; opacity and geometry remain bounded.

The actual browser reference exposed two different geometry factors during
grid disclosure: the auto-height panel follows the interpolated fraction, and
the inner grid track clips content using its square. The native motion model
preserves both values so the eventual renderer can reveal full-size retained
content without translating it. This numerical agreement does not yet certify
the actual SwiftUI or Compose rendered transition.

## Evidence

- Swift state fixture: 65 lifecycle/selection/ownership/keyboard/pointer checks.
- Actual Web sequences: seven scenarios, 58 snapshots. Both native models
  reproduce every item's order, expansion, disabled state, heading level,
  region role, collapsibility, index and floating-grip ownership.
- Actual Web motion: 100 samples across five presets, both variants and both
  directions. Swift passes 716 numerical/timing checks; Android checks the same
  100 samples and timing cases. These are per-transition fractions, not common
  elapsed-time frames. The source reference uses 4,000/3,000ms overrides;
  separate checks cover ordinary default durations and bounded effect clocks.
- Android's combined checkpoint has 24 JUnit tests: 15 contract tests, seven
  actual-Web sequence tests and two motion/timing tests.

Evidence is under `outputs/native-parity/md-accordion/native-state`, including
the browser harness, raw snapshots, generators, build/test logs and XML. The
generated native expected values include the source capture's SHA-256. Failed
Swift compile and numeric-parsing runs remain preserved. The initial numeric
failure caught Swift's overloaded `Double.init` interpreting a UInt64 as a bit
pattern; the parser now performs explicit numeric conversion and uses the Web
number/whitespace grammar.

No iOS SDK/runtime was used. Swift checks execute with the available macOS
toolchain, while these Android checks run on the JVM. Renderer geometry/paint,
real native interactions, 14 parent and 24 item appearance hooks, all public
parts and slots, the right-hand panel, compiled examples, iOS execution and the
separate final audit remain required. See the [source review](md-accordion-source-review.md).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeAccordionAppearanceIntegration` | **1478/1478** | **1478/1478** | **1478/1478** |
| `NativeAccordionBrowserStateIntegration` | **58/58** | **58/58** | **58/58** |
| `NativeAccordionFloatingIntegration` | **51356/51356** | **51656/51656** | **50684/50684** |
| `NativeAccordionInitializationIntegration` | **100/100** | **100/100** | **100/100** |
| `NativeAccordionLiftIntegration` | **280/280** | **280/280** | **280/280** |
| `NativeAccordionMotionIntegration` | **716/716** | **716/716** | **716/716** |
| `NativeAccordionPartsIntegration` | **8272/8272** | **8272/8272** | **8272/8272** |
| `NativeAccordionPlaceholderIntegration` | **320/320** | **320/320** | **320/320** |
| `NativeAccordionRendererIntegration` | **492/492** | **491/491** | **491/491** |
| `NativeAccordionReorderIntegration` | **628/628** | **628/628** | **628/628** |
| `NativeAccordionScrollingIntegration` | **278/278** | **278/278** | **278/278** |
| `NativeAccordionShiftIntegration` | **20324/20324** | **20400/20400** | **20252/20252** |
| `NativeAccordionStateIntegration` | **65/65** | **65/65** | **65/65** |
| `NativeAccordionStatesIntegration` | **56126/56126** | **56394/56394** | **55802/55802** |
| **Total** | **140493/140493** | **141136/141136** | **139424/139424** |

Fixes from this gate: Tab traversal (UIKit key-view loop, iPad focus groups, focus bridges above content), real taps on headers, RTL lifted geometry, `:active` from the press (iOS 18.6), box-shadow blur calibration (floating custom elevation).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
