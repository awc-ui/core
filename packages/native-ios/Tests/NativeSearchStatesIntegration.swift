import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-search interaction against Chrome 153 (Mac capture of search-states.html: 9 runs, full and reduced motion) with real
// AppKit mouse and key events: docked contained / divided in both directions (click the bar, type with debounce 200, ↓ ↓ ↑ ↑
// through the result rows and back to the input, Enter, Escape), full-screen contained / divided from the bar (type, Tab to
// the clear button and a row, Tab wrapping to the back button, Shift+Tab wrapping back, Escape), the icon trigger (open,
// back button), clear and loading (the loading ↔ clear morph and the panel fading under loading, clear, an outside press)
// and keys typed in a page control while the docked view is open. Checks the md* events (names and details), each phase's
// end state (open, value, the focused element, the status announcement) and every Chrome frame's bar box and opacity and
// panel opacity inside the native frames' envelope.
#if canImport(AppKit)
final class SearchKeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
#else
typealias SearchKeyWindow = NSWindow
#endif
@Observable final class SearchStatesState {
    var node = AWCNode(id: "search", tag: "md-search")
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = false
    var before = false
    var textarea = false
    var text = "one\ntwo"
    var measurements: [AWCNativeInspectionNode] = []
}
struct SearchRecorded { let t: Double; let name: String; let detail: AWCValue }
@MainActor var searchEvents: [SearchRecorded] = []
@MainActor var searchClock: () -> Double = { CACurrentMediaTime() * 1000 }
let searchPointer = AWCNativePointerState()
@MainActor let searchStatesController = AWCSearchController()
struct SearchStatesFixture: View {
    @Bindable var state: SearchStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope {
            VStack(alignment: .leading, spacing: 0) {
                // Chrome's page: an inline "before" button (21px line) or a two-line textarea (40px) above the search.
                if state.before { Color.clear.frame(width: 60, height: 21) }
                if state.textarea { TextEditor(text: $state.text).font(.system(size: 13)).frame(width: 180, height: 40).awcInspect(nodeID: "search", part: "textarea", name: "textarea") }
                AWCNativeView(node: state.node) { e in MainActor.assumeIsolated { searchEvents.append(.init(t: searchClock(), name: e.name, detail: e.detail)) } }
                    .frame(width: 420, alignment: .leading)
            }
            // Chrome's page: the harness box (left 24, top 24, inline-size 420, dir on the box) in an LTR page.
            .frame(width: 420, alignment: .leading)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .environment(\.layoutDirection, .leftToRight)
        }
        .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        .environment(\.awcNativePointerState, searchPointer)
        .awcSearchController(searchStatesController)
        .awcSearchReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "search|alpha|alpine|alpaca", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeSearchStatesIntegration {
    static let state = SearchStatesState()
    static var host: NSHostingView<SearchStatesFixture>!, window: SearchKeyWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    struct Sample { let t: Double; let m: [String: AWCNativeInspectionNode]; let focus: String }
    static var samples: [Sample] = []
    static var phaseStart = 0.0
    static func part(_ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && $0.id.hasPrefix("search:") } }
    static func pump(_ duration: Double) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004))
            var m: [String: AWCNativeInspectionNode] = [:]; for n in state.measurements where n.id.hasPrefix("search:") { m[n.name] = n }
            samples.append(.init(t: searchClock() - phaseStart, m: m, focus: focusPath()))
        } while Date() < end
    }
    static let rowNames = ["alpha": "Alpha", "alpine": "Alpine", "alpaca": "Alpaca"]
    /// The focused element in the oracle's terms (md-search>input…, md-list-item[Alpha], textarea#ta, body).
    static func focusPath() -> String {
        #if canImport(AppKit)
        guard let r = window?.firstResponder else { return "body" }
        if let tv = r as? NSTextView {
            if tv.isFieldEditor, tv.delegate is NSTextField { return "md-search>input.md-search__input" }
            return "textarea#ta"
        }
        if let f = r as? AWCNativeButtonFocusView, let id = f.configuration?.id {
            if let row = rowNames[id] { return "md-list-item[\(row)]" }
            if id == "search-clear" || id == "search-voice" { return "md-search>button.md-search__icon-button" }
            if id == "search-leading" { return "md-search>button.md-search__leading-button" }
            if id == "search-trigger" { return "md-search>md-icon-button" }
            return id
        }
        return "body"
        #else
        guard let r = AWCFirstResponderProbe.current() else { return "body" }
        if r is AWCFieldUITextField { return "md-search>input.md-search__input" }
        if r is UITextView { return "textarea#ta" }
        if let f = r as? AWCNativeButtonFocusView, let id = f.configuration?.id {
            if let row = rowNames[id] { return "md-list-item[\(row)]" }
            if id == "search-clear" || id == "search-voice" { return "md-search>button.md-search__icon-button" }
            if id == "search-leading" { return "md-search>button.md-search__leading-button" }
            if id == "search-trigger" { return "md-search>md-icon-button" }
            return id
        }
        return "body"
        #endif
    }
    static func key(_ chars: String, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
            queued(); NSApp.postEvent(e, atStart: false)
        }
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    static func special(_ scalar: Int, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) { key(String(UnicodeScalar(UInt32(scalar))!), code, flags.union([.function, .numericPad])) }
    static var cadence: [Double] = []
    /// iOS: when each click / key event was queued, paired in order with the harness's delivery stamps (`AWCShimTouch.deliveredAt`,
    /// one per delivered touch phase / press; ios-harness.md item 31). Chrome times its frames from its trusted input, UIKit
    /// delivers the synthesized one 17-36 ms later (more under load): a native frame is timed back by the delivery delay of the
    /// latest input delivered by then (AWC_SEARCH_STEP_ANCHOR=queue: the queue time, as on macOS).
    static var queuedAt: [Double] = []
    static var deliveries: [(at: Double, delay: Double)] = []
    static func deliveryDelay(at t: Double) -> Double { deliveries.last { $0.at <= t + 0.5 && t - $0.at < 400 }?.delay ?? 0 }
    static func queued() {
        #if !canImport(AppKit)
        queuedAt.append(CACurrentMediaTime() * 1000)
        #endif
    }
    static let codes: [Character: UInt16] = ["a": 0, "l": 37, "x": 7]
    static func type(_ text: String) {
        for ch in text {
            if !cadence.isEmpty { let at = cadence.removeFirst(); let wait = (phaseStart + at) - searchClock(); if wait > 0 { pump(wait / 1000) } }
            key(String(ch), codes[ch] ?? 0)
            pump(cadence.isEmpty ? 0.033 : 0.002)
        }
    }
    static func click(_ p: CGPoint) {
        let wp = host.convert(p, to: nil)
        func ev(_ t: NSEvent.EventType) -> NSEvent { NSEvent.mouseEvent(with: t, location: wp, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: t == .leftMouseDown ? 1 : 0)! }
        searchPointer.update(phase: .down, location: p)
        // Both through the queue (the up is waiting when the down is handled, as AppKit's tracking loops need): the event being
        // handled is then NSApp.currentEvent, which times the motion it starts.
        queued(); NSApp.postEvent(ev(.leftMouseDown), atStart: false); queued(); NSApp.postEvent(ev(.leftMouseUp), atStart: false); pump(0.01)
        searchPointer.update(phase: .up, location: p)
    }
    static func centre(_ name: String) -> CGPoint? { part(name).map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func act(_ run: String, _ label: String) {
        switch label {
        case "click-bar-focus", "click-bar", "click-bar-opens": if let c = centre("bar") { click(CGPoint(x: c.x, y: c.y)) }
        case "type-al-opens", "type-al": type("al")
        case "type-x-opens": type("x")
        case "ArrowDown", "ArrowDown-in-textarea": special(0xF701, 125)
        case "ArrowUp", "ArrowUp-to-input": special(0xF700, 126)
        case "Enter-submit": key("\r", 36)
        case "Escape-closes", "Escape-in-textarea": key("\u{1B}", 53)
        case "Tab", "Tab-wraps": key("\t", 48)
        case "Shift+Tab-wraps-back": key("\u{19}", 48, .shift)
        case "click-icon-opens": if let c = centre("trigger-button") { click(c) }
        case "leading-back-closes": if let c = centre("leading-button") { click(c) }
        case "loading-on": state.node.properties["loading"] = .bool(true)
        case "loading-off": state.node.properties["loading"] = .bool(false)
        case "click-clear": if let c = centre("clear-button") { click(c) }
        case "outside-click-closes": click(CGPoint(x: 1100, y: 700))
        case "focus-textarea":
            #if canImport(AppKit)
            func find(_ v: NSView) -> NSTextView? { if let t = v as? NSTextView, !t.isFieldEditor, t.isEditable { return t }; for c in v.subviews { if let f = find(c) { return f } }; return nil }
            if let t = find(host) { _ = window.makeFirstResponder(t) }
            #else
            func find(_ v: UIView) -> UITextView? { if let t = v as? UITextView, t.isEditable { return t }; for c in v.subviews { if let f = find(c) { return f } }; return nil }
            if let t = find(host) { _ = t.becomeFirstResponder() }
            #endif
        default: check(false, "\(run) unknown phase \(label)")
        }
    }
    static func list() -> AWCNode {
        AWCNode(id: "results", tag: "md-list", children: [("alpha", "Alpha"), ("alpine", "Alpine"), ("alpaca", "Alpaca")]
            .map { AWCNode(id: $0.0, tag: "md-list-item", properties: ["headline": .string($0.1), "type": "button"]) }, slot: "results")
    }
    /// The native frames within two frames of a Chrome frame, Chrome's or native's, whichever are longer: [t − 40, t + 34],
    /// stretched to the second native frame before / after t when native frames are longer than Chrome's (the first render
    /// of an opening view), by at most 100 ms a side. With no native frame at or before t in it, the frame that held joins.
    /// Exception proposal md-search-ios-open-gap (pending gate-7 review): the time (ms) between the native drawn frames around t,
    /// a drawn frame being a sample whose measured value differs from the previous sample's.
    static func drawGap(_ t: Double, _ value: (Sample) -> Double?) -> Double {
        var changes: [Double] = [], last = Double.nan
        for s in samples { let v = value(s) ?? -999; if v != last { changes.append(s.t) }; last = v }
        guard let a = changes.last(where: { $0 <= t }), let b = changes.first(where: { $0 > t }), b - a < 400 else { return 0 }
        return b - a
    }
    nonisolated(unsafe) static var pending = 0, pendingPhases: Set<String> = []
    static let openingPhases: Set<String> = ["click-bar", "click-bar-focus", "click-bar-opens", "click-icon-opens", "type-x-opens"]
    static let macPhases: Set<String> = ["click-bar-opens", "Escape-closes"]
    static func envelope(_ t: Double, _ value: (Sample) -> Double?) -> (Double, Double)? {
        var window = samples.filter { $0.t >= t - 40 && $0.t <= t + 34 }
        #if !canImport(AppKit)
        // NativeTextFieldStatesIntegration's gap rule: a frame UIKit did not draw keeps the last drawn frame on screen until the
        // next one, so only across such a gap (> 34 ms between fixture frames) the frame before / after the window bounds what was shown.
        if let before = samples.last(where: { $0.t < t - 40 }), (window.first?.t ?? .infinity) - before.t > 34 { window.insert(before, at: 0) }
        if let after = samples.first(where: { $0.t > t + 34 }), after.t - (window.last?.t ?? -.infinity) > 34 { window.append(after) }
        #endif
        let vs = window.compactMap(value)
        guard let lo = vs.min(), let hi = vs.max() else { return nil }
        return (lo, hi)
    }
    static func runOne(_ r: AWCValue, reduced: Bool, last: Bool) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        var props: [String: AWCValue] = [:]; if case .object(let o) = r["props"] { props = o }
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.before = r["before"].bool == true; state.textarea = r["textarea"].bool == true; state.text = "one\ntwo"
        state.node = AWCNode(id: "search", tag: "md-search", properties: props, children: r["list"].bool == true ? [list()] : [])
        _ = window.makeFirstResponder(nil); searchPointer.update(phase: .leave)
        state.measurements = []; state.epoch += 1; samples = []; pump(0.5)
        searchEvents = []
        let t0 = searchClock()
        let phases = r["phases"].array
        for (i, p) in phases.enumerated() {
            let label = p["label"].string
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! : (p["t"].number! + 700)
            let prevStart = phaseStart
            phaseStart = t0 + p["t"].number!
            // The frames before the phase, in its time: the one that held 45 ms before it and those since.
            let earlier = samples.map { Sample(t: $0.t + prevStart - phaseStart, m: $0.m, focus: $0.focus) }
            samples = []
            let wait = phaseStart - searchClock(); if wait > 0 { pump(wait / 1000) }
            let before = (earlier + samples).filter { $0.t < 0 }
            samples = Array(before.filter { $0.t < -45 }.suffix(1)) + before.filter { $0.t >= -45 } + samples.filter { $0.t >= 0 }
            // Chrome's keystroke times in this phase: its mdInput events (one per key).
            cadence = r["events"].array.filter { $0["name"].string == "mdInput" && $0["t"].number! >= p["t"].number! && $0["t"].number! < next }.map { $0["t"].number! - p["t"].number! - 2 }
            if !label.hasPrefix("type") { cadence = [] }
            // Chrome's trusted click lands two CDP round trips into the phase (its first md* event comes at ~33 ms, in the frame
            // its transitions start): the native click lands then, as typed keys follow Chrome's mdInput times.
            if label.hasPrefix("click") || label.hasPrefix("leading-back") || label.hasPrefix("outside-click"),
               let first = r["events"].array.compactMap({ $0["t"].number }).filter({ $0 >= p["t"].number! && $0 < next }).min() {
                let w = phaseStart + (first - p["t"].number!) - searchClock(); if w > 0 { pump(w / 1000) }
            }
            #if !canImport(AppKit)
            let qMark = queuedAt.count, dMark = AWCShimTouch.deliveredAt.count, kMark = AWCShimTouch.keyArrivals.count
            #endif
            act(name, label)
            let remaining = next - (searchClock() - t0); pump(max(0.05, remaining / 1000))
            #if !canImport(AppKit)
            if ProcessInfo.processInfo.environment["AWC_SEARCH_STEP_ANCHOR"] != "queue" {
                var q = Array(queuedAt[qMark...]); var d = Array(AWCShimTouch.deliveredAt[dMark...])
                if d.isEmpty { let ka = Array(AWCShimTouch.keyArrivals[kMark...]); d = ka.enumerated().filter { $0.offset % 2 == 0 }.map { $0.element }; q = q.enumerated().filter { $0.offset % 2 == 0 }.map { $0.element } }   // n3-060: a key phase is timed from the HID key arrival
                for (qq, dd) in zip(q, d) where dd - qq >= 0 && dd - qq < 150 { deliveries.append((at: dd, delay: dd - qq)) }
                if ProcessInfo.processInfo.environment["AWC_SEARCH_DELIVERY_DEBUG"] != nil { print("  delivery \(name) \(label): delays \(zip(q, d).map { Int($1 - $0) })"); fflush(stdout) }
                samples = samples.map { Sample(t: $0.t - deliveryDelay(at: phaseStart + $0.t), m: $0.m, focus: $0.focus) }
            }
            #endif
            // Mutation check (diagnostic): the native frames of an opening / closing phase one frame late must fail the envelope.
            if let d = ProcessInfo.processInfo.environment["AWC_SEARCH_MUTATE_DELAY"].flatMap(Double.init), openingPhases.contains(label) || label.hasSuffix("closes") {
                samples = samples.map { $0.t >= 0 ? Sample(t: $0.t + d, m: $0.m, focus: $0.focus) : $0 }
            }
            // Motion: the bar's box and opacity and the panel's opacity in every Chrome frame inside the native envelope.
            var motion = 0, bad = 0
            for s in p["samples"].array {
                let t = s["t"].number! - p["t"].number!
                func within(_ want: Double?, _ tol: Double, _ label2: String, _ read: (Sample) -> Double?) {
                    guard let want, let env = envelope(t, read) else { return }
                    motion += 1
                    if want < env.0 - tol || want > env.1 + tol {
                        bad += 1; if bad <= 4 { print("  \(name) \(label) t=\(Int(t)) \(label2) \(want) not in \(env)") } }
                }
                if s["bar"] != .null, (s["bar"]["opacity"].number ?? 0) > 0.02 {
                    within(s["bar"]["rect"]["x"].number, 1, "bar x") { $0.m["bar"].map { Double($0.bounds.minX) } }
                    within(s["bar"]["rect"]["width"].number, 1, "bar width") { $0.m["bar"].map { Double($0.bounds.width) } }
                    within(s["bar"]["opacity"].number, 0.04, "bar opacity") { smp in smp.m["bar"].map { _ in fullScreenBarOpacity(smp) } }
                }
                if s["panel"] != .null { within(s["panel"]["opacity"].number, 0.04, "panel opacity") { $0.m["panel"]?.metrics["opacity"]?.number ?? 0 } }
            }
            check(bad == 0, "\(name) \(label) motion: \(bad)/\(motion) frames outside the envelope")
            report.append(["run": name, "phase": label, "frames": motion, "outside": bad])
            if bad > 0 { for f in samples.filter({ $0.t >= -20 && $0.t <= 400 }).prefix(24) {
                print("    native t=\(Int(f.t)) bar=\(f.m["bar"].map { "\(Int($0.bounds.minX)),\(Int($0.bounds.width)) o=\(fullScreenBarOpacity(f))" } ?? "-") panel=\(f.m["panel"]?.metrics["opacity"]?.number ?? -1) focus=\(f.focus)") } }
            // End state: Chrome's last frame of the phase.
            guard let lastS = p["samples"].array.last, let tail = samples.last else { continue }
            let lastT = lastS["t"].number! - p["t"].number!
            let fin = samples.last(where: { $0.t <= lastT }) ?? tail
            let root = fin.m["md-search"]
            check(root?.metrics["open"]?.bool == lastS["open"].bool, "\(name) \(label) open \(String(describing: root?.metrics["open"])) vs \(lastS["open"])")
            check((root?.metrics["value"]?.string ?? "-") == lastS["value"].string, "\(name) \(label) value \(root?.metrics["value"]?.string ?? "-") vs \(lastS["value"].string)")
            let webFocus = lastS["focus"].string.replacingOccurrences(of: ">span", with: "").replacingOccurrences(of: "md-icon-button.md-search__trigger-button", with: "md-icon-button")
            check(fin.focus == webFocus, "\(name) \(label) focus \(fin.focus) vs \(webFocus)")
            check((root?.metrics["status"]?.string ?? "") == (lastS["status"].string), "\(name) \(label) status \(root?.metrics["status"]?.string ?? "-") vs \(lastS["status"].string)")
        }
        let web = r["events"].array, native = searchEvents.filter { ["mdInput", "mdSearch", "mdSubmit", "mdChange", "mdOpen", "mdClose", "mdClear", "mdLeadingIconClick"].contains($0.name) }
        check(native.count == web.count, "\(name) \(native.count) md events vs \(web.count): native \(native.map { "\($0.name) \($0.detail)" })")
        for (i, (w, n)) in zip(web, native).enumerated() {
            check(w["name"].string == n.name, "\(name) event \(i) \(n.name) vs \(w["name"].string)")
            if w["detail"] != .null { check(n.detail == w["detail"], "\(name) event \(i) \(n.name) detail \(n.detail) vs \(w["detail"])") }
        }
        searchStatesController.close(); pump(0.9)
        _ = window.makeFirstResponder(nil); searchPointer.update(phase: .leave)
    }
    /// The full-screen view's bar draws in the modal viewport with its own opacity; docked / resting bars are opaque.
    static func fullScreenBarOpacity(_ s: Sample) -> Double { s.m["bar"]?.metrics["barOpacity"]?.number ?? 1 }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SearchStatesFixture(state: state))
        window = SearchKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        #if canImport(AppKit)
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        #endif
        pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("search-web-states.json")))
        let only = ProcessInfo.processInfo.environment["AWC_SEARCH_ONLY"]
        #if !canImport(AppKit)
        // Warm-up, not checked (as the app-bar and time-picker states fixtures do): the simulator's first focus of a text input and
        // the first open of a search stall 250-530 ms (keyboard / input machinery, first-use rendering); Chrome's oracle page was warm.
        if ProcessInfo.processInfo.environment["AWC_SEARCH_WARMUP"] != "0", let r = oracle["runs"].array.first {
            var props: [String: AWCValue] = [:]; if case .object(let o) = r["props"] { props = o }
            state.node = AWCNode(id: "search", tag: "md-search", properties: props, children: r["list"].bool == true ? [list()] : [])
            state.epoch += 1; pump(0.5)
            if let c = centre("bar") { click(c) }; pump(0.6)
            type("al"); pump(0.6)
            searchStatesController.close(); pump(0.9)
            _ = window.makeFirstResponder(nil); searchPointer.update(phase: .leave); pump(0.3)
            searchEvents = []; samples = []
        }
        #endif
        for (k, list) in [("runs", false), ("reduced", true)] {
            let runs = oracle[k].array
            for (i, r) in runs.enumerated() where only.map({ r["name"].string.contains($0) }) ?? true { runOne(r, reduced: list, last: i == runs.count - 1) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_SEARCH_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        if pending > 0 { print("Search native states: \(pending) frames in \(pendingPhases.count) phases PENDING gate-7 review (md-search-ios-open-gap): \(pendingPhases.sorted().joined(separator: "; "))") }
        print("Search native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
