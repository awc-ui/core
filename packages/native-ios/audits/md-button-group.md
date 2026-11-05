# md-button-group — SwiftUI audit

Reviewed 2026-10-20 against `packages/core/src/components/md-button-group/md-button-group.tsx` and CSS, plus button/icon-button layout, action and focus code. Native implementation: `NativeButtonGroup.swift`, `NativeButtonGroupState.swift`, `ButtonGroupAppearance.swift`; child integration uses the existing real button/icon-button controls.

| Web surface | Native implementation and evidence |
| --- | --- |
| `variant` standard/connected | Standard source gaps and independent neighbor motion; connected gap 2, direct xs/sm child floor48, logical corner overrides. An initially connected group retains the source absence of motion listeners after switching to standard. |
| `size` xs/sm/md/lg/xl | Injected into all authored button/icon-button descendants together with `toggle=true`; direct children keep their independent variant and content. All25 text size/density combinations measured in actual SwiftUI. |
| `shape` round/square | Injected into descendants. Connected direct children use source logical outer/inner, selected and pressed radii, overriding child radius hooks. Text and icon outer radius ladders differ where the Web source differs. |
| `density` 0…-4 | Source gap and child typography/inset/size taper; explicit negative child density wins, otherwise context density inherits through wrappers. A nested group inherits density unless it declares a negative local rung. |
| `selectionMode` | Single-select clears other descendants after the child action; multi-select preserves them. Values retain authored order, duplicates and empty strings. |
| `required` | Restores the clicked child if the resulting group has no selected child; still emits the source notification with an empty diff if values did not change. Suppresses motion on an already selected required child. |
| `fullWidth` | Overrides the group width hook and distributes flex content-box space. Resolved per-child padding/border is added before child min/max clamps. Does not freeze children at intrinsic label width: nowrap content may clip. Narrow connected groups preserve child minimum 48 and overflow. |
| Default structural slot | Compose native `AWCNode` button/icon-button children and wrappers. Descendant identity remains independent from value; nested raw selection reconciles inner then outer source groups. |
| `mdSelectionChange` | Exactly `values`, `added`, `removed`; previous event snapshot uses source Set membership semantics while preserving duplicate array entries. Carries truthful native activation ID/source rather than a fabricated DOM MouseEvent. |
| Methods / CSS parts | Source declares none. No fabricated source methods or parts are advertised. |
| Seven public CSS hooks | `AWCButtonGroupAppearance(gap:width:minWidth:maxWidth:height:minHeight:maxHeight:)`, applied with `.awcButtonGroupAppearance`. Optional finite 0…2400 pt values inherit fieldwise. Internal `--md-button-group-_unset` is not an eighth public hook. |
| Focus and accessibility | Actual native responders provide one sequential entry, RTL Left/Right, Home/End, recent/selected/first eligible fallback, hard-disabled skipping and selected/disabled child semantics. Parent focus forwarding reproduces broad nested source arrow/focus propagation. SwiftUI exposes a containing accessibility group; ARIA/DOM strings are not executed. |

## Source behavior deliberately preserved

The group listens to the raw child click independently from the child's custom `mdClick` event. Therefore canceling/stopping a button's custom event blocks its own toggle/action, but the group still clears other selected children and applies required restoration. Soft-disabled/loading pointer clicks can similarly emit only `mdSelectionChange`; hard-disabled controls cannot. Group-event cancellation is observable but happens after selection commit. Button activation emits `mdClick`, then `mdChange`, then group notification; icon buttons emit `mdClick` then group notification. Nested groups append inner then outer notifications.

Standard motion changes actual horizontal padding on text children and width on icon children: per-side active deltas3/4/5/6/8 by size, split negatively across immediate neighbors, peak 150 ms and completion 400 ms with the source cubic easing. A canceled child action does not cancel the independent motion. Release before 400 ms still completes the timeline. Reduce Motion suppresses it.

Nested property synchronization follows the latest source synchronization, not permanent nearest-group inheritance. Initial outer group properties win; a later inner size/shape/variant change reinjects that inner group’s authored values, and a later outer change reinjects all descendants. Shared per-child injected-property state preserves this ordering independently of SwiftUI appearance-callback order. Nested group boxes stretch to the outer row, so inner text can stretch to96 while an md icon remains56; when an inner md group raises an outer sm row, outer text stretches to56 without changing its sm typography.

Mixed layout follows the measured Web oracle: sm group height 72 gives text72/icon40/text72; height 20 leaves40-high children overflowing; lg height 72 leaves96-high children overflowing; lg maxHeight 40 caps all40. Under fullWidth 600, mixed sm children are approximately202.667/170.667/202.667 with gaps12, because text children carry32pt total padding and icon children carry none. Group min dimensions win conflicting max dimensions. Explicit maxHeight updates the text child minimum as the source CSS variable rule does.

## Host integration

Both hosts accept `buttonGroupAppearanceDefaults`/`buttonGroupAppearance`, and `buttonGroupSelection:[Bool]` in actual authored descendant order. The latter is strictly length checked and does not derive identity from value strings. Live capture emits the same exact ordered boolean state alongside inspection. Group held pointer down/up/move/cancel uses normal native dispatch. The default Day/day, Week/week, Month/month fixture matches Web; Day starts selected and all three use the source filled button variant.

## Verification

Checked-in runners:

- `sh packages/native-ios/scripts/test-native-button.sh --disable-build-manifest-caching`: **1,072 checks passed** (161 group + prior770 button/icon +141 FAB), shared with XCTest; appearance validation, state/diff/duplicate identity, nested focus routing and connected corner tables.
- `AWC_NATIVE_VIEW_FIXTURES=NativeButtonGroupViewIntegration sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching`: **87 group checks passed**, including the exact four-step nested property and mixed-height Web oracle. Earlier affected shared regressions passed **68 existing focus checks**, **88 button inspection/layout checks**, and **268 icon-button checks**, all in actual offscreen AppKit/SwiftUI windows.
- `swift build --package-path apps/native-ios-playground --disable-build-manifest-caching`: builds AWCUI, AWCPlayground, AWCSnapshots and AWCLivePreview.
- `node apps/native-ios-playground/scripts/test-live-button-group.mjs`: real JSON request → native view → frame/events/ordered-selection verification; all seven layout hooks, scoped merge, padding 32 / fullWidth 576, held pointer, keyboard roving/Space, required restoration and multi-select passed.

The runtime matrix initially exposed fixture lifecycle errors from resetting stored preferences while retaining their observer and selecting responders retained during identity transitions. Each independent fixture now resets the complete observation scope and disables those transitions. These were distinguished from production layout issues; the full matrix then passed.

## Platform boundaries

Only the macOS SwiftUI/AppKit path was compiled and executed. This environment has Command Line Tools and no iOS SDK, simulator, device or VoiceOver execution; UIKit hardware focus/keyboard behavior remains unverified. The shared native layout/state implementation is used on iOS17+, but a macOS run is not iOS runtime evidence.

Native tree children, scoped events and typed dimensions replace DOM nodes, slots, custom-property evaluation and raw browser events. Arbitrary CSS selectors, CSS ordering and DOM mutation observers are not executed. Child component content continues to use that component's own native renderer and separate parity audit.

The final affected-pointer rerun passed **22 button appearance/pixel checks** and **87 group checks**. It verifies loading pressed state-layer coloring without child activation and inherited density/motion through a structural wrapper. Existing icon/button/focus regressions passed before that focused visual correction.
