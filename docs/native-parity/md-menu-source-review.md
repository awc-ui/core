# Menu source review (md-menu, md-menu-item, md-sub-menu-item, md-menu-item-group)

Status: this is the Gate 1 checkpoint (Web source contract).

* The contract is inventoried.
* Nine source defects are fixed test-first and mirrored into `packages/core/src`.
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked. Recapture it on the Mac (Chrome 153)
and diff it before it gates native work.

No native code has changed, and this is not a native completion record.


Native checkpoint (2026-10-30): the Mac Chrome 153 recapture replaced the provisional oracles (job n2-001); dedicated SwiftUI and
Compose renderers, the Laboratory integration and the accessibility evidence are verified — see [md-menu.md](md-menu.md).
## Public contract

### md-menu (the popup)

| Property | Default and values |
|---|---|
| `open` | `false`; mutable and reflected. Never ship it in markup: positioning, dismissal and anchor ARIA are wired by the change handler. Open with `show()`. |
| `anchor` | `''`. The id of the trigger, looked up in the menu's own root node first, then in the document. With no anchor, the menu is an in-flow (embedded) menu. |
| `placement` | `bottom-start` \| `bottom-end` \| `top-start` \| `top-end`; reflected. **Physical**: `-start` means left, also in RTL (documented). |
| `quick` | `false`; skips the open and close animation. |
| `variant` | `baseline` (8px corners, surface-container) \| `standard` (16px, surface-container-low) \| `vibrant` (16px, tertiary-container). Reflected and propagated to rows as `data-variant`. |
| `layout` | `standard` \| `grouped`; ignored when `baseline`. |
| `useGap` (`use-gap`) | Turns groups into separate cards. Needs `standard` or `vibrant` plus `grouped`. |
| `emptyText` (`empty-text`) | `role=status` message shown when no visible row remains. |
| `matchAnchorWidth`, `responsive`, `persistent` | `responsive` means a compact window (≤600px): a full-width sheet 8px from each edge, below the anchor or above it when cramped. `persistent` means outside clicks and peer menus do not dismiss it. |
| `autoFocus` (`auto-focus`) | `true`; on open, focus goes to the first row. |
| `maxHeight` (`max-height`) | A number in px or any CSS length. It overrides `--md-menu-max-block-size` (250px). |
| `listbox` | Popup for a listbox owner. The surface becomes `role=presentation`, and the anchor gets `aria-haspopup=listbox` and no `aria-controls`. |
| `density` | 0 … −4 (local rung). |
| `listLabel` | Integration-only; it renders into no ARIA (documented). |

Methods: `show({autoFocus?})`, `close()` (150ms animation, then
`open=false`), `reposition()`, `whenClosed()`, `getScrollViewport()`, and
the picker hooks `setComboboxElement()` / `setVirtualProvider()`.

Events: `mdOpen` and `mdClose` are `bubbles:false, composed:false`, so
listen on the menu itself. `mdOpen` fires when `open` flips to true;
`mdClose` fires after the close animation, when `open` flips to false.

Slots are the default slot and `header` (pinned above the scroll area).
Parts are `surface`, `menu-viewport` and `empty-text`.

**Anchored menus use the top layer** (`popover=manual`) and stay in their
own tree. They are `position:fixed` at the anchor:

* 4px gap below, or above.
* A requested side that does not fit flips vertically and horizontally.
* The surface is always clamped 8px inside the viewport.
* While open, the menu tracks scroll, resize, its own size, and the
  anchor's rect every frame.

**Every non-inline-fill menu is capped and scrolls**, with or without a
submenu. The cap is `max-height`, or 250px by default (258 with padding),
further clamped to the chosen side. A cramped menu picks the side with more
room and scrolls.

A **closed** menu stays in the DOM with `aria-hidden=true` and `inert`.

### Keyboard, focus and dismissal

Roving focus on the rows:

* ArrowDown and ArrowUp wrap. Home and End jump to the ends.
* Disabled rows **are focusable**; they swallow activation.
* Typeahead uses a 500ms prefix buffer ("b", "l" → Blueberry), and repeating
  a letter cycles.

Escape closes the innermost popup and returns focus to its owner: the anchor
for a root menu, the row for a submenu (fix B).

Tab closes the whole tree, puts focus back on the anchor during keydown, and
does not prevent the default action. Sequential focus therefore moves on
from the anchor (oracle `tab-from-root` → `#next`, `shift-tab-from-root` →
the previous control).

Other dismissal:

* Outside click closes; `persistent` ignores it.
* Opening another non-persistent root menu closes this one.

Focus on open:

* An open by keyboard shows the ring on the first row.
* An open by pointer focuses it without a ring until a key is pressed.
* `show({autoFocus:false})` leaves focus on the anchor, and ArrowDown does
  not enter the menu (the owner drives it).

While the menu is open, it writes ARIA onto the anchor:

* `aria-haspopup` (`menu` or `listbox`);
* `aria-controls` (menu mode only);
* `aria-expanded`, but only for roles that support it (a native button,
  summary or link, or an explicit expandable role).

### md-menu-item

Properties:

* Text: headline, supporting-text, trailing-text.
* State: disabled, selected (mutable), indeterminate (mutable), keep-open.
* Layout: divider (1px rule below), gap (baseline only; space below).
* Content and mode: badge (`' '` is a dot, text is a count), `type` (button
  \| checkbox \| radio), `check-position` (start \| end), presentation
  (`menuitem` \| `option`), role-override (integration only), density.

Event: `mdClick`. Slots: `leading-icon` and `trailing-icon` (it replaces
trailing-text). There is no default slot.

Roles:

* `menuitem`, `menuitemcheckbox` (with `aria-checked`, `mixed` when
  indeterminate), or `menuitemradio`;
* `option` with `aria-selected` when presentation is `option`.

The item self-toggles `selected` on click. A radio deselects only radios of
the **same menu and the same group** (fix E).

Activation closes the whole tree and restores focus to the root anchor,
resolved in the root menu's own tree (fix D), unless `keep-open` is set.

Enter re-dispatches a click. Space on a checkbox or radio row toggles
without closing, even without `keep-open` (documented). Space on a button
row clicks and closes.

### md-sub-menu-item

Properties: headline, supporting-text, disabled, divider, gap, badge,
`open-delay` (100) and `close-delay` (400), density. It has `mdClick` and
`collapse()`, and the nested `md-menu slot="submenu"` has no anchor.

Row semantics: `role=menuitem` with `aria-haspopup=menu` and a live
`aria-expanded`.

Opening and closing:

* Hover intent opens after `open-delay` and closes after `close-delay`. The
  close also waits for the flyout's own 150ms close.
* Keyboard: the open keys are ArrowRight, Enter and Space; the close keys are
  ArrowLeft and Escape. The arrows **swap in RTL** (fix C). The keyboard
  never waits.
* Only keys pressed on the row itself open it (fix A).
* Opening one row collapses its siblings.
* A click only emits `mdClick`; it never opens the flyout.

Flyout placement:

* The flyout is fixed beside the row, top-aligned: x = row right edge in LTR,
  or row left minus flyout width in RTL.
* It flips to the other side at the viewport edge (`submenu-flip-at-edge`:
  875 = 1000 − 124.7), and bottom-aligns when it would overflow.

The row reads **no** `--md-menu-item-*` hooks (documented). Its box model
otherwise matches md-menu-item's (fix H).

### md-menu-item-group

`label` and `density`. The host is `role=group` with `aria-label` = label,
and the label is drawn as a header. With `standard`/`vibrant` plus
`grouped` plus `use-gap`, each group becomes a 12px-radius card.

## Layout reference (DPR 1, Roboto, light theme)

* **Rows:** 48 / 40 / 32 at density 0 / −2 / −4.
* **Inline padding:** 12 (8 at −4).
* **Gap:** 12 in baseline, 8 in standard/vibrant.
* **Leading icon:** 24 in baseline and 20 in standard/vibrant, tapering
  1px per rung (floors 18 / 16).
* **Check glyph:** 20, with the same taper. Headline is body-large 16/24 400;
  supporting text is body-medium.
* **Surface:** 4px block padding; minimum width 112, maximum 280. The
  canonical 9-row menu is 153.9 wide in baseline and 157.4 in
  standard/vibrant (rows 149.4, with 4px inline inset).
* **Corners:** baseline surface 8, rows square. Standard/vibrant surface 16;
  first row's top corners 16, other rows 8, a selected row 12. Hover and
  press morph the corners (300ms emphasized-decelerate).
* **Grouped:** groups stack inside one surface. With `use-gap`, the surface
  goes transparent and each group is a 12-radius card with 4px padding and a
  4px gap (`--md-menu-group-gap`).
* **Placement:** the menu sits 4px off the anchor.
  * `bottom-end` aligns right edges: x = anchor right − width (422.1 for a
    576 right edge).
  * Flips: `top-start` with no room above opens below (`flip-top-to-bottom`,
    y = 58); `bottom-start` near the bottom edge opens above
    (`flip-bottom-to-top`, bottom at 796 = anchor top − 4); `start` and
    `end` swap at the side edges. The transform origin follows the side
    chosen.
  * The `clamp-both-sides-short` case (420px viewport) caps the menu to the
    roomier side: 348 high at y = 8.
* **Responsive (≤600px):** width = viewport − 16 (384 at 400), x = 8; the
  menu sits above the anchor when the bottom is cramped.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Baseline surface | surface-container `#F3EDF7` | `#211F26` |
| Standard surface | surface-container-low `#F7F2FA` | `#1D1B20` |
| Vibrant surface | tertiary-container `#FFD8E4` | `#633B48` |
| Row text | on-surface `#1C1B1F` (vibrant on-tertiary-container `#370B1E`) | `#E6E1E5` (vibrant `#FFD8E4`) |
| Leading icon | on-surface-variant `#49454F` | `#CAC4D0` |
| Selected row, baseline | secondary-container `#E8DEF8` | `#4A4458` |
| Selected row, standard | tertiary-container `#FFD8E4` / `#370B1E` | `#633B48` / `#FFD8E4` |
| Selected row, vibrant | tertiary `#7D5260` / white | `#EFB8C8` / `#492532` |

Shadows:

* Baseline: elevation 2 (`0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)`).
* Standard and vibrant: `0 1px 3px rgba(0,0,0,.12), 0 4px 8px 3px rgba(0,0,0,.08)`.
* Grouped cards with a submenu: a box-shadow on each card. Without a submenu:
  drop-shadow filters on the surface.

State layer: hover .08, press and focus .12, plus a ripple.

## Interaction and motion reference

* **Open:** the surface animates `opacity 0→1` and `transform scaleY(.8)→none`
  over 150ms, emphasized-decelerate `cubic-bezier(.05,.7,.1,1)`. The
  transform origin is on the anchor side.
* **Close:** reversed, 150ms emphasized-accelerate `cubic-bezier(.3,0,.8,.15)`.
  `open` flips after 150ms.
* **Reduced motion** (fix F): the surface has 0s transitions and no
  transform in every state. The row state layer (100ms) and the ripple still
  run.
* **Hover:** state layer 100ms standard. **Press:** ripple 450ms press, 150ms
  release.
* **Submenu hover:** the flyout opened ≈133ms after the pointer settled
  (100ms delay plus frames). It closed ≈583ms after the pointer left (400ms
  delay plus the 150ms flyout close plus frames). The caret rotates 90°
  over 100ms while the flyout is open.
* **Event order:**
  * Item click: `mdClick` (item), then `mdClose` (menu) after 150ms; focus
    lands on the anchor.
  * Keyboard open: `mdOpen` fires, then focus moves to the first row.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix.

* **A. Keys inside an open flyout re-triggered the row** (`md-sub-menu-item.tsx`).
  The nested menu is a light-DOM child of its row, so ArrowRight, Enter and
  Space pressed on a flyout item bubbled through the row's keydown, which ran
  `openSubmenu(true)` again. Focus snapped back to the first flyout item and
  the row rippled. Space on a flyout checkbox both toggled the box and
  re-opened the flyout.
  * Fix: the open keys act only when `e.target` is the row.
  * Test: `md-sub-menu-item.keyboard.e2e.ts` (ArrowRight keeps focus on
    "Link"; Space toggles "Copy" with no row ripple and no row-own `mdClick`).
* **B. Escape inside a submenu stranded focus on `<body>`** (`md-menu.tsx`).
  The nested md-menu closed itself and tried to restore focus to its
  (absent) anchor, and the row kept `aria-expanded=true`.
  * Fix: a submenu (no anchor, `slot=submenu`, parent row) leaves Escape to
    its row, which closes the flyout, clears `aria-expanded` and focuses
    itself.
  * Test: keyboard suite, "Escape inside the submenu…".
* **C. RTL did not mirror the submenu keys** (`md-sub-menu-item.tsx`). The
  flyout opens to the left in RTL, but ArrowRight still opened it.
  * Fix: the open and close keys are chosen from the resolved direction.
    Readme updated.
  * Tests: keyboard suite, RTL plus an LTR guard. **This is a behaviour
    change.**
* **D. Focus restore missed an anchor inside a shadow root**
  (`md-menu-item.tsx`). Activation looked up the root anchor with
  `document.getElementById`.
  * Fix: look it up in the root menu's root node first, then the document
    (the same rule `anchor` uses).
  * Test: `md-menu-item.scope.e2e.ts` (a custom element hosting trigger and
    menu).
* **E. Radio exclusivity leaked across menus and groups** (`md-menu-item.tsx`).
  A radio deselected radios inside nested submenus and in other groups.
  * Fix: siblings must share the same closest menu **and** the same group,
    where a group counts only if it is inside that menu.
  * Test: scope suite (root, submenu and group radios stay independent).
* **F. The surface ignored reduced motion** (`md-menu.css`).
  * Fix: a `prefers-reduced-motion` block removes the transition and transform
    on the surface in its closed, open and closing states.
  * Test: `md-menu.reduced-motion.e2e.ts`, plus a guard that the standard
    motion is unchanged (0.15s).
* **G. The menu had no accessible name** (`md-menu.tsx`). `aria-labelledby`
  on the shadow surface pointed at a light-DOM id it cannot reach, so the
  name was "".
  * Fix: where element reflection exists, set
    `surface.ariaLabelledByElements = [anchor]` while open in menu mode
    (cleared on close and in listbox mode); otherwise keep the IDREF.
    Readme updated.
  * Test: `md-menu.accessible-name.e2e.ts` (name "Actions" after open and
    after reopen; listbox mode unaffected). In the oracle, every `role=menu`
    is named after its anchor.
* **H. Submenu rows sat off their siblings' column**
  (`md-sub-menu-item.css`). The row used gap-sm (8) where md-menu-item uses
  gap-md (12), so its headline was 4px left of the column. It also kept
  24px icons where the standard and vibrant variants tighten to 20px with an
  8px gap.
  * Fix: gap-md, and the same variant overrides.
  * Test: `md-sub-menu-item.alignment.e2e.ts` (3 variants × density 0 / −4:
    height, padding, gap, icon and headline x are equal).
* **I. The vertical variants ignored the `--md-menu-item-gap` hook**
  (`md-menu-item.css`). A hard `gap: 8px` beat the documented hook.
  * Fix: `gap: var(--md-menu-item-gap, 8px)`.
  * Test: `md-menu-item.gap-hook.e2e.ts` (the hook wins in all three
    variants; the defaults are unchanged).

## Observed, not changed (decisions needed)

* **Anchor `aria-controls` is a dangling IDREF.** It names the surface id,
  which lives in the menu's shadow root, and an IDREF from light DOM cannot
  reach into a descendant shadow root. Element reflection cannot express it
  either, because a reference into a descendant shadow tree is not exposed.
  Options:
  * drop `aria-controls`;
  * point it at the host and move `role=menu` to the host (a larger change).
* **Submenu rows ignore `--md-menu-item-*` hooks** (documented in their
  readme). A consumer who sets `--md-menu-item-height: 56px` on the menu gets
  56px rows next to a 48px submenu row. Adopting the hooks is a contract
  change.
* **`placement` is physical in RTL** (documented). M3 and the native
  platforms are logical.
* **Disabled rows take focus** (APG allows it). The oracle `keyboard-nav-*`
  lands on "Paste".
* **The submenu caret rotates to point down** while the flyout opens to the
  side. This is a design check against M3, whose caret stays pointing at the
  flyout.
* **Space on a checkbox or radio row never closes**, even without
  `keep-open`, while a click does (documented asymmetry).
* **`:host-context([dir=rtl])` is Chromium-only.** In Firefox and Safari, the
  submenu caret flip for a `dir` set on an ancestor does not apply; the
  `:host([dir])` rule covers only a dir set on the row itself.

## Docs and source drift

* The md-menu and md-sub-menu-item readmes say a menu containing a submenu
  does not scroll and that `max-height` has no effect. The code caps and
  scrolls every menu (`scrollCapped = !inlineFill`), and the flyout is
  `position:fixed`, so it is not clipped. The oracle case
  `default-cap-rich-with-submenu` is 258 high and scrolls.
* The `md-menu.css` header says "Parts: (none)", but `surface`,
  `menu-viewport` and `empty-text` exist (the readme is right).
* The md-menu readme says `aria-labelledby` points at the anchor. It was
  updated with fix G.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch):
  * Family baseline: 20 suites / 485 tests, all passing.
  * After the fixes: 28 suites / 511 tests across the menu and stepper
    families.
  * Family plus dependents: see the Gate 1 report and
    `outputs/native-parity/md-menu/source-tests/`.
* **Oracle:** `outputs/native-parity/md-menu/web-oracle-cloud/` (see its
  README).
  * `paint.json`: 138 cases.
  * `states.json` and `states-reduced.json`: 26 runs each.

## Decisions (autonomous, 2026-10-27, reversible)

Each "decision needed" above was settled for the Web source contract and the MD3 behaviour it documents. None of them changes Web output. To revert one, change the native renderers named here; the Web side is unchanged.

| Observation | Decision | Native consequence | Alternative and how to revert |
| --- | --- | --- | --- |
| Anchor `aria-controls` names an id inside the menu's shadow root (dangling IDREF) | Keep the Web markup unchanged. It is harmless to AT that ignores unresolved IDREFs. The anchor still exposes `aria-haspopup` / `aria-expanded`. | SwiftUI and Compose expose the anchor's expanded state and the popup relationship. There is no "controls" relation, because no cross-tree IDREF exists. | Drop `aria-controls` in `updateAnchorAria()` (test-first: assert the attribute is absent), or move `role=menu` to the host. Native needs no change. |
| Submenu rows ignore the `--md-menu-item-*` hooks | Keep. This is the documented contract of md-sub-menu-item. | `AWCMenuRowMetrics(sub: true)` ignores the item hooks, so submenu rows keep 48/40/32, 12 padding, 12 gap and 24/20 icons. | Read the hooks for `sub` rows in `AWCMenuRowMetrics` and in the Compose metrics, and adopt them in md-sub-menu-item.css. |
| `placement` is physical in RTL | Keep. This is the source contract (`start`/`end` = left/right). | Both renderers resolve `start`/`end` physically, matching `positionMenu()`. | Swap `horizontal` when the menu is right-to-left, in `AWCMenuSurfacePlacement.resolve` and in the Compose placement. |
| Disabled rows take focus | Keep. APG allows it, and the oracle `keyboard-nav-*` lands on "Paste". | The roving order includes disabled rows (`_menuRoving` focus policy). | Filter disabled rows out of `rowOrder` / the Compose roving list. |
| The submenu caret rotates to point down while the flyout opens to the side | Keep. This is the source rendering. | `arrow_right` rotates 90° over 100 ms (standard easing) and mirrors in RTL. | Drop the rotation in both renderers. |
| Space on a checkbox or radio row never closes, even without `keep-open` | Keep. This is a documented asymmetry with click. | Space toggles or selects, emits `mdClick`, and leaves the menu open. Enter and click close it unless `keep-open`. | Route Space through the click path. |
| `:host-context([dir=rtl])` is Chromium-only | No native impact: native renderers read the inherited layout direction. Web cross-browser behaviour is outside the native gate and is recorded here. | Not applicable. | Reflect the resolved direction onto md-sub-menu-item from JS. |

### Decisions (autonomous, 2026-10-30, reversible) — native accessibility and lifecycle

| Observation | Decision | Native consequence | Alternative and how to revert |
| --- | --- | --- | --- |
| A menu whose `open` is already true when it loads skips `onOpenChange` (Stencil runs no `@Watch` for an initial value): no anchor ARIA, no focus move, no outside-click / Escape listeners until it is closed and reopened | Treat as a source gap; the native renderers open it like a later `open = true`. | An initially open menu focuses its first row (auto-focus), names itself and dismisses on outside clicks. | Mirror the Web gap (skip the open tasks for the initial value) in `AWCNativeMenu.sync` / the Compose `LaunchedEffect(model.open)`; or fix the source test-first (run `onOpenChange(true)` from `componentDidLoad` when open). |
| `updateAnchorAria()` sets `aria-expanded` only on anchors whose own role supports it; the md-button host is roleless, so a button-like trigger never reports its expanded state | Keep the Web rule; natively the anchor is the platform button itself, which the rule covers. | macOS AXExpanded and iOS value Expanded / Collapsed on `AWCNativeActionControl` anchors; Android expand / collapse actions on md-button / md-icon-button anchors (open and close the menu). tools/ax expectation. | Drop `mdMenuRegistry?.anchorExpanded(id)` in `NativeActionControl.swift` and `nativeMenuAnchorSemantics` in `NativeButton.kt` / `NativeIconButton.kt`; or give the md-button host `role="button"` on the Web. |
| The surface is named after its anchor on every open (`ariaLabelledByElements`), but Chrome 153 reports the name only when focus moves into the menu | Keep the source intent: the native menu always carries its anchor's name (an anchor's `aria-label`, `label` or text). | macOS AXMenu label, Android pane title, iOS container label; flyouts take their submenu row's name. tools/ax expectation (auto-focus off). | Leave the native menu unnamed while focus stays on the anchor (not recommended). |
| With auto-focus off the first row is the roving Tab stop (`initRovingTabindex`), but Chrome 153 tabs from the anchor out of the page without entering the top-layer surface | Keep the source's roving tabindex: natively the first row is the next Tab stop after the anchor. | Tab inside the menu still closes it and returns to the anchor, as on the Web. tools/ax expectation. | Keep rows out of sequential focus until focus is inside the menu (`focusedID = nil` in `AWCMenuController.show` and the Compose controller). |

