import SwiftUI

/// Real native focus/AX surfaces; this demo never opens links or external apps.
public struct AWCButtonAccessibilityDemo: View {
    public var properties: [String: AWCValue]
    public var onEvent: (AWCEvent) -> Void
    @State private var focused = "None · press Tab"
    @State private var rightToLeft = false
    @State private var actions = 0
    @State private var lastAction = "No activation"
    public init(properties: [String: AWCValue] = [:], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.properties = properties; self.onEvent = onEvent
    }
    private func button(_ id: String, _ title: String, _ values: [String: AWCValue] = [:]) -> AWCNode {
        var props = properties
        props.merge(["size": "xs", "type": "button", "href": "", "loading": false, "disabled": false, "softDisabled": false,
                     "selected": false, "toggle": false, "groupTabindex": .null, "roleOverride": ""]) { _, value in value }
        props.merge(values) { _, value in value }
        return .init(id: id, tag: "md-button", properties: props, children: [.text(title)])
    }
    private func observed(_ event: AWCEvent) {
        if event.name == "mdClick" { actions += 1; lastAction = event.nodeID }
        onEvent(event)
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Native focus & accessibility").font(.headline)
            Text("Tab: before → one group entry → after. Left/Right wrap; Home/End move within the group. Enter/Space activate.")
                .font(.caption).fixedSize(horizontal: false, vertical: true)
            AWCNativeView(node: button("focus-before", "Before"), onEvent: observed)
            AWCNativeView(node: .init(id: "focus-group", tag: "md-button-group", properties: ["dir": .string(rightToLeft ? "rtl" : "ltr")], children: [
                button("focus-a", "A"), button("focus-disabled", "D", ["disabled": true]),
                button("focus-soft", "S", ["softDisabled": true]), button("focus-loading", "L", ["loading": true]),
                button("focus-last", "Z", ["selected": true])
            ]), onEvent: observed)
            Text("D: disabled, skipped · S: soft-disabled · L: loading\nS and L keep focus; activation stays blocked.").font(.caption2).foregroundStyle(.secondary)
            AWCNativeView(node: button("focus-after", "After"), onEvent: observed)
            Toggle("Right-to-left arrow direction", isOn: $rightToLeft).font(.caption)
            Divider()
            HStack(spacing: 10) {
                AWCNativeView(node: button("focus-cell", "12", ["groupTabindex": -1, "roleOverride": "gridcell", "selected": true]), onEvent: observed)
                    .environment(\.awcGridCellContext, AWCGridCellContext(row: 1, column: 2))
                Text("Selected native cell · row 2, column 3\nSkipped by Tab; still accessible and clickable.").font(.caption2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("Focus: \(focused)").font(.caption).monospaced()
            Text("Activations: \(actions) · \(lastAction)").font(.caption)
            Text("Native roles: group buttons; selected calendar cell. Focus movement does not select or activate.")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .environment(\.awcNativeFocusChanged, { id, active in
            if active {
                focused = id
                onEvent(.init(name: "nativeFocus", tag: "native-focus", nodeID: id, detail: ["focused": true]))
            }
        })
    }
}
