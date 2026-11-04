# Android Snackbar parity audit

Status: the native source checkpoint passes, including the separate supplemental
part matrix. Final integrated Laboratory review and independent cross-platform
acceptance remain separate gates; this is not a catalog completion claim.

## Source contract

The Web source review and browser captures are the authority. All eleven source
properties are implemented: open, message, action, closeable, autoHide,
autoHideDuration, position, stacked, politeness, dismissLabel and density.
All nine positions and logical RTL alignment use the actual viewport.
AWCSnackbarScope places overlays outside normal flow and ranks open peers.

The retained AWCSnackbarController supplies immediate show and hide operations.
mdOpen and mdAction have null payloads; mdClose carries the actual auto, action
or close reason. Direct property closure emits no close event. Action starts a
new timeout even when autoHide is false. Duration/policy edits do not reset an
existing deadline. Hover and focus pause the active timer; leaving restarts the
full current duration. Close and Escape coalesce the source 150 ms delayed close.
Disconnect cancels pending callbacks and reconnect does not duplicate mdOpen.

Escape is handled at the native Window callback, including before any child
has focus. Existing application callbacks remain delegated, no focus is stolen,
and multiple scopes register independently. The Laboratory dispatches real key
events through its Presentation window, including normal focused-control input.

The default, action and close slots accept actual authored Compose content.
Explicitly empty registered slots suppress fallback content. Authored actions
and close controls own their callbacks and do not silently trigger fallback
mdAction or close behavior. Native live-region semantics follow polite/assertive;
there is no fabricated DOM status role or aria-atomic value. OS screen-reader
announcement behavior has not been observed in this checkpoint.

## Appearance, sizing and inspection

All seven source hooks are carried through AWCSnackbarAppearance and its scope:
containerColor, messageColor, actionColor, closeColor, containerShape, minWidth,
maxWidth. RGBA colors use CSS channel order. Physical elliptical corner shapes
and affine px/%/em/rem/ch/additive calc widths remain typed until real layout.
The source minimum-width precedence, mobile insets, density and stacked layout
are implemented. Bundled Roboto 400/500/700 supplies native text; shaping uses
real native glyph advances and preserves min-content overflow and wrapping.

AWCSnackbarPartAppearanceScope targets Surface, Message, Actions, Close and
CloseIcon. The original source part fixture (surface border2/radius12,
message700, action padding13, close margin7 and icon tint) passes real geometry.
Additional native tests prove all five part backgrounds/borders and applicable
glyph colors, authored text weights and signed close margins in LTR/RTL. The
separate 48-case Web part matrix passes geometry and actual paint in both themes.
A decorated close icon is 33×28 (24 glyph + 5 inline padding + 4 border), with its
−3 inline margin mirrored in RTL. Wrapper weight inherits only where the source
inherits: message remains 400 unless its own part overrides it; raw authored
action/close text inherits surface weight, while fallback Button remains 500.
Explicit action/close hook colors retain precedence over wrapper color. Font
weight has no meaning for the vector icon. Arbitrary CSS selectors remain a
platform boundary, rather than a claim of unrestricted CSS evaluation.

Inspection reports the actual viewport, surface, message, actions, close and
forwarded fallback icon rectangles. Nested Button and Icon Button remain real
native controls. Source outer shadows are clipped outside translucent fills;
Android elevation was rejected because it darkened their interiors.

## Executed checks and scope

The original 122 mounted configurations pass real root/part geometry within
0.76 dp. Their browser font route also loaded Laboratory CSS, so they prove
source geometry and recorded-palette behavior, not pristine defaults.
A separate 122-case font-only default-palette test uses AWCTheme without injected
tokens and verifies actual container and glyph pixels in both themes. Container
channel tolerance is 0.025 and glyph search tolerance 0.07. Older transient
browser captures remain separate and are not used for this gate.

The 32 captured browser motion samples match the source cubic curves. Actual
native open/close frames are checked at their committed frame timestamps:
Android’s 16 ms clock can commit 48 ms for a requested 50 ms sample. Motion remains
250 ms emphasized-decelerate entrance and200 ms emphasized-accelerate exit;
top/bottom move the full viewport height, side/center fade. Reduced motion snaps
to the final state. Transform tolerance is 2 dp and sampled alpha tolerance 0.04.

Twelve deterministic unit methods verify controller lifecycle, timers,
disconnection revisions, peer ranks, affine appearance and sparse signed part
merges. Actual device interaction tests verify authored-slot replacement and
callbacks, real focus across children, native live-region modes, actual pointer
action/close, unfocused Escape and hover. The native host tests all eleven
retained edits, method argument/result correlation and retained resize. Resize
preserves the root, controller, method-hidden state and original timer deadline;
its ACK contains a frame with the newly committed applied dimensions.

The host applies the shared width 320–1200 and bounded height 1–2000 capture
contract (at most 8 MP at 2×). One-row surfaces, large budget-clamped frames and
invalid resize rejection are covered. A newly resized GPU buffer may be briefly
unavailable; a bounded retry waits for a fresh committed frame, without draining
events on failed copies. These capture limits are Laboratory limits, not public
AWCSnackbarScope dimensions.

The final renderer evidence includes 122 original geometry cases, 122 pristine
default-palette paint cases, 48 supplemental geometry cases and 48 supplemental
paint cases. Five affected Button/Icon device regressions also pass. A separate
final host/lifecycle run records the remaining seven Snackbar device methods;
together, the Snackbar checkpoint contains 13 distinct device methods.

Thirty-eight exact generated public Kotlin recipes compile against production
APIs. Source hashes and logs are in outputs/native-parity/md-snackbar/examples.
Relevant existing Button/Icon RGBA, Button inspection, Snackbar presentation and
FAB Menu method/input regressions pass. Verification uses the available API 36
Android emulator; other Android releases and iOS execution are separate gates.

## Remaining acceptance

- Actual Laboratory retained properties/styles/viewport/method retake.
- Independent final cross-platform audit.

Native font rasterization, platform text accessibility and outer-shadow blur
kernels are explicit rendering boundaries; source geometry, colors and timing
are measured rather than inferred from generic Material controls.
