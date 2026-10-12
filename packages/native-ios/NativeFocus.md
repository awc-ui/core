# Native button focus and accessibility

`md-button` consumes `groupTabindex` and `roleOverride` in its real native responder and accessibility surface. The visible SwiftUI `Button` still owns pointer presses, source styling/ripple, and activation. The native surface supplies keyboard and accessibility actions through the same cancelable action dispatcher; it does not introduce another clickable visual element.

The supported focus contract is `null` (ordinary entry), `0` (entry) and `-1` (excluded from sequential keyboard traversal, but still pointer, accessibility and programmatically focusable). Hard-disabled buttons cannot receive keyboard focus. Soft-disabled and loading buttons keep focus while all their activation paths remain blocked. Other nonnegative values behave as ordinary native entries; HTML positive-tabindex sorting is not implemented.

On enabled buttons, pointer presses retain native focus and group ownership without displaying the keyboard focus ring or focus tint. Keyboard traversal, key input and explicit native/accessibility focus requests display the indicator. Pressing an already keyboard-focused enabled button clears those focus visuals immediately; subsequent keyboard input restores them. Focus tint, outline color and elevation all use this same visible-focus state, matching the web button's `:focus-visible` styling.

`md-button-group` creates an `AWCButtonFocusGroup`. It collects button/icon-button descendants in source order, stopping at nested groups, which own independent native scopes. Left/Right wrap through eligible buttons and reverse in RTL; Home/End use source order. Up/Down and Tab remain native owner commands. There is one group entry: recent eligible focus/activation, otherwise the selected child in single-select mode, otherwise the first eligible child. Changing selection mode, children, direction or hard-disabled state recomputes that entry. Moving focus never changes selection or emits source click/change events. Unknown/unregistered children retain their standalone focus policy rather than silently disappearing from Tab order. Keep explicit native node IDs unique within each group.

This nearest-group policy intentionally differs from the web component's broad descendant query, which can allow nested groups to handle the same bubbling key. Native selection coordination still follows the adapter's explicit child composition; focus traversal does not reproduce arbitrary DOM tree mutation or CSS ordering.

Supported role overrides are `button`, `link` and `gridcell`. Empty or unknown roles fall back to the safe native button/link role inferred from the action. Arbitrary ARIA roles are not interpreted. A selected gridcell exposes selected state even when `toggle` is false. macOS exposes an actionable native accessibility cell; UIKit exposes actionable button/link and selected/not-enabled traits plus `UIAccessibilityContainerDataTableCell` coordinates. UIKit has no general ARIA gridcell trait. A composite owner can supply real row/column metadata:

```swift
AWCNativeView(node: AWCNode(
    id: "day-12", tag: "md-button",
    properties: ["roleOverride": "gridcell", "groupTabindex": -1, "selected": true],
    children: [.text("12")]
))
.environment(\.awcGridCellContext, AWCGridCellContext(row: 1, column: 2))
```

`AWCGridCellContext` uses zero-based indices. Without explicit context, the native accessibility API receives an unknown range instead of invented calendar coordinates. Calendar month/page/vertical navigation belongs to the calendar owner; adding `gridcell` does not turn a standalone button into a button group or a complete calendar table.

`AWCButtonAccessibilityDemo(properties:onEvent:)` demonstrates the real before/group/after Tab order, disabled/soft-disabled/loading controls, RTL arrows, and a selected `-1` gridcell. Its `nativeFocus` observations are explicitly native demo events, not invented source md-button events. Hosts can observe `.environment(\.awcNativeFocusChanged, ...)` or compose the reusable `AWCButtonFocusGroup` with `.environment(\.awcButtonFocusGroup, ...)`.

The offscreen host returns an empty SwiftUI accessibility-children tree even for standard SwiftUI Text/Button sentinels. The regression therefore checks actual native accessibility objects, their roles/selection/coordinates/parents and activation methods; it does not claim screen-reader tree reachability or VoiceOver certification. No global accessibility setting is changed.

The AppKit implementation is compiled and exercised with actual `NSWindow` key-view traversal, scoped key events and accessibility methods in an offscreen test window. UIKit connects focus-engine updates with its responder and group state, and uses `UIFocusSystem` for requested arrow focus. This host has no iOS SDK/device or XCTest runtime; iOS hardware-keyboard/VoiceOver behavior must also be exercised on an iOS build. We do not claim that a macOS run validates iOS runtime behavior or reproduces DOM/ARIA semantics.

Apple API references: [UIFocusSystem](https://developer.apple.com/documentation/uikit/uifocussystem), [focus updates](https://developer.apple.com/documentation/uikit/uifocusenvironment/didupdatefocus(in:with:)), [native data-table cells](https://developer.apple.com/documentation/uikit/uiaccessibilitycontainerdatatablecell), and [AppKit custom accessibility](https://developer.apple.com/documentation/appkit/custom-controls).

Reproduce core and actual native-window regressions from the repository root:

```sh
packages/native-ios/scripts/test-native-behavior.sh
packages/native-ios/scripts/test-native-views.sh --disable-sandbox
```

The second script builds the library and runs both form/navigation/event and focus/accessibility integration fixtures. It requires a macOS WindowServer session and opens only private offscreen windows. It neither reads nor drives other applications.
