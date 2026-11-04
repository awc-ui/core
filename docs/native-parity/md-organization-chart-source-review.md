# Organization chart source review (md-organization-chart)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
seven source defects are fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint matrix, per-frame fold/selection/press and
keyboard runs, reduced motion) is captured. The oracle is **provisional**: it
was captured in headless Chromium 141 on Linux while the Mac runner was busy,
and must be recaptured on the Mac (Chrome 153) and diffed before it gates
native work. No native code has changed. This is not a native completion
record.

## Public contract

**Props.**

* `nodes` (`OrgChartNode[]` property, or a JSON string attribute; invalid
  JSON or a non-array/non-object gives an empty tree; a single object is
  wrapped). Several roots render side by side.
* `OrgChartNode`: `id`, `name` (required); `title`, `avatar` (image URL),
  `avatarInitials`, `accent` (CSS colour), `expanded` (`false` seeds the
  branch folded), `selectable` (`false` exempts it), `children`. A node with
  `children: []` is a leaf (no toggler, never toggles).
* `selectionMode` (`none` | `single` | `multiple`, reflected; default
  `none`), `selectedIds` (mutable, property only, insertion order kept).
* `collapsible` (default `true`; `false` locks every branch open, CH3).
* `orientation` (`vertical` | `horizontal`, reflected).
* `label` (tree name, "Organization chart"), `expandLabel` ("Expand"),
  `collapseLabel` ("Collapse").
* `density` (0 … −4, reflected; overrides an inherited `data-density`).

**Events** (Stencil defaults: `bubbles`, `composed`, not cancelable):

* `mdSelectionChange {node, selectedIds}`: user selection only (click,
  Enter, Space). `node` is the whole node object (with its children);
  `selectedIds` is the new array, already written to the prop. Controlled
  `selectedIds` / `nodes` changes emit nothing.
* `mdNodeToggle {node, expanded}`: user fold/unfold only (toggler click,
  Arrow forward on a folded parent, Arrow backward on an open parent,
  Enter/Space on a parent that cannot be selected). Never fires with
  `collapsible="false"`.

**Methods.** None. **Slots.** `empty` (replaces "No data" when `nodes`
resolves to an empty list; the empty container is `role="status"`).

**Parts.** `viewport`, `tree`, `group`, `branch`, `branch-on-path`, `node`,
`node-selected`, `state-layer`, `avatar`, `avatar-image` (exported from
`md-avatar`), `name`, `title`, `toggle`, `empty`.

**CSS hooks** (15): `--md-org-chart-connector-color` (outline-variant),
`-connector-width` (1.5px), `-node-color` (surface-container-low),
`-node-outline-color` (outline-variant), `-node-outline-width` (1px),
`-node-shape` (corner-medium 12px), `-node-min-width` (176px),
`-node-max-width` (260px), `-selected-color` (primary),
`-focus-ring-color` (secondary), `-state-layer-color` (on-surface),
`-toggle-size` (max(20, 24 + d)), `-level-gap` (max(24, 28 + d)),
`-sibling-gap` (max(8, 12 + d)), `-duration` (medium2, 300ms).

## Anatomy and geometry (DPR 1, light, density 0)

* Viewport: `overflow: auto`, padding 8 8 22 (vertical; the 22 =
  toggle/2 + 10 leaves room for the hung toggler) or 8 at the inline start and
  22 at the inline end (horizontal; CH7). The tree is `max-content` wide and
  centred; wider than the viewport it starts at the inline start and scrolls.
* Node card: inline-flex, gap 12, padding 10/14, min 176, max 260, radius
  12, 1px outline-variant border, surface-container-low fill. Avatar
  `md-avatar` medium (40, circle, primary-container / on-primary-container,
  per-name colour off, `aria-hidden`). Name 14/20 weight 600, title 12/16
  on-surface-variant; both single-line with ellipsis.
* Selected card: 2px border in the selected colour with the padding reduced
  by 1px (nothing in the card moves), state layer at 0.08 of the selected
  colour; `node-selected` part. With `accent`, the selected colour (border,
  layer, ripple) is the accent and the avatar gets a 2px accent ring (CH1).
* Connectors (all pseudo-element borders, logical properties): a vertical
  drop from each parent (group `::before`, level-gap tall), a horizontal bus
  built from per-branch halves (`::before` / `::after` top borders), risers
  into each child, 12px elbows at the outermost children only (a square T in
  between), no bus or riser for an only child. Horizontal orientation is the
  block↔inline mirror (bus vertical, risers horizontal).
* Toggler: `md-icon-button` xs, tonal, round, 24px, surface-container-high
  fill, glyph `expand_less` (open) / `expand_more` (folded) at 0.66 × size,
  hung centred on the card's block-end edge (inline-end edge in horizontal),
  wrapped in an `md-tooltip` (position bottom, 500ms show delay) carrying the
  collapse/expand label. The button is `aria-hidden` and out of the tab order.
* Selection trail: every branch on the path from a shown selection to its
  root gets `branch-on-path`; the drops, risers and the measured bus run
  between them take the selected colour. The run is one L-shaped box per
  group, measured from the used borders of the drop and the outermost on-path
  riser on each side, drawing the bus side and each reached riser and rounded
  only where the grey connector rounds (the outermost child) — in both
  orientations and directions (CH6).
* Density d: toggle max(20, 24 + d), level gap max(24, 28 + d), sibling gap
  max(8, 12 + d), card gap max(6, 12 + 1.5d), padding max(6, 10 + d) /
  max(8, 14 + 1.5d), avatar max(28, 40 + 3d), name max(11, 14 + d/2) on
  max(16, 20 + d), title max(10, 12 + d/2) on max(14, 16 + d/2).

## Interaction and semantics

* Roles: `tree` (named by `label`, `aria-multiselectable="true"` only in
  `multiple`), `treeitem` per node with `aria-level`, `aria-setsize`,
  `aria-posinset`, `aria-expanded` (parents only), `aria-selected` (only when
  the node can be selected), `group` per open child list.
* Roving tabindex: exactly one visible tree item has `tabindex="0"` (the
  first root initially, then the last focused or clicked item). A fold that
  hides it hands the tab stop to the folded ancestor (CH2).
* Keyboard (focused tree item): ArrowDown/ArrowUp to the next/previous
  visible item (no wrap); Arrow forward unfolds a folded parent, else moves
  to its first child (no-op on a leaf); Arrow backward folds an open parent,
  else moves to the parent (no-op on a root); Home/End to the first/last
  visible item; Enter/Space selects a selectable node, else toggles a parent
  (no-op on an unselectable leaf). Forward/backward are ArrowRight/ArrowLeft,
  swapped when the host's computed direction is RTL — in both orientations.
  Modifiers are ignored; no type-ahead, no `*`.
* Pointer: a click on a card focuses its tree item and selects/deselects it
  (single: replaces, and deselects the only selected node; multiple: toggles).
  A click on the toggler folds/unfolds and focuses that node's tree item
  (CH2). Selectable cards have a pointer cursor, hover elevation 1 with a
  0.08 layer, pressed 0.12, and an `md-ripple` in the selected colour.
* Focus ring: `:focus-visible` on the tree item draws a 3px focus-ring
  outline 2px outside the card.
* Data: reassigning `nodes` rebuilds the fold state from `expanded` (the
  reader's folds are lost; documented) and keeps the roving owner if its id
  survives (made visible, and focused if focus was on a removed row, CH2).
  A selection hidden inside a folded branch still traces its trail up to the
  folded node that holds it.

## Motion

* Card border colour and shadow 300ms emphasized; state layer opacity 300ms;
  a 100ms z-index hold so a hovered card's tooltip is not covered.
* Unfold: the new group runs `md-org-chart-grow` (300ms emphasized, opacity
  0 → 1, `translateY(-8px) scale(0.96)` → none, origin top centre).
  Horizontal: `translateX(-8px)` from the left centre, or `translateX(8px)`
  from the right centre in RTL (CH5). Fold is instant (the subtree is removed).
  The trail is re-measured when the enter animation ends.
* Reduced motion: card, state-layer transitions and every group animation
  are removed (CH5 covers the horizontal selectors). `md-ripple` still runs.

## Paint reference

`paint.json` holds 97 cases: light/dark × LTR/RTL ×
vertical/horizontal × none/single/multiple selection (24), densities −1…−4 in
both orientations and an ancestor `data-density` (9), seeded folds with a
hidden selection (4), `collapsible="false"` over seeded folds (2), empty
default/slot/dark (3), multiple roots and an only-child chain per orientation
(4), accent light/dark (2), unselectable ids (2), trail geometry on unequal
siblings and a three-child group in both directions (12), hover on
selectable/selected/none cards and on the toggler with its tooltip (7),
keyboard focus (6), every hook alone and together (16), a 320px viewport
per direction and orientation (4), localised labels and the JSON attribute (2).
Each case records the host and every part, the per-item semantics and card
paint, the connector pseudo-elements and trail attributes, the accessibility
tree and the deep focus.

## Interaction and motion reference

`states.json` holds 16 runs (120 phases,
3,949 per-frame samples, 110 events,
497 animation records): pointer fold/unfold of the root and a
child per orientation and direction (enter motion per frame), the full
keyboard model in LTR and RTL (Tab in/out, arrows, Home/End, Enter/Space
select/deselect), pointer selection (single, multiple, multiple RTL,
horizontal), `selection-mode="none"`, an unselectable parent, a card press
(ripple, state layer), `collapsible="false"`, folding with focus inside, and
controlled updates (`nodes`, `selectedIds`, `collapsible`, `orientation`,
`density`). `states-reduced-motion.json` repeats 4 runs (18 phases, 736 frames) under
`prefers-reduced-motion: reduce`: the chart's own transitions and group
animations are gone; what still moves belongs to children — the toggler
`md-icon-button`'s shape-morph radius and state-layer transitions (its own
reduced-motion policy) and the `md-ripple` wave.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix. The
tests are in `md-organization-chart.contract.e2e.ts` (19 tests). CH1–CH5:
8 tests, 6 failed before the fixes, 2 are guards that passed before and after.
CH6–CH7 (found by the cloud paint probe, after CH1–CH5): 9 tests, 8 failed
before, 1 passed (the vertical LTR last-child run, which the old arithmetic
got right). CH2 follow-up: 1 new test and 1 added assertion failed before, 1
guard passed.

* **CH1. `accent` did nothing** (`.tsx`, `.css`). The node set `--_accent`
  inline but no rule read it: no avatar ring, and the selected border, tint
  and ripple stayed primary.
  * Fix: an `--accent` modifier class maps `--_selected-color` to the accent
    and draws a 2px accent ring around the avatar.
  * Test: selected accent node (border, layer, ring red) vs a plain selected
    node (primary border, no ring).
* **CH2. Folding the branch that held the tab stop left the tree without one**
  (`.tsx`). A pointer press on an ancestor's toggler (or new `nodes` with
  `expanded: false`) removed the roving owner: no item had `tabindex="0"`,
  Tab skipped the tree, and focus stayed on the `aria-hidden` toggler button.
  * Fix: `visibleOwner()` moves the tab stop to the outermost folded
    ancestor on fold, on data sync and when `collapsible` changes; a toggler
    click focuses its own tree item.
  * Tests: pointer fold with focus on a grandchild (tab stop, focus, Tab from
    outside) and a data fold.
  * Follow-up found in the interaction oracle (`controlled-updates`): new
    `nodes` or re-enabling `collapsible` moved the tab stop but dropped focus
    to `<body>` when they removed the focused row. The `nodes` / `collapsible`
    watchers note whether focus was on a row, and the next render focuses the
    roving owner (never when focus is elsewhere). Tests: a focus assertion
    added to the data-fold test and a `collapsible` re-enable test (both failed
    before), plus a guard that focus elsewhere is left alone.
* **CH3. `collapsible="false"` did not lock branches open** (`.tsx`). It only
  hid the togglers: ArrowLeft and Enter/Space still folded (and emitted
  `mdNodeToggle`), and a seeded `expanded: false` branch stayed folded with no
  way to open it.
  * Fix: `isExpanded()` is always true and `toggle()` is inert while
    collapsible is off; Arrow backward then ascends.
  * Tests: seeded fold shown, no toggle from keys, ascent; guard: re-enabling
    restores folding.
* **CH4. The trail was drawn for ids that cannot be selected** (`.tsx`).
  `selectedIds` entries exempted by `selection-mode="none"` or
  `selectable: false` were not outlined but still coloured the connectors
  and set `branch-on-path` up to the root.
  * Fix: `pathToSelection()` only counts selectable selections.
  * Test: mode none and `selectable: false` give no trail; guard: a
    selectable id still does.
* **CH5. Horizontal RTL groups grew in from the wrong side, and reduced motion
  missed the horizontal selectors** (`.css`). The horizontal keyframes slid
  from the left with a left origin in RTL too; the reduced-motion block's
  plain selector lost to the more specific horizontal rule.
  * Fix: RTL keyframes (`translateX(8px)`, right centre origin) and the
    reduced-motion block lists the horizontal selectors.
  * Test: first keyframe and resolved origin for LTR (guard) and RTL.

* **CH6. The selection trail was drawn off the connectors in RTL and in
  horizontal trees** (`.tsx`, `.css`). `measureTrail()` assumed a
  left-to-right, top-down tree: it derived the run's ends from branch centres
  with the 1.5px token width and DOM order. In RTL (vertical) the run landed
  one connector width beside the selected riser (a doubled line) and lost its
  rounded elbow (square corner over the grey curve); in a horizontal tree it
  measured the wrong axis and drew a stray coloured hook across the gap above
  the children, while the drop and the risers stayed grey (the vertical-mode
  tints colour the inline borders, which are the vertical bus there). In LTR it
  was also half a pixel long (Chrome draws the 1.5px border 1px wide).
  * Fix: the run is measured from the used box of the drop's and each riser's
    own border (orientation, direction and which pseudo draws the riser come
    for free), names the physical sides and elbow corner to draw
    (`data-trail-run`, `data-trail-elbow`; `data-trail-dir` is gone), draws a
    riser at each end it reaches, and is skipped when the riser stands under
    the drop. Horizontal trees tint the drop and riser block borders and keep
    the on-path bus half grey.
  * Tests: for vertical/horizontal × LTR/RTL × first/last child: drop and riser
    tinted (horizontal bus half grey), the run spans exactly drop line to riser
    line on the bus axis, the riser length across it, the riser side drawn and
    the elbow rounded only at the outermost child (8 tests).
* **CH7. RTL horizontal trees gave the hung togglers no room** (`.css`). The
  horizontal viewport padding was physical (`8px 22px 8px 8px`), so in RTL the
  togglers of the last column ended flush with the viewport's left edge while
  LTR had 10px.
  * Fix: logical `padding-inline: 8px calc(toggle / 2 + 10px)`.
  * Test: computed paddings in LTR and RTL.

The readme now states the `selectedIds` / trail rule, the locked-open
behaviour, the tab-stop hand-over and what `accent` paints. Four parts that
were missing from the component's JSDoc (`branch`, `branch-on-path`, `node`,
`node-selected`) are now annotated so the CEM generator can see them (CEM not
regenerated here).

## Observed, not changed (decisions needed)

* **`aria-expanded="true"` on locked-open parents.** With
  `collapsible="false"` a parent cannot fold, yet it still announces
  "expanded". APG reserves `aria-expanded` for items that can be expanded.
* **Horizontal togglers point up/down** (`expand_less` / `expand_more`) while
  the children open sideways.
* **Fold is instant** while unfold animates; there is no exit motion.
* **The fold state is reset by every `nodes` assignment** (documented); the
  roving owner is kept by id.
* **`mdSelectionChange` / `mdNodeToggle` carry the full node object**
  (including all descendants), not just the id.
* **Keyboard**: no type-ahead and no `*` (both optional in APG); modifiers
  are ignored (Shift+Arrow behaves like Arrow).
* **Ids are not validated**: duplicate ids alias selection, focus and folds.
* **The tree is announced as vertical** (no `aria-orientation`) in both
  orientations; the arrow model is the same in both (documented).
* **Tooltip-only toggler names**: the `expand-label` / `collapse-label` text
  reaches assistive technology nowhere (the toggler is `aria-hidden` and the
  tree item exposes only `aria-expanded`), which is the intended design.

## Decisions (autonomous, 2026-10-27, reversible)

Taken by fx for the native migration so the renderers copy one settled contract; each keeps the Web source behaviour,
so reverting a decision is a source change plus the same change in both renderers.

* **`aria-expanded` on locked-open parents** (`collapsible="false"`): kept as the source has it. Native parents keep
  their expanded state (macOS `AXDisclosing`, iOS value "Expanded", Android state description "Expanded") while they
  cannot fold.
* **Horizontal toggler glyphs**: kept (`expand_less` / `expand_more` in both orientations), as Chrome draws them.
* **Fold motion**: none, as the source (fold is instant; unfold runs `md-org-chart-grow`, which the renderers replay on
  insertion and on keyframe changes — orientation, horizontal RTL).
* **Event payloads**: `mdSelectionChange` and `mdNodeToggle` carry the full node record (with descendants), as the
  source; natives emit the parsed node value they received.
* **Hook names**: the native appearance APIs use the source's fifteen `--md-org-chart-*` hooks
  (`AWCOrgChartAppearance`, Laboratory `orgchart-appearance.js`). The CEM prefix drift stays recorded under CEM / source
  drift; the shared generator is not changed here.
* **Timing model** (tests, not product behaviour): native inputs are injected at the oracle's send times on Chrome's
  60 Hz frame grid; a press goes in at the frame Chrome's own samples show `:active` taking effect (Chrome applies it with
  the move when the move restyles the card, otherwise a frame later — trusted CDP input sends `mouse.move` then
  `mouse.down`). State changes driven by a click (selection, fold) render one frame after the pointer pseudo-classes, as
  the source's asynchronous render; transitions back to where a running one began are shortened as CSS does (reversing
  shortening factor).

* **SVG avatar sources** (the oracle's photo is a `data:image/svg+xml` avatar, which Chrome draws): md-avatar decodes SVG
  where the platform image decoders decline it — macOS through AppKit's own SVG image, UIKit (no public SVG decoder:
  `UIImage(data:)` declines it) and Compose (BitmapFactory declines it) through `AWCSvgRaster`, the same static-shape subset
  on both (rect/circle/ellipse/line/poly*/path with arcs, nested groups with inherited paint/opacity and transforms,
  viewBox), rasterised at 4×. Anything else fails the image like a broken one (the avatar's fallback).
* **Accessibility encodings** (Web `tree` / `treeitem`): macOS — an `AXOutline` named by `label` owning outline rows
  (`AXRow`/`AXOutlineRow`, `AXDisclosing`, `AXDisclosureLevel`, `AXSelected`) through the shared focus bridge's new
  `treeitem` role; iOS — buttons (+selected), value Expanded/Collapsed on parents, hint "Level N", in a labelled
  container; Android — a collection named by `label` (a traversal group), items in tree order (`traversalIndex`), focusable and
  clickable, with Expanded/Collapsed state descriptions and `selected` (Compose exposes it as checked: a selectable item reads as
  an option).
  `tools/ax` had no tree encoding (requested from fa 2026-10-29, no reply), so fx added it additively (ROLE_TABLE rows,
  normalizers, equivalences: iOS/Android `tree` not an element, Android `treeitem` as a button or, when selectable, an
  option) with eight cases. Reading order is the tree's DOM pre-order on all three (the macOS outline container sorts by the
  items' `treeOrder`, iOS sort priorities, Compose traversal indices); the togglers' `aria-hidden` reaches the AppKit/UIKit
  focus surfaces (shared policy `ariaHidden`).
* **Empty chart**: as Web, no tree and no label — only the status text; the `empty` slot shows "No data" whenever it
  composes nothing (a host that always passes a slot lambda, like the Laboratory, previously showed nothing on Android).

## Exception proposed (not accepted)

* **`::part()` selectors** — full record in [md-organization-chart.md](md-organization-chart.md#exception-proposed-part-selectors)
  (as md-line-chart's): the parts' own styling and every custom property are implemented; arbitrary author `::part()` CSS
  is not. NOT ACCEPTED until the reviewer's explicit acceptance; a typed part surface (as `AWCAvatarPartAppearance`) remains
  the implementable alternative if the reviewer rejects it.

## CEM / source drift

* The CSS hooks are named `--md-org-chart-*`, while the shared CEM generator
  (`scripts/generate-docs.mjs`) collects hooks with the prefix
  `--md-organization-chart-`, so none of the 15 hooks reach the CEM. Shared
  script, not changed.
* The parts `branch`, `branch-on-path`, `node`, `node-selected` were missing
  from the CEM (dynamic `part` strings); now annotated in the source.
* The readme's lazy-loading pattern says branches start expanded "(there is
  no initially-collapsed prop)"; the `expanded: false` node field exists.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch,
  serial): own suites before 5 suites / 100 tests (org chart 2 / 30,
  checkbox 3 / 70); after 7 / 123 (org chart 3 / 49, checkbox 4 / 74).
  Dependents of either component (md-autocomplete, md-date-picker,
  md-multi-select, md-number-field, md-otp-field, md-radio and md-radio-group,
  md-select, md-slider, md-switch, md-table, md-table-row, md-text-field,
  md-time-picker, md-toolbar, md-transfer-list, `hidden-attribute.e2e.ts`)
  after CH1–CH5 and C1–C2: 129 suites / 2,037 tests, one failure —
  `md-otp-field.editing.e2e.ts` (a focus assertion under load), which passes
  alone (2/2). CH6–CH7 and the CH2 follow-up touch only the chart, which
  nothing else renders except `hidden-attribute.e2e.ts`: own + that suite
  after them, 8 suites / 124 tests.
  Logs in `outputs/native-parity/md-organization-chart/source-tests/`; diffs
  in `source-changes/`.
* **Oracle:** `outputs/native-parity/md-organization-chart/web-oracle-cloud/`
  (see its README).
