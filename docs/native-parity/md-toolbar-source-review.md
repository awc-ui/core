# Toolbar source review (md-toolbar)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried. Two layout defects
were fixed test-first and mirrored into `packages/core/src` (hash-verified). `dist` was not touched.
The browser reference is **provisional**: Linux headless Chromium 141, to be recaptured on the Mac
with Chrome 153. Native renderers have not been started.

## Public contract

| Property | Attribute | Default | Values |
| --- | --- | --- | --- |
| `variant` | `variant` (reflected) | `docked` | `docked`, `floating` |
| `color` | `color` (reflected) | `standard` | `standard`, `vibrant` |
| `layout` | `layout` (reflected) | `horizontal` | `horizontal`, `vertical`. **Floating only**; a docked bar ignores it (oracle `docked-layout-vertical-ignored`). |
| `alignment` | `alignment` (reflected) | `start` | `start`, `center`, `end`, `space-between` |
| `containerSemantics` | `container-semantics` (reflected) | `toolbar` | `toolbar`, `generic` |
| `ariaLabelProp` | `aria-label` | `''` | A blank label is stripped. A dev warning fires when a toolbar has no name. |
| `ariaLabelledby` | `aria-labelledby` | `''` | Rendered as given. ARIA's own name computation prefers it. |
| `density` | `density` (reflected) | `0` | 0 to −4 |

- **Method:** `setFocus()` focuses the active roving member (or the preferred one). It is a no-op
  when the group is empty.
- **Events:** none.
- **Slots:** the default slot, `leading`, `trailing` and `fab`.
- **Parts:** `container` and `fab-container`.
- **CSS hooks (11):**
  - `--md-toolbar-container-color`, `-icon-color`, `-container-shape`, `-container-height`,
    `-padding`, `-gap` and `-fab-gap`.
  - Opt-in overflow: `-overflow-x`, `-overflow-y`, `-flex-wrap` and `-scrollbar-width`.

**Semantics and roving** (from `md-toolbar.tsx`; confirmed by `web-states.json`):

- `toolbar` mode puts `role="toolbar"` on the host, with `aria-orientation` set to `vertical` only
  for a floating vertical bar.
- **Activators form one roving group with a single Tab stop.** Activators are `button`, `a[href]`,
  `md-button`, `md-icon-button`, button-type inputs, `role=button/menuitem/link`, and bare
  non-negative `[tabindex]` leaves. md-* members are roved through `groupTabindex`; native controls
  through the `tabindex` attribute.
  - Group order is leading, then default, then trailing; the FAB is excluded.
  - ArrowLeft/Right move through the group (swapped in RTL); a vertical bar uses ArrowUp/Down.
    Movement wraps. Home and End jump to the ends. Arrows on the other axis and arrows with a
    modifier key are ignored.
  - The active member is remembered when Tab leaves and comes back.
- **Independent controls keep their own Tab stop**, and arrows inside them are untouched: text and
  value inputs, `select`, contenteditable, md-text-field/select/radio/chip/switch/checkbox/fab, and
  the textbox/searchbox/spinbutton/combobox/slider/radio/checkbox roles.
- **Composites are never descended into:** md-button-group, md-menu, and the
  group/radiogroup/listbox/menu/tablist/toolbar roles.
- **Membership rules:**
  - Soft-disabled members stay arrow-reachable but are not the default stop.
  - Hard-disabled, hidden, `aria-hidden` and author `tabindex="-1"` controls are excluded.
- The group re-syncs on DOM, attribute, class and style changes, coalesced to one frame. Examples:
  hiding the active member re-anchors the stop, and a runtime switch to `generic` restores every
  tabindex.
- `generic` mode has no role and no roving.

## Layout and paint reference (density 0, light theme, LTR; `web-paint.json`, 116 cases)

**Docked bar:**

- Full width, min-height 64 (`max(48, 64+4s)`), padding-inline 16 and bottom safe-area padding.
- Fill is surface-container (#F3EDF7). It has elevation-2, radius 0, sticky bottom and z-index 100.
- The container is 688×40 inside a 720px bar. The item gap is 32 (`max(4, 32+2s)`). Center
  alignment uses an 8px gap; space-between uses 0 between groups and 32 inside a section.
- The FAB (56×56) sits at the inline end with a 16px margin. Its shadow is flattened on a docked
  bar.

**Floating bar:**

- An inline-flex host with margin-inline 16 and no chrome of its own. The pill is the container:
  corner-full, padding 8, gap 4, height 64, elevation-2.
- The FAB sits beside the pill with a host gap of 8 and keeps its own elevation.
- Five 40px buttons give a 232×64 pill.
- A vertical floating bar is 64 wide, in a column, with a 4px gap.

**Colour schemes:**

- `standard`: surface-container fill, on-surface-variant ink (#49454F).
- `vibrant`: primary-container fill (#EADDFF), on-surface ink.
- Slotted md-icon-buttons get toolbar-only tokens: standard/outlined unselected use the toolbar ink.
- On a vibrant bar, an unselected tonal toggle uses a surface-container fill with on-surface ink,
  and a selected one uses secondary-container with on-secondary-container. Filled and selected
  buttons keep their own colours.

**Sections:**

- A non-empty `leading` or `trailing` section lays out as **one group**: the slot becomes
  `display:flex` with the item gap. The group takes `margin-inline-end:auto` (leading) or
  `margin-inline-start:auto` (trailing). An empty or hidden section is `display:contents`.
- With both sections present, the default content therefore sits centred between them at every
  alignment except space-between. This is unchanged from the original.

**Overflow:** none by default. Content past the bar paints outside it (the oracle
`overflow-default-docked` has a scrollWidth of 832 against 328). Scrolling or wrapping is opt-in
through the hooks.

**Focus ring:** a roved icon button shows a 3px secondary (#625B71) outline at offset 2px.

## Source defects fixed (test-first, `md-toolbar.sections.e2e.ts`)

1. **Several leading or trailing items spread apart.** Each slotted item carried its own auto margin
   (`::slotted([slot=leading]){margin-inline-end:auto}`), so two leading buttons were pushed across
   the bar. Fix: the section `<slot>` becomes one flex group keyed by host classes
   `md-toolbar--has-leading` / `--has-trailing`. Those classes are computed from visible authored
   children, before first render and on every re-sync. Tested in LTR and RTL, and for the 32px
   docked gap inside sections on a space-between bar.
2. **Vertical floating bars pushed section items off axis.** The inline auto margins moved
   leading/trailing items 4px off centre on a vertical strip. Fix: a vertical bar stacks its
   sections in a column with no inline margins.

Guards, which passed before and after:

- Layouts with a single leading or trailing item are unchanged for start, center, end and
  space-between.
- An empty or hidden section adds no space.

A pre-existing e2e test ("re-anchors the Tab stop when the active control is hidden via inline
style") waits a fixed 60ms. It failed once each under parallel load in two full runs, and passes in
isolation (46/46, and 3/3 earlier). It is not related to these changes.

## Behaviour kept as-is (native renderers must match)

- `layout` is ignored on docked bars.
- With both sections present, `alignment="start"` still centres the default items between the
  sections.
- An `aria-hidden` control that is focusable stays a Tab stop. The toolbar only excludes it from the
  group; this is an authoring error, not the toolbar's.
- Overflow is visible by default (M3 says to cap the action count).

## Evidence

- **Source diff:** `outputs/native-parity/md-toolbar/source-changes/md-toolbar.diff`.
- **Test logs:** `source-tests/`. They include the re-anchor timing logs and `after-255-final.log`.
- **Oracles (provisional):** `web-oracle-cloud/`.

## Decisions (autonomous, 2026-10-31, reversible)

Taken by n5 for the native migration (the plan's open decisions); each keeps the Web contract as the native parity target.

| Decision | Chosen | Alternative | How to revert |
| --- | --- | --- | --- |
| `alignment="start"` with both sections present | Keep the Web behaviour: the default items are centred between the sections (paint parity reproduces it on all three platforms). | Keep the default items after the leading group. | Change the source layout rule (test-first), recapture the toolbar paint oracles on Mac Chrome 153, update `ToolbarMetrics` / `AWCToolbarLayout` in both renderers. |
| Docked overflow | Keep the Web default: content past the bar stays visible (overflow: visible); scrolling / wrapping only through the overflow hooks (`overflowX`, `overflowY`, `flexWrap`, `scrollbarWidth`), as on the Web. No cap or overflow menu. | Cap the actions with an overflow menu, or clip (M3's recommendation). | Add the cap/menu (or clip) to the Web source first, then mirror it in `NativeToolbar.swift` / `AWCToolbar.kt` and the oracles. |
| Reading order without a hardware keyboard | The group order is the reading order: leading, default, trailing, then the FAB (DOM order, as Chrome exposes it; `tools/ax` compares it per platform). | A FAB-first or visual-priority order. | Reorder the members in the accessibility containers (`AWCToolbarAccessibilityView`, the Compose traversal group) and update the tools/ax expectations. |
| `aria-labelledby` on Android | Implemented: the host that renders a node tree supplies its texts through `AWCLabelTextsScope` / `LocalAWCLabelTexts` (SwiftUI resolves them in its scope automatically); unresolved references fall back to `aria-label`. | An exception (no IDREF resolution in Compose). | Remove the scope lookup in `AWCToolbar.kt` (the name falls back to `aria-label`) and record the exception per AUDIT.md. |
