# Status Dot source review

Status: Web source reviewed and measured. Native implementation and acceptance remain separate work; these results do not establish SwiftUI, iOS or Android parity.

## Contract

`md-status-dot` is a leaf with seven properties: `state` (online, away, busy, offline, invisible, neutral; default neutral), `size` (small, medium, large; default medium), `inline=false`, `shape` (rect/circle; default rect), `live=false`, `label=''` and `density=0`. It exposes no events, methods, slots or CSS parts. The generic `hidden` host attribute must still suppress its layout and paint.

The eight public hooks are `--md-status-dot-size`, `-color`, `-pulse-color`, `-outline-color`, `-outline-width`, `-inset-end`, `-inset-block-end` and `-pulse-duration`. A portable native appearance maps these to size, color, pulseColor, outlineColor, outlineWidth, insetEnd, insetBlockEnd and pulseDuration. Colors need alpha support. Inset fractions refer to the **parent's** corresponding dimension, unlike Badge offsets, whose fractions refer to the Badge's own size. Duration is in seconds.

## Geometry and inherited density

The host paints a circular dot with an outline outside its layout box. There is no border contribution to width/height. Diameter is small `max(4,8+d)`, medium `max(6,12+1.5d)`, large `max(8,16+2d)`. Outline width is small `max(1,1.5+0.125d)`, medium `max(1,2+0.25d)`, large `max(1.5,3+0.375d)`. Browser outline widths snap to the device-pixel grid; the captured Chrome run uses DPR 2. Positive values floor to whole physical pixels with a one-physical-pixel minimum: 0.1, 0.5 and 0.75 CSS pixels all measure 0.5; 1.375 measures 1; 1.75 measures 1.5. Zero remains zero. A zero custom diameter produces a zero-size layout box, while a nonzero outline can still paint. Zero outline width removes the outline.

Only local negative density rungs write the inherited CSS density signal. Both omitted density and explicit `density=0` retain the parent's signal. For a parent signal −4, small/medium/large measure4/6/8; a local−2 override gives6/9/12. An inherited noncanonical−1.5 signal produces a9.75 medium dot, even though the public density property only declares integer rungs. Native local0 must not silently reset inherited density.

Absolute placement uses logical inline-end and block-end insets. Rect defaults are−2, or−3 for large. In LTR a12-wide medium dot on a48 parent begins at(38,38); RTL flips its x origin to−2. Circle uses `14.6447% of parent dimension − half dot size` for each inset, placing the dot center on the parent's45° rim point. The x percentage uses parent width; the y percentage uses parent height, including nonsquare parents. Author inset hooks override these formulas. This logical placement differs deliberately from Badge's physical top-right anchor.

`inline=true` changes the host to relative inline-block layout, clears all four insets to auto, prevents flex shrinking and centers it on the cross axis. Its default outline becomes0 regardless of size/shape. A custom outline still applies. Custom inset values remain ignored in inline mode. A shared preview must include an actual parent for anchored mode and normal flow for inline mode.

## Paint, theme and pulse

Online/away/busy fills are#2DC653/#F4B400/#DB4437. Their default pulses use the corresponding RGB color at0.55alpha. Offline uses the outline token; neutral uses on-surface-variant. Invisible uses surface fill plus an inset2 outline-token ring. The outer outline uses the surface token. Token-dependent colors follow the active light/dark theme; no fixed native neutral palette should replace them.

Custom fill and custom pulse are independent. For example, overriding an online fill to#123456 leaves its default green pulse until pulseColor is also changed. Six- and eight-digit colors were measured for fill, outline and pulse. Neutral/offline/invisible pulses are transparent by default.

With `live=true` and no reduced-motion preference, the actual CSS animation is `ease-out`, infinite, default1.6seconds. Each keyframe interval applies that easing:0% has spread0 and the pulse color;70% has spread8 and transparent color;100% has spread0 and transparent color. The measured online35% sample has spread5.47715 and alpha0.173. At the exact end of an **infinite** iteration the browser wraps to the initial colored0spread frame. The fixture also samples a finite one-iteration endpoint by changing only animation timing, which yields the transparent100% endpoint; it records this distinction explicitly.

A zero-duration live animation has no active animation object and no pulse in the measured browser. In particular, invisible+zero duration retains its static inset ring. A nonzero live animation replaces invisible's inset ring with the pulse keyframes, even though those are transparent by default; this is an existing documented source behavior, not a reason to invent a different native composite.

Pulse animation is enclosed in `prefers-reduced-motion:no-preference`; reduced motion therefore retains static paint, including invisible's inset ring. Background/outline color transitions are separately declared and are not removed by that media query. Forced colors uses Mark/ButtonFace and an invisible ButtonText ring with forced-color-adjust:none. These media-query behaviors were source-reviewed; the reference browser had reducedMotion=false and forcedColors=false, so those two modes are not claimed as browser-verified.

## Accessibility and input

The dot never handles pointer input (`pointer-events:none`) or selection. Empty/whitespace-only labels yield role presentation and aria-hidden=true. A nonblank label yields role img when static and role status when live; the original untrimmed label is preserved as aria-label. Role status implies polite announcements; the host does not add a separate aria-live attribute. Color cannot be the only communicated state. Hidden suppresses the whole element even in inline mode.

## Evidence and remaining gates

Workspace `outputs/native-parity/md-status-dot/` contains the reproducible `web-reference` fixture,100 hydrated cases in each of `web-light.json` and `web-dark.json`, actual paused-animation samples, all 218 resolved theme tokens, screenshots, source hashes and test evidence. The captured source theme differs from the generated native default, so native comparison fixtures must use the recorded token map. The saved measurements pass 1,484 formula, geometry, accessibility and pulse-result assertions; these are validation of the recorded oracle, not a separate runtime suite. The Stencil/Jest spec and axe suites passed 36/36. These counts are distinct:100 source configurations per theme are measured fixtures, not 100 independently executed unit tests.

The fixture also captures eight Badge composition cases. `outputs/native-parity/md-badge/web-parent-density-geometry.json` preserves their measurements: under an IconButton at density−4, default/explicit0 Badge density produces12×12; local−2 produces14×14. A size-md IconButton intrinsically measures56×56 with its24×24 glyph at(16,16). Setting both public container-width/height hooks to48 produces an actual48×48 parent and glyph at(12,12). The shared Badge recipe and native examples now set that actual parent size, rather than relying on a48 wrapper around an oversized child.

Native verification must cover all properties and eight hooks, parent-relative percentages, explicit zero dimensions/duration, inherited density, true captured geometry, transparent/custom colors, both themes, RTL/inline/hidden/accessibility, ordinary hosted use and lifecycle cleanup of pulse work. Device/runtime results and any source-specific exception require separate evidence; no native completion is recorded here.
