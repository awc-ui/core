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
| CSS parts (16: md-menu `empty-text`, `surface`, `menu-viewport`; md-menu-item `state-layer`, `leading-icon`, `content`, `headline`, `supporting-text`, `badge`, `trailing`; md-sub-menu-item's six) | `AWCMenuPartAppearance` + `.awcMenuPartAppearance(_:part:for:)`, `.awcMenuItemPartAppearance`, `.awcSubMenuItemPartAppearance` (`AWCMenuPart` / `AWCMenuItemPart` / `AWCSubMenuItemPart`) | `AWCMenuPartAppearance` + `AWCMenuPartAppearanceScope`, `AWCMenuItemPartAppearanceScope`, `AWCSubMenuItemPartAppearanceScope` |
| `setComboboxElement(el)`, `setVirtualProvider(provider)` | `handle.setComboboxElement(id)`, `handle.setVirtualProvider(AWCMenuVirtualProvider?)`, `handle.activeDescendant`, `handle.handleKey(_:)` | `handle.setComboboxElement(id)`, `handle.setVirtualProvider(AWCMenuVirtualProvider?)`, `handle.activeDescendant`, `handle.handleKey(key)` |
| Inline-fill embedding (`md-menu--inline-fill`, `--md-menu-inline-surface-color`, `--md-menu-inline-fill-radius-end`) | `.awcMenuInlineFill()` | `AWCMenuInlineFillScope { … }` |

`getScrollViewport()` returns the viewport geometry (scrollTop, scrollHeight, clientHeight) instead of the Web element.
Part appearances (background, color, outline colour / width, corner radius, opacity, letter spacing) follow the source's
cascade: an outer `::part()` rule wins over the hooks and every internal state rule (a state-layer opacity holds in every
state), a tag rule reaches every element of the tag in the subtree (flyouts included), an element ID (`for:`) outranks it field
by field. `setVirtualProvider` runs the source's virtual navigation against the provider's indices (ArrowUp/Down wrapping past
disabled rows, Home/End, typeahead through `findPrefix`, Enter on the active option in combobox mode), awaits
`ensureVisible` before it marks or focuses the windowed row, and makes the surface a listbox; with `setComboboxElement` the
combobox keeps focus and `activeDescendant` names the active row (aria-activedescendant), which shows the focus ring. Keys
typed in the header slot reach the menu as the source's keydown bubbles from the header input (macOS: also from an AppKit
text field there); `handleKey` routes a combobox's keys explicitly. Inline fill: anchorless menus fill the embedding view
without shadow, padding or radius except the end corners, on the inline surface colour, uncapped.

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

## Gate-7 r4 (2026-11-05)

- R4-12 (parts) and R4-13 (combobox / virtual provider): native APIs above; tested by the Chrome 153 cases of
  `menu-r4.html` (parts with tag and #id rules, LTR / RTL, baseline / standard, dark) on macOS, iOS and Android, and by
  NativeMenuVirtualIntegration / NativeMenuVirtualTest (a 10,000-row provider with an 8-row window).
- R4-14: `--md-menu-viewport-margin` (height cap and width clamp; positioning clamps with the source's fixed 8),
  `--md-menu-section-gap` and the inline-fill hooks have Chrome cases in `menu-r4.html`, compared on all three platforms.
- R4-15 (decision): `--md-menu-group-container-shape` / `--md-menu-group-shape` are implemented natively
  (`AWCMenuAppearance.groupContainerShape`) and compared in `hook-group-shape`; they are not in the CEM, so the Laboratory
  exposes the CEM's hooks only. Alternative: document them in md-menu-item-group (source owner, gate 1); then the Laboratory
  field follows from the CEM.
- R4-16: a row whose targets change instantly (Reduce Motion, leaving hover) keeps its paused TimelineView live for two
  frames, so the new layer / fill is drawn (iOS 18 and macOS kept the paused timeline's stale content).
- R2-D10: NativePreviewPresentationTest renders md-menu through the Laboratory host (LivePreviewMenuHost) and sends Escape as
  a window key event (the source listens on the document). R4-21: tools/ax expectation for the initially open Web reference.
- Evidence: main-queue n2-064-install-menu-r4; evidence work/n2-lab/install-main/j64, n2-lab/out/j61 j63 a40 a41

## Gate-7 r4 re-check follow-ups (2026-11-07)

- R4-16 (reopened: macOS `selection-keep-open (reduced) click-radio`): a pointer press also bumps the row's activation counter
  (so a press released in the same SwiftUI update still draws a wave), and the ripple treated every activation as a keyboard
  trigger: a centered wave started two frames late and released at once. Its fade began ~23 ms after Chrome's, so the phase-end
  shot still had the wave at 0.107 where Chrome's was ~0.05 (layer trace, n2-066). A pointer activation now starts the wave at
  the press point on the next frame and holds it to the release (md-ripple onPointerDown); keyboard activations keep the
  centered self-releasing wave. Menu states: macOS 2524/2524, iOS 26.3 and 18.6 2524/2524.
- R4-27: NativeMenuVirtualIntegration is `@MainActor` and checks the UIKit text field on iOS. On iOS a hardware key typed in a
  UIKit text field declared with `.awcMenuHeader` reaches SwiftUI's key handling at the scope, not at the surface's header slot
  (the menus render through the scope's preference overlay; probe n2-069), so `AWCMenuScope` routes ArrowUp / ArrowDown / Home /
  End / Enter to an open virtual listbox menu when the focused text input lies in its header or a combobox is registered (macOS
  keeps its local key monitor). Menu virtual 18/18 on macOS, iPhone 26.3, iPhone 18.6 and iPad 26.3.
- R4-23: `test-native-views.sh` runs NativeMenuVirtualIntegration; NativeMenuPaintIntegration runs `menu-web-paint` and
  `menu-r4-paint` by default (`AWC_MENU_FIXTURE` selects one; the iOS harness bundles both), NativeMenuPaintTest has a second
  @Test for `menu-r4-paint` (`menuFixture` selects one): macOS / iOS 9092/9092, Android 8302 + 790.
- Evidence: main-queue n2-072-install-r4-followups; evidence work/n2-lab/install-main/j72, n2-lab/out/j66 j67 j69 j70 j71 a42

## Decisions (2026-10-30)

Recorded with alternatives in [md-menu-source-review.md](md-menu-source-review.md):

- A menu whose `open` is set before it loads opens natively like a later `open = true` (focus, anchor state, dismissal);
  on the Web it skips its open tasks (Stencil runs no `@Watch` for the initial value).
- Native button anchors expose the expanded state (Web: only role-bearing anchors; the md-button host has no role).
- The menu is always named after its anchor, and with auto-focus off its first row is the roving Tab stop, as the source sets them.

## Remaining

Independent final audit.

## Select-family follow-ups (2026-11-08)

- Tab from a row when the anchor is a text field (md-select / md-multi-select trigger), AppKit: `closeEntireMenuTree()` focuses the anchor, whose field editor (not an AWC focus view) then holds focus, and the advance found nothing to continue from (focus stayed on the field; Chrome leaves it on the document). The advance now waits for the anchor focus and continues from the field as its own Tab does: document order, else the key-view loop, else the field resigns. Menu Tab runs 214 / 214; select `tab-away` / `tab-while-open` pass (n2-080, n2-081).
- Compose `NativeMenuRipple`: a pointer press starts the wave one frame after the press (was two; the keyboard `trigger()` keeps two), as SwiftUI since R4-16; the release fade follows a frame earlier. Menu states unchanged, md-multi-select select-all phase-end layer now matches (n2-A051, n2-A052).
- Evidence: main-queue n2-082-install-select-gate3; evidence work/n2-lab/install-main/j82, n2-lab/out/j76 j80 j81 a45 a46 a51 a52.
