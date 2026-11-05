# Meter migration checkpoint

Status: the source contract, shared controls, public examples, macOS/Android
runtime checks and the integrated Laboratory checkpoint pass. Arabic
fallback-font differences, iOS compilation/runtime, actual screen-reader
operation and the separate final migration audit remain open.

The [source review](md-meter-source-review.md),
[Swift record](../../packages/native-ios/audits/md-meter.md) and
[Android record](../../packages/native-android/audits/md-meter.md) retain the
implementation details and commands. Workspace evidence is under
`outputs/native-parity/md-meter`; the original source captures are unchanged.

## Contract and shared controls

All fourteen source properties are editable. There are no source events, slots
or methods. The seven public hooks map to
`AWCMeterAppearance(indicatorColor, trackColor, trackShape, height, labelColor,
valueColor, size)`. The five measured parts are track, indicator, label, value
and circular. `AWCCornerShape` retains physical corners, independent elliptical
axes, signed point/percentage coefficients and CSS overlap scaling. Colors
retain RGB/RGBA alpha and dimensions retain zero.

The same authored 300-unit parent is included in Web, Swift and Compose recipes
and generated examples. Linear fills that parent; circular remains intrinsic.
The Properties panel exposes validated `formatOptions` JSON and arbitrary
case-sensitive theme role colors. Absent options and an explicit empty object
remain distinct throughout configuration, transport and copied code.

Formatting is a public native capability. Absent options format the bounded
fraction as a localized percentage; supplied options format the clamped raw
value. Nonempty `valueText`, including whitespace, overrides both visible and
accessible text. Swift uses system JavaScriptCore Intl with data-only arguments;
Android uses native ICU. Invalid locale/options use the source raw-number
fallback. No Laboratory-generated label substitutes for native formatting.

Finite extreme ranges use scaled subtraction on Web and native platforms, so
opposite finite endpoints do not produce a nonfinite fraction. Linear fill
mirrors in RTL; circular arcs remain clockwise while text inherits paragraph
direction. Native inspection reports real part bounds. Circular path bounds
exclude stroke, and a zero-sized ring does not fabricate visible geometry from
the browser's residual SVG path bounds.

## Recorded checks

| Gate | Result |
| --- | --- |
| Web source | 51 repository checks; 98 hydrated configurations per theme, 196 total; 29,804 oracle assertions including 27,648 retained-baseline field comparisons |
| Additional Web reference | Three separate long unbroken-text cases record centered value overflow and logical-start caption overflow in LTR/RTL |
| Shared integration | 140 checks passed, plus 15 focused corner follow-ups |
| Swift views/contracts | 2,669 checks passed: 225 contracts and 2,444 actual native checks |
| Swift theme/host | 30 theme and 19 live-host checks passed; three preview products built and a separate styled snapshot recorded |
| Swift formatting | 108 independent cases passed: 75 explicit Node22/ICU78 cases and 33 earlier V8 cases, alongside the localized browser matrix |
| Android units/device | Owner reports 106 units and the final six-method device run passed; exact retained records are in the Android audit |
| Android extreme dimensions | Four additional device methods passed, preserving the 196-case matrix, overflow and motion while verifying finite applied size/stroke and a zero-size transition |
| Android formatting | 450 outputs matched: 75 oracle cases through API26/28/30/33/34/36 compatibility branches on the actual device ICU |
| Public examples | 24 Swift and 24 Kotlin examples compiled; permanent sources, commands, logs and hashes are in `examples/verification.json`; Swift rechecked the same source against its final module |
| Laboratory | Web, macOS SwiftUI and Android checkpoint passed; 26 retained records include initial failures and corrected retakes, all fourteen controls, seven styles, formatting, RTL and Reset |
| iOS / actual screen readers / final audit | Pending |

The Android compatibility-path matrix is not evidence of six different Android
devices or OS installations. The initial combined example-compilation command
passed production Kotlin compilation and then failed a test-only instrumentation
assertion overload; that log is retained separately from subsequent successful
device evidence. Earlier native corrections and failed attempts remain visible
in each platform's records.

Independent review supplied the retained RTL paragraph and long-text overflow
regressions. Both implementations keep unbroken captions at logical start and
long circular values centered without clipping their glyphs to the ring.
Swift also limits ellipsis to the shrinking header label. Android retains
fractional path/centering transforms rather than reporting rounded substitute
geometry.

## Integrated Laboratory checkpoint

`laboratory-proof.json` records the default 300×28 layout, RTL unit text,
omitted versus explicit empty formatting options, custom alpha-bearing theme
roles and all seven appearance controls. Styled linear roots measure 300×36;
the circular example with density−4, a72-unit ring and wrapped caption measures
144×106 on Web, macOS SwiftUI and Android. Style Reset retains property edits;
component Reset restores the300×28 recipe. A nonpositive size property follows
the source fallback rather than being confused with a zero appearance size.

The first Android visit exposed stale generated support metadata despite an
implemented renderer. The normal native compiler rebuilt the catalog; the
served file was checked and the final panel enables all fourteen properties.
That failed initial record remains alongside the corrected retake.

The first Swift circular RTL capture exposed a real mirrored arc despite equal
bounding boxes. The renderer now keeps only the painted path in physical LTR,
while text retains RTL. An actual quarter-arc pixel regression and the final
Laboratory screenshot verify clockwise paint matching Web. The prior image is
retained as `laboratory-swift-styled-before-rtl-arc-fix.png`.

The final Web, Swift and Android styled screenshots were independently inspected:
all show the144×106 root, clockwise ring, wrapped caption and preserved alpha.
An initially misframed Android image is retained separately as
`laboratory-android-styled-before-framing-fix.png`; the final image includes the
actual canvas and enabled styles. Native root fields remain unavailable where
that container has no meaningful text or margin measurement; part-level native
fixtures supply the actual text measurements.

## Open boundaries

Android's available Arabic fallback font measures differently from the Web
reference on macOS: the reported native Noto Naskh width is 16 units versus
19.328 for that reference's Geeza fallback. Formatting and line boxes remain
correct. This is a recorded visual difference awaiting final exception review,
not an accepted claim of identical typography.

Android constrains rendered geometry to 32766 physical pixels. Applied center
font, line height and padding derive from that actual diameter, and inspection
reports those values. Stroke paint saturates once it covers the entire clipped
viewport; it is not mislabeled as a CSS border. The extra four-method device run
verifies this safety correction. Swift's final2669-check fixture and19 live-host
checks include the corresponding extreme-size/stroke correction. Its effective
length ceiling is the independently measured Chrome limit of16,777,214; actual
text derives from that finite size and stroke saturates only beyond complete
viewport coverage. These differing native representable bounds remain explicit.

The separate five-case `web-extreme.json` records Chrome's own finite saturation:
at DPR2, a `1e308px` size resolves to a circular part16777214 units wide;
huge circular thickness keeps the48-unit viewport with a1-unit geometric path
and an approximately33554400-unit computed stroke. Its clipping fixture avoids
extending the page with enormous content. Those browser-specific ceilings are
not imposed as universal native dimensions. Shared validation retains finite
inputs while platform records distinguish requested and representable geometry.

Swift runtime evidence executes macOS SwiftUI/AppKit. No iOS SDK/device runtime
is available here, and UIKit compilation, native iOS layout and VoiceOver remain
unverified. Native ICU/JavaScriptCore and CLDR versions can differ between OS
releases. Native contrast preferences are not the browser's CSS forced-colors
setting. These scoped checkpoints do not certify every locale, OS, assistive
technology or the remaining components.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeMeterViewIntegration` | **2669/2669** | **2669/2669** | **2669/2669** |
| **Total** | **2669/2669** | **2669/2669** | **2669/2669** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
