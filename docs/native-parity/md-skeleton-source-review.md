# Skeleton source review

Status: Web source contract reviewed and measured. Dedicated native migration
and acceptance remain pending.

## Public contract

Ten properties: `variant`, `animation`, `lines`, `width`, `height`, `fullWidth`,
`fullHeight`, `ariaLabelProp` (attribute `aria-label`), `announce`, and `density`.
No events, slots or methods. Three parts: `shape`, `line`, and `line-last`;
the tapered last line exposes both `line` and `line-last`.

Eleven appearance hooks: base color, highlight, radius, rounded radius, width,
height, circular size, line gap, pulse duration, wave duration, bloom duration.
Widths/heights are CSS lengths, including percentages, font-relative units and
calculations. Native APIs need meaningful sizing equivalents and explicit
documentation for syntax that cannot translate; do not silently treat every
string as an absolute point value.

An announced skeleton exposes status, busy=true, polite live updates and its
label (default `Loading`). Decorative `announce=false` removes those attributes
and hides the skeleton from accessibility. Hidden removes layout and paint.
The visible shapes contain no authored content and are not interactive.

## Layout and paint

Text uses `max(1, lines | 0)` rows, default1. Multiple rows taper the last
row to60% of the available width, anchored at logical start. Gap is
`max(4, 8+d)`; default row height is `max(.75em, (1+.05*d)em)`.
All lines have the extra-small corner token, default4.

Rectangular and rounded default height is `max(80, 120+8*d)`.
Rectangular uses the same extra-small corner radius, despite an earlier
property comment suggesting square corners. Rounded uses `max(8, 12+d)`.
Circular default size is `max(28, 40+3*d)`, with50% radii. Explicit width and
height can produce an ellipse; it is not always a square. Text and other shapes
default to the available width. Density0 inherits; negative local rungs win.

Property width/height override their public hooks. Full width overrides a
fixed width. Full height establishes a100% host block size with the ordinary
height as a minimum; shape variants fill that host, while text rows retain
their individual line height. A full-height circle derives its width from
height and wins over full width. With an auto-height block parent it instead
uses the available width and its aspect ratio.

Percentage height without full height is relative to the auto-sized host,
not directly to the outer parent: rectangular/rounded shapes collapse to0
in that case, text retains only its line gaps, and circular aspect ratio
provides a square. The fixture records that actual CSS behavior. Consumers
need a definite host height for percentage children.

Default fill is on-surface mixed with transparent at16% alpha; this must
remain translucent over the underlying native surface. Highlight uses
surface-bright, with a5% on-surface fallback. Custom RGBA, asymmetric/elliptical
radii, zero dimensions and direct part overrides are included in the oracle.

## Motion and lifecycle

Every mount has an entrance, including `animation=none`: opacity0→1 and
centered scale.96→1,500ms under the fixture's spring token,
cubic-bezier(.38,1.21,.22,1). `none` only disables the recurring pulse/shimmer.

Pulse changes each shape/line opacity1→.55→1 with the standard easing applied
to each half-cycle. Wave clips a200%-wide gradient strip to each shape:
transparent at0/35%, highlight at50%, transparent at65/100%; strip block
insets−10%, inline-start−100%, transform translateX(−100%→200%) with
skewX(−12deg). Effective RTL reverses the animation, including inherited RTL,
but an explicit LTR host inside an RTL ancestor remains forward.

The resolved fixture pulse and wave durations are **800ms**, from the theme's
extra-long2 token;1800ms is only the CSS fallback. Public duration hooks win.
The animation capture contains actual CSS keyframes and nine samples for15
configurations, including custom timing and RTL.

Reduced motion makes the component select animation=none and CSS removes
the entrance/shimmer. The slower pulse rule is only a fallback while the
state update is pending, not the settled reduced-motion behavior. Forced
colors uses GrayText with forced-color-adjust disabled.

Three source defects were corrected before native porting:

- Full-height rectangular/rounded shapes could paint0px inside a120px host
  when the parent had auto height. The shape now shares the host's minimum
  height fallback, while definite-height and circular cases retain their
  measured behavior.
- The inherited RTL shimmer selector did not match the host. Effective
  direction now controls it, with direct RTL and explicit LTR overrides checked.
- Detaching a skeleton removed its media listener permanently. Reconnection
  now refreshes the current preference and attaches exactly one listener;
  detaching removes it again. Tests exercise actual detach/reinsert and
  preference changes both while detached and after reattachment.

## Evidence and pending gates

`outputs/native-parity/md-skeleton` contains106 configurations per light/dark
theme, host/part/pseudo geometry and styles, semantic attributes, actual
keyframes, nine animation frames for15 light-theme configurations, screenshots,
and a reproducible browser fixture. The validator passes5,136 assertions.
Two Web test suites pass17 tests and the full development build succeeds.
The pre-fix98-fixture captures are retained under
`before-responsive-motion-fix`.

CSS animations are paused at explicit times. Resting measurements use a
finished entrance and recurring animation time0; they are not wall-clock
animation measurements. Reduced-motion lifecycle tests use a controlled
MediaQueryList rather than an OS preference browser session. Forced colors
was source-reviewed only.

Still required: native sizing API and appearance hooks, measured renderers,
animations and native preferences, native accessibility, right-panel parity,
compiled examples, both Laboratory previews, independent audit and actual
iOS SDK/runtime validation. No native completion is claimed here.
