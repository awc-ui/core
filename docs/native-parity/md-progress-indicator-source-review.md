# Progress Indicator source review

Status: Web reference measured and corrected; dedicated native migration and
acceptance remain pending. A platform default spinner cannot reproduce this
component's geometry, choreography or completion lifecycle.

## Public contract

Fourteen properties: `variant`, `value`, `max`, `indeterminate`, `thickness`,
`wave`, `waveAmplitude`, `waveLength`, `waveSpeed`, `size`, `fourColor`, `label`,
`complete`, `density`. One event, `mdComplete`, with no detail; no public slots
or methods. Three parts: `track`, `active-indicator`, `stop-indicator`.

Thirteen appearance hooks cover active/track/stop colors and shapes, stop size,
stop trailing space, track-to-active gap, and four cycling colors. These are
contextual: circular strokes use round caps rather than CSS corner radii, the
stop exists only for determinate linear progress, and four-color cycling applies
to flat circular indeterminate progress. The current wavy circular source does
not cycle colors even when `fourColor` is true; do not label that source behavior
as an unimplemented native feature.

Host semantics are `progressbar`, optional nonempty label, minimum0, finite
positive maximum or0, and clamped raw current value. Indeterminate omits the
current value. Visual fraction is clamped `value/max` with a falsy maximum
yielding0. The separate numeric-edge capture confirms that a negative maximum
can produce a nonzero visual ratio while ARIA remains zero: max−100/value−37
draws37%, and value−200 draws100%. This source discrepancy is recorded, not
silently replaced by native validation.
`hidden` removes layout and paint.

## Geometry and motion

Linear fills its available width. Default thickness is `max(2, 4 + .5*d)`;
an explicitly nondefault thickness is used directly. Wavy height is
`2*amplitude + thickness`; default amplitude is3 linear and1.6 circular.
Positive custom amplitude/wavelength/speed win; otherwise wavelength is40
linear or15 circular and speed is one wavelength per second.

Circular default diameter is40 flat or48 wavy, plus `3*d`, clamped24…240.
A positive explicit size bypasses the density taper. Radius is
`max(.5, (diameter-thickness)/2 - waveAmplitudeWhenWavy)`. Integer ring wave
count is rounded circumference/wavelength with a minimum5. The Catmull-Rom
path uses eight samples per wavelength and must be ported, not approximated
with an unrelated native spinner.

Linear active and track share an eased fraction with an80ms exponential time
constant. Circular determinate uses160ms. Differences below.001 snap to the
target; frame deltas are capped64ms. Wave amplitude changes use500ms easing,
but are fully wavy at every positive fraction, including100%; outdated source
comments about flattening below10% or above95% are not the behavior.

The linear gap defaults to `max(2, 4 + .5*d)` and accepts its own hook.
The persistent determinate stop is the smaller of the stop-size token and
thickness, positioned at logical end minus the trailing-space hook. It remains
at0% and100%. Flat and wavy fills mirror in RTL; circular progress is clockwise
from12 in both directions.

Circular gaps use a fixed4 plus stroke thickness; wavy arcs additionally account
for instantaneous amplitude. Flat track slivers fade before disappearing.
Flat active at0% retains the source round-cap dot. Wavy active is empty at0%;
at100% its source track returns to a full ring. These distinctions are visible
in the oracle. SVG DOM bounds exclude painted stroke and must not be presented
as equivalent paint extents in the native inspector.

Flat linear indeterminate uses two2000ms sweeps with distinct translate/scale
keyframes and a−1666ms primary offset. Wavy indeterminate uses the same actual
bar intervals to draw filled wave paths and mask the track beneath them.
The keyframe timing/functions in CSS are authoritative. RTL flips the sweep.
The animated pre-offsets are physical coordinates. The whole container mirrors
once in RTL, and measured wave-bar rectangles are converted back into the SVG's
local coordinates before drawing paths and track masks. Direct RTL, inherited
RTL and an explicit LTR child inside RTL are measured at seven animation times.

Flat circular indeterminate rotates in1568ms while dash and complementary
track animate in1333ms. Four-color duration is5332ms, holding each color before
interpolating to the next. Wavy circular uses a6000ms sweep from.1 to.87 and
back, with1440° forward rotation per cycle. Its active and complementary track
must remain aligned.

Reduced motion flattens waves, makes determinate updates immediate and slows
indeterminate motion instead of freezing it. Linear sweeps become6000ms with
−4998ms offset; flat circular rotation4000ms/dash3000ms, color16000ms; wavy
circular gets4000ms rotation. Native preference execution remains a required
gate. Forced colors uses CanvasText for active/stop and GrayText for track;
map to actual native semantic colors, not an invented equivalence between
every OS contrast preference and CSS forced colors.

## Completion and source fixes

Changing `complete` to true has no effect while indeterminate or already
finishing/finished. False does not reset the terminal state. An initially true
property does not invoke Stencil's watcher; this initialization behavior needs
an explicit integration decision before the native session recipe is accepted.

Flat linear eases its fill to1, then collapses vertically in300ms.
Wavy linear fills in300ms, flattens in300ms, then uses the same collapse.
Circular fills in500ms (skipped when already within.001 of full), flattens for
300ms if wavy, holds150ms, and erases clockwise from the starting point in550ms.
Flat circular then reveals its empty track in300ms and remains visible.
All other variants self-hide. Exactly one `mdComplete` is emitted on finishing.

The source audit exposed and corrected three Web defects before native porting:

- Reflected local density was applied after initial imperative geometry. The
  host could remain40/48 while animated paths used reduced dimensions.
  Post-render reconciliation now updates host dimensions and SVG viewBox
  together, including `−4 → −1 → 0` changes and inherited/local precedence.
- Wavy linear completion could wait forever when reduced motion disabled its
  rAF loop. Changing the preference during another variant's completion could
  also stop its phase loop. Completion now settles immediately in those cases;
  tests cover the preference change during all four variant/wave combinations
  and assert one completion event.
- Indeterminate linear animation could disappear in RTL. The host selector
  failed to match, while logical pre-offsets moved both looping bars outside
  the clip. The selector now follows the actual resolved direction, offsets
  stay physical, and SVG coordinates reverse the container transform before
  painting. The regression checks both flat and wavy sweeps, visible bar
  intervals, mirrored path geometry and matching track masks.

The wave-speed watcher now also refreshes dependent CSS travel timing.
Global ancestor-density changes without a component render have not been
accepted as dynamically supported by this evidence; do not infer that from
the initial inherited-density cases.

## Evidence and pending gates

`outputs/native-parity/md-progress-indicator` contains92 hydrated configurations
per light/dark theme, actual host/part/SVG geometry, paint, ARIA, path data,
CSS keyframes, nine animation samples, three public density-update stages,
and eight actual completion events. `validate-web.py` validates this output;
`web-evidence.json` records counts and source/artifact hashes. The three Web
test suites pass193 tests. Full development build succeeds. An initial lean
build failed because package outputs were absent; that log is retained, and
the normal documentation/full build generated the required outputs.

The fixture uses a virtual rAF clock and forces intersection visibility so
offscreen cases run. CSS animations are paused at selected times. Both JSON
files contain **light-theme animation samples**; dark applies to their final
`results`. Final results use JS clock6000 and CSS time0. Finite CSS completion
animations are explicitly finished, so event timestamps are not proof of
wall-clock duration. Reduced-motion regression evidence is from component
tests, not an OS preference/browser session. Pre-fix captures are preserved.

`web-edges.json` adds52 separate configurations and seven deterministic times;
`validate-edges.py` passes443 assertions. It preserves zero and negative
thickness, signed gap/trailing offsets and negative maximum behavior as well as
the corrected looping RTL cases. Flat linear thickness0/−2 has zero height.
Wavy linear thickness0 retains a6-unit wave box; thickness−2 has a4-unit box
and the invalid negative track height falls back to auto. Circular thickness0
has zero stroke; thickness−2 expands the path radius but its invalid SVG
stroke uses the initial1px stroke. Negative gap overlaps the active interval;
negative trailing space can move the stop beyond the clipped viewport.
These are source edge behaviors, not claims that negative dimensions are
recommended author input. The original92-case theme matrices, updates and
completion events were recaptured and revalidated after the RTL fix; previous
records remain in `before-rtl-indeterminate-fix`.

Remaining: native public API/appearance implementation, measured renderers,
actual animation and cancellation/lifecycle behavior, native semantics and
OS preferences, editable Laboratory controls, generated-example compilation,
both native live previews, independent audit, and real iOS SDK/runtime checks.
No native parity completion is claimed by this source review.
