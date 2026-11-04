# Breadcrumbs native implementation plan (md-breadcrumbs + md-breadcrumb-item)

Status: preparation only. The contract is in the
[source review](md-breadcrumbs-source-review.md). The oracles in
`outputs/native-parity/md-breadcrumbs/web-oracle-cloud/` are **provisional**:

- Captured with Linux headless Chromium 141, a 1200×900 viewport, DPR 1 and trusted CDP input.
- They are to be recaptured on the Mac with Chrome 153, then diffed with
  `web-reference/compare-oracles.mjs`.

## Oracle inventory

| File | Content |
| --- | --- |
| `web-paint.json` + `paint-shots/` (98 PNG) | 99 cases. See the breakdown below. |
| `web-states.json` + `states-shots/` (93 PNG) | 24 runs, 93 phases and 2271 per-frame samples. See the breakdown below. |
| `web-states-reduced.json` + `states-reduced-shots/` (9 PNG) | 3 runs under `prefers-reduced-motion: reduce`, 276 frames. |

**Paint cases (99):**

- 20 matrix cases: theme × direction × density 0 to −4.
- 12 separator glyphs.
- 21 collapse configurations: before/after windows, expanded, max 0, max = count, clamps, a custom
  expand label, dark, and density −4.
- 26 crumb kinds: static, author-current, disabled, icons, slotted SVG, truncation, wrap, target and
  rel, rich label, hidden, local and inherited density, single crumb, two crumbs, custom label.
- 5 all-hooks cases.
- 12 single-hook cases, one per hook, covering all 12.
- 2 parts cases and 1 hidden case.

**Interaction runs (24):**

- Staggered entrance, in LTR and RTL and with the stagger hook.
- Pointer hover, press, release and leave on links, in both themes and directions, with hooks, on a
  disabled crumb and on the current crumb.
- Keyboard Tab order and Enter.
- The overflow toggle by pointer and by keyboard, including the reveal animation and where focus
  lands.
- `expand()` and `collapse()`.
- `mdSelect` with cancel and with navigate.
- A runtime sequence: separator, maxItems, author current, append, remove, label.

## Current native state

**Swift (`packages/native-ios/Sources/AWCUI/Containers.swift`, `breadcrumbs`):**

- Each crumb is a plain `Button` that emits `mdSelect` with href, label, current, itemIndex and
  itemTotal (no `originalEvent`), then opens the link.
- The trail is a horizontal `ScrollView` of an `HStack` with spacing 8.
- The separator is `Text(separator)` drawn after every non-last visible child in secondary colour.
- Collapsing shows a `Button(expandLabel)` at index `itemsBeforeCollapse`. The button shows the
  label text instead of a "…" glyph. It sets `_expanded` and emits `mdExpand`.
- Not supported:
  - There is no auto-current promotion.
  - There is no current pill, disabled styling, icon/FILL swap, hover or state layer, focus-ring
    parity or entrance animation.
  - There is no `collapse()`, `expand()` or `density`.
  - `aria-current` is not exposed.
  - Focus is not moved after expanding.
- The accessibility label is `label`.

**Android (`AWCNavigation.kt`):**

- `md-breadcrumbs` is a horizontally scrolling `Row` with `spacedBy(8.dp)`.
- There are **no separators, no collapsing and no overflow toggle**. The support JSON says
  "Automatic collapse/maxItems and generated separators are not yet implemented".
- `md-breadcrumb-item` is a `TextButton`. It emits `mdSelect {href}` only, missing label, current,
  itemIndex and itemTotal. It opens `https://` URIs and is disabled when current.
- There is no current pill, icon FILL or density, and no a11y current state.

## Gap analysis → implementation plan (both platforms)

1. **Trail model.** Compute visibility exactly as the Web does: collapse only when
   `maxItems > 0 && count > maxItems && !expanded`, with before clamped to ≥ 0 and after to ≥ 1.
   - Keep the toggle even when nothing is hidden, unless that decision is changed.
   - Order: before crumbs, then the toggle, then after crumbs. The accessibility order must be the
     same.
   - The toggle's separator rule: a leading separator only when before > 0. The first after-crumb
     draws its own separator.
2. **Separators.** Draw a separator before each crumb at index > 0, using the parent's `separator`
   string. Size 16sp, opacity 0.7, on-surface-variant, hidden from accessibility, with an 8pt gap to
   the crumb. Redraw when the separator changes.
3. **Current page.**
   - Promote the last crumb unless the author set `current` on a non-last crumb. Exactly one crumb is
     current.
   - Expose it as `.isSelected` or the header trait on iOS, and as
     `stateDescription`/`selected` on Android. Map `aria-current=page` to "current page".
   - Paint it as a secondary-container pill with on-secondary-container text, weight 600, and the
     icon at FILL 1 / wght 600.
4. **Crumb visuals.**
   - Pill radius, padding 8/12, label-large 14/20, weight 500, tracking 0.1, a 6pt icon gap and an
     18pt icon box.
   - Labels truncate at 32 characters' width with an ellipsis, keeping the full accessible name.
   - Disabled: on-surface at 61%, not focusable, no state layer.
   - Density taper per the source review.
5. **Interaction.** Map hover (iPad pointer, Android mouse) and press to the state layer at 8% and
   12%. The 2pt directional nudge on hover follows layout direction (the Web nudge mirrors only in
   Chromium). Focus indication goes through the platform focus system.
   - `mdSelect` is emitted with the full detail.
   - Navigation is cancelable: consumers return a handled flag.
6. **Overflow toggle.** A 32pt round "…" button (three 1.6pt dots) labelled with `expandLabel` and
   collapsed/expanded state. On activation:
   - expand the trail;
   - emit `mdExpand {expanded, itemCount}`;
   - move accessibility and keyboard focus to the first revealed crumb with a link;
   - remove the toggle.
   - Provide `expand()` and `collapse()` APIs that emit even with maxItems 0.
7. **Entrance.** A 500ms spring (approximating `cubic-bezier(0.38,1.21,0.22,1)`) fades each crumb in
   and slides it 8pt from the leading edge, staggered by `stagger` × min(index, 11). Replay it for
   revealed crumbs. Skip it under Reduce Motion or with animator scale 0.
8. **Hooks.** Expose all 12 hooks as native style tokens: gap, separator colour, text colour (the
   fallback for link colour), stagger, and the item link, current, current-bg, disabled, hover and
   state-layer colours, gap and padding.

## Open decisions (need an owner)

- Should the toggle be suppressed when `before + after ≥ count`? It is currently documented as
  shown.
- Should `mdExpand` become explicitly non-cancelable (an API change), or should the docs say
  "cancelable but ignored"?
- Should RTL hover-nudge mirroring move from `:host-context` to `:dir()` on the Web, for Safari and
  Firefox parity? That would change shared selectors in both crumb files.
- What native affordance should a 32ch-truncated label get (a tooltip or long-press)?
- The Web CEM still lacks the `separator` part until `scripts/generate-custom-elements-manifest.mjs`
  runs. The source annotation is in place.
