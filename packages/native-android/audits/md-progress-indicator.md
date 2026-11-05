# Android Progress Indicator parity audit

Status: dedicated native renderer, appearance API, retained Laboratory updates
and source completion lifecycle implemented. Focused verification and the
integrated Laboratory visual/lifecycle review pass. The rotated inspector correction and frame-coherent capture pass their focused
runtime suites; the animated Laboratory retake remains pending. No
universal pixel-identical rendering or all-Android-version claim is made.

## Authority and implemented surface

Authority is the corrected `md-progress-indicator.tsx` and `.css`,
`docs/native-parity/md-progress-indicator-source-review.md`, and the real hydrated
browser captures under `outputs/native-parity/md-progress-indicator/`.
The final `web-light.json`, `web-dark.json` and `web-edges.json` include the
corrected RTL indeterminate behavior. The pre-correction capture is not used as
the native reference.

All fourteen properties are implemented: variant, value, max, indeterminate,
thickness, wave, waveAmplitude, waveLength, waveSpeed, size, fourColor, label,
complete and density. There are no source slots or component methods.
`mdComplete` has null native detail, corresponding to the source's void payload.
It is dispatched through the synchronous native event system and the ordinary
callback after the actual completion sequence; cancellation cannot reverse an
already completed sequence.

`AWCProgressIndicatorAppearanceScope(AWCProgressIndicatorAppearance(...))`
implements all thirteen hooks: activeIndicatorColor, activeIndicatorShape,
trackColor, trackShape, stopIndicatorColor, stopIndicatorShape,
stopIndicatorSize, stopIndicatorTrailingSpace, trackActiveIndicatorSpace,
fourColor1, fourColor2, fourColor3 and fourColor4. Colors retain RGB/RGBA and
shapes use the shared physical `AWCCornerShape`, including elliptical axes,
percentages and mixed finite coefficients. Gap and trailing space remain signed.

Native Canvas paths implement both flat and wavy linear/circular modes. The
linear wave is a filled, round-capped Catmull–Rom band; the circular wave is the
source's rounded polyline construction around its resolved radius. The two
indeterminate linear bars retain the distinct translate/scale timelines. RTL
indeterminate reflects the entire physical geometry, including authored corner
shapes, exactly once. Determinate RTL uses the separate source coordinate rule.
Circular arcs remain clockwise in RTL.

The three source parts have actual native geometry: track, active-indicator and
stop-indicator. For flat indeterminate, active-indicator is the measured outer
bar container; its inner fill is separately inspectable. Wavy indeterminate
also exposes its actual native moving paths, although those individual paths
have no source part attribute. Local path bounds are native contour extrema,
excluding stroke; Bézier control bounds are not substituted for the contour.
Rotation transforms that local geometric rectangle, matching SVG element
measurement rather than recomputing a tighter rectangle around the rotated ink.

## Mounted state, transport and accessibility

Initial complete=true is inert. A later false→true update begins the real
variant-specific fill/flatten/collapse or circular erase sequence. Exactly one
mdComplete is emitted. False does not reset terminal state. Flat circular rests
on its full inactive track; other modes retain the layout box but hide content
and remove accessibility/inspection output. Indeterminate ignores complete.

The Laboratory `update` command applies a strict partial patch to the same
mounted Progress instance. Acknowledgment waits for a draw committed with the
matching property revision, preserving consecutive false→true edits. It does
not imply animation completion. The later mdComplete event reports completion.
Reset starts a new session. This command is preview transport, not an invented
public component method. The preview uses the same authored 300 dp parent as Web.

The native root supplies progress range semantics and its accessible label,
with no default action, tabstop or live region. `AWCProgressRangeKey` preserves
Double values alongside Android's Float-based range API. Visual and accessible
ranges deliberately follow the source's distinct rules for negative max:
max=-100/value=-37 paints 37% while the accessible range remains 0…0.

Reduced motion follows Android's animator preference. Slow indeterminate motion
continues; determinate updates settle without phase motion. Active rAF-style
completion settles on a preference change; an already running linear collapse
keeps the source's 300 ms collapse. Hidden content resumes without jumping its
wave phase or indeterminate choreography. The explicit native forcedColors
environment override uses onSurface/outline colors; Android increased contrast
is not falsely treated as a browser forced-color palette.

## Verification and evidence

The first complete checkpoint passed 111 library unit cases and five device
methods, including 236 mounted configurations (92 light, 92 dark, 52 numeric/RTL
edges), real accessibility semantics and selected opaque paint checks. It also
compared 829 nonempty native wave contours with captured source paths across all
saved animation samples, plus empty-path cases, using a 0.12 dp contour/length
limit. The source samples are explicitly light-themed in both main files;
geometry uses those recorded samples while colors use each actual theme.

The expanded final suite additionally checks paused flat-circle CSS sweep,
offset, rotation and four-color interpolation; real RGBA/forced-color pixels;
nonzero-phase RTL wave/corner reflection; and exact reflected native contours.
Actual source composition bounds use 0.51 dp for native physical rounding,
without broadening tolerances after a failure. Exact native reflected contours
use 0.001 dp.

The emulator's hardware rasterizer exhibits four coverage levels at edges.
A raw reflection initially differed at 127 of 28,800 pixels, solely in edge
coverage, by at most one measured sample (60/255 channel distance for the chosen
ink/white contrast). The bounded raster check permits that single step only
where both one-physical-pixel neighborhoods contain a real edge. Solid interiors
and backgrounds retain the strict 0.04 channel threshold. Raw images, counts,
failed first results and corrected checks are preserved, not represented as a
pixel-perfect result.

Twenty metadata-gated production Kotlin examples compiled successfully. The
exact source, hashes, command and compiler log are separately retained under
`outputs/native-parity/md-progress-indicator/examples/`. Temporary example
sources were removed after byte comparison. Checkpoint and subsequent runtime
logs, XML and source hashes are under `audits/evidence/md-progress-indicator/`.
Final device summary: 112 unit cases and nine device methods passed. The nine
methods include the 236-configuration matrix, 829 paused contours, actual CSS
choreography/color comparisons, mounted completion, exact RTL reflection,
bounded hardware rasterization, RGBA/forced colors, retained host updates and
determinate/reduced indeterminate motion. Hidden/resume is an additional unit
regression. Integrated Laboratory QA confirmed all fourteen edited properties,
thirteen enabled/styled hooks, styled 300×8 RTL linear and 84×84 circular
configurations, one actual null-detail completion event, terminal false→true
without another event, and reset/fresh wavy completion.

Independent review then identified an inspection-only rotated-box mismatch.
The corrected measured rectangles pass all four path-oracle device methods,
including saved nonzero-angle flat and wavy circular element rectangles within
0.04 dp. Actual paint and path transforms are unchanged. Exact command, XML,
source/APK hashes and successful installation are retained separately in
`evidence/md-progress-indicator/inspection-final`; the earlier full-suite evidence
is preserved. The Laboratory inspector retake remains pending.

That retake exposed a separate host issue: asynchronous PixelCopy filtering
removed continuously rotating parts. The host now briefly holds new surface
submissions, waits for the latest submitted GPU frame to commit, and pairs that
immutable inspection snapshot with its copied pixels. Animation time continues;
no component phase is reset. Twenty actual animated captures retain both changing
part boxes and painted arcs. Focused host checks also pass idle caching,
reconnect recovery, retained updates and display/input disposal. A separate
capture ticket prevents a timed-out PixelCopy callback from advancing sequence
or draining later events; its delayed-callback regression passes. Evidence is
retained in `evidence/md-progress-indicator/coherent-capture`.

## Native boundaries

Browser SVG/CSS is replaced by actual native paths, shapes, range semantics and
frame timing; no WebView or bitmap recreation is used. Actual frame cadence and
edge antialiasing depend on the native renderer. Tests run on the available
Android API 36 emulator; older supported versions are not implicitly certified.

Native layout/paint uses a 32,766 physical-pixel coordinate boundary, and
path construction caps circular vertices at 8,192 and sampling at 65,536 steps.
These limits prevent unbounded finite input from creating invalid Compose
constraints, nonfinite paths or unreasonable allocations. They are native
safety boundaries, not claims that astronomical authored dimensions match
Chromium's larger internal limits. Ordinary and captured signed/zero cases
retain source behavior. Inspection reports the actual applied native geometry.
