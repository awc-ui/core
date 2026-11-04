# Side Sheet source review

Status: Web source and browser reference verified. Dedicated SwiftUI/Android
migration and acceptance remain pending; this is not a native completion record.

## Public contract

Twelve properties: open=false, variant=standard, side=end, headline='',
closeable=true, showBack=false, scrimDismissible=true, topDivider=false,
bottomDivider=false, detached=false, sheetAriaLabel='' (aria-label) and density=0
through −4. Four void events: mdOpen, mdClose, mdCancel and mdBack. Methods
show(), close() and whenClosed() preserve the shared OverlayLifecycle contract;
whenClosed resolves after the current cycle and shell exit motion finish.

Five slots: default content, headline, back, actions and close. Authored back and
close controls replace the default controls and retain their own callbacks;
they do not automatically emit mdBack or dismiss the sheet. The back slot is
present only in modal presentation with showBack=true. Actions and the optional
bottom divider are present only when direct actions content is assigned.
Dynamic additions, removals and slot reassignment are observed after reconnect.

Nine public parts: scrim, container, header, headline, close, divider-top,
divider-bottom, content and actions. Nine appearance hooks: container color/
shape, headline/content/scrim/divider/icon color, width and maximum width.
Native APIs must expose typed equivalents and native authored composition;
arbitrary CSS selectors cannot be interpreted as a native API.

## Layout, palette and motion

The standard variant occupies normal document flow, with region semantics and
no modal resources. In a definite parent, width is min(requested, maximum,
parent width), height is 100%. Default requested width is max(280,360+16*density)
and maximum is max(320,400+16*density). The adjacent edge divider is inside the
width. In standard presentation, side selects the divider edge, not a fixed
viewport position; inline layout is controlled by the containing document.

The modal variant is a fixed viewport overlay with dialog/aria-modal semantics,
scrim, focus containment and scroll ownership. Logical start/end respects RTL.
Default standard paint is surface; modal uses surface-container-low. Both honor
the public container color, including alpha. Content uses on-surface; headline
and fallback icons use on-surface-variant. Dividers use outline-variant. Scrim
is black at .32 alpha by default. Fallback buttons and authored IconButton slots
receive the public icon-color hook directly: forwarding the parent's private
--_icon-color alias into a child with the same private name previously created
a CSS variable cycle. Authored plain buttons keep explicit authored paint.

Detached standard presentation reserves 16 px margins within the host width and
height. Detached modal presentation reserves both horizontal margins before
clamping the requested width; vertical inset is max(8,16+2*density). At a 280 px
viewport, both detached variants now measure 248 px wide at x 16 rather than
extending beyond the viewport. The detached radius defaults to the 16 px system
large shape; container-shape applies to detached surfaces. The custom shape
fixture uses 18 px/8 px alternating corners,310 px requested width and 330 px maximum.
A standard detached surface then measures 278 px; a modal surface remains 310 px
when the viewport has enough room. The affine width fixture calc(60%−12 px)
resolves against 800 px but is capped at 400 px; an explicit 220 px maximum caps 500 px.

Header padding is max(12,24+2*density) inline/top and max(8,12+density) bottom.
Header gap is max(4,12+2*density). Headline metrics are Roboto 400,
max(16,22+density) over max(22,28+density), with zero tracking. Fallback controls
are max(32,40+4*density) square; icon size is max(18,24+density). Content has
max(12,24+2*density) inline padding and max(8,12+density) block padding; Roboto 400
is max(12,14+.5*density) over max(16,20+density), with .25 px tracking. Content
scrolls independently and can shrink to fit a short viewport. Actions retain
max(40,72+4*density) minimum height and max(4,8+density) gap. Dividers are 1 px.

Modal opening/closing uses 300 ms transform and opacity transitions with the
resolved cubic-bezier(.2,0,0,1) token. Actual browser samples at 0/75/150/300/400 ms
record all three shell transitions, both phases, narrow/wide and detached/flush
presentations. Translation and fade follow the same measured easing. Reduced
motion and forced-color rules are source reviewed; OS preference execution is
still a separate gate. Hidden hosts have zero layout; closed modal shells stay
mounted but inert, transparent and offscreen.

## Lifecycle and interaction fixes

ModalSession now coordinates Side Sheet with Dialog and Bottom Sheet, including
original document ownership during adoption, overflow values/priorities,
previous-focus restoration through open or closed outer shadow roots and
nested-owner restoration chains. Only the current owner reacts to Escape,
scrim, back and focus guards. A covered modal cannot dismiss a different owner.
Standard detachment cannot release a modal's lock. Switching an already-open
sheet between standard/modal acquires or releases modal resources without
emitting an artificial close/open cycle. Detached property edits acquire no
resources; reconnect restores listeners and focus ownership.

Explicit sheetAriaLabel takes precedence over a headline reference. Authored
headline content supplies the accessible name. Focus traversal follows actual
slot/open-shadow order, excludes hidden/inert/styled-hidden and disabled form
controls, preserves the disabled-fieldset first-legend exception, and excludes
hidden inputs even with authored tabindex. Closed/covered guards are inert.
The rapid open→close race cannot leave a closed panel interactive.

Escape and scrim emit mdCancel then close when scrimDismissible=true. The
existing source contract also protects Escape when scrimDismissible=false.
The fallback close control remains an explicit dismissal even when scrim
protection is enabled. Back emits mdBack and leaves the panel open. Authored
back/close slots retain independent callback ownership.

## Verification and remaining work

Before changes,55 focused tests passed;13 new lifecycle/ownership regressions
all failed against the old source. Final 68 tests in three suites pass. Source,
before-browser evidence and the additional pre-icon-color checkpoint are kept
under outputs/native-parity/md-side-sheet. Final core build passed in 13.53 s.

The final browser reference contains 170 configurations (85 in each default
palette),40 actual transition samples and 22 lifecycle scenarios. The validator
passes 29,456 assertions, including rendered geometry, default and alpha paint,
all hooks, nested icon tint, authored controls, public part effects, hidden
states, methods, event sequence and mixed modal ownership. Final screenshots
were visually reviewed. Browser lifecycle fixtures invoke DOM events and
focus; physical keyboard/pointer input and OS accessibility are separate.

Dedicated native implementation, right-panel edits, slot builders, public
examples, inspector, platform preference checks, native accessibility,
actual iOS SDK/device execution and final independent parity audit remain open.

## Decisions (autonomous, 2026-10-31, reversible)

Recorded by gate-7 fix fork d4 for audit finding R4-04. Native already behaves as described; each entry names the
alternative and how to revert.

1. **Escape protection is inconsistent across the modal family.** **Decision:** keep md-side-sheet's own source contract
   (Escape and scrim emit mdCancel then close when `scrimDismissible=true`; protected when false; the close control is
   always an explicit dismissal). Harmonising dialog / bottom sheet / side sheet is a Web-source decision for the source
   owner. *Revert:* n/a (follows the source).
2. **Colour hook spanning two defaults.** `--md-side-sheet-container-color` defaults to `surface` for the standard variant
   and `surface-container-low` for the modal variant. **Decision:** native keeps the per-variant defaults (the typed
   `containerColor` overrides both, as the hook does). *Alternative:* split into two hooks. *Revert:* n/a until the source
   splits the hook.
3. **Back wrapper without a part.** The source exposes no `::part` for the back control's wrapper. **Decision:** no native
   styling target for the wrapper either (the source has none to mirror).
   *Revert:* add a typed part when the source adds the part.
4. **Hard-coded English names** ("Back", "Close side sheet", "Side sheet"). **Decision:** native uses the same strings.
   *Revert:* map label properties once the source has them.
5. **RTL motion via `:host-context([dir=rtl])`.** Native keys the slide offset on the resolved layout direction, which
   gives Chrome's result for every tested case (dir on the host or an ancestor). **Decision:** keep the resolved direction
   (it also follows direction changes that `:host-context` would miss). *Revert:* n/a.
