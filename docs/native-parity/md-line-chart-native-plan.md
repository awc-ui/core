# Line chart native implementation plan (md-line-chart)

Status: preparation only, at Gate 1. No native code has changed.

* Verified Web contract: [md-line-chart-source-review.md](md-line-chart-source-review.md)
  (§7 there is the shared cartesian infrastructure, also used by area and bar).
* Oracle: **provisional** cloud capture in
  `outputs/native-parity/md-line-chart/web-oracle-cloud/` — recapture on the Mac (Chrome 153)
  with the fixed build before any parity diff.

## Current adapters — NOT YET READ

The device bridge to the Mac dropped before the native sources could be read, and no copy of
`packages/native-ios` / `packages/native-android` exists in the cloud. The gap analysis below
is therefore written **against the Web contract**, as the checklist the adapter reading must
fill in. First step when the Mac is reachable: read the iOS `chart` adapter (dispatched from
`AWCNativeView.swift`, presumably in `Sources/AWCUI/DataViews.swift` next to
`organizationChart`) and the Android equivalent (`AWCData.kt`, dispatched from
`AWCComponent.kt`), and fill the "iOS now" / "Android now" columns.

## Gap checklist

| Contract | Web (oracle file) | iOS now | Android now |
|---|---|---|---|
| Geometry | `RenderScene` per case (`paint-*.json` → `scene`): plot rect, x positions, polylines, areas, markers, gridlines, axis lines, texts | ? | ? |
| Curves | linear, smooth (Catmull-Rom), monotone, step, step-before, step-middle | ? | ? |
| Stacking | none, normal, percentage, silhouette, wiggle | ? | ? |
| Nulls | gap by default; `connect-nulls` (chart / series) | ? | ? |
| Marks | 5 shapes + emoji glyphs, `mark-size`, `line-width`, dashes | ? | ? |
| Area under line | gradient fill, `show-line=false` | ? | ? |
| Inverted | categories vertical | ? | ? |
| Value / end labels | collision-managed, end labels fade | ? | ? |
| Mark lines, dual y axes, axis titles, bands, breaks | `paint-extra.json` | ? | ? |
| Legend | 9 positions (logical start/end), chips toggle series, hidden at 40 % | ? | ? |
| Grid / ticks | 4 grid modes, axis ticks, grid outline-variant @ 50 % | ? | ? |
| Title | title-small 600, subtitle label-small, start/center/end (logical) | ? | ? |
| Typescale | label-small 11 / title-small 14 + 0.5 × density (floors 9/11); themed `*-font-size` tokens apply (fix S1) | ? | ? |
| Container | surface-container-low, padding/shape 16 − 2·d (min 8), min height 160 + 8·d (min 120), 16:9 | ? | ? |
| Locale | ticks, labels, tooltip, SR table, announcements | ? | ? |
| Empty / loading | opaque overlay, default text or slot; loader + `aria-busy`; replay on loading clear | ? | ? |
| Tooltip | axis / item / none, flips at edges, leading side in RTL, custom renderer | ? | ? |
| Hover | crosshair, ringed markers with 320 ms pop, emphasis to 22 % over 260 ms (line charts; item trigger only for fills) | ? | ? |
| Keyboard | reading-direction arrows, Home/End, Enter/Space → axis click, Escape, live region with `label-point` | ? | ? |
| Semantics | figure + summary; application plot; SR table (200 rows) | ? | ? |
| Events | marker / line / area / axis / legend clicks, hover, ready, zoom — absolute indices | ? | ? |
| Zoom | inside drag, pan, double-click reset, slider + pan grip, `setZoom`/`resetZoom` | ? | ? |
| Entrance | expressive / grow / fade / draw / stagger / none, 700 ms, MD3 emphasized-decelerate; draw/stagger easeInOutCubic; t=0 painted | ? | ? |
| Reduced motion | intro, emphasis, pop all snap | ? | ? |
| Forced colors / high contrast | colour keys keep series colours (fix S2) | ? | ? |
| Density | 0…−4 via local prop or ancestor | ? | ? |
| RTL | whole scene mirrored; arrows swap; tooltip leads left | ? | ? |

## Plan

1. **Read the adapters** and fill the table (bridge required).
2. **Shared native chart core** (one per platform, reused by line, area and bar): port
   `RenderScene` layout from the engine (`layout.ts`, `scale.ts`, `geometry.ts`, `rtl.ts`)
   rather than re-deriving it, and drive the native canvas (SwiftUI `Canvas`/Swift Charts is
   not suitable for scene-exact parity; Compose `Canvas` on Android) from the same scene. Diff
   each paint case's `scene` JSON numerically before any pixel comparison.
3. **Overlay**: ticks, titles, labels and legend as native text over the canvas with the
   oracle's fonts and offsets (`snap.overlay`); legend chips as toggle buttons.
4. **Interaction**: hover → index by nearest x, tooltip card, crosshair, markers; emphasis
   timing from `motion.json` emphasis frames; keyboard model and announcements from
   `keys.json`; events with absolute indices.
5. **Zoom**: drag/pan/double-tap reset and the range slider, `mdZoom` order from
   `pointer.json`.
6. **Motion**: intro per variant against the per-frame digests (canvas opacity curve,
   per-series bounding boxes, column tops at each x) in `motion.json`; reduced-motion run
   must match its first frame to the final frame.
7. **Accessibility**: VoiceOver/TalkBack equivalents — chart summary as the container label,
   adjustable/rotor over points with the `label-point` text, data table as an accessibility
   children list.
8. **Parity runs** after the Mac recapture; then Gate 2.
