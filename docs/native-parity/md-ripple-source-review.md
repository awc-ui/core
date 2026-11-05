# Ripple source review

Status: Web source and browser reference verified. Dedicated native primitive and
public controller verified on macOS, iOS and Android ([md-ripple.md](md-ripple.md)); Laboratory and independent
parity acceptance remain pending.

## Public contract

One property, disabled=false; no public events, slots or parts. Two methods:
trigger() starts a centered keyboard/programmatic wave and releases it after
growth; whenSettled() waits for the current cycle with the existing 200ms upper
bound. That bound can return while a held or long-growing wave is still visible.
It must not erase the wave's settlement state or settle a subsequent wave.
The API comment now states the bound instead of promising unconditional fade
completion. Native controller documentation must retain this distinction.

Six appearance hooks: color, opacity, extend-inline, extend-block,
grow-duration and grow-easing. Color defaults to inherited currentColor and
preserves alpha. Opacity defaults to .12, clamps finite values to 0–1 and falls
back for invalid values. Per-instance values override the inherited surface.
The duration accepts ms, s and legacy unitless milliseconds, including zero;
invalid durations fall back to 450ms. Invalid easing falls back safely to the
standard cubic-bezier(.2,0,0,1), without throwing or stranding a wave.

Extensions accept nonnegative concrete px values (legacy unitless values also
work). Percentages, calc() and other unresolved expressions are not accepted;
the public source already required concrete pixels, but parseFloat previously
treated a percentage as pixels. The native API should use resolved logical
lengths for these two hooks rather than inventing a containing-block reference.

## Host, geometry and motion

Ripple is a decorative overlay inside a positioned surface; it has no intrinsic
size, semantics, content or action callback. Its own host uses display:contents
and aria-hidden=true. The absolute overlay fills and clips its containing box,
inherits border radius, and never intercepts pointer input. A native surface
decorator/builder is the equivalent of this composition; a standalone painted
button or static circle is not equivalent.

Pointer input binds to the nearest boxed parent, crossing a shadow boundary
when necessary. A display:contents wrapper is skipped for input and geometry.
The clip's CSS radius still inherits through the immediate parent: a boxless
wrapper with no radius resolves to zero, while a direct 12px-radius surface
produces a 12px clip. This measured distinction remains part of the reference.
An embedding component may clip further at its own outer boundary.

The origin is the physical pointer position within the host and does not mirror
in RTL. The final radius is the distance to the farthest corner of the host
rectangle expanded symmetrically by the two extension hooks. The wave's left
and top are origin minus radius, with diameter twice radius. trigger() uses
the host center. Zero-size and off-surface synthetic origins are measured too.

The circular wave scales from zero to one at constant peak opacity over 450ms
by default. Releasing early waits for growth, then fades over 150ms with the
standard easing. A held pointer remains fully visible after growth. trigger()
releases automatically. A new activation cancels/removes the old cycle before
creating its replacement; delayed completion from the old cycle cannot alter
the new wave or resolve its waiters.

The inherited --md-sys-ripple-enabled signal is read for every activation and
suppresses allocation when zero. CSS opacity also hides an already-running
wave if that setting changes. There is no separate prefers-reduced-motion
branch in this Web primitive; an application can suppress the effect or set
its grow duration. Do not claim an untested OS preference mapping as parity.

## Ownership and cleanup corrections

Only a primary activation pointer with button zero starts a wave. Releases
from a different pointer are ignored. Both release listeners are removed
together, and the owning document's window is used. Window blur, disabling,
disconnect and replacement cancel animations, remove nodes and settle only
the affected cycle. Reconnect binds to the new surface. Deferred binding cannot
attach after the element has disconnected. Cancelled Web Animations promises
are handled, including cancellation before release, so there is no unhandled
rejection. A legacy animation adapter without fade.finished retains a timer
fallback which is cleaned up on teardown.

The original browser baseline demonstrated secondary-pointer activation,
foreign release, stale disconnected/disabled waves, duplicate reconnect waves,
ignored local opacity, seconds interpreted as milliseconds, percentage extent
parsing, overlapping replacements, unhandled grow cancellation and invalid
easing rejection. Source and failing evidence are preserved before changes.

## Verification and remaining gates

38 focused tests pass. The dependent run passes 484 tests across eight suites
covering Ripple, Button/Button Group, Icon Button and Search. The combined core
build succeeded. Actual Chromium captures cover 46 configurations in each
default theme, four grow/fade configurations with 36 elapsed-time samples,
and 16 lifecycle cases. The validator passes 1,669 assertions. The dark matrix
screenshot was visually reviewed. The lifecycle matrix uses synthetic pointer
events; a separate physical browser click produced a trusted mouse event,
correct centered geometry and complete release cleanup. Disabled physical and
programmatic activation allocate no wave; re-enabling restores trigger().

Native geometry/paint/timing, parent composition, controller methods, global
suppression, pointer ownership, teardown, inspection, all six style controls,
copyable compiled examples, native preference/accessibility behavior, iOS
execution and final independent audit remain pending. Existing native button
ripples do not by themselves prove this public primitive's full contract.
