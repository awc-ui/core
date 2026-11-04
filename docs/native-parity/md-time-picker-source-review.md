# Time picker source review (md-time-picker)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried
and checked against the source, the component suites pass, and a browser
reference (paint, per-frame dial / keyboard / open-close runs, reduced motion)
is captured. **No component defect was found.** The two environment-suite
failures reported by the text-field fork are a test race on a cold first open,
not a component defect; the test utility now waits for the dialog to hydrate
(one test-only change, below). The oracle is **provisional**: it was captured
in headless Chromium 141 on Linux while the Mac runner was blocked, and must be
recaptured on the Mac (Chrome 153) and diffed before it gates native work. No
native code has changed. This is not a native completion record.

## Public contract

**Props.**

* Value model: `value` (`HH:MM`, 24-hour, mutable, reflected), `min`, `max`
  (same form; a reversed pair is an overnight window), `minute-step` (1;
  clamped to 1…30), `required`, `name`, `disabled`, `open` (mutable, reflected).
* Presentation: `variant` (`input` default | `dial`), `format` (`12h` default
  | `24h`; display only), `period-layout` (`vertical` default | `horizontal`;
  ignored in 24h), `orientation` (`vertical` default | `horizontal`; dial only),
  `responsive`, `hide-trigger`, `density` (0 … −4), `reserve-supporting-space`.
* Field: `label` ("Select time"), `supporting-text`, `error` / `error-text`
  (mutable).
* Labels (all props, English defaults): `headline` (overrides both of)
  `headline-dial-label` ("Select time") / `headline-input-label` ("Enter
  time"), `am-label`, `pm-label`, `hour-label`, `minute-label`, `period-label`,
  `cancel-label`, `ok-label`, `toggle-dial-label`, `toggle-input-label`,
  `value-missing-label`, and the three range templates
  `range-underflow-label` / `range-overflow-label` / `range-outside-label`
  (`{min}` / `{max}` interpolate, every occurrence).

**Anatomy.** A read-only `md-text-field` trigger (`trigger`, `trigger-icon`;
Tab focuses it, click / Enter / Space open). A modal dialog (`scrim`,
`dialog`, `headline`, `body`, `time-area`, `input-hour`, `input-minute`,
`period-toggle`, `period-am` / `period-pm` with ripples, `dial-wrap`, `dial`,
`dial-hand`, `input-area`, `footer`, `toggle-mode`, `actions`,
`cancel-button`, `confirm-button`). No slots.

**Value and formats.** `value` is canonical `HH:MM` whatever `format` is;
`"9:05"` canonicalizes to `"09:05"` on load; a malformed value is treated as
empty. 12h shows `h:MM AM/PM` in the trigger; 24h shows `HH:MM`.

**Dial.**

* 12h: one ring of 12 hours. 24h: outer ring 1–12, inner ring 13–23 and 00
  (shorter hand). Minutes: 12 marks, any minute selectable by angle.
* Pointer: press and drag move the hand live (one `mdInput` per distinct
  `HH:MM`); releasing on the hour view hands over to the minute view. The hand
  angle is unwrapped so it turns the short way across 12 / 00 (oracle run
  `dial-minute-step-wrap`).
* `minute-step` rounds the dragged minute to the nearest step (mod 60) and is
  also the ArrowUp / ArrowDown step in the minute field. Typed minutes keep
  1-minute granularity. (The readme says the step applies to the dial only;
  the arrow-key step is not documented. See open items.)
* The dial is `role="presentation"`; keyboard users drive the same value
  through the HH / MM fields. Clock geometry is never mirrored in RTL.

**HH / MM fields** (both modes). `role="spinbutton"` with the hour / minute
labels, `aria-valuenow` omitted while the buffer is invalid. Digits replace
the selected buffer (max 2). ArrowUp / ArrowDown step and wrap (12h hours
cycle 1–12 without flipping the period). Focusing the minute field switches
the dial to minutes. Enter commits when both buffers are valid; otherwise the
dialog stays open. There is **no auto-advance** from a full hour buffer to the
minute field (oracle `input-keyboard-24h-rtl`: `23` then `59` leaves 23:30).

**Period.** `role="radiogroup"` named by `period-label`, two `role="radio"`
pills with roving tabindex; arrows toggle, Home = AM, End = PM, Space selects.

**Mode toggle.** The footer button switches dial ↔ input inside the open
dialog whatever `variant` is; `mdModeChange {mode, previousMode}`; `variant`
is not mutated. The headline follows the mode.

**Layout.** Portrait dialog ~328px wide; `orientation="horizontal"` gives the
two-column landscape dial dialog (12h / 24h widths are hooks). `responsive`
treats variant / orientation as a preference: input below ~460px viewport
height, horizontal dial at ≥720px wide landscape (demoted below ~620px).

**Events** (all bubble and are composed except `mdValidityChange`, which is
`composed: false`). Observed order in the oracle:

* Dial drag: `mdInput` per distinct `HH:MM` while dragging (hours, then
  minutes); the period pill emits `mdInput`.
* Commit (OK, or Enter with valid buffers): `mdChange` then `mdClose` in the
  same frame. `mdValidityChange` precedes `mdChange` when validity flips.
* Cancel / Escape / scrim / `hide()`: `mdCancel` then `mdClose`; the value is
  restored.
* `mdOpen` on open (also from `show()`).
* `MdTimePickerChangeDetail = {value, iso, isoDateTime, date, hours, minutes,
  period}`; `isoDateTime` / `date` are today's date at that time, serialized
  to UTC.

**Methods.** `show()`, `hide()` (a Cancel), `getValidity()`,
`checkValidity()`, `reportValidity()`. (The date picker uses `close()`.)

**Validity and forms.** Form-associated. `required` → value-missing; `min` /
`max` → range-underflow / -overflow, both flags plus `range-outside-label` in
the excluded middle of an overnight window. `mdValidityChange` never fires on
mount and never repeats a state. Form reset restores the first-render value.
`<fieldset disabled>` disables it and closes an open dialog. Oracle
`form-bounds`: submit with required empty is blocked; 12:00 in a 22:00–06:00
window commits and reports the outside message; 23:15 is valid; reset returns
to empty and reports value-missing.

**Focus.** The dialog is `role="dialog" aria-modal="true"`, labelled by the
headline. Focus lands on the hour field; Tab cycles hour → minute → period →
mode toggle → Cancel → OK → hour; Shift+Tab wraps the other way; escaped
focus is recovered on the next Tab. Escape is handled by the topmost picker
only. Focus returns to the trigger (or the external opener with
`hide-trigger`).

**Motion** (from the oracle `anims`): scrim fade-in 150ms; dialog enter 500ms
(`md-time-picker-dialog-in`, emphasized decelerate); mode swap 450ms on the
incoming dial / input area; hand rotation 200ms emphasized; dial-number colour
150ms; period pill colours 150ms. The dialog has no exit animation. The action
buttons' shape-morph radius transition (400ms) on mount comes from `md-button`,
not from the picker.

**Reduced motion.** One `!important` block removes animation and transition
from the scrim, dialog, dial wrap, input area, hand, period pills, dial numbers
and inputs. The reduced-motion oracle run records no picker animations (see the
oracle README for the exact count; `md-button` / `md-ripple` children are
governed by their own components).

**Density.** −1…−4 locally; trigger icon, headline, HH / MM tiles, AM / PM and
numerals taper; the 256px dial and 48px targets do not.

**RTL.** The dialog, field order and period pills mirror; the dial does not.

## Environment-suite failures (text-field fork report)

`md-time-picker.environment.e2e.ts` had two failing scenarios, `focus` and
`dial`, on the fixed **and** the original source.

* **Cause.** On a cold first open the dialog's `md-button` and
  `md-icon-button` children hydrate asynchronously (lazy bundles). Until they
  do, an action host has no `tabindex`, so the trap's focusable list misses
  it: the "reverse Tab recovers at the final action" check fails. The dial
  check fails the same way: the next render that swaps the face to minute marks
  is held behind the unhydrated children. A warm run (bundles cached) passes;
  the debug run reproduced cold-fail / warm-pass deterministically.
* **Verdict.** Test / environment race, not a component defect in steady
  state. The scenarios called `show()` and asserted after two animation
  frames.
* **Change (test-only).** `test-utils/environment.browser.ts` awaits
  `componentOnReady()` on every shadow child after opening (`hydrated()`), in
  the `focus` and `dial` scenarios. 4/4 environment tests pass.
* **Residual note (not fixed).** During the first-open hydration window (tens
  of milliseconds, first open per page only) Shift+Tab can be swallowed and the
  dial face can lag. Native has no equivalent window.

## Source changes

Component source: none. Test utility: the one change above.

## Tests

* Own suites (date + time picker, run together, serial): before 18 suites,
  552 / 554 (the 2 environment failures); after 21 suites, 570 / 570
  (16 new date-picker tests in three new files, plus the 2 repaired environment tests).
* Time picker alone: 9 suites, all pass, including environment 4 / 4.
* Dependents (`md-text-field` spec, axe spec, inline-validation e2e;
  `md-tooltip` e2e): 4 suites, 238 / 238 before and after.

## Open items

* `minute-step` also sets the ArrowUp / ArrowDown step in the minute field;
  the readme says it snaps the dial only. Decide which is the contract
  (natives must copy one).
* No auto-advance from a full hour buffer to minutes; extra digits are
  dropped. Android's Compose `TimeInput` advances. Decide whether natives
  should advance.
* Stylesheet hooks read but not documented: `--md-time-picker-time-display-bg`,
  `-time-display-shape`, `-hand-length`, `-dial-number-font-weight`,
  `-dial-number-active-font-weight`, `-input-font-weight`, `-input-hint-gap`,
  `-input-hover-opacity`, `-period-font-size`, `-period-font-weight`,
  `-period-hover-opacity`, `-period-vertical-height-input`. Document them or
  make them private. (Paint oracle cases `undocumented-*` cover four.)
* Composite hook names in the readme (`--md-time-picker-dial-hand-color` /
  `-hand-width`) abbreviate `--md-time-picker-dial-hand-width` ambiguously.
* `hide()` vs the date picker's `close()` naming (documented, kept).
* First-open hydration window (above).
