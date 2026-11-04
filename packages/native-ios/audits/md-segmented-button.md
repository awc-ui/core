# Swift segmented button and set parity

Source: `packages/core/src/components/md-segmented-button` and `md-segmented-button-set`. The measured Chrome reference is retained in `Tests/Fixtures/segmented-web-geometry.json` (35 cases, 2026-10-20).

| Source contract | Swift implementation |
| --- | --- |
| value, selected | Authored value and controlled standalone state. A standalone activation proposes state without mutating selected. |
| disabled, softDisabled | Both block activation and use source disabled colors. Hard disabled excludes native focus; soft disabled remains focusable. |
| icon, label, noCheckmark | Real Material Symbols, property-label precedence, stable leading/trailing checkmark reservations, and source icon-only centering. |
| ripple | Native ripple obeys the property and disabled state. Keyboard activation uses the real responder. |
| segmentIndex, segmentTotal | Logical first/last corners, middle outline seams and the source final negative leading margin. |
| segmentDensity, density | Parent class scale and local/ancestor density are resolved separately from inherited spacing tokens. A local -1 does not reset a dense ancestor's inset. |
| segmentMultiselect | Radio versus checkbox native checked state; selection proposal and arrow behavior follow the actual managed property. |
| Set multiselect, density | A real set synchronizes all authored descendants. Initial outer synchronization wins; later inner/outer changes replace managed properties in source order. |
| mdSegmentClick | Exact `{value, selected}` detail, cancelable native scope transaction and truthful activation metadata. |
| Set mdChange | Nearest set consumes the internal event, commits by identity and emits the exact ordered string array, including duplicate/empty values. |
| Default and icon slots | Native child composition; the named icon is additive to the property/checkmark graphic. `.slotText("", slot: "icon")` preserves an explicit blank box; `.symbol` supplies a real Material glyph. |
| Seven CSS hooks | `AWCSegmentedButtonAppearance(containerColor:selectedContainerColor:labelColor:selectedLabelColor:outlineColor:cornerRadius:iconSize:)`. Defaults inherit; optional `nodeID` on `.awcSegmentedButtonAppearance` targets one authored child. |
| Four CSS parts | Actual state-layer/checkmark/icon/label geometry and resolved metrics are reported through native inspection. A hidden checkmark reservation is identified separately. |
| Methods | Neither source component declares public methods. |

The set uses equal columns and preserves the last segment's one-point seam overlap. Content remains centered and clipped when the offered width is smaller than its text. RTL reverses physical placement once; arrow keys still traverse authored order as the source does. Every non-hard-disabled segment remains a sequential tab stop. Single-select arrows focus and activate; multiselect arrows only focus. Soft-disabled targets can receive focus but do not activate.

Canceling `mdSegmentClick` does not prevent the set's commit: the source parent does not inspect cancellation. Stopping propagation before the set prevents its receipt. The set does not enforce single selection on initial authored children or merely changing multiselect; it reconciles on activation. Removed identities are pruned at the owning root so a later new node with the same ID starts from authored state.

Visible nowrap text collapses ASCII whitespace, including newlines, while preserving NBSP. Accessible labels retain the authored string. The source's initial slotted-label decision is retained across updates; later default content still renders even when its initial label wrapper was absent.

`View.awcDensity(_:)` exposes a finite inherited density token. Explicit component rungs -1...-4 override it, while a default zero continues to inherit. Nonfinite scope inputs preserve the parent. Density scale and compressed inset inheritance remain separate.

## Verification

- `AWC_NATIVE_VIEW_FIXTURES='NativeSegmentedViewIntegration' sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching` passed **286** Segmented contracts and actual SwiftUI/AppKit checks. The preceding combined run also passed **68** shared focus checks and **19** Menu lifecycle/typeahead contracts.
- The Segmented fixture covers all 35 measured Web cases, native geometry/line boxes, palette hooks, additive/blank slots, native keyboard/AX controls, event order/cancellation, duplicate values, nested latest-sync behavior, reorder/removal/reinsertion, dynamic slots, whitespace and public inherited density.
- `node apps/native-ios-playground/scripts/test-live-segmented.mjs` passed **12** real host checks: standalone controlled proposals, composed Day/Week/Month context, local styles, parent density, held pointer, keyboard and actual ordered frame metadata.
- All three preview products compiled. The checked-in slot/context fixture passed **33** contracts against the final host library. **20** generated Swift Segmented examples typechecked successfully through the independent shared integration review.
- Slot/context, actual view and real host regressions are wired into the existing native test runners. The final view run includes independent state-layer color/opacity pixel checks and proportional corner scaling for narrow boxes.

The live and snapshot hosts compose actual authored children. `segmentedContext` selects standalone or set mode; the selected first child has identity `segment-day`. Defaults style the subtree; local styles target that child. `segmentedSelection` comes from actual native state rather than inferred event values.

SwiftUI rounds native text advances to its layout grid. The largest accumulated difference in this 35-case corpus is approximately 1.6 points across three equal columns; each text/column comparison is bounded separately from the exact native equal-track and negative-seam placement checks. Native logical points map one-to-one to the preview's CSS logical pixels.

Executed native evidence uses the installed macOS SDK, SwiftUI and AppKit. No Xcode/iOS SDK or iOS device runtime is available; UIKit branches are compiled only when such a toolchain is supplied and are not claimed as executed here. Native responders, event scopes, typed appearances and measured geometry replace DOM objects and CSS selector APIs.

## Additional narrow-grid audit

An independent browser oracle added twelve constrained width/density/RTL cases. The grid now retains each child's real padding minimum and final negative seam margin while distributing remaining fractional tracks. At width60/density0 the tracks are24/24/23 and overflow the host to71; RTL reverses physical placement. At density−4 equal20 tracks fit, with the last child21 wide after its −1 seam. Proportional CSS corner scaling keeps a single rounded end20 wide on a24×40 child.

`AWC_NATIVE_VIEW_FIXTURES=NativeSegmentedViewIntegration sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching` passed370/370 checks (the original286 plus84 checks against all twelve new fixtures). The original35-case oracle is unchanged; the additional data is checked in as `Tests/Fixtures/segmented-web-narrow-geometry.json`. Evidence: workspace `outputs/native-parity/md-segmented-button/swift-narrow.log`.
