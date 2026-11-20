import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// r3-24: md-list roving focus over an expandable row in each selection mode against Chrome 153 trusted keys
// (Fixtures/list-roving-web.json, d3-lab/web2/roving.mjs): Tab in and out, ArrowUp/Down, Home/End, activateNext,
// Enter/Space/ArrowRight/ArrowLeft on the expandable row and on its caret, Tab to the caret. Per step: focus, d's expansion
// and every list/item event.
@Observable final class ListRovingState {
    var mode = "single-select"
    var epoch = 0
    var events: [String] = []
    var measurements: [AWCNativeInspectionNode] = []
}
struct ListRovingFixture: View {
    let state: ListRovingState
    let list: AWCListController
    var body: some View {
        let epoch = state.epoch
        let rows: [AWCNode] = [
            AWCNode(id: "a", tag: "md-list-item", properties: ["headline": "Alpha"]),
            AWCNode(id: "d", tag: "md-list-item", properties: ["headline": "Delta", "expandable": true],
                    children: [AWCNode(id: "d0", tag: "md-list-item", properties: ["headline": "Child"], slot: "expanded-content")]),
            AWCNode(id: "c", tag: "md-list-item", properties: ["headline": "Charlie"]),
        ]
        return ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" above the list, "after" below it, as in the DOM.
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("before")])).offset(x: 20, y: 4)
            AWCNativeView(node: .init(id: "list", tag: "md-list", properties: ["selectionMode": .string(state.mode), "label": "L"], children: rows), onEvent: { e in
                let index = e.detail["index"].number.map { ":\(Int($0))" } ?? ""
                state.events.append("\(e.name)@\(e.nodeID)\(index)")
            }).frame(width: 360).awcListController(list, for: "list").offset(x: 20, y: 60)
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("after")])).offset(x: 20, y: 520)
        }
        .awcNativeInspection(rootID: "list|a|d|c|d0", coordinateSpace: "p") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch).frame(width: 500, height: 600, alignment: .topLeading).coordinateSpace(name: "p")
    }
}
@main @MainActor enum NativeListRovingIntegration {
    static let state = ListRovingState()
    static let list = AWCListController()
    static var host: NSHostingView<ListRovingFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.15) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002))
        } while Date() < end
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func expanded() -> AWCValue? { state.measurements.first { $0.id == "d:component" }?.metrics["expanded"] }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) {
        let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                 context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
        window.sendEvent(e)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/list-roving-web.json")
        let oracle = try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let results = oracle["results"] as! [String: [[String: Any]]]
        host = NSHostingView(rootView: ListRovingFixture(state: state, list: list))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 500, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        for mode in ["single-select", "multi-select", "none"] {
            state.mode = mode; state.epoch += 1; pump(0.4); _ = window.makeFirstResponder(nil); pump(0.05)
            for step in results[mode]! {
                let label = step["label"] as! String
                // Leaving the page (Chrome: body) is outside the native window.
                if label == "Tab again" && (step["focus"] as! String) == "body" { continue }
                if label == "Tab from before" { _ = focusView("before")?.requestNativeFocus(); pump(0.05); check(focusedID() == "before", "\(mode): before takes focus (\(focusedID()))") }
                state.events = []
                switch label {
                case "Tab from before", "Tab", "Tab from d", "Tab from a", "Tab again": key(48, "\t")
                case "Shift+Tab", "Shift+Tab back": key(48, "\u{19}", .shift)
                case "ArrowDown": key(125, "\u{F701}")
                case "ArrowUp", "ArrowUp (to d)": key(126, "\u{F700}")
                case "ArrowRight on d": key(124, "\u{F703}")
                case "ArrowLeft on d": key(123, "\u{F702}")
                case "Home", "Home (after d)": key(115, "\u{F729}")
                case "End": key(119, "\u{F72B}")
                case "Enter", "Enter on d": key(36, "\r")
                case "Space on d": key(49, " ")
                case "activateNext": _ = list.activateNext()
                default: check(false, "\(mode): unknown step \(label)")
                }
                pump(0.45)
                // The oracle is Chrome on the fixed source (gate-7 r3-25, r3-26; md-list-source-review.md): one row stop per list, so
                // Tab from a goes on to d's caret, whose focus makes d the active row; the next Tab leaves the list.
                let web = step["focus"] as! String, webFocus = web.hasSuffix(">expand-button") ? web.replacingOccurrences(of: ">expand-button", with: ".expand-button") : web
                check(focusedID() == webFocus, "\(mode)/\(label): focus \(focusedID()) vs Chrome \(web)")
                let webExpanded = (step["expanded"] as! NSNumber).boolValue
                check(expanded() == .bool(webExpanded), "\(mode)/\(label): d expanded \(String(describing: expanded())) vs Chrome \(webExpanded)")
                let webEvents = step["events"] as! [String]
                check(state.events == webEvents, "\(mode)/\(label): events \(state.events) vs Chrome \(webEvents)")
            }
        }
        print(failures.isEmpty ? "PASS NativeListRovingIntegration: \(checks)/\(checks) checks passed" : "List roving: \(checks - failures.count)/\(checks) checks passed")
        exit(failures.isEmpty ? 0 : 1)
    }
}
