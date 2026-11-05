# Organization chart parity checkpoint

**Status.** Dedicated SwiftUI (`NativeOrgChart.swift`, `OrgChartModel.swift`) and Compose (`NativeOrgChart.kt`,
`NativeOrgChartModel.kt`) renderers replace the generic indented-tree adapters in production dispatch (`AWCNativeView`,
`AWCComponent`). All nine properties, both events and the `empty` slot are released on both platforms with the fifteen
`--md-org-chart-*` hooks as a typed appearance API. Paint, interaction, motion and lifecycle match the Chrome 153 oracles on
macOS, iOS (simulator) and Android (emulator); the Laboratory integration (gate 3) is in place and the accessibility trees
match Web in `tools/ax` on all three platforms (8 cases, 0 open findings). One exception is proposed, not accepted: author `::part()`
selectors (record below). Not the separate final audit.

Source review and decisions: [md-organization-chart-source-review.md](md-organization-chart-source-review.md). Plan:
[md-organization-chart-native-plan.md](md-organization-chart-native-plan.md).

## Contract and implementation

**Data.** `nodes` as an array, a single node object or their JSON string (the source parses all three); node fields `id`,
`name`, `title`, `avatar`, `avatarInitials`, `accent`, `selectable`, `expanded`, `children`. Every `nodes` assignment reseeds
the folds from `expanded` (documented source behaviour); the roving owner is kept by id and moves to the visible owner when its
row disappears.

**Layout** — the source's CSS model, computed by a shared model (`OrgChartModel` / `NativeOrgChartModel`, Python reference
`work/fx-lab/orgchart/model.py`):
- centred flex tree, vertical or horizontal; cards `min/max-width` hooks, Roboto advances for the name/title runs
  (16 linear-advance passes on Android), avatar 40 (density formula), padding/gap from density;
- the scrolling viewport (`overflow: auto`, padding 8 / 8 / toggle/2 + 10); RTL starts at the right edge; a narrow viewport
  scrolls (320px case);
- connectors as the source's pseudo-element border boxes (12px elbows, the trail up to the root in the selected colour,
  also for horizontal and RTL), hung togglers (md-icon-button xs tonal in md-tooltip, label = expand/collapse label);
- `text-overflow: ellipsis` at the line end; a run whose own direction differs from the card's is cut at its head;
- the empty state: the `empty` slot or "No data" with the CSS line box of 14px Roboto at `line-height: normal` (Chrome rounds
  ascent and descent: 16px per line).

**Interaction.** Roving tree-item tab stop (first root, then the last focused); WAI-ARIA tree keys (Up/Down, forward/back with
the RTL swap in both orientations, Home/End, Enter/Space select or fold); click selects (`single` toggles off, `multiple`
adds/removes, `selectable: false` and `selection-mode="none"` exempt); a press focuses the item without the focus ring; a
toggler click folds and hands focus to its row; folding with focus inside moves focus to the folded row; `collapsible="false"`
locks every parent open. Events: `mdSelectionChange {node, selectedIds}`, `mdNodeToggle {node, expanded}` with the full node
record, at the source's times.

**Paint and motion.** Card surface, outline (selected: colour + 1), hover elevation 1 and the selected ring, state layer
(hover 0.08 / press 0.12 / selected tint in the selected or accent colour) under the avatar, md-ripple, focus ring
(focus-ring hook), z-index lift while hovered (held 100 ms). Transitions: 300 ms emphasized on explicit tracks (duration
hook), started at the frame the change renders — pointer pseudo-classes at once, click-driven state (selection, fold) a frame
later like the source's asynchronous render — and CSS transition reversing (a transition back to where a running one began
lasts the share the running one covered). Unfold: `md-org-chart-grow` (opacity, scale 0.96, 8px slide) on every inserted
group and on keyframe changes (orientation, horizontal RTL). Reduced motion removes all of it; changes then show at their
frame.

**Appearance.** `AWCOrgChartAppearance` (15 fields = the source hooks, colours `#RRGGBB[AA]`, lengths px/pt/dp, duration ms).
Swift `.awcOrgChartAppearance(_:)`; Compose `AWCOrgChartAppearanceScope`. Nested scopes merge field by field (inner wins).
A node's `accent` replaces the selected colour for that node and rings its avatar.

**Accessibility.** Web: `tree` named by `label` with `treeitem`s
("Name Title", level, expanded for parents, selected for selectable nodes). macOS: an `AXOutline` container named by `label`
owning outline rows (`AXRow`/`AXOutlineRow`, `AXDisclosing`, `AXDisclosureLevel`, `AXSelected`) — the focus bridges with the
new shared `treeitem` role. iOS: buttons (+selected), value Expanded/Collapsed, hint "Level N", in a labelled container.
Android: the chart is a collection (`CollectionInfo`, a traversal group) named by `label`; items are focusable, clickable
collection items with Expanded/Collapsed state descriptions and `selected`. All three read the items in the tree's DOM
pre-order (not geometrically). Togglers are hidden from assistive technology, as on Web (their `aria-hidden` now reaches the
AppKit/UIKit focus surfaces). Empty: only the status text (no tree, no label), as on Web.
`tools/ax` (8 cases: single, multiple, selection none, locked open, folded, horizontal, RTL, empty): macOS, iOS and Android pass, 0 open findings
([report](../../outputs/native-parity/md-organization-chart/accessibility/report.md)); the tree/treeitem encodings were added to
`tools/ax` for this component (see the decisions).

**md-avatar.** `data:image/svg+xml` avatars (the oracle's photo) decode through AppKit's SVG image on macOS and through
`AWCSvgRaster` (Swift on UIKit, Kotlin on Android — the same static-shape subset, at 4×) where the platform decoders decline
them.

**Inspection.** `AWCOrgChartInspectionScope` / `.environment(\.awcOrgChartInspector)` give the parity probe (cards,
togglers, groups, per-frame tracks, focus).

## Evidence

Everything is under `outputs/native-parity/md-organization-chart/`.

| Gate | Result | Evidence |
|---|---|---|
| Chrome 153 oracles (Mac) | 97 paint cases, 16 + 4 (reduced motion) state runs, 4,644 sampled frames | `web-oracle/` |
| Shared fixtures | Swift `Tests/Fixtures/orgchart-web-paint(.json)`, `orgchart-web-states.json` = Android assets `OrgChartWebPaint(.json)`, `OrgChartWebStates.json` byte for byte | `checkpoint.json` |
| macOS paint (`NativeOrgChartPaintIntegration`) | 1437/1437 | `verify2/views-orgchart.log`, `verify2/paint-results.json` |
| macOS states (`NativeOrgChartStatesIntegration`) | 1253/1253 | `verify2/states-results.json` |
| Android paint (`NativeOrgChartPaintTest`, emulator-5562 API 36) | 1434/1434 | `verify2/android2-device/` |
| Android states (`NativeOrgChartStatesTest`) | 1253/1253 | `verify2/android2-device/` |
| iOS simulator (iPhone 17 Pro, iOS 26.3) | paint 1437/1437, states 1253/1253, md-avatar 2949/2949 | `work/fx-lab/orgchart/ios-build/fixtures/*/console.log` |
| Full Swift view suite (private tree resynced with canonical) | 68/70 fixtures — NativeBehaviorViewIntegration fails identically on canonical since n3-020 (reported to n3); NativeTextFieldStatesIntegration missed 2 of 84 tab-out motion frames in one case under load and passes in isolation (2/2 reruns) | `verify2/fixtures/` |
| md-avatar after the SVG decoding | macOS 2949/2949, iOS 2949/2949, Android `NativeAvatarParityTest` pass | `verify2/` |
| Accessibility (`tools/ax`, macOS / iOS / Android vs Chrome) | 8 cases: pass / pass / pass, 0 open findings | `accessibility/` |

The states tests compare, per phase, the settled state of every visible item (tab stop, expanded, selected, trail, border
colour/width, shadows, focus ring, state layer, z-index) and the focused element, and per frame the layer, border, shadow and
unfold keyframes against Chrome's samples one Chrome frame either side (its own measured frame interval); events by order,
phase and payload. Time is Chrome's: inputs are injected at the oracle's send times on Chrome's 60 Hz frame grid (Swift virtual
clock; Android test clock scaled 16.667/16), a press at the frame Chrome's samples show `:active` taking effect; a group Chrome
first samples one frame into its unfold was painted at 0% in the frame before.

## Laboratory (gate 3)

- `orgchart-appearance.js`: the 15 hooks (asserted against `md-organization-chart.css`, the IR — whose CEM lists none, prefix
  drift — and both released policies); Styles panels on Web/iOS/Android; invalid input keeps the last valid value.
- Retained updates for the nine properties with their source types (Studio, SwiftUI host, Android host).
- Copyable examples: HTML/React/Vue/Svelte/Angular snippets carry every hook; 22 SwiftUI + 22 Compose copied examples generated against the released policies
  (usage, theme, every hook, subtree defaults, every property, variants, both events, the empty slot): Swift typecheck clean,
  Compose compiled in the androidTest build (`laboratory/examples/`).
- Live hosts: `test-live-orgchart.mjs` 19/19; `LivePreviewOrgChartHostTest` pass (emulator-5562).
- `orgchart-integration.test.mjs` (7 tests) and the Studio suite 782/785 in the resynced tree (the 3 failures are md-text-field tests that fail
  identically on canonical, reported to n3).

## Decisions and open items

See the source review ("Decisions (autonomous, 2026-10-27, reversible)" and "Exception proposed").

## Exception proposed: part selectors

| Field | Record |
| --- | --- |
| Scope | author `::part()` rules on the chart's shadow parts; the parts' own styling and their CSS custom properties are implemented |
| Exact source behaviour | Shadow-DOM nodes carry `part` attributes (`packages/core/src/components/md-organization-chart/md-organization-chart.tsx`): `viewport`, `tree`, `empty`, `branch`, `branch-on-path`, `group`, `node`, `node-selected`, `state-layer`, `avatar`, `avatar-image`, `name`, `title`, `toggle`; page CSS can restyle any of them with `md-organization-chart::part(<name>)` rules. |
| Affected platforms and API | macOS SwiftUI, iOS SwiftUI, Android Compose — `AWCOrgChartAppearance` (`.awcOrgChartAppearance(_:)` / `AWCOrgChartAppearanceScope`), theme tokens. |
| Technical reason | `::part()` is CSS selector syntax over a shadow tree; SwiftUI and Compose have no stylesheet, shadow DOM or selector matching (AUDIT.md: CSS selector syntax is a browser-only facility). |
| User impact | Arbitrary per-part CSS (any property on any part) cannot be applied natively; apps restyle through the fifteen typed hooks and the `empty` slot. |
| Tested native equivalent | The component stylesheet's styling of every part is reproduced (paint, states and motion against Chrome above), and each `--md-org-chart-*` custom property it reads is a typed hook, with subtree defaults and local values (Laboratory: `orgchart-appearance.js`, live hosts). |
| Alternative | A typed part surface (as `AWCAvatarPartAppearance` for md-avatar, the md-list/md-card part surfaces) is implementable if the reviewer rejects this record. |
| Evidence | `outputs/native-parity/md-organization-chart/verify2/`, `web-oracle/`, `checkpoint.json` |
| Reviewer | independent final audit reviewer (AUDIT.md gate 7) — not yet assigned |
| Acceptance | **NOT ACCEPTED — proposed; needs the reviewer's explicit acceptance (AUDIT.md exception policy)** |
