import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-list / md-list-item public methods through the native controllers: activateNext/Previous
// (roving focus, wrap, mdActivate on change only), selectItem (silent, single/multi),
// getSelectedIndices, item setFocus(focusVisible:)/focusItem, toggle/expand/collapse (no mdExpand,
// disabled no-op), plus Alt+Arrow keyboard reorder (mdReorder order relative to the authored order).
@Observable final class ListMethodsState {
    var mode = "single-select"
    var reorderable = false
    var epoch = 0
    var events: [(String, AWCValue, String)] = []
    var measurements: [AWCNativeInspectionNode] = []
}
struct ListMethodsFixture: View {
    let state: ListMethodsState
    let list: AWCListController, items: [String: AWCListItemController]
    var body: some View {
        let epoch = state.epoch
        var props: [String: AWCValue] = ["selectionMode": .string(state.mode), "label": "Methods"]
        if state.reorderable { props["reorderable"] = true }
        let rows: [AWCNode] = [
            AWCNode(id: "a", tag: "md-list-item", properties: ["headline": "Alpha"]),
            AWCNode(id: "b", tag: "md-list-item", properties: ["headline": "Bravo", "disabled": true]),
            AWCNode(id: "c", tag: "md-list-item", properties: ["headline": "Charlie", "selected": true]),
            AWCNode(id: "d", tag: "md-list-item", properties: ["headline": "Delta", "expandable": true], children: [AWCNode(id: "d0", tag: "md-list-item", properties: ["headline": "Child"], slot: "expanded-content")]),
            AWCNode(id: "e", tag: "md-list-item", properties: ["headline": "Echo", "expandable": true, "disabled": true]),
        ]
        var v = AnyView(AWCNativeView(node: .init(id: "list", tag: "md-list", properties: props, children: rows), onEvent: { e in state.events.append((e.name, e.detail, e.nodeID)) })
            .frame(width: 360).awcListController(list, for: "list"))
        for (id, c) in items { v = AnyView(v.awcListItemController(c, for: id)) }
        return v.awcNativeInspection(rootID: "list|a|b|c|d|e|d0", coordinateSpace: "p") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch).padding(20).frame(width: 500, height: 600, alignment: .topLeading).coordinateSpace(name: "p")
    }
}
@main @MainActor enum NativeListMethodsIntegration {
    static let state = ListMethodsState()
    static let list = AWCListController()
    static let items = Dictionary(uniqueKeysWithValues: ["a", "b", "c", "d", "e"].map { ($0, AWCListItemController()) })
    static var host: NSHostingView<ListMethodsFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.15) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func metric(_ id: String, _ k: String) -> AWCValue? { state.measurements.first { $0.id == id + ":component" }?.metrics[k] }
    static func reset(_ mode: String, reorderable: Bool = false) { state.mode = mode; state.reorderable = reorderable; state.epoch += 1; pump(0.4); _ = window.makeFirstResponder(nil); state.events = []; pump(0.05) }
    static func names() -> [String] { state.events.map { "\($0.0)@\($0.2)" } }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ListMethodsFixture(state: state, list: list, items: items)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 500, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        // activateNext / activatePrevious: roving starts at the selected row (c); disabled b is skipped; wraps.
        reset("single-select")
        check(list.isConnected && items["a"]!.isConnected, "controllers connect")
        check(list.getSelectedIndices() == [2], "getSelectedIndices seeds from selected rows: \(list.getSelectedIndices())")
        check(list.activateNext() == "a", "activateNext from c wraps past expandable rows to a"); pump()
        check(focusedID() == "a" && metric("a", "focusRing") == .bool(true), "activateNext focuses with a visible ring (\(focusedID()))")
        check(names() == ["mdActivate@list"] && state.events.first?.1["index"].number == 0, "mdActivate {index 0} \(names())")
        check(list.activatePrevious() == "c", "activatePrevious wraps to c"); pump()
        check(focusedID() == "c", "focus on c"); check(names() == ["mdActivate@list", "mdActivate@list"], "second mdActivate \(names())")
        // selectItem: silent.
        state.events = []; list.selectItem(0); pump()
        check(list.getSelectedIndices() == [0] && state.events.isEmpty, "selectItem(0) single-select is silent: \(list.getSelectedIndices()) \(names())")
        check(metric("a", "selected") == .bool(true) && metric("c", "selected") == .bool(false), "selection repaints")
        list.selectItem(3); pump(); check(list.getSelectedIndices() == [0], "selectItem on an expandable row is a no-op")
        reset("multi-select"); list.selectItem(0); pump()
        check(list.getSelectedIndices() == [0, 2] && state.events.isEmpty, "multi selectItem toggles on silently: \(list.getSelectedIndices())")
        list.selectItem(2); pump(); check(list.getSelectedIndices() == [0], "multi selectItem toggles off")
        reset("none"); list.selectItem(0); pump(); check(list.getSelectedIndices() == [2], "selectItem is a no-op in none mode")
        // Item methods.
        reset("none")
        check(!items["d"]!.setFocus(focusVisible: true), "an expandable-only text row in none mode cannot take focus (\(focusedID()))")
        items["d"]!.toggle(); pump(0.6)
        check(metric("d", "expanded") == .bool(true) && state.events.allSatisfy { $0.0 != "mdExpand" }, "toggle expands without mdExpand \(names())")
        items["d"]!.collapse(); pump(0.4); check(metric("d", "expanded") == .bool(false), "collapse")
        items["d"]!.expand(); pump(0.6); check(metric("d", "expanded") == .bool(true), "expand")
        items["d"]!.expand(); pump(0.2); check(metric("d", "expanded") == .bool(true), "expand is idempotent")
        items["e"]!.toggle(); pump(0.3); check(metric("e", "expanded") == .bool(false), "toggle on a disabled row is a no-op")
        items["a"]!.toggle(); pump(0.2); check(metric("a", "expanded") == .bool(false), "toggle on a non-expandable row is a no-op")
        reset("single-select"); state.events = []
        check(items["a"]!.focusItem(), "focusItem"); pump(); check(focusedID() == "a" && names() == ["mdActivate@list"], "focusItem focuses a and activates \(focusedID()) \(names())")
        check(!items["b"]!.setFocus(focusVisible: true), "a disabled row cannot take focus")
        // Keyboard reorder: Alt+ArrowDown/Up, ignored at the edges; order is relative to the authored order.
        reset("none", reorderable: true)
        _ = items["a"]!.setFocus(focusVisible: true); pump(); state.events = []
        func altKey(_ code: UInt16, _ ch: String) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [.option], timestamp: 0, windowNumber: window.windowNumber, context: nil, characters: ch, charactersIgnoringModifiers: ch, isARepeat: false, keyCode: code)!; window.sendEvent(e); pump() }
        altKey(126, "\u{F700}"); check(state.events.isEmpty, "Alt+ArrowUp at the top is ignored \(names())")
        altKey(125, "\u{F701}")
        check(names() == ["mdReorder@list"] && state.events.first?.1["order"] == .array([1, 0, 2, 3, 4].map { .number(Double($0)) }) && state.events.first?.1["from"].number == 0 && state.events.first?.1["to"].number == 1,
              "Alt+ArrowDown moves a below b: \(state.events.first?.1 ?? .null)")
        check(focusedID() == "a", "focus stays on the moved row (\(focusedID()))")
        let ya = state.measurements.first { $0.id == "a:component" }?.bounds.minY ?? 0, yb = state.measurements.first { $0.id == "b:component" }?.bounds.minY ?? 0
        check(ya > yb, "a renders after b (\(ya) > \(yb))")
        print("List native methods: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
