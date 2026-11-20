import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-navigation-bar interaction states and motion against Chrome (navbar-states.html, Mac Chrome 153, full and
// reduced-motion sets): automatic and manual activation × LTR/RTL, selected-only labels, dark, soft/hard disabled —
// pointer hover/press/release/leave on a destination (state layer 100 ms ease, ripple, activation with the indicator
// scale, host and label colour transitions), Tab into the bar (focus-visible ring and layer), ArrowRight (visual), Enter,
// Space, End, Home and a programmatic activeIndex write (clamped, announced): the events, every phase's settled state
// (active, tab stop, focus, ring, wave) and every sampled frame within Chrome's frame envelope.
@Observable final class NavigationBarStatesState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored var events: [(name: String, detail: AWCValue, target: String)] = []
}
struct NavigationBarStatesFixture: View {
    let state: NavigationBarStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = ["before"] + state.nodes.flatMap { [$0.id] + $0.children.flatMap { [$0.id, $0.id + "-ripple"] } }
        ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" sits above the bar, as #before precedes it.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("B")])).offset(x: 0, y: -10).opacity(0.05)   // 5 %, not 1 %: the iPad focus engine does not keep focus on a view that faint (gate-7 R6-18, iPad)
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in AWCNativeView(node: n) { e in state.events.append((e.name, e.detail, e.nodeID)) } }
                }
                .frame(width: 412, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 24, y: 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcNavigationBarReducedMotion, state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeNavigationBarStatesIntegration {
    static let state = NavigationBarStatesState()
    static var host: NSHostingView<NavigationBarStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
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
        return [0, 0, 0, 0]
    }
    static func scaleOf(_ t: String) -> Double { let n = numbers(t); return t == "none" || n.count < 6 ? 1 : n[0] }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) } }
    static var barNode: AWCNode? { state.nodes.first { $0.tag == "md-navigation-bar" } }
    static var tabIDs: [String] { barNode?.children.map(\.id) ?? [] }
    static func center(_ i: Int) -> CGPoint? { m(tabIDs[i], "md-navigation-tab").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// One native frame per tab: [host r, g, b, a, layer, indicator opacity, indicator scale, label r, g, b, a, label opacity] (ms since the action).
    struct Frame { let t: Double; var tabs: [Int: (t: Double, v: [Double])] = [:] }
    static func frame(_ t0: Double) -> Frame {
        var f = Frame(t: now() - t0)
        for (i, id) in tabIDs.enumerated() {
            guard let tab = m(id, "md-navigation-tab") else { continue }
            let c = tab.metrics["color"]?.array.compactMap(\.number) ?? [0, 0, 0, 0], lc = tab.metrics["labelColor"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]
            var v: [Double] = c
            v.append(contentsOf: [tab.metrics["layerOpacity"]?.number ?? 0, tab.metrics["indicatorOpacity"]?.number ?? 0, tab.metrics["indicatorScale"]?.number ?? 0])
            v.append(contentsOf: lc); v.append(tab.metrics["labelOpacity"]?.number ?? 1)
            // A tab not rendered since the action, or settled at its last render (nothing running), holds that render at this frame.
            let rt = (tab.metrics["renderTime"]?.number ?? now()) - t0, settled = tab.metrics["animating"]?.bool == false
            f.tabs[i] = (rt < 0 || settled ? f.t : rt, v)
        }
        return f
    }
    static func samples(_ name: String, _ ph: AWCValue, _ frames: [Frame]) {
        var compared = 0, met = 0, uncovered = 0, total = 0
        for s in ph["samples"].array {
            let e = (s["t"].number ?? 0) - (ph["t"].number ?? 0)
            if e < 30 { continue }   // Chrome applies input on its next frames; the native host reacts in the input frame
            for (i, wt) in s["tabs"].array.enumerated() where i < tabIDs.count {
                total += 1
                var web = [Double?](repeating: nil, count: 12)
                let c = css(wt["icon"]["color"].string); for k in 0..<4 { web[k] = c[k] }
                web[4] = wt["layer"]["opacity"].number
                if wt["indicator"] != .null { web[5] = wt["indicator"]["opacity"].number; web[6] = scaleOf(wt["indicator"]["transform"].string) }
                if wt["label"] != .null { let lc = css(wt["label"]["color"].string); for k in 0..<4 { web[7 + k] = lc[k] }; web[11] = wt["label"]["opacity"].number }
                let tol = [0.03, 0.03, 0.03, 0.03, 0.012, 0.07, 0.025, 0.03, 0.03, 0.03, 0.03, 0.07]
                var window: [[Double]] = [], before = false, after = false
                for f in frames { if let v = f.tabs[i], v.t >= e - 50, v.t <= e + 50 { window.append(v.v); if v.t <= e + 20 { before = true }; if v.t >= e - 20 { after = true } } }
                if !(before && after) { window = [] }
                // Sparse host frames (the iOS simulator under load): a sample between two native frames more than 40 ms apart
                // has no native evidence (it counts as uncovered; the coverage check bounds how many may be).
                let ts = frames.compactMap { $0.tabs[i]?.t }.sorted()
                if let p = ts.last(where: { $0 <= e }), let q = ts.first(where: { $0 > e }), q - p > 40, e - p > 8, q - e > 8 { window = [] }
                guard !window.isEmpty else { uncovered += 1; continue }
                for k in 0..<12 { guard let w = web[k] else { continue }; compared += 1
                    let vals = window.map { $0[k] }
                    if vals.contains(where: { abs($0 - w) <= tol[k] }) || (vals.min()! - tol[k] <= w && w <= vals.max()! + tol[k] && vals.count >= 2) { met += 1 }
                    else { check(false, "\(name) \(ph["label"].string) t+\(Int(e)) tab\(i) [\(k)] web \(w) native \(vals.map { ($0 * 1000).rounded() / 1000 })") } }
            }
        }
        checks += met
        check(uncovered <= max(2, total / 6), "\(name) \(ph["label"].string) native frames cover the samples (\(uncovered) uncovered)")
        report.append(["run": name, "phase": ph["label"].string, "uncovered": uncovered, "samples": ph["samples"].array.count, "compared": compared, "met": met, "frames": frames.count])
    }
    static func snapshot(_ name: String, _ ph: AWCValue) {
        guard let last = ph["samples"].array.last else { return }
        let lbl = "\(name) \(ph["label"].string)"
        for (i, wt) in last["tabs"].array.enumerated() where i < tabIDs.count {
            guard let tab = m(tabIDs[i], "md-navigation-tab") else { check(false, "\(lbl) tab\(i) measured"); continue }
            check((tab.metrics["active"]?.bool ?? false) == (wt["active"] == .bool(true)), "\(lbl) tab\(i) active")
            check((tab.metrics["tabStop"]?.bool ?? false) == (wt["tabindex"].string == "0"), "\(lbl) tab\(i) tab stop")
            check((tab.metrics["focusVisible"]?.bool ?? false) == (wt["ring"] != .null), "\(lbl) tab\(i) focus ring \(tab.metrics["focusVisible"]?.bool ?? false) vs \(wt["ring"])")
            if (wt["layer"]["opacity"].number ?? 0) > 0.01 {
                let lc = css(wt["layer"]["color"].string), n = tab.metrics["layerColor"]?.array.compactMap(\.number) ?? []
                check(n.count == 4 && (0..<3).allSatisfy { abs(n[$0] - lc[$0]) <= 0.02 }, "\(lbl) tab\(i) layer colour \(n) vs \(wt["layer"]["color"].string)")
            }
        }
        let bar = m(barNode?.id ?? "", "md-navigation-bar")
        check(bar?.metrics["activeIndex"]?.number == last["activeIndex"].number, "\(lbl) activeIndex \(bar?.metrics["activeIndex"]?.number ?? -9) vs \(last["activeIndex"].number ?? -9)")
        let f = focusedID(), webFocus = last["focused"].number.map { Int($0) }
        check(webFocus.map { $0 < tabIDs.count && tabIDs[$0] == f } ?? !tabIDs.contains(f), "\(lbl) focus \(f) vs \(String(describing: webFocus))")
        // A pressed destination shows the md-ripple wave (its own geometry and timing are verified by the md-ripple suite).
        for (i, wt) in last["tabs"].array.enumerated() where i < tabIDs.count && ph["label"].string == "press" {
            let rip = state.measurements.first { $0.name == "md-ripple" && $0.id.hasPrefix(tabIDs[i] + "-ripple:") }
            let wave = rip?.metrics["waves"]?.number ?? 0
            check((wave > 0) == !wt["waves"].array.isEmpty, "\(lbl) tab\(i) ripple wave \(wave) vs \(wt["waves"].array.count)")
        }
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = (reduced ? "reduced " : "") + r["name"].string
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(r["nodesJSON"].string.utf8))
        state.events = []; state.epoch += 1; pump(0.6)
        let phases = r["phases"].array
        // The pointer target: the soft-disabled destination in the soft-disabled run, else the third.
        let target = r["name"].string.hasPrefix("soft") ? 1 : 2
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            let lastSample = (ph["samples"].array.last?["t"].number ?? 0) - (ph["t"].number ?? 0)
            let dur = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - (ph["t"].number ?? 0) : max(420, lastSample + 30)
            var pre = frame(now()); for k in pre.tabs.keys { pre.tabs[k] = (-1, pre.tabs[k]!.v) }
            let t0 = now()
            switch lbl {
            case "hover", "hover-soft": if let p = center(target) { state.pointer.update(phase: .move, location: p) }
            #if os(iOS)
            // iOS harness: the host pointer changes when UIKit delivers the touch (see AWCShimTouch.pointerDown); at queue time it
            // led the touch by the delivery latency, so the press state layer started early, more so under load (gate-7 R6-16).
            case "press": if let p = center(target) { AWCShimTouch.pointerDown({ state.pointer.update(phase: .down, location: p) }) { mouse(.leftMouseDown, p) } }
            case "release": if let p = center(target) { AWCShimTouch.pointerUp({ state.pointer.update(phase: .up, location: p) }) { mouse(.leftMouseUp, p) } }
            case "click-soft": if let p = center(target) { AWCShimTouch.pointerDown({ state.pointer.update(phase: .down, location: p) }) { mouse(.leftMouseDown, p) }; pump(0.016); AWCShimTouch.pointerUp({ state.pointer.update(phase: .up, location: p) }) { mouse(.leftMouseUp, p) } }
            #else
            case "press": if let p = center(target) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
            case "release": if let p = center(target) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
            case "click-soft": if let p = center(target) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); pump(0.016); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
            #endif
            case "leave": state.pointer.update(phase: .leave)
            case "focus": state.pointer.update(phase: .leave); _ = focusView("before")?.requestNativeFocus(); key(48, "\t")
            case "arrow-forward": if state.rtl { key(123, "\u{F702}") } else { key(124, "\u{F703}") }
            case "end": key(119, "\u{F72B}")
            case "home": key(115, "\u{F729}")
            case "enter": key(36, "\r")
            case "space": key(49, " ")
            case "programmatic":
                state.nodes = state.nodes.map { n in var n = n; if n.tag == "md-navigation-bar" { n.properties["activeIndex"] = .number(1) }; return n }
            default: check(false, "\(name) unknown phase \(lbl)")
            }
            var frames: [Frame] = [pre]
            while now() - t0 < dur - 12 { pump(0.004); frames.append(frame(t0)) }
            snapshot(name, ph)
            samples(name, ph, frames)
        }
        let web = r["events"].array
        check(state.events.count == web.count, "\(name) events \(state.events.map { "\($0.name)@\($0.target)" }) vs \(web.map { "\($0["name"].string)@\($0["target"].string)" })")
        let labels = barNode?.children.map { $0.properties["label"]?.string ?? "" } ?? []
        for (n, w) in zip(state.events, web) {
            let target = w["target"].string
            let wantID: String = target.hasPrefix("md-navigation-tab[") ? tabIDs[labels.firstIndex(of: String(target.dropFirst(18).dropLast())) ?? 0] : (barNode?.id ?? "")
            check(n.name == w["name"].string && n.target == wantID, "\(name) event \(n.name)@\(n.target) vs \(w["name"].string)@\(target)")
            for k in ["index", "previousIndex"] where w["detail"][k] != .null { check(n.detail[k] == w["detail"][k], "\(name) \(n.name).\(k) \(n.detail[k]) vs \(w["detail"][k])") }
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
        host = NSHostingView(rootView: NavigationBarStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        #if canImport(AppKit)
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_NAVBAR_ONLY"]
        for (file, reduced) in [("navbar-web-states", false), ("navbar-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_NAVBAR_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Navigation bar native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
