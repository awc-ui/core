import AppKit
import SwiftUI
@testable import AWCUI

// fi probe: production touch path (no injected AWCNativePointerState) for every native-done interactive component.
@Observable final class Tap2State { var events: [String] = [] }
struct Tap2Row: View {
    let node: AWCNode, state: Tap2State
    var body: some View {
        AWCNativeView(node: node) { state.events.append("\($0.nodeID):\($0.name)") }
            .frame(width: 360, height: 64, alignment: .leading)
    }
}
let tap2Nodes: [AWCNode] = [
    .init(id: "button", tag: "md-button", children: [.text("Button")]),
    .init(id: "icon", tag: "md-icon-button", properties: ["icon": "favorite"]),
    .init(id: "fab", tag: "md-fab", properties: ["icon": "add"]),
    .init(id: "split", tag: "md-split-button", properties: ["label": "Create project", "icon": "add"]),
    .init(id: "chip", tag: "md-chip", properties: ["label": "Chip"]),
    .init(id: "card", tag: "md-card", properties: ["interactive": true, "variant": "outlined"], children: [.text("Card")]),
    .init(id: "checkbox", tag: "md-checkbox"),
    .init(id: "radio", tag: "md-radio", properties: ["name": "g", "value": "a"]),
    .init(id: "switch", tag: "md-switch"),
    .init(id: "accordion", tag: "md-accordion", children: [.init(id: "first", tag: "md-accordion-item", properties: ["headline": "Account settings"], children: [.text("Body")])]),
]
struct Tap2View: View {
    let state: Tap2State
    var body: some View {
        VStack(alignment: .leading, spacing: 6) { ForEach(tap2Nodes, id: \.id) { Tap2Row(node: $0, state: state) } }
            .padding(20).frame(width: 402, height: 800, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSTapProbe {
    static let state = Tap2State()
    static var host: NSHostingView<Tap2View>!, window: NSWindow!
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { host.layoutSubtreeIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func tap(_ p: CGPoint) {
        for kind in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
            NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: p, modifierFlags: [], timestamp: 0, windowNumber: 1, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseDown ? 1 : 0)!); pump(0.08)
        }
        pump(0.4)
    }
    static func main() {
        host = NSHostingView(rootView: Tap2View(state: state))
        window = NSWindow(contentRect: .init(x: 0, y: 0, width: 402, height: 800), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.6)
        var ok = 0
        for (i, node) in tap2Nodes.enumerated() {
            let y = 20 + Double(i) * 70 + 32, x: Double = node.tag == "md-split-button" ? 60 : 40
            let before = state.events.count; tap(CGPoint(x: x, y: y))
            let got = Array(state.events.dropFirst(before)); if !got.isEmpty { ok += 1 }
            print("TAP2 \(node.tag) at (\(x),\(y)): \(got)")
        }
        print("Tap probe: \(ok)/\(tap2Nodes.count) checks passed")
    }
}
