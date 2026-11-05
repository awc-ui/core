# md-progress-indicator — Swift native parity

A dedicated SwiftUI renderer replaces the generic progress adapter. It implements all fourteen source properties, thirteen sparse appearance hooks, three measured parts and the retained `mdComplete` lifecycle. The source has no slots or public methods.

## Source and public API mapping

| Source surface | Native implementation |
| --- | --- |
| variant, value, max, indeterminate | Linear fills the offered width; circular keeps its intrinsic viewport. Visual fraction and accessible range follow the source independently, including zero and negative maximum values. The actual AppKit responder exposes the progress-indicator role, label, minimum, maximum and current value; indeterminate has no numeric current value. |
| thickness, size, density | Local negative density overrides inherited density; zero inherits. Circular size resolves to 24–240pt. Zero and negative thickness preserve the measured source distinctions between flat boxes, wavy viewports and SVG stroke fallback. Fractional density retains fractional layer positions rather than rounding independently to the display grid. |
| wave, waveAmplitude, waveLength, waveSpeed | Linear filled paths and circular stroked paths use source sampling, Catmull–Rom curves, two-decimal serialization, amplitude transitions and phase progression. Circular wave count follows circumference and wavelength. The source minimum wave count and viewport clipping are preserved. |
| fourColor | Only flat circular indeterminate progress cycles colors. Source hold intervals, premultiplied alpha interpolation and ordinary/reduced-motion durations are retained; wavy progress does not gain an unsupported color cycle. |
| label | Raw accessible label is retained, including explicit empty text. The native semantic responder is read-only, has no implicit sequential tab stop and does not intercept pointer input. Paint layers are decorative to accessibility. |
| complete, mdComplete | An initially true value is inert. A subsequent false→true change on the same mounted root fills, flattens, erases and/or collapses according to the source variant. One null-detail event follows the completed transition. False does not reset terminal state; indeterminate ignores completion. Flat circular retains its empty track; other variants retain layout while hiding paint and inspection. |
| Thirteen hooks | `AWCProgressIndicatorAppearance` and `.awcProgressIndicatorAppearance` merge inherited and local fields. They cover active/track/stop colors and physical shapes, stop size, signed trailing/gap lengths and four cycle colors. RGB/RGBA, explicit zero and `AWCCornerShape` physical/elliptical/percentage radii are supported. |
| Three parts | Inspection reports actual `track`, `active-indicator` and `stop-indicator` layers when the corresponding source part exists. SVG counterparts report geometric element boxes, excluding stroke. Rotated elements use the transformed element box rather than the tighter bounding box of the rotated curve. Flat indeterminate exposes its translated primary wrapper; wavy indeterminate exposes only its source track part. |

Indeterminate linear progress constructs the source local paths and reflects the whole container once in RTL, including clipping and asymmetric physical corners. Determinate RTL builds its physical right-hand fill directly, leaving physical shape hooks unreflected. Circular paint remains clockwise in either text direction.

Ordinary value changes retain presentation state and ease toward the new fraction. Flat linear indeterminate uses its two independently timed bars; circular flat uses the source rotation, dash and complementary-track choreography. Wavy circular retains the source sweep, rotation and aligned complementary track.

Native reduced motion flattens waves, commits determinate updates immediately and slows indeterminate movement. It does not freeze all animation. Reduced flat-linear completion still performs the source 300ms collapse; reduced wavy/circular completion settles immediately. A preference change during an active request-animation-frame phase settles it once; an already running CSS-equivalent collapse keeps its duration.

`.awcProgressForcedColors(true)` explicitly selects native semantic foreground/secondary paint. Native increased contrast alone preserves authored colors. This separates the browser forced-colors concept from the distinct native contrast preference.

## Preview composition and retained updates

Both preview adapters use the same authored 300pt parent and default value 64, wave enabled, label “Building native components”. Inspection targets the component, not this wrapper.

The live host accepts a strict partial `update` of the fourteen source properties on the existing root. It drains the native property observation before accepting the next patch, preserving consecutive false/true watcher changes. An acknowledgement confirms application, not completion; the actual component later emits `mdComplete`. The command cannot change identity, tag, theme, appearance or viewport. Reset creates a new session. The transport is a preview facility rather than a new public component method.

Accepted finite extreme values retain their authored inputs while native used geometry stays finite. Linear used lengths saturate at the independently measured Chrome limit 16,777,214 before SwiftUI Float conversion; circular size keeps the source 24–240 clamp. Stroke arithmetic saturates after it already covers the clipped viewport. Wave tessellation is bounded to 32,768 samples/4,096 circular waves to prevent unbounded allocations for finite subnormal wavelengths. Ordinary source fixtures retain their full sampling. Inspection reports actual effective geometry.

## Executed evidence

- Hydrated Chrome references contain 92 configurations per theme, 52 additional numeric/direction edge configurations, nine animation times and actual completion-event evidence. Checked-in fixture JSON preserves these independently of native output.
- `NativeProgressIndicatorViewIntegration` is registered in the standard `test-native-views.sh` runner. It checks real SwiftUI layout, part origins/bounds, semantic responders, actual palette/alpha pixels, source-timed animation, one-corner RTL reflection, high-contrast appearance, explicit forced colors and retained completion under both motion preferences.
- The focused final renderer run passed 1,120/1,120 checks, including 51 contracts and 1,069 actual native checks. The complete final two-theme run passed **2,808/2,808** checks (**51 contracts, 2,757 actual native**). Source/module hashes and commands are recorded in the workspace evidence manifest.
- `test-live-progress.mjs` is registered in the standard native-preview runner. It verifies actual captures, inherited/local hooks, RTL, strict retained-patch validation, all fourteen properties, four actual completion variants, terminal inspection, indeterminate suppression and finite-extreme captures.
- All three preview products build, **20 generated Swift examples typecheck**, and the final live-host run passes **39/39**. A separate RTL snapshot verifies custom RGBA paint, asymmetric corners and wave geometry without replacing existing baselines.

## Platform boundaries

Executed native evidence is macOS SwiftUI/AppKit. This machine has no iOS SDK, full Xcode installation or device runtime; UIKit compilation, device rendering and VoiceOver execution remain unverified. The UIKit source uses a clear-painted native `UIProgressView` for its native role and accessible value while SwiftUI owns paint.

The fixture exercises reduced motion through an isolated internal override and increased contrast through an isolated AppKit appearance; it does not alter or claim execution of the user's system accessibility settings. Explicit forced colors use native semantic colors rather than assuming CSS palette values are identical across operating systems.

The extreme used-length cap records this measured Chrome implementation's limit, not a universal browser or OS requirement. Native antialiasing and stroke rasterization remain platform dependent. Structured appearance values represent native shapes and lengths without executing arbitrary CSS selectors or strings.
