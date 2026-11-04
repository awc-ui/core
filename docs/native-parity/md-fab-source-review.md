# FAB source review — migration queue

Status: source analysis and measured reference complete. Native implementation and focused checkpoints have since passed; see the [migration audit](md-fab.md) for current evidence and remaining gates. Reviewed the actual `md-fab.tsx` and `md-fab.css`; comments are not used to override the rendered behavior.

## Public contract

- Ten properties: `variant`, `size`, `disabled`, `softDisabled`, `lowered`, `ripple`, `icon`, `label`, optional `extended`, and `density`.
- Seven variants: surface, primary/secondary/tertiary container, and primary/secondary/tertiary.
- One named `icon` slot. No default content slot is declared.
- One `mdClick` event whose Web detail is the original MouseEvent. Native activation needs a documented native input equivalent, not an unrelated `{selected}` payload.
- One public async method, `setMenuIcon(string | null)`. It changes temporary presentation state without modifying the authored icon or slot. Clearing it reveals the latest authored content. This must work through native public APIs and the Laboratory method control.
- Three parts: `state-layer`, `icon`, `label`.
- Five public CSS hooks, mapped to a future `AWCFabAppearance`: container color, icon color, icon size, container shape and label color.

## Geometry and visual rules to preserve

Icon-only sizes at density 0 are 56, 80 and 96. Their density formulas subtract 4 per rung with respective floors 40, 64 and 80. Glyph formulas start at 24, 28 and 36, subtract one per rung, and have respective floors 18, 21 and 27.

A nonempty label removes the icon-only size class. Labelled FAB height follows the standard 56-to-40 density formula regardless of `size`. Unset `extended` means extended when a label exists. Explicit false keeps that label as the accessible name while hiding its visual content. Explicit true without a label still uses the icon-only size class.

Extended min width is 80. With an icon, padding is 16 at inline-start and 20 at inline-end, with a 12 gap implemented as label margin. Without an icon, both paddings taper from 20 to 12 with density. Collapsed labelled FAB min width is 56 and icon padding is 16 on each side. Preserve these source rules even where they differ from intuitive uniform density scaling.

The ordinary standard shape is the large corner token (16); medium/large use extra-large (28). Although a source comment calls the collapsed FAB a circle, only the menu-controlled `data-shape="circle"` rule explicitly forces 50%. Do not substitute a generic native circular FAB for the actual standalone source shape.

Surface variant switches from surface-container-high to surface-container-low when lowered. Other variants retain their color pair. Elevation is level 3 at rest and 4 on hover; lowered uses 1 at rest and 2 on hover. Focus/press restore the rest elevation. Disabled removes elevation and applies the disabled container/icon cascade. Inner icon/label authored color overrides have their own later CSS precedence and must be checked against actual source output.

Extended/collapsed spatial motion uses 500ms with the source overshooting curve; label effects use 200ms with a non-overshooting curve. There is no initial mount morph. Label widths must be measured after font/layout changes. Menu icon transition uses 120ms opacity and rotation/scale; its temporary icon may hide authored slotted content without deleting it.

## Interaction and accessibility

Enter/Space prevent the default key action, trigger ripple, then activate. Disabled and soft-disabled both block activation; only hard-disabled leaves the sequential focus order. Label-derived naming must survive rerenders, authored accessible names must retain precedence, and collapsed labels remain the action name.

The `md-fab-menu` integration additionally owns temporary shape/icon presentation and must be verified in that component's pass. Menu methods must not destroy authored values.

## Required verification

Measure all three icon-only sizes across five densities, all seven variants with lowered/disabled states, label-only and icon-plus-label layouts, optional versus explicit extended values, RTL padding, live label changes, custom named-slot presence, temporary menu-icon set/clear, focus/keyboard/pointer activation, ripple, reduced motion and all five appearance hooks. Compare real native captures with Web using the same theme and fixtures. Compile all generated event/slot/method/part examples. Record iOS device/simulator execution separately from macOS SwiftUI.
