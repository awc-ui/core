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

The native adapter covers all catalog tags. Full web parity is **not** implied: `NativeSupport.json` is the explicit property/event/method/slot support policy. It lists unsupported web behaviors and platform substitutions, including advanced chart features, DOM focus/form machinery, virtualized lists, draggable surfaces, CSS layout, and imperative methods.

Run source generation from the repository root before building:

```sh
pnpm native:build
swift build --package-path packages/native-ios
```

See `apps/native-ios-playground` for iPhone/iPad, macOS and offscreen visual render targets. Production rendering never inserts example data; fixtures live separately in `AWCExamples`.
