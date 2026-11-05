# Toolbar native implementation plan (md-toolbar)

Status: preparation only. The contract is in the [source review](md-toolbar-source-review.md). The
oracles in `outputs/native-parity/md-toolbar/web-oracle-cloud/` are **provisional**. They were
captured with Linux headless Chromium 141 (1200×900, DPR 1, trusted CDP input) and must be
recaptured with Chrome 153 on the Mac.

## Oracle inventory

| File | Content |
| --- | --- |
| `web-paint.json` + `paint-shots/` (115 PNG) | 116 cases. See the breakdown below. |
| `web-states.json` + `states-shots/` (143 PNG) | 17 runs, 143 phases and 1859 frames. See the breakdown below. |
| `web-states-reduced.json` (19 PNG) | 2 runs under reduced motion, 252 frames. |

**Paint cases (116):**

- 16 matrix cases: variant × colour × theme × direction.
- 8 vertical cases.
- 20 alignment cases.
- 14 section cases.
- 6 FAB cases.
- 13 density cases.
- 8 icon-button variant cases under each colour scheme.
- 5 content cases (mixed, soft-disabled, opt-out, empty) and 4 semantics cases.
- 5 overflow cases.
- 5 all-hooks cases and 11 single-hook cases (all 11 hooks).
- 1 hidden case.

**Interaction runs (17):** roving in docked, floating and RTL bars and with multiple sections;
vertical roving; mixed independent controls; soft-disabled members; opt-out; FAB; `setFocus`;
generic mode; a dynamic re-sync sequence; pointer state layers in standard/vibrant × light/dark and
on a vibrant tonal toggle.

## Current native state

**Swift (`Containers.swift`, `toolbar` else-branch):**

- An `HStack` (or a `VStack` when `layout == vertical`) with spacing 8 and padding 12.
- The background is `surface` in a rounded rectangle: radius 24 when floating, 8 otherwise.
- `accessibilityLabel(ariaLabelProp)`.
- The support JSON marks density, colour, alignment and container semantics as unsupported.
- Missing:
  - The docked variant (full width, 64pt, sticky bottom, no radius).
  - The pill on the container with the FAB outside it.
  - The vibrant scheme and the toolbar-only icon-button tokens.
  - Sections, alignment, density, FAB placement and the hooks.
  - Toolbar accessibility traits/orientation and `setFocus`.

**Android (`AWCComponent.kt`, shared with md-app-bar):**

- A `Surface(surfaceContainer, RoundedCornerShape(16.dp))` with a `Row` (`spacedBy(12.dp)`).
- The `Row` holds: the leading content, a leading `IconButton` if `leadingIcon` is set, a weighted
  `Column` with headline (titleLarge), subtitle (bodySmall) and the default content, then the
  trailing content.
- None of the toolbar variants, layouts, alignment, colour scheme, FAB slot, density or semantics
  exist. The app-bar headline props even leak into the toolbar.

## Implementation plan (both platforms)

1. **A dedicated toolbar renderer**, separate from the app bar.
   - **Docked:** full width, min height 64 (density `max(48, 64+4s)`), horizontal padding 16,
     surface-container fill, elevation 2, square corners, pinned to the bottom with the bottom
     safe-area inset added to its height.
   - **Floating:** a pill container (corner-full, padding 8, height 64, elevation 2) with
     margins 16. The FAB is a separate surface 8pt away and keeps its own elevation.
   - **Vertical floating:** 64 wide, items in a column.
2. **Item spacing and alignment.**
   - Gap 32 on docked bars (`max(4, 32+2s)`), 8 for center, and 0 between groups for space-between
     (32 inside a section). Gap 4 on floating bars.
   - Implement leading and trailing as single groups pushed to the edges, with the default items
     between them, matching the oracle geometry (for example `sections-multi-*`, `align-*`).
3. **Colour.** Standard is surface-container with on-surface-variant ink. Vibrant is
   primary-container with on-surface ink. Apply the toolbar-only icon-button mapping (the
   tonal-toggle selected and unselected fills in vibrant), and leave filled and selected buttons
   alone.
4. **Keyboard and accessibility.**
   - Expose the bar as a toolbar container with a label (iOS: `.accessibilityElement(children:
     .contain)` plus a label; Android: `Modifier.semantics { isTraversalGroup; paneTitle/role }`).
   - Hardware-keyboard roving: arrows (swapped in RTL, vertical axis when vertical), Home and End
     with wrap.
   - Independent controls (text fields, toggles, composites, FAB) are separate focus stops.
   - Soft-disabled members stay reachable; hard-disabled ones are skipped.
   - `setFocus()` focuses the active member. `generic` drops all toolbar semantics.
5. **Density** follows the same rungs (height, gap and icon-button size 40 → 32 at −4).
6. **Hooks.** Expose all 11 tokens. The overflow tokens map to opt-in horizontal or vertical
   scrolling or wrapping. Clipping is off by default.

## Open decisions

- Should `alignment="start"` with both sections present really centre the default items (current
  Web behaviour), or keep them after the leading group?
- How should the native docked bar handle overflow? The Web default paints past the bar, which a
  native renderer cannot reasonably copy. A proposal: cap plus overflow menu, or clip, as M3
  recommends.
- On platforms without hardware keyboards, roving reduces to screen-reader order. Confirm that the
  group order (leading, default, trailing, then FAB) is the reading order.
