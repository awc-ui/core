# Navigation rail native implementation plan (md-navigation-rail, md-navigation-rail-tab)

Status: preparation only, at Gate 1. No native code has changed.

* The Web contract is in
  [md-navigation-rail-source-review.md](md-navigation-rail-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-navigation-rail/web-oracle-cloud/`. Recapture it
  on the Mac (Chrome 153) first.

## Current adapters

**iOS** (`Containers.swift`, `navigation`):

* Content is a `VStack` of the logo, logo-expanded, header and fab slots,
  with a toggle `Button` when `expandable`.
* Destinations are a `VStack(alignment: .leading, spacing: 8)` (or an
  `HStack` when horizontal), followed by the footer slots, all in a
  16-radius card.
* The toggle flips a local `_expanded` and emits `mdExpand`/`mdCollapse`
  from `b("_expanded")` read **after** `set`. Verify whether that read sees
  the new value; if not, the events are inverted.
* `_expanded` changes neither the width nor the labels.
* `mdTabChange.value` falls back to the **node id**; the Web uses `''`.

**Android** (`AWCNavigation.kt`):

* `Surface(surfaceContainer, shapes.large)` holding a `Column(padding 12,
  spacing 8)` of the header slot, the default slot and the footer slot.
* The logo, fab, logo-expanded and footer-leading/content slots are not
  rendered.
* Items share the bar's `Column` (pill plus label).

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Container | 80 (+4·d) column, surface, 44 top padding, alignment top/middle/bottom, full height | Card | Card |
| Expanded | 220–360 wide; content-hugging 56-tall pills; label 14/20; animated 200ms | Flag only | None |
| Modal | Overlay container (surface-container, elevation 3, radius 16), scrim .32; Escape and scrim collapse; focus back to the toggle | None | None |
| Toggle | `md-icon-button` with menu ↔ menu_open and `aria-expanded`; vertical only | Plain button | None |
| Label visibility | `all` / `selected` (animated collapse) / `none`; tabs named when hidden (fix C) | Partially (labels removed, unnamed) | Wrong enum values |
| Destinations | 80×56 (48 at −2/−4), gap 8/4/0, 56×32 pill, filled active icon, label 700/500, secondary active label | Tinted cell | 64×36 pill |
| Overflow | `maxVisible` + "More" menu; disabled rows (fix D) | None | None |
| Horizontal | 72-tall bar; logo leads (absent logo takes no space, fix F); FAB intrinsic (fix G); footer trails; pill on the icon wrapper | `HStack` | None |
| Links / submenu | `href` destinations, `aria-current`; `md-menu` submenu with caret | `activateLink()` | `slot("submenu")` only |
| Keyboard | Manual activation; vertical Up/Down, horizontal Left/Right by direction; Home/End; Enter/Space | None | None |
| Semantics | navigation (named) > tablist (or links) > tab; badge status | `.isSelected` | `selected` |
| Motion | Width 200ms `cubic-bezier(.2,0,0,1)` plus FLIP of indicator, icon and label (icon x anchored); scrim fade; 150ms state/colour | None | None |
| Reduced motion | No width or FLIP motion; no CSS transitions (fix H) | n/a | n/a |

## Plan

1. **Shared model:**
   * the variant state machine (expand/collapse/toggle, with the event
     emitted after the state changes);
   * the overflow partition (`maxVisible`) with disabled passthrough;
   * manual-activation focus;
   * value fallback `''`.
2. **iOS `NavigationRailView`.**
   * Width animates over 200ms `timingCurve(0.2, 0, 0, 1)`.
   * Destinations use `matchedGeometryEffect` for the pill and label, with
     the icon pinned to the rail axis (x = width/2 collapsed; inset 16 + 12
     expanded).
   * The modal variant is an overlay in the shared modal layer (see
     native-modal-layer.md): a scrim at .32, a focus scope, and Escape
     through `onExitCommand` / keyboard shortcut.
   * Overflow uses `Menu`, with `disabled` passthrough.
   * Horizontal is a separate `HStack` layout.
   * Reduce-motion skips the width and geometry animations.
3. **Android.**
   * Use M3 `WideNavigationRail` / `ModalWideNavigationRail` (Material3
     expressive). It covers collapsed/expanded and modal with a scrim.
   * Map `labelVisibility` onto item label rendering, keeping
     `contentDescription` when a label is hidden.
   * Overflow uses a `DropdownMenu` with `enabled = !disabled`.
   * Horizontal is a `Row` layout. Compose's rail is vertical-only, so this
     one is custom.
   * Motion uses the rail's built-in expand animation. Check it against the
     web frames, re-specifying 200ms / `(0.2, 0, 0, 1)` if needed. Honour
     `isReducedMotionEnabled`.
4. **Fixtures:** the paint matrix (variant × labels × theme × dir), density,
   slots, alignment, modal, horizontal (with and without a logo, with a
   FAB), overflow, badges, disabled, links, submenu and hooks. For the
   states, check the expand/collapse per-frame host width and the tab-0
   indicator, icon-wrapper and label rects against `states.json`, plus the
   reduced-motion run.

## Open decisions

Modal focus trapping and `inert`, the role of mixed link/tab groups,
horizontal FAB placement (leading or trailing), badge wording, the
`fab-size` hook semantics, and the unused `label-typography` hook.
