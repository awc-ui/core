# Tooltip source review

Status: Web contract and browser reference verified. Dedicated native renderers,
shared controls, compiled examples and available-host verification are recorded
in the [native checkpoint](md-tooltip.md). Actual iOS and final independent
acceptance remain pending.

## Public contract

Twelve properties: `text` and `subhead` (empty), `variant` (plain/rich,
default plain), `position` (top by default), `autoPosition` (true), `offset`
(8), `crossOffset` (0), `open` (false), `showDelay` (500ms), `hideDelay`
(200ms), `disabled` (false), and local `density` (0).

All twelve positions are supported: top/bottom/left/right, each with optional
`-start` or `-end`. Public asynchronous methods are `show()` and `hide()`.
`mdOpen` and `mdClose` have no payload and are instance events; they neither
bubble nor cross the component boundary.

Four slots are the default anchor, rich `content`, rich `subhead`, and rich
`actions`. Rich named slots replace their corresponding fallback properties;
plain mode renders only `text`. Parts are `popup`, `text` in plain mode,
and `subhead`, `supporting-text`, `actions` in rich mode.

Eleven appearance hooks: plain container/text color, rich container/subhead/
text/action color, plain shape/max-inline-size, rich shape/min-inline-size/
max-inline-size. Native color, shape, sizing, content-builder and part-style
equivalents are required. Literal DOM selectors and CSS syntax are Web APIs,
not a reason to omit their corresponding native styling capability.

## Layout and placement

The host occupies the anchor's inline box. The popup is an independent fixed
overlay with intrinsic max-content width, border-box sizing, and no arrow.
It must not enlarge the anchor or participate in its parent's normal layout.
The browser fixture uses an 80×32 authored button as the anchor within real
600×400 iframe viewports, plus narrower 180/320px viewports.

Plain: inverse surface/on-surface, shape4, block padding4, inline padding8,
minimum height24, maximum width280 capped to viewport width−16.
Font Roboto400,12/16,tracking.4. Text wraps anywhere so unbroken tokens remain
readable. The empty plain popup is16×24; zero max-width retains the padding
floor and wraps into a tall box.

Rich: surface-container/on-surface-variant, shape12, elevation2, minimum
width120, maximum320 capped to viewport−16. Insets top12,bottom8,inline16.
Heading Roboto500,14/20,tracking.1 with bottom gap4; supporting text
Roboto400,14/20,tracking.25. Actions form a row at logical end, gap8 and top
margin12. Authored controls retain their own font, size, handlers and semantics.
Empty rich content is120×20. A minimum width larger than the maximum wins,
as in CSS. Rich unbroken text can overflow its content box; plain's
`overflow-wrap:anywhere` is not applied to rich supporting text.

Density changes formula-based font sizes, line heights and minimum height.
Padding/gaps use density-sensitive system spacing tokens. Local density and
an inherited raw density scale are measured separately because the latter
does not rebind every spacing token. Use the recorded used values rather than
assuming the two cases are identical.

Positioning measures the anchor in viewport coordinates and the popup's
integer `offsetWidth/offsetHeight`. The resulting subpixel centering can differ
slightly from centering its fractional bounding box. Offset affects the main
axis, crossOffset the perpendicular physical axis.

RTL mirrors the left/right side. For top/bottom it swaps start/end alignment;
for left/right it preserves the vertical start/end alignment. CSS placement
classes are already physical, so animation origins must not be mirrored again.
Actions use logical flex-end, including a nested LTR scope inside RTL.

Auto-position first tries the preferred side, its opposite, then top, bottom,
right, left with the same alignment suffix. Fit is tested only on the main
axis. If none fits, the preferred placement remains. Cross-axis coordinates
are then clamped to an8px viewport margin. Disabling auto-position disables
both flipping and clamping.

Visible popups track anchor movement, popup size, viewport changes and effective
direction. Programmatic position/offset/crossOffset/autoPosition changes now
schedule immediate repositioning without requiring scroll. Translation,
border and scroll offsets of fixed containing blocks are accounted for.
The pre-existing general scaled/rotated CSS containing-block limitation remains:
the source conversion does not invert arbitrary transform matrices. No claim
of arbitrary transformed-parent coverage is made by this checkpoint.

## Lifecycle and accessibility

Hover and focus schedule opening after showDelay. Leaving schedules closing
after hideDelay for both variants; entering the popup cancels that timer.
Focus entering authored rich actions keeps the tooltip open, while focus
leaving the component dismisses after the grace delay.

Public show/hide cancel pending pointer timers, even when the requested state
is already current. Disabled dismisses and clears timers/descriptions; an
initial disabled+open configuration is normalized closed without a close event.
Re-enabling restores the description but does not open by itself.

Escape dismisses and suppresses immediate re-opening until trigger exit and
re-entry. Focus returns to the trigger only if it was already inside the
tooltip/trigger; unrelated focus is preserved. Reconnect restores bindings,
position tracking and Escape without a duplicate open event. Detached show
requests are honored when reattached; no detached global watchdog is started.
Removing the anchor dismisses and unbinds the old anchor. Named slot addition,
removal, reassignment and text edits refresh rendered content and descriptions.

The popup has role tooltip and aria-hidden matching visibility. The trigger
receives an accessible description instead of a cross-shadow ID reference.
Plain describes actual `text`; rich describes the rendered heading and
supporting content, including authored replacements, and excludes action labels.
Native descriptions, focus/keyboard behavior, touch-appropriate invocation and
OS accessibility need real implementation and verification; browser semantics
alone do not prove them.

Opening/closing uses100ms standard easing, scale.9↔1 and opacity0↔1.
Origin faces the anchor: bottom center for top, top center for bottom,
center right for left, center left for right. Visibility hides after closing.
Reduced motion removes transitions/scale. Forced colors adds a CanvasText
border. Actual browser transition samples were recorded at0/25/50/100ms;
OS reduced-motion/forced-colors settings were source reviewed, not executed.

## Corrections and evidence

Actual browser failures were recorded before fixing:

- Public hide/show lost to old delayed pointer timers.
- Removed anchors retained listeners/descriptions and an open popup.
- Named slot reassignment left actions hidden and descriptions stale.
- Mounted placement options and effective direction did not reposition.
- Initial disabled+open retained an inconsistent public open state.
- Authored rich content was described using hidden fallback text.
- Bordered transformed parents shifted the popup by their border width.
- An ancestor RTL selector double-mirrored actions and broke nested LTR scopes.

`outputs/native-parity/md-tooltip` contains102 configurations per light/dark
theme, eight actual lifecycle scenarios,32 sampled transition frames,
the pre-fix browser results, and a validator with15,667 assertions over those
recorded cases. Two source suites pass75 tests and the full development build
succeeds. The records and source hashes are in `web-evidence.json`.

Native implementation, events/methods, authored content, appearance hooks,
inspection, right-panel controls, generated examples, integrated Laboratory
verification, OS accessibility and actual iOS SDK/runtime verification remain
required. This source checkpoint is not a completed native migration.

## Disabled authored update follow-up

The watcher now normalizes `open = true` while disabled back to false, matching initial markup and `show()`. The regression failed before the fix and passes afterward; the actual browser lifecycle reference now has nine scenarios. Re-enabling remains closed and emits no spurious event. The combined source run passes 163 tests (75 Tooltip and 88 Dialog).

The isolated font-only default palette was also captured for all 102 configurations in both themes, with nested shadow-root transitions settled. Original historical palette geometry/motion files remain preserved; the new paint reference is in `outputs/native-parity/md-tooltip/default-palette`.

## Supplemental public-part and event reference

The root captured an additional 52 configurations per theme (104 total) using the default library palette. CSS assertions cover popup signed start margins in LTR/RTL and top/left placements, inherited action typography, each of five public part decorations, each part color, and combined styling. Source validation passes 2,704 assertions; measurements, fixture source and hashes are in `outputs/native-parity/md-tooltip/supplemental/web-evidence.json`.

The popup writes a physical left offset. Therefore a logical start margin moves its border box in LTR, while the equivalent right margin in RTL leaves the physical left origin unchanged. Rich subhead/supporting typography and colors retain their own declarations. Raw action spans inherit popup font metrics, but their slotted color declaration wins over inherited actions-part ink.

A separate actual-browser event fixture verifies light-tree and shadow-tree delivery for `mdOpen`/`mdClose`. Both are cancelable, non-bubbling and non-composed, with null detail. Ancestor capture listeners in the same tree run before target listeners; bubbling listeners and outside-shadow ancestors do not receive the event. `preventDefault()` sets the cancellation flag but does not undo already committed visibility. These observed flags override earlier assumptions that private events suppress capture.
