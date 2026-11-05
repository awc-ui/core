# md-snackbar — Swift native parity

A dedicated SwiftUI component replaces the inline placeholder. It preserves the eleven source properties, three events, two asynchronous methods, three authored content outlets, seven appearance hooks and five measured part identities.

## Public API and source behavior

| Source surface | Native implementation |
| --- | --- |
| open, message, action, closeable, dismissLabel | `AWCNativeView` retains the mounted Snackbar state. Message fallback uses actual bundled Roboto with the source line box. Fallback action and close controls are the existing native Button and Icon Button. The localized close label reaches the native control. |
| position, stacked, density | A root `AWCSnackbarScope` supplies the actual overlay viewport. Nine logical positions, RTL ordering, the 600pt compact breakpoint, local versus inherited density, wrapping and the two-row stacked layout follow independently captured Web geometry. The component reserves no ordinary layout space. |
| autoHide, autoHideDuration | Opening starts the source timer when enabled. Hover/focus pause an active timer; leaving restarts its full duration. Editing the duration does not reschedule a running timer. Fallback action emits `mdAction` and starts a timer even when autoHide is false; its later close reason is auto. |
| politeness | Native status/alert semantics and low/high-priority announcements preserve polite/assertive intent. Closed semantics are explicitly removed. Initial opening and retained message changes request announcements without duplicate requests for the same generation/message. Actual OS screen-reader delivery remains unverified. |
| mdOpen, mdAction, mdClose | Opening/action carry null detail; close carries the exact reason object. Direct authored open=false has no synthetic close event. Fallback close and Escape retain 150ms ripple feedback. Repeated requests coalesce; stale callbacks cannot close a new cycle. |
| show(), hide(reason) | One retained `AWCSnackbarController` attaches through `.awcSnackbarController`. Async completion confirms applied state, independently of the visual transition. Reasons are `.auto`, `.action` and `.close`; default is close. |
| Default/action/close slots | `.awcSnackbarSlot(.message/.action/.close)` accepts real SwiftUI builders. AWCNode children also preserve named outlets. Author-owned controls keep their callbacks; they do not inherit the fallback action or dismissal handler. A builder may pass `accessibilityLabel` for message announcements because an arbitrary native view has no DOM textContent. Node/text outlets derive their real authored text. |
| Seven hooks | `AWCSnackbarAppearance` sparsely merges container/message/action/close RGB or RGBA, physical asymmetric/elliptical corners, minimum and maximum width. `AWCSnackbarLength` retains point, parent fraction, em, rem, ch and additive calc coefficients. `AWCSnackbarSizingContext` carries the native font/root/zero-glyph context. Compact layout deliberately overrides desktop width hooks, as Web does. |

Opening and closing use the source 250ms/200ms emphasized curves. Top/bottom translate the entire viewport height; side/center fade only. System reduced motion commits the endpoint directly. The explicit forced-colors option adds the corresponding semantic border with real border-box geometry; native contrast preferences are not equated to Windows CSS forced colors.

Peer ordering belongs to the root scope. Reopening raises a Snackbar above its open peers while compacting ranks. Escape affects every open closeable peer, matching the source listeners. Detachment cancels timers/keyboard ownership; reattachment restores resources without replaying mdOpen.

## Native part styling

`.awcSnackbarPartAppearance(_:part:)` addresses `.surface`, `.message`, `.actions`, `.close` and `.closeIcon`. The typed appearance preserves colors, background, border color/width, physical corners, text weight, logical start padding and signed logical start margin. Sparse overrides preserve inherited values. Border/padding lengths are nonnegative; margins may be negative.

Surface background/border/shape and logical start padding/margin affect the actual overlay layout. Message-part text weight and ink affect real CoreText metrics. Surface weight inherits into authored action/close text, while the message retains its explicit source weight unless its own part overrides it. The fallback Button retains its own explicit weight; action/close hook colors also remain authoritative for fallback controls and named authored slots. Wrapper decorations belong to message/actions/close. Close-icon decorations apply to the actual Material glyph layer and are exposed under the forwarded part identity. Text weight is not meaningful for the vector-like close glyph; a custom text control belongs in an authored slot. Styling a wrapper's text does not override explicitly styled descendants supplied by an author.

This is a typed native styling API, not an arbitrary CSS interpreter. DOM selectors, pseudo-elements, browser-specific properties and JavaScript node APIs have no native syntax equivalent; native builders and the documented part fields provide the corresponding composition points. Exact mapped source examples are compiled separately.

## Preview transport and verification

The Laboratory uses the requested logical canvas width and height, with no generic 32pt inset and no intrinsic minimum-height substitution. Width is bounded to 320–1200pt. Height defaults to 240 only when absent and is clamped to 1…min(2000,floor(2,000,000/width)) before rounding. The UI sends its real canvas height, normally 310. These are capture allocation limits, not limits on the public root scope.

The native text counterpart rounds the bundled font’s normal line height to the source browser line box for authored action/close text. Logical margins also retain direction on the message wrapper.

Strict retained property updates preserve all eleven source properties on the same component/controller. A dedicated retained resize updates the viewport, captures the committed result and acknowledges it without resetting timers or replaying opening events. Invalid updates/resizes reject before mutation. Show/hide use correlated accepted/result messages; acceptance and method completion remain separate.

The geometry oracle contains 61 configurations per theme. The checked-in fixtures use an isolated font sheet plus unmodified component tokens, and recursively settle nested-control transitions before capture. Earlier Laboratory-palette and mid-transition captures remain in the external evidence directory and are not relabeled as default-palette paint proof. Native default-palette verification uses generated native colors with no captured color injection. A separate 48-case source capture verifies every typed part decoration, signed margins, forwarded close-icon geometry and typography inheritance. These fixtures caught and corrected RTL message margin direction, normal authored line-height rounding, and explicit descendant font specificity.

`NativeSnackbarViewIntegration` compares actual SwiftUI host/part rectangles, real RGB/RGBA pixels, authored slots, native status responders, signed RTL/LTR margins, peer order, keyboard events, detach/reconnect and visible motion. Native motion pixels are checked against the recorded Web curves with capture/refresh timestamp bounds; antialiasing is not claimed pixel-identical. The fixture window uses the same explicit sRGB backing as production preview capture.

`NativeSnackbarControllerIntegration` separately exercises timer policy, asynchronous methods, deferred/disconnected opening and stale ripple cancellation. Both fixtures are registered in `test-native-views.sh`; `test-live-snackbar.mjs` is registered in `test-native-preview.sh`. Final checks pass: 2,983 renderer assertions, 27 controller assertions, 49 live-host assertions, and 38 exact generated Swift examples typechecked. The affected Button (22), Icon Button (284) and Meter (2,669) renderer regressions also pass. Hashes, commands, logs and compiled public examples are recorded in the external Swift evidence manifest.

## Platform boundaries

Executed evidence is macOS SwiftUI/AppKit. This environment has no iOS SDK, simulator or device. UIKit compilation, iOS geometry, hardware-keyboard routing, VoiceOver announcements and OS-level accessibility operation remain unverified. This audit does not call macOS execution iOS verification.

One root scope is the native equivalent of the source document overlay owner; unrelated native windows/scenes deliberately do not share a Snackbar stack. Coordination with other overlay component families is a separate library-wide concern. Native arbitrary view builders require authored semantic labels where a DOM would expose textContent automatically. Both differences have an explicit platform reason rather than silently omitted behavior.

### Follow-up: Escape without a focused native control

The original 49-check host suite focused a native control before Escape. An additional isolated regression failed without that Tab step. The Laboratory host now sends keyboard events through `NSApp.sendEvent`, including Escape while a text editor owns focus, so the library scope monitor receives the actual AppKit event path. The rebuilt host passes all 51 checks. Failure, build, passing log and binary/source hashes are preserved in `outputs/native-parity/md-snackbar/swift-final/escape-evidence.json`. This is macOS evidence; iOS execution remains unavailable. Browser transport and final Laboratory retake are separate gates.

### Follow-up: actual RTL glyph placement

Independent Laboratory screenshot review identified double mirroring inside the correctly measured message box. Before correction, actual glyph-pixel tests failed for both fallback and authored RTL text while LTR passed. Native message frames now use logical leading alignment under their effective layout direction. The full renderer passes 2,987 checks and the rebuilt host passes 51 checks. Failure/pass logs and hashes are preserved in `outputs/native-parity/md-snackbar/swift-final/rtl-glyph-evidence.json`; The subsequent actual Laboratory styled RTL retake passed and is preserved as `outputs/native-parity/md-snackbar/laboratory-swiftui-rtl-retake.png/json`.
