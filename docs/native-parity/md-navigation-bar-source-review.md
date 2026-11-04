# Navigation bar source review (md-navigation-bar, md-navigation-tab)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
one source defect is fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint, interaction and reduced-motion oracles) is
captured. The oracle is **provisional**: it was captured in headless Chromium
141 on Linux while the Mac runner was blocked, and must be recaptured on the
Mac (Chrome 153) and diffed. No native code has changed.


Native checkpoint (2026-10-30): the Mac Chrome 153 recapture replaced the provisional oracles (job n1-056); dedicated SwiftUI and
Compose renderers, the Laboratory integration and the accessibility evidence are verified — see
[md-navigation-bar.md](md-navigation-bar.md).
## Public contract

### md-navigation-bar

| Property | Default and values |
|---|---|
| `activeIndex` (`active-index`) | `0`; mutable, reflected |
| `labelBehavior` (`label-behavior`) | `always` \| `selected` \| `none`; inherited by tabs that leave theirs at the default |
| `manualActivation` (`manual-activation`) | `false`; when true, arrows move focus only |
| `density` | `0` … `−4`, reflected |

Methods:

* `select(index)` clamps to an enabled tab (forward first, then backward,
  or −1 when none is enabled) and announces the change.
* `focusTab(index)` focuses without selecting. It refuses hard-disabled
  tabs; soft-disabled tabs stay focusable.

One event, `mdChange {index, previousIndex}`. It bubbles, is composed and
cancelable, with no veto. It fires for pointer and Enter/Space activation,
automatic arrow/Home/End activation, `select()`, and **programmatic
`activeIndex` writes** (oracle: `programmatic:mdChange{1,0}`). It never fires
for the already-active index. The tabs' `mdTabClick {index}` is stopped at
the bar.

Keyboard:

* ArrowLeft/Right follow the visual direction and wrap. Home and End jump to
  the ends.
* Hard-`disabled` tabs are skipped. Soft-disabled tabs are reachable but
  never activated: no `mdChange` when focus lands on them, even in automatic
  mode.
* With `manualActivation`, Enter or Space activates. Space on the active tab
  emits `mdTabClick` only.

Roles: the host is `role=navigation` with no name of its own (set
`aria-label` on the element). The inner container is `role=tablist`. Tabs
are `role=tab` with `aria-selected` and roving tabindex, plus
`aria-disabled` for disabled and soft-disabled tabs.

### md-navigation-tab

Properties:

* active (mutable, reflected), disabled, softDisabled (`soft-disabled`)
* label, icon, activeIcon (`active-icon`)
* badge (a dot), badgeValue (`badge-value`), badgeMax (`badge-max`, default
  999, shown as "999+"; 0 means no cap)
* href and target: activation navigates unless an `mdTabClick` listener
  called `preventDefault()`
* labelBehavior: `always` \| `selected` \| `none`, mutable
* density

Method `focusEl()`. Event `mdTabClick {index}`. Slots: default (label),
`icon`, `active-icon`. Parts: container, icon-container, icon, badge, label,
state-layer, indicator.

The badge is a `role=status` whose `aria-label` is "{value} new", or "New"
for a dot. The status sits inside the tab, so the tab's accessible name
includes it ("3 new Mail").

## Layout reference (412-wide bar, 4 destinations)

The bar is 64 tall less 4 per density step (64/56/48). Destinations share
the width equally: 103 each with 4, 82.41 with 5, 80 at 320 wide, 200 at
800, 137.33 with 3.

* **Indicator:** a 56×32 pill (48×28 at −2, 40×24 at −4), fully rounded,
  centred, 5px from the top (4/3 at −2/−4).
* **Icon:** 24/22/20.
* **Label:** label-medium 12/16 (11 and 10 below that), 0.5px tracking.
  Weight 600 when active, 500 when inactive.
* **Gaps:** 6/4/2 between the indicator and the label.
* **`labelBehavior="none"`:** the icon centres vertically (indicator at
  y + 16), and the tab gets `aria-label`.
* **`labelBehavior="selected"`:** inactive labels keep their box and fade to
  opacity 0. Fix B keeps them in the accessibility tree.
* **Badges:** a large badge is 16 tall, from 16 wide up to the content
  ("999+" is 34.9), at the icon's top end. A dot is 6×6.
* **Long labels:** ellipsized at the tab width (120).
* **Local density:** `density="-3"` gives 52.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Bar container | surface-container `#F3EDF7` (on the host) | `#211F26` |
| Indicator | secondary-container `#E8DEF8` | `#4A4458` |
| Active icon | on-secondary-container `#1E192B` | `#E8DEF8` |
| Active label | on-surface `#1C1B1F` | `#E6E1E5` |
| Inactive icon/label | on-surface-variant `#49454F` | `#CAC4D0` |
| Badge | error `#B3261E` | `#F2B8B5` |

Disabled and soft-disabled tabs use host opacity .38
(`--md-navigation-tab-disabled-opacity`). There is no divider and no
elevation by default. The bar hooks (container colour, height, shape,
elevation, divider colour and width, z-index, default 200) and the tab hooks
all painted their sentinels (`hooks-all-*`, `hook-bar-*`, `hook-tab-*`).

## Interaction and motion reference

* Hover: state layer 0 → .08 over 100ms ease.
* Press: md-ripple .12, 450ms in and 150ms out.
* Focus: a 3px ring on the icon container (`::after`).
* Indicator:
  * the incoming pill scales `scale(0,1)` → `scale(1)` over 200ms,
    `cubic-bezier(.05,.7,.1,1)`;
  * the outgoing pill fades over 100ms ease and scales to 0 over 200ms.
* Host colour: 200ms emphasized-decelerate. The label colour on deselect
  changes over 100ms.
* Reduced motion: every tab transition is removed (`transition: none
  !important`). Only the ripple remains.

## Source defects fixed (test-first)

* **B. `labelBehavior="selected"` left inactive destinations without an
  accessible name** (`md-navigation-tab.css`). The hidden-label class used
  `visibility: hidden`, which removes the only text name from the
  accessibility tree. Screen readers announced unnamed tabs.
  * Fix: `.md-navigation-tab__label--hidden { opacity: 0 }` only. The visual
    is identical, the box was already reserved, and the name stays.
  * Test: `md-navigation-tab.accessible-name.e2e.ts` (2 tests: names via the
    accessibility snapshot, and the visual hiding is kept).

## Observed, not changed (decisions needed)

* **Badge wording.** Badge labels are hard-coded English ("new", "New") with
  no label property. A text badge doubles up: `badge-value="New"` reads
  "New new". The badge also precedes the label in the tab's name ("3 new
  Mail" rather than "Mail, 3 new").
* **Programmatic `activeIndex` writes emit `mdChange`;** md-tabs and
  md-navigation-rail do not emit for programmatic writes. The family is
  inconsistent, so pick one rule.
* **The `navigation` landmark has no default name.**
* **The bar's slotted minimum width (64px) is not density-aware.**
* **The label-hidden padding overrides the public padding hooks** when
  labels are hidden.

## CEM / source drift

Ten md-navigation-tab colour/state hooks work in the source but are missing
from the CEM: active-indicator-color, active-icon-color, inactive-icon-color,
active-label-color, inactive-label-color,
hover/focus/pressed-state-layer-color, badge-color and badge-on-color.

## Evidence

* Oracle: `outputs/native-parity/md-navigation-bar/web-oracle-cloud/`:
  * `paint.json`: 77 cases;
  * `states.json`: 7 runs (auto and manual activation × LTR/RTL, selected
    labels, dark, soft-disabled);
  * `states-reduced.json`.

## Decisions (autonomous, 2026-10-29 / 2026-10-30, reversible)

| Decision | Alternative | How to revert |
| --- | --- | --- |
| All 22 destination hooks of the stylesheet's documented list are exposed natively (the CEM lists 12); regenerating the CEM is a Web follow-up. | Expose only the CEM's 12. | Drop the extra fields from `AWCNavigationTabAppearance` and `navbar-appearance.js`. |
| `labelFont` is the CSS font shorthand: its weight is the inactive weight and its line height the label line; the size always comes from `labelFontSize`. | A family-only hook. | Parse only the family in both renderers and the Laboratory module. |
| The Material icon renders with FILL 0 in both states, as the source's font settings. | Fill the active icon. | Set FILL 1 for the active glyph in both renderers. |
| `zIndex` orders the bar within its native stacking context (default 200, `--md-sys-z-index-navigation`). | Ignore the hook natively. | Remove `.zIndex` / `Modifier.zIndex` from the bar. |
| A destination's own `labelBehavior` overrides the bar's only when authored (the source treats the attribute's presence as the override); generated defaults never override. | Treat any value as an override. | Read the property unconditionally in both renderers. |
| macOS exposes the host navigation landmark holding an unnamed tablist, as Chrome; iOS and Android have no landmark element (documented tools/ax expectations). | Expose only the tablist. | Replace the landmark bridge with the tab-group container in `NativeNavigationBar.swift`. |

