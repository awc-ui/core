# md-loading-indicator — Swift native parity

The dedicated SwiftUI renderer implements all three properties, five appearance hooks and the exposed shape part. There are no public events, slots or methods. It renders the source polygons and motion rather than substituting a system spinner.

## Source mapping

| Source surface | Native implementation |
| --- | --- |
| variant, density | Uncontained and contained palettes/clipping; square size `max(32, 48 + 4*d)`. Missing/zero local density inherits; canonical negative rungs override. Noncanonical inherited density is retained. |
| label | Original accessible label on a named, indeterminate native progress control. It is not a visible text node. Label updates use a polite native announcement; the decorative shape is hidden from accessibility. |
| Five hooks | `AWCLoadingIndicatorAppearance(color:size:shapeSize:containerColor:containerShape:)` with `.awcLoadingIndicatorAppearance` merges inherited defaults by field. Colors preserve alpha; size and shapeSize preserve zero. |
| Container shape | Public `AWCCornerLength`, `AWCCornerRadius` and `AWCCornerShape` retain physical corners, independent x/y radii and signed point-plus-fraction expressions. All radii share the CSS proportional overlap factor. Extreme finite coefficients are normalized before products can overflow. RTL does not reorder physical corners. |
| shape part | `AWCLoadingIndicatorShapeAppearance(width:height:color:)` with `.awcLoadingIndicatorShapeAppearance` independently changes the actual shape. Source flex shrinking applies only horizontally: an 80 shape in a 24 host becomes 24×80 and clips vertically. Both root and shape report actual native layout. |
| Motion | Seven exact 48-vertex polygons with source offsets 0/.143/.286/.429/.571/.714/.857/1 and rotations 0/154/309/463/617/771/926/1080. The 4.55s cycle uses cubic-bezier(.34,1.45,.4,1) per interval, including overshoot. Rotation and vertices are continuous at the loop boundary. |
| Preferences | Native reduced motion replaces morphing with the source ellipse and 1→.4→1, 2s ease-in-out pulse. Native increased contrast uses system semantic foreground and canvas colors; contained outlines remain visible. |
| Focus, hidden and zero | Actual programmatic native focus draws the source 3pt secondary outline with 2pt offset. The progress control is not a default sequential-tab stop. Hidden removes paint, accessible responder and inspection; an explicit empty preference clears previously measured nodes. Zero-size root/shape measurements remain zero. |

## Executed evidence

- Independent hydrated Web oracle: 42 configurations per theme, checked in as `Tests/Fixtures/loading-indicator-web-{light,dark}.json`, with 16 paused morph samples and exact source keyframes.
- `AWC_NATIVE_VIEW_FIXTURES=NativeLoadingIndicatorViewIntegration sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching`: **1,798/1,798** checks: 1,195 source contracts and 603 actual native checks. Actual SwiftUI/AppKit geometry and RGBA paint match all 84 configurations; the fixture also checks native progress semantics, real TimelineView pixel changes, preference branches, focus rings, hidden transitions, zero size and signed/overflow-safe corner handling.
- The fixture is in the standard native view runner. The direct host regression is in the standard native preview runner.
- `swift build --package-path apps/native-ios-playground --disable-build-manifest-caching`: all three preview products built. Both hosts merge the five defaults/local style fields.
- `node apps/native-ios-playground/scripts/test-live-loading-indicator.mjs`: **9/9** direct host checks pass for actual animation, defaults/local styles, direction/density, shape inspection and zero/hidden behavior. The snapshot host also successfully rendered a custom RGBA/asymmetric-corner request; its new evidence image is not a rewritten baseline.
- **15/15 generated Swift examples typecheck** against the built module, including all five hooks, structured radii and the independently styled shape part. Exact commands, permanent source and module hash are in the workspace examples verification record.
- Independent renderer/motion/corner/host review found no remaining concrete blocker after the extreme-radius and hidden-inspection fixes. The final UIKit-only semantic bridge uses UIProgressView with clear native paint; it remains uncompiled/unexecuted because no iOS SDK is available.

Source keyframe offsets use a 1e-9 comparison for JSON floating-point representation; geometry retains a 0.02pt tolerance for Chromium layout quantization. Pixel comparisons use explicit sRGB conversion, avoiding implicit AppKit display-profile conversion. No screenshot baselines were rewritten.

## Precise platform boundaries

These are actual **macOS SwiftUI/AppKit** checks. This machine has no iOS SDK/Xcode/device runtime, so UIKit compilation and VoiceOver execution remain unverified. CSS forced-colors and native increased-contrast are different platform preferences; the native semantic-color branch is an accessibility equivalent, not a claim that macOS exposes CSS forced-colors. Font/polygon anti-aliasing may differ from Chromium. The native public corner structure represents lengths/percentages without executing arbitrary CSS strings.
