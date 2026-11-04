# Snackbar source review

Status: source contract and browser reference reviewed. Dedicated native
implementation, shared controls, examples and native acceptance remain pending.

## Public contract

Eleven properties: `open` (false), `message` (empty), `action` (empty),
`closeable` (false), `autoHide` (true), `autoHideDuration` (4000 milliseconds),
`position` (bottom), `stacked` (false), `politeness` (polite), `dismissLabel`
(Dismiss), and `density` (0).

Three events: `mdOpen` and `mdAction` carry no payload; `mdClose` carries
`{reason: 'auto' | 'action' | 'close'}`. Public asynchronous methods are
`show()` and `hide(reason = 'close')`. Slots are default supporting content,
`action`, and `close`. Four own parts are `surface`, `message`, `actions`
and `close`; the fallback icon button also forwards its icon as `close-icon`.

Seven appearance hooks set container, message, action and close colors;
container shape; minimum width; and maximum width. Native equivalents need
RGB/RGBA, asymmetric elliptical shapes, meaningful width constraints and
authored content builders. DOM/CSS syntax is not a substitute for the
corresponding native visual capability.

## Lifecycle, events and content

Opening an attached component emits `mdOpen`, raises it above open peers,
attaches Escape handling and starts auto-hide if enabled. Initial `open=true`
also emits. Reconnecting an already-open component restores resources without
emitting another opening. A new open request while detached is deferred until
connection; closing while detached cancels that pending opening.

Auto-hide changes `open` to false and emits reason `auto`. The fallback action
emits `mdAction` immediately, then **starts a new auto-hide timer**, including
when `autoHide=false`. It does not immediately dismiss or emit reason `action`.
This is existing source behavior with a dedicated regression test. `hide('action')`
is the public way to request that close reason.

The fallback close button and Escape, when `closeable=true`, wait 150ms for
ripple feedback before setting `open=false` and emitting reason `close`.
`hide()` is immediate and idempotent when already closed. Directly assigning
`open=false` does not synthesize `mdClose`.

Pointer entry and focus entry pause an active timer. Pointer exit or focus
leaving the surface restarts its full duration; it does not retain elapsed
time. Moving focus between descendants does not resume. Changing duration
does not reschedule an already-running timer until a later restart.
Disconnect cancels both timers, Escape handling and the slot observer.
Repeated close requests coalesce during ripple feedback. Ending an open cycle
also cancels pending ripple dismissal so it cannot close a later reopening.

Authored default content replaces the message fallback. Authored action/close
content appears even with empty `action`/false `closeable`, and receives the
corresponding inherited color. Its own event handlers remain author-owned;
the wrapper does not automatically call `mdAction` or close the snackbar.
Adding, removing and reassigning direct named children updates the outlets.

Open-peer ranks are compacted in their existing paint order before placing
the newly opened component last. Repeated reopenings remain bounded by the
currently open count; peer discovery uses the current document's snackbars.

## Geometry and rendering

The host covers its viewport and positions an intrinsic surface within it.
Nine positions combine top/bottom/vertical-center with logical start/end or
horizontal center. RTL mirrors start/end placement and control ordering.
Default edge inset is the extra-large spacing token, 24px at density0.
Below 600px viewport width the large spacing token is used, 16px at density0,
and the surface fills available width. The fixture uses **actual iframe
viewports** at 280, 360, 599, 600 and 800px, not a narrow arbitrary div.

Surface defaults: minimum width288, maximum568, minimum height
`max(36, 48+3*density)`, logical-start padding `max(8,16+2*density)`.
End padding follows that formula without controls, the small spacing token
with only an action, and the medium token with a close control.
Color roles are inverse surface, inverse on-surface and inverse primary.
Shape defaults to extra-small4; elevation uses level3.

Message text is Roboto400, `max(12,14+.5*density)` font size,
`max(16,20+density)` line height, .25 tracking, and
`max(6,14+2*density)` block padding. It wraps according to the actual
remaining width. The fallback action is the existing text/sm `md-button`.
The fallback close is a standard `md-icon-button`, with width/height
`max(32,40+4*density)` and icon size `max(18,24+density)`.

Stacked mode is a two-column/two-row grid. Message is first row/start,
close is first row/end with the extra-small top margin, and action spans the
second row aligned to logical end. Column gap follows the medium spacing
token; row gap is6. Minimum height68, small-token block padding and
extra-small message bottom padding are retained even when individual
controls are absent.

Spacing tokens also vary with local density. Consequently local density−4
and inherited raw `--md-sys-density-scale:-4` are not identical: raw scale
changes formula-based dimensions but does not rebind every spacing token.
The oracle preserves both cases. Do not collapse these to one native fixture.

The source permits minimum width to win over a smaller maximum. Zero width
hooks retain the padding floor and may let text overflow. Closed content
keeps layout but is invisible; `hidden` removes layout and paint.

## Motion and accessibility

Opening fades0→1 and translates the entire viewport-sized host from one
viewport height below for bottom positions, or above for top positions.
Center/start/end only fade. Duration250ms and emphasized-decelerate
`cubic-bezier(.05,.7,.1,1)`.

Closing uses200ms and emphasized-accelerate
`cubic-bezier(.3,0,.8,.15)` with visibility becoming hidden at the end.
Actual CSS transitions were paused at four explicit times in each phase for
bottom LTR/RTL, top and center. These are sampled browser animation frames,
not wall-clock performance measurements. Reduced motion removes transitions;
forced colors adds a CanvasText surface border. Those media modes are
source-reviewed here, not OS/browser preference execution.

The host is an atomic live region: polite/status or assertive/alert.
Fallback close receives localized `dismissLabel`. Native announcements,
roles, focus/keyboard traversal, cancellation and OS accessibility operation
still need platform-specific implementation and verification.

## Corrections and evidence

Source defects corrected before migration:

- Conditional named slots could never discover authored children without
  fallback properties. Initial light-DOM inspection and a connection-owned
  filtered observer now handle initial and dynamic content.
- Detaching removed timer/Escape behavior permanently. Reconnection restores
  it without duplicate opening events; detached opening has no live effects.
- Repeated openings increased stacking ranks beyond the live peer count,
  contrary to the documented bounded policy. Stable rank compaction preserves
  paint order and keeps the offset bounded.

`outputs/native-parity/md-snackbar` contains61 configurations per light/dark
theme, nested button/icon measurements, semantics, slot geometry, four
transition configurations with opening and closing samples, three actual
reconnect scenarios and six dynamic-slot states. The validator passes8,547
assertions. The failed stacking regression and pre-fix slot/reconnect browser
results are preserved separately. Exact source/artifact hashes and commands
are recorded in `web-evidence.json`. Two Web suites pass80 tests, including
the reconnect, detached-opening and bounded-stacking regressions; the full
development build succeeds.

Native appearance/layout, mounted lifecycle and methods, authored content,
events, accessibility, right-panel parity, compiled examples, both Laboratory
previews, independent final audit and actual iOS SDK/runtime checks remain
required. No native migration completion is claimed by this source checkpoint.
