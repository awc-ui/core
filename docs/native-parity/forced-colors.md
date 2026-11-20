# Forced colours (`@media (forced-colors: active)`)

macOS, iOS and Android have no forced-palette mode, so a host opts in, as it already does for the progress, skeleton,
snackbar and table forced-colors flags: SwiftUI `.awcForcedColors()` (an `AWCForcedColorPalette`, default `.standard`),
Compose `AWCAccessibilityAppearanceScope(forcedColors = true)` with `AWCForcedColorPaletteScope` for another palette.
`.standard` is Chrome 153's forced palette (Canvas #000, CanvasText #FFF, ButtonFace #000, ButtonText #FFF, GrayText #3FF23F,
Highlight rgba(0,230,255,.8), HighlightText #000, LinkText #FFFF00). Increased contrast alone never replaces authored colours.

Each component applies its source rules and the UA forcing of its own colours (backgrounds Canvas keeping their alpha, text
and icons CanvasText, box-shadows none) — except md-card, which sets `forced-color-adjust: none`:

| Component | Source rules |
| --- | --- |
| md-divider | line CanvasText |
| md-avatar | container ButtonFace, label ButtonText, 1px ButtonText inset outline (over hooks and the name palette) |
| md-card | border 1px ButtonText (border box), ButtonFace fill, ButtonText ink, outline part ButtonText, disabled GrayText, no state layer, Highlight focus ring; shadows kept |
| md-dialog | container 2px CanvasText border (content box), Canvas fill, no shadow, CanvasText headline/content/icon/divider, Canvas scrim keeping its alpha, ButtonText close glyph |
| md-accordion(+item) | item border 1px CanvasText (border box), Canvas fills, CanvasText text/icons, no state layer, Highlight focus ring, chassis bar CanvasText at opacity 1; floating panel border 1px CanvasText, no shadow |

Evidence: `d3-lab/web2/appearance.mjs` captures Chrome 153 (light/dark × forced on/off: host and part geometry, 2x pixel
probes); `NativeForcedAppearanceIntegration` (SwiftUI) and `NativeForcedAppearanceTest` (Compose) render the same nodes and
compare sizes and pixels (gate-7 r3-01, r3-02, r3-07). The md-button family inside a dialog keeps its own forced styling.
