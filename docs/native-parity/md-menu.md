# md-menu native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against Mac
Chrome 153 oracles (2026-10-30), for `md-menu` and its children `md-menu-item`, `md-sub-menu-item` and `md-menu-item-group`.
Independent final audit pending. Source contract: [md-menu-source-review.md](md-menu-source-review.md); plan:
[md-menu-native-plan.md](md-menu-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Menu, row, submenu row and group nodes | dedicated renderers (`NativeMenu.swift`, `MenuSupport.swift`, `MenuController.swift`) | dedicated renderers (`NativeMenu.kt`, `NativeMenuSupport.kt`, `NativeMenuController.kt`) |
| Top layer (anchored menus and flyouts) | `AWCMenuScope { … }` / `AWCMenuScope(state:)` | `AWCMenuScope(state, modifier) { … }` |
| Anchors (`anchor="<id>"`) | any `AWCNativeView` node with that id, or `.awcMenuAnchor(id, label:)` | any `AWCComponent` with that `id`, or `Modifier.awcMenuAnchor(id, label)` |
| `show({ autoFocus })`, `close()`, `whenClosed()`, `reposition()`, `getScrollViewport()` | `AWCMenuScopeState.menu(id)` → `AWCMenuHandle` | `AWCMenuScopeState.menu(id)` → `AWCMenuHandle` |
| md-sub-menu-item `collapse()` | `handle.collapse(row:)` | `handle.collapse(rowID)` |
| Hooks: the six menu hooks and the five row hooks (inherited by every row) | `AWCMenuAppearance` + `.awcMenuAppearance(_:)` | `AWCMenuAppearance` + `AWCMenuAppearanceScope` |

`getScrollViewport()` returns the viewport geometry (scrollTop, scrollHeight, clientHeight) instead of the Web element.
`setComboboxElement()` and `setVirtualProvider()` are the DOM combobox / virtualization plumbing of md-select and
md-autocomplete and have no native counterpart (unsupported in the policies).

Behaviour mirrors the source:

- Surfaces: baseline / standard / vibrant, standard and grouped layouts (gap cards), header slot, empty text, density
  0 … −4, the capped scroll viewport (`max-height`, `--md-menu-max-block-size`), the 150 ms scale-and-fade entrance and
  exit (quick and Reduce Motion snap, Chrome's two-frame start).
- Placement: `positionMenu()` ported (4-unit gap, flip on both axes, 8-unit viewport clamp, physical `-start`/`-end` in RTL,
  match-anchor-width, responsive full-width surface ≤ 600); submenu flyouts beside their row with the source's origin rules.
- Rows: one- and two-line rows, leading/trailing slots, trailing text, badge, divider and gap, checkbox and radio rows
  (check position, indeterminate, keep-open, radio scopes kept while the surface is closed), option presentation and role
  override; hover/press/focus state layers, the md-ripple wave timed as Chrome runs it, the inset 3-point focus ring with
  Chrome's `:focus-visible` heuristic for script focus.
- Keyboard: roving focus (disabled rows focusable), typeahead (500 ms buffer), Home/End, ArrowRight/Enter/Space open a
  flyout on its first row, ArrowLeft/Escape return, Escape and Tab close the tree and restore the anchor (Tab then continues
  in reading order), Space on checkbox/radio rows never closes.
- Dismissal: outside clicks after the target's own handler (a menu opened by that click stays), peers close when a menu
  opens, `persistent` keeps a menu open; activation closes the tree after 150 ms unless keep-open.
- Events: `mdOpen` / `mdClose` (no detail) on the menu, `mdClick` on rows.

## Evidence

Oracles (`outputs/native-parity/md-menu/web-oracle/`, Chrome 153 on the Mac, DPR 1, trusted CDP input; job n2-001) are shared
byte-identically by `packages/native-ios/Tests/Fixtures/menu-web-*` and the Android test assets: 138 paint cases with PNGs,
26 interaction/motion runs and their 26 reduced-motion runs.

| Run | Result |
| --- | --- |
| macOS SwiftUI paint (`NativeMenuPaintIntegration`) | **8,302 / 8,302** (138 cases) |
| macOS SwiftUI states (`NativeMenuStatesIntegration`, 26 + 26 reduced runs) | **2,524 / 2,524** (two consecutive runs) |
| iOS simulator paint (AWC-n2, iPhone 17 Pro, iOS 26.3.1) | **8,302 / 8,302** |
| iOS simulator states | **2,524 / 2,524** |
| Android paint (`NativeMenuPaintTest`, emulator-5558) | **8,302 / 8,302** |
| Android states (`NativeMenuStatesTest`) | **2,524 / 2,524** |

Comparisons: every md-* and [part] box of the oracle tree (0.75 unit, text parts 1.0), roles and aria-checked, the flat pixels of
every clipped Chrome screenshot (≤ 0.5 % beyond 6 levels, mean ≤ 1 level), per-frame opacity and scaleY within Chrome's frame
envelope (−40 / +34 ms plus the neighbour samples), md* events (order, target, phase), focus, row layers, anchor and row
expansion, selection, and phase-end pixels.

Documented allowances (test-side; the renderers are unchanged):

- **Platform fallback glyphs** (Android, iOS): a trailing text with a symbol outside Roboto (U+2190–U+2BFF, e.g. ⌘) is drawn
  with the platform's fallback font, whose advance differs from Mac Chrome's fallback. The largest such difference widens
  the horizontal box checks and the surfaces' edge bands are masked from the pixel comparison. macOS shares Chrome's fallback.
- **Phase screenshots**: the oracle records no capture time; Chrome's shot falls between its last sampled frame (+17 ms) and the
  next phase, so native shots are taken across that window and the best one is compared.
- **iOS harness input**: synthesized keys and touches go through UIKit's HID queue and reach the view one to two frames after
  their timestamp; the envelope's later side grows by two frames on iOS. Rows take press and click from the raw UIKit touch
  (`AWCTouchPressRouter`, as `AWCNativeActionControl`), so the row ripple starts with the touch.
- **Android**: input lands at the oracle's exact times on a paused clock; Chrome's 150 ms activation timer fired between
  +166.7 and +233.3 ms in the oracle runs, so activation exits widen the earlier side by 66.7 ms; an outside click is clamped
  inside the 540 dp device.
- **Tab past the last control**: the oracle page's own Run button stands for "focus left the fixture".

## Laboratory (gate 3)

- **Recipe:** a tonal "Open menu" trigger anchoring the Workspace menu (New project, Duplicate ⌘D, Export ▸ SwiftUI / Compose)
  in an `AWCMenuScope`; the trigger toggles the menu as the recipe's `data-awc-action="toggle"` does; the previewed element
  (menu, row, submenu row or group) takes its place in that tree (`AWCPreviewMenu`, `LivePreviewMenuHost`).
- **Styles panel:** the eleven md-menu hooks (`menu-appearance.js`), the row hooks passed down to every row.
- **Properties:** retained updates of all four tags with the source types.
- **Methods:** `show([{ autoFocus }])`, `close()`, `whenClosed()` with call IDs; `reposition()`; md-sub-menu-item `collapse()`.
- **Examples and copyable snippets** present the menu in an `AWCMenuScope` with the trigger's toggle and the handle calls.

| Run | Result |
| --- | --- |
| Studio (`menu-integration.test.mjs`) | **5 / 5** |
| SwiftUI live host (`test-live-menu.mjs`) | **43 / 43** |
| Android live host (`LivePreviewMenuHostTest`: recipe, hooks, lifecycle methods, row / group / submenu pages) | **4/4** |
| Copyable examples | 28 SwiftUI (typecheck) + 28 Compose (compiled into the androidTest set) |

## Accessibility (tools/ax)

`tools/ax` (fa) on the recipe: three cases (closed, open, open with `auto-focus` off), macOS, iOS and Android against the Chrome
153 tree of the same effective node: **0 open findings** (evidence `outputs/native-parity/_ax-n2/md-menu/`, report.md).

| Concern | Web | macOS | iOS | Android |
| --- | --- | --- | --- | --- |
| Menu | `role=menu`, named after its anchor | AXMenu named after the anchor (an AppKit element owns the rows; the SwiftUI content is hidden) | labelled container (no menu trait) | pane titled with the anchor's name |
| Group | `role=group` + `aria-label` | AXGroup "Workspace" inside the menu | labelled container; the label text is not repeated | container described by its label (no group role; one expected text entry) |
| Rows | `menuitem` / `menuitemcheckbox` / `menuitemradio` / `option`, name = text content | AXMenuItem (checkbox / radio / option roles), name = headline + supporting text + badge + trailing text | buttons with the same names | buttons / checkboxes / radio buttons with merged text |
| Submenu row | `aria-haspopup`, `aria-expanded` | expanded state, "Menu button" | value Expanded / Collapsed | expand / collapse actions |
| Anchor | `aria-haspopup`; `aria-expanded` only on a role-bearing anchor | AXExpanded on a button anchor | value Expanded / Collapsed | expand / collapse actions that open and close the menu |

Expected entries (`tools/ax/expectations.mjs`, each with its reason): the Android group label read as text; the anchor's
expanded state, which Chrome does not report on the roleless md-button host; the menu name and the first row's roving Tab
stop with auto-focus off, which Chrome 153 does not report although the source sets both (decisions below and in the source
review).

## Decisions (2026-10-30)

Recorded with alternatives in [md-menu-source-review.md](md-menu-source-review.md):

- A menu whose `open` is set before it loads opens natively like a later `open = true` (focus, anchor state, dismissal);
  on the Web it skips its open tasks (Stencil runs no `@Watch` for the initial value).
- Native button anchors expose the expanded state (Web: only role-bearing anchors; the md-button host has no role).
- The menu is always named after its anchor, and with auto-focus off its first row is the roving Tab stop, as the source sets them.

## Remaining

Independent final audit.
