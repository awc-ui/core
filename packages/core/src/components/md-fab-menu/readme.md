# md-fab-menu

<!-- llm:meta
tag: md-fab-menu
category: actions
status: md3-mapped
m3-guidelines: https://m3.material.io/components/fab-menu/guidelines
form-associated: false
depends-on: none
used-by: none
accepts-children: md-fab-menu-item
-->

**A FAB that fans out into 2–6 related actions.** Anchors to an existing
`md-fab` by `id`, morphs that FAB's icon to `close` while open, and manages
the popup's ARIA wiring, roving focus, and dismissal.

> Setup, theming, density and i18n are configured once for the whole library —
> see [`main-llm.md`](../../../../../main-llm.md), the library-wide manual that ships
> alongside these files.

---

## When to use

- One prominent creation point that branches into **2–6** related actions
  (new doc / new sheet / new slide; photo / video / file).
- All the branches are **positive, creation-flavored** actions of comparable
  weight.

## When NOT to use

| Situation | Use instead |
|---|---|
| Exactly one primary action | `md-fab` alone |
| More than ~6 actions | `md-menu`, or a dedicated screen |
| Overflow / secondary / destructive actions | `md-menu` from a `md-icon-button` |
| A screen that already has a toolbar or navigation rail | `md-menu` — M3 says don't pair a FAB menu with either |
| Options that select a value rather than trigger an action | `md-select` / `md-segmented-button-set` |
| A menu attached to a normal button | `md-menu` |

## Decision cues

| Need | Setting |
|---|---|
| Items stack above the FAB (bottom-end placement) | `placement="up"` (default) |
| Items stack below (FAB near the top) | `placement="down"` |
| Let the component choose from viewport space | `placement="auto"` |
| Higher-emphasis open state | `variant="primary"` (default) |
| Softer tone | `variant="secondary"` / `"tertiary"` |
| No open/close animation (tests, reduced motion) | `quick` |

## API contract

The FAB itself is **your** element, referenced by `id`. The menu does not render
a trigger.

```html
<md-fab id="create-fab" icon="add" aria-label="Create"></md-fab>

<md-fab-menu anchor="create-fab" placement="up" variant="primary">
  <md-fab-menu-item icon="description" label="Document"></md-fab-menu-item>
  <md-fab-menu-item icon="table_chart" label="Spreadsheet"></md-fab-menu-item>
  <md-fab-menu-item icon="slideshow" label="Presentation"></md-fab-menu-item>
</md-fab-menu>
```

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `open` | `boolean` | `false` | Open state |
| `anchor` | `string` | `''` | **`id` of the trigger element** |
| `variant` | `'primary' \| 'secondary' \| 'tertiary'` | `'primary'` | Open-state FAB color and item container tone |
| `placement` | `'up' \| 'down' \| 'auto'` | `'up'` | Fan-out direction |
| `quick` | `boolean` | `false` | Skip animation |
| `menu-label` | `string` | `'Actions'` | Accessible name of the `role="menu"` popup |
| `density` | `-1…-4` | `0` | Density rung (`0` is the uncompacted default; only the four negative rungs do anything) |

**Slot** — `(default)`: the `md-fab-menu-item` children.

**Events** — `mdOpen` and `mdClose`, both with `void` detail, and both default
Stencil events (they bubble and are composed).

**Methods** — `show(): Promise<void>` opens immediately; `close(): Promise<void>`
returns before the close finishes — unless `quick` is set it flips `open` to
`false` about 180ms later, after the exit animation.

**Parts** — none. The component exposes no `part=` attributes; theme it through
the custom properties below.

### Behavioral contract worth knowing

- **`anchor` is a global DOM `id`**, resolved with `document.getElementById`.
  The anchor must be in the light DOM and the id unique on the page. It is
  looked up when `anchor` changes and when the menu opens.
- While open, the component **writes to your anchor**: `aria-expanded`,
  `aria-haspopup="menu"`, `aria-controls`, and it swaps `anchorEl.icon` to
  `close`, restoring the original on close. Don't fight it by setting those
  yourself.
- The popup is `role="menu"` with `aria-orientation="vertical"`, and is
  `position: fixed` — the component positions itself against the anchor's
  rect every animation frame while open, so it tracks scrolls and reflows.
- Keyboard, while open: `Escape` closes; `Home`/`End` jump to the first/last
  item; typing a character does **typeahead** over item labels (300ms buffer);
  `Tab`/`Shift+Tab` step through the items and close the menu when they run off
  the end. `ArrowUp`/`ArrowDown` are **placement-aware** — with `placement="up"`
  the items sit above the FAB, so `ArrowUp` walks *away* from the anchor and
  `ArrowDown` walks back toward it; `placement="down"` reverses that.
- **Clicking an item closes the menu and returns focus to the anchor.** The
  component listens for `mdClick` from its own subtree. A click outside the
  menu and outside the anchor also closes it.
- **Focus always returns to the anchor on close**, however the menu was
  opened. What *is* activation-aware is whether focus moves **into** the menu on
  open: opening via keyboard, or from an already-focused FAB, focuses the first
  item; a pointer click on an unfocused FAB only primes the roving tabindex and
  leaves focus where it was.
- The popup's accessible name comes from `menu-label` (default `"Actions"`).
  It is the only thing naming the `role="menu"` container, so a translated app
  must set it.
- `open` on first render is supported: the anchor is morphed and wired, but
  `mdOpen` is deliberately **not** emitted and focus is not moved, because that
  state is not an interaction.
- On close the component sets `aria-expanded="false"` on your anchor but leaves
  `aria-haspopup="menu"` and `aria-controls` in place — the anchor keeps
  advertising that it owns a menu.

---

## Do / Don't

Sourced from [M3 · FAB menu · Guidelines](https://m3.material.io/components/fab-menu/guidelines).

| ✅ Do | ❌ Don't |
|---|---|
| Give the menu **2–6** items | Don't use a FAB menu with a single item — use a plain `md-fab` |
| Keep every item's label | Don't remove labels from items |
| Keep icons on items to differentiate them | Only drop an icon if genuinely necessary — it's what separates the rows |
| Keep padding consistent between container, icon, text | Don't expand item container sizes |
| Keep the stock FAB-menu shapes | Don't restyle the shapes |
| Place a FAB next to toolbars and other components | Don't use a **FAB menu** with a toolbar or navigation rail |
| Keep actionable elements and their focus rings visible behind the open menu | Don't fully cover an actionable element and its focus indicator |
| Use it for positive, creation-type actions | Don't fan out destructive or unrelated actions |

---

## Patterns

```html
<!-- Standard bottom-end create menu -->
<md-fab id="fab" icon="add" aria-label="Create"
        style="position:fixed; inset-block-end:24px; inset-inline-end:24px;"></md-fab>

<md-fab-menu anchor="fab" placement="up">
  <md-fab-menu-item icon="edit"  label="New note"></md-fab-menu-item>
  <md-fab-menu-item icon="photo" label="Upload photo"></md-fab-menu-item>
  <md-fab-menu-item icon="mic"   label="Record audio"></md-fab-menu-item>
</md-fab-menu>

<script type="module">
  const menu = document.querySelector('md-fab-menu');
  menu.addEventListener('mdOpen',  () => console.log('opened'));
  menu.addEventListener('mdClose', () => console.log('closed'));

  // The menu closes itself and restores focus after an item click —
  // just run the action.
  document.querySelectorAll('md-fab-menu-item').forEach((item) =>
    item.addEventListener('mdClick', () => console.log('chose', item.label))
  );
</script>
```

```html
<!-- Top-anchored FAB, menu opens downward -->
<md-fab id="top-fab" icon="add" aria-label="Create"></md-fab>
<md-fab-menu anchor="top-fab" placement="down" variant="tertiary">
  <md-fab-menu-item icon="link" label="Add link"></md-fab-menu-item>
  <md-fab-menu-item icon="attach_file" label="Attach file"></md-fab-menu-item>
</md-fab-menu>

<!-- Localized popup name; open programmatically -->
<md-fab id="es-fab" icon="add" aria-label="Crear"></md-fab>
<md-fab-menu id="es-menu" anchor="es-fab" menu-label="Acciones" quick>
  <md-fab-menu-item icon="description" label="Documento"></md-fab-menu-item>
  <md-fab-menu-item icon="photo" label="Foto"></md-fab-menu-item>
</md-fab-menu>
<script type="module">
  await customElements.whenDefined('md-fab-menu');
  await document.getElementById('es-menu').show();
</script>
```

## Anti-patterns

| ❌ Wrong | ✅ Right | Why |
|---|---|---|
| `<md-fab-menu>` with no `anchor` | Always set `anchor` to a real element `id` | Without it there is no trigger and no positioning reference. |
| Putting the `md-fab` **inside** `md-fab-menu` | Keep the FAB outside; reference it by `id` | The menu only accepts `md-fab-menu-item` children. |
| Setting `aria-expanded` / `aria-haspopup` on your FAB | Let the menu manage them | It writes them on open and sets `aria-expanded="false"` on close. |
| Setting `anchorEl.icon` while the menu is open | Leave the icon alone | The menu saves and restores it around the `close` morph. |
| A single-item FAB menu | Plain `md-fab` | M3 names this explicitly. |
| A FAB menu on a screen with a navigation rail | `md-menu` | M3 says don't combine them. |
| Calling `close()` from your `mdClick` handler | Just run the action | The menu already closes itself and restores focus to the anchor. |
| `menu.close(); assert(!menu.open)` | `await` the animation, or set `quick` | `close()` resolves before `open` flips — the exit animation runs ~180ms first. |
| Putting the trigger `md-fab` inside a different shadow root than the menu | Keep both in the same document tree | `anchor` resolves with `document.getElementById`, which does not cross shadow boundaries. |
| An `id` that isn't unique | Unique document-wide id | Lookup is `getElementById` — first match wins. |
| Leaving `menu-label` at its English default in a localized app | Translate it | It is the popup's only accessible name. |

## Accessibility, RTL, density, i18n

**Accessibility**
- The popup is `role="menu"`; items are its rows. `Escape` closes,
  `ArrowUp`/`ArrowDown` rove, and focus returns to the FAB when the interaction
  began from the keyboard.
- The component wires `aria-expanded`/`aria-haspopup`/`aria-controls` onto your
  anchor — so the anchor must be a real, focusable control (`md-fab`).
- M3 requires that an open menu not completely obscure another actionable
  element **or its focus indicator**. Verify at your smallest viewport.
- The closed menu is `aria-hidden`, so its items are not announced.

**RTL** — the stack is vertical, so `placement` is unaffected. Position the
anchor with logical properties so the whole cluster moves to the correct corner.

**Density** — `density="-1…-4"`; only those four rungs exist and omitting the
attribute is the uncompacted default. Because the items are light-DOM children,
the rung's `--md-sys-density-scale` inherits straight down to them. `density="0"`
does **not** opt out of an ancestor's `data-density` rung — reset the scale with
`style="--md-sys-density-scale: 0"` instead.

**i18n** — translate item `label`s and `menu-label`. The latter defaults to the
English `"Actions"` and is the popup's only accessible name.

## Related components

`md-fab` · `md-fab-menu-item` · `md-menu` · `md-button` · `md-icon-button`

## Theming

| Custom property | Purpose | Default |
|---|---|---|
| `--md-fab-menu-item-gap` | Spacing between stacked items | `--md-sys-spacing-gap-xs` (4px) |

`--md-fab-menu-item-gap` is the only property this stylesheet reads. The item
hooks (`--md-fab-menu-item-container-color`, `--md-fab-menu-item-label-color`,
`--md-fab-menu-item-icon-color`, `--md-fab-menu-item-icon-size`,
`--md-fab-menu-item-container-shape`) are read by `md-fab-menu-item`, but since
the items are light-DOM children you can set them once on `md-fab-menu` and
they inherit to every row.

**CSS parts** — none.

```css
md-fab-menu {
  --md-fab-menu-item-gap: 8px;
  --md-fab-menu-item-container-color: var(--md-sys-color-surface-container-high);
}
```

<!-- Auto Generated Below -->


## Properties

| Property    | Attribute    | Description                                                                                                                                                                                                                                                                                                                                    | Type                                     | Default     |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------- |
| `anchor`    | `anchor`     | ID of the anchor FAB element to position relative to.                                                                                                                                                                                                                                                                                          | `string`                                 | `''`        |
| `density`   | `density`    | Local density rung. Drives the same `--md-sys-density-scale` signal that a global `data-density` ancestor sets, so a local value simply overrides the inherited one. 0 = default, -4 = ultra-compact.                                                                                                                                          | `-1 \| -2 \| -3 \| -4 \| 0`              | `0`         |
| `menuLabel` | `menu-label` | Accessible name for the popup itself (the `role="menu"` container).  A prop rather than a hardcoded string, matching how every other user-facing string in the library is localised: components stay i18n-engine-agnostic and the consumer resolves the text from its own dictionary. The default is English, so a translated app must set it. | `string`                                 | `'Actions'` |
| `open`      | `open`       | Whether the menu is open.                                                                                                                                                                                                                                                                                                                      | `boolean`                                | `false`     |
| `placement` | `placement`  | Direction items fan out from the FAB. - 'up': items stack above the FAB (default, standard bottom-right placement) - 'down': items stack below the FAB - 'auto': detect based on available viewport space                                                                                                                                      | `"auto" \| "down" \| "up"`               | `'up'`      |
| `quick`     | `quick`      | Skip open/close animation.                                                                                                                                                                                                                                                                                                                     | `boolean`                                | `false`     |
| `variant`   | `variant`    | Color set for the menu. Controls the FAB's open-state color (vibrant) and item container color (softer).                                                                                                                                                                                                                                       | `"primary" \| "secondary" \| "tertiary"` | `'primary'` |


## Events

| Event     | Description                 | Type                |
| --------- | --------------------------- | ------------------- |
| `mdClose` | Fires when the menu closes. | `CustomEvent<void>` |
| `mdOpen`  | Fires when the menu opens.  | `CustomEvent<void>` |


## Methods

### `close() => Promise<void>`

Closes the menu programmatically.

#### Returns

Type: `Promise<void>`



### `show() => Promise<void>`

Opens the menu programmatically.

#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
