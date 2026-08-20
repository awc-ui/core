# md-switch

<!-- llm:meta
tag: md-switch
category: selection
status: md3-mapped
m3-guidelines: https://m3.material.io/components/switch/guidelines
form-associated: true
depends-on: none
used-by: none
-->

**An immediate on/off setting.** Track-and-handle toggle with optional state
icons, form-associated via `ElementInternals`, and a cancelable
before-change event for controlled usage.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md) at the repo root.

---

## When to use

- A **single setting that takes effect immediately** — dark mode, notifications,
  Wi-Fi, auto-save.
- The change is self-evidently applied; there is no Save button gating it.

## When NOT to use

| Situation | Use instead |
|---|---|
| Selecting one or more options from a list | `md-checkbox` |
| Selecting exactly one from a list | `md-radio` |
| Choosing between two **opposing** options (A vs B) | `md-button-group` (connected) |
| The change requires an explicit save step | `md-checkbox` |
| Triggering an action | `md-button` |
| Filtering | `md-chip` |
| A value in a range | `md-slider` |

## Decision cues

| Need | Setting |
|---|---|
| Icons on both states | `icons` (defaults: `check` / `close`) |
| Icon only when on | `show-only-selected-icon` |
| Custom glyphs | `selected-icon` / `unselected-icon`, or the matching slots |
| Must be on to submit | `required` |
| Controlled (external state owner) | `preventDefault()` on `mdInput` |
| Unavailable but discoverable | `soft-disabled` |

## API contract

```html
<label>
  <md-switch
    name="notifications" value="on"
    selected
    icons | show-only-selected-icon
    selected-icon="check" unselected-icon="close"
    required
    value-missing-label="Please turn this on if you want to proceed."
    disabled | soft-disabled
    density="-1|-2|-3|-4"
  ></md-switch>
  Enable notifications
</label>
```

**Events**

| Event | Cancelable | Detail | Fires |
|---|---|---|---|
| `mdInput` | **yes** | `{ selected }` | **Before** the state changes — `preventDefault()` blocks the internal toggle |
| `mdChange` | no | `{ selected }` | **After** the state has committed |
| `mdValidityChange` | yes (no effect) | `{ valid, validationMessage, flags }` | Only on a validity change; **not composed** |

`mdInput` and `mdChange` bubble and are composed; `mdValidityChange` bubbles but
is **not** composed, so listen for it on the element itself (or on a light-DOM
ancestor such as the `<form>`). `mdValidityChange` is dispatched cancelable, but
it is a notification — `preventDefault()` on it changes nothing. `mdInput` is
the only event whose default the component acts on.

**Methods** — all async: `setFocus()`, `getValidity()`, `checkValidity()`,
`reportValidity()`, `setCustomValidity(message)`.

**Slots** — `selected-icon`, `unselected-icon` (each requires `icons`, or
`show-only-selected-icon` for the selected one).

**Parts** — `track`, `state-layer`, `handle`, `icon`.

### Behavioral contract worth knowing

- **No default slot.** Wrap in a `<label>` or set `aria-label` /
  `aria-labelledby`. A bare switch has no accessible name.
- **`mdInput` is the controlled-mode hook**: it fires *before* the flip and is
  cancelable. `mdChange` fires *after* and cannot be vetoed. This is the
  opposite split from `md-icon-button`, which has neither.
- Form-associated: submits `value` (default `"on"`) under `name` **when
  selected**; restores on reset.
- Icon slots are ignored unless `icons` (or `show-only-selected-icon`) is set —
  a slotted glyph alone won't appear. `show-only-selected-icon` gates the
  `selected-icon` slot only; the unselected handle stays bare.
- **`Space` toggles. `Enter` does not** — it is left to the form, matching
  `md-checkbox` / `md-radio`. Held-key repeats are ignored.
- Events fire on **user interaction only**. Assigning `el.selected = true` from
  script updates the control and the form value silently — no `mdInput`, no
  `mdChange`.
- `preventDefault()` on `mdInput` blocks the flip *and* suppresses `mdChange`,
  so in controlled mode you must assign `selected` yourself.
- `disabled` and `soft-disabled` both block toggling; `disabled` sets
  `tabindex="-1"` while `soft-disabled` keeps `tabindex="0"` so the control
  stays discoverable.
- The handle resizes with state, which is part of the M3 read: small when off,
  full-size when on **or** when an icon is shown, and larger again while
  pressed.
- `mdValidityChange` is **not composed**.

---

## Do / Don't

Sourced from [M3 · Switch · Guidelines](https://m3.material.io/components/switch/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Use a switch for an immediate, self-applying setting | Don't use a switch for options that require saving — use checkboxes |
| Use checkboxes to select one or more options from a list | Don't use switches for list selection |
| Use radio buttons when only one item can be selected | Don't use switches for exclusive choice |
| Use a connected button group to choose between opposing options | Avoid switches for A-vs-B choices |
| Keep the label short and describe what **on** does | Don't phrase the label ambiguously ("Notifications?") |
| Put the label outside the control | Don't put text inside the switch — the font would be inaccessibly small; use an icon |
| Use icons that clearly read as on/off (check / X) | Don't use ambiguous or non-binary icons like a moon or a pencil |
| Let the change apply instantly | Don't pair a switch with a Save button |
| Use a button for a call to action | A switch can't replace a button |

---

## Patterns

```html
<!-- Standard immediate setting -->
<label><md-switch name="dark" selected></md-switch> Dark mode</label>

<script type="module">
  document.querySelector('md-switch')
    .addEventListener('mdChange', (e) => setTheme(e.detail.selected ? 'dark' : 'light'));
</script>
```

```html
<!-- Controlled: veto the flip, apply only after the server agrees -->
<md-switch id="sync"></md-switch>
<script type="module">
  const sw = document.getElementById('sync');
  sw.addEventListener('mdInput', async (e) => {
    e.preventDefault();                 // block the internal toggle
    const wanted = e.detail.selected;
    if (await save(wanted)) sw.selected = wanted;
  });
</script>
```

```html
<!-- With state icons -->
<label><md-switch icons></md-switch> Wi-Fi</label>
<label><md-switch show-only-selected-icon></md-switch> Auto-save</label>

<!-- Custom glyphs (icons must be enabled) -->
<md-switch icons>
  <span slot="selected-icon" class="material-symbols-outlined">bolt</span>
  <span slot="unselected-icon" class="material-symbols-outlined">power_off</span>
</md-switch>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `<md-switch>Dark mode</md-switch>` | Wrap in `<label>` or set `aria-label` | No default slot — the text won't render. |
| A column of switches for a list of options | `md-checkbox` | M3 states this directly. |
| Switch + Save button | Apply immediately, or use `md-checkbox` | Switches are immediate by definition. |
| `preventDefault()` on `mdChange` | Cancel `mdInput` instead | `mdChange` is post-commit and not cancelable. |
| Slotted icons without `icons` | Add `icons` or `show-only-selected-icon` | The slots are gated by those props. |
| A moon icon for a dark-mode switch handle | Use check/X, put the moon in the label | M3 calls out ambiguous glyph choices. |
| A switch used as "Submit" | `md-button` | Users expect a CTA to be a button. |
| Two switches for "Metric / Imperial" | `md-button-group` (connected) | That's an opposing-options choice. |
| Label text describing the off state | Describe what **on** does | M3 labelling rule. |
| Hidden `<input type=checkbox>` alongside | Use `name`/`value` | Already form-associated. |
| Expecting `mdChange` after setting `.selected` in script | Call your own handler, or react to the assignment | The events are user-interaction only. |
| `preventDefault()` on `mdInput` and then expecting the switch to move | Assign `selected` yourself once the outcome is known | Cancelling blocks the internal flip and `mdChange`. |
| Binding `Enter` to toggle | Use `Space`, or a `md-button` | Only `Space` toggles; `Enter` belongs to the form. |

## Accessibility, RTL, density, i18n

**Accessibility**
- Wrap in `<label>` (name + hit target) or supply `aria-label`/`aria-labelledby`.
- Host carries `role="switch"` with `aria-checked`, plus `aria-disabled` and
  `aria-required` when set. `Space` toggles; `Enter` is deliberately left to
  the form.
- `disabled` leaves the tab order; `soft-disabled` stays focusable.
- With `icons`, state is conveyed by shape as well as color and handle position
  — helpful for color-vision deficiency.
- Keep the hit target ≥48px on touch at deep density rungs.

**RTL** — track and handle travel mirror automatically under `dir="rtl"`.

**Density** — `density="-1…-4"` locally overrides the inherited `data-density`
rung; rung `0` is the uncompacted default and is inert, so it is not an opt-out
from an ancestor rung (for that, set `style="--md-sys-density-scale: 0"`). Each
rung trims 6px off the track width (52px, 28px floor) and 4px off the track
height (32px, 16px floor); handle, state layer and thumb travel are all derived
from the track height. The host keeps a `min-block-size` of 48px, so the touch
target survives every rung.

**i18n** — translate the label and `value-missing-label`. Keep labels short:
M3 requires the text to sit outside the control.

## Related components

`md-checkbox` · `md-radio` · `md-button-group` · `md-chip` · `md-slider`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-switch-track-width` | Track width | `max(28px, 52px + density * 6px)` |
| `--md-switch-track-height` | Track height before density trim; every other size derives from it | `32px` |
| `--md-switch-handle-size` | Handle diameter when selected | `track height * 0.75` |
| `--md-switch-track-color` | Track fill, unselected | `--md-sys-color-surface-container-highest` |
| `--md-switch-selected-track-color` | Track fill + outline, selected | `--md-sys-color-primary` |
| `--md-switch-track-outline-color` | Track border, unselected | `--md-sys-color-outline` |
| `--md-switch-handle-color` | Handle fill, unselected | `--md-sys-color-outline` |
| `--md-switch-selected-handle-color` | Handle fill, selected | `--md-sys-color-on-primary` |
| `--md-switch-icon-color` | Handle glyph, unselected | `--md-sys-color-surface-container-highest` |
| `--md-switch-selected-icon-color` | Handle glyph, selected | `--md-sys-color-on-primary-container` |
| `--md-switch-state-layer-color` | Hover/press overlay | `--md-sys-color-on-surface` unselected, `--md-sys-color-primary` selected |
| `--md-switch-focus-ring-color` | Focus outline | `--md-sys-color-secondary` |

Hover / press handle and outline colours are fixed M3 state colours and are not
themable individually; override the base colours above instead.

**CSS parts** — `track`, `state-layer`, `handle`, `icon`.

```css
md-switch.brand {
  --md-switch-selected-track-color: var(--md-sys-color-tertiary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-tertiary);
}
```

<!-- Auto Generated Below -->


## Overview

`md-switch` — Material Design 3 switch (on/off toggle).

Form-associated: inside a `<form>` it submits its `value` under `name` when
selected, and restores on form reset. It is a *labelable* element — wrap it in
a `<label>` (clicks on the label text toggle it and name it), or pass
`aria-label` / `aria-labelledby` on the host.

## Properties

| Property               | Attribute                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Type                        | Default                                         |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| `density`              | `density`                 | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                                                                                                                                          | `-1 \| -2 \| -3 \| -4 \| 0` | `0`                                             |
| `disabled`             | `disabled`                | Prevents interaction and removes from tab order                                                                                                                                                                                                                                                                                                                                                                                                                | `boolean`                   | `false`                                         |
| `icons`                | `icons`                   | Show icons on both selected and unselected states (check / close)                                                                                                                                                                                                                                                                                                                                                                                              | `boolean`                   | `false`                                         |
| `name`                 | `name`                    | Name submitted with the owning `<form>`.                                                                                                                                                                                                                                                                                                                                                                                                                       | `string`                    | `''`                                            |
| `required`             | `required`                | Mark the control required for form validation / assistive tech.                                                                                                                                                                                                                                                                                                                                                                                                | `boolean`                   | `false`                                         |
| `selected`             | `selected`                | Whether the switch is on (selected)                                                                                                                                                                                                                                                                                                                                                                                                                            | `boolean`                   | `false`                                         |
| `selectedIcon`         | `selected-icon`           | Material Symbols glyph shown on the handle when selected (override the default check). Ignored when the `selected-icon` slot is filled.                                                                                                                                                                                                                                                                                                                        | `string`                    | `'check'`                                       |
| `showOnlySelectedIcon` | `show-only-selected-icon` | Show icon only when selected                                                                                                                                                                                                                                                                                                                                                                                                                                   | `boolean`                   | `false`                                         |
| `softDisabled`         | `soft-disabled`           | Visually disabled but remains focusable for discoverability                                                                                                                                                                                                                                                                                                                                                                                                    | `boolean`                   | `false`                                         |
| `unselectedIcon`       | `unselected-icon`         | Material Symbols glyph shown on the handle when unselected (override the default close). Ignored when the `unselected-icon` slot is filled.                                                                                                                                                                                                                                                                                                                    | `string`                    | `'close'`                                       |
| `value`                | `value`                   | Value submitted when the switch is selected.                                                                                                                                                                                                                                                                                                                                                                                                                   | `string`                    | `'on'`                                          |
| `valueMissingLabel`    | `value-missing-label`     | Localized constraint-validation message shown when `required` is unmet.  A prop rather than a hardcoded string, matching md-time-picker's `value-missing-label`: components stay i18n-engine-agnostic and the consumer localizes through its own dictionary. Native inputs get their message from the browser's locale for free; a form-associated custom element supplies its own, so leaving this hardcoded would ship an English-only form to every locale. | `string`                    | `'Please turn this on if you want to proceed.'` |


## Events

| Event              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Type                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `mdChange`         | Fires **after** the internal state has committed. Use for side effects like saving preferences, analytics, or syncing with other components. Not cancelable — the toggle has already happened.  ```ts switch.addEventListener('mdChange', (e) => {   console.log('Switch is now', e.detail.selected ? 'ON' : 'OFF'); }); ```                                                                                                                                                                                                                                             | `CustomEvent<{ selected: boolean; }>`                                                         |
| `mdInput`          | Fires **before** the state changes. Call `event.preventDefault()` to block the internal toggle and manage state externally (controlled mode).  ```ts switch.addEventListener('mdInput', (e) => {   e.preventDefault();          // prevent internal toggle   myState.value = e.detail.selected; // update your own state }); ```                                                                                                                                                                                                                                         | `CustomEvent<{ selected: boolean; }>`                                                         |
| `mdValidityChange` | Fires when this control's validity CHANGES — never on every keystroke, and never for a re-publish that lands on the same state.  `composed: false` is deliberate. Composites like md-select embed an md-text-field, and a composed event escapes that inner shadow root, so a listener on md-select would receive the inner field's event as well as the host's — two events, different payloads, for one logical control. Keeping it uncomposed means each component reports only for itself, while `bubbles: true` still lets a <form> or app root hear every control. | `CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>` |


## Methods

### `checkValidity() => Promise<boolean>`

Constraint-validation API, matching md-text-field and the native contract.

#### Returns

Type: `Promise<boolean>`



### `getValidity() => Promise<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>`

Current validity: boolean, message and flags. Mirrors md-text-field.

#### Returns

Type: `Promise<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>`



### `reportValidity() => Promise<boolean>`

Like checkValidity(), but also shows the browser's validation message.

#### Returns

Type: `Promise<boolean>`



### `setCustomValidity(message: string) => Promise<void>`

App/server-side validation: a non-empty message marks the control invalid
for its form until cleared with an empty string.

#### Parameters

| Name      | Type     | Description |
| --------- | -------- | ----------- |
| `message` | `string` |             |

#### Returns

Type: `Promise<void>`



### `setFocus() => Promise<void>`

Programmatically focus the switch (shows the focus ring).

#### Returns

Type: `Promise<void>`




## Slots

| Slot                | Description                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"selected-icon"`   | Custom icon shown on the handle when selected (replaces                  the `selected-icon` glyph). Requires `icons` or                  `show-only-selected-icon`. |
| `"unselected-icon"` | Custom icon shown on the handle when unselected                   (replaces the `unselected-icon` glyph). Requires `icons`.                                          |


## Shadow Parts

| Part            | Description                              |
| --------------- | ---------------------------------------- |
| `"handle"`      | Handle (thumb)                           |
| `"icon"`        | Check / close icon                       |
| `"state-layer"` | State-layer overlay (centered on handle) |
| `"track"`       | Track container                          |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
