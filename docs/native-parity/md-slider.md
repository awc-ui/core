# md-slider native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against Mac
Chrome 153 oracles (2026-10-30); gate-7 fixes (typed parts, the inset-icon slot, rendered views, hook cases) verified 2026-11-11.
Independent final audit pending. Source contract:
[md-slider-source-review.md](md-slider-source-review.md); plan: [md-slider-native-plan.md](md-slider-native-plan.md).
Ported by n5 (paint / interaction models) and taken over by fa on 2026-10-29 (accessibility bridges, host-authored
properties, Laboratory, AX); shares its support code with [md-rating](md-rating.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Slider node (`AWCNativeView` / `AWCComponent`) | dedicated renderer (`Slider/NativeSliderView.swift`, `SliderLayout.swift`, `SliderInteraction.swift`) | dedicated renderer (`NativeSliderView.kt`, `slider/SliderLayout.kt`, `SliderInteraction.kt`) |
| 24 hooks (`--md-slider-*`: the 23 documented ones and the stylesheet's `--md-slider-value-indicator-reserve`) | `AWCSliderAppearance` + `.awcSliderAppearance(_:)` | `AWCSliderAppearance` + `AWCSliderAppearanceScope` |
| Parts (`surface`, `track`, `track-active`, `track-inactive`, `thumb-knob`, `value-indicator`, `inset`) | `AWCSliderPart` + `.awcSliderPartAppearance(_:part:)` (`SliderRating/SliderRatingParts.swift`) | `AWCSliderPart` + `AWCSliderPartAppearanceScope(part, appearance)` (`SliderRatingParts.kt`) |
| `inset-icon` slot | an `AWCNode` child with `slot="inset-icon"` (`AWCNativeSliderView(insetContent:)`) | the `inset-icon` slot content of `AWCComponent("md-slider")` (`NativeSliderView(…, content)`) |
| Accessibility | `SliderRating/SliderRatingAccessibility.swift`: AXSlider (macOS, AWC key-view loop) / adjustable (iOS), one element per thumb | SeekBar semantics per thumb (`ProgressBarRangeInfo`, `SetProgress`) |

Behaviour mirrors the source: standard / centered / range, sizes xs…xl, stops and ticks, value indicator, inset icon (the
`icon` property or the slotted `inset-icon` content), vertical orientation, RTL, disabled (dimmed as one group like CSS opacity), keyboard steps (arrows, Page,
Home / End), pointer drag on the rail and the thumbs, touch semantics as Chrome records them, `mdInput` / `mdChange` /
`mdDragStart` / `mdDragEnd` in Chrome's per-path order, form participation, and the property watchers (host-authored values
win until the host changes them).

## Evidence

Oracles (`outputs/native-parity/md-slider/web-oracle/`, Chrome 153, DPR 1, trusted input): `paint.json` 188 cases,
`states.json` 22 runs, `states-reduced.json` 22 runs, `lifecycle.json` 18 runs. Gate 1 recheck against the cloud Chrome
141 capture: 188 / 22 / 22 identical after the classified 141→153 deltas (outline-width field, AX valuetext, key-press
frame split) (fa-054/055, `gate1-mac-vs-cloud.json`). Android assets are gzip copies verified byte-identical after gunzip.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeSliderRatingIntegration` (slider part) | paint 188/188, states 22/22, reduced 22/22, lifecycle 18/18 (fa-057) |
| iOS simulator AWC-fa (iPhone 17 Pro, iOS 26.3.1) | same (fa-057) |
| iOS gate-6 runtimes (r6) | iPhone 17 Pro iOS 26.3 (fa-057), iPad Pro 11-inch (M5) iOS 26.3 and iPhone 16 Pro iOS 18.6 (r6-011, `work/audit/r6/out/ios-ipad/`, `ios-ios18/`): all pass |
| Android emulator-5556 `SrParityTest` | paint 188/188, states 22/22, reduced 22/22, lifecycle 18/18 (fa-A026; final sources fa-A030) |
| Android `SrViewsTest` (slider + rating renders, semantics, wiring, lifecycle) | 115/115 (fa-A028, fa-A030) |
| Android `LivePreviewSRHostTest` | 2/2 (fa-A028; fa-A044) |
| Gate 7: `paint-extra2.json` (18 cases: `::part()` rules, the inset-icon slot, the hooks of R6-11) — macOS `NativeSliderRatingIntegration` "paint (extra2)" / Android `SrParityTest.sliderPaintParts` | 18/18 · 18/18 (fa-089, fa-A044) |
| Gate 7: all suites on the final sources — macOS / Android / iOS simulator | paint 188, extra2 18, states 22 + 22, lifecycle 18: all pass (fa-089: 444/444 runs; fa-A044; iOS 444/444 on AWC-fa iPhone 17 Pro, iOS 26.3 (fa-092)) |
| Gate 7 (R6-07): iOS gate-6 runtimes on the final sources — `NativeSliderRatingIntegration` | iPhone 17 Pro · iOS 26.3 **444/444** (fa-092) · iPad Pro 11-inch (M5) · iOS 26.3 **444/444** (fa-094) · iPhone 16 Pro · iOS 18.6 **444/444** (fa-094) |
| Gate 7 (R6-05): rendered views against the Chrome shots — macOS `NativeFaViewsIntegration` | paint 188/188 · extra2 18/18 (fa-089) |
| Gate 7 (R6-05): rendered views — Android `FaViewsParityTest` (through `AWCComponent`) | paint 188/188 · extra2 18/18 (fa-A044) |
| Gate 7 (R6-05): rendered views — iOS harness | paint 188/188 · extra2 18/18 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095): `NativeFaViewsIntegration` through `apps/native-ios-parity` |

## Laboratory (gate 3)

- **Styles panel:** the 24 hooks (`sr-appearance.js`), local values over defaults.
- **Parts and slot:** the seven visual parts (`visualParts`) with a copyable typed example each; the `inset-icon` slot is
  supported (`unsupportedSlots` empty) and its example renders the slotted node.
- **Properties:** retained updates for every slider property; rejected updates reported.
- **Examples:** SwiftUI examples typecheck (fa-063, 46 examples for slider, rating, stepper, step); Compose examples
  compile in the androidTest source set (fa-A029, fa-A030).

| Run | Result |
| --- | --- |
| Studio `sr-integration.test.mjs` / all studio suites | 4/4 · 0 new failures (fa-063) |
| SwiftUI live host `test-live-sr.mjs` / snapshot `test-snapshot-sr.mjs` | 27/27 · 6/6 (fa-063) |
| Android `LivePreviewSRHostTest` | 2/2 (fa-A028; fa-A044) |
| Gate 7: studio `sr-integration` / `native-api-examples` / `documentation`; SwiftUI examples typecheck, Compose examples compile | 4/4 · 23/23 · 14/14, all studio suites 865/868 (the 3 failures are canonical's chart / org-chart ones); 74 SwiftUI examples typecheck (fa-089) · 74 Compose examples compile (fa-A044) |

## Accessibility (tools/ax)

Cases `default`, `range`, `valuetext`, `vertical`, `disabled`: **0 open findings** on macOS, iOS (fa-063) and Android
(fa-A028), with two reviewed expectations (decision 14: CDP's valuetext never carries aria-valuetext; the disabled value
label measures the Web ratio 2.06:1). Every thumb is a slider named like the source with its range and value text; Tab
order matches Web; disabled thumbs are exposed disabled and refuse adjustment.

## Parts (typed native part appearance, R6-03)

The seven visual parts of the source are typed part targets: `.awcSliderPartAppearance(_:part:)` (SwiftUI) /
`AWCSliderPartAppearanceScope(part, appearance)` (Compose) with the shared `AWCAccordionPartAppearance` fields; values
cascade to every slider in the subtree, nearer values win. Each field follows the source part's box with its CSS semantics
(measured in Mac Chrome with the same rule as `md-slider::part(…)`, `paint-extra2.json`):

| Part | Fields | Source semantics |
| --- | --- | --- |
| `surface` | opacity | multiplies the host opacity (disabled 0.38 × the part's) |
| `track` | cornerShape | the track's clip radius (clamped to half its size) |
| `track-active` / `track-inactive` | backgroundColor, height, cornerShape | blocks anchored to the track's top edge (a 20 px segment in a 24 px track keeps its y); the second inactive segment of centered / range sliders is `::after` and has no part |
| `thumb-knob` | backgroundColor, width, height | resized around the handle's centre |
| `value-indicator` | backgroundColor, color, fontSize, fontWeight, lineHeight, padding, cornerShape | the bubble's box and text |
| `inset` | color | the inset icon's colour (its size is explicit in the source) |

`state-layer` is hidden by the source stylesheet (decision 6) and has no target. Evidence: paint-extra2 18/18 on macOS and
Android, the rendered views (R6-05) and one copyable typed example per part in the Laboratory (compiled on both platforms).

## Gate 7 (reviewer r6, 2026-10-31; fixes 2026-11-11)

- R6-03 parts: typed part appearance for the seven visual parts (section above) — FIXED, awaiting re-check.
- R6-04 `inset-icon` slot: implemented on both platforms — the slotted node is drawn in the inset box (centred, the inset size
  as its font size, the inset colour inherited, under the track mask), Chrome cases `slot-inset-symbol-lg`, `slot-inset-box-xl`
  (+ RTL), `slot-inset-low-value`; the policies list the slot as supported and the Laboratory example renders it — FIXED.
- R6-05 rendered views measured against the oracles: every paint case is rendered by the view itself at Chrome's host box and compared with the Chrome shot: the rendered host box (the view's own inspection node / layout bounds, ±0.75 px), every flat CSS pixel of the clip (3 × 3 flat in both images, limit 6: mean ≤ 1.0 and ≤ 0.5 % over 6) and every ink pixel (off the page background; Chrome ink covered by native ink within 1 px and vice versa, ≥ 0.97) — boxes, colours, the slot, the native md-buttons and the placement of every text run and glyph.
  macOS 188/188 + 18/18, Android 188/188 + 18/18; iOS: paint 188/188 · extra2 18/18 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095): `NativeFaViewsIntegration` through `apps/native-ios-parity`. Found and fixed by it: the SwiftUI canvas clipped a handle overhanging the
  host at the track's ends (`edge-min`); Compose read numeric properties through `Float` (value 0.35 showed
  "0.34999999403953552").
- R6-06 `NativeSliderRatingIntegration` registered in `test-native-views.sh` (fixtures and token sheet by default; a missing oracle file fails).
- R6-07 iOS runtimes: the three gate-6 runtimes on the final sources (rows above).
- R6-11 hooks: `--md-slider-value-font-family` (`hook-value-font-family-monospace`), `--md-slider-value-line-height`
  (`hook-value-line-height`), `--md-slider-min-track-length` (`hook-min-track-length`) are paint-extra2 cases on macOS, the iOS simulator and Android;
  `--md-slider-value-indicator-reserve` (case `hook-value-indicator-reserve`) is typed (`valueIndicatorReserve`) and a
  Laboratory field — FIXED.
- R6-15 decision 5 (reflected `"false"` booleans): source fix to be proposed test-first (open, Web source).

## Decisions (autonomous, 2026-10-27, reversible)

Shared with md-rating.

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

Gate-7 fixes installed by fa-098 (2026-11-11; anchored edits for shared files, fa's own files after a drift check, byte identity
with a dry copy, verification on canonical). First installed in the canonical tree through the main queue by fa-065 (2026-10-30): renderers and dispatch, the Swift
fixtures (`packages/native-ios/Tests/Fixtures/{slider,rating,stepper}-web-oracle/`, byte-identical copies of the
oracles) and the Android assets (`androidTest/assets/{sr,stepper}/`, gzip, verified identical after gunzip), the
Laboratory integration (lab-patch-sr.py, lab-patch-stepper.py), tools/ax cases and expectations, this document and the
AUDIT row. The install was applied to a dry copy first (aborting before canonical on any pre-image mismatch), every
changed file was compared byte for byte with that copy, and a backup allowed a rollback. Verified on canonical in the same
job: AWCUI build, macOS parity, studio suites (no new failures), compiler, playground build, live and snapshot hosts,
SwiftUI examples, Android compile, Laboratory APK on emulator-5554, the 4177 server restarted and probed, tools/ax.

## Remaining

The reviewer's re-check of the gate-7 fixes; R6-15 (Web source).
