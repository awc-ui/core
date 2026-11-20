import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-autocomplete lifecycle and methods, as the source's own contract tests state them (md-autocomplete.api.spec.ts,
// md-autocomplete.spec.ts): showMenu / closeMenu (no-op while disabled or already closed, focus stays where it is),
// loadOptions (replaces the list; an empty list says "No options"; an options update replaces loaded options), getLabels
// (a plain map; an unknown value is its own label), the value in single and multiple mode, the spinner while loading,
// the clear affordance kept mounted while empty, the validity API with mdValidityChange, retained property updates, and
// unmounting while open then remounting.
@MainActor @Observable final class ACLifeState {
    var node = AWCNode(id: "m", tag: "md-autocomplete", properties: [:])
    var mounted = true
    var epoch = 0
    /// Bumped after each pump: one root update delivers inspection changes made by the last layout pass.
    var tick = 0
    var measurements: [AWCNativeInspectionNode] = []
    var registry = AWCMenuRegistry()
    var controller = AWCAutocompleteController()
}
struct ACLifeFixture: View {
    let state: ACLifeState
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let epoch = state.epoch
        let _ = state.tick
        AWCMenuScope(registry: state.registry) {
            VStack(alignment: .leading) {
                if state.mounted { AWCNativeView(node: state.node, onEvent: onEvent).frame(width: 320) }
                Spacer()
            }
            .padding(24)
        }
        .awcAutocompleteController(state.controller, for: "m")
        .awcMenuReducedMotion(true)
        .awcFieldReducedMotion(true)
        .awcTheme(AWCTheme.generated(dark: false))
        .awcNativeInspection(rootID: "m|m::menu", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: 600, height: 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
    }
}
#if canImport(AppKit)
final class ACLifeWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
#else
typealias ACLifeWindow = NSWindow
#endif
@main @MainActor enum NativeAutocompleteLifecycleIntegration {
    static let state = ACLifeState()
    static var host: NSHostingView<ACLifeFixture>!, window: ACLifeWindow!
    static var checks = 0, failures: [String] = []
    static var events: [(name: String, detail: AWCValue)] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func step() { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) }
    /// Pumps for `d`, then flushes the inspection: a GeometryReader evaluated in the last layout pass after the last graph update
    /// (here: the status after an options update) changes the inspection preference, but SwiftUI delivers it only with the next
    /// graph update, which a settled view never schedules (d4-067: the inspection kept the old status for 1 s). One root update
    /// (`tick`) delivers it.
    static func pump(_ d: Double) { let end = Date().addingTimeInterval(d); repeat { step() } while Date() < end; state.tick &+= 1; for _ in 0..<3 { step() } }
    static func metric(_ key: String) -> AWCValue { state.measurements.first { $0.id == "m:component" }?.metrics[key] ?? .null }
    static func part(_ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.id == "m:component." + name } }
    static func set(_ p: [String: AWCValue]) { state.node.properties.merge(p) { _, n in n }; pump(0.15) }
    static func count(_ name: String) -> Int { events.filter { $0.name == name }.count }
    static let fruit: AWCValue = .array([.object(["value": "a", "label": "Apple"]), .object(["value": "b", "label": "Apricot"]),
                                         .object(["value": "c", "label": "Avocado", "disabled": true]), .object(["value": "d", "label": "Banana"])])
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        state.node.properties = ["label": "Fruit", "options": fruit]
        host = NSHostingView(rootView: ACLifeFixture(state: state) { e in if e.name.hasPrefix("md") && e.nodeID == "m" { events.append((e.name, e.detail)) } })
        window = ACLifeWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.makeKeyAndOrderFront(nil); pump(0.6)
        let c = state.controller
        check(c.isConnected, "the controller attaches to the mounted autocomplete")
        // showMenu / closeMenu
        c.showMenu(); pump(0.3)
        check(metric("open") == .bool(true) && count("mdOpen") == 1, "showMenu opens (mdOpen)")
        check(metric("focused") == .bool(false), "showMenu does not take focus")
        check(metric("status").string == "4 suggestions available", "status with every option: \(metric("status"))")
        c.closeMenu(); pump(0.3)
        check(metric("open") == .bool(false) && count("mdClose") == 1, "closeMenu closes (mdClose)")
        c.closeMenu(); pump(0.2)
        check(count("mdClose") == 1, "closing an already-closed menu is a no-op")
        set(["disabled": true]); c.showMenu(); pump(0.2)
        check(metric("open") == .bool(false) && count("mdOpen") == 1, "showMenu refuses to open while disabled")
        set(["disabled": false])
        c.focusInput(); pump(0.15); c.showMenu(); pump(0.3)
        check(metric("focused") == .bool(true) && metric("open") == .bool(true), "opens without stealing focus from the input")
        c.closeMenu(); pump(0.3)
        // loadOptions
        c.loadOptions([.object(["value": "kiwi"]), .object(["value": "lime", "label": "Lime", "description": "Citrus"])]); c.showMenu(); pump(0.3)
        check(metric("status").string == "2 suggestions available", "loadOptions replaces the dataset: \(metric("status"))")
        c.loadOptions([]); pump(0.15)
        check(metric("status").string == "0 suggestions available", "an empty dataset: \(metric("status"))")
        check(state.measurements.contains { $0.id.hasPrefix("m::menu:component") }, "the menu stays open with its empty text")
        c.loadOptions([.object(["value": "kiwi"]), .object(["value": "lime", "label": "Lime"])]); pump(0.1)
        // getLabels
        let labels = c.getLabels(["lime", "kiwi", "zz"])
        check(labels == ["lime": "Lime", "kiwi": "kiwi", "zz": "zz"], "getLabels returns a plain map, unknown values echo: \(labels)")
        set(["options": .array(fruit.array + [.object(["value": "e", "label": "Elderberry"])])]); pump(0.3)
        check(c.getLabels(["a"]) == ["a": "Apple"], "an options update replaces the loaded list (labels)")
        check(metric("open") == .bool(true), "an options update keeps the suggestions open")
        check(metric("status").string == "5 suggestions available", "an options update replaces the loaded list: \(metric("status"))")
        c.closeMenu(); pump(0.3)
        // value: single and multiple
        set(["value": "b"])
        check(metric("value") == .string("b") && metric("inputValue").string == "Apricot", "a bare string value in single mode shows its label")
        check(c.getLabels(["b"]) == ["b": "Apricot"], "getLabels reads option labels")
        check(part("clear") != nil, "the clear affordance is mounted with a value")
        set(["multiple": true, "value": .array(["a", "d"])])
        check(metric("value") == .array(["a", "d"]), "an array in multiple mode: \(metric("value"))")
        check(part("chip-0") != nil && part("chip-1") != nil && part("chip-2") == nil, "a chip per value")
        set(["multiple": false, "value": ""])
        check(part("clear") != nil, "the clear affordance stays mounted while empty (hidden)")
        // loading
        set(["loading": true])
        check(part("loading-spinner") != nil && part("caret") == nil, "the spinner replaces the caret while loading")
        set(["loading": false])
        check(part("caret") != nil, "the caret returns")
        // validity
        let before = count("mdValidityChange")
        set(["required": true])
        check(!c.checkValidity() && c.getValidity().flags["valueMissing"] == true && c.getValidity().validationMessage == "Please make a selection", "required without a value: valueMissing")
        check(count("mdValidityChange") > before, "mdValidityChange on the validity change")
        set(["errorText": "Pick a fruit"])
        check(c.getValidity().validationMessage == "Pick a fruit", "errorText wins over valueMissingLabel")
        c.setCustomValidity("Out of season"); pump(0.1)
        check(c.getValidity().flags["customError"] == true && c.getValidity().validationMessage == "Out of season", "a custom error")
        c.setCustomValidity(""); pump(0.1)
        _ = c.reportValidity(); pump(0.2)
        check(metric("validationMessage").string == "Pick a fruit" && metric("focused") == .bool(true), "reportValidity shows the message and focuses the input")
        set(["value": "a"])
        check(c.checkValidity() && metric("valid") == .bool(true), "a value satisfies required")
        // unmount while open, remount
        c.showMenu(); pump(0.3)
        state.mounted = false; pump(0.3)
        check(!state.measurements.contains { $0.id.hasPrefix("m::menu:component") }, "unmounting while open removes the menu")
        state.mounted = true; state.node.properties["open"] = nil; pump(0.4)
        check(c.isConnected && metric("open") == .bool(false) && metric("value") == .string("a"), "remounts closed with its value")
        print("Autocomplete native lifecycle: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
