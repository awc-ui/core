# Rating native implementation plan (md-rating)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-rating-source-review.md](md-rating-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-rating/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Actions.swift`, `rating`; form
glue in `NativeForms.swift`):

* **Layout.** An `HStack(spacing: 4)` with one `Button` per item and the
  label `"i of N stars"`; the container label is `ratingLabel`.
* **Tap.** A tap sets the item's index. At precision 0.5, tapping the current
  full value steps down to `index − 0.5`. Nothing resets to `default-value`.
* **Glyphs.**
  * Full items use `icon`, and the full test reads
    `n("value", n("defaultValue"))`.
  * The half glyph is always SF `star.leadinghalf.filled`, whatever the icon.
  * Empty items use `emptyIcon`, which defaults to `star_border`.
* **Colour and size.** Every glyph is `theme.primary`, sized `size·0.6`.
* **Value label.** `showValueLabel` shows the raw value ("3").
* **State.**
  * `readOnly` guards the action but still renders buttons.
  * `disabled || softDisabled` goes through the shared `.disabled`, so
    soft-disabled is not focusable.
* **Form.** 0 submits nothing (matches Web). There is also a `required`
  validation that Web does not have.

**Android** (`packages/native-android/.../AWCInputs.kt`, `"md-rating"`):

* A `Row` of 40dp `IconButton`s drawing the text characters "★" and "☆" in
  `colorScheme.primary`. `max` is clamped to 1–20.
* A click sets the index; clicking the current value goes to **0**, not
  `default-value`.
* There is no half precision and no icon support.
* `enabled && !readonly`, so readonly items render as disabled buttons.
* Semantics per star: `"i of max"` with `selected`.
* `showValueLabel` shows the float ("3.0").
* Form: 0 submits nothing (matches Web).

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Semantics | **One** slider (`valuenow` / `valuetext`, min 0, max `max`); readonly = image "Rating: N Stars" | N buttons, "i of N stars" | N buttons, "i of max" + selected |
| Name | `aria-labelledby` → `aria-label` → `<label>` → `rating-label` | `ratingLabel` on the container | None |
| Value text | `getLabel` or "Empty" / "1 Star" / "N Stars" | None | None |
| Precision 0.5 | Inline-start half of the item (pointer); ±0.5 keys | Re-tap toggles to −0.5 | None |
| Re-click | Resets to `default-value` | No reset | Resets to 0 |
| Glyphs | Any Material Symbol; filled layer clipped by fraction; empty = `icon` outlined (FILL 0) or `empty-icon` (FILL 1, wght 400) | Material→SF mapping; half always a star | ★/☆ characters |
| Colours | Active secondary; empty on-surface-variant at 30% | primary everywhere | primary everywhere |
| Sizes, gap | 16/20/28/36/48; gap 4; density −2/step | `size·0.6` font | 40dp buttons |
| Hover preview | `mdHover`; preview fill; value label follows | None | None |
| Keyboard | Arrows (RTL mirrored), Up/Down, Home/End, digits | None | D-pad moves between buttons |
| Readonly | Full opacity, image role, not focusable | Buttons that ignore taps | Disabled buttons (dimmed) |
| Disabled / soft-disabled | 0.38; soft-disabled stays focusable with `aria-disabled` | Both `.disabled` | `enabled` only |
| Value label | `getLabel` or "N Stars", width reserved | Raw number | Float |
| Motion | Pop 1.12 at 150ms; state layer 8% / 12%; glyph ripple 420ms | None | IconButton ripple |
| Reduced motion | Pop and fades removed; ripple kept (R3 open) | n/a | n/a |
| RTL | Mirrored row, fill and keys (fixed R1) | `HStack` mirrors; the SF half glyph mirrors | `Row` mirrors |
| Form | `name`; 0 → no entry; reset | Matches, plus `required` | Matches |

## Plan

1. **Shared model** (data-only):
   * clamp to [0, `max`];
   * pointer to value (precision, inline-start half, mirrored in RTL);
   * re-click resets to `defaultValue`;
   * the key map: arrows, Up/Down, Home/End, digits ≤ max;
   * label resolution (`getLabel`, otherwise "Empty", "1 Star", "N Stars");
   * emit rules: `mdChange` only on a change and never for programmatic
     writes; `mdHover` on preview changes, and `null` on leave or blur.
   * Port the Web tests: the RTL mapping, the re-click reset, and the
     `outline-empty` semantics.
2. **iOS `AWCRating` view:**
   * **Semantics.** One accessibility element
     (`.accessibilityElement(children: .ignore)`) with
     `.accessibilityValue(label)` and `.accessibilityAdjustableAction`
     (±precision). Readonly is `.isImage`, named "Rating: N Stars".
     Soft-disabled stays focusable but inert.
   * **Glyphs.** Empty, filled-clipped and state layers drawn with the
     Material Symbols font (FILL axis) to match Web. Otherwise use an SF
     Symbols mapping with a leading-edge mask for partial fill, not a fixed
     half star.
   * **Look.** Colours, sizes, gap and density from the tables.
   * **Value label.** Reserve the widest label.
   * **Hover.** `.onContinuousHover` (iPad pointer) drives the preview and
     `mdHover`.
   * **Keys.** Hardware keyboard via `.onKeyPress`, with a focus ring.
3. **Android:**
   * **Semantics.** A single focusable composable with slider semantics:
     `progressBarRangeInfo`, `setProgress` ±precision and `stateDescription`
     = the label. Readonly gets the image role.
   * **Glyphs.** Drawn with the Material Symbols font (or vectors), with a
     clip for the partial fill.
   * **Input.** `onKeyEvent` for arrows, D-pad and digits; `pointerInput`
     hover events for the preview; a glyph-shaped ripple.
   * **Readonly.** Not dimmed.
4. **Motion:** hover pop 1.12 over 150ms emphasized, state-layer opacity
   8% / 12%, a 420ms glyph ripple. Gate on reduce-motion as R3 decides.
5. **Verification:** diff against the recaptured Mac oracle (per-item fill
   fraction and clip side, colours, sizes; hover, click and keyboard
   sequences, with events; reduced motion).

## Open decisions to settle before native work

* **R3:** whether the press ripple honours reduced motion (library-wide
  ripple policy).
* **R4:** snap programmatic values to the precision grid, or render them
  exactly.
* **Touch:** whether a tap should emit `mdHover`. Phones have no hover.
* **`required`:** drop it from iOS, or add it to Web.
* **iOS glyph source:** Material Symbols, which gives Web parity and the FILL
  axis, or a mapping to SF Symbols.
* **The `empty-icon` default:** Web `star` with `outline-empty`; iOS
  `star_border`.
