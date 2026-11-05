# Menu native implementation plan (md-menu, md-menu-item, md-sub-menu-item, md-menu-item-group)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-menu-source-review.md](md-menu-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-menu/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Overlays.swift`, dispatched from
`AWCNativeView.swift`: `md-menu` → `menu`; `md-menu-item`,
`md-sub-menu-item` and `md-menu-item-group` → `menuItem`):

* `menu` is an **in-flow** `VStack`:
  * A primary-styled toggle `Button` labelled `listLabel` (default "Menu")
    with an ellipsis glyph.
  * When `open`, a 2pt-spaced column (12pt when `layout=grouped`) on a
    16-radius surface with a 0.15-primary stroke.
  * It shows `emptyText` ("No items") when the menu has no children.
  * The toggle calls `showOverlay`, which sets `open` and emits
    `mdOpen`/`mdClose`.
  * A child's `mdClick` closes the menu unless `persistent`, the item's
    `keepOpen`, or the item is a submenu row.
  * Animation: `.easeInOut(duration: 0.18)` on `open`.
* `menuItem`:
  * Group: a bold caption label over its content.
  * Row: a plain `Button`. Checkbox toggles `selected`; radio sets it to
    `true` (no sibling deselection). A submenu row toggles a local
    `_expanded` and renders its children **inline, indented 20pt**, with a
    chevron right/down.
  * Every row emits `mdClick`.
  * Content: `start` and `leading-icon` slots; a filled or empty circle for
    checkbox and radio; headline plus supporting text; trailing text, badge
    capsule, `end` and `trailing-icon` slots; divider above.

**Android** (`packages/native-android/.../AWCOverlays.kt` and
`AWCComponent.kt`):

* `md-menu` → `OverlayComponent`:
  * Renders the `anchor` slot and an `AWCDropdownMenu(expanded = open)`
    holding the default slot.
  * Outside dismissal calls `close()` (`mdClose`) and ignores `persistent`.
  * `mdOpen` comes from a `LaunchedEffect`.
  * Preview presentation adds an "Open menu" button.
  * **Item activation never closes the menu.**
* `md-menu-item` / `md-sub-menu-item` → a Material3 `ListItem` with a
  `clickable` modifier:
  * Every row type toggles a local `selected` on click, buttons included.
  * Checkbox and radio both draw a `Checkbox`; radios are not exclusive.
  * A submenu row draws an expand `IconButton` that reveals the `submenu`
    slot inline and emits **`mdExpand`** (not a Web event).
  * `semantics { selected }` only.
* `md-menu-item-group` → a `Column` with a `heading()` label.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Presentation | Top-layer popup anchored to `anchor`, 4px off, flips and clamps 8px inside the viewport, tracks the anchor; in-flow when anchorless | In-flow column under its own toggle button; no anchor | Anchored `DropdownMenu` (anchor slot); Compose positioning rules |
| Placement | `bottom/top-start/end` (physical), flip, clamp, `match-anchor-width`, `responsive` sheet ≤600 | None | Compose default; no placement mapping, no responsive mode |
| Height | Capped at 250 (`max-height` / hook), scrolls; header slot pinned | Unbounded | DropdownMenu scrolls at its own max |
| Variants | baseline / standard / vibrant; grouped; use-gap cards | One look (16 radius, stroke); `grouped` only widens spacing | Material default only |
| Rows | 48/40/32 (density), 12 padding, 12/8 gap, 24/20 icons, 16/24 type; first/last corner shaping; selected tonal fill | Intrinsic padding 12, caption trailing text, no density | ListItem 56dp, no density |
| Selection | Checkbox toggles; radio exclusive within the same menu and group (fix E); indeterminate is `mixed`; check position start/end | Checkbox toggles; radio never deselects; same circle glyph for both | Every type toggles, buttons included; radio shown as a checkbox; not exclusive |
| Activation | Closes the whole tree after 150ms and focuses the root anchor (fix D); `keep-open` | Closes (except submenu rows and keepOpen); `persistent` wrongly blocks it | Never closes |
| Dismissal | Escape (innermost; submenu → row, fix B), Tab (tree; focus moves on from the anchor), outside click unless `persistent`, peer menu | Toggle button only | Outside tap (`persistent` ignored) |
| Submenus | Flyout beside the row (inline-end, flips), 100/400ms hover intent, keyboard open/close (mirrored in RTL, fix C), one flyout per menu, `collapse()` on close | Inline accordion expansion | Inline expansion + `mdExpand` |
| Keyboard | Roving focus, wrap, Home/End, 500ms typeahead, Enter/Space rules | None | DropdownMenu default focus only |
| Semantics | `menu` named by the anchor (fix G), `menuitem` / `menuitemcheckbox` / `menuitemradio`, `aria-checked`, `option` in listbox mode, `group` with label, `status` empty text, anchor `aria-haspopup`/`aria-expanded` | Buttons; no traits | `selected` only |
| Motion | Open 150ms scaleY(.8)→1 + fade, emphasized-decelerate; close 150ms emphasized-accelerate; corner morph 300ms; state layer 100ms; ripple | easeInOut 0.18 on the column | Compose DropdownMenu motion |
| Reduced motion | No surface motion (fix F); state layer and ripple remain | Not handled | Not handled |
| Events | `mdOpen`/`mdClose` (non-bubbling, on the menu), `mdClick` per row | `mdOpen`/`mdClose` on toggle; `mdClick` | `mdOpen`/`mdClose`; `mdClick`; extra `mdExpand` |

## Plan

1. **Shared menu model** (both platforms, data-only so it tests headless):
   * open state with the 150ms close latch;
   * roving index with wrap, Home/End and disabled-focusable;
   * a 500ms typeahead buffer;
   * radio scope keyed on (closest menu, closest group);
   * the activation rule: close the tree unless `keepOpen`, Space on
     checkbox/radio never closes;
   * submenu hover intent (100/400ms) with keyboard override;
   * dismissal rules (`persistent`, peer menus).
2. **iOS.**
   * Present the surface as an anchored overlay instead of an in-flow
     column: a popover-style `ZStack` overlay in the modal layer
     (`ModalScope`/`PopupScope`), positioned from the anchor's frame
     (`anchorPreference`).
   * Port the flip and clamp math (gap 4, margin 8) and the responsive sheet
     (width − 16 below 600pt).
   * Rows: 48/40/32 per density; 24/20 icons; tonal selected fill; the
     variant colour tables from the paint reference; corner shaping (first
     and last rows 16, others 8, selected 12).
   * Accessibility: `.accessibilityElement(children: .contain)` with the
     anchor's label. Rows get the button trait, and `.isSelected` or a
     "checked" value. Submenu rows get an "expanded" value.
   * Hardware keyboard: `.onMoveCommand` (mirrored in RTL),
     `.onKeyPress` for typeahead, Escape via `.onExitCommand`.
   * Motion: 0.15s `timingCurve(0.05,0.7,0.1,1)` scaleY(0.8) plus a fade
     on open, and `(0.3,0,0.8,0.15)` on close. Both are off under
     `accessibilityReduceMotion`.
   * Fix the `persistent` semantics: it is about outside taps, not item
     activation.
3. **Android.**
   * Keep `DropdownMenu` (or a `Popup` with a custom
     `PopupPositionProvider` for placement, flip and the 4dp offset).
   * Items become `DropdownMenuItem`-shaped rows sized from the density
     table.
   * Close on activation unless `keepOpen`.
   * Radio exclusivity follows the shared scope model; checkbox and radio
     glyphs differ.
   * Drop `mdExpand`. Submenus become a nested `DropdownMenu` anchored to
     the row, opening at the inline end, with hover intent for pointer input
     and a key handler for DPAD/keyboard (mirrored in RTL).
   * Semantics: `Role.Checkbox` / `Role.RadioButton`,
     `toggleableState` (indeterminate), and `selectableGroup()` per radio
     scope. The popup's `paneTitle` is the anchor's label.
   * Motion: 150ms `CubicBezierEasing(0.05f,0.7f,0.1f,1f)` scaleY/alpha on
     enter and `(0.3f,0f,0.8f,0.15f)` on exit, gated by the reduced-motion
     setting.
4. **Native fixtures.** One per oracle family:
   * the variant × layout × theme × direction × density matrix;
   * selection (check position, indeterminate, disabled);
   * regions, hooks, empty and scroll cases;
   * placement, flips and the responsive sheet;
   * submenu open in LTR, RTL and at the edge;
   * listbox.

   Diff geometry against `paint.json`; diff open/close and submenu timing
   against `states.json`; confirm the reduced runs carry no surface motion.

## Open decisions to settle before native work

The anchor `aria-controls`, submenu rows and `--md-menu-item-*` hooks,
logical vs physical `placement`, and the caret rotation. All four are listed
in the source review.
