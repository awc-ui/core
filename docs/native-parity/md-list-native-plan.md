# List native implementation plan and Chrome oracles

Status: preparation only. The native implementation, Laboratory integration and acceptance are still pending.

**Sources**
- The contract comes from `packages/core/src/components/md-list/` and `md-list-item/` (tsx, css, tests), after the six gate-1 fixes.
- The [source review](md-list-source-review.md) has the narrative contract and the defect log.

**Oracles**
- Captured on 2026-10-23 with headless Chrome 153: 1200×900 viewport, DPR 1, trusted CDP input.
- The build is the private `work/list-tree` dist, whose sources are identical to `src`.
- Files are in `outputs/native-parity/md-list/web-oracle/`; `oracle-manifest.json` holds the hashes and commands.

## Contract inventory

**md-list properties**

| Property | Default | Values and behaviour |
| --- | --- | --- |
| `listStyle` | standard | `standard`: connected rows, 16px outer corners, 8px block padding. `segmented`: 2px gaps, 16px ends and 4px middle corners, no padding. |
| `selectionMode` | none | Sets the role (list/listbox), `aria-multiselectable`, and makes text rows focusable. It is pushed down to the rows. |
| `interactionMode` | single-action | `multi-action` gives the trailing controls their own focus and activation. It is pushed down. |
| `reorderable` | false | Reflected. Adds handles and Alt+Arrow keys. It is pushed down. |
| `label` / `labelledby` | '' | `aria-label` / `aria-labelledby` on the host. |
| `roleOverride` | '' | Wins over the computed role. Separator-permitting roles un-hide the dividers. |
| `density` | 0 | 0…−4, reflected. Sets the local scale only; spacing insets come from the inherited token rung (hybrid, see the review). |

**md-list-item properties (author-facing)**

| Property | Default | Notes |
| --- | --- | --- |
| `type` | text | `text`, `button`, `link`. Reflected. Button and link put their role on the inner `primary`. |
| `headline` / `overline` / `supportingText` / `trailingSupportingText` | '' | The matching slots win when present. The headline ellipsizes, supporting text wraps or clamps by `lines`, and truncated text gets a tooltip after a 160ms debounce. |
| `leadingIcon` / `trailingIcon` | '' | Material Symbols ligatures: 20px in a list, 24px standalone. Icon colors follow the row state (selected rows use on-secondary-container; selected and hovered rows return to on-surface). |
| `leadingAvatar` / `Alt` / `Name` / `Label` | '' | An internal md-avatar, 40px, primary-container tones (gate-1 default). |
| `leadingImage` / `Alt` | '' | 56px image. In selection modes it gets the selection scrim, circle and check. |
| `lines` | 1 | 1, 2 or 3. Sets the minimum height (56/72/88) and three-line top alignment. |
| `href` / `target` | '' / `_self` | Link rows navigate through an inner `<a>`. |
| `disabled` / `softDisabled` | false | Hard: no pointer, no tab stop. Soft: focusable, `aria-disabled`, click cancelled. |
| `selected` | false | Mutable and reflected. Secondary-container colors plus the selected morph. |
| `expandable` / `expanded` | false | Mutable `expanded`. Adds the caret button and the `expanded-content` panel. |
| `density` | 0 | A local rung for the row. |

**Internal (list-managed) properties.** These should not be editable natively: tabbable, rovingFocusVisible, selectionMode, interactionMode, containerRole, reorderable.

**Events**
- `mdSelect {index, value, selected, item[, childIndex, expanded]}`
  - Fired on user input only.
  - Single-select re-emits `selected: true` when the selected row is clicked again.
  - A child row in expanded content reports the parent `index` plus `childIndex`.
- `mdActivate {index, item}`
  - Fired only when focus moves to a different row, by keyboard, pointer press or the methods.
- `mdReorder {from, to, order}`
  - Fired after a pointer drop or Alt+Arrow.
  - Nothing is emitted when the row is dropped back at its origin or the move is at an edge.
- `mdClick {item}` (item)
  - Fired by pointer and by Enter/Space (centred ripple).
  - Not fired by trailing controls.
  - Cancelled for soft-disabled rows.
- `mdExpand {expanded, index, value, item}` (item)
  - Fired by a row click, the caret, ArrowRight/ArrowLeft (not mirrored in RTL), or the methods.
- Plumbing that bubbles out of the item: mdItemClick, mdItemSelect, mdRequestActivation, mdItemRequestReorder. Native keeps these internal.

**Methods**
- List:
  - `activateNext` / `activatePrevious`: wrap; return the row or null.
  - `selectItem(index)`: silent; no-op in `none` mode.
  - `getSelectedIndices`.
- Item: `setFocus(options)`, `focusItem`, `toggle`, `expand`, `collapse`.

**Slots and parts**
- Slots:
  - list: the default slot
  - item: default, leading, overline, headline, supporting-text, trailing, trailing-supporting-text, expanded-content
- Parts:
  - list: `drop-placeholder`
  - item: 29 parts. The native part appearances should cover row, state-layer, primary, leading/icon/avatar/image, content and the text parts, trailing, the expand button, the drag handle and the expanded panel.

**Hooks**
- List (10): container color and shape, padding block and inline, segmented gap, and five drop-placeholder hooks.
- Item (68). Groups:
  - container color and shape, including the four corners
  - per-state shapes: active, hover, focus, pressed, selected, dragged
  - five state-layer opacities
  - text colors and fonts for label, supporting, overline and trailing text
  - leading and trailing icon colors and sizes, including the expressive sizes
  - spaces: leading, trailing, top, bottom, between, three-line
  - dragged elevation
  - video, avatar and image sizes and shapes
  - image-selection colors and size
  - selected colors
  - expand: chevron color and size, button size, durations
  - expanded-panel padding and background

**States (light theme, measured)**

| State | Layer | Container | Shape (morph target) |
| --- | --- | --- | --- |
| rest | 0 | surface | resting corners (connected / segmented) |
| hover | .08 on-surface | — | no morph (the hook needs an authored `:hover` rule) |
| focus-visible (host, inner primary or roving) | .10 | — | 16; inset 3px secondary ring |
| pressed (`:active` or keyboard press class) | .10 | — | 16 |
| selected | — | secondary-container, on-secondary-container text | 16 |
| dragged (handle held) | .10 (pressed wins) | dragged elevation, z-index 1 | 16 (pressed wins over dragged) |
| disabled | none | content 38% | rest |
| soft-disabled | hidden | content 38% | **16 on press** (open source decision) |

**Motion (Chrome-resolved tokens)**

| Track | Duration | Easing |
| --- | --- | --- |
| Morph into an active state | 200ms | standard (.2,0,0,1) |
| Morph back to rest | 400ms | emphasized-decelerate (.05,.7,.1,1) |
| State-layer opacity, host box-shadow | 100ms | standard |
| Panel open: grid rows, opacity, inner translateY −8→0 | 350ms | emphasized-decelerate |
| Panel close | 200ms | emphasized-accelerate (.3,0,.8,.15) |
| Caret rotate | 300ms | standard |
| Drag handle: opacity, color, transform | 150ms | standard |
| Sibling shift and placeholder transform | 200ms | standard |
| Image-selection indicator | 150ms | standard |
| Image-selection circle (keyframes) | 300ms | linear |
| Ripple | 450ms grow, 150ms fade | standard |

Two motion rules apply on top of the table:
- **Reversal.** Interrupted morphs reverse with CSS's shortening rule (about 40ms in the quick-click expand cases).
- **Reduced motion** keeps only the layer opacity, the box-shadow and the ripple.

## Current native state

**Swift.** `Containers.swift` `list` handles both tags.

The list is a `VStack` that:
- inserts a `Divider()` between *every* row
- draws a `RoundedRectangle` background with radius 16 (segmented) or 4 (standard)
- maps `mdItemClick` to `mdActivate` (wrong semantics)
- emits `mdSelect` with a non-contract `selectedIndices` array, and without `item`, `childIndex` or `expanded`

The row is a plain `Button` with:
- `HStack(spacing: 12)` and `.padding(16)` on all sides
- a selected background of primary at 14% (should be secondary-container)
- an SF Symbols `chevron.up/down` and `checkmark`
- the label always rendered as `Text(label)`, even when a headline slot is present
- the expanded content shown inline with no panel
- the row toggling its own `selected`, separately from the list's selection set, so a single-select re-click can disagree with the web (selection kept and `mdSelect` re-emitted with `selected: true`)

Missing on iOS:
- density and minimum heights
- all 78 hooks and the parts
- typography tokens
- connected and segmented corners and the morph
- state layers, ripple and the focus ring
- roving focus, typeahead and keyboard handling
- reorder: drag, keys, placeholder and `mdReorder`
- expand motion
- the four list methods and five item methods
- link `target` handling
- image, video and avatar leading elements (only an `md-avatar` child is created)
- multi-action trailing focus
- `roleOverride`
- list/listbox/option accessibility
- truncation tooltips
- soft-disabled semantics
- RTL

**Android**
- `md-list` is the generic `SelectionContainer` (`AWCGroups.kt`):
  - a `Column` spaced 8dp (segmented) or 4dp, with the list `label` rendered as visible text
  - single-select treated as *required*: deselection is blocked, which matches the web, but the re-emitted `mdSelect` is suppressed
  - `mdSelect` without `item`
- `md-list-item` is a Material3 `ListItem` in `AWCComponent.kt`:
  - Material default paddings and typography
  - `secondaryContainer` when selected
  - an `IconButton` caret
  - `Checkbox` for `type` checkbox/radio, which are not in the contract
  - a non-contract `divider` property
  - `mdExpand` carries only `expanded`; `mdClick` has no payload; `trailingIcon` is ignored

Missing on Android: the same list as iOS.

**Metadata**
- iOS `NativeSupport.json` and Android `support.json` are stale. iOS also claims `leadingAvatar*`, `softDisabled` and `type` as supported.
- The compiler IR hashes are stale (see the review). The IR must be regenerated after the source fixes.

**Reusable infrastructure**
- Swift:
  - `NativeCard`/`CardAppearance` (state layers, ripple, focus, elevation) and `NativeIconButton` (caret and trailing actions)
  - `NativeTooltip`/`TooltipController` (truncation tooltips) and `NativeDivider`
  - `AWCCornerShape` (per-corner morph targets) and `AWCCSSTransitionTrack`/`AWCCSSColorTrack` (CSS retarget and reversal)
  - `AWCNativeBoxShadow` and `AWCNativeButtonRipple` (`honorsReducedMotion: false`)
  - `awcNativeDensity`, `AWCButtonFocusHandle`/`NativeFocusBridge`, `awcInspect`
  - the accordion chassis for panel motion (`AccordionMotion`) and drag reorder (`AccordionPointer`, `AccordionLift`, `AccordionReorderMotion`, `AccordionFloating`)
- Android:
  - `NativeCard`, `NativeIconButton`, `NativeTooltip`, `NativeDivider`
  - `AWCCornerShape`, `AWCDensityScope`, `nativeSourceRipple`/`nativeKeyboardRipple`, `AWCButtonFocus`, `inspectAWCNode`
  - `NativeAccordionMotion`, `NativeAccordionReorderMotion`, `NativeAccordionFloating`
- Dependency: md-avatar has no dedicated renderer yet. The list needs one, or an internal avatar with the gate-1 primary-container tones.

## Implementation plan (both platforms)

1. **Renderers and appearance types.** Add dedicated `AWCNativeList` + `AWCNativeListItem` (Swift) and `NativeList` + `NativeListItem` (Compose), each with a list-scope environment or composition local.
   - The scope carries listStyle, selectionMode, interactionMode, reorderable, density, the row index and first/last/middle position, plus the roving and typeahead state.
   - It replaces the six internal props.
   - Add `AWCListAppearance` (10 hooks) and `AWCListItemAppearance` (68 hooks), with the same field names on both platforms.
   - Add part appearances for row, state-layer, primary, leading/avatar/image, content, the text parts, trailing, expand-button, drag-handle, expanded-panel and drop-placeholder.
   - Resolve every value from the source tokens, never Material/SF defaults.
2. **Layout.**
   - List padding: 8/0 (standard), 0 + 2px gap (segmented).
   - Rows:
     - padding 8/16 and gap 12
     - minimum heights 56/72/88 from the density deltas (−4 or −6 per step)
     - three-line rows top-aligned with 12px padding
   - Text: headline body-large; supporting text wraps or clamps by `lines`; overline and trailing text in label-small.
   - Leading and trailing sizes:
     - icons 20 in a list, 24 standalone
     - avatar 40, image 56, video 100×56
     - caret 32, handle 24
   - Corners: connected corners (16 at the ends) or segmented (16/4).
   - Density inheritance: model it as two inherited values, the scale and the spacing-token rung, so the measured hybrid is reproducible. Otherwise record a justified difference if the source fixes the tokens.
   - RTL: mirror logical padding and the leading/trailing order.
   - Dividers: render authored `md-divider` children only. Do not insert automatic dividers.
3. **State machine.**
   - Inputs: hover, focus-visible (keyboard only), pressed, selected, dragged and disabled.
   - Layer opacities .08 and .10, with pressed outranking dragged while held.
   - Morph targets: `max(resting corner, state shape)`. Enter takes 200ms standard; exit takes 400ms emphasized-decelerate; use CSS-style reversal (`AWCCSSTransitionTrack`).
   - Focus ring: inset 3px secondary.
   - Ripple: md-ripple semantics, unaffected by reduced motion.
   - Reduced motion keeps only layer, box-shadow and ripple.
   - Soft-disabled follows the source decision. Until one is made, match Chrome (press morph with no layer or ripple).
4. **Keyboard and focus.**
   - The list owns a single focus stop (roving).
   - Up/Down wrap; Home/End; typeahead with a 500ms buffer.
   - Enter/Space activate with a centred ripple.
   - Right/Left expand and collapse, unmirrored like Chrome.
   - Alt+Up/Down reorder.
   - Multi-action trailing controls keep their own focus and keys. Authored content in expanded rows keeps its keys.
   - `mdActivate` fires only on a different row.
   - On iOS, map these to hardware-keyboard focus (`focusable`/`onKeyPress`). On Android, use `onPreviewKeyEvent` and the focus requesters.
5. **Selection and events.** Emit the exact payloads.
   - `item`: a native node reference or id, declared in the transport.
   - Single-select re-emits `mdSelect` on re-click.
   - `selectItem` is silent.
   - Children in expanded content report `childIndex` and `expanded`.
6. **Expand.**
   - The caret is the native icon button: 32px, `expand_more`, turning 180° in 300ms, filled and selected while open.
   - The panel opens in 350ms emphasized-decelerate (height, opacity, translateY −8) and closes in 200ms emphasized-accelerate. The hooks override the durations.
   - Reuse the accordion panel motion.
7. **Reorder.**
   - The handle grab lifts the row: z-index, dragged elevation, translate follows the pointer.
   - A placeholder tracks the drop slot; siblings shift 200ms.
   - Drop commits the order and emits `mdReorder {from, to, order}`. Returning to the origin emits nothing; disabled rows cannot be lifted.
   - Reuse the accordion chassis pointer, lift and reorder motion, including viewport coordinates and the Compose Exit-first fix.
8. **Accessibility.**
   - Roles: list/listbox/option, or the override. Use `accessibilityElement(children:)`/`accessibilityAddTraits(.isSelected)` on iOS and `collectionInfo`/`selectableGroup`/`selected` on Android.
   - Disabled and soft-disabled announcements.
   - Expand state.
   - Reorder accessibility actions (move up/down) as the native equivalent of Alt+Arrow.
9. **Methods** on both platforms: activateNext, activatePrevious, selectItem, getSelectedIndices; setFocus, focusItem, toggle, expand, collapse. Use the existing native method transport.
10. **Laboratory.**
    - `list-appearance.js`: 10 list fields, 68 item fields and the parts.
    - Live hosts and examples: settings, avatars, three-line, selection, multi-action, expandable, reorderable, segmented, density.
    - Update the support policies and regenerate the IR.

## Oracle → contract coverage

**`web-paint.json`** (264 cases, 264 PNGs; `paint.html` + `fixtures.js` + `list-oracle.js`). Each case records:
- **List:** rect, role and aria attributes, padding, gap, corners, background, placeholder and dividers.
- **Each row:** host, row, primary, state layer and ripple waves.
- **Leading elements:** leading/icon/avatar/image and image-selection (rect, colors, radii, font variation).
- **Text:** content, overline, headline, supporting and trailing text (font, size, weight, line height, tracking, color, white-space, clamp, truncation).
- **Trailing elements:** trailing icon, expand button and caret, drag handle, panel, tooltips and slot assignments.

Groups:
- **anatomy (88):**
  - 11 recipes: basic, icons, avatar, threeLine, video, controls, expandable, reorderable, truncation, dividers, slots
  - × standard/segmented × light/dark × LTR/RTL
  - Covers row metrics, typography, colors, connected and segmented corners, leading/trailing sizes, truncation and tooltips, and divider `aria-hidden`.
- **density (30), density-inherited (3), density-item (1):**
  - Rungs 0…−4 for icons, avatar and threeLine, in both styles.
  - Inherited `data-density`, the local-over-inherited hybrid, and item-local density.
- **states (23):** rest, selected, disabled and soft-disabled across text, button and link × none, single and multi × themes, segmented RTL, and image selection. Covers roles, aria-selected, aria-disabled, secondary-container and the 38% content.
- **hook-list (10), hook-item (68), hook-item-standalone (4), hooks-all (8), hooks-inherited (2), hooks-base (2):** one case per hook against the base kitchen fixture (every hook has a measured effect or is covered by a state run), all hooks together in both styles and themes, and inheritance from the list.
- **The rest (single, role-override, mixed-types, parts, labels, hidden, fixed-height, empty, width, expandable-selection, expandable-text, shape-morph-off):** edge semantics, `::part` styling, the `shape-morph="off"` freeze, and width wrapping at narrow sizes.
- **standalone (6):** rows without a list. Covers 24px icons, `listitem` without an owner, and no roving.

**`web-states.json`** (27 runs, 174 phases, 5,158 frame samples, 1,048 transition/animation records, 162 events, 172 PNGs; `states.html` + `states-runs.js`).
- **Per frame:**
  - for every row: rect, background, color, corners, box-shadow, transform, z-index, classes, state layer, ripple waves, drag-handle opacity, icon colors and variation, panel height/opacity/rows/inner transform, caret transform, image-selection indicator and circle
  - for the list: the active-element path, the order and the placeholder
- **Per phase:** a full snapshot and a PNG.
- **Per run:** events with timestamps and payloads, and every CSS transition/animation (target, property, start, duration, easing, from/to).

Runs:
- **pointer ×6** (standard and segmented × themes, RTL, links): hover .08, press .10 plus the 200ms morph, release 400ms, ripple 450/150, `mdActivate` on press focus, `mdClick`.
- **select ×3** (single, multi, segmented dark single): re-click semantics and the secondary-container change.
- **selectedHover:** a deselect with hover on a selected row.
- **disabled:** hard (inert) and soft (focus, cancelled click, press morph).
- **trailing** (multi-action): the icon-button and switch keep their own pointer and keys, with no row `mdClick`.
- **keyboard ×3** (typeahead list, single-select options, segmented dark RTL buttons): roving, wrap, Home/End, typeahead "b" then "bl" then "c", Enter/Space, Tab away, and `mdActivate` only on a change.
- **expand ×3** (standard, segmented, dark RTL): row-click and caret toggles, 350/200 panel motion, the 300ms caret, the child row click, and about 40ms reversals.
- **expandKeys:** ArrowRight/Left, Enter, Tab to the caret, then Tab to a child. Child keys do not collapse the parent.
- **drag ×3** (standard, segmented, dark RTL), **dragUp**, **dragCancel:** handle hover and press, lift, translate, placeholder track, sibling shift 200ms, drop order and `mdReorder` payload. Cancel emits nothing.
- **keyReorder:** Alt+Down/Up and the edge no-op.
- **imageSelect:** indicator 150ms and circle keyframes.
- **custom:** every list and item hook under hover/press/focus/drag. Shows the hook layer opacities .2/.4/.3, the pressed shape, the dragged elevation, and the masked dragged shape and layer.

**`web-states-reduced.json`** (6 runs, 37 phases, 1,120 samples, 81 records, 37 PNGs). Captured with `prefers-reduced-motion: reduce` for pointer, keyboard, expand, drag, imageSelect and select. Only layer opacity, box-shadow, the no-op icon variation and ripple waves remain.

**`web-states-extra.json`** (3 runs, 22 phases, 732 samples, 146 records, 22 PNGs; job 169):
- expand and expandKeys with every item hook: durations 600/90, collapsed caret `#E65100`, caret button 40px
- expandKeys in RTL: ArrowRight still expands

**Source tests.** Six new e2e files pin the gate-1 fixes. Native acceptance should replay the same scenarios:
- authored keys
- avatar tones
- reduced motion
- focus ring on button/link rows
- `mdActivate` deduplication
- hidden rows

## Source decisions and findings for native

Native must match the measured Chrome behaviour unless the source changes:
- **Avatar default (gate-1 change).** Initials avatars now use primary-container/on-primary-container and honour the hooks. Native must not use md-avatar's name palette inside rows.
- **Morph timing.** It contradicts its source comment. Native follows the measured timing (enter 200ms standard, exit 400ms emphasized-decelerate).
- **Dragged visuals are masked** by pressed while the pointer is held, as in md-card.
- **Soft-disabled press morph** and **RTL disclosure keys** are open source decisions.
- **The density hybrid** (local shallower than inherited) comes from token rungs, so the decision belongs to the token owner.
- **Internal props and events are public on Web** (six props, four events). Native keeps them internal and documents this as a justified difference.
- **`:host-context` expressive sizing** works only in Chromium. Native uses the Chromium values (20px in a list).
- **The CEM** duplicates `active-container-shape`.
- **The CSS header** omits the `expand-button-size` and `expand-chevron-size` hooks and the `primary` part, and the bottom-space comment says 10px against an actual 8px.
- **The `[data-rtl-mirror]` rules** are dead.
- **The shared `packages/core/dist` is stale** for md-list. It was deliberately not rebuilt because other forks use it, so any consumer of the shared dist sees pre-fix behaviour until the next coordinated build.
