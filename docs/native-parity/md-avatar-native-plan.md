# Avatar native implementation plan and Chrome oracles

This covers gates 2, 4 and 5 for `md-avatar` on SwiftUI (macOS runtime, with UIKit branches for
iOS) and Compose. See [the source review](md-avatar-source-review.md) for the contract.

## Before this work

- **Swift:** `AWCNativeView.avatar` (Presentation.swift) was a generic adapter:
  - invented sizes (`xs…xl`, 40 pt default);
  - two-token initials only;
  - a single primary tint, no palette;
  - `AsyncImage` with a `ProgressView`;
  - label defaulting to "Avatar".
- **Compose:** `AWCComponent`'s private `Avatar` had the same kind of problems:
  - 32/40/64 dp sizes clamped to 24…120;
  - secondaryContainer only;
  - http(s) images only;
  - `mdLoad`/`mdError` without `{src}`;
  - always labelled.
- Neither platform had hooks, parts, density or RTL corner handling.

## Mapping

| Source | SwiftUI | Compose |
|---|---|---|
| renderer | `AWCNativeAvatar` (NativeAvatar.swift), dispatched by `case "md-avatar": nativeAvatar` | `NativeAvatar` (NativeAvatar.kt), dispatched by `"md-avatar" -> NativeAvatar(p, onEvent, content)` |
| identity (initials, palette, label) | `AWCAvatarIdentity` (grapheme clusters, JS int32 hash) | `AWCAvatarIdentity` (`BreakIterator`, int overflow, `abs(Long)`) |
| `size` presets / custom CSS length | `AWCAvatarSize.parse`: px, rem, em, vw, vh, vmin, vmax, pt, pc, in, cm, mm, q; `calc`/`min`/`max`/`clamp` | `AvatarSize.parse` (same grammar) |
| viewport for `vw`/`vh` | `awcAvatarViewport(_:)`, default window / screen | `AWCAvatarViewportScope`, default configuration |
| density | `awcNativeDensity` + local `density` | `AWCDensityScope` + local `density` |
| 11 + 14 hooks | `AWCAvatarAppearance` + `.awcAvatarAppearance(_:for:)` | `AWCAvatarAppearance` + `AWCAvatarAppearanceScope` |
| `::part(image/initials/icon)` | `AWCAvatarPartAppearance` + `.awcAvatarPartAppearance(_:for:)` | `AWCAvatarPartAppearance` + `AWCAvatarPartAppearanceScope` |
| image pipeline | `AWCAvatarImageLoader`: ImageIO for data:/file:/http(s) | `AvatarLoader`: `BitmapFactory` for data:/file:/http(s) |
| `mdLoad`/`mdError {src}` | emitted after decode, once per `src` (and on a `crossorigin` change while displayed) | same |
| role/label | `accessibilityElement(children: .ignore)` + `.isImage`, or hidden | `clearAndSetSemantics { contentDescription; Role.Image }` or `hideFromAccessibility()` |
| default slot | `#text` nodes as Roboto at the icon size; elements centred in the icon box | children centred in the icon box (`LocalTextStyle`/`LocalContentColor` = icon size / label colour) |
| slotted `md-badge` | `awcBadgeOverlay` on the host frame (physical top-right, own offsets) inside the clip | `LocalAWCBadgeHost` + `NativeBadgePlacement.position` inside the clip |
| inspection | `awcInspect` nodes `md-avatar`, `image`, `initials`, `icon`, `slot` | `AWCAvatarInspectionScope` (bounds, initials run, metrics) |

**Design points**

- **One field per hook.** Since gate 3, `AWCAvatarAppearance` takes one labelled field per source hook on both platforms (the eleven hooks, then `palette{1…7}Container` / `palette{1…7}Label`). The bucket dictionaries remain as read-only views.
- **Empty slot.** On Compose a content lambda that emits nothing counts as an empty slot, so the person icon shows.

- **Physical corners and clip.**
  - SwiftUI mirrors shapes under RTL, so the container shape, outline and clip are drawn in a left-to-right environment while the content keeps the authored direction.
  - `AWCCornerShape` on Android is physical.
- **Letter spacing.** CSS puts the spacing after every character, including the last; the run with its trailing spacing is what gets centred.
  - SwiftUI `tracking` behaves the same in the run's own bidi direction. The initials follow the content's bidi, not the host's: Latin initials in an RTL avatar keep the spacing on their right, as in Chrome.
  - Android splits the spacing around each glyph. The run box is identical, and the ink is moved back by half a step.
- **Line box.** line-height 1, with the half-leading split equally: `LineHeightStyle(Center, Trim.None)` with no font padding; SwiftUI centres the glyph run.
- **Font sizes.** Font sizes are CSS px (non-scaling), as in the source. Compose converts dp → sp.
- **Weights.** Roboto 400/500/700 are bundled. A named family other than Roboto/system-ui/sans-serif/monospace is resolved by the platform.

## Chrome oracles (trusted input, DPR 1, 1200×900)

`outputs/native-parity/md-avatar/web-reference/`:
- `paint.html`, `lifecycle.html`, `fixtures.js`
- PNG fixtures: `avatar-square` 64², `avatar-wide` 96×48, `avatar-tall` 48×96, plus a broken data URI
- `server.mjs` serving the private build
- `oracle.mjs` (headless Chrome)

**Paint, 282 cases** (`web-oracle/web-paint.json`, 281 PNG clips):

| Group | Cases | Coverage |
|---|---|---|
| matrix | 192 | small/medium/large/72 × 3 shapes × {initials, icon, image square, image wide} × light/dark × LTR/RTL |
| content | 8 | explicit `abc`, tall image, broken image → initials, neutral (`colorFromName=false`) × 2 themes |
| density | 28 | local −1…−4 × 3 sizes × {initials, icon}, inherited density per size, local wins over inherited |
| size | 11 | 72, 72.5, 4rem, 3em, 10vw, clamp, calc, min, 0, '', −5 |
| hooks | 12 | all 11 hooks together × content × theme × direction |
| hook | 13 | each hook alone, plus container colour on neutral/icon avatars |
| palette-hook | 7 | each bucket's pair of palette hooks |
| parts | 3 | `::part(initials)`, `::part(icon)`, `::part(image)` (object-position, opacity) |
| slot | 7 | `<svg>`, `<span>★</span>`, `md-badge` (circle, square LTR/RTL, value-less), slot ignored when initials exist |
| hidden | 1 | `hidden` host |

Each case records:
- rect, classes, role/label, computed background/colour/radii/outline
- the initials span (text, rect, ink box, font metrics), icon metrics and slotted rects

**Identity, 52 inputs.** Name shapes (whitespace, accents, Arabic, CJK, emoji ZWJ, `ǆ`, Turkish i, ß), explicit initials and seeds for all seven buckets.

**Lifecycle, 4 scripts** (`web-lifecycle.json`). Each step records:
- `src` changes (load / error / recover / empty / repeat)
- `alt`, `label`, `name` changes, `crossorigin`, `loading`, `colorFromName`

with the immediate and settled state and the `mdLoad`/`mdError` order with `src` payloads.

**Fixtures.** `work/avatar-staging/make-fixtures.py` builds the Swift fixtures from `web-oracle/` (adding the sha256 of the oracle JSON). It installs byte-identical Android assets: `AvatarWebPaint.json`, `AvatarWebPaint/*.png`, `AvatarWebLifecycle.json`.

## Native tests

- Swift: `Tests/NativeAvatarIntegration.swift`, listed in `scripts/test-native-views.sh`.
- Android: `NativeAvatarParityTest` in the playground androidTest, through `AWCComponent`.

Both run the same checks per case:
- size ±0.5. Android also checks the host position ±0.6, and that the bundled Roboto and Material Symbols report the source hhea ascent/descent (1900/500 of 2048, 1056/96 of 960) on every initials and icon case
- mode and palette (from the Chrome classes), role/label
- premultiplied container colour ±0.006, label colour ±0.006
- initials text, font size and letter spacing ±0.01
- the initials run box: width ±1 (±2 for fallback-font runs), centre ±0.6
- icon glyph size ±0.01
- every flat CSS pixel of the clip: at most 0.5 % over 6/255, mean ≤ 1
- glyph ink (centred 70 % square): centroid x ±1 (monospace ±1.5), y ±1.5, extents ±2, and presence must agree

Then:
- the 52 identity cases
- the 4 lifecycle scripts: per-step mode, palette, initials, role/label and background, the event order by step, and the `src` payloads
- the dispatch path

**Tolerances.**
- The vertical glyph tolerance (1.5) reflects Chrome snapping text baselines to whole pixels at DPR 1, against native rendering at 2×.
- Horizontal placement is held to one CSS pixel, and the exact metrics are checked separately.

**Not covered natively** (case skipped, recorded):
- inline `<svg>` slot content: there is no SVG DOM natively; authored native views go in the slot instead
- the hidden host: `hidden` is a host attribute and has no `md-avatar` property
