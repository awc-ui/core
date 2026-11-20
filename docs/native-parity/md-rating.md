# md-rating native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against Mac
Chrome 153 oracles (2026-10-30); gate-7 fixes (typed parts, rendered views, hook cases) verified 2026-11-11.
Independent final audit pending. Source contract:
[md-rating-source-review.md](md-rating-source-review.md); plan: [md-rating-native-plan.md](md-rating-native-plan.md).
Ported by n5 and taken over by fa on 2026-10-29; shares its support code with [md-slider](md-slider.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Rating node (`AWCNativeView` / `AWCComponent`) | dedicated renderer (`Rating/NativeRatingView.swift`, `RatingLayout.swift`, `RatingInteraction.swift`) | dedicated renderer (`NativeRatingView.kt`, `rating/RatingLayout.kt`, `RatingInteraction.kt`) |
| 13 hooks (`--md-rating-*`) | `AWCRatingAppearance` + `.awcRatingAppearance(_:)` | `AWCRatingAppearance` + `AWCRatingAppearanceScope` |
| `focusRating()`, `getLabel` (the source's function property: the value label and the accessible value text) | `AWCRatingController` (`focusRating()`, `getLabel`) + `.awcRatingController(_:)` | `AWCRatingController` + `AWCRatingControllerScope` |
| Parts (`items`, `item`, `icon-filled`, `icon-empty`, `state-layer`, `value-label`) | `AWCRatingPart` + `.awcRatingPartAppearance(_:part:)` | `AWCRatingPart` + `AWCRatingPartAppearanceScope(part, appearance)` |
| Accessibility | AXSlider (macOS, AWC key-view loop) / adjustable (iOS); readonly = image | SeekBar (`ProgressBarRangeInfo`, `SetProgress` rounded to the precision); readonly = image |

Behaviour mirrors the source: max items, precision 1 / 0.5 / any, custom icons, value label, readonly, disabled and
soft-disabled, density, RTL, hover preview, pointer and touch (Chrome's semantics), keyboard (arrows, Home / End, digits),
the press ripple and pop, `mdChange` / `mdHover`, form participation, `getLabel` / `ratingLabel`, and the property watchers.

## Evidence

Oracles (`outputs/native-parity/md-rating/web-oracle/`, Chrome 153, DPR 1, trusted input): `paint.json` 113 cases,
`states.json` 16 runs, `states-reduced.json` 16 runs, `lifecycle.json` 13 runs. Gate 1 recheck against the cloud Chrome
141 capture: 113 / 16 / 16 identical after the classified deltas (fa-054/055, `gate1-mac-vs-cloud.json`). Android assets
are gzip copies verified byte-identical after gunzip.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeSliderRatingIntegration` (rating part) | paint 113/113, states 16/16, reduced 16/16, lifecycle 13/13 (fa-057) |
| iOS simulator AWC-fa (iPhone 17 Pro, iOS 26.3.1) | same (fa-057) |
| iOS gate-6 runtimes (r6) | iPhone 17 Pro iOS 26.3 (fa-057), iPad Pro 11-inch (M5) iOS 26.3 and iPhone 16 Pro iOS 18.6 (r6-011, `work/audit/r6/out/ios-ipad/`, `ios-ios18/`): all pass |
| Android emulator-5556 `SrParityTest` | paint 113/113, states 16/16, reduced 16/16, lifecycle 13/13 (fa-A026; final sources fa-A030) |
| Android `SrViewsTest` (slider + rating) / `LivePreviewSRHostTest` | 115/115 · 2/2 (fa-A028; fa-A044) |
| Gate 7: `paint-extra2.json` (10 cases: `::part()` rules, `--md-rating-icon-font-family`) — macOS "paint (extra2)" / Android `SrParityTest.ratingPaintParts` | 10/10 · 10/10 (fa-089, fa-A044) |
| Gate 7 (R6-11): `states-extra.json` / `states-extra-reduced.json` (4 runs each: `--md-rating-pop-scale`, `-duration`, `-state-layer-color`, light and dark) — macOS / Android `ratingStatesExtra` | 4/4 + 4/4 · 4/4 + 4/4 (fa-089, fa-A044) |
| Gate 7: all suites on the final sources — macOS / Android / iOS simulator | paint 113, extra2 10, states 16 + 16, extra 4 + 4, lifecycle 13: all pass (fa-089: 444/444 runs; fa-A044; iOS 444/444 on AWC-fa iPhone 17 Pro, iOS 26.3 (fa-092)) |
| Gate 7 (R6-07): iOS gate-6 runtimes on the final sources — `NativeSliderRatingIntegration` | iPhone 17 Pro · iOS 26.3 **444/444** (fa-092) · iPad Pro 11-inch (M5) · iOS 26.3 **444/444** (fa-094) · iPhone 16 Pro · iOS 18.6 **444/444** (fa-094) |
| Gate 7 (R6-05): rendered views against the Chrome shots — macOS `NativeFaViewsIntegration` | paint 107/107 · extra2 10/10 (fa-089; 6 focus-visible cases are runtime states, covered by the states replays) |
| Gate 7 (R6-05): rendered views — Android `FaViewsParityTest` | paint 107/107 · extra2 10/10 (fa-A044) |
| Gate 7 (R6-05): rendered views — iOS harness | paint 107/107 · extra2 10/10 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095) |

## Laboratory (gate 3)

- **Styles panel:** the 13 hooks (`sr-appearance.js`).
- **Properties:** retained updates for every rating property.
- **Methods:** `focusRating()` through `AWCRatingController` on both hosts.
- **Parts:** the six visual parts (`visualParts`) with a copyable typed example each.
- **Examples:** SwiftUI examples typecheck (fa-063); Compose examples compile (fa-A029, fa-A030).

| Run | Result |
| --- | --- |
| Studio `sr-integration.test.mjs` / all studio suites | 4/4 · 0 new failures (fa-063) |
| SwiftUI live host `test-live-sr.mjs` / snapshot | 27/27 · 6/6 (fa-063) |
| Android `LivePreviewSRHostTest` | 2/2 (fa-A028) |

## Accessibility (tools/ax)

Cases `default`, `half`, `readonly`, `disabled`, `soft-disabled`: **0 open findings** on macOS, iOS (fa-063) and Android
(fa-A028), no expectations. The rating is a slider named by its label with "N Stars" as value text; readonly is an image
named "Average rating: 4 Stars"; soft-disabled stays in the Tab order and refuses changes.

## Parts (typed native part appearance, R6-03)

`.awcRatingPartAppearance(_:part:)` (SwiftUI) / `AWCRatingPartAppearanceScope(part, appearance)` (Compose) with the shared
`AWCAccordionPartAppearance` fields, cascading to the ratings below (nearer values win); semantics measured in Mac Chrome
with the same `md-rating::part(…)` rules (`paint-extra2.json`):

| Part | Fields | Source semantics |
| --- | --- | --- |
| `items` | gap | the row's gap between items |
| `item` | width, height | the item box; the glyph keeps the item-size hook and stays at the box's top-left corner (top-right in RTL: the icon box is 1em) |
| `icon-filled` | color | the filled glyph only (the host colour stays the active colour) |
| `icon-empty` | color | the empty glyph |
| `state-layer` | backgroundColor | the hover / press glyph overlay |
| `value-label` | color, fontSize, fontWeight, lineHeight, letterSpacing | the value label's text |

`item-full` / `item-half` / `item-empty` are state aliases of `item`, and `ripple` is the md-ripple host (its hooks belong to
md-ripple). Evidence: paint-extra2 10/10 on macOS and Android, the rendered views (R6-05), one copyable typed example per
part in the Laboratory.

## Gate 7 (reviewer r6, 2026-10-31; fixes 2026-11-11)

- R6-03 parts: typed part appearance (section above) — FIXED, awaiting re-check.
- R6-05 rendered views measured against the oracles: every paint case is rendered by the view itself at Chrome's host box and compared with the Chrome shot: the rendered host box (the view's own inspection node / layout bounds, ±0.75 px), every flat CSS pixel of the clip (3 × 3 flat in both images, limit 6: mean ≤ 1.0 and ≤ 0.5 % over 6) and every ink pixel (off the page background; Chrome ink covered by native ink within 1 px and vice versa, ≥ 0.97) — boxes, colours, the slot, the native md-buttons and the placement of every text run and glyph.
  macOS 107/107 + 10/10, Android 107/107 + 10/10; iOS: paint 107/107 · extra2 10/10 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095). Found and fixed by it: `getLabel` had no native API
  (`AWCRatingController.getLabel` on both platforms; case `label-getlabel`); `::part(item)` keeps the glyph at the box corner;
  the Compose value label is centred in its line box (a 24 px value-label-font line height drew the text 4 px high).
- R6-06 registered in `test-native-views.sh` (with md-slider).
- R6-07 iOS runtimes: the three gate-6 runtimes on the final sources (rows above).
- R6-11 hooks: `--md-rating-icon-font-family` is a paint-extra2 case; `--md-rating-pop-scale`, `-duration` and
  `-state-layer-color` are motion runs (`states-extra.json` + reduced: hover pop, press and the state layer sampled per
  frame) on macOS, the iOS simulator and Android — FIXED.

## Decisions (autonomous, 2026-10-27, reversible)

Shared with md-slider.

Taken by fa without a product review. Each keeps the native renderers on the Web source's behaviour as Chrome 153 records it
(so the oracles stay the reference), names the alternative, and says how to revert. Reverting a parity decision makes the
listed oracle cases fail on purpose; update the source first (test-first, as the source review requires), recapture, then
change the native model.

1. **S5 — disabled dimmed twice (slider).** Native reproduces the source: host opacity 0.38 over the on-surface 38 % / 12 %
   colours, faded as one group like CSS `opacity` (SwiftUI `compositingGroup()`, Compose `graphicsLayer` alpha). Alternative:
   M3's disabled colours without the host opacity. Revert: `disabledContentOpacity` in `SliderLayout` (both platforms) and
   the disabled paint cases.
2. **S6 — off-step values not snapped (slider).** Native keeps the authored value (`aria-valuenow`, thumb, bubble) and lets
   the next arrow step start from the sanitised value, as Chrome. Alternative: snap at load. Revert: `SliderInteraction.load`.
3. **S11 — inset icon fixed 8 px from the start, on-active colour whenever value > min.** Native reproduces it.
   Alternative: M3's travelling icon with a measured threshold. Revert: the `inset` block of `SliderLayout.layout`.
4. **S12 — mdChange / mdDragEnd order per input path; mdChange on every key press.** Native emits Chrome's order per path
   (native-input pointer: DragEnd → Change; rail and keyboard: Change → DragEnd). Alternative: one order. Revert:
   `SliderInteraction.pointerUp` / `keyUp`.
5. **Reflected booleans set to "false" (slider `value-indicator`, `full-height`).** Native renders from the property value
   (no attribute layer). Alternative: model the stale attribute. Nothing to revert natively.
6. **Smaller slider items.** No hover state layer (the part is always hidden), unbounded tick count, `valueStart > valueEnd`
   not normalised, English default labels ("slider", "range start", "range end"): native follows the source.
7. **R3 — the press ripple runs under reduced motion (rating).** Native reproduces it (md-ripple's documented policy).
   Alternative: drop the ripple under reduced motion. Revert: the ripple branch in `RatingLayout` (`reducedMotion`).
8. **R4 — programmatic values off the precision grid (rating).** `value="2.3"` paints 30 % of the third star and reads
   "2.3 Stars" natively too. Alternative: round to the precision. Revert: `RatingInteraction.setValueProp`.
9. **Touch (both).** Chrome's touch semantics from lifecycle.json: a tap focuses without a ring, the tapped item keeps its
   emulated `:hover`, `:active` lasts 150 ms after the synthesized mousedown (kMinimumActiveInterval); a rating tap emits no
   mdHover. Alternative: platform touch feedback without hover. Revert: the touch branches in the views (`onTouchRelease`).
10. **English defaults (rating "Rating", "Empty", "1 Star", "N Stars").** Native uses the source strings unless
    `getLabel` / `ratingLabel` is set. Alternative: localized platform strings.
11. **Host-authored properties outside a form.** The views read the host's properties and apply Stencil's watcher
    semantics: the component's own writes (a drag, a key, a re-clamp) persist until the host changes that property; inside
    a form the form control's properties are used. Alternative: write every change back into the node (the previous
    behaviour, which re-applied stale props on the next render). Revert: `install-dispatch.py` (`properties:` argument).
12. **Android assistive SetProgress (rating).** The target is rounded to the precision; a target that rounds back to the
    value moves one step towards it (TalkBack's scroll increment, range / 20, is below a step). Disabled slider / rating stay
    SeekBars (SetProgress defined and refused), as Web keeps role=slider. Alternative: one step per action. Revert:
    `RatingInteraction.setFromAssistive`, the `setProgress` blocks in the Compose views.
13. **inset-icon slot (R6-04, implemented).** The slotted node (an `AWCNode` child with `slot="inset-icon"`) replaces the
    `icon` glyph in the inset box: centred, the inset size as its font size, the inset colour inherited, under the track
    mask — as `::slotted([slot='inset-icon'])` in Chrome (cases `slot-inset-*`). Nothing to revert.
14. **tools/ax.** `valuetext` on the Web side is CDP's property, which never carries aria-valuetext (fa-057 probe, Chrome
    153: a role="slider" with aria-valuetext reports "", a native range input its value string); native exposes `valueText`
    as the value description. The disabled slider's value label measures the Web ratio (2.06:1; WCAG 1.4.3 exempts inactive
    components). Both are expectations in `tools/ax/expectations.mjs`. Revert: delete the two md-slider entries.

## Installation

Gate-7 fixes installed by fa-098 (2026-11-11; see md-slider). First installed in the canonical tree through the main queue by fa-065 (2026-10-30): renderers and dispatch, the Swift
fixtures (`packages/native-ios/Tests/Fixtures/{slider,rating,stepper}-web-oracle/`, byte-identical copies of the
oracles) and the Android assets (`androidTest/assets/{sr,stepper}/`, gzip, verified identical after gunzip), the
Laboratory integration (lab-patch-sr.py, lab-patch-stepper.py), tools/ax cases and expectations, this document and the
AUDIT row. The install was applied to a dry copy first (aborting before canonical on any pre-image mismatch), every
changed file was compared byte for byte with that copy, and a backup allowed a rollback. Verified on canonical in the same
job: AWCUI build, macOS parity, studio suites (no new failures), compiler, playground build, live and snapshot hosts,
SwiftUI examples, Android compile, Laboratory APK on emulator-5554, the 4177 server restarted and probed, tools/ax.

## Remaining

The reviewer's re-check of the gate-7 fixes.
