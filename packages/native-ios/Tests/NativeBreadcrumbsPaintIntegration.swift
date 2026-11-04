import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-breadcrumbs / md-breadcrumb-item paint and geometry against Chrome (breadcrumbs/paint.html, Mac Chrome 153, DPR 1):
// the matrix (theme × direction × density), separators, the collapse window and toggle, crumb kinds (static, author
// current, disabled, icons, slotted icon, 32 ch truncation, wrapping, hidden, local/inherited density), every hook and
// each hook alone: boxes of the trail, crumbs, separators, surfaces, labels, icons and the toggle, colours, and every
// flat pixel of the clip (entrance animations settled, as the reference finishes them).
@Observable final class BreadcrumbsPaintState {
    var epoch = 0
    var trail = AWCNode(id: "trail", tag: "md-breadcrumbs")
    var dark = false
    var rtl = false
    var width = 720.0
    var inheritedDensity = 0.0
    var appearance = AWCBreadcrumbsAppearance()
    var hidden = false
    var measurements: [AWCNativeInspectionNode] = []
}
let breadcrumbsController = AWCBreadcrumbsController()
struct BreadcrumbsPaintFixture: View {
    let state: BreadcrumbsPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        ZStack(alignment: .topLeading) {
            if !state.hidden {
                AWCNativeView(node: state.trail).frame(width: state.width, alignment: .topLeading)
                    .frame(width: 720, alignment: .topLeading)   // a narrower trail sits at the inline start (right in RTL)
                    .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                    .environment(\.awcNativeDensity, state.inheritedDensity)
                    .offset(x: 40, y: 40)
            }
        }
        .awcBreadcrumbsAppearance(state.appearance).awcBreadcrumbsController(breadcrumbsController)
        .awcTheme(theme)
        .awcNativeInspection(rootID: (["trail"] + state.trail.children.map(\.id)).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct BCGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flat(_ px: Int, _ py: Int, _ limit: Double) -> Bool {
        guard px - 1 >= x && py - 1 >= y && px + 1 < x + w && py + 1 < y + h else { return false }
        for c in 0..<3 { var lo = 999.0, hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let v = values[((py + dy - y) * w + (px + dx - x)) * 3 + c]; lo = min(lo, v); hi = max(hi, v) } }
            if hi - lo > limit { return false } }
        return true
    }
}
@main @MainActor enum NativeBreadcrumbsPaintIntegration {
    static let state = BreadcrumbsPaintState()
    static var host: NSHostingView<BreadcrumbsPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> BCGrid {
        let k = max(1, Int(s.scale.rounded()))
        let crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let n = Double(k * k)
        for py in 0..<h { for px in 0..<w { var sum = [0.0, 0.0, 0.0]
            for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { let i = (yy * cg.width + xx) * 4; for c in 0..<3 { sum[c] += Double(buffer[i + c]) } } }
            for c in 0..<3 { values[(py * w + px) * 3 + c] = sum[c] / n } } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    static func diff(_ a: [Double], _ b: [Double]) -> Double { var m = 0.0; for i in 0..<3 { m = max(m, abs(a[i] - b[i])) }; return m }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
    static func appearance(_ hooks: AWCValue) -> AWCBreadcrumbsAppearance {
        guard case .object(let o) = hooks else { return .init() }
        func s(_ k: String) -> String? { o[k]?.string }
        func n(_ k: String) -> Double? { s(k).map { $0.hasSuffix("ms") ? Double($0.dropLast(2)) ?? 0 : px($0) } }
        return .init(gap: n("--md-breadcrumbs-gap"), separatorColor: s("--md-breadcrumbs-separator-color"), textColor: s("--md-breadcrumbs-text-color"), stagger: n("--md-breadcrumbs-stagger"),
                     linkColor: s("--md-breadcrumb-item-link-color"), currentColor: s("--md-breadcrumb-item-current-color"), currentBackground: s("--md-breadcrumb-item-current-bg"),
                     disabledColor: s("--md-breadcrumb-item-disabled-color"), hoverColor: s("--md-breadcrumb-item-hover-color"), stateLayerColor: s("--md-breadcrumb-item-state-layer-color"),
                     itemGap: n("--md-breadcrumb-item-gap"), itemPadding: s("--md-breadcrumb-item-padding").map { numbers($0) })
    }
    static let TRAIL: [[String: AWCValue]] = [["id": "home", "href": "#home", "icon": "home", "label": "Home"], ["id": "lib", "href": "#library", "label": "Library"], ["id": "docs", "href": "#documents", "label": "Documents"], ["id": "page", "label": "Quarterly report"]]
    static func trail(_ c: AWCValue) -> AWCNode {
        var p: [String: AWCValue] = [:]
        for (k, key) in [("label", "label"), ("expandLabel", "expandLabel"), ("separator", "separator"), ("maxItems", "maxItems"), ("before", "itemsBeforeCollapse"), ("after", "itemsAfterCollapse"), ("density", "density")] where c[k] != .null { p[key] = c[k] }
        var items: [AWCNode] = []
        for it in c["items"].array {
            var ip: [String: AWCValue] = [:]
            for k in ["href", "icon", "current", "disabled", "density", "target", "rel", "hidden"] where it[k] != .null { ip[k] = it[k] }
            var children: [AWCNode] = []
            if it["svg"] == .bool(true) { children.append(.symbol("square", slot: "icon")) }
            let html = it["html"] != .null ? it["html"].string : it["label"].string
            let text = html.replacingOccurrences(of: "<b>", with: "").replacingOccurrences(of: "</b>", with: "").replacingOccurrences(of: "&amp;", with: "&")
            if !text.isEmpty { children.append(.text(text)) }
            items.append(AWCNode(id: it["id"].string, tag: "md-breadcrumb-item", properties: ip, children: children))
        }
        return AWCNode(id: "trail", tag: "md-breadcrumbs", properties: p, children: items)
    }
    static func node(_ id: String, _ part: String? = nil) -> AWCNativeInspectionNode? {
        state.measurements.first { part == nil ? ($0.id == id || $0.id.hasPrefix(id + ":")) && ($0.name == "md-breadcrumb-item" || $0.name == "md-breadcrumbs") : $0.id == "\(id):\(part!)" || $0.id.hasSuffix(":\(id):\(part!)") || ($0.id.hasPrefix(id) && $0.id.hasSuffix(":" + part!)) }
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        state.inheritedDensity = c["inheritedDensity"].number ?? 0; state.hidden = c["hidden"] == .bool(true)
        state.appearance = appearance(c["hooks"]); state.width = c["width"] != .null ? px(c["width"].string) : 720
        state.trail = trail(c); state.measurements = []; state.epoch += 1; pump(0.25)
        if c["expand"] == .bool(true) { breadcrumbsController.expand(); pump(0.2) }
        pump(0.9)   // entrances settle (500 ms + stagger 40 × index; the reference finishes them)
        if c["parts"] != .null { report.append(["case": name, "skipped": "::part() styling is not available natively yet"]); return }
        let s = c["snap"]
        if state.hidden { check(state.measurements.first { $0.name == "md-breadcrumbs" } == nil, "\(name) hidden trail renders nothing"); return }
        func near(_ a: Double?, _ b: Double?, _ label: String, _ tol: Double = 0.75) { check(a != nil && b != nil && abs(a! - b!) <= tol, "\(name) \(label) \(a ?? .nan) vs \(b ?? .nan)") }
        for it in s["items"].array {
            let id = it["id"].string, r = it["rect"]
            let item = state.measurements.first { $0.name == "md-breadcrumb-item" && $0.id.hasPrefix(id) }
            if (r["width"].number ?? 0) == 0 { check(item == nil || item!.bounds.width < 0.5, "\(name) \(id) collapsed/hidden"); continue }
            guard let item else { check(false, "\(name) \(id) measured"); continue }
            if let dump = ProcessInfo.processInfo.environment["AWC_BC_DUMP"], name.contains(dump) {
                let sp = state.measurements.first { $0.name == "separator" && $0.id.hasPrefix(id) }, lb = state.measurements.first { $0.name == "label" && $0.id.hasPrefix(id) }
                func f(_ v: Double?) -> String { v.map { String(format: "%.3f", $0) } ?? "-" }
                print("DUMP \(name) \(id) item \(f(Double(item.bounds.minX)))/\(f(Double(item.bounds.width))) web \(f(r["x"].number))/\(f(r["width"].number)) sep \(f(sp.map { Double($0.bounds.minX) }))/\(f(sp.map { Double($0.bounds.width) })) web \(f(it["separator"]["rect"]["x"].number))/\(f(it["separator"]["rect"]["width"].number)) label \(f(lb.map { Double($0.bounds.minX) }))/\(f(lb.map { Double($0.bounds.width) })) web \(f(it["label"]["rect"]["x"].number))/\(f(it["label"]["rect"]["width"].number))"); fflush(stdout)
            }
            near(item.bounds.minX, r["x"].number, "\(id) x"); near(item.bounds.minY, r["y"].number, "\(id) y"); near(item.bounds.width, r["width"].number, "\(id) width", 1.2); near(item.bounds.height, r["height"].number, "\(id) height")
            let surf = state.measurements.first { $0.name == "surface" && $0.id.hasPrefix(id) }, ws = it["surface"]
            if ws != .null, let surf {
                near(surf.bounds.minX, ws["rect"]["x"].number, "\(id) surface x"); near(surf.bounds.width, ws["rect"]["width"].number, "\(id) surface width", 1.2); near(surf.bounds.height, ws["rect"]["height"].number, "\(id) surface height")
                check(surf.metrics["kind"]?.string == ws["kind"].string, "\(name) \(id) kind \(surf.metrics["kind"]?.string ?? "") vs \(ws["kind"].string)")
                check(colorClose(surf.metrics["color"], ws["color"].string), "\(name) \(id) colour \(String(describing: surf.metrics["color"])) vs \(ws["color"].string)")
                check(colorClose(surf.metrics["background"], ws["backgroundColor"].string), "\(name) \(id) background vs \(ws["backgroundColor"].string)")
            }
            let sep = state.measurements.first { $0.name == "separator" && $0.id.hasPrefix(id) }, wsep = it["separator"]
            check((sep != nil) == (wsep != .null), "\(name) \(id) separator presence")
            if let sep, wsep != .null { near(sep.bounds.minX, wsep["rect"]["x"].number, "\(id) separator x"); check(colorClose(sep.metrics["color"], wsep["color"].string), "\(name) \(id) separator colour") }
            let lab = state.measurements.first { $0.name == "label" && $0.id.hasPrefix(id) }, wl = it["label"]
            if let lab, wl != .null { near(lab.bounds.minX, wl["rect"]["x"].number, "\(id) label x"); near(lab.bounds.width, wl["rect"]["width"].number, "\(id) label width", 1.2) }
        }
        let ov = s["overflow"], btn = state.measurements.first { $0.name == "overflow-button" }
        check((btn != nil) == (ov != .null), "\(name) toggle presence")
        if let btn, ov != .null { near(btn.bounds.minX, ov["button"]["rect"]["x"].number, "toggle x"); near(btn.bounds.minY, ov["button"]["rect"]["y"].number, "toggle y"); near(btn.bounds.width, 32, "toggle size") }
        // Paint: every flat CSS pixel of the clip (glyph and text edges excluded in either image).
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch)), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxx in (cx + 1)..<(cx + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_BC_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: BreadcrumbsPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("breadcrumbs-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_BC_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("breadcrumbs-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_BC_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Breadcrumbs native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
