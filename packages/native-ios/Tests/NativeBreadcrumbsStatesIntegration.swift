import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-breadcrumbs interaction states and motion against Chrome (breadcrumbs/states.html, Mac Chrome 153, full and
// reduced-motion sets): the staggered entrance, pointer hover/press/release/leave on links (both themes and directions,
// every hook, a disabled and the current crumb), keyboard Tab/Shift+Tab/Enter, the overflow toggle by pointer and by
// keyboard (reveal entrance, focus target), expand()/collapse(), mdSelect cancel/navigate and runtime property changes:
// settled phase snapshots, the events, and every sampled frame within Chrome's frame envelope.
@Observable final class BreadcrumbsStatesState {
    var epoch = 0
    var trail = AWCNode(id: "trail", tag: "md-breadcrumbs")
    var dark = false
    var rtl = false
    var reduced = false
    var appearance = AWCBreadcrumbsAppearance()
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored var cancel = true
    @ObservationIgnored var events: [(name: String, detail: AWCValue, target: String, prevented: Bool, cancelable: Bool)] = []
    @ObservationIgnored var routes: [String] = []
}
let statesController = AWCBreadcrumbsController()
struct BreadcrumbsStatesFixture: View {
    let state: BreadcrumbsStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" sits above the trail, as #before precedes it in the DOM.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 900, y: 4)
            VStack(alignment: .leading, spacing: 40) {
                AWCNativeView(node: state.trail).frame(width: 760, alignment: .topLeading)
                AWCNativeView(node: AWCNode(id: "after", tag: "md-button", properties: [:], children: [.text("After")]))
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 60, y: 60)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcBreadcrumbsReducedMotion, state.reduced)
        .environment(\.awcEventDispatcher, AWCEventDispatcher(id: "page") { ctx in
            if ctx.event.name == "mdSelect" && state.cancel { ctx.preventDefault() }
            state.events.append((ctx.event.name, ctx.event.detail, ctx.event.nodeID, ctx.defaultPrevented, ctx.cancelable))
        })
        .awcURLRouter(AWCURLRouter(baseURL: URL(string: "https://example.test/states")) { request in state.routes.append("#" + (request.url.fragment ?? "")); return true })
        .awcBreadcrumbsAppearance(state.appearance).awcBreadcrumbsController(statesController)
        .awcTheme(theme)
        .awcNativeInspection(rootID: (["trail"] + state.trail.children.map(\.id)).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeBreadcrumbsStatesIntegration {
    static let state = BreadcrumbsStatesState()
    static var host: NSHostingView<BreadcrumbsStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static var pumpParts: [String: Double] = [:], slow: [String] = []
    static func pump(_ d: Double = 0.004) { let end = Date().addingTimeInterval(d); repeat {
        // The fixture sends its input straight to the window (window.sendEvent); the AppKit event queue is not drained:
        // NSApp.nextEvent spins the run loop and blocks for a whole running transition (~350 ms) on the test host.
        var t = now()
        pumpParts["events", default: 0] += now() - t
        t = now(); host.layoutSubtreeIfNeeded(); pumpParts["layout", default: 0] += now() - t
        t = now(); host.displayIfNeeded(); pumpParts["display", default: 0] += now() - t
        t = now(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)); pumpParts["runloop", default: 0] += now() - t } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp || kind == .mouseMoved ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String, shift: Bool = false) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            window.sendEvent(e)
        }
    }
    static let away = CGPoint(x: 1190, y: 600)
    /// Hover follows the host pointer state (as in the Laboratory); a synthesized mouseMoved stalls the offscreen window.
    static func hoverTo(_ p: CGPoint) { state.pointer.update(phase: .move, location: p) }
    static func down(_ p: CGPoint) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
    static func up(_ p: CGPoint) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    static func leave() { state.pointer.update(phase: .leave) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func value(_ a: Any) -> AWCValue {
        if let d = a as? [String: Any] { return .object(d.mapValues(value)) }
        if let arr = a as? [Any] { return .array(arr.map(value)) }
        if let str = a as? String { return .string(str) }
        if let n = a as? NSNumber { return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue) }
        return .null
    }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    /// CSS colour → straight sRGB components and alpha (rgb/rgba/color(srgb …)).
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba"), n.count >= 4 { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb"), n.count >= 3 { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func alpha(_ s: String) -> Double { s.hasPrefix("oklab") ? (numbers(s).count > 3 ? numbers(s)[3] : 1) : css(s)[3] }
    static func colorClose(_ a: [Double]?, _ web: String, _ tol: Double = 0.014) -> Bool {
        guard let a, a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func translateX(_ t: String) -> Double { t == "none" || t.isEmpty ? 0 : (numbers(t).count >= 6 ? numbers(t)[4] : 0) }
    static func scaleOf(_ t: String) -> Double { t == "none" || t.isEmpty ? 1 : numbers(t).first ?? 1 }
    static func appearance(_ hooks: AWCValue) -> AWCBreadcrumbsAppearance {
        guard case .object(let o) = hooks else { return .init() }
        func s(_ k: String) -> String? { o[k]?.string }
        func px(_ v: String) -> Double { Double(v.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "")) ?? 0 }
        func n(_ k: String) -> Double? { s(k).map(px) }
        return .init(gap: n("--md-breadcrumbs-gap"), separatorColor: s("--md-breadcrumbs-separator-color"), textColor: s("--md-breadcrumbs-text-color"), stagger: n("--md-breadcrumbs-stagger"),
                     linkColor: s("--md-breadcrumb-item-link-color"), currentColor: s("--md-breadcrumb-item-current-color"), currentBackground: s("--md-breadcrumb-item-current-bg"),
                     disabledColor: s("--md-breadcrumb-item-disabled-color"), hoverColor: s("--md-breadcrumb-item-hover-color"), stateLayerColor: s("--md-breadcrumb-item-state-layer-color"),
                     itemGap: n("--md-breadcrumb-item-gap"), itemPadding: s("--md-breadcrumb-item-padding").map { numbers($0) })
    }
    static let TRAIL: [AWCValue] = [["id": "home", "href": "#home", "icon": "home", "label": "Home"], ["id": "lib", "href": "#library", "label": "Library"], ["id": "docs", "href": "#documents", "label": "Documents"], ["id": "page", "label": "Quarterly report"]].map { .object($0.mapValues { .string($0) }) }
    static func crumb(_ it: AWCValue) -> AWCNode {
        var ip: [String: AWCValue] = [:]
        for k in ["href", "icon", "current", "disabled", "density", "target", "rel", "hidden"] where it[k] != .null { ip[k] = it[k] }
        return AWCNode(id: it["id"].string, tag: "md-breadcrumb-item", properties: ip, children: [.text(it["label"].string)])
    }
    static func trail(_ r: AWCValue, _ items: [AWCValue]) -> AWCNode {
        var p: [String: AWCValue] = [:]
        for (k, key) in [("label", "label"), ("expandLabel", "expandLabel"), ("separator", "separator"), ("maxItems", "maxItems"), ("before", "itemsBeforeCollapse"), ("after", "itemsAfterCollapse"), ("density", "density")] where r[k] != .null { p[key] = r[k] }
        return AWCNode(id: "trail", tag: "md-breadcrumbs", properties: p, children: items.map(crumb))
    }
    static func setTrail(_ change: (inout [String: AWCValue], inout [AWCNode]) -> Void) {
        var p = state.trail.properties, c = state.trail.children; change(&p, &c)
        state.trail = AWCNode(id: "trail", tag: "md-breadcrumbs", properties: p, children: c)
    }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) }
    }
    static func center(_ id: String) -> CGPoint? { m(id, "surface").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func toggleCenter() -> CGPoint? { state.measurements.first { $0.name == "overflow-button" }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// One native frame: per crumb [r, g, b, a, layer, nudge, opacity, slide] (elapsed ms since the action, and since its entrance start), toggle [layer, scale].
    struct Frame { let t: Double; var crumbs: [String: (t: Double, te: Double, v: [Double])] = [:]; var toggle: [Double]?; var homeX: Double? }
    static func frame(_ t0: Double) -> Frame {
        var f = Frame(t: now() - t0)
        for item in state.measurements where item.name == "md-breadcrumb-item" {
            let id = String(item.id.split(separator: ":").first ?? "")
            guard let s = state.measurements.first(where: { $0.name == "surface" && $0.id.hasPrefix(id) }) else { continue }
            let ink = s.metrics["inkNow"]?.array.compactMap(\.number) ?? []
            let rt = item.metrics["renderTime"]?.number ?? now()
            let layer: Double = s.metrics["layerNow"]?.number ?? 0, nudge: Double = s.metrics["nudgeNow"]?.number ?? 0
            let opacity: Double = item.metrics["opacity"]?.number ?? 1, slide: Double = item.metrics["slide"]?.number ?? 0
            let start: Double = item.metrics["entranceStart"]?.number ?? -1e9
            let values: [Double] = ink + [layer, nudge, opacity, slide]
            f.crumbs[id] = (t: rt - t0, te: rt - start, v: values)
        }
        if let s = state.measurements.first(where: { $0.name == "surface" && $0.id.hasPrefix("home") }) { f.homeX = Double(s.bounds.minX) }
        if let b = state.measurements.first(where: { $0.name == "overflow-button" }) { f.toggle = [b.metrics["layerNow"]?.number ?? 0, b.metrics["scaleNow"]?.number ?? 1] }
        return f
    }
    static func snapshot(_ name: String, _ snap: AWCValue, frames: [Frame] = [], at end: Double = 0) {
        for it in snap["items"].array {
            let id = it["id"].string, item = m(id, "md-breadcrumb-item")
            if it["display"].string == "none" { check(item == nil || item!.bounds.width < 0.5, "\(name) \(id) hidden"); continue }
            guard let item else { check(false, "\(name) \(id) shown"); continue }
            check((item.metrics["current"]?.bool ?? false) == (it["current"] == .bool(true)), "\(name) \(id) current")
            // An entrance still running at the shot: the native frame at the shot time (the loop may overrun it).
            let shotOpacity = frames.last { ($0.crumbs[id]?.t ?? .infinity) <= end - 5 }?.crumbs[id]?.v[6] ?? item.metrics["opacity"]?.number ?? 1
            check(abs(shotOpacity - (it["opacity"].number ?? 1)) <= 0.12, "\(name) \(id) opacity \(shotOpacity) vs \(it["opacity"].number ?? .nan)")
            guard let s = m(id, "surface"), it["surface"] != .null else { continue }
            let ws = it["surface"]
            check(colorClose(s.metrics["color"]?.array.compactMap(\.number), ws["color"].string), "\(name) \(id) colour \(s.metrics["color"]?.array.compactMap(\.number) ?? []) vs \(ws["color"].string)")
            check(abs((s.metrics["nudgeNow"]?.number ?? 0) - translateX(ws["transform"].string)) <= 0.3, "\(name) \(id) nudge \(s.metrics["nudgeNow"]?.number ?? .nan) vs \(ws["transform"].string)")
            check((s.metrics["focusRing"]?.bool ?? false) == (ws["outlineStyle"].string == "solid"), "\(name) \(id) focus ring")
            if it["layer"] != .null { check(abs((s.metrics["layerOpacity"]?.number ?? -1) - (it["layer"]["opacity"].number ?? 0)) <= 0.011, "\(name) \(id) layer \(s.metrics["layerOpacity"]?.number ?? .nan) vs \(it["layer"]["opacity"].number ?? .nan)") }
            if it["glyph"] != .null, let icon = m(id, "icon") { check((icon.metrics["fill"]?.number ?? -1) == (it["glyph"].string.contains("\"FILL\" 1") ? 1 : 0), "\(name) \(id) icon fill") }
            let sep = m(id, "separator")
            check((sep != nil) == (it["separator"] != .null), "\(name) \(id) separator presence")
            if let sep, it["separator"] != .null { check(sep.metrics["text"]?.string == it["separator"]["text"].string, "\(name) \(id) separator text \(sep.metrics["text"]?.string ?? "") vs \(it["separator"]["text"].string)") }
        }
        let ov = snap["overflow"], btn = state.measurements.first { $0.name == "overflow-button" }
        check((btn != nil) == (ov != .null), "\(name) toggle presence")
        if let btn, ov != .null {
            check(abs((btn.metrics["layerOpacity"]?.number ?? -1) - alpha(ov["backgroundColor"].string)) <= 0.011, "\(name) toggle layer \(btn.metrics["layerOpacity"]?.number ?? .nan) vs \(ov["backgroundColor"].string)")
            check(abs((btn.metrics["scaleNow"]?.number ?? 0) - scaleOf(ov["transform"].string)) <= 0.006, "\(name) toggle scale \(btn.metrics["scaleNow"]?.number ?? .nan) vs \(ov["transform"].string)")
            check((btn.metrics["focusRing"]?.bool ?? false) == (ov["outlineStyle"].string == "solid"), "\(name) toggle focus ring")
        }
        let trailNode = state.measurements.first { $0.name == "md-breadcrumbs" }
        if snap["hash"].string != "" { check(state.routes.last == snap["hash"].string, "\(name) navigated \(state.routes) vs \(snap["hash"].string)") }
        _ = trailNode
    }
    /// Every web sample must be met by a native frame of the same elapsed time (± the Chrome frame envelope).
    static func samples(_ name: String, _ ph: AWCValue, _ frames: [Frame], entranceAligned: Bool, skip: Set<String> = []) {
        let samples = ph["samples"].array; guard !samples.isEmpty else { return }
        var webStart = 0.0
        if entranceAligned {
            // The web entrance starts on the frame after insertion: recover its start from the first crumb (delay 0).
            for s in samples { if let h = s["items"].array.first, let o = h["opacity"].number, o > 0.02, o < 0.95 {
                var lo = 0.0, hi = 500.0
                for _ in 0..<40 { let mid = (lo + hi) / 2; if AWCNativeButtonTiming.cubic(mid / 500, x1: 0.38, y1: 1.21, x2: 0.22, y2: 1) < o { lo = mid } else { hi = mid } }
                webStart = (s["t"].number ?? 0) - lo; break } }
        }
        var compared = 0, met = 0, uncovered = 0, total = 0, missing: [String: [Int]] = [:]
        for s in samples {
            let e = (s["t"].number ?? 0) - (entranceAligned ? webStart : (ph["t"].number ?? 0))
            if !entranceAligned && e < 30 { continue }   // Chrome applies input on its next frames; the native host reacts in the input frame
            for it in s["items"].array where it["display"].string != "none" && !skip.contains(it["id"].string) {
                let id = it["id"].string; total += 1
                var web = [Double?](repeating: nil, count: 8)
                web[6] = it["opacity"].number; web[7] = translateX(it["transform"].string)
                if it["surface"] != .null { let c = css(it["surface"]["color"].string); web[0] = c[0]; web[1] = c[1]; web[2] = c[2]; web[3] = c[3]; web[5] = translateX(it["surface"]["transform"].string) }
                if it["layer"] != .null { web[4] = it["layer"]["opacity"].number }
                let tol = [0.03, 0.03, 0.03, 0.03, 0.012, 0.35, 0.07, 0.6]
                // The native value interpolated at the web time between the nearest frames on either side (≤ 100 ms apart):
                // sparse host frames (first frames after an insert) still bound the motion.
                var prev: (Double, [Double])?, next: (Double, [Double])?
                for f in frames { if let c = f.crumbs[id] { let te: Double = entranceAligned ? c.te : c.t
                    if te <= e { prev = (te, c.v) } else if next == nil { next = (te, c.v) } } }
                // A late first host frame after an insert: the entrance starts from opacity 0 and its initial slide
                // (opacity and slide share the curve, so the start slide is slide / (1 − opacity)).
                if entranceAligned, prev == nil, let n = next, n.1.count == 8, n.1[6] < 0.98 { var v = n.1; v[6] = 0; v[7] = n.1[7] / (1 - n.1[6]); prev = (0, v) }
                var window: [[Double]] = [], before = false, after = false
                for f in frames { if let c = f.crumbs[id] { let te: Double = entranceAligned ? c.te : c.t
                    if te >= e - 50 && te <= e + 50 { window.append(c.v); if te <= e + 20 { before = true }; if te >= e - 20 { after = true } } } }
                if !(before && after) { window = [] }
                guard !window.isEmpty else { uncovered += 1; missing[id, default: []].append(Int(e)); continue }
                for k in 0..<8 { guard let w = web[k] else { continue }; compared += 1
                    let vals = window.filter { $0.count == 8 }.map { $0[k] }
                    var interpolated: Double?
                    if let p = prev, let n = next, n.0 - p.0 <= 100, p.1.count == 8, n.1.count == 8 { let f = n.0 > p.0 ? (e - p.0) / (n.0 - p.0) : 0; interpolated = p.1[k] + (n.1[k] - p.1[k]) * f }
                    if vals.contains(where: { abs($0 - w) <= tol[k] }) || (vals.min()! - tol[k] <= w && w <= vals.max()! + tol[k] && vals.count >= 2) || interpolated.map({ abs($0 - w) <= tol[k] }) == true { met += 1 }
                    else { check(false, "\(name) \(ph["label"].string) t+\(Int(e)) \(id) [\(k)] web \(w) native \(window.map { $0.count == 8 ? $0[k] : .nan })") } }
            }
            if s["overflow"] != .null {
                let web = [alpha(s["overflow"]["backgroundColor"].string), scaleOf(s["overflow"]["transform"].string)]
                let window = frames.filter { $0.t >= e - 50 && $0.t <= e + 50 }.compactMap(\.toggle)
                guard !window.isEmpty else { continue }
                for k in 0..<2 { compared += 1
                    if window.contains(where: { abs($0[k] - web[k]) <= (k == 0 ? 0.012 : 0.008) }) { met += 1 }
                    else { check(false, "\(name) \(ph["label"].string) t+\(Int(e)) toggle [\(k)] web \(web[k]) native \(window.map { $0[k] })") } }
            }
        }
        checks += met
        check(uncovered <= max(2, total / 6), "\(name) native frames cover the samples (\(uncovered) uncovered)")
        report.append(["run": name, "phase": ph["label"].string, "uncovered": uncovered, "samples": samples.count, "compared": compared, "met": met, "frames": frames.count, "missing": missing.mapValues { $0.map(String.init).joined(separator: ",") }, "frameTimes": frames.prefix(40).map { Int($0.t) }])
    }
    /// AppKit orders the key-view loop by the views' layout direction; UIKit's sequential focus follows the SwiftUI
    /// environment's layout direction (set by the fixture), so there is nothing to mirror on iOS.
    static func layoutDirection(_ rtl: Bool, recalc: Bool = false) {
        #if canImport(AppKit)
        for v in all(host) { v.userInterfaceLayoutDirection = rtl ? .rightToLeft : .leftToRight }
        if recalc { window.recalculateKeyViewLoop() }
        #endif
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = (reduced ? "reduced " : "") + r["name"].string, scenario = r["scenario"].string
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.appearance = appearance(r["hooks"]); state.cancel = r["cancel"] != .bool(false)
        leave(); _ = window.makeFirstResponder(nil)
        layoutDirection(false)
        let items = r["items"].array.isEmpty ? TRAIL : r["items"].array
        let full = trail(r, items)
        state.events = []; state.routes = []
        if scenario == "entrance" { state.trail = AWCNode(id: "trail", tag: "md-breadcrumbs"); state.epoch += 1; pump(0.3) }
        else { state.trail = full; state.epoch += 1; pump(1.1) }
        if scenario != "entrance" {
            let rest = state.measurements.first { $0.name == "md-breadcrumbs" }, wr = r["rest"]
            check(rest != nil && abs(rest!.bounds.minX - (wr["x"].number ?? 0)) < 1 && abs(rest!.bounds.minY - (wr["y"].number ?? 0)) < 1, "\(name) trail at rest \(String(describing: rest?.bounds))")
        }
        let phases = r["phases"].array
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            // Tab past the end of the page wraps to the browser's first control (#before); outside the component contract.
            let active = ph["snap"]["active"].string
            if active.hasPrefix("button#before") || (active == "body" && i > 0 && lbl.hasPrefix("tab")) { report.append(["run": name, "phase": lbl, "skipped": "document focus wrap"]); break }
            let lastSample = (ph["samples"].array.last?["t"].number ?? 0) - (ph["t"].number ?? 0)
            let dur = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - (ph["t"].number ?? 0) : max(420, lastSample + 30)
            if (scenario == "keyboard" || scenario == "overflowKeyboard") && i == 0 {
                // AppKit orders the key-view loop by the layout direction of the views (an RTL system lays rows out right to left).
                layoutDirection(state.rtl, recalc: true)
                state.pointer.update(phase: .leave); _ = focusView("before")?.requestNativeFocus(); pump(0.05)
            }
            let t0 = now()
            switch (scenario, lbl) {
            case ("entrance", _): state.trail = full
            case ("pointer", "hover"), ("select", "click"): if let p = center(r["target"].string) { hoverTo(p); if lbl == "click" { down(p); pump(0.016); up(p) } }
            case ("pointer", "press"): if let p = center(r["target"].string) { down(p) }
            case ("pointer", "release"): if let p = center(r["target"].string) { up(p) }
            case ("overflowPointer", "hover"): if let p = toggleCenter() { hoverTo(p) }
            case ("overflowPointer", "press"): if let p = toggleCenter() { down(p) }
            case ("overflowPointer", "release"): if let p = state.pointer.location { up(p) }
            case (_, "leave"): leave()
            case (_, let l) where l.hasPrefix("tab"): key(48, "\t")
            case (_, "shiftTab"): key(48, "\u{19}", shift: true)
            case (_, "enter"): key(36, "\r")
            case ("methods", let l): if l.hasPrefix("expand") { statesController.expand() } else { statesController.collapse() }
            case ("runtime", "separator"): setTrail { p, _ in p["separator"] = .string("›") }
            case ("runtime", "maxItems3"): setTrail { p, _ in p["maxItems"] = .number(3) }
            case ("runtime", "authorCurrent"), ("runtime", "clearCurrent"):
                setTrail { _, c in if let i = c.firstIndex(where: { $0.id == "d" }) { var p = c[i].properties; p["current"] = .bool(lbl == "authorCurrent"); c[i] = AWCNode(id: "d", tag: "md-breadcrumb-item", properties: p, children: c[i].children) } }
            case ("runtime", "append"): setTrail { _, c in c.append(AWCNode(id: "tail", tag: "md-breadcrumb-item", properties: [:], children: [.text("Appendix")])) }
            case ("runtime", "remove"): setTrail { _, c in c.removeAll { $0.id == "tail" } }
            case ("runtime", "label"): setTrail { p, _ in p["label"] = .string("Site path"); p["expandLabel"] = .string("Show every level") }
            default: check(false, "\(name) unknown phase \(lbl)")
            }
            var frames: [Frame] = [], pumps: [Double] = []
            while now() - t0 < dur - 12 { let p0 = now(); pump(0.004); pumps.append(now() - p0); frames.append(frame(t0)) }
            if pumps.prefix(6).contains(where: { $0 > 60 }) { report.append(["parts": "\(name) \(lbl)", "values": pumpParts, "slow": slow]) }
            slow = []
            pumpParts = [:]
            if pumps.prefix(6).contains(where: { $0 > 60 }) { report.append(["stall": "\(name) \(lbl)", "pumps": Array(pumps.prefix(8)), "actionMs": frames.first.map { $0.t - pumps[0] } ?? -1]) }
            // The web snapshot is read right after the last sample (it is not at the start of the next phase).
            snapshot("\(name) \(lbl)", ph["snap"], frames: frames, at: ph["samples"].array.isEmpty ? dur : lastSample + 5)
            let traceID = ProcessInfo.processInfo.environment["AWC_BC_TRACE"] ?? (r["target"] != .null ? r["target"].string : "a")
            report.append(["trace": "\(name) \(lbl)", "frames": frames.prefix(ProcessInfo.processInfo.environment["AWC_BC_TRACE"] == nil ? 14 : 60).compactMap { f in f.crumbs[traceID].map { [f.t, $0.t] + $0.v } },
                           "motion": state.measurements.first { $0.name == "surface" && $0.id.hasPrefix(traceID) }.map { m in ["id": m.metrics["motion"]?.number ?? -1, "inkStart": (m.metrics["inkStart"]?.number ?? 0) - t0, "inkDuration": m.metrics["inkDuration"]?.number ?? -1] } ?? [:]])
            if lbl.hasPrefix("tab") || lbl == "shiftTab" || lbl == "enter" || (scenario == "overflowPointer" && lbl == "release") {
                let active = ph["snap"]["active"].string, id = active.hasPrefix("md-breadcrumb-item#") ? String(active.dropFirst("md-breadcrumb-item#".count).prefix { $0 != " " }) : active.contains("overflow-btn") ? "trail-overflow" : active.hasPrefix("button#after") ? "after" : "body"
                let f = focusedID()
                check(f == id || (id == "after" && !f.hasPrefix("trail") && !items.contains { f == $0["id"].string }), "\(name) \(lbl) focus \(f) vs \(id)")
            }
            if scenario == "runtime" && lbl == "label" {
                check(state.measurements.first { $0.name == "md-breadcrumbs" }?.metrics["label"]?.string == "Site path", "\(name) label updated")
                check(state.measurements.first { $0.name == "overflow-button" }?.metrics["label"]?.string == "Show every level", "\(name) expandLabel updated")
            }
            if scenario == "entrance" { report.append(["entranceRender": name, "homeX": frames.prefix(30).compactMap { f in f.homeX.map { [f.t, $0, f.crumbs["home"]?.v[7] ?? .nan] } }]) }
            samples("\(name) \(lbl)", ph, frames, entranceAligned: scenario == "entrance" && !reduced,
                    skip: scenario == "overflowPointer" && lbl == "release" ? ["a", "b", "c"] : [])
        }
        // The host attributes are recorded after the run (the runtime run relabels the trail).
        if scenario != "entrance" { check(state.measurements.first { $0.name == "md-breadcrumbs" }?.metrics["label"]?.string == r["host"]["ariaLabel"].string, "\(name) landmark label") }
        let web = r["events"].array
        check(state.events.count == web.count, "\(name) events \(state.events.map(\.name)) vs \(web.map { $0["name"].string })")
        for (n, w) in zip(state.events, web) {
            check(n.name == w["name"].string && n.prevented == (w["prevented"] == .bool(true)) && n.cancelable == (w["cancelable"] == .bool(true)), "\(name) event \(n.name) prevented \(n.prevented) cancelable \(n.cancelable)")
            for k in ["href", "label", "current", "itemIndex", "itemTotal", "expanded", "itemCount"] where w["detail"][k] != .null {
                check(n.detail[k] == w["detail"][k], "\(name) \(n.name).\(k) \(n.detail[k]) vs \(w["detail"][k])")
            }
            check(n.target == w["target"].string, "\(name) \(n.name) target \(n.target) vs \(w["target"].string)")
        }
        print("RUN \(name): \(checks - failures.count)/\(checks) cumulative"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        // On a display (invisible: alpha 0, click-through): a window outside every display gets no display-link frames
        // for ~350 ms after a TimelineView resumes, which would leave the first frames of every transition unrendered.
        #if canImport(AppKit)
        let screen = NSScreen.main?.frame ?? .init(x: 0, y: 0, width: 1440, height: 900)
        #else
        let screen = CGRect(x: 0, y: 0, width: 1440, height: 900)
        #endif
        host = NSHostingView(rootView: BreadcrumbsStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        #if canImport(AppKit)
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        if ProcessInfo.processInfo.environment["AWC_BC_STALL_LOOP"] != nil {   // diagnostics: hover/leave repeatedly
            state.trail = trail(.object([:]), TRAIL); state.epoch += 1; pump(1.2)
            for _ in 0..<40 { if let p = center("lib") { hoverTo(p) }; let a = now(); pump(0.5); let b = now(); leave(); pump(0.5); print("loop hover \(Int(b - a))"); fflush(stdout) }
            exit(0)
        }
        let only = ProcessInfo.processInfo.environment["AWC_BC_ONLY"]
        for (file, reduced) in [("breadcrumbs-web-states", false), ("breadcrumbs-web-states-reduced", true)] {
            let oracle = value(try! JSONSerialization.jsonObject(with: Data(contentsOf: fixtures.appendingPathComponent(file + ".json"))))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_BC_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Breadcrumbs native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
