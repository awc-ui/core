import SwiftUI

/// The Laboratory recipe of the md-menu family (apps/native-playground/recipes.js): a tonal "Open menu" button
/// (`demo-menu-trigger`) anchors the menu `demo-menu` with a "Workspace" group (New project, Duplicate ⌘D and an
/// Export submenu with SwiftUI and Compose). The previewed node takes its own place in that tree, so its properties
/// and its inspection are the selected component's. The button toggles the menu as the recipe's
/// `data-awc-action="toggle"` does (`open = !open`).
public struct AWCPreviewMenu: View {
    public static let tags: Set<String> = ["md-menu", "md-menu-item", "md-menu-item-group", "md-sub-menu-item"]
    public static let triggerID = "demo-menu-trigger"
    public let node: AWCNode
    public let state: AWCMenuScopeState
    public let onEvent: (AWCEvent) -> Void
    public init(node: AWCNode, state: AWCMenuScopeState, onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.node = node; self.state = state; self.onEvent = onEvent
    }
    /// The id of the top-level menu of the recipe (the previewed md-menu itself, else `demo-menu`).
    public static func menuID(for node: AWCNode) -> String { node.tag == "md-menu" ? node.id : "demo-menu" }
    /// The recipe tree with `node` in place. An md-menu keeps its properties (an empty anchor takes the trigger) and
    /// takes the recipe rows; a group keeps its label and takes the rows; a submenu row keeps its properties and takes
    /// the recipe flyout.
    public static func menu(for node: AWCNode) -> AWCNode {
        func item(_ id: String, _ p: [String: AWCValue]) -> AWCNode { AWCNode(id: id, tag: "md-menu-item", properties: p) }
        let flyout = AWCNode(id: "demo-menu-export-menu", tag: "md-menu", properties: [:],
                             children: [item("demo-menu-swiftui", ["headline": "SwiftUI"]), item("demo-menu-compose", ["headline": "Compose"])], slot: "submenu")
        var first = item("demo-menu-new", ["headline": "New project", "supportingText": "Start something new"])
        var export = AWCNode(id: "demo-menu-export", tag: "md-sub-menu-item", properties: ["headline": "Export"])
        var group = AWCNode(id: "demo-menu-group", tag: "md-menu-item-group", properties: ["label": "Workspace"])
        var menu = AWCNode(id: "demo-menu", tag: "md-menu", properties: ["anchor": .string(triggerID)])
        switch node.tag {
        case "md-menu-item": first = node
        case "md-sub-menu-item": export = node
        case "md-menu-item-group": group = node
        case "md-menu": menu = node; if (menu.properties["anchor"]?.string ?? "").isEmpty { menu.properties["anchor"] = .string(triggerID) }
        default: break
        }
        export.children = export.children.filter { $0.slot != "submenu" && $0.tag != "#text" } + [flyout]
        group.children = [first, item("demo-menu-duplicate", ["headline": "Duplicate", "trailingText": "⌘D"]), export]
        menu.children = menu.children.filter { $0.slot == "header" } + [group]
        return menu
    }
    public var body: some View {
        let menu = Self.menu(for: node), id = menu.id
        AWCMenuScope(state: state) {
            VStack(spacing: 12) {
                AWCNativeView(node: AWCNode(id: Self.triggerID, tag: "md-button", properties: ["variant": "tonal"], children: [.text("Open menu")])) { event in
                    guard event.name == "mdClick" else { return }
                    let handle = state.menu(id)
                    if handle.isOpen { handle.close() } else { handle.show() }
                }
                AWCNativeView(node: menu, onEvent: onEvent)
            }
            .padding(.top, 12)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .frame(minWidth: 320, maxWidth: .infinity, minHeight: 320, alignment: .top)
    }
}
