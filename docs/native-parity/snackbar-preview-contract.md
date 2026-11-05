# Snackbar shared preview contract

Status: shared controls and retained transport are implemented and verified.
Both native implementations have passed their renderer, host and public-example
gates, including the separate 48-case part matrix. Actual repository capability
declarations are enabled; integrated Laboratory acceptance, iOS execution,
OS screen-reader delivery and final independent audit remain separate gates.

## Appearance

`AWCSnackbarAppearance` carries exactly the seven source hooks:
`containerColor`, `messageColor`, `actionColor`, `closeColor`, `containerShape`,
`minWidth` and `maxWidth`. The transport keys are `snackbarAppearanceDefaults`
and `snackbarAppearance`. Inherited defaults merge by field; local values only
apply to the matching Snackbar root.

Colors preserve six- or eight-digit hex values. Container shape uses the
shared physical `AWCCornerShape`, including asymmetric elliptical corners and
percentages. Both width constraints use `AWCSnackbarLength`, an alias of the
existing affine length implementation:

```json
{"points":-48,"fraction":1,"em":0,"rem":0,"ch":0}
```

This represents `calc(100% - 48px)` without assuming a viewport size. Native
resolution must use the actual overlay containing block and font context.
The supported editor grammar is px, %, em, rem, ch and additive calc().
Unsupported CSS expressions are reported explicitly. Finite signed terms,
zero and minimum-greater-than-maximum ordering remain intact for the renderer
to apply source used-value rules. Native geometry must bound extreme values
without dropping their author input.

The generated part recipes use the separate typed `AWCSnackbarPartAppearance`
API for surface, message, actions, close and close-icon. Its sparse fields are
color, backgroundColor, borderColor, borderWidth, cornerShape, fontWeight,
paddingInlineStart and marginInlineStart. The examples exercise surface border
and shape, message weight, action padding, close margin and fallback icon tint.
Typography applies to text, not vector outlines. Native runtime checks establish the advertised fields' actual part-specific
effects, including logical signed margins and decorated icon geometry. Arbitrary CSS selectors remain a platform boundary.

Authored slot recipes use actual native content and callbacks. A custom action
owns its callback and does not receive the fallback action event/timer. The
custom close example explicitly calls its controller. Swift's arbitrary View
slot accepts an accessibilityLabel for the live announcement because AnyView
has no DOM textContent; structured AWCNode text derives it automatically.

## Mounted methods and events

`AWCSnackbarScope` supplies the actual overlay viewport and owns peer ranking.
Generated Swift examples put the 360×480 frame on this scope; Compose examples
place the scope inside a `Box` with that required size. Sizing a standalone
Snackbar as ordinary document flow does not reproduce its fixed-overlay Web
contract. Both native renderers supply this real overlay scope.

The agreed public API is `AWCSnackbarController` attached to one Snackbar.
Swift uses `.awcSnackbarController(controller)` and asynchronous `show()` /
`hide(reason: AWCSnackbarCloseReason = .close)`. Compose uses
`rememberAWCSnackbarController()` and `AWCSnackbarControllerScope(controller)`;
its `show()` and `hide(reason = AWCSnackbarCloseReason.Close)` return Unit.
The native enum cases map to source strings auto, action and close.

The wire schema uses the existing bounded, correlated lifecycle transport:

```json
{"command":"method","target":"component","callId":"m-1","method":"hide","arguments":["action"]}
```

`show` accepts no arguments. `hide` accepts none or exactly one source reason.
Unknown reasons, sparse/accessor arrays and arbitrary targets are rejected.
Acceptance does not settle the browser application promise: a matching
method-results record must confirm fulfillment or rejection. Session changes
reject pending calls and late results cannot settle a replacement session.
Completion means the method's state change was applied; it does not wait for
the visual transition. No separate close-completion method is invented.

The controller/event recipes only appear when the actual platform declares
both methods implemented. They show real `mdOpen`/`mdAction` null payloads and
`mdClose` reason objects. The source action starts a fresh auto-hide timer even
when autoHide is false; directly assigning open=false does not emit mdClose.
Both native lifecycle gates verify these details.

## Retained property edits

The shared update schema covers all eleven source properties and preserves
each ordered change, including open=false then open=true. It accepts finite
signed durations, all nine positions, both politeness values, canonical density
rungs and bounded UTF-8 strings. It rejects getters, unknown properties and
incorrect types before transport. Both real show/hide method declarations and
all eleven property declarations are required before the shared client enables
retained edits or forwards hover input to a native Snackbar. A property ACK
must not synthesize lifecycle events or remount the component.

## Laboratory viewport and capture limits

The browser sends its actual Snackbar canvas width and height separately from
component properties. A height-only resize and canvas expansion update the existing
native viewport. Responsive container changes also resize the retained native
viewport, with duplicate observer feedback suppressed. The normal UI starts at 310px canvas height; 240 is the native
fallback only when an older request omits height. Both hosts use the full
applied scope dimensions, without the generic preview padding or minimum
intrinsic height.

The optional `height` field is Snackbar-only and must be a finite positive
number. Laboratory applies `round(clamp(width, 320, 1200))`, then
`round(clamp(height, 1, min(2000, floor(2_000_000 / appliedWidth))))`.
At a 2× raster scale this caps capture allocation at eight million pixels.
These are Laboratory capture limits, not public native component API limits:
`AWCSnackbarScope` continues to use its ordinary caller-provided constraints.

The toolbar labels the committed native frame as `Rendered W × H pt/dp`.
Requested canvas dimensions remain available in its accessible title. When
the canvas and captured viewport differ, the help line reports both sizes and
the capture limits. It never presents a requested oversized canvas as the
actual rendered native geometry. Before the first frame, it explicitly labels
the size as Canvas. Resize changes apply after dragging ends. The strict Snackbar-only wire
command is `{"command":"resize","width":360,"height":480}`. It uses the same
finite-positive validation and capture clamp. The existing ordered input queue
keeps viewport changes in order with property edits; its promise settles only
after the host acknowledges the newly committed/captured layout. Both adapters
require that response to contain a valid PNG and matching applied dimensions,
publish it immediately, and update pointer bounds before subsequent input. The root,
controller, open state, auto-hide deadline and active transition must survive.
No component event is fabricated. A navigation/closed session rejects pending
resize promises. Reset canvas restores its default 310px height, independently
of a previous tall native capture.

The relevant combined shared suite passes 240 tests, including
height-only changes, invalid/nonfinite height rejection, both configure routes,
2× allocation boundaries, and truthful pending/clamped readouts. Actual native capture/placement and retained resize host gates pass.
Interactive Laboratory acceptance remains independent.

## Pending acceptance

Two hundred forty relevant shared checks pass, including all seven controls, exact
source-hook drift, relative width preservation, invalid-edit recovery, all
seven framework appearance snippets, method argument validation, ordered
correlated lifecycle calls, retained update/hover routing and capability-gated
public examples. This suite also guards Progress and Skeleton shared transport;
the count covers several shared components, not only Snackbar cases. Exact logs
and current source hashes are in
`outputs/native-parity/md-snackbar/shared-evidence.json`.

Thirty-eight exact public examples per native platform were regenerated against
actual released declarations. Their SHA-256 values match the previously compiled
Swift/Kotlin source files byte for byte, preserving the real compiler proof.

Native geometry, paint, timing, event payloads, authored callbacks, hover/focus,
keyboard behavior, retained editing and resize host gates passed. Integrated
Laboratory previews, actual iOS execution, OS announcement delivery and the final
independent audit remain required. The source checkpoint remains
[the independent behavioral reference](md-snackbar-source-review.md).
