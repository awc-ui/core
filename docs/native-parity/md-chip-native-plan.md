# Chip native plan

Status: the plan the dedicated SwiftUI and Compose md-chip renderers were built
to. The checkpoint record, with results, is [md-chip.md](md-chip.md); the source
contract, defects and browser reference are in
[md-chip-source-review.md](md-chip-source-review.md).

## Sources of truth

- Contract: `packages/core/src/components/md-chip` after source fixes (a)–(h).
- Browser reference: `outputs/native-parity/md-chip/web-oracle/`, Chrome 153
  headless on macOS, DPR 1, trusted CDP input:
  - `web-paint.json`, with 452 cases and 451 clipped shots;
  - `web-states.json`, with 45 runs, per-frame samples, transition records and
    phase shots;
  - `web-states-reduced.json`, with 5 runs.
- The provisional Linux capture (`web-oracle-cloud/`) differs from the macOS
  capture only in values that do not affect rendering:
  - Chrome 141 versus 153 serialisation of `outline-width` when the outline
    style is `none`;
  - frame-timing samples of ripple waves and transitions.
  - `web-oracle/cloud-vs-mac.txt` records the comparison.

## Model (both platforms)

`AWCChipModel` (Swift) and `ChipModel` (Kotlin) follow the md-chip.tsx class
and attribute logic:

- effective appearance: the deprecated `elevated` boolean wins;
- variant-default `selectable` and `removable`;
- `colored`: the `colorVars` ident test;
- the selected and elevated classes;
- the roles: an interactive host; a button-role host; a group with a primary
  action; a display token;
- the checkmark rule, which applies only when nothing leads: no icon and no
  slotted leading content.

`AWCChipStyle` / `ChipStyle.resolved` applies md-chip.css in specificity and
source order:

| Specificity | Rules |
| --- | --- |
| (0,1,0) | `:host` |
| (0,2,0) | variant, selected, elevated, tonal (filled/elevated) |
| (0,3,0) | elevated+selected, outlined colour role, selected tonal, tonal colour role, selected colour role |
| (0,4,0) | disabled container |
| `!important` | disabled content colour and elevation |
| outline element | the outline's visibility and its disabled colour |

A Python port (`web-reference/cascade-port-check.py`) reproduces all 449
non-layout paint cases of the oracle. It was used to validate the cascade
before the Swift code ever compiled.

## Geometry

- Height: max(24, (`container-height` ?? 32) + 4·density).
- Typography: Roboto 500, max(11, 14 + .5·d) over max(16, 20 + d), with 0.1
  tracking.
- Icon, checkmark and slotted icons: (`icon-size` ?? max(14, 18 + d)).
  - The remove button is max(18, icon) with the glyph centred.
- Spacing tokens come from the density rung:
  - **Rung:** the chip's own −2…−4 density, or else the inherited rung.
  - **Insets:** label-side `inset-lg` is 16 / 12 / 8, item-side `inset-sm`
    is 8 / 4.
  - **Gap:** `gap-sm` is 8 / 4.
- Shrink-to-fit row. The label is the only shrinkable item: a flex item with
  `min-width: 0` and an ellipsis.
  - With an inline size (Swift `awcChipStretch`, Compose
    `AWCChipStretchScope`) the chip fills the width.
  - `contentAlign` positions the row inside that width: start, centre or end,
    with logical direction.
- Paint order: container, ripple, outline, state layer, content. The container
  is clipped to the corner shape, with the shadow outside it.

## Interaction

- State layer: hover .08, focus-visible .12 and press .12, over 50 ms
  (short1). It stays at 0 when disabled; it is not rendered when
  soft-disabled.
- Host background, label ink and shadow transition over 100 ms (short2) with
  the standard easing.
- Reduced motion removes those transitions. The ripple still plays: md-ripple
  ignores reduced motion.
- Ripple: md-ripple timing (450 ms growth, then a 150 ms fade after release and
  growth), at opacity .12, in the label ink.
  - A pointer press starts the ripple at the press point; Enter or Space starts
    it at the centre.
  - Pressing ✕ ripples the whole chip, as the source does.
- Focus:
  - A button-role host shows a 3 px secondary ring at offset 2 and raises the
    layer to .12.
  - In a group-role chip, the primary action shows a 3 px ring inset at
    offset −3 and the remove button a 2 px circle at offset 1; the layer stays
    at rest.
  - Pointer-taken focus is not focus-visible.
- Keys:
  - Enter and Space activate (ripple, then click).
  - Delete and Backspace remove a removable chip, from the primary action or
    from ✕.
  - Enter, Space, Delete and Backspace on ✕ remove it.
- Events:
  - `mdSelect {selected}` fires before `mdClick`.
  - `mdRemove` is cancelable. When it is not prevented, the chip removes
    itself.
  - Disabled and soft-disabled chips emit nothing.
  - A soft-disabled remove button is not focusable (source finding kept).

## APIs

- Swift:
  - `AWCChipHookAppearance` and `AWCChipPartAppearance` hold the twelve hooks
    and seven parts, each with `init(values:)` and `merging`.
  - Modifiers: `.awcChipAppearance(_:for:)`, `.awcChipPartAppearance(_:for:)`,
    `.awcChipReducedMotion(_:)` and `.awcChipStretch(_:)`.
  - The generated `AWCChipAppearance` enum keeps its name.
- Compose: the same two data classes, with `fromValues`, `normalized` and
  `merge`, plus the scopes `AWCChipAppearanceScope`,
  `AWCChipPartAppearanceScope`, `AWCChipReducedMotionScope`,
  `AWCChipStretchScope` and `AWCChipInspectionScope`.
- Dispatch:
  - **Swift:** `AWCNativeView` routes `md-chip` to `nativeChip`; md-chip is
    excluded from the generic `.disabled` wrapper.
  - **Compose:** `AWCComponent` routes `md-chip` to `NativeChip`; only that
    line changed.

## Platform differences (justified, documented in md-chip.md)

- Android arrow keys move focus (2D focus search); Chrome keeps focus on the
  chip.
- On Android, `AWCComponent` passes renderers only the resolved density. A
  local −1 chip under an inherited −2…−4 scope therefore keeps the 0/−1
  spacing tokens there (Swift matches the source).
- When a keyboard activation changes the chip's width (a filter chip gaining
  its checkmark), Chrome draws the ripple in the box from before the toggle.
  The native wave uses the new box.
