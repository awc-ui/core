import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-organization-chart interaction, motion and lifecycle against Chrome 153 (web-oracle states.json, 16 runs, and
// states-reduced-motion.json, 4 runs; shared fixture Tests/Fixtures/orgchart-web-states.json from
// fx-lab/orgchart/gen-states.py): pointer fold/unfold per orientation and direction, the WAI-ARIA tree keyboard model
// in LTR and RTL, pointer selection, selection-mode none, an unselectable parent, a card press, collapsible="false",
// folding with focus inside and controlled updates. Real AppKit mouse and key events drive the production view.
// Checks per phase: the settled state of every visible tree item (tab stop, expanded, selected, trail, border colour
// and width, box-shadow, focus ring, state layer, z-index) and the focused element; per frame: the state-layer,
// border and shadow transitions and the unfold keyframes, inside Chrome's own samples one Chrome frame either side;
// and the component events (order, phase, payload).
@Observable final class OrgChartStatesState {
    var run: AWCValue = .null
    var epoch = 0
    var props: [String: AWCValue] = [:]
    let pointer = AWCNativePointerState()
}
struct OrgChartStatesFixture: View {
    let state: OrgChartStatesState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        return ZStack(alignment: .topLeading) {
            // DOM order of oc-states.html: the "before" probe, the chart (24, 56), the "after" probe (AppKit orders the key-view loop geometrically).
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("before")])).offset(x: 24, y: 8)
            AWCNativeView(node: .init(id: "chart", tag: "md-organization-chart", properties: state.props)) { e in
                NativeOrgChartStatesIntegration.events.append((e.name, e.detail, NativeOrgChartStatesIntegration.phase)) }
                .frame(width: 920, alignment: .topLeading)
                .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: 24, y: 56)
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("after")])).offset(x: 24, y: 840)
        }
        .environment(\.awcOrgChartInspector, { probe in NativeOrgChartStatesIntegration.probe = probe })
        .environment(\.awcOrgChartReducedMotion, r["set"].string == "reduced")
        .environment(\.awcOrgChartClock, NativeOrgChartStatesIntegration.clock)
        .environment(\.awcNativePointerState, state.pointer)
        .awcTheme(theme)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeOrgChartStatesIntegration {
    static let state = OrgChartStatesState()
    static var host: NSHostingView<OrgChartStatesFixture>!, window: NSWindow!
    static var probe: AWCOrgChartProbe?
    /// Chrome's frame clock: the chart runs on a 16.67 ms frame-stepped clock aligned with the oracle's rAF timeline.
    static var clock = AWCOrgChartClock()
    static var events: [(String, AWCValue, Int)] = []
    static var phase = -1
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let hostOrigin = CGPoint(x: 24, y: 56)
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    /// The focused element as the oracle names it: a tree item's data-id, a probe button's id, or nil (body).
    static func active() -> String? {
        guard let id = (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() else { return nil }
        return id.hasPrefix("chart/") ? String(id.dropFirst(6)) : id
    }
    static func value(_ a: Any) -> AWCValue {
        if let d = a as? [String: Any] { return .object(d.mapValues(value)) }
        if let arr = a as? [Any] { return .array(arr.map(value)) }
        if let str = a as? String { return .string(str) }
        if let n = a as? NSNumber { return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue) }
        return .null
    }
    static func nums(_ v: AWCValue) -> [Double] { v.array.compactMap(\.number) }
    static func close(_ a: [Double], _ b: [Double], _ tol: Double) -> Bool { a.count == b.count && zip(a, b).allSatisfy { abs($0 - $1) <= tol } }
    /// Box-shadow layers [x, y, blur, spread, premultiplied rgb, a] ×3: lengths within 0.15 px, colour channels 0.02.
    static func shadowClose(_ a: [Double], _ b: [Double], lengths: Double = 0.15, color: Double = 0.02) -> Bool {
        guard a.count == b.count else { return false }
        for i in a.indices where abs(a[i] - b[i]) > (i % 8 < 4 ? lengths : color) { return false }
        return true
    }

    // MARK: Run
    /// Chrome's own timing, read from its samples: the time (ms after the phase start) at which a card's state layer takes
    /// its new value — the first changed sample, or with motion the frame before it, where its transition starts at
    /// progress 0. Chrome applies `:active` with the move when the move restyles the card's layer, otherwise a frame later.
    static func layerStart(_ ph: AWCValue, _ id: String, reduced: Bool) -> Double? {
        let s = ph["samples"].array, t = ph["t"].number!
        let v = s.map { x in x["nodes"].array.first { $0["id"].string == id }?["layer"].number }
        guard let first = v.first, let v0 = first, let k = v.firstIndex(where: { $0.map { abs($0 - v0) > 1e-6 } ?? false }), k >= 1 else { return nil }
        return s[k]["t"].number! - t - (reduced ? 0 : 1000.0 / 60)
    }
    static func run(_ r: AWCValue) {
        let name = r["set"].string + "/" + r["name"].string
        var props: [String: AWCValue] = ["label": "Project team", "nodes": r["nodes"]]
        for (k, v) in r["props"].object { props[k] = v }
        state.pointer.update(phase: .leave); probe = nil; clock = AWCOrgChartClock()
        state.run = r; state.props = props; state.epoch += 1; pump(0.3)
        for _ in 0..<30 { clock.tick(); pump(0.004) }
        _ = window.makeFirstResponder(nil); events = []; phase = -1; pump(0.05)
        guard let first = probe else { check(false, "\(name) probe"); return }
        _ = first
        let away = CGPoint(x: 1190, y: 890)
        func rects(_ id: String) -> (CGRect, CGRect?)? {
            guard let n = probe?.snapshot(now()).nodes.first(where: { $0.id == id }) else { return nil }
            return (n.card.offsetBy(dx: hostOrigin.x, dy: hostOrigin.y), n.toggle?.offsetBy(dx: hostOrigin.x, dy: hostOrigin.y))
        }
        func centre(_ r: CGRect) -> CGPoint { CGPoint(x: r.midX, y: r.midY) }
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.mouseMoved, q) }
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        // oc-states.html click(): oracleMouse('down') (page.mouse.move, then page.mouse.down), a frame, oracleMouse('up').
        // Chrome restyles the hover a frame after the send, `:active` at the frame its samples show (`layerStart`) and
        // releases it at actEnd; inputs here go in a frame before and take effect at the next frame of the clock.
        var c0 = 0.0, actMs = 0.0, pressAt = 1000.0 / 60
        func tick() { clock.tick(); pump(0.004) }
        func until(_ t: Double) { while clock.now - c0 < t - 0.5 { tick() } }
        // Real-time pumps (the frame clock does not move) let AppKit and the nested controls settle between events.
        // A press Chrome applies with the move (pressAt one frame) goes in with it, before the chart renders the move.
        // The move renders in real time before the press (the frame clock does not move, so a press Chrome applies with the
        // move still starts at the same frame): the hovered card's stacking lift and the toggler's tracking settle first,
        // without which a press right after the move misses a toggler.
        func click(_ q: CGPoint) {
            pump(0.25); hoverTo(q); pump(0.05)
            if pressAt > 1500.0 / 60 { until(pressAt - 1000.0 / 60) }
            down(q); pump(0.05); until(actMs - 1000.0 / 60); pump(0.05); up(q)
        }
        let keys: [String: (UInt16, String)] = ["Tab": (48, "\t"), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"), "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}"),
                                               "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Enter": (36, "\r"), "Space": (49, " ")]
        func press(_ k: String, _ flags: NSEvent.ModifierFlags = []) { let v = keys[k]!; key(v.0, v.1, flags) }
        func action(_ label: String) -> (() -> Void)? {
            if label.hasPrefix("key-") { let k = String(label.dropFirst(4)); return { press(k) } }
            if label.hasPrefix("toggle-") { let id = String(label.dropFirst(7)); return { if let t = rects(id)?.1 { click(centre(t)) } else { check(false, "\(name) toggle \(id) present") } } }
            if label.hasPrefix("click-") { let id = String(label.dropFirst(6)); return { if let c = rects(id)?.0 { click(centre(c)) } else { check(false, "\(name) card \(id) present") } } }
            switch label {
            case "hover-toggle": return { if let t = rects("root")?.1 { hoverTo(centre(t)) } }
            case "tab-in": return { _ = focusView("before")?.requestNativeFocus(); tick(); press("Tab") }
            case "tab-out", "tab-back": return { press("Tab") }
            case "shift-tab-back", "shift-tab-out": return { press("Tab", .shift) }
            case "hover": return { if let c = rects("eng")?.0 { hoverTo(centre(c)) } }
            case "down": return { until(pressAt - 1000.0 / 60); if let c = rects("eng")?.0 { down(centre(c)) } }
            case "up": return { until(pressAt - 1000.0 / 60); if let c = rects("eng")?.0 { up(centre(c)) } }
            case "leave": return { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
            case "nodes-fold-eng": return { state.props["nodes"] = r["foldedNodes"] }
            case "selected-ids-set": return { state.props["selectedIds"] = .array([.string("support"), .string("design")]) }
            case "collapsible-false": return { state.props["collapsible"] = false }
            case "collapsible-true": return { state.props["collapsible"] = true }
            case "orientation-horizontal": return { state.props["orientation"] = "horizontal" }
            case "density-4": return { state.props["density"] = .number(-4) }
            default: return nil
            }
        }
        var motionChecks = 0, motionFails = 0, settledFails = 0
        for (i, ph) in r["phases"].array.enumerated() {
            let label = ph["label"].string, tag = "\(name)/\(i):\(label)"
            guard let act = action(label) else { check(false, "\(tag) action known"); continue }
            phase = i
            let webT = ph["t"].number!, webEnd = ph["actEnd"].number!
            // Chrome-aligned time: the phase starts at the current frame (Chrome's phase start is a frame time too). Keys, moves
            // and property sets go in at once: Chrome restyles them at its next frame, as this chart does.
            c0 = clock.now; actMs = webEnd - webT
            let target = label.hasPrefix("click-") ? String(label.dropFirst(6)) : label.hasPrefix("toggle-") ? String(label.dropFirst(7)) : "eng"
            pressAt = layerStart(ph, target, reduced: r["set"].string == "reduced") ?? (label == "down" || label == "up" ? 2000.0 / 60 : 1000.0 / 60)
            act(); pump(0.004)
            // The clock follows Chrome's rAF timeline: every Chrome sample time is a frame here too.
            while clock.now - c0 < webEnd - webT - 0.5 { tick() }
            let a1 = c0 + webEnd - webT
            var frames: [(Double, AWCOrgChartSnapshot)] = []
            for sample in ph["samples"].array where sample["t"].number! >= webEnd - 0.5 {
                let target = c0 + sample["t"].number! - webT
                // Chrome's sample times jitter by a fraction of a millisecond around its frame grid: only a frame's worth
                // of time is a frame here (a sub-millisecond tick would count as one and run deferred changes early).
                if target > clock.now + 8 { clock.tick(target - clock.now); pump(0.004) }
                if let p = probe { frames.append((clock.now - a1, p.snapshot(clock.now))) }
            }
            let next = ph["end"].number!
            while clock.now - c0 < next - webT - 0.5 { tick() }
            if frames.isEmpty, let p = probe { frames.append((clock.now - a1, p.snapshot(clock.now))) }
            let samples = ph["samples"].array.filter { $0["t"].number! >= webEnd - 0.5 }
            guard let last = ph["samples"].array.last, let mine = frames.last?.1 else { check(false, "\(tag) samples"); continue }
            // Settled state at the phase end.
            let webIDs = last["nodes"].array.map(\.["id"].string), myIDs = mine.nodes.map(\.id)
            check(webIDs == myIDs, "\(tag) visible items \(myIDs) vs \(webIDs)")
            check(active() == last["active"].stringValue, "\(tag) focus \(active() ?? "body") vs \(last["active"].stringValue ?? "body")")
            for w in last["nodes"].array {
                guard let n = mine.nodes.first(where: { $0.id == w["id"].string }) else { continue }
                let exp = w["exp"].stringValue, sel = w["sel"].stringValue
                let ok = n.tab == Int(w["tab"].number!) && (n.expanded.map { $0 ? "true" : "false" }) == exp && (n.selected.map { $0 ? "true" : "false" }) == sel
                    && n.onPath == w["onPath"].bool && abs(n.borderWidth - w["bw"].number!) < 0.01 && n.focusRing == w["outline"].bool && n.z == Int(w["z"].number!)
                    && abs(n.layer - w["layer"].number!) <= 0.005 && close(Array(n.border.prefix(3)), Array(nums(w["border"]).prefix(3)), 0.01)
                    && close(Array(n.layerColor.prefix(3)), Array(nums(w["layerBg"]).prefix(3)), 0.01) && shadowClose(n.shadow, nums(w["shadow"]))
                if !ok { settledFails += 1 }
                check(ok, "\(tag) \(n.id) settled: tab \(n.tab) exp \(String(describing: n.expanded)) sel \(String(describing: n.selected)) path \(n.onPath) bw \(n.borderWidth) ring \(n.focusRing) z \(n.z) layer \(n.layer) border \(n.border.prefix(3).map { ($0 * 255).rounded() }) shadow \(n.shadow.prefix(8)) vs \(w["tab"].number!) \(exp ?? "nil") \(sel ?? "nil") \(w["onPath"].bool ?? false) \(w["bw"].number!) \(w["outline"].bool ?? false) z \(w["z"].number!) layer \(w["layer"].number!) border \(nums(w["border"]).prefix(3).map { ($0 * 255).rounded() }) shadow \(nums(w["shadow"]).prefix(8))")
            }
            // Per frame: each native frame inside Chrome's samples one Chrome frame either side — the frame interval Chrome
            // itself recorded in this phase (16.6–16.8 ms with its timer jitter).
            let times = samples.map { $0["t"].number! }
            let frame = max(16.7, zip(times.dropFirst(), times).map { $0 - $1 }.max() ?? 16.7) + 0.05
            // The frame Chrome painted but did not sample: the source renders a (re)started group after the sampling
            // callback, so a group first sampled one frame into md-org-chart-grow (opacity <= 0.05) was painted at its 0%
            // keyframe in the frame before.
            let all = ph["samples"].array
            var implicit: [Int: [String: [Double]]] = [:]
            for j in all.indices.dropFirst() {
                for g in all[j]["groups"].array {
                    let id = g["id"].string, o = g["opacity"].number!, tx = g["tx"].number!, ty = g["ty"].number!
                    let previous = all[j - 1]["groups"].array.first(where: { $0["id"].string == id })?["opacity"].number
                    if o <= 0.05, previous.map({ $0 > o + 0.01 }) ?? true { implicit[j - 1, default: [:]][id] = [0, 0.96, abs(tx) > 0.1 ? 8 * (tx < 0 ? -1 : 1) : 0, abs(ty) > 0.1 ? 8 * (ty < 0 ? -1 : 1) : 0] }
                }
            }
            // Diagnostics: AWC_ORGCHART_STATES_TRACE=<run name part> prints every frame of matching runs beside Chrome's samples.
            if let trace = ProcessInfo.processInfo.environment["AWC_ORGCHART_STATES_TRACE"], name.contains(trace) {
                func row(_ v: [Double]) -> String { [3, 7, 11, 15, 23].map { $0 < v.count ? String(format: "%.3f", v[$0]) : "-" }.joined(separator: ",") }
                for (t, snap) in frames where t < 120 { for n in snap.nodes { print("TRACE \(tag) native \(String(format: "%+.1f", t)) \(n.id) layer \(String(format: "%.4f", n.layer)) b \(Int((n.border[0] * 255).rounded())) sh \(row(n.shadow))") } }
                for x in all where x["t"].number! - webEnd < 120 { for w in x["nodes"].array { print("TRACE \(tag) chrome \(String(format: "%+.1f", x["t"].number! - webEnd)) \(w["id"].string) layer \(String(format: "%.4f", w["layer"].number!)) b \(Int((nums(w["border"])[0] * 255).rounded())) sh \(row(nums(w["shadow"])))") } }
            }
            for (t, snap) in frames {
                let indices = all.indices.filter { abs((all[$0]["t"].number! - webEnd) - t) <= frame }
                let window = indices.map { all[$0] }
                guard !window.isEmpty else { continue }
                for n in snap.nodes {
                    let ws = window.compactMap { s in s["nodes"].array.first { $0["id"].string == n.id } }
                    guard !ws.isEmpty else { continue }
                    func within(_ mine: Double, _ web: [Double], _ tol: Double) -> Bool { mine >= (web.min() ?? 0) - tol && mine <= (web.max() ?? 0) + tol }
                    var ok = within(n.layer, ws.map { $0["layer"].number! }, 0.006)
                    for c in 0..<3 { ok = ok && within(n.border[c], ws.map { nums($0["border"])[c] }, 0.012) }
                    for k in [3, 7, 11, 15, 23] where k < n.shadow.count { ok = ok && within(n.shadow[k], ws.map { nums($0["shadow"])[k] }, k % 8 == 7 ? 0.012 : 0.1) }
                    motionChecks += 1; if !ok { motionFails += 1 }
                    if !ok && motionFails <= 6 { check(false, "\(tag) \(n.id) frame +\(Int(t)) ms: layer \(n.layer) border \(n.border.prefix(3).map { ($0 * 255).rounded() }) shadow-a \(n.shadow.count > 7 ? n.shadow[7] : 0) outside Chrome \(ws.map { $0["layer"].number! }) \(ws.map { nums($0["border"]).prefix(3).map { ($0 * 255).rounded() } }) \(ws.map { nums($0["shadow"])[7] })") }
                }
                for g in snap.groups {
                    let ws: [[Double]] = indices.flatMap { j -> [[Double]] in
                        var out: [[Double]] = []
                        if let x = all[j]["groups"].array.first(where: { $0["id"].string == g.id }) { out.append([x["opacity"].number!, x["scale"].number!, x["tx"].number!, x["ty"].number!]) }
                        if let x = implicit[j]?[g.id] { out.append(x) }
                        return out
                    }
                    guard !ws.isEmpty else { continue }
                    func within(_ mine: Double, _ web: [Double], _ tol: Double) -> Bool { mine >= (web.min() ?? 0) - tol && mine <= (web.max() ?? 0) + tol }
                    let ok = within(g.opacity, ws.map { $0[0] }, 0.01) && within(g.scale, ws.map { $0[1] }, 0.001)
                        && within(g.tx, ws.map { $0[2] }, 0.1) && within(g.ty, ws.map { $0[3] }, 0.1)
                    motionChecks += 1; if !ok { motionFails += 1 }
                    if !ok && motionFails <= 6 { check(false, "\(tag) group \(g.id) frame +\(Int(t)) ms: opacity \(g.opacity) scale \(g.scale) t \(g.tx),\(g.ty) outside Chrome \(ws.map { $0[0] }) \(ws.map { $0[1] }) \(ws.map { $0[3] })") }
                }
            }
        }
        check(motionFails == 0, "\(name) per-frame motion \(motionChecks - motionFails)/\(motionChecks)")
        // Component events: order, phase and payload (focusin/focusout are the DOM's; focus is checked per phase above).
        let web = r["events"].array.filter { ["mdNodeToggle", "mdSelectionChange"].contains($0["name"].string) }
        let phases = r["phases"].array
        func phaseOf(_ t: Double) -> Int { (phases.lastIndex { $0["t"].number! <= t + 0.5 }) ?? 0 }
        let mine = events.filter { ["mdNodeToggle", "mdSelectionChange"].contains($0.0) }
        check(mine.count == web.count, "\(name) events \(mine.map(\.0)) vs \(web.map(\.["name"].string))")
        for (m, w) in zip(mine, web) {
            let ids = w["selectedIds"].array.map(\.string), myIDs = m.1["selectedIds"].array.map(\.string)
            check(m.0 == w["name"].string && m.2 == phaseOf(w["t"].number!) && m.1["node"]["id"].string == w["node"].string
                  && (w["expanded"] == .null || m.1["expanded"] == w["expanded"]) && (w["selectedIds"] == .null || myIDs == ids),
                  "\(name) event \(m.0) phase \(m.2) node \(m.1["node"]["id"].string) \(m.1["expanded"]) \(myIDs) vs \(w["name"].string) phase \(phaseOf(w["t"].number!)) \(w["node"].string) \(w["expanded"]) \(ids)")
        }
        report.append(["run": name, "phases": phases.count, "motionChecks": motionChecks, "motionFails": motionFails, "settledFails": settledFails, "events": mine.count])
        print("RUN \(name): phases \(phases.count), settled fails \(settledFails), motion \(motionChecks - motionFails)/\(motionChecks), events \(mine.count)/\(web.count)"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: OrgChartStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = value(try! JSONSerialization.jsonObject(with: Data(contentsOf: fixtures.appendingPathComponent("orgchart-web-states.json"))))
        let only = ProcessInfo.processInfo.environment["AWC_ORGCHART_STATES_ONLY"]
        for r in oracle["runs"].array where only.map({ (r["set"].string + "/" + r["name"].string).contains($0) }) ?? true { run(r) }
        if let output = ProcessInfo.processInfo.environment["AWC_ORGCHART_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Org chart native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
extension AWCValue {
    /// A JSON string, or nil for null.
    var stringValue: String? { if case .string(let s) = self { return s }; return nil }
}
