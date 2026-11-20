import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// Native replay of the eighteen md-card lifecycle scenarios (web-lifecycle.json, lifecycle.html)
// through the production AWCNativeView dispatch with real AppKit mouse/keyboard events. DOM-only
// mechanisms are replaced by their native equivalents: authored node trees (attribute and shadow-
// root observation), authored SwiftUI content marked as interactive, outer authored modifiers
// (inline style restoration) and view removal (disconnect). macOS has one pointer and no pointer
// cancellation for a mouse, so pointer ownership/pointercancel/lostpointercapture are replayed on
// Android (NativeCardLifecycleTest); here the single-pointer gesture is recorded as such.
@Observable final class CardLifecycleFixtureState {
    var node = AWCNode(id: "card", tag: "md-card")
    var shown = true
    var authoredScale = false
    var textField = false
    var text = ""
    var epoch = 0
    var events: [AWCEvent] = []
    var onEvent: ((AWCEvent) -> Void)?
    var measurements: [AWCNativeInspectionNode] = []
}
struct CardLifecycleFixture: View {
    @Bindable var state: CardLifecycleFixtureState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        VStack(alignment: .leading, spacing: 0) {
            if state.shown {
                if state.textField {
                    AWCNativeCard(node: state.node, theme: theme, interactiveContent: true, label: "Content", emit: { name, detail in
                        let event = AWCEvent(name: name, tag: "md-card", nodeID: "card", detail: detail); state.events.append(event); state.onEvent?(event) }) {
                        TextField("Field", text: $state.text).frame(width: 200).modifier(AWCCardInteractiveRegion(active: true))
                    }.frame(width: 320, alignment: .topLeading)
                } else {
                    AWCNativeView(node: state.node, onEvent: { event in state.events.append(event); state.onEvent?(event) })
                        .frame(width: 320, alignment: .topLeading)
                        .scaleEffect(state.authoredScale ? 0.9 : 1, anchor: .topLeading).zIndex(state.authoredScale ? 7 : 0)
                }
            }
            Color.clear.frame(height: 400)
        }
        .awcTheme(theme)
        .awcNativeInspection(rootID: "card", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch).padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeCardLifecycleIntegration {
    static let state = CardLifecycleFixtureState()
    static var host: NSHostingView<CardLifecycleFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.12) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e); pump(0.03) }
    static func key(_ text: String, _ code: UInt16) { for type in [NSEvent.EventType.keyDown, .keyUp] { let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }; pump(0.05) }
    static var card: AWCNativeInspectionNode? { state.measurements.first { $0.name == "md-card" } }
    static func metric(_ name: String) -> AWCValue? { card?.metrics[name] }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func make(_ children: [AWCNode] = [.text("Content")], scale: Bool = false, field: Bool = false) {
        state.node = .init(id: "card", tag: "md-card", properties: ["interactive": true, "dragEnabled": true], children: children)
        state.authoredScale = scale; state.textField = field; state.text = ""; state.shown = true; state.onEvent = nil
        state.events = []; state.epoch += 1; pump(0.3)
    }
    // Card events only: authored md-button content reports its own mdClick through the same dispatch.
    static func names() -> [String] { state.events.filter { $0.nodeID == "card" }.map(\.name).filter { $0.hasPrefix("md") && $0 != "mdFocus" && $0 != "mdBlur" } }
    static func set(_ key: String, _ value: AWCValue) { var n = state.node; n.properties[key] = value; state.node = n }
    static func origin() -> CGPoint { let b = card?.bounds ?? .zero; return .init(x: b.minX + 10, y: b.minY + 10) }
    static func record(_ scenario: String, _ extra: [String: Any] = [:]) {
        var r: [String: Any] = ["scenario": scenario, "events": names(), "role": metric("role")?.string ?? "nil", "dragging": metric("dragging")?.bool ?? false, "offsetX": metric("offsetX")?.number.map { $0 as Any } ?? NSNull()]
        for (k, v) in extra { r[k] = v }; report.append(r)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: CardLifecycleFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let web = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/card-web-lifecycle.json")))
        let by = Dictionary(uniqueKeysWithValues: web["scenarios"].array.map { ($0["scenario"].string, $0) })
        check(by.count == 18, "eighteen source scenarios")
        // web-lifecycle.json uses synthetic pointer events, which never produce click events. The
        // trusted-input capture (CDP mouse; laboratory/trusted-lifecycle) adds the clicks Chrome
        // dispatches for physical input: the expectation for macOS's mouse pointer.
        let trustedDoc = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/card-web-lifecycle-trusted.json")))
        let mouseRuns = Dictionary(uniqueKeysWithValues: trustedDoc["modes"]["mouse"].array.map { ($0["scenario"].string, $0) })
        func trusted(_ name: String) -> [String] { mouseRuns[name]!["events"].array.map { $0["type"].string } }
        check(trusted("authored-keyboard").isEmpty && trusted("reentrant-disabled") == ["mdDragStart"] && trusted("reentrant-disconnect") == ["mdDragStart"], "trusted capture agrees with the synthetic oracle where no click is involved")

        // authored-keyboard: keys typed into authored content are neither consumed nor turned into card events.
        make(field: true)
        if let field = all(host).compactMap({ $0 as? NSTextField }).first { _ = window.makeFirstResponder(field); pump(0.05) }
        key(" ", 49); key("a", 0)
        // The typed text reaches the SwiftUI binding asynchronously on iOS (3-1-013: " a" is present about 0.3 s after the second key,
        // 0.05 s is too early); wait for it, up to 1 s. The expected text is unchanged.
        for _ in 0..<20 where state.text.count < 2 { pump(0.05) }
        check(names().isEmpty && by["authored-keyboard"]!["events"].array.isEmpty, "authored-keyboard: no card events (\(names()))")
        check(state.text == " a", "authored-keyboard: the authored field receives the keys unprevented (\(state.text.debugDescription))")
        record("authored-keyboard", ["text": state.text])

        // authored-pointer: a press on authored md-button content never starts a drag.
        make([.init(id: "save", tag: "md-button", children: [.text("Save")])])
        if let button = all(host).first(where: { $0 is AWCNativeButtonFocusView }) {
            let r = host.convert(button.bounds, from: button), p = CGPoint(x: r.midX, y: host.isFlipped ? r.midY : host.bounds.height - r.midY)
            mouse(.leftMouseDown, p); mouse(.leftMouseDragged, .init(x: p.x + 30, y: p.y)); mouse(.leftMouseUp, .init(x: p.x + 30, y: p.y))
        } else { check(false, "authored-pointer: md-button view") }
        check(!names().contains("mdDragStart") && metric("dragging")?.bool == false, "authored-pointer: no drag from authored content (\(names()))")
        check(names() == trusted("authored-pointer"), "authored-pointer: trusted mouse events \(names()) vs \(trusted("authored-pointer"))")
        record("authored-pointer")

        // pointer-ownership: one mouse pointer; the gesture follows that pointer only.
        make(); var p = origin()
        mouse(.leftMouseDown, p); mouse(.leftMouseDragged, .init(x: p.x + 20, y: p.y)); pump(0.05)
        check(names() == ["mdDragStart", "mdDragMove"] && abs((metric("offsetX")?.number ?? 0) - 20) < 0.6, "pointer-ownership: the owning pointer drags (\(names()))")
        mouse(.leftMouseUp, .init(x: p.x + 20, y: p.y))
        record("pointer-ownership", ["note": "macOS has a single mouse pointer; multi-pointer ownership is replayed on Android"])

        // toggle-disabled / toggle-softDisabled / toggle-dragEnabled during a drag: silent cancellation.
        for (property, value) in [("disabled", true), ("softDisabled", true), ("dragEnabled", false)] {
            make(); p = origin()
            mouse(.leftMouseDown, p); mouse(.leftMouseDragged, .init(x: p.x + 30, y: p.y))
            set(property, .bool(value)); pump(0.1)
            mouse(.leftMouseDragged, .init(x: p.x + 80, y: p.y)); mouse(.leftMouseUp, .init(x: p.x + 80, y: p.y)); pump(0.1)
            let synthetic = by["toggle-\(property)"]!["events"].array.map { $0["type"].string }
            let expected = trusted("toggle-\(property)")
            check(expected.filter { $0 != "mdClick" } == synthetic, "toggle-\(property): trusted and synthetic drag events agree")
            check(names() == expected, "toggle-\(property): events \(names()) vs \(expected)")
            check(metric("dragging")?.bool == false && metric("offsetX")?.number == 0, "toggle-\(property): drag cleared without translation")
            record("toggle-\(property)")
        }

        // authored-style-restoration: authored outer modifiers (scale, stacking) survive a drag.
        make(scale: true); let before = card?.bounds ?? .zero; p = origin()
        mouse(.leftMouseDown, p); mouse(.leftMouseDragged, .init(x: p.x + 30, y: p.y)); mouse(.leftMouseUp, .init(x: p.x + 30, y: p.y)); pump(0.15)
        let after = card?.bounds ?? .zero
        check(names() == ["mdDragStart", "mdDragMove", "mdDragEnd"] && abs(after.width - before.width) < 0.6 && abs(after.minX - before.minX) < 0.6 && abs(before.width - 0.9 * 320) < 0.6, "authored-style-restoration: authored scale kept (\(before) → \(after))")
        record("authored-style-restoration", ["width": after.width])

        // generic-focusable: authored content with tabindex 0 keeps the card a container.
        make([.init(id: "custom", tag: "md-avatar", properties: ["name": "Custom control", "tabindex": 0])])
        check(metric("role")?.string == "" && by["generic-focusable"]!["role"] == .null, "generic-focusable: container role")
        record("generic-focusable")

        // dynamic-attributes: authored content semantics are re-evaluated on change (source attribute observation).
        make([.init(id: "custom", tag: "md-avatar", properties: ["name": "Save"])])
        let initial = metric("role")?.string
        state.node.children = [.init(id: "custom", tag: "md-avatar", properties: ["name": "Save", "role": "button"])]; pump(0.15)
        let enabled = metric("role")?.string
        state.node.children = [.init(id: "custom", tag: "md-avatar", properties: ["name": "Save"])]; pump(0.15)
        check(initial == "button" && enabled == "" && metric("role")?.string == "button", "dynamic-attributes: button → container → button (\(String(describing: initial)), \(String(describing: enabled)), \(String(describing: metric("role")?.string)))")
        record("dynamic-attributes")

        // reconnect-observation: removed and re-added, then authored content gains a control.
        make([.text("Content")]); state.shown = false; pump(0.1); state.shown = true; pump(0.15)
        state.node.children = [.init(id: "new", tag: "md-button", children: [.text("New action")])]; pump(0.15)
        check(metric("role")?.string == "", "reconnect-observation: container after reconnect")
        record("reconnect-observation")

        // reentrant-*: a start handler disables, turns off dragging or removes the card.
        for mutation in ["disabled", "dragEnabled", "disconnect"] {
            make(); p = origin()
            state.onEvent = { event in
                guard event.name == "mdDragStart" else { return }
                if mutation == "disconnect" { state.shown = false } else { set(mutation, .bool(mutation == "disabled")) }
            }
            mouse(.leftMouseDown, p); mouse(.leftMouseDragged, .init(x: p.x + 30, y: p.y)); pump(0.1)
            mouse(.leftMouseDragged, .init(x: p.x + 50, y: p.y)); mouse(.leftMouseUp, .init(x: p.x + 50, y: p.y)); pump(0.1)
            let synthetic = by["reentrant-\(mutation)"]!["events"].array.map { $0["type"].string }
            let expected = trusted("reentrant-\(mutation)")
            check(expected.filter { $0 != "mdClick" } == synthetic, "reentrant-\(mutation): trusted and synthetic drag events agree")
            check(names() == expected, "reentrant-\(mutation): events \(names()) vs \(expected)")
            if mutation == "disconnect" { check(card == nil, "reentrant-disconnect: removed") }
            else { check(metric("dragging")?.bool == false && metric("offsetX")?.number == 0, "reentrant-\(mutation): no translation") }
            record("reentrant-\(mutation)")
        }

        // shadow-*: nested authored content (a card inside the card) is traversed; its state is observed and released.
        let nested = { (hidden: Bool) in AWCNode(id: "wrapper", tag: "md-card", children: [.init(id: "inner", tag: "md-button", properties: ["hidden": .bool(hidden)], children: [.text("Shadow action")])]) }
        make([nested(false)])
        check(metric("role")?.string == "", "shadow-control: nested control → container")
        state.node.children = [nested(true)]; pump(0.15); let hiddenRole = metric("role")?.string
        state.node.children = [nested(false)]; pump(0.15)
        check(hiddenRole == "button" && metric("role")?.string == "", "shadow-attribute-observation: button while unavailable, container again (\(String(describing: hiddenRole)))")
        state.node.children = []; pump(0.15)
        check(metric("role")?.string == "button", "shadow-detach: no stale observation after removal")
        record("shadow-control"); record("shadow-attribute-observation"); record("shadow-detach")

        if let output = ProcessInfo.processInfo.environment["AWC_CARD_LIFECYCLE_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Card native lifecycle: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
