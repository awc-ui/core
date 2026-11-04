# Organization chart native implementation plan (md-organization-chart)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-organization-chart-source-review.md](md-organization-chart-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-organization-chart/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) with the fixed build before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/DataViews.swift`, `organizationChart` / `orgNode`,
dispatched from `AWCNativeView.swift`):

* An indented outline, not a chart: a `ScrollView([.horizontal, .vertical])` (min 160, max 480
  tall) holding a leading-aligned `VStack`; each level is padded 24pt and a child row starts with a
  20 × 1 rule at 20% primary. No connectors, no centring, no orientation.
* Card: `Button` with the child `md-avatar` (`src`, `name`, `initials`), name (semibold) and title
  (caption, secondary), padding 12, radius 12, fill `primary` at 22% when selected, else the
  surface. No border, min/max width, truncation rule, hover, state layer, ripple or focus ring.
* Selection: ignored for mode `none` and `selectable: false`; `single` sets `[id]` (a second click
  does **not** deselect); `multiple` toggles; ids are **sorted** (Web keeps selection order). Emits
  `mdSelectionChange {node, selectedIds}`.
* Fold: a separate chevron `Button` (`chevron.down` / `chevron.right`) with the
  collapse/expand label as its accessibility label, shown when `collapsible` and the node has
  children; state in `local["_org_<id>"]`, seeded from `expanded`. Emits `mdNodeToggle`.
  With `collapsible="false"` a seeded `expanded: false` branch stays folded and unreachable (the old
  Web bug CH3); the local fold state survives a `nodes` reassignment (Web resets it).
* Accessibility: the scroll view is labelled with `label`; every card is a button and every
  chevron a second button — no tree, level, position, expanded or selected semantics, no roving
  focus, no keyboard model.
* Empty: renders the `empty` slot content only.
* Not wired: `orientation`, `density`, the 15 hooks, `accent`, the trail, motion, RTL specifics,
  the default "No data" text.

**Android** (`packages/native-android/.../AWCData.kt`, `OrganizationChart`, dispatched from
`AWCComponent.kt`):

* A `Column` outline: 20dp start padding per level, full-width `Surface` cards (Web cards size to
  their content, 176–260), colour `secondaryContainer` when selected, else `surfaceContainer`.
* Card content: `md-avatar` (`name`, `initials`; the `avatar` image is **not** passed), name
  `titleSmall`, title `bodySmall`, padding 12.
* Selection: `clickable` only for selectable nodes; `single` → `setOf(id)` (no deselect),
  `multiple` toggles; emits `{node, selectedIds}`.
* Fold: an `IconButton` with `expand_less` / `expand_more` and the label; state in a map that
  survives `nodes` reassignment; same locked-open defect as iOS.
* Semantics: `selected`, and `stateDescription` "Expanded"/"Collapsed" on **every** card including
  leaves; the column's `contentDescription` is the label. No role, level, collection info or
  expand/collapse actions; each parent has two focus stops (card and button).
* Empty: nothing (no slot, no default text).
* Not wired: `orientation`, `density`, hooks, `accent`, trail, motion, keyboard tree model.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Layout | Centred connector tree; vertical or horizontal; RTL mirrors | Indented outline | Indented outline |
| Connectors | Drops, buses, risers, 12px elbows at the outermost children, only-child straight | 20 × 1 rule per child | None |
| Card | 176–260 wide by content, padding 10/14, gap 12, 1px border, radius 12, ellipsis | Fixed padding 12, no border | Full width |
| Avatar | md-avatar medium (40), image or initials, decorative | md-avatar with image | md-avatar without image |
| Selected | 2px selected-colour border, 8% tint, ripple; `accent` per node | 22% primary fill | secondaryContainer fill |
| Trail | `branch-on-path` + coloured connectors up to the root | None | None |
| Single selection | Re-click deselects the only selection | No deselect | No deselect |
| `selectedIds` order | Selection order | Sorted | Set order |
| Fold | Toggler hung on the card edge; Arrow keys; Enter/Space on unselectable parents; instant fold, 300ms grow on unfold | Separate chevron button | Separate icon button |
| `collapsible="false"` | Locked open (incl. seeded folds) | Seeded folds unreachable | Seeded folds unreachable |
| `nodes` reassignment | Fold state rebuilt from data | Local state kept | Local state kept |
| Semantics | tree / treeitem (level, setsize, posinset, expanded on parents, selected when selectable) / group; multiselectable | Buttons | selected + stateDescription on every card |
| Keyboard | Roving tab stop, arrows (RTL-swapped), Home/End, Enter/Space; tab stop survives folds | None | Default focus traversal, two stops per parent |
| Hover / press / focus ring | Elevation 1 + 8% layer, 12% pressed, ripple; 3px ring 2px outside | None | Material click indication |
| Density | Gaps, toggler, card padding, avatar, type | None | None |
| Hooks | 15 `--md-org-chart-*` | None | None |
| Motion / reduced motion | 300ms card colours and layer, group grow; all off under reduced motion | None | None |
| Empty | `role=status` "No data" or the `empty` slot | Slot only | Nothing |

## Plan

1. **Layout engine** (shared design, per platform): a measured tidy layout matching the CSS flex
   result — each card sized by its content within min/max width; siblings separated by the sibling
   gap and centred under the parent (vertical) or beside it (horizontal); levels separated by the
   level gap; several roots side by side; the whole tree centred in the viewport when narrower,
   start-aligned and scrollable when wider (RTL mirrors). Derive every number from `paint.json`
   (`items[].nodeRect`, `connectors[]`).
2. **Connectors**: draw the drop, bus halves, risers and elbows as one path per group, exactly as
   recorded in `connectors[]` (widths, radii, which pseudo carries the elbow, only-child case).
   The trail recolours the drop and the on-path risers (not their bus halves) and draws the run
   from the drop line to the outermost on-path riser line on each side, as the fixed Web does in
   both orientations and directions (`connectors[].trail`: sides in `data-trail-run`, corner in
   `data-trail-elbow`, extent in `trailX`/`trailW` or `trailY`/`trailH`; elbow only at the
   outermost child).
3. **Card**: border/fill/padding/gap per state; avatar (image or initials, decorative); name and
   title with tail truncation; selected border 2px with padding −1; accent ring and colour; hover
   elevation and layer, pressed layer, ripple in the selected colour; focus ring 3px at +2px.
4. **Toggler**: a 24pt tonal round button hung half outside the card's bottom (vertical) or
   inline-end (horizontal) edge, glyph per state, tooltip with the localised label on hover/long
   press; hidden from accessibility (the node carries the expanded state) — the fold is also
   reachable through the node's accessibility actions.
5. **State model**: fold set seeded from `expanded` and rebuilt on every `nodes` assignment;
   locked open when `collapsible` is false; selection exactly as the Web (`single` re-click
   deselects; order kept; exempt ids neither shown nor traced); roving owner handed to the folded
   ancestor; events `mdSelectionChange` / `mdNodeToggle` only for user actions, after the state
   change.
6. **Accessibility and keyboard**:
   * iOS: one accessibility element per visible node (name + title, the selected trait when
     selected, value "level N, i of n" and "expanded"/"collapsed" for parents), custom actions
     Expand/Collapse, the tree labelled by `label`; hardware-keyboard arrows/Home/End/Enter/Space
     through the focus bridge with the RTL swap; one focusable stop.
   * Android: `collectionInfo` / `collectionItemInfo`, `selected`, `stateDescription` only on
     parents, `expand()` / `collapse()` semantics actions, a single focus stop with key handling
     for D-pad/keyboard (arrows with the RTL swap, Home/End/Enter/Space).
7. **Motion**: card colour/shadow and layer transitions (300ms emphasized), group grow on unfold
   (opacity, 8px slide, 0.96 scale from the parent side; RTL horizontal from the right), instant
   fold; all off under reduced motion (`accessibilityReduceMotion` / animator scale 0); ripple
   kept.
8. **Density and hooks** per the oracle (density formulas in the source review; all 15 hooks).
9. **Empty state**: default localisable "No data" status text or the `empty` slot.
10. **Contracts**: paint parity against the recaptured `paint.json` (boxes, colours, connector
    geometry, flat pixels), per-frame parity against `states.json` (fold/unfold motion, selection
    transitions, keyboard sequences, events), reduced motion against
    `states-reduced-motion.json`.

## Open decisions to settle before native work

* `aria-expanded` on locked-open parents (`collapsible="false"`): keep "expanded" or drop it —
  decides whether native parents expose an expanded state there.
* Toggler glyph direction in horizontal orientation.
* Fold exit motion (Web folds instantly).
* Event payloads carrying whole subtrees (`node` with all descendants) — natives will copy the
  shape unless it is narrowed.
* The CEM hook prefix (`--md-org-chart-*` vs the generator's `--md-organization-chart-*`), so
  native appearance APIs are generated from the right names.
