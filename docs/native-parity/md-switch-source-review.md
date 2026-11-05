# Switch source review

Status: gate 1 (Web source checkpoint) complete. The source tests pass unchanged
(`md-switch`, `md-checkbox` and `md-radio` together: 12 suites, 249 tests; log in
`outputs/native-parity/md-switch/source-tests/baseline.log`). No source defect was
demonstrated, so `packages/core/src` is unchanged for this component. The trusted-input
Chrome oracles and the native renderers are recorded in the [plan](md-switch-native-plan.md)
and the [checkpoint](md-switch.md).

## Public contract

Properties (all from `md-switch.tsx`):

| Property | Default | Notes |
| --- | --- | --- |
| `selected` | false | Mutable, reflected. The only state the switch commits. |
| `disabled` | false | Reflected. `tabindex=-1`, `pointer-events: none`, disabled colours, no state layer. |
| `softDisabled` | false | Reflected as `soft-disabled`. Disabled colours and no toggle, but it stays focusable and hoverable (`aria-disabled`). |
| `required` | false | Reflected. Constraint validation: value missing while unselected. |
| `name` / `value` | `''` / `on` | Form value is `value` when selected, otherwise none. |
| `icons` | false | Shows the selected and unselected glyphs. |
| `showOnlySelectedIcon` | false | Glyph only while selected. |
| `selectedIcon` / `unselectedIcon` | `check` / `close` | Material Symbols ligatures. |
| `density` | 0 | 0 … −4; the track height loses 4px per rung (min 16), the default track width 6px (min 28). |
| `valueMissingLabel` | English sentence | The inline validation message for `required`. |

Events: `mdInput` (cancelable, `{selected: proposed}`) then, unless cancelled, the commit and
`mdChange` (`{selected}`); `mdValidityChange` (`{valid, validationMessage, flags}`) only on a
change of validity, never at mount. Methods: `setFocus()` (forces the focus ring until blur),
`getValidity()`, `checkValidity()`, `reportValidity()`, `setCustomValidity(message)`.
Slots: `selected-icon`, `unselected-icon` (replace the glyph). There is no default slot: authored
text inside the element is not rendered. Parts: `track`, `state-layer`, `handle`, `icon`.

Twelve hooks: `--md-switch-track-width`, `-track-height`, `-handle-size`, `-track-color`,
`-track-outline-color`, `-handle-color`, `-selected-track-color`, `-selected-handle-color`,
`-icon-color`, `-selected-icon-color`, `-state-layer-color`, `-focus-ring-color`.

## Behaviour verified in Chrome

- Geometry derives from the track: width = hook ?? max(28, 52+6d); height = max(16, (hook ?? 32)+4d);
  2px border; the handle container (state layer) is height+8; the selected handle is hook ?? ¾ of the
  track height, unselected ⅔ of that, pressed 7/6. The host is as wide as the track and max(48, height)
  tall. The container's inline start is h/2 − (h+8)/2 − 2 unselected and w − h/2 − (h+8)/2 − 2 selected,
  mirrored under RTL.
- Motion: position and size use the spatial fast spring (350 ms, cubic-bezier(0.42, 1.67, 0.21, 0.90));
  colours and state-layer opacity use the effects fast spring (150 ms, cubic-bezier(0.31, 0.94, 0.34, 1)).
  The icon swaps instantly. Reduced motion makes every transition 0.01 ms.
- Interaction colours (hover, focus-visible, pressed) override the colour hooks: the unselected handle
  becomes on-surface-variant and its outline on-surface; the selected handle primary-container.
  State-layer opacity: pressed/`:active` 0.12, focus-visible 0.12, hover 0.08.
- Pointer: pointerdown sets the pressed class and focuses the host without `:focus-visible`;
  pointerup, pointerleave and pointercancel clear it while `:active` stays until release; a click
  (press and release on the host) toggles. Releasing outside does not toggle.
- Keyboard: Space toggles on keydown with a 150 ms pressed pulse and ignores key repeat; Enter does
  nothing (reserved for form submission).
- Form: `formResetCallback` restores the initial `selected` without events; a disabled form control
  is excluded and its validation presentation reset.
- Accessibility: `role=switch`, `aria-checked`, `aria-disabled` for both disabled kinds,
  `aria-required`, `aria-invalid` while a validation message shows; the message is `role=alert`
  and described by the host.

## Native implications

Native renderers must reproduce the cascade above (including the interaction overrides of the
hooks), cancelable `mdInput`, the Space pulse and the reset behaviour. Platform differences are
listed in the checkpoint: AppKit/UIKit expose no switch role, the programmatic focus ring needs a
native method transport, and the inline validation presentation (`reportValidity`) needs the
Laboratory method transport.

## Decisions (autonomous, 2026-10-31, reversible)

The shared `aria-invalid`-at-rest and `<fieldset disabled>` decisions for md-checkbox, md-switch and md-radio are recorded in
[md-checkbox-source-review.md](md-checkbox-source-review.md#decisions-autonomous-2026-10-31-reversible) (gate-7 R4-07).
