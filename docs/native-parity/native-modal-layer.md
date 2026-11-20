# Native modal layer

Status: implemented on SwiftUI (verified on macOS; the UIKit branches are written but not executed) and Jetpack Compose
(verified on the AwcNative emulator). Used by md-dialog, md-bottom-sheet and the modal md-side-sheet. The per-component
checkpoints are [md-dialog.md](md-dialog.md), [md-bottom-sheet.md](md-bottom-sheet.md) and [md-side-sheet.md](md-side-sheet.md).

## What the layer is

A modal scope stands for the source's viewport and its `ModalSession`:

| Concern | SwiftUI (`ModalScope.swift`) | Compose (`AWCModalScope.kt`) |
|---|---|---|
| Scope | `AWCModalScope(paintOrder:) { content }` | `AWCModalScope(modifier, paintOrder, insets) { content }` |
| Viewport | the scope's size (vw/vh, 640 breakpoint, percentages) | `session.viewportWidth/Height` |
| Safe area | `session.safeArea` | the part of `insets` (default `safeDrawing`) that intrudes into the scope; a scope that extends past the window gains nothing |
| Owner stack | `AWCModalSession.acquire/release`, `isTop(id)` | same |
| Inert content | page content is inert and hidden from accessibility while any owner is open; covered owners are inert too | content focus group: `canFocus = false`, traversal never enters; explicit requests still land and are recaptured |
| Focus | first tabbable one frame after open (else the `tabindex=-1` container); the opener is restored on close, or forwarded to the owner below | `captureOpener` (saved focused child) → `focusFirst` (container + `moveFocus`) → `restoreFocusedChild` one frame after release; nothing saved → focus goes to the document target |
| Focus trap | Tab / Shift+Tab cycle inside the top owner (`AWCModalFocusRegions`) | window `Callback` routes Tab to `session.tab`; Compose order inside the surface |
| Tab order outside a modal | DOM order: the scope numbers the AWC focus views of its content in source order (SwiftUI preferences combine in view-tree order); Tab / Shift+Tab put them in that order into their key-view-loop positions on AppKit and UIKit, and other key views keep theirs (`NativeDocumentOrder.swift`) | composition order |
| Escape | routed to the top owner only (`owner.escape`), consumed when the owner says so | window routing; the focused surface handles it first |
| Android back | n/a | KEYCODE_BACK down/up and `OnBackInvokedCallback` (API 33+, `PRIORITY_OVERLAY`), registered only while an owner is open; same rules as Escape |
| Document focus | `session.blur()` (first responder cleared) | `session.blur()` focuses a non-tabbable document target outside the page content, so Android does not move focus to a default control in keyboard mode |
| Real vs re-dispatched pointer | `AWCNativePointerState` | `session.syntheticPointer`: a pointer event with the previous event's uptime is Compose's re-dispatch after a layout change, not movement |
| Fallback | outside a scope the three tags keep the previous presentation (platform sheet / `AWCPreviewScope` overlay) via `AWCModalPresentationFallback` | outside a scope the three tags keep the previous `OverlayComponent` presentation (platform dialog window / preview capture); `NativeDialog`/`NativeBottomSheet`/`NativeSideSheet` select the parity renderer only under `LocalAWCModalSession` |

### Paint order

One named policy, `AWCModalPaintOrder`:

- `sourceZIndex` (default) reproduces Chrome: entries sort by their source z-index, then by owner order. A dialog
  (`2147483647`, top layer) therefore paints above a bottom or side sheet (`1001` surface over a `1000` scrim) opened on
  top of it, even though the sheet owns focus and keys.
- `ownerOrder` paints the most recently acquired owner on top.

This is an open CSS-intent decision: the source probably intends owner order, but Chrome renders the z-index order.

## Paint layers

Each sheet publishes two entries, `<id>#scrim` (z-index 1000) and `<id>` (1001), which the scope sorts independently.
A later sheet's scrim therefore paints below an earlier sheet's surface, exactly as Chrome stacks the source's
separately positioned scrim and container.

The dialog keeps one entry at 2147483647, above both sheet layers.

## Evidence

The component suites exercise every scenario below with real input:

- **Opening and closing:** on pointer, keyboard and methods.
- **Focus:** first and last, wrap, Shift+Tab; restore, and forwarding to the owner below.
- **Dismissal:** Escape, scrim and Android back act on the top owner only; a protected scrim click blurs to the document.
- **Variant switch (side sheet):** acquires and releases the owner without events.
- **Drag:** the bottom-sheet drag is cancelled when another owner covers it.

The mixed-stack oracle (`md-dialog/web-oracle/web-modal-stack.json`, 13 runs over all six orders, with the lower owner
closing first and the covered drag) is checked by `NativeModalStackIntegration` (Swift) and `NativeModalStackTest` (Android):

- the event sequence with targets
- the focus chain after every phase
- the final open state
- the end-of-phase paint against Chrome's `stack-shots/`, which fixes the owners' and scrims' paint order

**Results:** Swift 149 / 149, Android 149 / 149 (details in [md-dialog.md](md-dialog.md)).

**Focus into a lower owner (Android).** When the upper owner closes, focus returns into the lower owner: to its
container when the container held focus, otherwise to the saved group (`restoreFocusedChild()`, with a direct request
when it cannot restore into a surface group).

**Android touch mode.** The window-level key events leave the device in keyboard (non-touch) mode, so the modal suites
restore touch mode when they finish. Without this, later suites' focus checks fail.

## Remaining work

1. Execute the UIKit branches on an iOS SDK (simulator/device) and run VoiceOver/TalkBack.

## Integration notes

- Both platforms keep the previous presentation outside a modal scope (`test-native-preview.sh`; on Android the two
  failing `NativePreviewPresentationTest` cases fail on `md-fab-menu`'s scope requirement and an `md-badge` slot, as on
  the md-list baseline before any modal work).
- **Live hosts.** The SwiftUI LiveRenderer and the Android debug `LivePreviewActivity` install an `AWCModalScope` that
  fills the preview viewport for the three modal tags; the Laboratory treats them as viewport overlays. The Android
  `LivePreviewHostTest` dialog case follows that contract (configured viewport, open by update, scrim dismissal).
- **Overlay as state (SwiftUI).** `AWCModalScope` keeps the presented entries as state and draws them in a plain
  overlay. Preferences from inside an `overlayPreferenceValue` overlay stop reaching the ancestors once nothing else in
  the scope changes, so an inspector missed the exit motion and the removal of a closed modal.
- **Owner `open` binding (SwiftUI, 2026-11-12, from d2's finding).** `AWCNativeView` hands the three owners their `open`
  state as a location-based binding (`$local[awcBool: "open"]`). With `Binding(get:set:)` SwiftUI reported the binding as
  changed on every graph update, so an owner's body ran again after every delivery of its own entries and republished them
  (a new revision) three or four times per frame while a modal moved. A bound preference is delivered once per frame: when
  the dropped change was the removal, the closed modal stayed mounted — invisible, its timeline still ticking, its nodes
  still in the inspection (`test-live-modal` "close() closes the sheet"; d2's sequence stuck in 5 of 12 and 5 of 20 runs).
  Now an owner's body runs when its inputs change (two evaluations and two deliveries per close). Evidence: d2's close sequence 0 of 60 for the bottom sheet and 0 of 60 for the modal side sheet (half under load), `test-live-modal` 8 of 8, the seven modal fixtures on macOS and the iOS simulator and the time-picker fixtures on macOS pass (work/d4-lab/bs/runs/090, 089; traces in runs/082-086).
- **Live-host inspection (Android).** Compose lays out children inside `dispatchDraw` when the root size is unchanged,
  after a pre-draw listener runs. A host that snapshots inspection in pre-draw must settle measure and layout first,
  or a change that moves a surface without resizing anything (a Bottom Sheet switching to detached) is reported one
  draw late.
- **Stale playground build plan.** After pulling the new AWCUI files, an incremental `apps/native-ios-playground`
  build can reuse a stale plan that predates them ("cannot find 'nativeDialog' in scope"). Remove
  `.build/debug.yaml` (or run `swift package clean`) once.

## Session note (2026-10-24)

Stack replay and focus restoration fixes, the hover re-evaluation, the scope overlay and inspection fixes and the live-host scopes are
described in [md-dialog.md](md-dialog.md#session-note-2026-10-24).

## Decisions (autonomous, 2026-10-27, reversible)

- **Paint order — `sourceZIndex` (Chrome's rendering) stays the default.** A dialog (top layer, z-index 2147483647) paints above a
  sheet opened on top of it, as Chrome renders the source; focus and keys follow owner order. Alternative: `ownerOrder`
  (most recent owner on top), already implemented as `AWCModalPaintOrder.ownerOrder`. Revert: set the policy default to
  `ownerOrder` and re-baseline the stack paint fixtures against a source change that raises the later owner.

## Closure bindings audit (2026-11-16, story 6-4)

d4 found that a closure-based `open` binding (`Binding(get:set:)`) handed to a view that publishes preferences made sheets republish every frame. Audit of `packages/native-ios/Sources/AWCUI`: `awcPreviewSheet(isPresented:)` was the one preference-publishing consumer still given closure bindings (`Overlays.swift` sheet, the legacy path of md-dialog / md-bottom-sheet / md-side-sheet without a modal scope; the unused `Inputs.swift` temporalPicker and `Options.swift` optionPicker). They now pass `$local[awcBool: "open"]` (a location binding) and report presentation-driven changes through `onChange` (mdCancel / mdOpen / mdClose). The other closure bindings feed TextField / Toggle / Picker only (no preferences) and stay. `Tests/NativeBindingStuckProbe.swift` (20 open/close cycles per tag, the surface must shrink after each close; part of `scripts/test-native-preview.sh`) passes 120/120 on the old and the new bindings: the preview-scope sheets did not reproduce the stuck state, so the conversion is preventive. Evidence: 6-4-002-binding-probe, 6-4-008-ios-focused.
