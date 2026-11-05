# Navigation rail source review (md-navigation-rail, md-navigation-rail-tab)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
five source defects are fixed test-first and mirrored into
`packages/core/src`, and a browser reference (paint, interaction and
reduced-motion oracles) is captured. The oracle is **provisional**: it was
captured in headless Chromium 141 on Linux while the Mac runner was blocked,
and must be recaptured on the Mac (Chrome 153) and diffed. No native code
has changed.

## Public contract

### md-navigation-rail

| Property | Default and values |
|---|---|
| `variant` | `standard` \| `expanded`; mutable, reflected |
| `modal` | `false`; with `expanded`, the rail floats over content with a scrim |
| `fullHeight` (`full-height`) | `false`; stretches the host to the viewport height |
| `alignment` | `top` \| `middle` \| `bottom` (the destinations group) |
| `expandable` | `false`; renders the toggle (vertical only) |
| `toggleLabel` (`toggle-label`) | `'Toggle navigation'` |
| `labelVisibility` (`label-visibility`) | `all` \| `selected` \| `none`; propagated to tabs |
| `activeIndex` (`active-index`) | `−1` (none); mutable, reflected |
| `label` | `'Navigation'`: the landmark and tablist name |
| `disableFocusManagement` | `false` |
| `density` | `0` … `−4`, reflected |
| `orientation` | `vertical` \| `horizontal` (a top bar; `expandable` is ignored) |
| `maxVisible` (`max-visible`) | unset; extra destinations move into an overflow menu |
| `overflowLabel` / `overflowIcon` | `'More'` / `'more_horiz'` |

Methods: `expand()`, `collapse()`, `toggle()` and `focusTab(index)`.

Events, all void-cancelable with no veto:

* `mdTabChange {index, value}`, where `value` is the tab's `value` or `''`.
* `mdExpand` and `mdCollapse`, emitted from the `variant` watcher. They
  fire for the toggle, the methods, Escape and the scrim in modal mode, and
  direct `variant` writes.

A write to `activeIndex` is silent.

Slots: default (destinations), logo, logo-expanded, header, fab,
footer-leading, footer-content, footer.

Parts: scrim, container, logo, logo-contracted, logo-expanded, toggle,
header, fab, destinations, overflow, overflow-trigger, footer,
footer-profile, footer-leading, footer-content.

Keyboard (manual activation):

* Vertical: ArrowDown/Up move focus and wrap.
* Horizontal: ArrowLeft/Right follow the writing direction.
* Home and End jump to the ends. Enter or Space activates.
* In an expanded modal rail, Escape collapses and focuses the toggle.

Disabled destinations (`disabled` or `aria-disabled="true"`) are skipped.

Roles: the host is `role=navigation` named by `label`. The destinations
part is `role=tablist` with the same name, unless any destination is a link;
then it has no role, and link destinations are `role=link` with
`aria-current="page"`. The toggle is an `md-icon-button` with
`aria-expanded`. The overflow trigger is a button named `overflowLabel` that
opens an `md-menu` of the overflowed destinations; disabled destinations are
disabled rows (fix D).

### md-navigation-rail-tab

Properties: icon, label, active, disabled, badge (a dot), badgeValue, href,
target, value, labelVisibility, expanded (set by the rail) and density.

Events: `mdTabClick {value}` and `mdSubmenuToggle {open}`. Method:
`clearSubmenuSelection()`.

Slots: `icon` and `submenu`. An `md-menu` in `submenu` makes the tab
`aria-haspopup=menu` with `aria-expanded`, plus a caret.

Parts: indicator, label, icon-wrapper, icon, state-layer, caret, anchor
(badge parts undocumented, see drift).

The badge is a `role=status` reading "{value} new notifications", or "new
notifications" for a dot. It precedes the label in the name ("12 new
notifications Inbox").

## Layout reference (light theme, 560-high rail)

**Standard (collapsed):**

* The host is 80 wide (72 at −2, 64 at −4, 68 at local −3), with 44 top
  padding.
* Destinations are 80×56 (48 tall at −2 and −4), with gaps of 8, 4 and 0
  (2 at local −3).
* The indicator pill is 56×32 (48×28, 40×24), fully rounded, 2 below the
  tab top.
* The icon is 24 (22/20). The active icon is filled (`'FILL' 1`).
* The label is 12/16 (11/15, 10/14) under the pill. Weight 700 when active,
  500 when inactive.

**`labelVisibility`:**

* `selected` collapses inactive labels (height 0, opacity 0, margin −4) and
  centres their icons.
* `none` hides every label (`display:none`); the tabs get `aria-label`
  (fix C).

**Expanded:**

* The host is 220 wide (140 at −4), with a 360 maximum and 12 inline
  padding.
* Each tab is a pill that hugs its icon and label: 16 + 24 + 8 + label + 16,
  for example 107.2 for "Inbox", 56 tall.
* The label is 14/20.
* With `selected`, inactive tabs are 56×56 icon-only pills.

**Modal (expanded):** the host stays 80 in flow. The container floats at
220 wide over a 0.32 scrim, with surface-container `#F3EDF7`, elevation 3,
radius 16 and 44/12 padding.

**Slots:** logo 48 tall, toggle 48, FAB 56, and a profile footer with a
32 avatar plus a name. The name is shown only when expanded or horizontal.
Destinations start at least `header-space` (40) below the FAB.

**Horizontal:**

* The bar is 72 tall with 12 inline padding.
* Destinations are at least 80×72, centred in a row. The pill moves to the
  icon wrapper (56×32).
* The logo leads, the FAB follows it, and the footer trails.
* With fixes F and G, an absent logo takes no space and a FAB no longer
  pushes destinations out of the bar.

**Overflow:** `max-visible=3` shows three tabs plus an 80×56 "More" trigger
(80×72 when horizontal). Overflowed tabs are `display:none` with
`data-overflowed`.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Rail container (host) | surface `#FFFBFE` | `#1C1B1F` |
| Indicator | secondary-container `#E8DEF8` | `#4A4458` |
| Active icon | on-secondary-container `#1E192B` | `#E8DEF8` |
| Active label | secondary `#625B71` | `#CCC2DC` |
| Inactive icon/label | on-surface-variant `#49454F` | `#CAC4D0` |
| Badge | error `#B3261E` | |

Rail hooks paint as documented (`hooks-all-*`, `hook-rail-*`), with two
exceptions:

* `--md-navigation-rail-fab-size` only re-centres a slotted FAB; it does not
  resize it.
* `--md-navigation-rail-destinations-gap` is documented as defaulting to 4,
  but the measured default is 8 at density 0.

Tab hooks paint, except `--md-navigation-rail-tab-label-typography`, which
is unused (see drift).

## Interaction and motion reference

* State layer: .08 hover, .12 press, 150ms `cubic-bezier(.31,.94,.34,1)`.
  Colours, the icon fill and the pill background use the same timing.
* Ripple: .12, 450/150ms.
* **Expand and collapse:**
  * The host animates `inline-size`, `min-inline-size` and
    `max-inline-size` (80 ↔ 220) over 200ms, `cubic-bezier(.2,0,0,1)`.
  * The tabs run FLIP animations (indicator, icon wrapper, label) over 200ms
    with the same easing. The icon centre stays on x = 64 (LTR) throughout;
    only its vertical position moves (151 → 161).
  * Modal: the container grows from the rail edge and the scrim fades
    0 → .32 over 200ms. Escape and a scrim click reverse both.
* The toggle `md-icon-button` morphs its corners (emphasized-decelerate).
* Reduced motion:
  * The width and the FLIP animations are skipped.
  * With fix H, the tab's CSS transitions are removed, including the
    selected-label reveal and the horizontal pill.
  * The ripple and md-icon-button's own transitions remain; those are
    other components.

## Source defects fixed (test-first)

* **C. Unnamed destinations when the label is not rendered**
  (`md-navigation-rail-tab.tsx`). With `label-visibility="none"`, and with
  an expanded rail using `selected` for inactive tabs, the label is
  `display:none`. The tab had no name, because `aria-label` was only set for
  links.
  * Fix: `aria-label` falls back to `label` whenever the label isn't
    rendered. An author `aria-label` still wins.
  * Test: `md-navigation-rail-tab.accessible-name.e2e.ts` (3 tests).
* **D. The overflow menu selected disabled destinations**
  (`md-navigation-rail.tsx`). Overflowed disabled tabs became enabled menu
  rows, and choosing one selected the tab and emitted `mdTabChange`.
  * Fix: the rows carry `disabled`, and `selectOverflowed` refuses disabled
    destinations (`disabled` or `aria-disabled="true"`).
  * Test: `md-navigation-rail.overflow-disabled.e2e.ts` (1 test).
* **F. A horizontal rail drew an empty logo gutter**
  (`md-navigation-rail.css`). `:host(.--horizontal) .__logo { display:flex }`
  outranks `.__logo[hidden] { display:none }`, so without a logo a 16px
  wrapper plus the 12px gap pushed the destinations off the bar's start
  edge.
  * Fix: the horizontal rule is scoped to `:not([hidden])`.
  * Test: `md-navigation-rail.horizontal-logo.e2e.ts` (3 tests: LTR, RTL,
    and a slotted logo still shows).
* **G. A horizontal rail with a FAB hid its destinations**
  (`md-navigation-rail.css`). The vertical `inline-size: 100%` on the FAB
  wrapper survived in the bar's row. The wrapper took the whole bar (708 of
  720), and every destination and the footer were clipped past the end.
  * Fix: `inline-size: auto` in the horizontal FAB rule.
  * Test: `md-navigation-rail.horizontal-fab.e2e.ts` (2 tests, LTR and RTL).
* **H. Reduced motion did not reach the selected-label reveal or the
  horizontal pill** (`md-navigation-rail-tab.css`). The reduced-motion block
  used plain class selectors. The labels-selected rule (higher specificity)
  and the horizontal pill rules (same specificity, later in the file)
  re-declared their transitions. A selected-only label still grew over
  150ms (max-height and margin, pushing the icon), and the horizontal pill
  still faded.
  * Fix: the labels-selected selector joins the existing block, and a second
    reduced-motion block follows the horizontal rules.
  * Test: `md-navigation-rail-tab.reduced-motion.e2e.ts` (2 tests).

## Observed, not changed (decisions needed)

* **Mixed rails:** one `href` destination drops the tablist role for the
  group, but the remaining non-link destinations stay `role=tab` without a
  tablist.
* **Modal focus:** the expanded modal rail does not trap focus or make the
  page `inert`. Tab leaves the overlay while the scrim is up.
* **Direction:** RTL is resolved from the `dir` attribute
  (`resolveDirection`), not the computed `direction`.
* **FAB placement:** the JSDoc says horizontal places the "FAB and footer
  trailing", but the CSS (the header-space padding before the destinations)
  and the render order put the FAB leading, after the logo. Decide which is
  the contract.
* **Badge wording:** badge labels are hard-coded English, a text badge reads
  "New new notifications", and the badge precedes the label in the name.
* **Custom indicator height:** with `--md-navigation-rail-tab-indicator-height`
  set (36), the pill and the icon wrapper are 2px apart.
* **The `fab-size` hook** does not size the FAB.
* **Test flakiness:** the rail motion e2e frame-step tests ("anchors the
  icon…", "rapid reversal", "account footer motion") are load-sensitive on a
  2-CPU container. Different parameters fail on different runs, both before
  and after these fixes. In an interleaved A/B (motion subset), the
  original sources failed 1 of 3 runs and the fixed sources failed 0 of 1
  valid runs; two runs of the fixed sources were lost to dev-server startup
  timeouts. Serial runs of the full suite pass 37/37.

## CEM / source drift

* `--md-navigation-rail-horizontal-height` works but is missing from the
  CEM.
* `--md-navigation-rail-tab-label-typography` is in the CEM but no rule
  reads it.
* The rail-tab badge parts (`badge`, `badge-dot`, `badge-large`) are missing
  from the CEM.
* The CSS header says destinations-gap defaults to 4; the measured default
  is 8.

## Evidence

Oracle: `outputs/native-parity/md-navigation-rail/web-oracle-cloud/`:

* `paint.json`: 89 cases.
* `states.json`: 9 runs, including standard and selected labels × LTR/RTL,
  none, dark, modal, and horizontal LTR/RTL. Phases cover hover, press,
  keyboard, toggle expand/collapse, mid-flight reversal, `expand()`, Escape
  and the scrim.
* `states-reduced.json`.
