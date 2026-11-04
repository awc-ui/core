# Loading Indicator migration checkpoint

Status: the shared contract, available native renderers, generated examples and
focused Laboratory checks pass. iOS compilation/runtime, actual assistive
technology operation and the separate final migration audit remain pending.

The [source review](md-loading-indicator-source-review.md),
[Swift record](../../packages/native-ios/audits/md-loading-indicator.md) and
[Android record](../../packages/native-android/audits/md-loading-indicator.md)
retain the source mapping and detailed commands. Workspace evidence is under
`outputs/native-parity/md-loading-indicator`.

## Contract

All three properties (`variant`, `label`, `density`) and five hooks map to the
public `AWCLoadingIndicatorAppearance`. The independent shape part uses
`AWCLoadingIndicatorShapeAppearance(width, height, color)`. There are no source
events, slots or methods. The accessible label is not added as visible text.

Colors preserve RGB/RGBA. Dimensions preserve zero. Physical corner structures
retain four corners, independent axes, signed length/percentage combinations and
CSS overlap scaling. RTL does not reorder physical corners. The shape keeps the
source horizontal flex shrink, vertical overflow and actual container clipping.
Inherited/local appearance merges by field.

Both renderers use the actual source polygons and 4.55-second motion, including
overshoot, rotation and the native reduced-motion circle/pulse equivalent.
Inspection retains real zero bounds and omits hidden/unstable parts rather than
substituting the capture frame. Fonts and gaps that native layout does not expose
remain unavailable.

## Recorded checks

| Gate | Result |
| --- | --- |
| Hydrated Web reference | 42 configurations per theme, 84 total, plus 16 paused animation samples and retained source keyframes |
| Shared integration | 110 checks passed at the completed shared checkpoint; the later Meter/Loading integration run passed140 checks, plus15 focused corner follow-ups |
| Swift actual views/contracts | 1,798 checks passed: 1,195 contracts and 603 actual checks against the 84 configurations and motion/environment cases |
| Swift host | Nine direct live-host checks passed; separate styled snapshot rendered; all three preview products built |
| Android units | 103 cases passed, including exact polygon/sample and corner validation checks |
| Android device | Second six-method batch passed five; corrected focus locator then passed its focused method, including actual outline pixels |
| Public examples | 15 Swift and 15 Kotlin examples compiled; permanent sources, exact commands and hashes retained in `examples/verification.json` |
| Laboratory | Web/Swift/Android style and native control checkpoints passed; evidence in `laboratory-proof.json` and platform screenshots |
| iOS / actual screen readers / final audit | Pending |

Android's initial device batch passed two of six methods; its manual-clock,
single-use session and semantics-target failures remain in the retained logs.
The final focus-target correction did not change renderer behavior or widen
tolerances. Independent review also corrected fixed-radius focus-outline
expansion and explicit-null parser consistency before the second batch.

The Laboratory records all three properties and five styles. Both native
platforms match the styled 64 × 64 box, preserve a real 0 × 0 root and zero shape,
and support uncontained/RTL state. Resetting styles at density −4 produces
32 × 32 at y34 in the 100-unit capture. Swift's default is 48 × 48. The same
device batch and Laboratory retest close the Segmented child-event forwarding
issue and confirm that short Split/Segmented controls are centered at y38.

## Boundaries

Swift evidence executes macOS SwiftUI/AppKit, not iOS. The UIKit bridge now uses
a real `UIProgressView` with its own paint cleared, but is uncompiled on this
machine. Native contrast preferences and explicitly selected native forced
palettes are not the browser's CSS forced-colors media setting. Pixel rounding,
color conversion and antialiasing retain the explicit bounds in each platform
record. These checkpoints do not certify the remaining components or complete
the final independent audit.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeLoadingIndicatorViewIntegration` | **1798/1798** | **1798/1798** | **1798/1798** |
| **Total** | **1798/1798** | **1798/1798** | **1798/1798** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
