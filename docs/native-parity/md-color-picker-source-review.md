# Color picker source review (md-color-picker)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
six source defects are fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint, per-frame drag/keyboard interaction,
reduced-motion and forced-colours oracles) is captured. The oracle is
**provisional**: it was captured in headless Chromium 141 on Linux while the
Mac runner was blocked, and must be recaptured on the Mac (Chrome 153) and
diffed before it gates native work. No native code has changed. This is not a
native completion record.

## Public contract

**Props.**

* Value model: `value` (`#6750A4`, mutable, reflected), `format` (`hex` |
  `rgb` | `hsl`, reflected), `alpha` (false, reflected).
  * `value` accepts any 3/4/6/8-digit hex (with or without `#`), `rgb()`,
    `rgba()`, `hsl()` and `hsla()`. An unparseable value keeps the last valid
    colour and leaves the string in `value` as given (see decisions).
  * The emitted form is `formatColor(hsva, format)`: hex `#RRGGBB` (uppercase),
    with an `AA` byte appended **whenever alpha < 1, even with `alpha=false`**;
    `rgb(r, g, b)` / `rgba(r, g, b, a)` with `a` to 2 decimals;
    `hsl(h, s%, l%)` / `hsla(…)` with rounded integers.
* Presentation: `variant` (`inline` | `popover`, reflected), `show-hex` (true),
  `show-inputs` (true), `presets` (comma-separated string or string array),
  `density` (0 … −4, reflected), `disabled` (reflected).
* Popover: `open` (mutable, reflected), `dismiss-on-outside-click` (false).
* Accessibility and locale: `aria-label` (`ariaLabelProp`, default
  "Color picker"), `locale` (`en-US`; `ar` and `ro` translate the five built-in
  labels: "Saturation and brightness", "Hue", "Opacity", "Color presets",
  "Current colour").

**Events** (all `bubbles`, `composed`; each detail is shown):

* `mdInput {value}`: every change while dragging, typing a parseable hex,
  stepping a key, picking a preset or committing a channel field. It only
  fires when the formatted string changes.
* `mdChange {value}`: commit. Pointer release (plate, hue, alpha), every
  keyboard step on the plate/hue/alpha, hex blur or Enter, channel `change`,
  preset click/Enter/Space. It fires **after** `mdInput` in the same task, and
  it also fires when nothing changed (hex blur without an edit, re-clicking the
  selected preset, re-pressing an endpoint key).
* `mdOpenChange {open}`: every `open` transition (trigger, Escape, outside
  click, `show()`, `close()`, a controlled `open`).
* Native composed `input` events from the hex/channel `<input>`s also bubble
  out, retargeted to the host (`detail` 0). `change` does not (not composed).

**Methods.** `show()`, `close()` (popover only; `show()` is a no-op when
disabled).

**Slots.** `trigger` (popover only; the consumer's element; the component wires
`click` to toggle and sets `aria-haspopup="dialog"` plus `aria-expanded` on
it). A popover with no trigger logs a console warning.

**Parts.** `popover`, `panel`, `plate`, `thumb` (plate thumb only), `hue`,
`alpha`, `sliders`, `preview`, `field-hex`, `inputs`, `field-r`, `field-g`,
`field-b`, `field-h`, `field-s`, `field-l`, `field-a`, `label` (hex label
only), `presets`, `preset`. The hue and alpha thumbs have no part.

**CSS hooks.** `--md-color-picker-width` (296px), `-plate-height` (176px),
`-radius` (28px), `-surface-color`, `-on-surface`, `-outline-color`,
`-outline-strong` (undocumented in the header), `-thumb-size` (18px),
`-thumb-border` (#FFF), `-preset-size` (32px), `-popover-elevation`.

**Anatomy and geometry** (DPR 1, light, density 0):

* Inline host 296 wide (`max-inline-size: 100%`), panel padding 20, gap 14,
  surface-container-high fill, radius 28. 492 tall with presets, 406 with
  alpha and no presets.
* Plate 256 × 176, radius 16, hue background with a white→transparent
  saturation overlay (mirrored in RTL) and a transparent→black value overlay;
  `role="application"`, focusable, named "Saturation and brightness"; no value
  text.
* Thumbs 22 × 22 (18 + 2px border each side), `currentColor` fill, ring
  shadow. Pressing the plate or a track scales the thumb to 1.15 with a 6px
  primary 16% halo.
* Hue (and alpha) tracks 200 × 14, pill radius, `role="slider"` with
  `aria-valuemin/max/now` and `aria-orientation`; alpha over a checkerboard.
* Preview 42 × 42 circle (`role="img"`, "Current colour <value>"), on the
  inline-end of the slider stack.
* Hex field 256 × 53 (label 11px uppercase, input 33 tall, 13px monospace,
  4px radius, outline-variant border); R/G/B (or H/S/L) 80 wide each; with
  alpha four fields of 58.
* Presets: 32px circles in a wrapping row, `role="listbox"` of `<button
  role="option">` named by the preset string, `aria-selected` when the parsed
  colour equals the current colour (CP2). Hover scale 1.15 + rotate(−4deg),
  press 1.05, selected 1.1 with a ring, selected+hover 1.18.
* Density shrinks the panel padding and gaps (20 → 12 at −4) and, from −3,
  the fields (53 → 45 → 43). The slotted trigger inherits the scale.
* Popover: absolutely positioned under the trigger (margin-top 8), 296 wide,
  padding 20, elevation 3, radius 28; enter = 300ms `pop-in` (scale 0.8 →
  1, translateY −8 → 0, fade) with emphasized-decelerate; origin top-left
  (top-right in RTL). No flip, no viewport clamping.

**Interaction.**

* Plate pointer: pointer capture; S from x (mirrored in RTL), V from y; drag
  past the edges clamps (S 0…100, V 0…100). `mdInput` per move, `mdChange` on
  release, also when released outside.
* Hue/alpha pointer: ratio from x (mirrored in RTL), clamped; the hue reaches
  **360** at the end edge (`aria-valuenow` 360).
* Keyboard (focused plate): Arrow ±1 (Shift ±10), ArrowLeft/Right mirrored in
  RTL; Home/End saturation 0/100; PageDown/PageUp brightness 0/100.
* Keyboard (hue): Arrow ±1 (Shift ±15) mirrored in RTL, wrapping modulo 360;
  Home 0; **End 360 wraps to 0** (thumb at the start, value unchanged red).
* Keyboard (alpha): Arrow ±0.01 (Shift ±0.1) mirrored in RTL, clamped; Home 0;
  End 1.
* Every key step emits `mdInput` (if the string changed) then `mdChange`.
* Hex field: each keystroke that parses (3/4/6/8 digits, `#` optional) sets
  the colour and emits `mdInput`; an unparseable entry sets `aria-invalid`.
  Blur commits (an invalid entry snaps back to the current colour); **Enter
  blurs the field** (focus drops to `<body>`; tested deliberately).
* Channel fields commit on native `change` (Enter, blur, spinner), clamped to
  0–255 / 0–360 / 0–100 / 0–1.
* Presets: click, Enter or Space applies the preset and emits `mdInput` (if
  changed) and `mdChange`. Arrow keys do nothing; every swatch is a Tab stop.
* Tab order (inline, alpha + presets): plate, hue, alpha, hex, R, G, B, A,
  each preset.
* Popover: the trigger toggles (click / Enter / Space). Focus stays on the
  trigger when it opens. Escape anywhere closes; Escape inside the picker is
  consumed (`preventDefault` + `stopPropagation`) so an ancestor `md-dialog`
  stays open (CP5). When the popover closes with focus inside it (Escape,
  `close()`, a controlled `open = false`), focus returns to the trigger;
  an outside click closes it and leaves focus where the user clicked (CP3).
* Disabled: everything inert (tabindex −1, inputs and presets disabled), plate,
  tracks and presets dimmed to 0.5 (CP4), `show()` refused.
* Motion: preset spring 350ms (`spring-spatial-fast`), thumb press 200ms,
  preview colour fade 200ms, popover enter 300ms. Under
  `prefers-reduced-motion` the popover, preset, thumb, field and track
  transitions run at 0.01ms and the preset hover scale drops to 1.06.
* Forced colours: plate, tracks, preview and presets keep their own colours
  (CP6); fields and presets get a `CanvasText` border.

## Paint reference

`paint.json` holds 165 cases: light/dark × LTR/RTL × inline/popover-open ×
13 states (default, alpha, hsl, hsl+alpha, no inputs, no hex/no inputs,
presets, short-hex preset selected, disabled, black, white, red, transparent),
popover closed (4), densities −1…−4 in both variants and directions (16),
an ancestor density −3, keyboard focus on plate/hue/alpha/hex/channel/preset/
selected preset in both directions (14), hover on preset/plate/hue/hex input
in both themes (8), an invalid hex, every CSS hook alone and all together
(inline and popover), a 240px container cap, `ar` and `ro` locales and a
host-`dir` RTL popover. `paint-forced-colors.json` adds 10 forced-colours
cases.

## Interaction and motion reference

`states.json` holds 23 runs (179 phases, 3,408 per-frame samples, 368 events,
550 animation records): plate/hue/alpha drags per frame in LTR and RTL
(including past-edge clamping and release outside), keyboard sequences on the
plate/hue/alpha in both directions, the full Tab order, hex typing (valid,
short, invalid, blur without edit, 8-digit with alpha), RGB and HSL channel
commits, preset hover/press/click/re-click/Space/Enter, the popover cycle in
both directions (trigger click/Enter/Space, Tab into the panel, Escape focus
return, outside click, `show()`, `open`, `close()`), a popover inside an open
`md-dialog`, a disabled picker and controlled `value`/`format`/`alpha`
changes. `states-reduced-motion.json` repeats the popover/preset/thumb motion
with `prefers-reduced-motion: reduce`.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix. The
tests are in `md-color-picker.contract.e2e.ts` (6 tests, all failing before
their fixes).

* **CP1. A controlled value equal to the last emitted string was ignored**
  (`md-color-picker.tsx`). The `lastEmitted` echo guard never cleared, so after
  the picker emitted `#00FF00`, a controlled `#0000FF` and then `#00FF00` again
  left the picker blue (`hex` `#0000FF`, hue 240).
  * Fix: the sentinel is one-shot (cleared when it swallows the echo).
  * Test: preset click, then two controlled values.
* **CP2. Short-hex presets were never marked selected** (`md-color-picker.tsx`).
  `aria-selected` compared the raw preset string with the emitted hex, so
  `#000`, `#f00` or `rgb()` presets never matched.
  * Fix: `isSelectedPreset()` compares the parsed colours.
  * Test: three short-hex presets, selection follows each click.
* **CP3. Closing the popover with focus inside lost focus to `<body>`**
  (`md-color-picker.tsx`). The popover subtree is removed on close.
  * Fix: the `open` watcher returns focus to the wired trigger when the
    active element is inside the popover, except when an outside click closed
    it (focus stays where the user clicked).
  * Test: Escape and `close()` with focus on the plate, plus the outside-click
    guard.
* **CP4. Disabled presets were not dimmed** (`md-color-picker.css`). Plate and
  tracks went to 0.5, the presets stayed at full strength with a pointer
  cursor.
  * Fix: `:host(.md-color-picker--disabled) .md-color-picker__preset` 0.5,
    default cursor.
  * Test: computed opacity and cursor, disabled and enabled.
* **CP5. Escape inside a picker in an `md-dialog` closed the dialog, not the
  picker** (`md-color-picker.tsx`). The picker's Escape listener was on
  `window`, after the dialog's document listener.
  * Fix: a host `keydown` listener consumes Escape while the popover is open
    (the window listener stays for Escape pressed elsewhere).
  * Test: the first Escape closes only the picker and returns focus to the
    trigger; the second closes the dialog.
* **CP6. Forced colours blanked the preset swatches and the preview**
  (`md-color-picker.css`). Only the plate and tracks had
  `forced-color-adjust: none`, so every preset and the current-colour preview
  were painted Canvas (white circles); the selected preset was distinguishable
  only by size.
  * Fix: the preview and presets join the `forced-color-adjust: none` list.
  * Test: CDP-emulated `forced-colors: active`, computed swatch colours.

The readme now documents the Escape/focus behaviour, preset matching, forced
colours, and the RTL arrow mapping (it said "ArrowRight always moves the same
logical way"; it raises the value in LTR and lowers it in RTL).

## Observed, not changed (decisions needed)

* **Enter in the hex field drops focus to `<body>`.** Enter commits by
  blurring the input. `test-utils/editing.browser.ts` asserts the blur, so it
  is deliberate; it is still a keyboard trap-out (in the popover, focus leaves
  the open panel). Recommendation: commit in place.
* **`mdChange` without a change**: hex blur with no edit, re-clicking the
  selected preset, re-pressing an endpoint key.
* **Typed alpha with `alpha=false`.** A 4- or 8-digit hex typed into the hex
  field (even transiently: `#ff57` while typing `#ff5722`) sets alpha, and the
  emitted value carries it although no alpha control is shown.
* **Hex text is not canonicalised** on commit: `0f0` and `#ff5722` stay as
  typed while `value` is `#00FF00` / `#FF5722`.
* **Hue end-point mismatch**: pointer reaches hue 360 (`aria-valuenow` 360),
  End wraps to 0 and puts the thumb at the start.
* **Greys reset the hue** (HSV round trip): picking black or white sets hue 0,
  so the plate turns red.
* **`format` changes do not reformat `value`**; an invalid controlled `value`
  stays in the attribute.
* **Accessibility**: the plate `role="application"` has no value text; the
  presets listbox has no arrow keys or roving tabindex; the popover dialog
  does not move focus on open and has no `aria-modal`; the hex label's
  accessible name is "HEX" (text-transform).
* **Popover placement**: no flip or viewport clamping; the documented close
  animation (`[data-state="closing"]`) is never applied, so closing is
  instant.
* **Reduced motion** leaves the 200ms preview colour fade
  (`.md-color-picker__preview-inner`; the block lists `.preview`). It is a
  colour fade, not movement.
* **Escape pressed outside the picker** while it is open inside a modal still
  reaches the modal first (only Escape inside the picker is consumed).
* **Localisation**: Hex/R/G/B/H/S/L/A labels are fixed English (documented);
  English defaults mix "Color" and "colour".
* **Native composed `input`** leaks from the inner fields (library-wide
  pattern).

## CEM / source drift

* The CSS header lists a `state-layer` part (none exists), says "SLOTS
  (none)" (there is a `trigger` slot), and omits
  `--md-color-picker-outline-strong`.
* The hue and alpha thumbs have no part, so the `thumb` part styles only the
  plate thumb.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch,
  serial): own suites before 9 suites / 136 tests (both components); own +
  `md-dialog` before 14 / 233, after 16 / 243. Contract tests: 9 failed on the
  original source (`before-contract2.log`), the forced-colours test failed on
  its own (`cp-fc-before.log`), all pass after (`final-own2.log`). See
  `outputs/native-parity/md-color-picker/source-tests/`; the diffs are in
  `source-changes/`.
* **Oracle:** `outputs/native-parity/md-color-picker/web-oracle-cloud/` (see its
  README): `paint.json` 165 cases, `paint-forced-colors.json` 10,
  `states.json` 23 runs / 179 phases / 3,408 frames,
  `states-reduced-motion.json` 1 run / 5 phases / 138 frames, 359 screenshots.
