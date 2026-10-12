import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class FocusFixtureState {
    var rtl = false
    var selectionMode = "single-select"
    var disableLast = false
    var events: [AWCEvent] = []
}
struct FocusFixture: View {
    let state: FocusFixtureState
    func node(_ id: String, _ values: [String: AWCValue] = [:]) -> AWCNode {
        .init(id: id, tag: "md-button", properties: ["size": "xs"].merging(values) { _, new in new }, children: [.text(id)])
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AWCNativeView(node: node("before"), onEvent: { state.events.append($0) })
            AWCNativeView(node: .init(id: "group", tag: "md-button-group", properties: ["dir": .string(state.rtl ? "rtl" : "ltr"), "selectionMode": .string(state.selectionMode)], children: [
                .init(id: "a", tag: "md-icon-button", properties: ["icon": "add", "size": "xs"]), node("disabled", ["disabled": true]), node("soft", ["softDisabled": true]),
                node("loading", ["loading": true]), node("z", ["selected": true, "disabled": .bool(state.disableLast)])
            ]), onEvent: { state.events.append($0) })
            AWCNativeView(node: node("after"), onEvent: { state.events.append($0) })
            AWCNativeView(node: node("cell", ["roleOverride": "gridcell", "selected": true, "groupTabindex": -1]), onEvent: { state.events.append($0) })
                .environment(\.awcGridCellContext, .init(row: 1, column: 2))
            AWCNativeView(node: node("unknown", ["roleOverride": "custom-role"]), onEvent: { state.events.append($0) })
        }.padding(20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
@main @MainActor enum NativeFocusViewIntegration {
    static var count = 0
    static func check(_ value: Bool, _ text: String) { count += 1; guard value else { fatalError(text) } }
    static func pump(_ duration: TimeInterval = 0.15) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005))
        }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    static func main() {
        setbuf(stdout, nil)
        let app = NSApplication.shared; app.setActivationPolicy(.accessory)
        let state = FocusFixtureState()
        let host = NSHostingView(rootView: FocusFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 900, height: 450), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); host.layoutSubtreeIfNeeded(); pump(0.5)
        let surfaces = descendants(host).filter { String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") }
        func view(_ id: String) -> NSView { guard let result = surfaces.first(where: { $0.accessibilityIdentifier() == id }) else { fatalError("Missing native button surface \(id)") }; return result }
        func focused() -> String { (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? "none" }
        func key(_ code: UInt16, _ characters: String, flags: NSEvent.ModifierFlags = []) {
            let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber, context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: code)!
            window.sendEvent(event); pump()
        }
        // Offscreen NSHostingView.accessibilityChildren() is empty on this host
        // even for standard SwiftUI sentinels. These checks exercise the actual
        // native AX surfaces; they do not certify VoiceOver tree traversal.
        check(surfaces.count == 9, "All actual md-button views install native focus/accessibility surfaces")
        check(view("z").canBecomeKeyView && !view("a").canBecomeKeyView, "Selected child is actual sole group Tab entry")
        state.selectionMode = "multi-select"; pump()
        check(view("a").canBecomeKeyView && !view("z").canBecomeKeyView, "Mounted selection-mode changes recompute untouched group entry")
        state.selectionMode = "single-select"; pump()
        check(view("z").canBecomeKeyView, "Mounted single-select restores selected entry")
        check(!view("disabled").acceptsFirstResponder && !view("disabled").canBecomeKeyView, "Hard disabled excludes native focus")
        check(view("soft").acceptsFirstResponder && view("loading").acceptsFirstResponder, "Soft disabled and loading remain native focusable")
        check(!view("cell").canBecomeKeyView && view("cell").acceptsFirstResponder, "Standalone minus-one cell skips Tab but retains native focus")
        _ = window.makeFirstResponder(view("before")); window.selectNextKeyView(nil); pump()
        check(focused() == "z", "Real native Tab enters only selected group button")
        key(124, "\u{F703}")
        check(focused() == "a", "Real native Right wraps group focus")
        key(124, "\u{F703}")
        check(focused() == "soft", "Real native Right skips hard disabled")
        key(36, "\r"); key(49, " ")
        check(state.events.isEmpty, "Soft-disabled native keyboard activation stays blocked")
        key(124, "\u{F703}"); key(36, "\r")
        check(focused() == "loading" && state.events.isEmpty, "Loading retains keyboard focus with blocked activation")
        key(119, "\u{F72B}"); check(focused() == "z", "Real native End focuses last eligible")
        key(115, "\u{F729}"); check(focused() == "a", "Real native Home focuses first eligible")
        check(state.events.isEmpty, "Native focus changes emit no source click/selection events")
        state.rtl = true; pump(); key(123, "\u{F702}")
        check(focused() == "soft", "Mounted RTL reverses native arrow direction")
        state.rtl = false; pump()
        window.selectNextKeyView(nil); pump()
        check(focused() == "after", "Real Tab exits group instead of visiting roving minus-one siblings")
        window.selectPreviousKeyView(nil); pump()
        check(focused() == "soft", "Shift-Tab returns to most recently focused group entry")
        key(115, "\u{F729}"); key(36, "\r")
        check(state.events.filter { $0.name == "mdClick" }.count == 1 && state.events.contains { $0.name == "mdSelectionChange" }, "Native Enter activates through real action and selection dispatcher once")
        check(view("cell").isAccessibilityElement() && view("cell").accessibilityRole() == .cell && view("cell").isAccessibilitySelected(), "Actual AX gridcell is exposed and selected without toggle")
        check(view("cell").accessibilityRowIndexRange() == NSRange(location: 1, length: 1) && view("cell").accessibilityColumnIndexRange() == NSRange(location: 2, length: 1), "Actual native AX cell exposes explicit collection coordinates")
        check(view("unknown").accessibilityRole() == .button, "Unknown role safely exposes actual button role")
        check(!view("soft").isAccessibilityEnabled() && !view("soft").accessibilityPerformPress(), "Blocked AX action remains inert")
        check(view("cell").accessibilityPerformPress() && state.events.contains { $0.nodeID == "cell" && $0.name == "mdClick" }, "Minus-one gridcell retains actual accessibility activation")
        _ = window.makeFirstResponder(view("z")); pump(); state.disableLast = true; pump()
        check(!view("z").canBecomeKeyView && view("a").canBecomeKeyView, "Mounted hard-disable recomputes group entry")
        window.close(); print("Passed \(count) real native keyboard and accessibility integration checks.")
    }
}
