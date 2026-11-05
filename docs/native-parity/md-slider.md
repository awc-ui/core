# md-slider native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against Mac
Chrome 153 oracles (2026-10-30). Independent final audit pending. Source contract:
[md-slider-source-review.md](md-slider-source-review.md); plan: [md-slider-native-plan.md](md-slider-native-plan.md).
Ported by n5 (paint / interaction models) and taken over by fa on 2026-10-29 (accessibility bridges, host-authored
properties, Laboratory, AX); shares its support code with [md-rating](md-rating.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Slider node (`AWCNativeView` / `AWCComponent`) | dedicated renderer (`Slider/NativeSliderView.swift`, `SliderLayout.swift`, `SliderInteraction.swift`) | dedicated renderer (`NativeSliderView.kt`, `slider/SliderLayout.kt`, `SliderInteraction.kt`) |
| 23 hooks (`--md-slider-*`) | `AWCSliderAppearance` + `.awcSliderAppearance(_:)` | `AWCSliderAppearance` + `AWCSliderAppearanceScope` |
| Accessibility | `SliderRating/SliderRatingAccessibility.swift`: AXSlider (macOS, AWC key-view loop) / adjustable (iOS), one element per thumb | SeekBar semantics per thumb (`ProgressBarRangeInfo`, `SetProgress`) |

Behaviour mirrors the source: standard / centered / range, sizes xs…xl, stops and ticks, value indicator, inset icon (the
`icon` property), vertical orientation, RTL, disabled (dimmed as one group like CSS opacity), keyboard steps (arrows, Page,
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
| Android `LivePreviewSRHostTest` | 2/2 (fa-A028) |

## Laboratory (gate 3)

- **Styles panel:** the 23 hooks (`sr-appearance.js`), local values over defaults.
- **Properties:** retained updates for every slider property; rejected updates reported.
- **Examples:** SwiftUI examples typecheck (fa-063, 46 examples for slider, rating, stepper, step); Compose examples
  compile in the androidTest source set (fa-A029, fa-A030).

| Run | Result |
| --- | --- |
| Studio `sr-integration.test.mjs` / all studio suites | 4/4 · 0 new failures (fa-063) |
| SwiftUI live host `test-live-sr.mjs` / snapshot `test-snapshot-sr.mjs` | 27/27 · 6/6 (fa-063) |
| Android `LivePreviewSRHostTest` | 2/2 (fa-A028) |

## Accessibility (tools/ax)

Cases `default`, `range`, `valuetext`, `vertical`, `disabled`: **0 open findings** on macOS, iOS (fa-063) and Android
(fa-A028), with two reviewed expectations (decision 14: CDP's valuetext never carries aria-valuetext; the disabled value
label measures the Web ratio 2.06:1). Every thumb is a slider named like the source with its range and value text; Tab
order matches Web; disabled thumbs are exposed disabled and refuse adjustment.

## Exception proposed: part selectors

| Field | Record |
| --- | --- |
| Scope | author `::part()` rules on the component's shadow parts; the parts' own styling and their CSS custom properties are implemented |
| Exact source behaviour | Shadow-DOM nodes carry `part` attributes: `track`, `track-active`, `track-inactive`, `state-layer`, `thumb-knob`, `value-indicator`, `inset`, `surface` (`packages/core/src/components/md-slider/md-slider.tsx`); page CSS can restyle any of them with `md-slider::part(<name>)` rules. |
| Affected platforms and API | macOS SwiftUI, iOS SwiftUI, Android Compose — `AWCSliderAppearance` (`.awcSliderAppearance(_:)` / `AWCSliderAppearanceScope`), 23 typed hooks, theme tokens. |
| Technical reason | `::part()` is CSS selector syntax over a shadow tree; SwiftUI and Compose have no stylesheet, shadow DOM or selector matching (AUDIT.md: CSS selector syntax is a browser-only facility). |
| User impact | Arbitrary per-part CSS cannot be applied natively; apps restyle through the typed hooks (every `--md-*` property the stylesheet reads). |
| Tested native equivalent | The stylesheet's styling of every part is reproduced (paint 188 / states 22 + 22 / lifecycle 18 against Chrome); each custom property it reads is a typed hook with subtree defaults and local values (Laboratory styles panel, live hosts). |
| Alternative | A typed part surface (as md-avatar / md-list / md-card) is implementable if the reviewer rejects this record. |
| Evidence | `outputs/native-parity/md-slider/checkpoint.json`, `web-oracle/`, this document's Evidence section |
| Reviewer | gate-7 reviewer r6 (R6-03) |
| Acceptance | **NOT ACCEPTED — proposed; needs the reviewer's explicit acceptance (AUDIT.md exception policy)** |

## Gate 7 (reviewer r6, 2026-10-31)

- R6-03 parts: exception proposed below.
- R6-04 `inset-icon` slot: implementation (the slotted node drawn in the inset box under the track mask) with a Chrome oracle case in progress; until it lands the Laboratory's copyable inset-icon example is wrong (it reports "supported").
- R6-05 rendered views measured against the oracles: in progress.
- R6-06 `NativeSliderRatingIntegration` registered in `test-native-views.sh` (fixtures and token sheet by default; a missing oracle file fails).
- R6-07 iOS runtimes: rows above.
- R6-11 hooks without a test (`--md-slider-value-font-family`, `-value-line-height`, `-min-track-length`; `--md-slider-value-indicator-reserve` not typed): oracle cases in progress.
- R6-15 decision 5 (reflected `"false"` booleans): source fix to be proposed test-first.

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
13. **inset-icon slot (custom slotted icon content) not rendered natively.** The inset icon comes from the `icon` property
    (a Material Symbol); the policies list the slot as unsupported. Alternative: render the slotted node in the inset box
    under the track mask. Implementing it: an `AWCNode` child with `slot="inset-icon"` drawn in `paint.inset.rect`.
14. **tools/ax.** `valuetext` on the Web side is CDP's property, which never carries aria-valuetext (fa-057 probe, Chrome
    153: a role="slider" with aria-valuetext reports "", a native range input its value string); native exposes `valueText`
    as the value description. The disabled slider's value label measures the Web ratio (2.06:1; WCAG 1.4.3 exempts inactive
    components). Both are expectations in `tools/ax/expectations.mjs`. Revert: delete the two md-slider entries.

## Installation

Installed in the canonical tree through the main queue by fa-065 (2026-10-30): renderers and dispatch, the Swift
fixtures (`packages/native-ios/Tests/Fixtures/{slider,rating,stepper}-web-oracle/`, byte-identical copies of the
oracles) and the Android assets (`androidTest/assets/{sr,stepper}/`, gzip, verified identical after gunzip), the
Laboratory integration (lab-patch-sr.py, lab-patch-stepper.py), tools/ax cases and expectations, this document and the
AUDIT row. The install was applied to a dry copy first (aborting before canonical on any pre-image mismatch), every
changed file was compared byte for byte with that copy, and a backup allowed a rollback. Verified on canonical in the same
job: AWCUI build, macOS parity, studio suites (no new failures), compiler, playground build, live and snapshot hosts,
SwiftUI examples, Android compile, Laboratory APK on emulator-5554, the 4177 server restarted and probed, tools/ax.

## Remaining

The gate-7 items above marked in progress; then the reviewer's re-check.
