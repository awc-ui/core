# Bottom Sheet source review

Status: Web contract and browser reference verified. Dedicated native
implementation and integrated acceptance remain pending.

## Public contract

The 13 properties are `open=false`, `variant=standard`, `headline=''`,
`showDragHandle=true`, `closeable=false`, `scrimDismissible=true`,
`topDivider=false`, `bottomDivider=false`, `sheetAriaLabel=''`,
`scrollShadow=true`, `headlineAlign=start`, `contentAlign=start`, and
`density=0`. The variant accepts standard/detached, alignments accept
start/center/end, and density accepts 0 through −4. `open` is mutable.
`sheetAriaLabel` maps to the aria-label attribute. `scrollShadow` is retained
for compatibility but deliberately has no visual effect: content scrolls
directly without a shadow component. Native APIs should retain and document
that compatibility property rather than invent a new visual behavior.

Both variants are modal in the existing Web implementation. They share a
scrim, scroll lock, focus containment, Escape and drag dismissal. Their
difference is presentation, not modality. Three events have void payloads:
`mdOpen`, `mdClose`, `mdCancel`. User cancellation emits cancel before close;
programmatic close emits only close. `show()` and `close()` set state, are
idempotent, and resolve without waiting for the visual transition to finish.

Four slots provide body, headline, actions and close. Direct named children
determine slot presence, including dynamic insertion, removal and reassignment.
Nested descendants do not belong to the sheet's named slots. An authored
close element owns its own action; the fallback close button dismisses.
Authored headline content works without fallback headline text. A nonempty
explicit label takes precedence over the generated headline association.

Eleven parts expose scrim, container, drag-handle, drag-handle-indicator,
header, headline, close, divider-top, divider-bottom, content and actions.
Sixteen appearance hooks expose container color/shape, content/headline/scrim/
drag-handle/divider/icon colors, width/min-width/max-width,
height/min-height/max-height, detached margin and content inline padding.
Native equivalents must preserve authored content and semantic behavior and
offer those meaningful styling capabilities through typed APIs.

## Geometry and appearance

Below a 640px viewport, standard occupies its full width; detached leaves
16px on each side. At or above 640px, default width is min(640, viewport−112),
centered. The default height is intrinsic with an 80vh maximum. Standard
anchors to the bottom edge with rounded top corners; detached leaves a 16px
bottom margin, rounds all corners and adds elevation 3. Safe-area bottom
padding is part of the Web source, but this desktop reference has zero inset.
Native implementations must use the actual overlay scope and safe area.

Default corners are 28+2*density. The handle hit region is 48+4.25*density
high, with a 32+2*density by 4+.25*density indicator. Hiding the handle leaves
a top inset of 24+2*density. Default body typography is Roboto 400, 14/20,
tracking .25; density changes size by .5 and line height by 1. Headline is
Roboto 400, 24/32 with size +density and line height +2*density. Headlines
wrap; the 280px long-headline reference has a 168px header and 300px sheet.

Content inline padding is 24+2*density. Block padding follows system spacing
tokens: at local densities 0/−1 it is 8/16, at −2 it is 8/12, at −3 it is
4/12, and at −4 it is 4/8. A raw inherited density scale changes calculated
metrics without rebinding those spacing tokens; it therefore differs from
an explicit local density property. Authored actions have their own intrinsic
height, with large and extra-large token padding and a token-controlled gap.

At an 800×480 viewport, the default headline/handle/body fixture is 640×172.
The fixtures with close, two 32px actions and both dividers have heights
254, 244.75, 223.5, 210.25 and 197 at densities 0 through −4. The body
scrolls while header/actions stay fixed. Extremely short height constraints
can clip chrome; the measured 240px viewport caps the sheet at 192px even
when chrome requires 194px. Explicit minimum sizes override smaller maximums.
Zero width/height with no handle still retains 24px top padding.

The all-hooks fixture exercises alpha colors, 360×360 size, 28px detached
margin, 13px content gutters and asymmetric elliptical shape. Standard uses
the shape value on its individual top corners; detached interprets the same
value as a border-radius shorthand, so the resulting corner geometry differs.
The matrix also includes public-part styling, authored slots, hidden and
closed states. Closed content stays mounted but inert and aria-hidden.

## Lifecycle and interaction corrections

The source now seeds and observes owned slots before rendering, keeps an
authored headline accessible, and gives explicit labels precedence. It
cancels deferred opening work on close/disconnect, so rapid open→close
cannot reactivate hidden content. Detached instances do not acquire document
resources; reconnecting an open instance reacquires them without duplicate
open events.

A shared per-document ModalSession owner stack protects scroll lock and top-modal
interaction. Removing a closed or underlying sheet cannot unlock an active
sheet. Closing an underlying sheet forwards its original opener through the
remaining stack, so the final close restores the correct outside element.
The original inline overflow value and priority are restored on final release.
A newly active sheet cancels an in-progress drag on the previous owner; late pointer events cannot dismiss the covered sheet. The session retains its owning document so adoption into another document releases the old listeners and lock before acquiring new ones. Actual browser checks cover adoption both alone and above another open sheet.
Dialog, Bottom Sheet and Side Sheet share this owner stack. Actual browser
scenarios verify both opening orders, covered dismissal, scroll priority and
final focus restoration; the Side Sheet fixture records its mixed-type cases.
The shared utility additionally clears ownership before synchronous focus
restoration and publishes the new owner before its onCovered callback.

Focus guards now wrap in the correct direction. Traversal follows composed
slot/shadow order and excludes hidden, inert, disabled and negative-tabindex
targets. Disabled fieldset inheritance respects the first-legend exception.
Focus capture and containment use the sheet's owning root, including sheets
inside open or closed outer shadow roots, without recursive focus loops.
Dismissal key listeners run during bubbling so an authored child can consume
Escape through preventDefault or stopPropagation before the sheet dismisses.
An unhandled Escape dismisses the current top owner exactly once. The preserved
capture-phase browser baseline demonstrates the original child-ownership bug.

Dragging is restricted to the active primary pointer. A downward distance
strictly greater than 100px dismisses. Wrong pointers and secondary buttons
cannot interfere. Pointer cancellation, lost capture, hiding the handle,
closing and disconnecting clear temporary transforms and transitions without
unintended cancellation events. Native gestures need equivalent cancellation
and lifetime ownership, not only an end-of-drag callback.

## Motion and evidence

Scrim and panel opacity use 300ms standard easing. Panel translation uses
400ms emphasized easing. The browser oracle records the actual three
transitions inside the shadow root at elapsed times 0, 75, 150, 300 and 400ms,
for both phases, both variants and 360/800px viewports: 40 samples total.
An earlier sampler that missed shadow-root animations is preserved as
`discarded-motion-no-shadow-animations.json` and is not acceptance evidence.
Reduced motion removes the shell transitions in source; an OS preference
session has not yet been executed.

Four focused Bottom Sheet suites pass 122 tests, and nine shared ModalSession
tests cover cross-type resources, focus forwarding, adoption and reentrancy
(131 tests in five suites). All 20 Bottom Sheet browser lifecycle scenarios
were recaptured after extraction. The browser validator passes 21,731
assertions across 136 light/dark configurations, 40 transition samples and
20 lifecycle scenarios. Fixtures load isolated font definitions and unmodified
library tokens. The final screenshot was visually reviewed. Initial failing
lifecycle evidence and intermediate test failures remain alongside the final
results. The source was independently reviewed for focus and restoration.

The subsequent keyboard-only follow-up passes 297 tests across all three modal
components and shared utilities, plus nine actual browser child-handler cases
(27 assertions). The original layout and transition captures remain unchanged.

Dedicated SwiftUI/Android APIs/renderers, retained right-panel edits, event
and method wiring, builder slots, actual native layout/paint/motion, inspector,
OS accessibility, iOS runtime checks, Laboratory QA and the separate final
native audit remain required. macOS SwiftUI results do not constitute iOS
runtime verification.

## Decisions (autonomous, 2026-10-31, reversible)

Recorded by gate-7 fix fork d4 for audit finding R4-04. Native already behaves as described; each entry names the
alternative and how to revert.

1. **Dialog over a sheet — paint order.** Chrome paints the source's z-index order: each sheet's scrim (1000) and surface
   (1001) are stacked separately, so a later sheet's scrim lies below an earlier sheet's surface, and a dialog opened from
   a sheet sits in its own z layer ([native-modal-layer.md](native-modal-layer.md)). **Decision:** native follows Chrome's
   rendered order (the modal scope sorts the published `<id>#scrim` / `<id>` entries by z-index). *Alternative:* owner
   (open) order, which the source probably intends. *Revert:* sort the modal-layer entries by open order in
   `ModalScope.swift` / `native-modal-layer` (Compose) and recapture the mixed-stack oracle.
2. **Dragging-indicator opacity 0.8.** The source declares the `--dragging` indicator opacity 0.8, but Chrome never renders
   it during a handle drag in the captured runs; only hover (0.6) and rest (0.4) are observable.
   **Decision:** native renders what Chrome renders (0.6/0.4). *Alternative:* the declared 0.8 while dragging. *Revert:*
   set the indicator opacity to 0.8 while `dragging` in `NativeBottomSheet.swift` / `NativeBottomSheet.kt` and add a drag
   paint case.
