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

See the [button parity audit](NativeButtonParity.md) [icon-button audit](audits/md-icon-button.md), and [button-group audit](audits/md-button-group.md), and [FAB audit](audits/md-fab.md) for source API matrices, native equivalents and validation boundaries.

See [native button focus and accessibility](NativeFocus.md) for roving group focus, `groupTabindex`, supported native roles, cell context, platform validation limits and `AWCButtonAccessibilityDemo`.

`AWCTheme.generated(dark:)` reads generated source color tokens. The renderer follows the system appearance automatically; `.awcTheme(...)` supplies a custom theme. `md-button`, `md-icon-button` and `md-fab` use the bundled source Material Symbols font. Other adapters currently map common icon names to SF Symbols; their individual support entries describe that boundary.


Button appearance can be shared across a SwiftUI subtree and overridden on a single generated button without changing its properties:

```swift
VStack {
    AWCButton(children: [.text("Continue")])
    AWCButton(children: [.text("Save")])
        .awcButtonAppearance(.init(labelColor: "#FFFFFF", cornerRadius: 10))
}
.awcButtonAppearance(.init(containerColor: "#123456", iconSize: 24, fontSize: 16))
```

`AWCButtonAppearance` merges fields from outer scopes to inner scopes. Nil and invalid fields preserve inherited values. Color strings must be `#RRGGBB`; alpha, CSS expressions and named colors are rejected. All numeric fields are optional `Double` values, finite and bounded: icon/trailing-icon/loading size 8–128 pt; font size 8–96; integral font weight 100–900; label line height 8–160; letter spacing −5–20; corner radius 0–200; outline width 0–16; inline/block padding 0–128; gap 0–64; hover/focus/pressed state opacity 0–1; width/minWidth/maxWidth/height/minHeight 0–2400 pt. Font weight maps to the nearest native hundred-weight; native glyph metrics still apply. Roboto labels use fixed point sizes, so neither default nor explicit button typography automatically scales with Dynamic Type.

The available color fields are `containerColor`, `labelColor`, `iconColor`, `trailingIconColor`, `loadingColor`, `stateLayerColor`, `outlineColor`, and `focusRingColor`. Sizes use `iconSize`, `trailingIconSize`, `loadingSize`, `fontSize`, `lineHeight`; typography also has `fontWeight` and `letterSpacing`. Geometry uses `cornerRadius`, `outlineWidth`, `paddingInline`, `paddingBlock`, `gap`, `width`, `minWidth`, `maxWidth`, `height`, and `minHeight`; state layers use `hoverOpacity`, `focusOpacity`, `pressedOpacity`. Trailing icon color/size inherit the leading icon overrides unless separately supplied; icon/loader colors otherwise inherit the label. Plain text slots inherit the part style, while nested custom components can retain their own authored styling. Existing slot content, RTL and interactions remain intact. Explicit dimensions use border-box sizing; minimums win conflicting maximums, an explicit width wins fullWidth, and overflowing nowrap content stays centered and clipped.

An explicit radius fixes all four corners through ordinary press and selection states. Connected corner flags take precedence, matching the source cascade. Inline padding is the inset from the outer edge including the outline; block padding is per-side content padding, with stroke space reserved. Explicit outline width enables a stroke on any variant. Disabled content retains 0.38 alpha and container/outline retain 0.12 (or the corresponding theme state tokens). State opacity controls affect state layers; ripple alpha and timing keep their source behavior. No appearance values means the original variant/theme defaults.

Named button icon slots can use `.symbol("favorite", slot: "leading-icon")` or `AWCMaterialSymbol("favorite")` in a custom SwiftUI renderer. Material Symbols inherit the part's size/color and remain decorative for accessibility. An explicit empty text child overrides the fallback icon. Supply `AWCNode(tag: "md-progress-indicator", properties: ["variant": "circular", "indeterminate": true, "size": 24], slot: "loader")` for a real progress loader with its own 24pt size. Both preview hosts also accept these named slot descriptors: `{ "kind": "symbol", "value": "favorite" }` and, for loader only, `{ "kind": "progress" }`.

The Live and Snapshot hosts accept `buttonAppearanceDefaults` and `buttonAppearance` JSON objects using these same fields, global then local. Invalid field values are ignored defensively by the native API; the Studio request boundary validates them strictly. Native appearance is not CSS execution: `visualParts` metadata identifies equivalent drawing regions without advertising support for CSS selectors or custom properties.

Icon buttons expose their own nine source hooks through `AWCIconButtonAppearance` and `.awcIconButtonAppearance`: `containerColor`, `iconColor`, `stateLayerColor`, `iconSize`, `cornerRadius`, `outlineColor`, `outlineWidth`, `width`, `height`. Colors and fieldwise inheritance follow the button API; geometry accepts 0–2400 pt and outline width 0–16 pt. The outline applies only to the outlined variant. The Live/Snapshot JSON fields are `iconButtonAppearanceDefaults` and `iconButtonAppearance`.

Use `.symbol("favorite")` and `.symbol("check", slot: "selected")` for custom icon-button layers. Use `.slotText("", slot: "selected")` to author an explicitly empty element that suppresses fallback. Raw `.text(" ")` remains incidental whitespace and preserves fallback, matching Web slots. `aria-label` on an `AWCNativeView` node supplies its accessible name. Icon-button navigation and selection happen **before** `mdClick({selected})`; cancellation is observable but cannot veto those committed actions. There is no `mdChange` or source imperative method.

Tooling can opt into `.awcNativeInspection(rootID:coordinateSpace:onChange:)` on a view subtree. Pass the selected `AWCNode.id` and the host's named coordinate space. The callback receives measured `AWCNativeInspectionNode` bounds in points, stable part IDs, parent IDs and renderer-supplied metrics. The button supplies its surface, content, label and present icon/loader parts, including applied padding, gap and resolved typography. Uncertain styles on arbitrary nested content are omitted. The modifier adds no geometry readers outside an inspection scope; the rendering suite verifies that opting in preserves pixels and layout.

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

Button groups use `AWCButtonGroupAppearance(gap:width:minWidth:maxWidth:height:minHeight:maxHeight:)` through `.awcButtonGroupAppearance(...)`. All seven optional values accept finite 0–2400 pt and inherit fieldwise. Compose real `md-button`/`md-icon-button` nodes in the default children array; selected child identity remains separate from its string value. The live host accepts/returns `buttonGroupSelection` booleans in authored descendant order. The raw parent reconciliation intentionally still runs after canceled or soft-disabled/loading child pointer actions, as in the Web source; see the group audit for event ordering.

FABs use `AWCFabAppearance(containerColor:iconColor:iconSize:cornerRadius:labelColor:)` and `.awcFabAppearance(...)`. Compose custom icons using `.symbol("favorite", slot: "icon")` or `.slotText("X", slot: "icon")`; an explicit empty slot remains meaningful. Attach a retained `AWCFabController` through `.awcFabController(controller)` and call `await controller.setMenuIcon("close")` for a temporary presentation icon, or nil/empty to restore the current authored icon/slot. This method remains available while disabled. `mdClick` carries null detail and truthful native `event.activation` metadata, without fabricating a DOM MouseEvent.

FAB Menus use a separate authored anchor inside `AWCFabMenuScope`. Retain one `AWCFabMenuController` and attach it only to the menu:

```swift
@State private var menu = AWCFabMenuController()

var body: some View {
    AWCFabMenuScope {
        AWCNativeView(node: AWCNode(id: "create-anchor", tag: "md-fab",
            properties: ["icon": "add", "label": "Create"]))
        AWCNativeView(node: AWCNode(id: "actions", tag: "md-fab-menu",
            properties: ["anchor": "create-anchor", "placement": "down"],
            children: [
                AWCNode(id: "new-document", tag: "md-fab-menu-item",
                    properties: ["icon": "edit", "label": "New document"])
            ]))
            .awcFabMenuController(menu)
    }.frame(width: 360, height: 480)
}
```

`await menu.show()` waits for initial native rendering and commits opening. `await menu.close()` begins closing; `await menu.whenClosed()` waits for the active cycle to finish, including closing and the actual closed render. The menu does not block unrelated native input. Use `.awcFabMenuAppearance(...)` for its three cascading styles, and `.awcFabMenuItemAppearance(..., nodeID: "new-document")` to override only one authored item's five styles. Omit `nodeID` for inherited item defaults. See the [ongoing menu parity audit](audits/md-fab-menu.md) for verification status and platform limits.
