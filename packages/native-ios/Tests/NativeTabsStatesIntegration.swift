import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-tabs interaction states and motion against Chrome (tabs-states.html, Mac Chrome 153, full and reduced-motion sets):
// primary/secondary × LTR/RTL, icons, dark — pointer hover/press/release/leave on a tab (state layer 50 ms, ripple,
// activation with the indicator glide and colour transitions), Tab into the tablist (focus-visible), ArrowRight
// (visual), End, Home (automatic activation) and a programmatic activeTabIndex write (silent; the panels follow):
// the events, every phase's settled state (active, tab stop, focus, ring, panel) and every sampled frame within
// Chrome's frame envelope (host colour, state layer, indicator opacity/translate/scale, icon colour).
@Observable final class TabsStatesState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored var events: [(name: String, detail: AWCValue, target: String)] = []
}
struct TabsStatesFixture: View {
    let state: TabsStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = ["before"] + state.nodes.flatMap { [$0.id] + $0.children.flatMap { [$0.id, $0.id + "-ripple"] } }
        ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" sits above the tablist, as #before precedes it.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("B")])).offset(x: 0, y: -10).opacity(0.05)   // 5 %, not 1 %: the iPad focus engine does not keep focus on a view that faint (gate-7 R6-18, iPad)
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in AWCNativeView(node: n) { e in state.events.append((e.name, e.detail, e.nodeID)) } }
                }
                .frame(width: 480, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 24, y: 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcTabsReducedMotion, state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeTabsStatesIntegration {
    static let state = TabsStatesState()
    static var host: NSHostingView<TabsStatesFixture>!, window: NSWindow!
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
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func matrix(_ t: String) -> (scale: Double, translate: Double) { let n = numbers(t); return t == "none" || n.count < 6 ? (1, 0) : (n[0], n[4]) }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) } }
    static var tabIDs: [String] { state.nodes.first { $0.tag == "md-tabs" }?.children.map(\.id) ?? [] }
    static func center(_ i: Int) -> CGPoint? { m(tabIDs[i], "md-tab").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// One native frame per tab: [r, g, b, a, layer, indicator opacity, translate, scale, icon r, g, b, a] (ms since the action).
    struct Frame { let t: Double; var tabs: [Int: (t: Double, v: [Double])] = [:] }
    static func frame(_ t0: Double) -> Frame {
        var f = Frame(t: now() - t0)
        for (i, id) in tabIDs.enumerated() {
            guard let tab = m(id, "md-tab") else { continue }
            let c = tab.metrics["color"]?.array.compactMap(\.number) ?? [0, 0, 0, 0], ic = tab.metrics["iconColor"]?.array.compactMap(\.number) ?? [0, 0, 0, 0]
            let layer: Double = tab.metrics["layerOpacity"]?.number ?? 0, opacity: Double = tab.metrics["indicatorOpacity"]?.number ?? 0
            let tx: Double = tab.metrics["indicatorTranslate"]?.number ?? 0, sx: Double = tab.metrics["indicatorScale"]?.number ?? 1
            var v: [Double] = c; v.append(contentsOf: [layer, opacity, tx, sx]); v.append(contentsOf: ic)
            // A tab not rendered since the action, or settled at its last render (nothing running), holds that render at this frame.
            let rt = (tab.metrics["renderTime"]?.number ?? now()) - t0, settled = tab.metrics["animating"]?.bool == false
            f.tabs[i] = (rt < 0 || settled ? f.t : rt, v)
        }
        return f
    }
    static func samples(_ name: String, _ ph: AWCValue, _ frames: [Frame], icons: Bool) {
        var compared = 0, met = 0, uncovered = 0, total = 0
        for s in ph["samples"].array {
            let e = (s["t"].number ?? 0) - (ph["t"].number ?? 0)
            // Chrome applies input on its next frames; the native host reacts in the input frame. On the iOS simulator a key
            // reaches the app through the HID queue a frame or two after it is sent, so its first 50 ms are not comparable.
            #if canImport(AppKit)
            if e < 30 { continue }
            #else
            if e < 50 { continue }
            #endif
            for (i, wt) in s["tabs"].array.enumerated() {
                total += 1
                var web = [Double?](repeating: nil, count: 12)
                let c = css(wt["color"].string); for k in 0..<4 { web[k] = c[k] }
                web[4] = wt["layer"]["opacity"].number
                if wt["indicator"] != .null { web[5] = wt["indicator"]["opacity"].number; let mt = matrix(wt["indicator"]["transform"].string); web[6] = mt.translate; web[7] = mt.scale }
                if icons, wt["icon"] != .null { let ic = css(wt["icon"].string); for k in 0..<4 { web[8 + k] = ic[k] } }
                let tol = [0.03, 0.03, 0.03, 0.03, 0.012, 0.07, 2.0, 0.025, 0.03, 0.03, 0.03, 0.03]
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
            guard let tab = m(tabIDs[i], "md-tab") else { check(false, "\(lbl) tab\(i) measured"); continue }
            check((tab.metrics["active"]?.bool ?? false) == (wt["active"] == .bool(true)), "\(lbl) tab\(i) active")
            check((tab.metrics["tabStop"]?.bool ?? false) == (wt["tabindex"].string == "0"), "\(lbl) tab\(i) tab stop")
            check((tab.metrics["focusVisible"]?.bool ?? false) == wt["outline"].string.hasPrefix("solid"), "\(lbl) tab\(i) focus ring \(tab.metrics["focusVisible"]?.bool ?? false) vs \(wt["outline"].string)")
        }
        let tabsID = state.nodes.first { $0.tag == "md-tabs" }?.id ?? ""
        check(m(tabsID, "md-tabs")?.metrics["activeTabIndex"]?.number == last["activeTabIndex"].number, "\(lbl) activeTabIndex \(m(tabsID, "md-tabs")?.metrics["activeTabIndex"]?.number ?? -9) vs \(last["activeTabIndex"].number ?? -9)")
        let f = focusedID(), webFocus = last["focused"].number.map { Int($0) }
        check(webFocus.map { $0 < tabIDs.count && tabIDs[$0] == f } ?? !tabIDs.contains(f), "\(lbl) focus \(f) vs \(String(describing: webFocus))")
        if let panels = state.nodes.first(where: { $0.tag == "md-tab-panels" }), let p = m(panels.id, "md-tab-panels") {
            check(p.metrics["index"]?.number == last["panel"].number, "\(lbl) panel \(p.metrics["index"]?.number ?? -9) vs \(last["panel"].number ?? -9)")
        }
        // A pressed tab shows the md-ripple wave (its own geometry and timing are verified by the md-ripple suite).
        for (i, wt) in last["tabs"].array.enumerated() where i < tabIDs.count && ph["label"].string == "press" {
            let rip = state.measurements.first { $0.name == "md-ripple" && $0.id.hasPrefix(tabIDs[i] + "-ripple:") }
            let wave = rip?.metrics["waves"]?.number ?? 0
            check((wave > 0) == !wt["waves"].array.isEmpty, "\(lbl) tab\(i) ripple wave \(wave) vs \(wt["waves"].array.count) \(rip.map { "\($0.id) \($0.metrics)" } ?? "no md-ripple measurement")")
        }
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = (reduced ? "reduced " : "") + r["name"].string
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(r["nodesJSON"].string.utf8))
        state.events = []; state.epoch += 1; pump(0.6)
        let phases = r["phases"].array
        let icons = r["name"].string.contains("icons")
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            let lastSample = (ph["samples"].array.last?["t"].number ?? 0) - (ph["t"].number ?? 0)
            let dur = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - (ph["t"].number ?? 0) : max(420, lastSample + 30)
            // The state right before the action (Chrome samples can still show it for a frame after the input).
            var pre = frame(now()); for k in pre.tabs.keys { pre.tabs[k] = (-1, pre.tabs[k]!.v) }
            let t0 = now()
            switch lbl {
            case "arm": _ = focusView("before")?.requestNativeFocus(); state.pointer.update(phase: .leave)
            case "hover": if let p = center(2) { state.pointer.update(phase: .move, location: p) }
            case "press": if let p = center(2) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
            case "release": if let p = center(2) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
            case "leave": state.pointer.update(phase: .leave)
            case "focus": _ = focusView("before")?.requestNativeFocus(); key(48, "\t")
            case "arrow-forward": if state.rtl { key(123, "\u{F702}") } else { key(124, "\u{F703}") }
            case "end": key(119, "\u{F72B}")
            case "home": key(115, "\u{F729}")
            case "programmatic":
                state.nodes = state.nodes.map { n in var n = n; if n.tag == "md-tabs" { n.properties["activeTabIndex"] = .number(2) }; return n }
            default: break
            }
            var frames: [Frame] = [pre]
            while now() - t0 < dur - 12 { pump(0.004); frames.append(frame(t0)) }
            snapshot(name, ph)
            samples(name, ph, frames, icons: icons)
        }
        let web = r["events"].array
        check(state.events.count == web.count, "\(name) events \(state.events.map { "\($0.name)@\($0.target)" }) vs \(web.map { "\($0["name"].string)@\($0["target"].string)" })")
        let labels = state.nodes.first { $0.tag == "md-tabs" }?.children.map { $0.properties["label"]?.string ?? "" } ?? []
        for (n, w) in zip(state.events, web) {
            let target = w["target"].string, wantID: String = target.hasPrefix("md-tab[") ? tabIDs[labels.firstIndex(of: String(target.dropFirst(7).dropLast())) ?? 0] : (state.nodes.first { $0.tag == "md-tabs" }?.id ?? "")
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
        host = NSHostingView(rootView: TabsStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        #if canImport(AppKit)
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_TABS_ONLY"]
        for (file, reduced) in [("tabs-web-states", false), ("tabs-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_TABS_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Tabs native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
