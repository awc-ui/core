# Split Button source review

Status: source analysis only. Native migration and verification are pending.

## Public contract

Fourteen properties: `variant`, `size`, `disabled`, `softDisabled`, `icon`, `label`, `trailingIcon`, `trailingChecked`, `menuLabel`, `haspopup`, `controls`, `fullWidth`, `ripple`, `density`. Defaults are filled/sm, unchecked, menu label “Toggle menu”, popup kind menu and trailing `keyboard_arrow_down`.

Two events: `mdLeadingClick` has no payload; `mdTrailingClick` carries `{ checked }` after updating local `trailingChecked`. No imperative methods exist. One default slot adds authored content inside the leading button, after the optional icon and label; it does not replace the label prop. Seven parts expose both buttons, both state layers, leading icon, label and trailing icon. Six public appearance hooks map container, label, icon and outline colors, outer radius and leading icon size.

## Action and accessibility behavior

Leading and trailing are independent real focusable buttons. Pointer handlers stop raw click propagation, then guard disabled/soft-disabled. Keyboard Enter/Space triggers the relevant ripple and event; other keys do nothing. Neither custom event cancellation rolls back trailing state. There is no automatic menu creation or attachment.

Hard-disabled removes both tab entries; soft-disabled retains both while blocking activation. The leading accessible name comes from label, falling back to the host accessibility label when label is absent. The trailing name comes from `menuLabel`, expanded state from `trailingChecked`, popup semantics from `haspopup` (`false` omits them) and the controlled target from `controls`. Native equivalents should preserve an actual named target relationship where supported, with a specific platform boundary for browser-only ARIA mechanics.

## Geometry and appearance

Base heights xs/sm/md/lg/xl are 32/40/56/96/136; each density step subtracts four with a floor of 24. The outer default radius uses half the **base** height, not the density-reduced height. Leading glyphs are 16/18/24/36/48; trailing glyphs are 22/22/26/38/50 and are not controlled by the leading icon-size hook.

The split gap is always two. Inner radii are 4/4/8/12/16, morphing on hover/focus/active to 8/8/12/20/28. Leading padding pairs are 12/10, 16/14, 24/20, 36/28, 48/36; an authored icon subtracts four from the leading side. Trailing pairs are 12/14, 12/14, 13/17, 26/32, 37/49. Checked trailing padding becomes symmetric 13/13/15/29/43. Each side trims two per density rung, floored at four.

The checked trailing button becomes a pill and rotates the trailing glyph 180 degrees. Shape and rotation transitions use 200ms standard easing; state overlays use 100ms. Logical corners and padding mirror in RTL. The source shape-morph opt-out affects only one of the two inner corners in each hover rule; verify actual behavior before claiming full opt-out equivalence.

Typography follows the source size-specific label tiers with density taper. Full width grows only the leading segment, allows its content width to shrink and ellipsizes the label; the trailing button retains intrinsic width.

Filled, tonal, outlined and elevated colors/elevation differ. Outlined ignores the container-color hook. Elevated buttons clip shadows at their inner edges while retaining them on outer edges, with RTL clipping reversal. Hover elevation is two for elevated and one for tonal; elevated pressed/focused returns to one. Disabled overrides custom enabled icon/container/label colors and removes shadows; outlined disabled stays transparent. Both native halves require independent interaction state.

## Required evidence

Measure the 25 size/density combinations, four variants, both trailing states, RTL, narrow/full width, custom appearance, label plus default content, independent pointer/keyboard actions and disabled/soft-disabled accessibility. Test state synchronization with the right panel, both event examples and native controlled-target semantics. Compile all generated examples and compare actual native frames against Web before marking migration complete.

## Web baseline captured

The 69 source unit tests passed. Fifty hydrated browser fixtures cover size/density, variants, checked/disabled/soft-disabled, RTL, slots, appearance and constrained full width. Sources, screenshots, measurements and hashes are saved under workspace `outputs/native-parity/md-split-button`.

The small trailing segment remains 48/44/40/36/32 wide across density 0…−4 while its glyph stays 22 and leading glyph stays 18. A full-width 420 control gives the leading segment 370 and trailing 48 with gap two; width 100 gives leading 50 and trailing 48. The small outer corner token remains 20 even at density −4. Canceling either emitted custom event does not undo trailing selection: the fixture emits a null leading payload followed by `{ checked: true }`, and the trailing state remains checked.
