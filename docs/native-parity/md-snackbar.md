# Snackbar parity checkpoint

Status: dedicated SwiftUI (macOS + iOS) and Compose renderers, a root overlay
scope per native window, retained Laboratory property updates, public native
controllers, slots, appearance and typed part APIs are implemented. Every
platform gate has executed evidence; the independent re-run by the gate-7
reviewer reproduced every count below. Platform audits with implementation
detail: [Swift](../../packages/native-ios/audits/md-snackbar.md) and
[Android](../../packages/native-android/audits/md-snackbar.md).

## Contract and implementation

| Source surface | Native counterpart (SwiftUI / Compose) |
| --- | --- |
| 11 properties: open, message, action, closeable, autoHide, autoHideDuration, position, stacked, politeness, dismissLabel, density | Retained component state; `AWCSnackbarScope` supplies the actual overlay viewport: nine logical positions, RTL ordering, the 600pt/dp compact breakpoint, local versus inherited density, wrapping and the two-row stacked layout. The component reserves no ordinary layout space. |
| Events mdOpen (null), mdAction (null), mdClose `{reason: auto\|action\|close}` | Same payloads. Direct authored `open=false` emits no synthetic close. Close/Escape keep the 150 ms ripple-feedback delay; repeated requests coalesce; stale callbacks cannot close a newer cycle. |
| Methods show(), hide(reason) | `AWCSnackbarController` (Swift `.awcSnackbarController`, Compose `AWCSnackbarController`). Completion confirms the applied state independently of the visual transition; default reason is close. |
| Slots default, action, close | `.awcSnackbarSlot(.message/.action/.close)` / Compose slot content. Authored controls keep their own callbacks; explicitly empty slots suppress the fallback. |
| Timer policy | Opening starts the timer when autoHide is enabled; hover/focus pause it and leaving restarts the full duration; editing the duration does not reschedule a running timer; the fallback action starts a timer even when autoHide is false (later close reason: auto). |
| politeness | Native status/alert semantics with low/high announcement priority (polite/assertive). Closed semantics are removed. Announcements are requested once per generation/message. |
| 7 hooks (container/message/action/close colors, container shape, min/max width) | `AWCSnackbarAppearance` (sparse merge; RGB/RGBA; physical asymmetric/elliptical corners; px/%/em/rem/ch/additive-calc widths through `AWCSnackbarLength`). Compact layout overrides the desktop width hooks, as on the Web. |
| 5 parts: surface, message, actions, close, close-icon | Typed part API `.awcSnackbarPartAppearance(_:part:)` / `AWCSnackbarPartAppearanceScope` (`Surface`, `Message`, `Actions`, `Close`, `CloseIcon`): colors, background, border color/width, physical corners, text weight, logical start padding and signed logical start margin. |
| Motion | 250 ms open / 200 ms close emphasized curves; top/bottom translate the viewport height, side/center fade; system reduced motion commits the endpoint. Forced colors: explicit native option adding the semantic border with real border-box geometry. |

Peer ordering belongs to the root scope: reopening raises a Snackbar above its
open peers while compacting ranks; Escape affects every open closeable peer,
as the source listeners do. Detachment cancels timers and keyboard ownership;
reattachment restores them without replaying mdOpen.

## Executed evidence

Counts are each suite's own checks. "Re-run" is the gate-7 reviewer r2's
independent run on a snapshot of the canonical tree (2026-10-31, jobs named in
[`docs/native-parity/audit/md-snackbar.md`](audit/md-snackbar.md)).

| Gate | Suite | Recorded | Re-run (r2) |
| --- | --- | --- | --- |
| 4 | Web spec + axe | 80 | 80/80 |
| 2, 4, 5 | Swift `NativeSnackbarViewIntegration` (geometry, RGB/RGBA paint, parts, slots, peers, keyboard, motion) | 2,987 | 2,987/2,987 |
| 4 | Swift `NativeSnackbarControllerIntegration` (timers, async methods, deferred/disconnected opening) | 27 | 27/27 |
| 3 | Swift live host `test-live-snackbar.mjs` | 51 | 51/51 |
| 2, 4, 5 | Android device: Parity 4, Parts 2, Interaction 2, Motion 1, `LivePreviewSnackbarHostTest` 4 | 13 methods | 13/13 |
| 4 | Android unit `NativeSnackbarLifecycleTest` | 12 | 12/12 |
| 3 | Generated public examples (Swift typecheck macOS + iOS simulator, Kotlin compile) | 38 + 38 | byte-identical, all compile |
| 3 | Studio tests (component + shared) | 59 + 173 | 59/59, 173/173 |
| 6 | tools/ax (open, assertive, message-only) | 0 open | 0 open on macOS, iOS, Android |

Visual evidence (gate 5): the checked-in fixtures are font-only captures with
unmodified library tokens (`/reference-fonts.css`, 61 configurations per theme,
light and dark, recursively settled before capture) plus a separate 48-case
part matrix in both themes and the recorded motion curves. The Swift oracle
injects no captured colors; Android runs
`all122PristineDefaultPaletteCasesPaintWithoutInjectedTokens`. Earlier
Laboratory-palette captures are kept under `outputs/native-parity/md-snackbar`
and are not used as default-palette proof (see
[theme provenance](reference-theme-provenance.md)).

Laboratory (gate 3): sessions open on both platforms (`mdOpen null`); a
retained `update {message}` applies in place; `show()` and `hide("action")` are
accepted and fulfilled with `mdClose {"reason":"action"}` delivered
(`work/audit/r2/runs/lab/lab-probe.json`). The RTL glyph retake is in
`outputs/native-parity/md-snackbar/laboratory-swiftui-rtl-retake.png/json`.

Accessibility (gate 6): [tools/ax report](../../outputs/native-parity/md-snackbar/accessibility/report.md).
Tab order Undo → Dismiss matches the Web; assertive is exposed as an alert; the
macOS host observed the announcement of an updated message. iOS reports the
source's own 40 px controls as touch-target information only.

## Platform boundaries and exception record

**E5 — overlay ownership and authored announcement labels. Accepted by gate-7
reviewer r2, 2026-10-31.**

- Source behavior: all snackbars in one document share one stack owned by the
  document overlay; a message slot's announcement text is its DOM `textContent`.
- Affected platforms/APIs: SwiftUI (macOS, iOS) and Compose; `AWCSnackbarScope`
  and arbitrary native slot builders.
- Technical reason: native windows/scenes share no document, so one root scope
  per window/scene is the native overlay owner; an arbitrary native view has no
  text content the library could derive.
- User impact: snackbars in different native windows do not stack together; an
  author who supplies a custom message view passes `accessibilityLabel`
  (node/text outlets derive their real authored text automatically).
- Tested native equivalent: peer ordering, Escape across peers, detach/reattach
  and announcement text in `NativeSnackbarViewIntegration` and the Android
  interaction and host tests (re-run above).
- Scope: cross-window stacking and the announcement text of arbitrary native
  slot views only.

Named native equivalents, not waivers: the explicit forced-colors border option
(tested) and system reduced motion. Native antialiasing is not claimed
pixel-identical; motion pixels are checked against the recorded Web curves with
capture/refresh timestamp bounds.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeSnackbarViewIntegration` | **2987/2987** | **2987/2987** | **2987/2987** |
| `NativeSnackbarControllerIntegration` | **27/27** | **27/27** | **27/27** |
| **Total** | **3014/3014** | **3014/3014** | **3014/3014** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md). The gate-7 reviewer re-ran all three runtimes (r2-003, r2-008): 0 failures.
<!-- fi:ios-gate6:end -->
