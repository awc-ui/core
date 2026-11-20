# OTP field source review (md-otp-field)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried below.
* One source defect is fixed test-first and mirrored into
  `packages/core/src` (D5).
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux, and must be recaptured on the Mac (Chrome 153) and diffed. No native
code has changed.


Native checkpoint (2026-10-31): Mac Chrome 153 oracles (job n3-001); dedicated SwiftUI and Compose renderers, the Laboratory integration and the accessibility evidence are installed and recorded — see [md-otp-field.md](md-otp-field.md) (open items listed there).
## Composition

* There is one `<input>` per character (`part=cell`) inside a
  `role=group` row (`part=cells`, `aria-label` from `label`).
* The row is pinned LTR in RTL documents (codes read left to right). In RTL
  it is aligned to the inline-start (right).
* `group-size` inserts `part=separator` spans. The `separator` slot is
  assigned to the first gap only; later gaps keep the built-in dot.
* Cell 0 carries `autocomplete=one-time-code` (the SMS autofill target).
  There is no `maxlength`, so an autofill or IME burst reaches the
  pipeline intact.
* Form-associated. The form value is the code; empty submits nothing.

## Public contract

* **Length and filtering:**
  * `length` (6).
  * `validation-type` is `numeric` (default), `alpha`, `alphanumeric` or
    `none`.
  * `transform` is `none` or `uppercase`.
  * One pipeline for every entry path: strip whitespace → transform →
    filter → clamp.
  * Rejected characters emit `mdInvalidInput {attempted, reason}`, where
    `reason` is `input-change` or `input-paste`.
* **Value model:** contiguous. A character typed past the fill point lands
  in the first empty cell.
  * Backspace in a filled cell clears it (later characters shift left).
    In an empty cell it clears the previous character.
  * Delete removes the character at the caret's cell.
  * ←/→/Home/End move between cells. Every cell is a Tab stop.
* **Paste:** pasting anywhere replaces the whole value from cell 0. A
  complete paste always emits `mdComplete`, even when the code is unchanged
  (a retry).
* **Completion:** `mdComplete {value}` fires when the code becomes
  complete. With `auto-submit` it is followed by `form.requestSubmit()`.
* **Commit:** `mdChange` fires when focus leaves the group, and on
  completion.
* **Other props:** `mask` (password cells), `inputmode` override, `required`
  (`value-missing-label`), `incomplete-label`, `error` / `error-text`,
  `supporting-text`, `cell-label-template` ("Character {index} of
  {length}"), `density`, `reserve-supporting-space`, `disabled` and
  `readonly`.
* **Methods:** `setFocus` (focuses the first empty cell), `clear`,
  `getValidity`, `setCustomValidity`, `checkValidity` and
  `reportValidity`.
* **CSS hooks:** `--md-otp-field-{cell-gap, cell-height, cell-shape,
  cell-width, focus-color, font-size, outline-color}`.

## Layout and paint reference

* **Cells:** 48×56 with an 8px gap, radius 8, a 1px outline (`#79747E`
  light, `#938F99` dark) and 24px text (`#1C1B1F` / `#E6E1E5`).
  * Focus: the border becomes 3px primary (`#6750A4`); there is no outline
    ring.
  * Error: an error border and error text, with `role=alert` on the
    supporting text.
  * Disabled: 38% opacity.
* **Group gap:** with `group-size`, an 8×8 on-surface-variant dot replaces
  the 8px gap in a 28px slot.
* **Density −4:** 32×40 cells, 4px gap, 20px text.

## Interaction reference

Runs: `otp-keyboard-{ltr,rtl}`, `otp-paste-autosubmit` and
`otp-alpha-uppercase-mask`.

* **Keyboard sequence:**
  * Clicking cell 3 on an empty code focuses cell 3; the first typed
    character lands in cell 0.
  * `12` → `mdInput "1"`, `"12"`.
  * `x` → `mdInvalidInput {attempted:"x"}`.
  * `3456` → four `mdInput`s, then `mdChange "123456"`, then
    `mdComplete`.
  * Typing `7` in the last cell → `123457` (fix D5).
  * ← moves to cell 4; Backspace there gives `12347`; Home and End move
    focus.
  * Tab leaves cell by cell, and `mdChange` fires when focus leaves the
    group.
* **Paste** `" 12-34 56x"` → `mdInvalidInput`, `mdInput "123456"`,
  `mdChange`, `mdComplete`, then the form `submit`. Re-pasting the same code
  → `mdComplete` and `submit` again.
* **Alphanumeric + uppercase + mask:** typing `a1!b` gives `A1B` (`!`
  rejected). The cells show bullets.
* There is no component motion apart from the focus-outline colour.
  Reduced motion is identical.

## Source defects fixed (test-first)

* **D5. A keystroke in the filled last cell was dropped**
  (`md-otp-field.tsx` `handleInput`; readme).
  * The bug: select-on-focus is what makes a keystroke replace a cell. After
    the last character focus stays put with the caret after it, so the
    browser appended. The pipeline then wrote the old character back and
    discarded the new one. A user could not correct the last digit without
    Backspace.
  * The fix: a real `insertText` into a filled cell takes only the typed
    data and replaces that cell. A filtered keystroke reports
    `mdInvalidInput` with just the typed character and restores the cell.
  * Test: `md-otp-field.overtype.e2e.ts`, 4 tests. Two are guards that
    passed before the fix: middle-cell replace, and a filtered keystroke.

## Observed, not changed (decisions needed)

1. **Editing a complete code:** typing over a digit of a complete code
   updates the value but never re-emits `mdComplete` (only a paste
   retriggers it). A server-rejected code that the user corrects by typing
   is therefore never re-announced. Should completion fire again whenever a
   complete value changes?
2. **Tab stops:** every cell is a Tab stop (6 Tab presses to leave). The
   alternatives are roving tabindex with one stop, or matching iOS/Android,
   which use a single field.
3. **IME:** Backspace and Delete call `preventDefault` without a
   composition check. That matters only for `validation-type="none"` or
   `alpha` with an IME.

## Decisions (autonomous, 2026-10-27, reversible)

1. **Editing a complete code.** Native follows the source: typing over a digit of a complete code updates the value without a new
   `mdComplete`; a complete paste re-fires it even when the code is unchanged. *Alternative:* fire whenever a complete value
   changes (a source change). *Revert:* drop the `prev.count < count` guard in `maybeComplete` (Swift and Kotlin) once the
   source does.
2. **Tab stops.** Every cell is a native focus stop and Tab / Shift+Tab move cell to cell, as in the source (six presses to leave
   a six-cell field). *Alternative:* one roving stop, or the single hidden field of the iOS / Android one-time-code pattern (that
   changes the accessibility tree and autofill). *Revert:* not applicable.
3. **IME.** Native Backspace / Delete are commands only outside a composition (the text system's own deletion runs while marked
   text exists), which is what the source's missing composition check should do. It only matters for `validation-type="none"` or
   `alpha` with an IME. *Revert:* pass `composing` through to `key(_:_:)` unconditionally.
4. **Paste into a masked cell (macOS).** `NSSecureTextField` never calls `paste:` on a custom field editor; the pasted text
   arrives as one edit and runs the same whole-value pipeline as the source's paste handler (whitespace stripped, `mdInvalidInput`
   with `input-change`, completion not forced). *Revert:* not applicable (AppKit secure-input behaviour).
5. **Hover on iOS / iPadOS.** A touch never hovers. The iPadOS pointer (trackpad, mouse; pencil hover) hovers a cell through
   `.onContinuousHover`, the native equivalent of the source's `:hover` (no exception needed); the iOS states suite rests that
   pointer where Chrome's mouse rests (the simulator cannot inject pointer hover, so the suite drives the same entry,
   `AWCOTPFieldRuntime.pointerHover`). After a tap without a pointer the cell rests on the outline colour. *Revert:* read the
   host pointer state on iOS in `hovered(_:)`.
6. **Cell frame for assistive technologies (macOS).** Chrome's textbox is the whole 48 × 56 bordered cell; the native text input is
   the text line inside it. macOS reports the cell box (AXPosition / AXSize grown to the border), so VoiceOver's cursor and the
   contrast measurement see the cell's border as on the Web. *Alternative:* the inner line box. *Revert:* `axOutset = .zero` in
   `inputConfig`.
7. **Group semantics.** Web's `role="group"` named by `label`: macOS an AXGroup with that name (not itself disabled — only the
   cells are), iOS a semantic group, Android a traversal group whose content description carries the label (Compose has no named
   group role; tools/ax records it as text, as for md-tabs and md-breadcrumbs). *Revert:* not applicable.
8. **Tab in the SwiftUI live host.** The Laboratory host sends Tab through the focused cell's field editor (the hardware path), so
   the cell's own Tab handling moves to the next cell; the window's key-view loop would skip the cells. *Revert:* remove the
   md-otp-field line of the live renderer's Tab routing.

## Evidence

* Oracle: `outputs/native-parity/md-otp-field/web-oracle-cloud/` (168 paint
  cases, 4 runs, 4 reduced-motion runs, `SHA256SUMS`).
* Tests: 6 suites, 63 tests, all pass. The baseline was 5 suites and 59
  tests.
