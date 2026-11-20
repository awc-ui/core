import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-navigation-rail interaction states and motion against Chrome (rail-states.html, Mac Chrome 153, full and reduced-motion
// sets): standard rails with all / selected labels × LTR/RTL, icons only, dark, the modal overlay and horizontal bars —
// pointer hover/press/release/leave on a destination (state layer, ripple, activation), Tab into the rail (focus ring and
// layer), the forward arrow, Enter, End, Space, Home, a silent activeIndex write, the toggle (expand, collapse), a
// mid-flight reversal and expand() (the width transition and the destinations' FLIP), Escape and the scrim in a modal:
// the events, every phase's settled state (variant, active, tab stops, focus, rings) and every sampled frame within
// Chrome's frame envelope (rail width, the modal surface, the scrim; per destination the indicator box and colour, state
// layer, icon wrapper, icon colour, label box, colour and opacity).
@Observable final class RailStatesState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var reduced = false
    var width = 420.0
    var height = 560.0
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    let controller = AWCNavigationRailController()
    @ObservationIgnored var events: [(name: String, detail: AWCValue, target: String, phase: String)] = []
    /// When each event reached the host (ms, CACurrentMediaTime): the input-receipt time of a variant change.
    @ObservationIgnored var eventTimes: [(name: String, t: Double)] = []
    @ObservationIgnored var phase = ""
}
struct RailStatesFixture: View {
    let state: RailStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = railStatesInspectionIDs(state.nodes)
        ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" sits above the rail, as #before precedes it.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("B")])).offset(x: 0, y: -10).opacity(0.01)
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in AWCNativeView(node: n) { e in state.events.append((e.name, e.detail, e.nodeID, state.phase)); state.eventTimes.append((e.name, CACurrentMediaTime() * 1000)) } }
                }
                .frame(width: state.width, height: state.height, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 24, y: 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcNavigationRailReducedMotion, state.reduced)
        .awcNavigationRailController(state.controller)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
/// "before", the rails, their toggles and destinations (with their ripples).
func railStatesInspectionIDs(_ nodes: [AWCNode]) -> [String] {
    var out = ["before"]
    for n in nodes { out.append(n.id); out.append(n.id + "-toggle"); for c in n.children { out.append(c.id); out.append(c.id + "-ripple") } }
    return out
}
@main @MainActor enum NativeNavigationRailStatesIntegration {
    static let state = RailStatesState()
    static var host: NSHostingView<RailStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var latencies: [Double] = []
    /// Late starts compensated (ms) and the phases that could have one (a variant change by an input).
    static var stalls: [Double] = [], compensable = 0  // unused since 6-4: the late-start compensation was removed
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.004) { let end = Date().addingTimeInterval(d); repeat {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
        }
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba"), n.count >= 4 { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb"), n.count >= 3 { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count >= 4 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    /// Premultiplied, so a transparent colour compares by its (zero) alpha only.
    static func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) } }
    static var railNode: AWCNode? { state.nodes.first { $0.tag == "md-navigation-rail" } }
    static var tabIDs: [String] { railNode?.children.filter { $0.tag == "md-navigation-rail-tab" }.map(\.id) ?? [] }
    static func center(_ i: Int) -> CGPoint? { m(tabIDs[i], "md-navigation-rail-tab").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func toggleCenter() -> CGPoint? { m(railNode?.id ?? "", "toggle").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// One native frame: rail [host width, surface x, y, w, h, scrim] and per destination [indicator x, y, w, h, colour premultiplied
    /// r, g, b, a, layer, icon wrapper x, y, icon colour r, g, b, a, label x, y, label colour r, g, b, a, label opacity].
    struct Frame { let t: Double; var rail: [Double] = []; var tabs: [Int: (t: Double, v: [Double?])] = [:] }
    static func frame(_ t0: Double) -> Frame {
        var f = Frame(t: now() - t0)
        if let r = m(railNode?.id ?? "", "md-navigation-rail") {
            let h = r.metrics["host"]?.array.compactMap(\.number) ?? [0, 0, 0, 0], c = r.metrics["container"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]
            f.rail = [h.count == 4 ? h[2] : 0] + (c.count == 4 ? [Double(r.bounds.minX) + c[0], Double(r.bounds.minY) + c[1], c[2], c[3]] : [0, 0, 0, 0]) + [r.metrics["scrim"]?.number ?? 0]
        }
        for (i, id) in tabIDs.enumerated() {
            guard let tab = m(id, "md-navigation-rail-tab") else { continue }
            var v = [Double?](repeating: nil, count: 22)
            if let ind = m(id, "indicator") {
                v[0] = Double(ind.bounds.minX); v[1] = Double(ind.bounds.minY); v[2] = Double(ind.bounds.width); v[3] = Double(ind.bounds.height)
                let c = pm(ind.metrics["color"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]); for k in 0..<4 { v[4 + k] = c[k] }
            }
            v[8] = tab.metrics["layerOpacity"]?.number
            if let iw = m(id, "icon-wrapper") { v[9] = Double(iw.bounds.minX); v[10] = Double(iw.bounds.minY) }
            if let icon = m(id, "icon") { let c = icon.metrics["color"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]; for k in 0..<4 { v[11 + k] = c[k] } }
            if let l = m(id, "label") {
                v[15] = Double(l.bounds.minX); v[16] = Double(l.bounds.minY)
                let c = l.metrics["color"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]; for k in 0..<4 { v[17 + k] = c[k] }
                v[21] = l.metrics["opacity"]?.number
            }
            let rt = (tab.metrics["renderTime"]?.number ?? now()) - t0, settled = tab.metrics["animating"]?.bool == false
            f.tabs[i] = (rt < 0 || settled ? f.t : rt, v)
        }
        return f
    }
    static func within(_ vals: [Double], _ w: Double, _ tol: Double) -> Bool {
        vals.contains(where: { abs($0 - w) <= tol }) || (vals.count >= 2 && vals.min()! - tol <= w && w <= vals.max()! + tol)
    }
    static func samples(_ name: String, _ ph: AWCValue, _ frames: [Frame], horizontal: Bool) {
        var compared = 0, met = 0, uncovered = 0, total = 0
        let tol: [Double] = [1.5, 1.5, 1.5, 1.5, 0.03, 0.03, 0.03, 0.03, 0.015, 1.5, 1.5, 0.03, 0.03, 0.03, 0.03, 2.5, 1.5, 0.03, 0.03, 0.03, 0.03, 0.06]
        for s in ph["samples"].array {
            let e = (s["t"].number ?? 0) - (ph["t"].number ?? 0)
            if e < 30 { continue }   // Chrome applies input on its next frames; the native host reacts in the input frame
            func window(_ get: (Frame) -> (Double, [Double?])?) -> [[Double?]] {
                var out: [[Double?]] = [], before = false, after = false
                for f in frames { if let (t, v) = get(f), t >= e - 50, t <= e + 50 { out.append(v); if t <= e + 20 { before = true }; if t >= e - 20 { after = true } } }
                return before && after ? out : []
            }
            // Rail: width (non-modal), the modal surface and the scrim.
            let rw = window { f in f.rail.isEmpty ? nil : (f.t, f.rail.map { Optional($0) }) }
            if rw.isEmpty { uncovered += 1 } else {
                var web: [Double?] = [nil, nil, nil, nil, nil, s["scrim"]["opacity"].number]
                if state.nodes.first?.properties["modal"]?.bool == true {
                    let c = s["container"]["rect"]; web[1] = c["x"].number; web[2] = c["y"].number; web[3] = c["width"].number; web[4] = c["height"].number
                } else if !horizontal { web[0] = s["host"]["width"].number }
                for k in 0..<6 { guard let w = web[k] else { continue }; compared += 1
                    let vals = rw.compactMap { $0[k] }
                    if within(vals, w, k == 5 ? 0.04 : 1.5) { met += 1 } else { check(false, "\(name) \(ph["label"].string) t+\(Int(e)) rail[\(k)] web \(w) native \(vals.map { ($0 * 100).rounded() / 100 })") } }
            }
            for (i, wt) in s["tabs"].array.enumerated() where i < tabIDs.count {
                total += 1
                var web = [Double?](repeating: nil, count: 22)
                if !horizontal {
                    let r = wt["indicator"]["rect"]; web[0] = r["x"].number; web[1] = r["y"].number; web[2] = r["width"].number; web[3] = r["height"].number
                    let c = pm(css(wt["indicator"]["color"].string)); for k in 0..<4 { web[4 + k] = c[k] }
                }
                // Horizontal: Web's [part=state-layer] is display: none (the visible tint is the icon wrapper's ::after, hover and
                // press only), yet the oracle samples its opacity, which carries the :focus-visible rule; the keyboard phases
                // (pointer gone) therefore don't compare it.
                let keyboardPhase = !["hover", "press", "release", "leave"].contains(ph["label"].string)
                if !(horizontal && keyboardPhase) { web[8] = wt["layer"]["opacity"].number }
                if wt["iconWrapper"] != .null { web[9] = wt["iconWrapper"]["x"].number; web[10] = wt["iconWrapper"]["y"].number }
                if wt["icon"] != .null { let c = css(wt["icon"]["color"].string); for k in 0..<4 { web[11 + k] = c[k] } }
                if wt["label"] != .null, wt["label"]["display"].string != "none", (wt["label"]["opacity"].number ?? 0) > 0.01 {
                    web[15] = wt["label"]["rect"]["x"].number; web[16] = wt["label"]["rect"]["y"].number
                    let c = css(wt["label"]["color"].string); for k in 0..<4 { web[17 + k] = c[k] }
                }
                if wt["label"] != .null, wt["label"]["display"].string != "none" { web[21] = wt["label"]["opacity"].number }
                let win = window { f in f.tabs[i].map { ($0.t, $0.v) } }
                // Sparse host frames (the iOS simulator under load): a sample between two native frames more than 40 ms apart has
                // no native evidence (it counts as uncovered; the coverage check bounds how many may be).
                let ts = frames.compactMap { $0.tabs[i]?.t }.sorted()
                if win.isEmpty || { if let p = ts.last(where: { $0 <= e }), let q = ts.first(where: { $0 > e }), q - p > 40, e - p > 8, q - e > 8 { return true }; return false }() { uncovered += 1; continue }
                for k in 0..<22 { guard let w = web[k] else { continue }; compared += 1
                    let vals = win.compactMap { $0[k] }
                    if !vals.isEmpty && within(vals, w, tol[k]) { met += 1 }
                    else { check(false, "\(name) \(ph["label"].string) t+\(Int(e)) tab\(i) [\(k)] web \(w) native \(vals.map { ($0 * 1000).rounded() / 1000 })") } }
            }
        }
        checks += met
        check(uncovered <= max(2, total / 6), "\(name) \(ph["label"].string) native frames cover the samples (\(uncovered) uncovered)")
        report.append(["run": name, "phase": ph["label"].string, "uncovered": uncovered, "samples": ph["samples"].array.count, "compared": compared, "met": met, "frames": frames.count])
    }
    static func snapshot(_ name: String, _ ph: AWCValue, horizontal: Bool) {
        guard let last = ph["samples"].array.last else { return }
        let lbl = "\(name) \(ph["label"].string)"
        let rail = m(railNode?.id ?? "", "md-navigation-rail")
        check(rail?.metrics["variant"]?.string == last["variant"].string, "\(lbl) variant \(rail?.metrics["variant"]?.string ?? "-") vs \(last["variant"].string)")
        check(rail?.metrics["activeIndex"]?.number == last["activeIndex"].number, "\(lbl) activeIndex \(rail?.metrics["activeIndex"]?.number ?? -9) vs \(last["activeIndex"].number ?? -9)")
        for (i, wt) in last["tabs"].array.enumerated() where i < tabIDs.count {
            guard let tab = m(tabIDs[i], "md-navigation-rail-tab") else { check(false, "\(lbl) tab\(i) measured"); continue }
            check((tab.metrics["active"]?.bool ?? false) == (wt["active"] == .bool(true)), "\(lbl) tab\(i) active")
            check((tab.metrics["tabStop"]?.bool ?? false) == (wt["tabindex"].string == "0"), "\(lbl) tab\(i) tab stop \(tab.metrics["tabStop"]?.bool ?? false) vs \(wt["tabindex"].string)")
            if !horizontal {
                let ring = wt["indicator"]["outline"].string.hasPrefix("solid")
                check((tab.metrics["focusVisible"]?.bool ?? false) == ring, "\(lbl) tab\(i) focus ring \(tab.metrics["focusVisible"]?.bool ?? false) vs \(wt["indicator"]["outline"].string)")
            }
            if ph["label"].string == "press" {
                let rip = state.measurements.first { $0.name == "md-ripple" && $0.id.hasPrefix(tabIDs[i] + "-ripple:") }
                let wave = rip?.metrics["waves"]?.number ?? 0
                check((wave > 0) == !wt["waves"].array.isEmpty, "\(lbl) tab\(i) ripple wave \(wave) vs \(wt["waves"].array.count)")
            }
        }
        let f = focusedID()
        switch last["focused"] {
        case .number(let n): check(Int(n) < tabIDs.count && tabIDs[Int(n)] == f, "\(lbl) focus \(f) vs tab\(Int(n))")
        case .string(let s) where s == "md-navigation-rail": check(f == (railNode?.id ?? "") + "-toggle", "\(lbl) focus \(f) vs the toggle")
        default: check(!tabIDs.contains(f), "\(lbl) focus \(f) vs \(last["focused"])")
        }
    }
    /// When Chrome's expand / collapse transitions started in a phase (ms after its start): the rail width, the modal scrim or
    /// a destination's FLIP animation, whichever is first.
    static func clickStart(_ r: AWCValue, _ ph: AWCValue) -> Double? {
        let t = ph["t"].number ?? 0
        return r["anims"].array.compactMap { a -> Double? in
            guard let s = a["startTime"].number, s >= t, s <= t + 300 else { return nil }
            let target = a["target"].string, prop = a["property"].string
            let rail = ["width", "min-width", "max-width"].contains(prop) && target.hasPrefix("md-navigation-rail ")
            let scrim = target.hasSuffix(" scrim") && prop == "opacity"
            let flip = target.hasPrefix("md-navigation-rail-tab[") && target.hasSuffix(" indicator") && prop == "animation"
            return rail || scrim || flip ? s - t : nil
        }.min()
    }
    /// When Chrome's rapid reverse took effect (ms after the phase start): its rail width transition's start in the phase.
    static func reverseStart(_ r: AWCValue, _ ph: AWCValue) -> Double? {
        let t = ph["t"].number ?? 0
        return r["anims"].array.compactMap { a -> Double? in
            guard let s = a["startTime"].number, s >= t + 50, s <= t + 300, a["property"].string == "width", a["target"].string.hasPrefix("md-navigation-rail ") else { return nil }
            return s - t
        }.min()
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = (reduced ? "reduced " : "") + r["name"].string
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(r["nodesJSON"].string.utf8))
        let horizontal = state.nodes.first?.properties["orientation"]?.string == "horizontal"
        state.width = horizontal ? 560 : 420; state.height = horizontal ? 120 : 560
        state.events = []; state.eventTimes = []; state.phase = ""; state.epoch += 1; pump(0.6)
        let phases = r["phases"].array
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            state.phase = lbl
            let lastSample = (ph["samples"].array.last?["t"].number ?? 0) - (ph["t"].number ?? 0)
            let dur = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - (ph["t"].number ?? 0) : max(420, lastSample + 30)
            var pre = frame(now()); for k in pre.tabs.keys { pre.tabs[k] = (-1, pre.tabs[k]!.v) }
            let t0 = now()
            var frames: [Frame] = [pre]
            // The activation input of a variant change (the toggle's or the scrim's release, Escape, collapse()): when it was issued.
            var issue: Double? = nil
            switch lbl {
            case "hover": if let p = center(2) { state.pointer.update(phase: .move, location: p) }
            case "press": if let p = center(2) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
            case "release": if let p = center(2) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
            case "leave": state.pointer.update(phase: .leave)
            case "focus":
                state.pointer.update(phase: .leave); _ = focusView("before")?.requestNativeFocus(); key(48, "\t")
                if state.nodes.first?.properties["expandable"]?.bool == true { pump(0.02); key(48, "\t") }
            case "arrow-forward": if horizontal { if state.rtl { key(123, "\u{F702}") } else { key(124, "\u{F703}") } } else { key(125, "\u{F701}") }
            case "end": key(119, "\u{F72B}")
            case "home": key(115, "\u{F729}")
            case "enter": key(36, "\r")
            case "space": key(49, " ")
            case "programmatic":
                state.nodes = state.nodes.map { n in var n = n; if n.tag == "md-navigation-rail" { n.properties["activeIndex"] = .number(1) }; return n }
            case "toggle-expand", "toggle-collapse":
                if let p = toggleCenter() {
                    // Chrome delivers the trusted mouse input on its next frames: its click lands on the frame the expand / collapse
                    // transitions start (the oracle's recorded start, one or two frames after the phase begins). Click there too.
                    if let start = clickStart(r, ph) { while now() - t0 < start - 10 { pump(0.004); frames.append(frame(t0)) } }
                    state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); pump(0.002); issue = now(); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p)
                }
            case "rapid-reverse":
                // Chrome's collapse() (a 100 ms timeout) took effect on the frame its width transition reversed (the oracle's
                // recorded start, +116.6 ms): call it within the frame before that one, as the toggle's click. A wall-clock
                // 100 ms could land a frame early (n5-054b: the native reversed before Chrome's peak).
                let reverse = reverseStart(r, ph) ?? 100
                state.controller.expand(); let s = now(); while now() - s < reverse - 10 { pump(0.004) }; issue = now(); state.controller.collapse(); print("REVERSE \(name) collapse() at +\(String(format: "%.1f", issue! - s)) ms (Chrome +\(String(format: "%.1f", reverse)))"); fflush(stdout)
            case "method-expand": state.controller.expand()
            case "escape": state.pointer.update(phase: .leave); _ = focusView(tabIDs[0])?.requestNativeFocus(); pump(0.016); issue = now(); key(53, "\u{1B}")
            case "scrim-click":
                let p = CGPoint(x: 380, y: 400)
                // As for the toggle: Chrome's click lands on the frame its collapse transitions start; the release lands there too.
                if let start = clickStart(r, ph) { while now() - t0 < start - 26 { pump(0.004); frames.append(frame(t0)) } }
                state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); pump(0.016); issue = now(); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p)
            default: check(false, "\(name) unknown phase \(lbl)")
            }
            while now() - t0 < dur - 12 { pump(0.004); frames.append(frame(t0)) }
            // Input delivery: AppKit delivers synchronously (the receipt is the issue); the iOS simulator's HID path delivers a
            // touch or key frames later. The phase is timed from the input's receipt (its variant event), as Chrome's is from
            // its own recorded click frame: frames after the receipt move back by the delivery latency, the frames between the
            // issue and the receipt (the unchanged state) sit at the issue.
            if let issue, let receipt = state.eventTimes.first(where: { ["mdExpand", "mdCollapse"].contains($0.name) && $0.t >= issue - 0.5 })?.t, receipt - issue > 0.5 {
                let lat = receipt - issue, i0 = issue - t0, r0 = receipt - t0
                func shift(_ t: Double) -> Double { t >= r0 ? t - lat : t >= i0 ? i0 : t }
                frames = frames.map { f in var g = Frame(t: shift(f.t)); g.rail = f.rail; for (k, v) in f.tabs { g.tabs[k] = (shift(v.t), v.v) }; return g }
                latencies.append(lat)
                if lat > 8 { print("LATENCY \(name) \(lbl) \(String(format: "%.1f", lat)) ms"); fflush(stdout) }
            }
            if let only = ProcessInfo.processInfo.environment["AWC_RAIL_DEBUG"], "\(name) \(lbl)".contains(only) {
                for f in frames.prefix(60) { print("DBG \(name) \(lbl) t \(Int(f.t)) rail \(f.rail.map { Int($0 * 10) }) tab0 rt \(Int(f.tabs[0]?.t ?? -1)) ind \(f.tabs[0]?.v.prefix(4).map { $0.map { Int($0 * 10) } ?? -1 } ?? []) iw \(f.tabs[0]?.v[9].map { Int($0 * 10) } ?? -1)") }
                fflush(stdout)
            }
            snapshot(name, ph, horizontal: horizontal)
            samples(name, ph, frames, horizontal: horizontal)
        }
        // Events: mdTabChange / mdExpand / mdCollapse, and a pointer click on a destination (Web `click`) as its mdTabClick.
        let pointerPhases: Set<String> = ["press", "release"]
        let web = r["events"].array.filter { !($0["name"].string == "click" && $0["target"].string.hasPrefix("md-navigation-rail[")) }
        let native = state.events.filter { ["mdTabChange", "mdExpand", "mdCollapse"].contains($0.name) || ($0.name == "mdTabClick" && pointerPhases.contains($0.phase)) }
        check(native.count == web.count, "\(name) events \(native.map { "\($0.name)@\($0.target)" }) vs \(web.map { "\($0["name"].string)@\($0["target"].string)" })")
        let labels = railNode?.children.filter { $0.tag == "md-navigation-rail-tab" }.map { $0.properties["label"]?.string ?? "" } ?? []
        for (n, w) in zip(native, web) {
            let target = w["target"].string
            let isTab = target.hasPrefix("md-navigation-rail-tab[")
            let wantID = isTab ? tabIDs[labels.firstIndex(of: String(target.dropFirst(23).dropLast())) ?? 0] : (railNode?.id ?? "")
            let wantName = w["name"].string == "click" ? "mdTabClick" : w["name"].string
            check(n.name == wantName && n.target == wantID, "\(name) event \(n.name)@\(n.target) vs \(w["name"].string)@\(target)")
            for k in ["index", "value"] where w["detail"][k] != .null { check(n.detail[k] == w["detail"][k], "\(name) \(n.name).\(k) \(n.detail[k]) vs \(w["detail"][k])") }
        }
        print("RUN \(name): \(checks - failures.count)/\(checks) cumulative"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        // On a display (invisible: alpha 0, click-through): a window outside every display gets no display-link frames.
        #if canImport(AppKit)
        let screen = NSScreen.main?.frame ?? .init(x: 0, y: 0, width: 1440, height: 900)
        #else
        let screen = CGRect(x: 0, y: 0, width: 1440, height: 900)
        #endif
        host = NSHostingView(rootView: RailStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 700), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        #if canImport(AppKit)
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_RAIL_ONLY"]
        for (file, reduced) in [("rail-web-states", false), ("rail-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_RAIL_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        if !latencies.isEmpty { print("input delivery latency (ms): n \(latencies.count) max \(String(format: "%.1f", latencies.max()!)) mean \(String(format: "%.1f", latencies.reduce(0, +) / Double(latencies.count)))") }
        print("Navigation rail native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
