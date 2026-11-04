# Slider native implementation plan (md-slider)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-slider-source-review.md](md-slider-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-slider/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Inputs.swift`, `slider` /
`nativeSlider`; form glue in `NativeForms.swift` and `NativeBehaviorViews.swift`):

* A `VStack` that starts with a visible caption `Text(sliderAriaLabel)`.
* Then one SwiftUI `Slider` per value. Range uses **two stacked sliders**:
  the start is bounded above by `valueEnd`, the end below by `valueStart`.
* Each row has `symbol(icon)` in front of the slider and a value `Text`
  formatted `"%.1f"` after it.
* The value text shows when `labeled || valueIndicator`, and `valueIndicator`
  **defaults to true** here.
* Events:
  * `mdInput` on every set, with `{value}`, or for range
    `{value: p("value"), valueStart, valueEnd}`;
  * `mdDragStart` / `mdDragEnd` `{thumb, …}` from `onEditingChanged`;
  * `mdChange` after `mdDragEnd`.
* `accessibilityLabel` is `ariaLabelStart` (or `ariaLabelEnd`) falling back to
  `sliderAriaLabel`, then "Value". There is no accessibility value.
* Disabled comes from the shared `.disabled(...)` modifier.
* Form: entries under `name-start` / `name-end`, falling back to `name`
  (matches Web), and reset re-applies both values.

**Android** (`packages/native-android/.../AWCInputs.kt`, `"md-slider"`; form
glue in `AWCFormControls.kt`):

* Material 3 Compose `Slider`, or `RangeSlider` for range, with
  `steps = span/step − 1` (clamped to 0–1000). **Compose draws tick marks
  whenever `steps > 0`**, so every slider shows ticks.
* `mdInput` per change: `{value}` or, for range,
  `{value: end, valueStart, valueEnd}`. `mdChange` from
  `onValueChangeFinished`.
* No drag or focus events.
* `labeled || valueIndicator` adds a `Text` below, showing `valueText` or the
  float (`"50.0"`).
* `contentDescription` is `sliderAriaLabel`, "Value" or "Range". There is no
  state description and no per-thumb labels.
* Form: a `{start, end}` map with Web-shaped entries.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Anatomy | Active/inactive segments with 4px handle gaps; 4-wide handle; inner radius 2; outer 8/8/12/16/28 | System slider (knob, thin track) | M3 Compose slider (round thumb), default track |
| Sizes | xs/sm/md/lg/xl track 16/24/40/56/96, handle 44/44/52/68/108 | None | None |
| Variants | `standard`, `centered` (fills from the midpoint) | Standard only | Standard only |
| Range | One rail, two thumbs; **push**; drag hand-over; nearer thumb on a track press | Two stacked sliders that **block** | `RangeSlider` blocks |
| Stops | Only with `stops`; 4×4 dots; on-primary / on-secondary-container | None | **Always** (any `steps > 0`) |
| Value indicator | Off by default; 48×44 inverse-surface pill above the handle; the step's decimals | **On by default**; `"%.1f"` text beside the slider | Off by default; plain text below; float or `valueText` |
| Inset icon | Inside the track at the start, md+ single only | Leading icon outside the track whenever `icon` is set | None |
| Visible label | None (`aria-label` only) | **Visible caption** | None |
| Orientation | Horizontal or vertical, track length 200, `full-height` | Horizontal only | Horizontal only |
| Controlled | Never writes props; live drag; returns to the prop on commit | Ignored (writes local state) | Ignored |
| Event details | Range `value` = moved thumb (fixed S1) | Range `value` = the `value` prop (wrong) | Range `value` = end (wrong) |
| Event set and order | Input…, DragStart/End, Change, Focus/Blur; keyboard brackets every key | Input, DragStart/End, Change; no Focus/Blur | Input, Change only |
| Disabled | No events (fixed S9); 0.38 host (S5 open) | `.disabled` | `enabled = false` |
| Semantics | Per-thumb slider; label, `label-start` / `label-end`; `valuetext`; vertical orientation (fixed S7) | Label only; no value text | `contentDescription` only |
| Keyboard | Arrows ±step, Page ±max(step, span/10), Home/End; horizontal RTL mirrored; vertical not | System | System |
| Form | `name` / `name-start` / `name-end`; reset; restore | Matches (reset; no restore) | Matches |
| Motion | Press morph 100ms; stops spring 350ms; tick fades 200ms | System | Compose defaults |
| Reduced motion | No motion (fixed S4) | n/a | n/a |
| Density | Host, track and knob −4/step (track ≥ 8); bubble 44→28 (fixed S10) | No | No |
| RTL | Horizontal mirrored | SwiftUI default | Compose default |

## Plan

1. **Shared value model** (both platforms; data-only so it can be tested
   headless):
   * clamp to [min, max] and snap to `min + k·step`;
   * range push and hand-over, and the nearer thumb on a press;
   * controlled live state that returns to the props on commit;
   * event details, with range `value` = the moved thumb;
   * one documented event order (see S12).
   * Port the Web contract tests: event details, controlled commit (DOM and
     paint), disabled emits nothing, range push.
2. **iOS `AWCSlider` view** (replaces `nativeSlider`):
   * A custom track: active and inactive capsules with 4pt handle gaps and
     inner radius 2, plus a 4-wide handle. Sizes and outer radii from the
     table; the centered fill; stops dots only with `stops`.
   * A single rail for range, with two thumbs.
   * Vertical orientation with track length and full height.
   * An inset icon inside the track (md+ single only).
   * The value bubble only when `valueIndicator` is set. Unless the open
     decision below keeps them, drop the visible caption and the leading
     icon.
   * Accessibility: one adjustable element per thumb
     (`accessibilityAdjustableAction` ±step), `accessibilityValue` from
     `valueText` / `valueStartText` / `valueEndText` (otherwise the number),
     and labels from `aria-label` / `label-start` / `label-end`.
   * Drag start/end from the gesture; Focus/Blur from `@AccessibilityFocusState`
     (decision: whether to emit them on iOS at all).
3. **Android**:
   * Keep M3 `Slider` / `RangeSlider` with `SliderState`, custom `track` and
     `thumb` slots for the expressive shape (4dp handle, gaps, sizes), and
     tick drawing only when `stops`.
   * Centered fill in the track slot.
   * Vertical via the M3 vertical slider (or a rotated layout with corrected
     semantics).
   * Inset icon in the track slot.
   * `semantics { stateDescription = valueText; contentDescription per thumb }`.
   * Drag start/end from the `interactionSource`; Focus/Blur from focus
     events.
   * Fix the range `value` detail.
4. **Motion**: a press morph to 2 wide over 100ms emphasized; the stops spring
   at 350ms with overshoot; tick fades at 200ms. Gate all of them on
   `accessibilityReduceMotion` / the animator scale.
5. **Density and RTL**: host, track and knob −4 per step (track ≥ 8); bubble
   44→28. Mirror horizontal only; keep vertical arrows unmirrored.
6. **Verification**: diff against the recaptured Mac oracle (paint geometry
   and colours per case; per-frame drag and keyboard samples; event
   sequences; the reduced-motion run with no animations).

## Open decisions to settle before native work

* **S5 disabled colours:** the double dim, and how disabled ticks, the bubble
  and the inset icon look.
* **S6 off-step values:** snap at load, or keep the authored value.
* **S11 inset icon:** whether it moves to the inactive side at low values
  (as M3 does), and the threshold.
* **S12 event order:** which `mdChange` / `mdDragEnd` order natives must
  copy (Web differs by input path), and whether `mdChange` per key press is
  the intended contract.
* Whether iOS keeps a visible caption or value text by default. The Web shows
  neither.
* Value text format: Web uses the step's decimals; iOS uses `%.1f`.
