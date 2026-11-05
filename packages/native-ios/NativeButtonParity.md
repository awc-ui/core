# Button source audit and native equivalents

Audited against `packages/core/src/components/md-button/md-button.tsx`,
`md-button.css`, the source form/focus helpers, and the actual Swift renderer.
The scope is `md-button`; composite button-group animation is separate.

| Web surface | Swift implementation and boundary |
| --- | --- |
| `variant`: filled, tonal, outlined, text, elevated | Source token palettes, unselected/selected toggle palettes, disabled alpha, outline and elevation rules. Loading keeps normal colors and hover/focus states while blocking activation. |
| `size`: xs, sm, md, lg, xl; `density`: 0 through −4 | Source minimum dimensions, typography, icon/gap/padding taper, outline widths and corner tiers. Explicit appearance values take source precedence. |
| `shape`, `shapeMorph`, `selected`, `connectedLeft`, `connectedRight` | Resting/selected/pressed corner precedence and source connected corners. A fixed radius overrides ordinary morph states; connected flags override the fixed radius. |
| `ripple` | Pointer-origin farthest-corner ripple and Enter/Space pulse; source growth/release timing and reduced-motion handling. Native gesture machinery supplies the actual press. |
| `loading` | Source morphing polygon loader; appended content and arbitrary loader child fallback. Default loader size follows the resolved icon size. Supplied progress children retain their own dimensions. |
| `icon`, `trailingIcon`, `mirrorIcon`, `suppressExpandIconFlip` | Bundled Material Symbols, source size/color fallback, RTL mirroring and expanded trailing-icon rotation. Native `aria-expanded` property controls expanded state. Glyphs are decorative. |
| `fullWidth` | Consumes the available parent width unless explicit width is supplied; source min/max constraints still apply. |
| `disabled`, `softDisabled` | Both block actions and use disabled appearance. Hard-disabled excludes native focus; soft-disabled preserves focus and accessibility discovery. Loading also preserves focus. |
| `toggle`, `selected`, `value` | Proposed next selection in cancelable `mdClick`; commit before `mdChange`. Empty value defaults to the source empty string. Native controlled properties resynchronize local state. |
| `type`: button, submit, reset | `AWCFormScope` / registry handles native form ownership, validation, cancellation and reset. Raw nonempty href suppresses form effects. This is not browser ElementInternals. |
| `href`, `target` | Safe URL router and explicit native navigation contexts; relative routes and supported target contexts. Browser context menus, middle-click, opener/referrer policy and DOM navigation are not native APIs. |
| `groupTabindex`, `roleOverride` | Native responder/roving focus and button/link/gridcell mappings. Unknown roles use safe inference. Arbitrary ARIA role semantics and positive HTML tabindex sorting are not reproduced. |
| `mdClick`, `mdChange` | Native capture/target/bubble transaction, cancellation and propagation controls; matching serializable payload values. `originalEvent` is a browser object and is omitted. Native activation metadata has shared action ID/kind plus actual pointer/keyboard/accessibility/unknown source. |
| Methods | The Web source declares no component `@Method` API. Native form, focus and action helpers are documented native APIs, not invented Web methods. |
| Default, leading-icon, trailing-icon, loader slots | Arbitrary `AWCNode` children with named-slot lookup and fallback. `.symbol("favorite", slot: "leading-icon")` creates an inheriting Material Symbol. Explicit empty content remains an override. Slotchange/assignedElements are browser APIs. |
| CSS parts: anchor, state-layer, icon, label, trailing-icon, loading | Equivalent native drawing regions, public appearance fields and measured inspection parts. Native CSS selectors are not executed. |
| Public appearance hooks | Container/label/icon/trailing/loading/state/outline/focus-ring colors; icon/trailing/loading/font sizes; weight, line height, letter spacing; corner/outline/padding/gap; state opacity; width/minWidth/maxWidth/height/minHeight. `AWCButtonAppearance` merges fieldwise by native scope. |

The label is a nowrap line box. Explicit line height can be smaller than the
glyph bounds, as in CSS; the surface clips overflowing content. Width and height
are border-box values; minimums win conflicts with explicit or maximum values.
The used box cannot be smaller than its padding and border, even when all
explicit/minimum/maximum dimensions are zero.
Nested custom children retain their own authored layout and typography.

Inspection is opt-in and reports actual measured root/content/label/icon/loader
bounds, applied padding/border/gap and resolved typography from the same layout
pass. Padding includes the inset from the overlaid stroke edge. Arbitrary custom
content does not acquire guessed typography.

Roboto and Material Symbols use the bundled Web font resources. Native font
rasterization and point rounding differ from browser text rendering. Font weight
maps to the nearest supported native hundred-weight. The current button uses
fixed point typography and does not automatically scale with Dynamic Type.
Arbitrary Web font-family replacements and CSS expressions have no direct native
appearance field.

Direct children of native button groups receive size, shape, toggle and connected
flags. Group-specific neighbor padding motion, group corner tiers and touch-height
policy remain composite renderer work; these are not claimed as complete group
parity.

## Measured size/density matrix

Actual macOS SwiftUI measurements for plain `Continue`, filled variant, default
Roboto/theme, in points. These are real layout results from the inspection
fixture, not screenshots scaled to a target size.

| Size | Density 0 | −1 | −2 | −3 | −4 |
| --- | --- | --- | --- | --- | --- |
| xs | 81 × 32 | 77.5 × 28 | 74 × 24 | 70.5 × 24 | 67 × 24 |
| sm | 89 × 40 | 85 × 36 | 81 × 32 | 77 × 28 | 73 × 24 |
| md | 113.5 × 56 | 108.5 × 52 | 103.5 × 48 | 98.5 × 44 | 93.5 × 40 |
| lg | 191.5 × 96 | 181.5 × 92 | 172 × 88 | 162 × 84 | 152 × 80 |
| xl | 255.5 × 136 | 239.5 × 132 | 223.5 × 128 | 207.5 × 124 | 191.5 × 120 |

The corresponding line heights are xs/sm 20/19/18/17/16, md
24/23/22/21/20, lg 32/30/28/26/24 and xl 40/38/36/34/32. Source palette
contracts separately cover five variants in normal, loading, toggle-off,
toggle-on and disabled states.

## Regression commands

- `sh packages/native-ios/scripts/test-native-button.sh`: shared metric, palette,
  appearance validation and inheritance cases, also used by XCTest.
- `sh packages/native-ios/scripts/test-native-behavior.sh`: cancellation, event
  ordering, forms, routing and focus policy cases.
- `sh packages/native-ios/scripts/test-native-views.sh`: actual SwiftUI view
  behavior/focus, appearance pixels, inspection invariance, 25 size/density
  layouts, explicit constraints and typed slot geometry.
  `AWC_NATIVE_VIEW_FIXTURES=NativeInspectionViewIntegration` optionally selects a
  focused fixture through the same runner.
- `sh packages/native-ios/scripts/test-native-preview.sh`: preview slot
  validation plus real preview presentation.
- `sh packages/native-ios/scripts/test-native-button-hosts.sh`: both Live and
  Snapshot request paths and actual PNG colors.
- `node apps/native-ios-playground/scripts/test-live-preview.mjs`: real native
  pointer/key input, blocked activation, persistent state and frame inspection.

The local build and rendering evidence uses macOS Command Line Tools and AppKit
offscreen windows. No Xcode iOS SDK, simulator or connected iOS runtime is present,
so this audit does not claim an iOS build, VoiceOver/device verification, or
hardware-keyboard runtime validation.
