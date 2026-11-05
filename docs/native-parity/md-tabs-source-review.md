# Tabs source review (md-tabs, md-tab, md-tab-panels, md-tab-panel)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
two source defects are fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint, interaction and reduced-motion oracles) is
captured. The oracle is **provisional**: it was captured in headless Chromium
141 on Linux while the Mac runner was blocked, and must be recaptured on the
Mac (Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.


Native checkpoint (2026-10-30): the Mac Chrome 153 recapture replaced the provisional oracles (job n1-056); dedicated SwiftUI and
Compose renderers, the Laboratory integration and the accessibility evidence are verified — see [md-tabs.md](md-tabs.md).
## Public contract

### md-tabs (the tablist)

Six properties:

| Property | Default and values |
|---|---|
| `activeTabIndex` (`active-tab-index`) | `0`; mutable, **not reflected** |
| `variant` | `primary` \| `secondary`; reflected, stamped onto every child tab |
| `divider` | `full` (host `::after`, 1px across the whole strip) \| `auto` (each tab draws its own segment) |
| `ariaLabelProp` (attribute `aria-label`) | `''`; falls back to the literal `"tabs"` |
| `tabWidth` (`tab-width`) | `equal` (share the width) \| `auto` (content width, strip scrolls) \| any CSS length |
| `width` | `''` (100% of the parent) or any CSS size for the whole strip |

One method, `selectTab(index)`: it ignores an out-of-range index, then
activates and emits like a click. One event, `mdTabChange {index,
previousIndex}`. It bubbles, is composed and cancelable, and nothing reads
the veto. It fires for:

* pointer, Enter or Space on a tab (always after that tab's `mdTabClick`);
* arrow keys, Home and End (automatic activation: focus follows selection);
* `selectTab()`;
* reconciliation when the active element is removed (`{index, previousIndex}`
  of the replacement), and `{index: -1}` when every tab becomes disabled.

A write to `activeTabIndex` is **silent** (no event). It clamps NaN and floats,
skips disabled tabs (next enabled, wrapping), remembers an index past the end
until that tab registers ("append and select"), and is fully reactive: active
state, roving tabindex and scroll all follow. Re-activating the active tab
does nothing.

Keyboard on the tablist: ArrowLeft/Right follow the visual direction (in RTL,
ArrowRight goes to lower indexes), wrap, and skip disabled tabs. Home and End
go to the first and last enabled tab. The handler reads `composedPath()[0]`,
so it works inside closed shadow roots. It ignores modifiers (see open
decisions). Exactly one tab has tabindex 0.

Roles: the host is `role=tablist` with `aria-orientation=horizontal` and
`aria-label`. Each tab is `role=tab` with `aria-selected`, plus
`aria-disabled` when disabled.

Overflow: the strip scrolls horizontally with a hidden scrollbar. Edge fades
mark clipped tabs, using physical geometry, so they are RTL-safe. A vertical
wheel scrolls the strip instantly. Activation scrolls the minimum distance
that reveals the tab (nearest edge), smoothly, or instantly under reduced
motion. Example: tab 7 of 8 in a 300px strip ends flush with the end edge,
at scrollLeft 513 (−513 in RTL).

### md-tab

Eight properties: label, icon, active (mutable, reflected, parent-managed),
disabled (reflected), inlineIcon (`inline-icon`), variant (parent-managed),
badge (`string | undefined`: an empty string is a dot, text is a large badge),
controls (becomes `aria-controls`), and density (0 to −4, reflected).

One event, `mdTabClick` (no detail), on click, Enter and Space. Slots:
`icon` (rendered only when the tab has an icon at first render) and `badge`.
Parts: state-layer, content, icon, label, indicator, divider.

Anatomy is derived:

* **stacked**: icon and label without `inline-icon`;
* **inline**: `inline-icon` with both;
* **icon-only**: no label.

A development build warns when a tab with an icon has no accessible name.

The accessible name includes the badge: "Inbox 12", and "Updates
notification" for a dot.

### md-tab-panels and md-tab-panel

`md-tab-panels` has two properties:

* `for`: the id of an `md-tabs`. When empty, it uses the nearest preceding
  `md-tabs` sibling.
* `sizing`: `stable` (the default) or `active`, reflected.

It wires the APG contract both ways. Each tab gets `aria-controls`, each panel
gets `aria-labelledby`, and missing ids are generated
(`md-tab-panels-<hash>-panel-N`).

`md-tab-panel` has `active` (reflected) and is `role=tabpanel`. The active
panel has tabindex 0; inactive ones have tabindex −1 and `inert`.

* With `stable`, every panel stays in one grid cell, so the region keeps the
  largest panel's box: 294×54 for the reference case, with all three panels
  laid out.
* With `active`, inactive panels are `display:none` (0×0).

The panel's accessible name is the tab label.

## Layout reference (DPR 1, Roboto, light theme)

Tab height is 48 (label, inline, icon-only, and every secondary tab) or 64
(primary stacked), less 4 per density step: 48/40/32 and 64/56/48 at
density 0/−2/−4.

* Minimum width is max(48, 90 + 8·d): 90/74/58.
* Inline padding is max(8, 16 + 2·d): 16/12/8.
* With `tab-width="equal"` the strip divides its width: three tabs in 480 are
  160 each, and three in 320 (via `width`) are 106.67.
* With `auto`, tabs hug their content, never below the minimum: "Flights" is
  90 and "Destination N" is 116.13.
* A fixed length applies exactly, for example 140.

Label: title-small, max(…) 14/20 → 13/18 → 12/16, weight 500, ellipsized.
Icon: 24/22/20. A stacked primary tab puts the icon at y = 6.5/4.5/2.5 inside
the tab. Inline icons sit 9.5/6.5/3.5 from the top.

**Primary indicator:** 3px tall at the tab's bottom edge, with fully rounded
top corners and square bottom corners.

* It spans the content: the label (32.14 for "Trips"), the icon and label
  for inline tabs (64.14), or the icon only, with a minimum of 24, for
  icon-only tabs.
* Inactive tabs keep a parked indicator (opacity 0, `scaleX(.88)`) under
  their own content.

**Secondary indicator:** 2px, the full tab width, radius 2 on the top
corners.

**Divider:** 1px. With `full` it is the host `::after` across the whole
strip; with `auto` each tab draws its own segment.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Primary active label/icon/indicator | primary `#6750A4` | `#D0BCFF` |
| Secondary active label | on-surface `#1C1B1F` | `#E6E1E5` |
| Inactive label/icon | on-surface-variant `#49454F` | `#CAC4D0` |
| Divider | outline-variant `#CAC4D0` | `#49454F` |
| Badge | error `#B3261E`, on-error text, 10px/500; dot 6×6 | |
| Disabled content | on-surface at 38% (`color-mix`) | |

Container: `--md-tab-container-color` defaults to transparent. The state layer
uses the current colour at .08 for hover and .12 for press and focus. The
focus ring is a 3px secondary (`#625B71`) outline, offset −3, on the host.

CSS hooks: on md-tab, container, active-label, inactive-label, active-icon,
inactive-icon and active-indicator colours, active-indicator height and
divider colour; on md-tabs, container and divider colour. Every hook painted
its sentinel in the oracle (`hook-tab-*`, `hook-tabs-*`, `hooks-*`).
`--md-tab-glide-*` are runtime internals that the CEM lists as public (drift).

## Interaction and motion reference

* Hover: state layer 0 → .08 over 50ms, `cubic-bezier(.2,0,0,1)`.
* Press: md-ripple wave .12, press-in 450ms, release fade 150ms.
* Colour: label/icon colour 200ms standard.
* **Glide** (primary and secondary):
  * The incoming indicator starts at the outgoing one's box, using
    `translateX(Δ) scaleX(w₀/w₁)` (for example `matrix(1.035,0,0,1,−240,0)`
    from tab 0 to tab 2).
  * It animates to identity over 400ms, `cubic-bezier(.05,.7,.1,1)`.
  * The outgoing indicator fades 1 → 0 over 200ms and parks at
    `scaleX(.88)`.
* Reduced motion: the indicator and state-layer transitions drop to 0.01ms,
  so there is no glide. Colour transitions (200ms) and the ripple still run.
* Event order on click: `mdTabClick` (tab), then `mdTabChange` (tablist), in
  the same task.
* Programmatic `activeTabIndex = 2`: the indicator glides and the panels
  follow (fix A). Focus stays where it was, and no event fires.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix.

* **A. Panels ignored programmatic selection** (`md-tab-panels.tsx`).
  md-tab-panels followed only `mdTabChange`, which a write to `activeTabIndex`
  never fires. The framework-wrapper path left the old panel showing.
  * Fix: the region also observes the `active` attribute that md-tabs stamps
    on every path (a MutationObserver on the tabs' subtree, with
    `attributeFilter: ['active']`), and disconnects it on unwire.
  * Test: `md-tab-panels.programmatic.e2e.ts` (3 tests: a property write,
    an `active-tab-index` attribute write, and the click path still
    following).
* **E. md-tabs flattened density on the tab's minimum width** (`md-tabs.css`).
  `::slotted(md-tab) { min-inline-size: 90px }` from the outer scope beat the
  tab's own density-aware `max(48px, 90px + d·8px)`, so dense tabs stayed 90
  wide.
  * Fix: the slotted rule keeps only `flex: 1`.
  * Test: `md-tabs.density.e2e.ts` (5 tests: d0/−1/−2/−4 = 90/82/74/58, and
    a `data-density` ancestor at −3 = 66).

## Observed, not changed (decisions needed)

* **Secondary tabs with icon and label overflow their 48px host.** The 64px
  stacked height is scoped to primary (`md-tab--stacked.md-tab--primary`), so
  a secondary stacked tab crams the icon and label into 48. At density 0 the
  label sits on the indicator. At −4 the icon starts 3px above the tab and the
  label is cut by the divider (oracle `matrix-secondary-stacked-*`, icon
  y = 1/−1/−3). Two fixes are possible: give secondary stacked tabs 64px, or
  force secondary icons inline as M3 secondary tabs show them. This is a
  design call, so it is not fixed.
* **Mixed anatomy in one strip** (label-only next to stacked): tabs keep
  their own heights (48 against 64), so the indicators sit at different
  baselines. The readme's Do/Don't forbids this; the source does not guard
  against it.
* **Arrow keys ignore modifiers**: Alt+ArrowLeft/Right (browser Back/Forward on
  Windows and Linux) is swallowed and changes the tab.
* **The default `aria-label` is the literal English "tabs".**
* **md-tab colour transitions survive reduced motion.** The md-tab block
  removes only indicator and state-layer motion. Colour fades are not motion
  in the WCAG sense, so this is acceptable, but it differs from the
  navigation tabs, which remove everything.
* **Programmatic selection never emits**, while md-navigation-bar emits
  `mdChange` for programmatic `activeIndex` writes. The family is
  inconsistent.

## CEM / source drift

`--md-tab-glide-duration`, `--md-tab-glide-x` and `--md-tab-glide-scale` are
listed as public CSS properties, but they are written by md-tabs at runtime.
The iOS `ComponentCatalog` lacks md-tab `badge` (the CEM has it).

## Evidence

* Source tests (Linux Chromium 141, Stencil 4.44.0 with the repo patch):
  family plus dependents, before and after. Totals are in the Gate 1 report
  (`outputs/native-parity/md-tabs/source-tests/`).
* Oracle: `outputs/native-parity/md-tabs/web-oracle-cloud/` (see its README):
  * `paint.json`: 135 cases, each with a clipped screenshot, a full
    part/computed-style tree and an accessibility snapshot;
  * `states.json`: 6 runs × 10 phases with per-frame samples;
  * `states-reduced.json`: the same runs under `prefers-reduced-motion`.

## Decisions (autonomous, 2026-10-29 / 2026-10-30, reversible)

| Decision | Alternative | How to revert |
| --- | --- | --- |
| Secondary stacked tabs stay 48 px tall (icon and label overflow as on Web). | Grow secondary stacked tabs to 64 px. | Change the secondary height rule in the stylesheet and both renderers together. |
| Arrow keys with a modifier are ignored, the default tablist name is "tabs" and `activeTabIndex` writes are silent, as the source. | Announce programmatic writes; rove on modified arrows. | Emit `mdTabChange` on writes / drop the modifier guard in all three implementations. |
| md-tab colour transitions still run under reduced motion (the glide and the state-layer fades do not), as the source's `prefers-reduced-motion` rules. | Remove every transition. | Gate the colour tracks on reduced motion in `NativeTabs.swift` / `AWCTabs.kt`. |
| The active md-tab-panel is not a separate Tab stop natively (Web gives it `tabindex=0`); its content stays reachable. | Make the panel itself focusable. | Add a focus bridge to the active panel in both renderers. |
| md-tab-panels without `for` follows the nearest preceding md-tabs (SwiftUI: the sibling through the parent renderer; Compose: the md-tabs composed most recently before it). | Require `for`. | Remove the fallback lookup in both renderers. |
| iOS simulator harness: the first 50 ms after a key are not compared (the key reaches the app through the HID queue a frame or two later; 30 ms elsewhere). | Compare from 30 ms on iOS too. | Change the lead in `NativeTabsStatesIntegration.swift`. |

