# Card parity checkpoint

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in
production dispatch (`AWCNativeView` and `AWCComponent`). Public appearance and part
APIs exist on both platforms. The macOS and Android runtime checks below pass against
trusted-input Chrome oracles. This is an implementation checkpoint, not the separate
final all-component audit or an iOS runtime claim. The Laboratory integration (gate 3)
is in place and verified; see [Laboratory](#laboratory).

## Contract and implementation

All nine properties are implemented: `variant`, `interactive`, `dragEnabled`,
`disabled`, `softDisabled`, `ripple`, `fullWidth`, `fullHeight` and `density` 0…−4.
A local density overrides the inherited token, and zero inherits.

**Events**
- `mdClick` carries the click's `{type, isTrusted, button, detail, clientX, clientY}`.
  - A pointer click is trusted with detail 1 at the client point.
  - Enter/Space on the card is untrusted with detail 0 at (0,0).
  - A keyboard activation of authored content is trusted with detail 0. It bubbles to the card exactly as in Chrome.
- `mdDragStart`/`mdDragMove`/`mdDragEnd` carry `{clientX, clientY, offsetX, offsetY, startX, startY}` in viewport/window points.
  - Start fires when the Manhattan distance first reaches 5, followed by a move with the same detail. Natively that paired move is delivered in the view update that follows the start event, so a start handler's property changes or removal apply first (the source's synchronous re-entrancy guard).
  - End fires only after a start, and that release produces no click.
  - Disabling, `dragEnabled=false` or disappearing cancels silently, including from inside the start handler.
- While dragging, the card is translated physically (also in RTL) and raised (z-index 1000).

**Slots.** The default slot is laid out as a column flex box: border-box sizing, physical padding, gap, stretched children and clipping (`overflow: hidden`).

**Typography.** body-medium is inherited by authored text.

**Hooks and parts.** The fourteen hooks are `AWCCardAppearance` (Swift and Compose):
- colours (#RRGGBB/#RRGGBBAA)
- asymmetric/elliptical corner shapes
- shadow lists
- outline width
- affine width/min/max/height/min/max lengths (px, %, em, rem, ch, calc)
- physical padding and gap

Sizing matches the source: min wins over max, percentages use the parent, and `full-*` means 100% of the parent while the caps still apply.

The two parts are `AWCCardPartAppearance` (state-layer colour, outline colour/width). Part rules win over hooks and state rules, as outer-tree `::part()` rules do.

**State cascade.** The source cascade is reproduced rule by rule:
- Hover, focus-visible and :active outrank the dragged class. During a trusted drag Chrome therefore paints the pressed .12 layer and the pressed elevation, and native matches it.
- Disabled overrides colour and elevation (`!important`).
- Soft-disabled hides the state layer but stays focusable.
- Hard-disabled ignores the pointer.
- Outlined focus turns the border on-surface.
- The focus ring is 3px secondary at a 2px offset, outside the clip.

**Transitions**
- Elevation and container: CSS transitions of 100 ms (short2) with the standard easing.
- State layer: 50 ms (short1).
- Both are instant under reduced motion.
- md-ripple keeps animating under reduced motion: 450 ms growth, 150 ms fade after release, origin at the press point, radius to the farthest corner, centred for the keyboard.

**Role and tab stop.** The card is a button with a tab stop only when interactive and its content has no interactive controls.
- Swift derives this from the authored node tree (the source selector).
- Compose content is opaque, so authored controls mark themselves with `Modifier.awcCardInteractiveContent()`. Swift has the equivalent `AWCCardInteractiveRegion`.
- A press on marked content never starts a drag.

## Evidence

The oracles are in `outputs/native-parity/md-card/web-oracle/` (Chrome 153, DPR 1, trusted CDP input). They are copied byte-identically into `packages/native-ios/Tests/Fixtures/card-web-*` and the Android test assets:
- `web-paint.json`: 448 cases (360 matrix, 48 all-hooks, 14 single-hook, parts, 25 layout/composition).
- `web-states.json`: 57 runs, 315 phases, 7,038 samples.
- `web-states-reduced.json`: 9 runs, 45 phases.

Checks performed:
- **Paint:** box, padding, gap, typography, colours, shadow list, outline, state layer, role/tab stop, authored child boxes, and every flat pixel of the clip (authored UA controls masked).
- **States:** real NSEvent and Compose mouse/key input at Chrome's input times.
  - Every rendered state-layer, elevation, container, translate and ripple value at its render time, within Chrome's samples (±2 frames; monotone envelope across gaps longer than two frames).
  - mdClick/mdDrag* order and payloads (±0.01).
  - Focus, focus ring, z-index, source timings and paint per phase.
- **Dispatch:** `AWCNativeView` md-card renders the dedicated renderer (default slot only).

| Suite | Result | Evidence |
| --- | --- | --- |
| Swift paint (`NativeCardPaintIntegration`) | 6,912/6,912 (448 cases + dispatch) | `outputs/native-parity/md-card/native-swift/` |
| Swift interaction (`NativeCardStatesIntegration`) | 167,324/167,324 (66 runs); 163,345/163,345 in the full-suite run (the per-frame count follows the frames rendered) | same |
| Android paint (`NativeCardParityTest`) | 6,699/6,699 (448 cases) | `outputs/native-parity/md-card/native-android/` |
| Android interaction (`NativeCardInteractionTest`) | 55,810/55,810 (66 runs) | same |
| Full Swift view suite | 36/36 view fixtures pass. Package scripts: 6/8 pass; `test-native-button` (button-appearance hex8 case) and `test-native-preview` (live button-group keyboard selection) fail outside md-card | `native-swift/full-suite.log`, `full-scripts.log` |
| Full Android device / unit suites | Device 233/239: the 5 known non-card failures plus one accordion frame-timing check that passes in isolation (`accordion-states-rerun`). Unit 190/190 | `native-android/full-2*` |

## Laboratory

Evidence: `outputs/native-parity/md-card/laboratory/` (`checkpoint.json` hashes the sources and summarises every run below).

- **Studio.** `card-appearance.js` exposes exactly the fourteen source hooks (asserted against the `--md-card-*` names in `md-card.css`, the IR and both support policies), typed parse/format/native literals, request validation, retained updates for all nine properties, live pointer gating, Styles panels on all three platforms and copyable framework/native examples (`card-integration.test.mjs`, 7 tests).
- **Examples.** 28 generated cases per platform (`examples/CardParity.swift`, `CardParity.kt`): Swift typecheck clean, Android compile successful.
- **Policies and IR.** md-card entries in `NativeSupport.json` and `support.json`; IR and catalog regenerated, `cli.mjs check` clean. The earlier "stale source hash" note was wrong: the IR hash covers the `.tsx` and `.css` and was current (`420f71e5…`).
- **Live hosts.** SwiftUI `LiveRenderer` and `SnapshotRenderer` take `cardAppearance`/part appearance and validate card patches (`test-live-card.mjs`: 24/24). Android `LivePreviewActivity` with `LivePreviewCard.kt` (`LivePreviewCardHostTest`: three host sessions — width hook, padding/gap, density −4 52→32, trusted click, drag threshold and events, invalid updates rejected).
- **Lifecycle replay.** The eighteen scenarios of `web-lifecycle.json` are replayed natively (`NativeCardLifecycleIntegration`, `NativeCardLifecycleTest`). That oracle dispatches synthetic pointer events, which never produce clicks, so `trusted-lifecycle/web-lifecycle-trusted.json` recaptures the click-relevant scenarios in Chrome 153 with CDP mouse and touch input. macOS is checked against the mouse capture, Android against the touch capture. Native equivalents: `awcCardInteractiveContent(activates:)`/the node tree for authored and shadow controls, removal from the hierarchy for disconnect, outer modifiers for authored inline styles, ACTION_CANCEL for pointercancel/lostpointercapture (Android).
  - Defects found and fixed. Android: a second pointer took over the gesture and clicked; ACTION_CANCEL ended the drag with `mdDragEnd`; Enter/Space typed into an authored text field produced a card `mdClick`; a start handler's disable/drag-off/removal still got the paired move (and an end on removal). macOS: the same re-entrancy move, and a card removed by its start handler kept emitting moves.
  - Measured trusted-input results now matched: mouse `toggle-dragEnabled` = start, move, click; `reentrant-dragEnabled` = start, click (a cancelled drag does not suppress the click); touch adds no click in either.
- **Results** (`laboratory/`):

| Suite | Result |
| --- | --- |
| Studio focused (card, accordion, API/usage examples) | 88/88 |
| Studio full (`node --test *.test.mjs`) | 721/723; the 2 failures are outside md-card (`ai-instructions` README availability, `recipes` md-split-button text editor) |
| Swift lifecycle (`NativeCardLifecycleIntegration`) | 32/32 |
| Swift paint / interaction after the lifecycle fixes | 6,912/6,912; 153,885/153,885 (one check per rendered frame) |
| Swift live host (`test-live-card.mjs`) | 24/24 |
| Android lifecycle (`NativeCardLifecycleTest`) | 29/29, also against the trusted touch capture |
| Android paint / interaction / live host after the fixes | 6,699/6,699; 55,810/55,810; `LivePreviewCardHostTest` 1/1 (three sessions) |
| Android full device / unit | 236/241: only the 5 known non-card failures (`NativeInteractionTest` ×3, `NativePreviewPresentationTest` ×2); unit 190/190 |
| Swift full view suite, package scripts, live hosts | 37/37 view fixtures (card paint 6,912, interaction 171,114, lifecycle 32/32 inside); package scripts 8/8 and live hosts 17/18 after the live-host key fix below (the full run before it: 7/8 and 4/6, failing only `preview`/`button-group`); `test-live-stream` ("The native stream must make progress") fails identically on the session-start tree, outside md-card |

- **Triage of the two Swift script failures** (both pre-existing; reproduced on a session-start tree rebuilt from `git archive` + the session backup patch):
  - `test-native-button`: the test was wrong. `AWCButtonAppearance` documents and accepts `#RRGGBB`/`#RRGGBBAA` (as do Android and the source, whose colour hooks take any CSS colour); the test still expected 8-digit hex to be rejected. Fixed: 1,073/1,073.
  - `test-live-button-group.mjs:16` (pointer press, ArrowLeft, Space) and `test-live-preview.mjs:121` (Tab, Enter): the native live host was wrong. Both fail identically on the session-start tree; even Tab, ArrowLeft, Space produced no activation. `LiveRenderer` sent Enter/Space through `NSApp.sendEvent`, which routes keys to the key window, and its borderless off-screen preview window is not key while the renderer runs in the background, so the keys were dropped (the view fixtures, which pass, deliver to the window directly). The live host now delivers to the preview window when it is not key (Escape keeps the application path for event monitors). `test-native-preview` and 17 of the 18 live hosts pass; the remaining `test-live-stream` failure is pre-existing and unrelated (see open items).

## Platform differences and open items

**Native differences (measured, listed for review)**
- **Multi-line authored text.** SwiftUI has no CSS line-height. The card applies the font, tracking and `lineSpacing`, but the half-leading above the first line and below the last is not reproduced. A wrapped paragraph is ~3.6pt shorter per paragraph at 14/20. The paint cases give authored children the box Chrome gave them.
- **Compose focus.** Compose pointer input does not move focus to authored buttons, whereas Chrome focuses a pressed `<button>`. Material buttons join Tab traversal only in keyboard input mode. The nested run focuses the authored button directly.
- **Stacking scope (gate-7 r3-19, fixed).** `z-index: 1000` while dragging stacks against the document: the card lifts the AWC hosts above it (lift chain, see md-accordion-swift-renderer.md "Document stacking"), so it paints over the containers that follow its own; it stays in its slot and is clipped by its scroll containers, as in the source. On Android the card previously did not rise above its own later siblings either. Chrome oracle `d3-lab/web2/stacking.mjs`; `NativeStackingIntegration`, `NativeStackingTest`. Application containers between AWC components join with `awcStackingLift()` / `AWCStackingLift { }`.
- **Cursor and accessibility values.** The cursor (grab/grabbing/pointer) and `aria-grabbed` are not mapped yet.
- **Touch click after an in-bounds move (Android).** A 30-point touch move on authored content followed by release inside the card reports `mdClick`; Chrome's touch tap is cancelled by the move (trusted touch capture: no events). Android tap rules are kept.
- **Single mouse pointer (macOS).** Pointer ownership is replayed with two touch pointers on Android only.
- **Paired move timing.** If another pointer event reaches the card before the next view update, the pending paired move is flushed first with the properties the card currently has.

**Source decisions recorded, not changed natively**
- Pressed styles outrank the dragged styles, so `.16`/e4/e3 never show with physical input.
- Inner controls fire the card's `mdClick`, which is undocumented.
- "Interactive only" in the docs also applies to drag-enabled cards.
- The disabled container is translucent.
- State rules override the elevation hook.

**Pending**
- `test-live-stream` (pre-existing, not md-card): "The native stream must make progress" on both the current and the session-start tree.
- Assistive-technology execution, iOS (no SDK) and the independent final audit.

## Laboratory inspection schema (2026-10-27)

The SwiftUI card reported its content gap as a number under `gap`, which the Laboratory's inspection schema reserves for a `{row, column}` record, so every SwiftUI card live preview failed with `502 INVALID_LIVE_FRAME`. It now reports `gap` as `{row: gap, column: 0}` and keeps the number as `contentGap`. Card paint 6,912/6,912, states 168,277/168,277, lifecycle 32/32, `test-live-card` passes, and the preview opens through the server. See [laboratory-sweep.md](laboratory-sweep.md).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeCardLifecycleIntegration` | **32/32** | **32/32** | **32/32** |
| `NativeCardPaintIntegration` | **6912/6912** | **6912/6912** | **6912/6912** |
| `NativeCardStatesIntegration` | 188523/188526 | 190525/190527 | 180870/180871 |
| **Total** | 195467/195470 | 197469/197471 | 187814/187815 |

Press from the UIKit touch (iOS fixes 26). Open: `dragClick/clickPress` shot, 1–3 checks per runtime (2 / – / 3 with fewer simulators busy): the second press's ripple edge at the capture frame (ios-harness.md Open items 1).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
