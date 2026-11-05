# Tooltip parity checkpoint

Status: dedicated SwiftUI and Compose renderers, retained property updates,
public native controllers, slots, appearance and part APIs are implemented.
The available macOS and Android runtime checks pass. This is an implementation
checkpoint, not the separate final all-component audit or an iOS runtime claim.

## Contract and implementation

All twelve Web properties, both lifecycle events, `show()`/`hide()`, four slots,
eleven appearance hooks and five parts have native counterparts. The popup is
an independent overlay; its anchor keeps its own intrinsic size. Native overlay
scopes supply the viewport for flipping, clamping, offsets and RTL placement.
Affine width values retain percentage and font context; asymmetric and
elliptical corners, colors with alpha and per-part decoration are supported.

Show/hide update visibility immediately and do not await the visual transition.
Hover/focus use the configured delays. Escape suppression, disabled behavior,
focus restoration, detached state and timer cleanup have dedicated checks.
Events carry a null detail and are cancelable post-change notifications.
Same-tree ancestor capture observes them; they do not bubble or cross a native
event boundary. Calling preventDefault does not reverse committed visibility.

Authored heading/content replace their property fallbacks. Explicitly empty
slots remain authored, suppress the fallback and create no text line. Actions
retain their native callbacks, typography and semantics; plain mode ignores
rich slots. A default Button anchor inherits the Tooltip density, while an
explicit negative Button density overrides its enclosing scope.

The Laboratory exposes the same twelve property controls and eleven appearance
controls. Property edits preserve the mounted native instance. Appearance and
slot changes can remount the preview; Reset deliberately starts a new instance.
The Android recipe now matches Web/SwiftUI's tonal “Hover or focus me” anchor.

## Executed evidence

| Gate | Evidence |
| --- | --- |
| Web | 75 focused tests, 204 original configurations, lifecycle/motion reference; separate default-token captures and 104 supplementary part-style configurations with 2,704 validator assertions |
| SwiftUI/AppKit | 39 controller checks and 2,590 main renderer checks; 7,156 supplemental layout/paint/inspection checks; 42 live-host checks |
| Swift composition follow-up | 24 Button appearance checks, 87 Button Group checks and 25 Tooltip semantic/composition checks, including all five inherited density rungs |
| Android | Original 204 configuration geometry/paint matrices; 104 supplemental geometry/paint/inspector configurations; four interaction methods and fourteen contract unit tests |
| Android host follow-up | Four actual Tooltip host tests and four Snackbar host regressions pass after panel-slot and empty-text corrections |
| Shared integration | Thirty released-policy API example and Tooltip integration tests pass |
| Examples | Forty-two exact generated Swift examples typecheck on macOS and forty-two exact Kotlin examples compile against the public native libraries; byte-identical compiler proof is retained after switching the generator to the actual released policies |

These are separate suites and assertion/configuration counts, not a sum of
independent tests. Exact logs, XML, generated code, Web captures and screenshots
are retained under `outputs/native-parity/md-tooltip`. The checkpoint manifest
records file hashes. Earlier failed runs are preserved alongside their fixes.
The [source review](md-tooltip-source-review.md) records source semantics.

## Integrated findings and remaining gates

Laboratory comparison caught an inherited-density gap in Swift Button: a
Tooltip with density −2 still rendered a 40pt anchor. The fix is in Button;
the final anchor is 137×32pt versus Web 136.76×32px and Android 136.5×32dp.
The fractional width difference reflects the native text raster/layout scale;
the common height, padding, density and styling are retained.

The Android preview had omitted Tooltip's editable text slots from its
transport allowlist. Adding them exposed an empty-string Compose line box;
source-mode `AWCSlotText` now suppresses that box while keeping the authored
slot registered. Nonempty and empty slots are verified through the live host.

Native inspector measurements report actual part bounds, padding, margins,
borders and text typography. The anchor wrapper has no owned text style;
its font fields remain unavailable rather than reporting the child Button's
font as the wrapper's own. Hovering measured text/popup parts exposes their
actual metrics. CSS computed-style inheritance has no literal native equivalent.

Actual iOS compilation/device execution, VoiceOver/TalkBack delivery and the
independent final audit remain unverified. macOS AppKit responders and Android
semantic assertions do not substitute for those OS checks. No missing-platform
gate is accepted as an exception. The source's arbitrary transformed-ancestor
placement limitation and native extreme-allocation limits remain documented
boundaries rather than a claim of unlimited pixel identity.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeTooltipViewIntegration` | **2600/2600** | **2600/2600** | **2600/2600** |
| `NativeTooltipControllerIntegration` | **39/39** | **39/39** | **39/39** |
| **Total** | **2639/2639** | **2639/2639** | **2639/2639** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
