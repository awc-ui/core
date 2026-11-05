# Dialog parity checkpoint

Status: dedicated renderers implemented and verified against the Chrome oracles: SwiftUI on macOS (the UIKit branches
are written but not executed) and Jetpack Compose on the AwcNative emulator. They run inside the shared
[native modal layer](native-modal-layer.md). The source contract is in [md-dialog-source-review.md](md-dialog-source-review.md),
and the oracle inventory is in [md-dialog-native-plan.md](md-dialog-native-plan.md).

## Contract and implementation

| | SwiftUI (`NativeDialog.swift`, `DialogAppearance.swift`) | Compose (`NativeDialog.kt`, `AWCDialogAppearance.kt`) |
|---|---|---|
| Renderer | `AWCNativeView` `md-dialog` → `nativeDialog` (inside an `AWCModalScope`; outside one, the previous presentation) | `AWCComponent` `md-dialog` → `NativeDialog` |
| Hooks (10) | `AWCDialogAppearance` + `.awcDialogAppearance(_:for:)` | `AWCDialogAppearance` + `AWCDialogAppearanceScope` |
| Parts (11) | `AWCDialogPart` + `AWCModalPartAppearance` via `.awcDialogPartAppearance(_:part:for:)` | `AWCDialogPart` + `AWCDialogPartAppearanceScope` |
| Methods | `AWCDialogController` `show()`, `close()`, `whenClosed() async` | `AWCDialogController` `show()`, `close()`, `suspend whenClosed()` |
| Slots | `AWCDialogSlots` (content, headline, icon, actions, header-action) | authored slot registry |
| Labels | 14 locale tables + English fallback; explicit labels win | `AWCDialogLabels` (same tables) |

Behaviour follows the source:

- **Variants:** basic (centred, `min(560, 100% − 48)`, clamped to `vh − 96`) and fullscreen (header row with close and
  header action).
- **Density:** the `max(...)` calcs from the CSS.
- **Paint and direction:** RTL, and the light and dark generated themes.
- **Motion:**
  - Shell transitions with the source timings (300 ms, cubic-bezier(.2,0,0,1)), removed under reduced motion.
  - The close button's 50 ms state-layer tint.
- **Events:**
  - `mdOpen`/`mdClose` on every open change.
  - Escape, scrim, Cancel and the fallback close emit `mdCancel` then `mdClose`.
  - OK emits `mdClose`. `close()` emits `mdClose` only.
  - Payloads are void.
- **Focus:**
  - The first tabbable one frame after open, else the container.
  - Tab and Shift+Tab are trapped.
  - The opener is restored on close.

## Evidence

Evidence lives in `outputs/native-parity/md-dialog/native-{swift,android}/`, each with a `checkpoint.json`.

| Suite | Swift | Android |
|---|---|---|
| Paint and geometry: every part box, controls, body, role/label, initial focus, flat pixels | 2,249 / 2,249 | 2,081 / 2,081 |
| Motion, events, focus and methods: per frame within Chrome's ±2-frame envelope | 9,550 / 9,550 | 4,860 / 4,860 |
| Mixed modal stack (13 runs): events with targets, focus chain, final state, end-of-phase paint | 149 / 149 | 149 / 149 |

The earlier residuals (the Android close-button tint and both stack gaps) are resolved; see the session note.

## Laboratory (gate 3)

Gate 3 installs the three modals in the Laboratory and in both live hosts. Evidence:
`outputs/native-parity/md-dialog/laboratory/checkpoint.json`; installers `work/modal-lab/lab-patch.py`,
`swift-host-patch.py` and `android-host-patch.py` (idempotent anchored edits).

- **Appearance modules (`modal-appearance.js`).** Exactly the source hooks (Dialog 10, Bottom Sheet 16, Side Sheet 9)
  and parts (11, 11, 9), asserted against the component stylesheets, the IR and both released policies. Two shared
  kinds were added: `integer` (the z-index hooks) and `sheetShape` (the sheets' `container-shape`: one to four radii with an
  optional `/` vertical list, emitted as `AWCBottomSheetShape` / `AWCSideSheetShape`).
- **Styles panels** for the three tags (grouped fields, parse/format round trips, invalid input keeps the last valid
  value, Web CSS applied to the source element).
- **Retained updates** for every source property with its source type; **lifecycle methods** through the callId
  protocol (`show`, `close`, `whenClosed` on Dialog and Side Sheet; `show`, `close` on Bottom Sheet, which has no
  `whenClosed`); **events** `mdOpen`, `mdClose`, `mdCancel` (+ `mdBack`); **slots** as released; pointer input. The
  Laboratory canvas is the modal viewport (configured height and retained resize, like Snackbar and Tooltip).
- **Copyable examples** in all seven languages. Every SwiftUI/Compose example presents inside an `AWCModalScope`
  (controllers, typed parts, events, slots, copied snippets). 111 Swift and
  111 Kotlin examples generated from the released policies: `swiftc -typecheck`
  0 errors; `:app:compileDebugAndroidTestKotlin` BUILD SUCCESSFUL
  (0 errors). HTML, React, Vue, Svelte and Angular snippets are asserted to carry every hook.
- **Live hosts.** Both hosts present the three tags inside an `AWCModalScope` that fills the preview viewport, with
  typed appearance from the Studio wire values, controllers, retained updates, viewport resize and the methods.
  `test-live-modal.mjs` (SwiftUI): 63 checks
  passed. Android `LivePreviewModalHostTest` with the other live-host classes:
  44 tests, 0 failures, 0 errors.
- **Support policies and IR.** The three tags are released as dedicated native renderers on both platforms (all
  properties, events, methods and slots; appearance fields and visual parts); the IR is regenerated and
  `cli.mjs check` reports the generated files current.
- **Studio suite** (`node --test *.test.mjs` in `apps/native-playground`): 739/739.
- **Full native suites.** Swift: 48 of 49 view fixtures pass (failing: NativeListStatesIntegration — one flat-pixel case under load (64509/64510), md-list; outside this work); the seven modal fixtures re-run on the final package: 7 of 7 pass; scripts test-native-badge ok, test-native-behavior ok, test-native-button-hosts ok, test-native-button ok, test-native-divider ok, test-native-fab-menu exit 133 (known pre-existing flake (Close restores authored anchor glyph)), test-native-preview ok, test-native-status-dot ok. Android: 261 device tests, 5 failures (5 also fail on the md-list baseline before any modal work: NativeInteractionTest.everySourceTagComposesNatively, NativeInteractionTest.genericProgressUsesSourceDefaultMaximum, NativeInteractionTest.segmentedSetCoordinatesSelectionAndContainerEvent, NativePreviewPresentationTest.allWindowBasedFamiliesComposeInsidePreviewAndCanDismiss, NativePreviewPresentationTest.everyAllowedTextSlotRendersTheEditedContentWithoutMaskingFixtureProperties); none new; unit 195/195.

## Platform differences and open decisions

- **Paint order (open CSS-intent decision).** With the default `sourceZIndex` policy, a dialog paints above a sheet
  opened on top of it, as in Chrome. `ownerOrder` is available. See the modal layer.
- **Escape protection differs across the family.** `scrimDismissible = false` blocks only the scrim here. The side
  sheet also swallows Escape. Recorded as in the source.
- **Hover heuristics.** Native hover follows real pointer movement only (on Android, a change of the pointer's window
  position). As measured in Chrome, `:hover` is not re-hit-tested when the surface moves under a still pointer; it is
  re-evaluated at the next key input and when the dialog begins closing.

## Remaining work

- Executing the UIKit branches (iOS SDK, simulator/device) and VoiceOver/TalkBack runs.

## Session note (2026-10-24)

- **Swift stack (61 → 149 of 149).** Not an event-monitor or hit-test problem. The stack replay compares end-of-phase
  flat pixels, which takes seconds per phase in a debug build; the replay clock kept running, so the following steps
  fired back to back without the updates between them ("Open B" set B's state, and the next Escape ran before B had
  rendered). The replay clock now pauses during the comparison, and the fixture runs with reduced motion (end states
  only; the motion suites verify the shells frame by frame). One real fix came out of it: pressing a bottom-sheet drag
  handle now focuses the sheet container without a ring, as Chrome does, so a dialog opened over a dragged sheet
  restores focus to it.
- **Android stack (142 → 149 of 149).** Focus returns into the lower owner when the upper one closes: the container
  itself when it held focus, otherwise the saved group with a direct request fallback.
- **Android fullscreen close-button tint (2 residuals → 0, tolerances unchanged).** Native hover now tells real pointer
  movement from Compose's re-sent events by the pointer's window position, and re-evaluates `:hover` at the next key
  input (Chrome hovers the close button on the first Tab after the dialog appeared under the pointer). The replay moves
  the pointer when Chrome's click step begins (Chrome's trusted move precedes press and release by about 30–40 ms).
- **Android live-host inspection.** After a retained Bottom Sheet `variant` change (standard → detached), the live
  host kept reporting the previous container position until the next update, although the frame showed the moved
  sheet. Logging showed the update composing and placing the detached sheet in the same frame. The host took its
  inspection snapshot in the pre-draw listener, but Compose relayouts children inside `dispatchDraw` when the root size
  is unchanged. The snapshot was one layout behind, and an idle surface never drew again. The debug host now settles
  pending measure and layout (`ViewRootForTest.measureAndLayoutForTest()`) before the snapshot. Two earlier
  changes did not cause or fix this and are kept as hardening: `AWCModalEntryEffect` republishes the entry content after
  each owner recomposition, and the sheet and dialog read their placement geometry as state in the measure block.
- **SwiftUI scope overlay.** After a sheet closed, the live host still reported its parts. `AWCModalScope` drew the
  entries in an `overlayPreferenceValue` overlay, and preferences produced inside it (the inspection nodes) stopped
  reaching the scope's ancestors once nothing else in the scope changed: the exit motion and the removal were never
  reported. The scope now keeps the presented entries as state (`onPreferenceChange` into a plain overlay); each owner
  update republishes its entry with a serial, since `AnyView` has no equality. The seven modal fixtures were re-run on
  the final package.
- **Laboratory launcher.** Both live hosts show the web recipe's tonal launcher ("Open dialog", "Open bottom sheet",
  "Open side sheet") under a closed modal. It calls `show()` and is inert while the modal is open.
  `test-preview-presentation.mjs` now checks it in the configured viewport; the old check expected the preview to grow
  around a platform presentation, which the hosts no longer use for these tags.
- **Studio.** The AI-instructions guide passed bare numbers as samples for affine length fields, so the guide failed
  for Card, Bottom Sheet and Side Sheet (Card already on the md-list baseline). The samples are now length objects.
  The content-editor test now expects `md-split-button`, whose recipe declares a text-bearing default slot.
  `cli.mjs build` refreshed the stale md-avatar source hash in its IR and the catalog.
- **Laboratory (gate 3)** as above.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeDialogMotionIntegration` | **13520/13520** | **13612/13612** | **13519/13519** |
| `NativeDialogPaintIntegration` | **2249/2249** | **2249/2249** | **2249/2249** |
| `NativeModalStackIntegration` | **149/149** | **149/149** | no result |
| **Total** | **15918/15918** | **16010/16010** | 15768/15768 |

Dialog motion and paint pass on all three runtimes. The modal stack fixture crashed in the iOS 18.6 full run (harness: simulator install "File exists"); rerun 149/149 (`r8o2-`).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
