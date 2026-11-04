# Swift FAB Menu and FAB Menu Item parity

Status: implemented and verified with the macOS SwiftUI/AppKit runtime. iOS SDK/device execution remains unavailable.

Source: `packages/core/src/components/md-fab-menu/` and `md-fab-menu-item/`, including overlay lifecycle, ripple, token density payloads, and native input/focus infrastructure. The actual Chrome oracle is preserved in `Tests/Fixtures/fab-menu-web-geometry.json` (22 configurations), with anchor event evidence in `outputs/native-parity/md-fab-menu/web-anchor-events.json` in the task workspace.

## Public surface

| Source contract | Swift implementation |
| --- | --- |
| Menu: open, anchor, variant, placement, quick, menuLabel, density | Dedicated menu renderer; separate authored anchor resolves through `AWCFabMenuScope` and actual native geometry. |
| Item: icon, label, disabled, softDisabled, rovingFocusVisible, density | Dedicated menu-item renderer; actual source font, glyph, line box, density spacing, disabled palettes and focus state. |
| Menu default structural slot | Authored `AWCNode` children remain separate actions; no synthetic launcher or replacement menu data in the production renderer. |
| Item icon/default slots | `.symbol` and `.slotText` preserve explicit icon element presence; a blank/whitespace icon element suppresses the prop glyph. Empty label exposes authored default text. |
| Menu show/close/whenClosed | Retained `AWCFabMenuController`, attached with `.awcFabMenuController`. Initial native render is deferred; close returns after beginning closing; whenClosed waits for closing and the actual closed render. |
| mdOpen/mdClose | Null detail; silent initial `open`; event callbacks precede guarded opening side effects. |
| Item mdClick | Null detail and truthful `AWCActivationMetadata`; canceling does not suppress bubbling close, stopping propagation does. |
| Three menu styles | `AWCFabMenuAppearance(itemContainerColor:itemLabelColor:itemGap:)`. |
| Five item styles | `AWCFabMenuItemAppearance(containerColor:labelColor:iconColor:iconSize:cornerRadius:)`. Optional `nodeID` targeting allows one edited child to override inherited defaults. |
| Item state-layer/icon/label parts | Renderer-owned real geometry and metrics via opt-in inspection, plus typed part styles. |

The scope owns no fabricated FAB. A real `AWCNode(id: "demo-fab-anchor", tag: "md-fab", ...)` and a separate menu with `anchor: "demo-fab-anchor"` are siblings. The preview composes these in a centered 360 × 480 point context.

## Behavior that requires explicit regression

- Source capture intercepts pointer, Enter and Space on the anchor before its own action. Opening must emit `mdOpen` without also emitting anchor `mdClick`, toggling, navigating or reconciling an outer group.
- Fresh pointer opening leaves focus on the anchor; keyboard or already-focused pointer opening focuses the first item. Roving traversal includes disabled items while activation stays blocked.
- Up/down traversal follows placement; Tab follows authored order; Shift-Tab at the first item returns to the anchor; Escape closes; typeahead uses current label or visible fallback text.
- `close()` completes during the 180 ms closing phase. Reopening cancels that timer and retains the current `whenClosed()` cycle. Native render settlement progresses while Laboratory visual streaming is paused.
- Outside click observes the containing native window, including padding outside the authored scope. No modal scrim captures unrelated input.
- The FAB keeps its measured extended label and width while the menu applies the source ellipse, vibrant palette and temporary close glyph. The underlying public FAB controller is reused.
- An unrelated authored property update preserves current native open state; a changed authored `open` value replaces it.
- A zero or absent density inherits its native ancestor; a negative local rung overrides it. The overlay explicitly retains density when it moves authored items into its floating presentation.
- Native AppKit pointer observation is passive. A competing zero-distance drag recognizer inside the original ButtonStyle swallowed ordinary pointer actions without Laboratory's injected pointer state. The shared observer now records the real pointer origin without owning activation; both ordinary native input and Laboratory input have regression coverage.

## Validation

`scripts/test-native-fab-menu.sh --disable-build-manifest-caching` runs deterministic controller lifecycle contracts and real offscreen AppKit/SwiftUI geometry, palette, slot and input fixtures. `apps/native-ios-playground/scripts/test-live-fab-menu.mjs` exercises the actual JSON host, bounded/idempotent method retention, nonfatal busy/mismatch errors, result cleanup and paused-stream completion. It is wired into `scripts/test-native-preview.sh`.

Validation on 2026-10-20:

- **19** deterministic controller lifecycle and authored-text contracts passed, including recursive nested slot text, authored symbol text and trimmed-label typeahead precedence.
- **133** actual SwiftUI layout, palette, slot, density, anchor movement, focus, keyboard, pointer, event propagation, outside-click and lifecycle checks passed.
- **27** further checks passed through the ordinary AppKit event queue without Laboratory pointer state, including Button and IconButton anchors and activation after menu removal.
- **18** live JSON host checks passed, including held pointer input, printable typeahead, truthful keyboard activation, root lifecycle identity, method retention/idempotency, nonfatal errors and paused-stream settlement.
- The shared **68** focus/accessibility and **94** FAB view regressions passed. The existing live FAB controller/input regression also passed.
- Library and all three preview products compiled successfully. Menu fixtures run in `test-native-fab-menu.sh` and the existing `test-native-views.sh`; the live protocol fixture runs in `test-native-preview.sh`.

Both live and snapshot hosts decode the three menu and five item appearance fields, preserve explicit slot elements, and scope local item styling to the selected authored node. The selected Menu/Item root has preview identity `component`; anchor and child events retain their actual identities.

## Platform boundaries

All executed native tests use the installed macOS SDK, SwiftUI and AppKit. This machine has no Xcode/iOS SDK or iOS device runtime; UIKit branches must not be described as executed iOS evidence.

Native scoped appearance restores authored FAB appearance after menu close. The Web implementation removes its imperatively installed inline color overrides, including pre-existing inline values. Swift does not destroy immutable authored appearance to reproduce that DOM style-mutation artifact.

Native input metadata replaces the DOM event object; no browser coordinates or fictional original event are attached. CSS selectors and DOM references are represented by typed appearance, explicit scope identity, native accessibility/responder behavior and measured native geometry.

## Closed-menu inspection follow-up

LiveRenderer now requires a real positive-size menu root measurement. A closed or hidden menu cannot fall back to the enclosing360×480 authored recipe viewport. The existing direct live protocol test now checks initial closed state and settled close, and still checks actual open menu geometry:20/20 checks passed. SnapshotRenderer exports image dimensions only and has no component-inspection fallback. Evidence: workspace `outputs/native-parity/md-fab-menu/swift-live-inspection.log`.
