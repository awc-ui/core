# Segmented Button source review

Status: source analysis only. Native migration and verification are pending.

The visible Laboratory component is `md-segmented-button`, demonstrated inside `md-segmented-button-set`. Both implementations must be migrated together. The set is a required supporting component rather than an additional completed component in the 56-component count.

## Public contract

The segment has 13 properties: `value`, `selected`, `disabled`, `softDisabled`, `icon`, `label`, `noCheckmark`, `ripple`, `segmentIndex`, `segmentTotal`, `segmentDensity`, `segmentMultiselect`, `density`. Four of these are parent-managed, but remain real source properties; the Laboratory must explain their ownership rather than silently drop them.

Its `mdSegmentClick` payload is `{ value, selected }`. There are no public methods. Both the default label slot and named `icon` slot need native content equivalents. Four parts expose state layer, checkmark, icon and label. Seven public appearance hooks cover unselected/selected container and label colors, outline color, outer corner radius and icon size.

The supporting set has two properties (`multiselect`, `density`), `mdChange: string[]`, a structural default slot and no methods, parts or component-specific appearance hooks.

## Selection and keyboard behavior

A segment emits a proposed selection; it does **not** assign its own `selected` property. Single-select proposes `true`; multi-select proposes the inverse of current selection. A standalone native segment must preserve this controlled behavior. The set commits the selection by element identity, not by value, so duplicate and empty values remain independent. It then emits the selected values in descendant source order.

The set stops propagation of the child's `mdSegmentClick`; cancellation is not consulted before its commit. Initial children and every slot replacement are synchronized with index, total, parent density and multiselect mode. Changing those set properties also synchronizes children. It does not normalize an initially invalid single-selection arrangement merely on mount.

Enter and Space emit the same proposal, after disabled guards. All four arrow keys wrap through descendants of the nearest set, skipping only hard-disabled segments. Forward is Right or Down even in RTL; this source behavior must not be replaced with Button Group's RTL logic. In single-select, arrow navigation also clicks/selects the next segment; in multi-select it only moves focus. A soft-disabled target remains focusable but blocks activation. The source has no Home/End handler and gives each enabled/soft-disabled segment tabindex zero rather than implementing one roving tab stop.

## Content and geometry

`label` takes precedence over default content. Initial non-whitespace host text determines whether a label wrapper exists; the source does not update that flag on later slot changes. An icon property swaps to a checkmark in place when selected unless `noCheckmark`. Without an icon, enabled checkmarks reserve a leading graphic and matching trailing spacer even while unselected, preserving label centering and width.

The named icon slot is rendered **in addition to** the graphic reservation/property icon, despite a CSS comment calling it a replacement. Native implementation must follow actual markup or explicitly fix and verify Web first. Blank authored slot wrappers remain authored content.

The set uses equal intrinsic grid columns. A segment's minimum height is 40/36/32/28/24 across density 0…−4; glyph size is 18/17/16/15/14, gap 8/7/6/5/4, label size 14/13.5/13/12.5/12, line height 20/19/18/17/16, weight 500 and tracking 0.1. Inline padding uses the shared inset token and must be measured rather than assumed constant. Negative local density wins over the parent density class and inherited density.

Only outer logical edges are rounded. Each segment draws its own one-pixel outline; interior segments omit their leading border. The last segment restores its own leading border and overlaps the previous edge by one pixel, including when its predecessor is disabled. This prevents a missing or doubled divider. RTL must mirror logical geometry.

Selected colors use secondary-container roles. Disabled content/outline use on-surface at 38%/12%; selected disabled background uses 12%. Soft-disabled retains focusability and removes the interaction overlay. Overlay transitions and background transitions are 100ms standard easing; native Reduce Motion must suppress them.

## Required evidence

Measure Web equal-column geometry, reserved graphics, property plus slot composition, all density modes, selected/unselected states, first/middle/last/standalone corners, disabled neighbor dividers, RTL and explicit appearance overrides. Verify standalone versus set-controlled activation, duplicate values, keyboard mode differences, child replacement/reordering and panel selection synchronization. Compile generated slot/event/appearance examples and test actual native views before replacing this status with an implementation audit.

## Web baseline captured

The 87 source tests for the segment and set passed. A browser fixture measured 35 hydrated configurations; reproducible sources, screenshots, measured JSON and hashes are under workspace `outputs/native-parity/md-segmented-button`.

At density 0…−4, standalone text “Week” has heights 40/36/32/28/24 and inline padding 12/12/8/8/8. Empty named icon content still contributes an 18 × 18 box at density zero. An icon property plus named slot produces both graphics; the slot does not replace the property icon.

The last set child is one pixel wider than its equal grid track and overlaps the previous track by one pixel. A constrained 180-wide set measures child widths 60/60/61 rather than three equal outer widths. A parent density −4 with one local −1 child stretches all children to 36 high; shared inset padding remains the inherited eight-pixel token even on that local-density child. Single segment activation leaves its controlled selection unchanged; the multi-select set commits independent child state and emits the corresponding ordered values.
