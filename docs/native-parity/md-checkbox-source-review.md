# Checkbox source review

Status: Gate 1 (Web source contract checkpoint) complete. The contract is inventoried, two source
defects are fixed test-first and mirrored into `packages/core/src`, and the Mac paint and interaction
oracles (Chrome 153, from the build with both fixes: `web-oracle/web-states.json`, 12 runs;
`web-states-reduced.json`, 3 runs) are the gate for the native checks. The cloud capture below remains
as the provisional record it was.

Native renderers: implemented, verified and installed on both platforms — see [md-checkbox.md](md-checkbox.md).
The interaction oracle was recaptured on the Mac (Chrome 153) from the build with C1/C2.

See [md-checkbox-native-plan.md](md-checkbox-native-plan.md) for what the fixes change for both.

## Public contract

Properties: `checked` (mutable, reflected), `indeterminate` (mutable, reflected), `disabled`,
`softDisabled` (`soft-disabled`), `required`, `name`, `value` (`on`), `error` (reflected),
`errorText` (mutable), `supportingText`, `density` 0…−4, `valueMissingLabel`.

Events: `mdChange` (`{checked, indeterminate}`, bubbles, composed, not cancelable — there is no
`mdInput`), user activation only; `mdValidityChange` (`{valid, validationMessage, flags}`, bubbles,
**not composed**) on validity changes only, never on mount. Methods: `getValidity()`,
`checkValidity()`, `reportValidity()`, `setCustomValidity(message)`. No slots. Parts: `target`,
`state-layer`, `container`, `icon`, `supporting-text`.

Fourteen hooks: `--md-checkbox-container-color`, `-container-shape`, `-container-size`,
`-selected-container-color`, `-outline-color`, `-outline-width`, `-icon-color`, `-icon-size`,
`-state-layer-color`, `-selected-state-layer-color`, `-state-layer-size`, `-touch-target-size`,
`-supporting-text-color`, `-error-text-color`.

## Behaviour (verified in Chrome)

- **Activation.** A click (or a click forwarded by a wrapping `<label>`) toggles; from indeterminate
  it becomes checked with indeterminate cleared. `mdChange` follows the state change in the same
  task. Space toggles on **keydown** (`preventDefault`, centred ripple, 150 ms pressed pulse), **once
  per press**: key repeats are ignored (C1). Enter does nothing (and is not prevented). Controlled
  `checked` / `indeterminate` changes emit nothing.
- **Disabled.** `disabled`: `tabindex=-1`, `aria-disabled`, no pointer events, dimmed (0.38
  on-surface outline/fill). `soft-disabled`: same paint and inertness but stays in the tab order
  (`tabindex=0`) so it can be discovered. The ripple is disabled in both.
- **Decorative.** `aria-hidden="true"` removes `tabindex` entirely (list rows own the toggle).
- **Semantics.** The host is `role="checkbox"`; `aria-checked` is `true`/`false`/`mixed`;
  `aria-required` mirrors `required`; the supporting/error line is linked through
  `ElementInternals.ariaDescribedByElements` and is `role="alert"` only for errors.
  `aria-invalid="true"` when `error` is set, a validation message is shown, a custom validity
  message is set, **or** the box is `required` and unchecked — the last one already at rest, before
  any interaction (see decisions). The name comes from `aria-label`/`aria-labelledby` or a wrapping
  `<label>`.
- **Form.** Form-associated: submits `value` under `name` only while `checked` (indeterminate is
  visual; `checked indeterminate` still submits). `formResetCallback` restores the initial
  `checked` and `indeterminate` and clears the shown validation message. `required` publishes
  `valueMissing` with `valueMissingLabel`; `setCustomValidity` overrides it until cleared.
  `reportValidity()` / a form submit show the message in the supporting row and focus the box.
  `formDisabledCallback(true)` only clears the shown message (see decisions).
- **Geometry.** Box max(14, 18+d) (hook), touch target max(32, 48+4d) (hook), state layer
  min(40, touch) (hook), 2px outline (hook), 2px radius (hook); supporting text 12/16 at density 0,
  start-aligned with the box (mirrors in RTL). The focus ring is a 2px secondary outline at the
  state-layer edge (negative offset).
- **Motion.** Container colours 200 ms standard; press squish `scale(0.82)` (200 ms in, 400 ms
  emphasized-decelerate out); the glyph scales in (0 → 1.18 → 1, 200 ms) when the mark appears
  (checked ↔ indeterminate keeps it); state-layer opacity 100 ms; `md-ripple`. Under reduced motion
  the container, squish and state-layer transitions and the glyph entrance are removed (C2); the
  ripple still runs (md-ripple's own Web Animations, as for every component).

## Paint reference (Mac, canonical)

`outputs/native-parity/md-checkbox/web-oracle/web-paint.json`: 261 cases, 260 PNGs (light/dark ×
LTR/RTL × density 0…−4 × unchecked/checked/indeterminate × rest/disabled/soft-disabled, error and
error text, supporting text, every hook alone and together, every part, keyboard focus, required
validation, decorative, hidden). It shows no defect. The fixes below change nothing it captures (no
paint at rest changes; C2 only affects reduced-motion transitions).

## Interaction reference (cloud, provisional)

`outputs/native-parity/md-checkbox/web-oracle-cloud/`:
- `states.json` — the Mac's `states.html` unchanged: 12 runs, 95
  phases, 2,740 per-frame samples, 76 events,
  228 animation records (pointer hover/press/release/leave, Tab, Space ×2, Enter,
  Tab away; light/dark, RTL, all hooks, density −4, error, soft-disabled, disabled, form reset,
  press-and-drag-off).
- `states-reduced-motion.json` — the same page with `?set=reduced` under
  `prefers-reduced-motion: reduce`: 3 runs, 776 frames,
  0 animation records (none of the container, state-layer or glyph motion runs; the press still snaps to the squished scale; the md-ripple wave lives in md-ripple's shadow root, which this page does not sample).
- Cloud supplement `supplement.html` (new): `keys.json` (held Space with three auto-repeats per
  value — one `mdChange` per press —, Enter, Space after; Tab and Space on disabled/soft-disabled),
  `form.json` (FormData per state: only `checked` submits `value`; reset back to the initial
  indeterminate; a `<label>` click toggles once and names the box; `<fieldset disabled>`),
  `paint-forced-colors.json` (19 cases under `forced-colors: active`).

## Source defects fixed (test-first)

The tests are in `md-checkbox.contract.e2e.ts` (4 tests: 3 failed on the unchanged source, 1 guard
passed before and after).

* **C1. A held Space toggled on every key repeat** (`md-checkbox.tsx`). Keydown auto-repeat flipped
  the box and emitted `mdChange` for each repeat (a held key ended in a random state and flooded
  listeners; the native control toggles once).
  * Fix: `if (e.repeat) return;` after `preventDefault()` (the page still does not scroll).
  * Test: Space down + two repeats + up → one `mdChange`, checked; a second press toggles back.
* **C2. Reduced motion did not remove the press squish or the glyph entrance** (`md-checkbox.css`).
  The REDUCED MOTION block's plain selectors lost to `:host(.md-checkbox--pressed)` and
  `:host(.md-checkbox--checked|--indeterminate)` rules, so the 200 ms squish transition and the
  glyph keyframes still ran.
  * Fix: the block lists those state selectors too.
  * Tests: transition durations 0s while pressed; glyph `animation-name: none` when checked and when
    indeterminate; guard: without reduced motion both still run.

The readme now says a held Space toggles once and what reduced motion removes (and that the ripple
remains).

## Observed, not changed (decided 2026-10-31, see Decisions below)

* **`aria-invalid` at rest for a required, unchecked box.** Announced as invalid before the user did
  anything (md-radio does the same for a required group; md-text-field and md-switch only after a
  message is shown). Pick one policy for the library.
* **`<fieldset disabled>`** (Chrome itself keeps it out of the tab order, ignores clicks and exposes it as disabled, so it cannot be toggled — but the component still paints it enabled (on-surface-variant outline, pointer cursor) and keeps `tabindex="0"` with no `aria-disabled`). Native checkboxes in a disabled fieldset are
  unfocusable, inert and dimmed. md-switch and md-radio share the same `formDisabledCallback`, so
  this is a cross-component decision.
* **Space acts on keydown** (native checkboxes act on keyup and cancel if the key leaves); kept, as
  the readme documents it and the native renderers copy it.
* **No forced-colours rules** (under emulated `forced-colors: active` the system palette still tells the states apart — unchecked is a Canvas box with a CanvasText border, checked/indeterminate are filled with the glyph in contrast, disabled uses GrayText — so nothing is lost in Chromium; recheck on Windows High Contrast).
* **Enter is ignored** (native behaviour; a form's implicit submission is not triggered either).
* **The ripple is not removed by reduced motion** (library-wide md-ripple behaviour).

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch, serial): own suites
  (checkbox + org chart) before 5 suites / 100 tests (checkbox 3 / 70), after 7 / 123 (checkbox
  4 / 74); checkbox contract tests 3 failed / 1 passed before, 4 passed after. Dependents (every
  component that renders or tests with md-checkbox, plus `hidden-attribute.e2e.ts`) after: 129
  suites / 2,037 tests, one failure — `md-otp-field.editing.e2e.ts` (a focus assertion under load,
  not a checkbox path), which passes alone (2/2). Logs in
  `outputs/native-parity/md-checkbox/source-tests/`; diffs in `source-changes/`.
* **Earlier (Mac) run:** the source tests passed unchanged (12 suites, 249 tests; with the md-radio
  fix 251) before C1/C2 were found.

## Decisions (autonomous, 2026-10-31, reversible)

Recorded by gate-7 fix fork d4 for audit finding R4-07 (shared by md-checkbox, md-switch and md-radio through their common
`formDisabledCallback` and validity code).

1. **`aria-invalid` at rest when required.** md-checkbox (required, unchecked) and md-radio (required group, none selected)
   expose invalid before any interaction; md-switch and md-text-field only while a validation message shows.
   **Decision:** native mirrors each component's own source policy (invalid is exposed under the same condition as the
   source); tools/ax compares the native trees with Chrome's and reports no open finding for the three components.
   *Alternative:* one library-wide "after a message is shown" policy — a Web-source change for the source owner, after
   which the native conditions follow. *Revert:* gate the native invalid flag on a shown message in
   NativeCheckbox/NativeRadio (Swift + Kotlin).
2. **`<fieldset disabled>`.** Chrome treats a form-associated control inside a disabled fieldset as disabled for interaction
   and accessibility (not focusable, clicks ignored, exposed disabled) while the component's CSS still paints it enabled.
   The native libraries have no fieldset container; the native equivalent of an ancestor disable is the control's own
   `disabled` property, which renders, behaves and is exposed exactly as the source's disabled state (dimmed, inert,
   unfocusable). **Decision:** keep the per-control `disabled` contract natively; the enabled paint under a disabled fieldset
   is a Web-source gap reported to the source owner (md-text-field already paints `formDisabled` as disabled).
   *Alternative:* a native ancestor-disable scope (SwiftUI `isEnabled` environment / a Compose form scope flag) propagated
   to the selection controls. *Revert:* add that scope and treat it like `disabled` in the three models.
