# Card source review

Status: Web contract and browser reference verified, including independent
interaction review. Dedicated native implementation and acceptance remain
pending. This is not a native completion record.

## Public contract

Nine properties: variant (elevated/filled/outlined, default elevated),
interactive=false, dragEnabled=false, disabled=false, softDisabled=false,
ripple=true, fullWidth=false, fullHeight=false and density=0 through −4.
One default slot preserves arbitrary authored content. No public methods.
Two public parts expose the state layer and outlined border. Four events:
`mdClick` carries the original MouseEvent; drag start/move/end carry
clientX/clientY, offsetX/offsetY and startX/startY in logical viewport pixels.
Native callbacks need equivalent activation metadata and logical coordinates.

The 14 appearance hooks are container color/shape/elevation, outline color/
width, state-layer color, width/min-width/max-width, height/min-height/
max-height, padding and gap. Padding and gap are implemented source hooks
that were previously missing from the public CSS comment. Typed native
appearance must expose them alongside the other hooks and part equivalents.

## Layout reference

The card is a clipped column with automatic block width. In a 320×240
definite parent, the default content fixture has three unshrinking items
20/40/30px tall. Card heights are 138, 132, 126, 120 and 114 at densities
0 through −4. Padding is 16+2*density and gap is 8+density. Body typography
is Roboto 400, 14+.5*density over 20+density, with .25 tracking.

The actual default radius remains 12px across all densities: the system
shape token takes precedence over the density-sensitive fallback expression.
Native renderers must match the resolved source token, not just the CSS
fallback. Elevated uses surface-container-low and elevation 1; filled uses
surface-container-highest without elevation; outlined uses surface and a
1px outline-variant border, painted inside the same geometry.

fullWidth/fullHeight set 100% on the corresponding axis, overriding explicit
width/height hooks while respecting min/max. Full height needs a definite
parent height. The capped full fixture measures 260×200. calc(80% − 8px)
width and 60% height resolve to 248×144 in this parent. Minimums override
smaller maximums. Zero width/height still retain padding and measure 32×32.
Empty content measures 320×32. Explicit short height clips overflow; the
component itself does not add scrolling. Authored controls and paragraphs
retain their own styles and intrinsic layout.

The all-hooks fixture measures 280×190 with 10px/18px padding, 13px gap,
alpha colors, 3px border, a custom shadow and asymmetric elliptical corners.
RTL reverses text alignment while preserving logical card geometry. Hidden
cards have zero layout bounds. The 65 configurations per theme use isolated
font definitions and unmodified library palette tokens.

## Interaction and state

An interactive card with no independently focusable content exposes a button
role and tabindex 0. Hard-disabled uses tabindex −1; soft-disabled stays in
the tab order. Both reject card activation. A card containing its own controls
remains a container with those controls as independent tab stops, while
background pointer activation still emits mdClick. Authored child keyboard
events must not be intercepted by the card. The component does not turn the
arbitrary authored subtree into a disabled fieldset.

Only interactive cards receive disabled visuals, as stated by the property
contract. The source soft-disabled selector was narrowed to follow that
contract. Disabled surface alpha is .12 and content alpha .38, with no
elevation. Disabled drag gestures are rejected even on a noninteractive card.

Dragging uses one primary pointer and a Manhattan threshold of 5px. The
component temporarily translates and raises itself, emits logical movement
coordinates and restores authored transform/z-index values and priorities.
Release after dragging emits end and suppresses the immediate synthesized
click. Cancellation and lost capture abort without reporting successful
release. Disabling the card or its drag property, or disconnecting, cancels
active ownership. Authored controls keep their own pointer gestures.

Source hover/focus/press layers use .08/.12/.12 opacity; drag uses .16.
Elevated cards rise to elevation 2 on hover and 4 during drag; filled/outlined
rise to 1 on hover and 3 during drag. Focus/press use the resting elevation.
Interactive focus shows the library focus ring. State-specific elevation
rules override the resting custom-elevation hook, matching existing source.

Three actual drag transition fixtures record both phases at elapsed times
0, 25, 50, 100 and 200ms. With current library tokens, shadow duration is
100ms and state-layer opacity is 50ms; CSS fallback durations are not the
resolved values. Reduced-motion and forced-color rules are source reviewed,
not yet executed as OS preference sessions. Native hover, focus, keyboard,
drag, ripple, cancellation and authored-content behavior require verification.

## Evidence and open gates

Initial source regressions reproduced authored keyboard/pointer interception,
pointer takeover, successful-end reporting on cancellation, lost-capture
leaks, disabled-during-drag behavior, authored-style destruction, missing
generic tabindex semantics, attribute observation and reconnect observation.
Their before/after browser evidence is preserved. Browser pointer lifecycle
cases use synthetic events with guarded capture for nonphysical IDs; they do
not claim device pointer-capture validation. Actual physical pointer coverage
remains pending. Independent review additionally reproduced and corrected synchronous cancellation from mdDragStart callbacks, authored open-shadow control semantics and mutation observation across those roots. Removed shadow subscriptions are released.

Current geometry reference: 130 configurations, 30 transition samples and
18 lifecycle cases, with 7,138 validator assertions. Three focused suites pass
94 tests after the independent-review follow-up. The final matrix was captured
after rebuilding the library, and its screenshot was visually reviewed. Dedicated SwiftUI/Android
implementation, right-panel edits, builder slots, metadata, inspector,
examples, native accessibility, iOS runtime and final audit remain pending.
