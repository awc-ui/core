# md-select-option

<!-- llm:meta
tag: md-select-option
category: selection
status: sub-component
parent: md-select, md-multi-select, md-autocomplete
standalone: false
m3-guidelines: https://m3.material.io/components/menus/guidelines
form-associated: false
depends-on: none
used-by: none
-->

**A declarative data carrier for the pickers.** It renders nothing visible
(`:host { display: none }`). The parent picker reads its props and projects them
into its own `md-menu` dropdown as real `md-menu-item` rows.

> 🧩 **Sub-component.** Only valid inside `md-select`, `md-multi-select` or
> `md-autocomplete`. Outside one it is invisible and inert, and it has no
> styling surface of its own — theme the parent picker instead.

---

## When to use

- The owning parent is [`md-select`](../md-select),
  [`md-multi-select`](../md-multi-select) or
  [`md-autocomplete`](../md-autocomplete) — put these elements directly inside
  one of them as **direct children**.
- You are authoring that picker's options **declaratively in markup**, and the
  option set is static or template-driven.

## When NOT to use

| Situation | Use instead |
|---|---|
| Options come from data / a fetch | Set the parent's `options` property (or its JSON-array attribute) |
| Rows in a standalone dropdown menu | `md-menu-item` inside `md-menu` |
| Items in a list | `md-list-item` |
| Grouping headings inside a menu | `md-menu-item-group` |
| Anywhere outside a picker | Nothing — it renders nothing |

## API contract

```html
<md-select label="Colour">
  <md-select-option
    value="red"                       <!-- default: '' -->
    label="Red"                       <!-- default: '' → falls back to the slotted text -->
    icon="circle"                     <!-- default: '' -->
    icon-color="#e53935"              <!-- default: '' -->
    supporting-text="In stock"        <!-- default: '' -->
  >Red</md-select-option>

  <md-select-option value="green" supporting-text="Out of stock" disabled>
    Green
  </md-select-option>

  <md-select-option value="blue" selected>Blue</md-select-option>
</md-select>
```

| Prop | Attribute | Type | Default | Purpose |
|---|---|---|---|---|
| `value` | `value` | `string` | `''` | Stable identifier the parent emits and matches on |
| `label` | `label` | `string` | `''` | Visible text; falls back to the slotted text when empty |
| `disabled` | `disabled` | `boolean` | `false` | Stays visible in the menu, cannot be chosen |
| `selected` | `selected` | `boolean` | `false` | Initial-selected hint, honoured by `md-select` / `md-multi-select` only — see the contract below |
| `icon` | `icon` | `string` | `''` | Material Symbols glyph for the row |
| `iconColor` | `icon-color` | `string` | `''` | Any CSS colour; ignored without `icon` |
| `supportingText` | `supporting-text` | `string` | `''` | Secondary line under the label |

**Slots** — default only: the label text, used when `label` is empty.

**Events** — `mdSelectOptionChange` (`CustomEvent<void>`, bubbles **and**
composed). Emitted on connect, on disconnect, and on any watched prop change so
the parent re-reads its option set. **Do not listen to it** — it is the internal
parent↔child sync channel. Listen to the parent's `mdChange`.

**Methods** — none.

**Parts** — none. The visible row is an `md-menu-item` in the parent's shadow
root; style it through the parent's `option` / `option-selected` /
`option-icon` parts.

### Behavioral contract worth knowing

- The element is a **data carrier**, not the rendered row. Inspecting it in
  devtools shows an empty, hidden host — that is correct.
- Only **direct children** of the picker are collected. Wrapping options in a
  `<div>` or a fragment element hides them from the parent.
- Because it is `display: none`, it never flashes unstyled before hydration.
- `selected` is a *hint*, and only two of the three parents read it:
  `md-select` adopts the first enabled hinted option and `md-multi-select`
  adopts all of them — in both cases only at load, and only while the parent's
  own `value` is still empty. **`md-autocomplete` ignores it entirely**: it
  never scans its children for `selected`, so
  `<md-autocomplete><md-select-option value="par" selected>` starts with
  nothing selected. Set the autocomplete's `value` (and `input-value` for the
  visible text) instead.
- Adding and editing options at runtime works everywhere: connect and each
  watched prop change fire `mdSelectOptionChange` from an element that is still
  in the tree, so the event bubbles to the parent and it re-reads.
- **Removal is the exception under `md-autocomplete`.** `disconnectedCallback`
  fires the event from an already-detached element, so it never reaches the
  parent. `md-select` and `md-multi-select` still notice, because they project
  the carriers through a default `<slot>` and re-read on `slotchange`;
  `md-autocomplete` has no default slot, so a removed child stays in its list.
  If an autocomplete's option set has to shrink at runtime, drive it from the
  `options` property instead of from markup children.
- The label the parent renders is `label`, or the element's trimmed text
  content when `label` is empty.
- `icon-color` is applied inline to the projected row's glyph, and is **dropped
  on the virtualized (WASM) path** — very large lists fall back to the parent's
  `--md-select-option-icon-color` / `--md-multi-select-option-icon-color` /
  `--md-autocomplete-option-icon-color`.
- It carries `role="option"` with `aria-hidden="true"`: the role documents
  intent for anyone reading the DOM, while `aria-hidden` stops screen readers
  announcing the hidden carrier alongside the live menu row.

---

## Do / Don't

Row-level guidance sourced from
[M3 · Menus · Guidelines](https://m3.material.io/components/menus/guidelines);
the rest are contract rules for this carrier.

| ✅ Do | ❌ Don't |
|---|---|
| Give every option a unique, stable `value` | Don't omit `value` — matching and emitted payloads depend on it |
| Keep labels short and scannable, sentence case | Don't write sentence-length labels that wrap in the menu |
| Use `supporting-text` for the secondary detail | Don't cram the detail into `label` |
| Use `disabled` to show an option exists but is unavailable | Don't remove options silently — users lose the mental model |
| Use icons consistently — all rows or none | Don't icon only some rows; it makes the list look broken |
| Order options logically (frequency, alphabetical, or numeric) | Don't order arbitrarily |
| Let the parent own selection state | Don't set `selected` on several options in a single-select `md-select` |
| Localize the slotted label text | Don't localize `value` — it's an identifier, not display text |

## Patterns

```html
<!-- Single select -->
<md-select label="Priority" value="med">
  <md-select-option value="low" icon="arrow_downward">Low</md-select-option>
  <md-select-option value="med" icon="remove">Medium</md-select-option>
  <md-select-option value="high" icon="arrow_upward"
                    icon-color="var(--md-sys-color-error)">High</md-select-option>
</md-select>

<!-- Multi select with supporting text -->
<md-multi-select label="Teams">
  <md-select-option value="eng" supporting-text="24 members">Engineering</md-select-option>
  <md-select-option value="des" supporting-text="6 members">Design</md-select-option>
</md-multi-select>

<!-- Same carriers filter an autocomplete -->
<md-autocomplete label="City">
  <md-select-option value="par">Paris</md-select-option>
  <md-select-option value="ber">Berlin</md-select-option>
</md-autocomplete>
```

```html
<!-- Added at runtime: the carrier announces itself, the parent re-reads -->
<md-select id="colours" label="Colour"></md-select>

<script type="module">
  const sel = document.getElementById('colours');
  for (const c of ['red', 'green', 'blue']) {
    const opt = document.createElement('md-select-option');
    opt.value = c;
    opt.textContent = c[0].toUpperCase() + c.slice(1);
    sel.appendChild(opt);          // mdSelectOptionChange → parent re-reads
  }
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `<md-select-option>` outside a picker | Put it inside `md-select` / `md-multi-select` / `md-autocomplete` | It renders nothing on its own. |
| Options wrapped in a `<div>` inside the picker | Make them direct children | Only direct children are collected. |
| `md-select-option { color: red }` | Theme the parent picker | The carrier is `display: none`; the visible row is elsewhere. |
| Listening for `mdSelectOptionChange` | Listen to the parent's `mdChange` | It's the internal sync channel, with a `void` detail. |
| `<option>` or `<md-menu-item>` inside a picker | `md-select-option` | The picker only reads its own carriers. |
| `selected` on multiple options in a single `md-select` | Set the parent's `value` | Selection is parent-owned; multiple hints are ambiguous. |
| Expecting `selected` to win over the parent's `value` | Set the parent's `value` | On `md-select` / `md-multi-select` it applies only at load, and only when the parent's value is empty. |
| `selected` on an option inside `md-autocomplete` | Set the autocomplete's `value` (plus `input-value`) | `md-autocomplete` never adopts the hint — the field would start empty. |
| Removing an `md-select-option` child of `md-autocomplete` to shrink the list | Drive that picker's options through its `options` property | The disconnect event cannot reach a parent with no default slot. |
| Omitting `value` and relying on the label | Always set `value` | The label is display text and may be translated. |
| Setting `icon-color` without `icon` | Set both | The colour is ignored without a glyph. |

## Accessibility, RTL, density, i18n

**Accessibility** — effectively the parent's responsibility: the real
listbox/option semantics, focus management and type-ahead live in the picker's
`md-menu`. This element is `aria-hidden` on purpose so nothing is announced
twice.

**RTL** — nothing to mirror; it has no box of its own.

**Density** — no styling surface of its own, so it has no `density` prop. The
projected row tapers with the parent's `density` rung (`-1` … `-4`).

**i18n** — translate the slotted label (or the `label` prop) and
`supporting-text`. Keep `value` a stable, untranslated identifier.

## Related components

`md-select` · `md-multi-select` · `md-autocomplete` · `md-menu-item` ·
`md-menu-item-group` · `md-list-item`

## Theming

This component has **no CSS custom properties and no CSS parts** — its only
rule is `:host { display: none }`. Everything visible is the `md-menu-item` the
parent renders, so theme it through the parent:

| Custom property | Purpose | Default |
|---|---|---|
| `--md-select-option-icon-color` | Leading icon colour in `md-select` rows | `--md-sys-color-on-surface-variant` |
| `--md-multi-select-option-icon-color` | Leading icon colour in `md-multi-select` rows | `--md-sys-color-on-surface-variant` |
| `--md-autocomplete-option-icon-color` | Leading icon colour in `md-autocomplete` rows | `--md-sys-color-on-surface-variant` |

```css
/* Style the projected rows through the PARENT's parts. */
md-select::part(option-selected) {
  font-weight: 600;
}
```

<!-- Auto Generated Below -->


## Overview

`md-select-option` — declarative option for `md-select` / `md-multi-select`.

This element is a **data carrier**: it renders nothing visible (the host
is `display: none`). The parent picker reads its `value`, label (the
`label` prop or slotted text), `disabled`, `icon`, and `supporting-text`
and projects them into the `md-menu` dropdown as `md-menu-item`s.

Authoring:
```html
<md-select label="Colour">
  <md-select-option value="red" icon="circle">Red</md-select-option>
  <md-select-option value="green" disabled>Green</md-select-option>
</md-select>
```

Whenever an option is added, removed, or has its data changed, it emits a
bubbling `mdSelectOptionChange` event so the parent re-reads its option set.

## Properties

| Property         | Attribute         | Description                                                                                                                                         | Type      | Default |
| ---------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| `disabled`       | `disabled`        | Disabled options stay visible in the menu but cannot be selected.                                                                                   | `boolean` | `false` |
| `icon`           | `icon`            | Material Symbols leading-icon glyph rendered in the menu row.                                                                                       | `string`  | `''`    |
| `iconColor`      | `icon-color`      | CSS colour for the leading icon (any CSS `<color>` — hex, `rgb()`, or a theme token such as `var(--md-sys-color-primary)`). Ignored without `icon`. | `string`  | `''`    |
| `label`          | `label`           | Visible label. Falls back to the slotted text content when empty.                                                                                   | `string`  | `''`    |
| `selected`       | `selected`        | Initial-selected hint (used by the picker only when its value is unset).                                                                            | `boolean` | `false` |
| `supportingText` | `supporting-text` | Secondary text rendered under the label in the menu row.                                                                                            | `string`  | `''`    |
| `value`          | `value`           | Stable identifier emitted by the picker and used for matching.                                                                                      | `string`  | `''`    |


## Events

| Event                  | Description                                                                                                  | Type                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| `mdSelectOptionChange` | Fired when the option mounts, unmounts, or its data changes so the parent picker can re-read its option set. | `CustomEvent<void>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
