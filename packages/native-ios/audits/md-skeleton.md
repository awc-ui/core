# md-skeleton — Swift native parity

A dedicated SwiftUI renderer replaces the static placeholder adapter. It implements the ten source properties, eleven appearance hooks and three real parts. The source declares no events, methods or authored slots.

## Source and native mapping

| Source surface | Native implementation |
| --- | --- |
| variant, lines | Text rows, rectangular, rounded and circular shapes preserve source dimensions and density formulas. Multiple text rows taper only the last row to60%, anchored at logical start. Fractional line counts truncate with JavaScript's signed32-bit conversion. Nontext variants paint one shape. |
| width, height, fullWidth, fullHeight | `AWCSkeletonLength` retains point, parent fraction, em, rem and ch coefficients. Public property strings accept px/%/em/rem/ch and additive calc expressions. A definite `parentHeight` is distinct from an indefinite parent. Properties override hooks; full width overrides ordinary width; full-height circular keeps its source aspect-ratio precedence. Indefinite percentage child height preserves actual source collapse/aspect-ratio behavior. |
| density | Local negative density overrides inherited scale; zero inherits. Text height, row gap, shape size, rectangular/rounded height and rounded corners use source formulas and floors. Native layout quantizes used values to the measured browser's1/64px grid. |
| animation | Pulse1→.55→1, clipped wave with200%-wide gradient and−12°skew, and recurring none. All variants retain the independent centered.96→1 bloom. CSS theme timings and cubic curves are retained; an explicit clock is internal to the native test fixture. Effective RTL reverses wave time and changes its logical inset. |
| ariaLabelProp, announce | A noninteractive native busy-indicator responder carries the exact loading label, including empty text. Decorative mode removes the responder. Retained label changes post a low-priority native announcement. Shape layers are decorative and create no tab stops. |
| Eleven hooks | `AWCSkeletonAppearance` and `.awcSkeletonAppearance` sparsely merge colors, highlight, two corner shapes, width/height/circular size, line gap and three durations. RGB/RGBA and zero values remain intentional. `AWCCornerShape` preserves asymmetric, elliptical and percentage axes. |
| shape, line, line-last | `.awcSkeletonPartAppearance` scopes color, width, height and corners to `.shape`, `.line` or `.lineLast`. The last override merges on the actual tapered row; inspection exposes its joint line/line-last identity without inventing another painted part. |

`AWCSkeletonSizingContext` supplies actual native font size, root font size, optional measured zero-glyph advance and optional definite parent height. The default zero advance comes from bundled Roboto through CoreText. It does not pretend that an opaque SwiftUI Font value supplies numeric metrics. Native use with another font should supply that font's measured zero advance.

Both Laboratory adapters create a real260×160 parent with font context16 and definite parentHeight160. The component itself retains its natural64pt three-row default height; the inspector does not report the160pt context wrapper as component geometry. The recipe uses wave animation and full width.

Native reduced motion suppresses both bloom and recurring motion. `.awcSkeletonForcedColors(true)` explicitly chooses a native semantic secondary color; ordinary native increased contrast is not misrepresented as CSS forced-colors. Visibility removes layout and semantics, and ordinary property changes update the mounted renderer.

## Verification

The independent hydrated Chrome fixture contains106 configurations per theme and135 paused configurations across15 animation scenarios. Those fixtures intentionally retain the captured Laboratory green token maps; the native test applies those exact maps. A separate fresh browser gate loads only the font sheet and unmodified component tokens. Against those 212 default-palette configurations, native rendering uses its own generated light/dark tokens with no captured color injection and passes **1,974/1,974** checks (25 source contracts and 1,949 real native layout/paint/semantic/corner checks). Its evidence is retained separately under `default-palette/`; the earlier captured-token evidence remains intact. The native runner compares real host/part sizes and origins, labels and busy responders, actual RGB/RGBA pixels, physical corner masks, timing/RTL transforms, post-entrance pulse/shimmer, relative sizing and retained preference/property changes. Corner samples are unique interior/exterior pixels at least one logical pixel away from the mathematical boundary; antialiasing edge pixels are not claimed bit-identical across renderers.

`NativeSkeletonViewIntegration` is registered in the standard native-view runner. `test-live-skeleton.mjs` is registered in the native-preview runner and verifies actual capture/inspection, ten properties, eleven sparse hooks, all four variants, default/custom shimmer and percentage/font/calc/extreme lengths. The final focused runner passes **3,714/3,714** checks (**25 contracts,3,689 actual native**), and the final live-host runner passes **42/42**. Retained host updates validate all ten properties and reject invalid patches before mutation; the same mounted root applies geometry changes without a new session. Inspection reports the actual rendered row gap and zero column gap. All three native preview products build. Exact final counts, commands and source/artifact hashes are recorded in `outputs/native-parity/md-skeleton/swift-evidence.json`.

Two explicit light/dark native snapshots retain custom RGBA, physical elliptical corners, a calc-width property, font-relative row height and RTL taper. Browser Laboratory acceptance and copied public-example compilation are separate gates; neither is inferred from this renderer test.

## Boundaries and justified differences

Executed evidence is macOS SwiftUI/AppKit. This machine has no iOS SDK, simulator or device runtime, so UIKit compilation, iOS painting, VoiceOver and OS notification delivery remain unverified. UIKit source uses a clear-painted UIActivityIndicatorView to supply the native loading responder while SwiftUI owns the visible shapes.

The affine length subset translates native layout rather than evaluating arbitrary CSS. Unsupported property grammar returns nil from `AWCSkeletonLength(css:)`; the Laboratory rejects it explicitly. A direct native property with unsupported syntax falls back to the component hook/default, analogous to an invalid CSS declaration. Point equivalents are logical native units, not physical pixel promises.

Accepted extreme affine terms are combined without overflowing intermediate multiplication. Used lengths saturate at16,777,214, the independently measured Chrome geometry bound. Text rows cap at4,096 to prevent an attacker-supplied finite line count from allocating billions of native views. Ordinary source fixtures preserve all rows; this allocation safeguard is an explicit exceptional difference, not silently claimed unbounded Web parity.

Native lifecycle/semantic responder checks do not prove OS screen-reader announcement delivery. The reduced-motion fixture uses an isolated internal override; the system preference is read but never modified. No final iOS completion is claimed.
