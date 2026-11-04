# Dialog source review

Status: Web source contract and browser reference verified. Dedicated native
implementation and acceptance remain pending. This is not a native completion
record or an iOS runtime claim.

## Public contract

Thirteen properties: open=false, headline='', dialogAriaLabel='' (HTML
aria-label), icon='', fullscreen=false, scrimDismissible=true, locale='en-US',
closeLabel='', cancelLabel='', okLabel='', divider=false, headerDivider=false,
and density=0 through −4. Explicit accessible names take precedence over the
visible headline; clearing the explicit name restores the headline reference.

Three void events: mdOpen, mdClose and mdCancel. Escape, an enabled scrim,
the fullscreen close control and the default Cancel button emit mdCancel before
closing and emitting mdClose. The default OK button and close() emit mdClose
without mdCancel. Repeating show() on an already open dialog does not emit a
second mdOpen. The events do not currently veto dismissal via preventDefault.

Three methods: show(), close() and whenClosed(). show() respects the shared
overlay readiness contract. whenClosed() waits for the current open cycle and
actual shell exit motion, allowing safe unmounting. Closed instances are inert,
hidden from accessibility and do not consume Escape or Tab.

Five authored slots: default body, headline, icon, actions and header-action.
Authored actions replace the two fallback buttons. The fullscreen header uses
the headline slot too; header-action is fullscreen-only, and icon is basic-only.
Dynamic addition, removal and slot reassignment are observed. Native builders
must preserve authored content and callbacks instead of flattening it to text.

Eleven parts: scrim, container, header, icon, headline, content, divider, actions,
cancel-button, ok-button and close-button. Ten appearance hooks: container
color/shape, headline/content/icon color, icon size, scrim color, divider color,
surface z-index and scrim z-index. Native layer ordering may need a scoped
equivalent rather than a DOM integer, but it must retain explicit semantics.

## Layout and appearance

The basic dialog is centered in its viewport, with width clamped to 280–560px
from viewport width minus 48px. Its maximum height is viewport height minus
96px. The default radius is 28+2*density, with a 16px floor. It uses the resolved
surface-container-high token, elevation 3 and a .32 black scrim. Only the body
scrolls; the shell clips without allowing focus to scroll the entire frame.

Basic header insets are 24+2*density, its icon/headline gap is 16+2*density,
and its default icon is 24px. A rendered icon centers the header; otherwise the
header starts at the leading edge. Headline typography is 24+density over
32+2*density, weight 400. Body typography is 14+.5*density over 20+density,
weight 400 and .25 tracking. Body block insets are 16+2*density and inline
insets 24+2*density, subject to the floors in the source.

Basic actions align at the trailing edge, use the spacing tokens and omit top
padding without a divider. A divider restores the action top inset. Fallback
buttons use the existing native Button implementation and inherited density.
With the fixture's 60px body, the ordinary headline/body/actions dialog is
212px tall; icon and divider increase density-zero height to 277px. The
matching full-feature density −4 fixture is 205px tall.

Fullscreen occupies the viewport at every breakpoint, including 240px width.
It has no scrim, elevation or corner radius. Header height is 64+4*density with
a 48px floor, horizontal insets 16+2*density, and gap 12+2*density. The close
target remains 40×40 with a 24px glyph. Its headline is one line with ellipsis,
22+density over 28+density. The body top inset is 24+2*density. The actions
row's minimum height excludes padding: at density zero its outer minimum is
72px, and at density −4 it is 48px. Treating it as a border-box would diverge.

Authored part borders also add to the content-box shell. The 2px-border fixture
is 4px larger on each axis; this is measured source behavior. Extremely short
basic viewports clip header/actions once the body reaches its minimum padding;
the reference preserves that existing behavior rather than inventing a
different native scrolling model. Hidden hosts have zero layout bounds.

Built-in labels resolve 14 translated languages plus English; unknown locales
fall back to English. Explicit labels override locale defaults. The fixture
checks 16 locale inputs in both variants, both directions, five densities,
seven viewport widths, tall/short content, authored slots, all appearance hooks,
part styling, empty content, explicit accessible names, hidden and closed state.
All 112 configurations per theme use unmodified library palette tokens and an
isolated font-only stylesheet. The screenshot was visually reviewed.

## Lifecycle, focus and motion

Dialog, BottomSheet and SideSheet share a document-scoped ModalSession stack.
Only the top owner traps focus or handles dismissal. The stack preserves the
original document overflow value and priority, keeps the page locked while a
lower modal remains, and restores the appropriate opener when the last owner
closes. Closed instances cannot release another component's lock. Reconnection
and document adoption release old resources and acquire new ones correctly.

Focus follows the composed subtree, including slotted native controls and
open shadow roots; an outer closed shadow root can still restore its own
opener. Hidden, inert, disabled, visibility-collapsed and hidden-input targets
are excluded, including hidden inputs with an explicit tabindex. Disabled
fieldset descendants are excluded except those in its first legend. Empty
dialogs trap Tab on the surface. Deferred focus is canceled on close/detach.

Dismissal key listeners run during bubbling. An authored child editor or popup
can consume Escape with preventDefault or stopPropagation before its modal
parent handles it; unconsumed Escape dismisses only the top modal once. A
real browser follow-up preserves the failing capture-phase baseline and verifies
all nine child-handler cases across Dialog, Bottom Sheet and Side Sheet.

Actual browser motion samples cover basic/fullscreen at 360px and 800px in
both phases at 0/50/100/200/300ms. Opacity and translation use 300ms standard
cubic-bezier(.2,0,0,1). Basic enters from 20px below its centered position;
fullscreen enters from 30px below. Native comparison should use sampled
matrices, not Chromium's serialized percent-plus-pixel keyframe expression.
Reduced-motion and forced-color branches are source reviewed, not executed
as OS preference sessions.

## Verification and remaining gates

Before/after regressions preserve failures for missing fullscreen authored
headlines, dynamic slots, explicit accessible names, closed interaction,
modal ownership/reconnect/adoption, focus visibility and narrow fullscreen
overflow. The final focused run passes 89 Dialog tests, 75 Tooltip tests and
9 shared ModalSession tests (173 total, seven suites). The rebuilt browser
reference passes 35,206 checks over 224 theme/configuration combinations,
40 motion samples and 17 lifecycle scenarios. Both Dialog/BottomSheet stack
orders were checked in this fixture; SideSheet's fixture covers its mixed
stack orders independently.

The keyboard follow-up additionally passes 297 focused tests across the three
modal components and shared utilities (13 suites), plus 27 assertions over
nine actual browser child-handler cases. The original geometry, motion and
17 lifecycle captures remain unchanged because this follow-up changes only
keyboard listener phase. The final combined core build passed in 12.96 seconds.

Dedicated SwiftUI/Android layout and interaction implementations, authored
builders, metadata, all right-panel controls, inspector, compiled examples,
native accessibility, iOS execution and independent final audit remain open.
