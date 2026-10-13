# AWCUI native Swift library

SwiftUI renderers for the AWC component catalog, with generated typed property wrappers and source-derived light/dark color tokens. iOS 17+ and macOS 14+. No JavaScript runtime or WebView.

```swift
import SwiftUI
import AWCUI

struct Example: View {
    var body: some View {
        AWCButton(
            properties: .init(icon: "add", toggle: true),
            children: [.text("Create project")]
        ) { event in
            print(event.name, event.detail.json)
        }
    }
}
```

For dynamic composition, use `AWCNativeView(node:)`, with `AWCNode(tag:properties:children:slot:)` and JSON-compatible `AWCValue`. Values use the original camelCase property names. `AWCNode.text` represents text content. Named slots are represented by the child node's `slot` field. Keep node IDs stable when updating a tree. Nested children share radio-name groups and tabs/panels linkage; wrap separate sibling trees in `AWCNativeScope` to share that context. A panel group's `for` property matches its tabs node ID.

The renderer merges source defaults with supplied properties, keeps local interaction state, and resynchronizes when the host changes properties. All emitted events include `name`, source `tag`, stable `nodeID`, and serializable `detail`. Control components declaratively by updating their properties. DOM methods, JavaScript callbacks and CSS are not executed. DOM element event references become node IDs; dates become ISO strings. The legacy event callback observes events; `AWCEventScope` can cancel `md-button` actions before their effects.

See [native forms, events and routing](NativeBehavior.md) for `AWCFormState`, form validation and reset, cancellation scopes, URL routing, named-child lookup, and the interactive `AWCButtonBehaviorDemo`.

See [native button focus and accessibility](NativeFocus.md) for roving group focus, `groupTabindex`, supported native roles, cell context, platform validation limits and `AWCButtonAccessibilityDemo`.

`AWCTheme.generated(dark:)` reads generated source color tokens. The renderer follows the system appearance automatically; `.awcTheme(...)` supplies a custom theme. Source icon names map to common SF Symbols. Raw SF Symbol names are also accepted.


Button appearance can be shared across a SwiftUI subtree and overridden on a single generated button without changing its properties:

```swift
VStack {
    AWCButton(children: [.text("Continue")])
    AWCButton(children: [.text("Save")])
        .awcButtonAppearance(.init(labelColor: "#FFFFFF", cornerRadius: 10))
}
.awcButtonAppearance(.init(containerColor: "#123456", iconSize: 24, fontSize: 16))
```

`AWCButtonAppearance` merges fields from outer scopes to inner scopes. Nil and invalid fields preserve inherited values. Color strings must be `#RRGGBB`; alpha, CSS expressions and named colors are rejected. All numeric fields are optional `Double` values, finite and bounded: icon/trailing-icon/loading size 8–128 pt; font size 8–96; integral font weight 100–900; minimum label line height 8–160; letter spacing −5–20; corner radius 0–200; outline width 0–16; inline/block padding 0–128; gap 0–64; hover/focus/pressed state opacity 0–1. Font weight maps to the nearest native hundred-weight; native glyph metrics still apply. Roboto labels use fixed point sizes, so neither default nor explicit button typography automatically scales with Dynamic Type.

The available color fields are `containerColor`, `labelColor`, `iconColor`, `trailingIconColor`, `loadingColor`, `stateLayerColor`, and `outlineColor`. Sizes use `iconSize`, `trailingIconSize`, `loadingSize`, `fontSize`, `lineHeight`; typography also has `fontWeight` and `letterSpacing`. Geometry uses `cornerRadius`, `outlineWidth`, `paddingInline`, `paddingBlock`, `gap`; state layers use `hoverOpacity`, `focusOpacity`, `pressedOpacity`. Trailing icon color/size inherit the leading icon overrides unless separately supplied; icon/loader colors otherwise inherit the label. Plain text slots inherit the part style, while nested custom components can retain their own authored styling. Existing slot content, RTL, interactions and minimum size metrics remain intact.

An explicit radius fixes all four corners through press, selection and connected-group states. Inline padding is the inset from the outer edge including the outline; block padding is per-side content padding, with stroke space reserved. Explicit outline width enables a stroke on any variant. Disabled content retains 0.38 alpha and container/outline retain 0.12 (or the corresponding theme state tokens). State opacity controls affect state layers; ripple alpha and timing keep their source behavior. No appearance values means the original variant/theme defaults.

The Live and Snapshot hosts accept `buttonAppearanceDefaults` and `buttonAppearance` JSON objects using these same fields, global then local. Invalid field values are ignored defensively by the native API; the Studio request boundary validates them strictly. Native appearance is not CSS execution: `visualParts` metadata identifies equivalent drawing regions without advertising support for CSS selectors or custom properties.

The native adapter covers all catalog tags. Full web parity is **not** implied: `NativeSupport.json` is the explicit property/event/method/slot support policy. It lists unsupported web behaviors and platform substitutions, including advanced chart features, DOM focus/form machinery, virtualized lists, draggable surfaces, CSS layout, and imperative methods.

Run source generation from the repository root before building:

```sh
pnpm native:build
swift build --package-path packages/native-ios
```

The button's M3 Expressive typography, square/pressed corners, size-specific
outline widths and density-adjusted insets have a focused contract check runnable
with macOS Command Line Tools: `sh packages/native-ios/scripts/test-native-button.sh`.
The same cases run in XCTest when the full Xcode test SDK is available. Appearance validation and merge cases are included. `sh packages/native-ios/scripts/test-native-views.sh` checks actual native appearance pixels, slot tint, disabled alpha and behavior alongside form/focus regressions. `sh packages/native-ios/scripts/test-native-button-hosts.sh` builds both preview hosts and verifies appearance request propagation plus exact sRGB PNG pixels; these two rendering suites require desktop WindowServer access and create only their own offscreen windows. The iOS runtime needs an iOS SDK/device validation run; the local host checks run on macOS.

See `apps/native-ios-playground` for iPhone/iPad, macOS and offscreen visual render targets. Production rendering never inserts example data; fixtures live separately in `AWCExamples`.
