import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-tabs / md-tab / md-tab-panels paint and geometry against Chrome (tabs.html, Mac Chrome 153, DPR 1): the matrix
// (variant × anatomy × theme × direction × density), label badges, disabled tabs, width modes × divider modes, every hook
// and each hook alone, overflow (start and revealed, LTR/RTL), the width property, local density, slotted icon and badge,
// and stable/active panels: boxes of the strip, tabs, content, icon, label, indicator (with its transform) and divider,
// colours, tab stops, accessible names, scroll position, and every flat pixel of the strip.
@Observable final class TabsPaintState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var width = 480.0
    var density = 0.0
    var origin = CGPoint(x: 24, y: 24)
    var appearance = AWCTabsAppearance()
    var measurements: [AWCNativeInspectionNode] = []
    var tabParts = AWCTabPartAppearance()
    var tabsParts = AWCTabsPartAppearance()
}
let tabsPaintController = AWCTabsController()
struct TabsPaintFixture: View {
    let state: TabsPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = state.nodes.flatMap { [$0.id] + $0.children.flatMap { [$0.id, $0.id + "-ripple"] + $0.children.map(\.id) } }
        ZStack(alignment: .topLeading) {
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) { ForEach(state.nodes) { AWCNativeView(node: $0) } }
                    .frame(width: state.width, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .environment(\.awcNativeDensity, state.density)
            .offset(x: state.origin.x, y: state.origin.y)
        }
        .awcTabsAppearance(state.appearance).awcTabsController(tabsPaintController)
        .awcTabPartAppearance(state.tabParts).awcTabsPartAppearance(state.tabsParts)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct TabsGrid {
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
@main @MainActor enum NativeTabsPaintIntegration {
    static let state = TabsPaintState()
    static var host: NSHostingView<TabsPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> TabsGrid {
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
        if s.hasPrefix("rgba"), n.count >= 4 { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb"), n.count >= 3 { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func scaleOf(_ t: String) -> Double { t == "none" || t.isEmpty ? 1 : numbers(t).first ?? 1 }
    static func translateOf(_ t: String) -> Double { t == "none" || t.isEmpty ? 0 : (numbers(t).count >= 6 ? numbers(t)[4] : 0) }
    static func appearance(_ hooks: AWCValue) -> AWCTabsAppearance {
        guard case .object(let o) = hooks else { return .init() }
        func s(_ k: String) -> String? { o[k]?.string }
        return .init(containerColor: s("--md-tabs-container-color"), dividerColor: s("--md-tabs-divider-color"),
                     tab: .init(containerColor: s("--md-tab-container-color"), activeLabelColor: s("--md-tab-active-label-color"), inactiveLabelColor: s("--md-tab-inactive-label-color"),
                                activeIconColor: s("--md-tab-active-icon-color"), inactiveIconColor: s("--md-tab-inactive-icon-color"), activeIndicatorColor: s("--md-tab-active-indicator-color"),
                                activeIndicatorHeight: s("--md-tab-active-indicator-height").flatMap { Double($0.replacingOccurrences(of: "px", with: "")) }, dividerColor: s("--md-tab-divider-color")))
    }
    /// `tag::part(name){prop:value;…}` rules of a case → ["tag::name": [prop: value]].
    static func partRules(_ css: String) -> [String: [String: String]] {
        var out: [String: [String: String]] = [:]
        let rx = try! NSRegularExpression(pattern: "([a-z-]+)::part\\(([a-z-]+)\\)\\{([^}]*)\\}"), ns = css as NSString
        for m in rx.matches(in: css, range: NSRange(location: 0, length: ns.length)) {
            let key = ns.substring(with: m.range(at: 1)) + "::" + ns.substring(with: m.range(at: 2))
            for decl in ns.substring(with: m.range(at: 3)).split(separator: ";") {
                let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                if kv.count == 2 { out[key, default: [:]][kv[0]] = kv[1] }
            }
        }
        return out
    }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasSuffix(":" + id) || $0.id.contains(":" + id + ":") || $0.id.hasPrefix(id + ".")) }
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        let nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(c["nodesJSON"].string.utf8))
        let hostRect = c["host"]["rect"]
        state.appearance = appearance(nodes.first?.properties["_hooks"] ?? .null)
        let rules = partRules(c["parts"].string), tp = { (part: String, prop: String) in rules["md-tab::" + part]?[prop] }
        state.tabParts = .init(stateLayerColor: tp("state-layer", "background-color"), stateLayerOpacity: tp("state-layer", "opacity").flatMap(Double.init),
                               iconColor: tp("icon", "color"), labelColor: tp("label", "color"), indicatorColor: tp("indicator", "background-color"), dividerColor: tp("divider", "background-color"))
        state.tabsParts = .init(containerColor: rules["md-tabs::container"]?["background-color"])
        state.nodes = nodes; state.density = c["density"].number ?? 0
        state.width = c["wrapped"] == .bool(true) ? (hostRect["width"].number ?? 480) : (c["width"].number ?? 480)
        state.origin = CGPoint(x: hostRect["x"].number ?? 24, y: hostRect["y"].number ?? 24)
        state.measurements = []; state.epoch += 1; pump(0.4)
        if name.hasPrefix("overflow-scrolled") { tabsPaintController.selectTab(6); pump(1.0) }
        pump(0.3)
        if ProcessInfo.processInfo.environment["AWC_TABS_DUMP"] != nil { for n in state.measurements { print("MEAS \(n.id) \(n.name) \(n.bounds)") }; fflush(stdout) }
        func near(_ a: Double?, _ b: Double?, _ label: String, _ tol: Double = 0.75) { check(a != nil && b != nil && abs(a! - b!) <= tol, "\(name) \(label) \(a ?? .nan) vs \(b ?? .nan)") }
        guard let tabsNode = nodes.first(where: { $0.tag == "md-tabs" }), let strip = m(tabsNode.id, "md-tabs") else { check(false, "\(name) strip measured"); return }
        let h = c["host"]
        near(strip.bounds.minX, hostRect["x"].number, "strip x"); near(strip.bounds.minY, hostRect["y"].number, "strip y")
        near(strip.bounds.width, hostRect["width"].number, "strip width", 1); near(strip.bounds.height, hostRect["height"].number, "strip height")
        check(colorClose(strip.metrics["host"], h["bg"].string), "\(name) strip background \(String(describing: strip.metrics["host"])) vs \(h["bg"].string)")
        check(strip.metrics["label"]?.string == h["label"].string, "\(name) tablist label \(strip.metrics["label"]?.string ?? "") vs \(h["label"].string)")
        let full = h["after"] != .null && h["after"]["height"].string == "1px"
        let rule = state.measurements.first { $0.name == "divider" && $0.id.contains(tabsNode.id) && !$0.id.contains(":t") }
        check(full == (rule != nil), "\(name) full divider presence")
        if full, let rule { check(colorClose(rule.metrics["color"], h["after"]["backgroundColor"].string), "\(name) full divider colour"); near(rule.bounds.maxY, (hostRect["y"].number ?? 0) + (hostRect["height"].number ?? 0), "full divider bottom") }
        if let sw = h["scroll"]["width"].number, let cw = h["scroll"]["client"].number, sw > cw + 1 { near(strip.metrics["scrollLeft"]?.number, h["scroll"]["left"].number, "scrollLeft", 1.5) }
        let ax = c["ax"].array.filter { $0["role"].string == "tab" }
        for (i, wt) in c["tabs"].array.enumerated() where i < tabsNode.children.count {
            let id = tabsNode.children[i].id
            // Authored slot content keeps its HTML styling on Web (inline padding, colours): only its presence is native.
            let authoredSlot = tabsNode.children[i].children.contains { $0.slot == "badge" }
            guard let tab = m(id, "md-tab") else { check(false, "\(name) \(id) measured"); continue }
            let r = wt["rect"], lbl = "\(id)"
            near(tab.bounds.minX, r["x"].number, "\(lbl) x"); near(tab.bounds.minY, r["y"].number, "\(lbl) y"); near(tab.bounds.width, r["width"].number, "\(lbl) width", 1); near(tab.bounds.height, r["height"].number, "\(lbl) height")
            check((tab.metrics["active"]?.bool ?? false) == (wt["selected"].string == "true"), "\(name) \(lbl) selected")
            check((tab.metrics["tabStop"]?.bool ?? false) == (wt["tabindex"].string == "0"), "\(name) \(lbl) tab stop")
            check(colorClose(tab.metrics["color"], wt["color"].string), "\(name) \(lbl) colour \(String(describing: tab.metrics["color"])) vs \(wt["color"].string)")
            if i < ax.count { check(tab.metrics["name"]?.string == ax[i]["name"].string, "\(name) \(lbl) name \(tab.metrics["name"]?.string ?? "") vs \(ax[i]["name"].string)") }
            if let cont = m(id, "content"), wt["content"] != .null, !authoredSlot {
                let wr = wt["content"]["rect"]
                near(cont.bounds.minX, wr["x"].number, "\(lbl) content x"); near(cont.bounds.minY, wr["y"].number, "\(lbl) content y"); near(cont.bounds.width, wr["width"].number, "\(lbl) content width", 1); near(cont.bounds.height, wr["height"].number, "\(lbl) content height", 1)
            }
            if wt["icon"] != .null, (wt["icon"]["rect"]["width"].number ?? 0) > 0, let icon = m(id, "icon") {
                let wr = wt["icon"]["rect"]
                near(icon.bounds.minX, wr["x"].number, "\(lbl) icon x"); near(icon.bounds.minY, wr["y"].number, "\(lbl) icon y"); near(icon.bounds.width, wr["width"].number, "\(lbl) icon size")
                check(colorClose(icon.metrics["color"], wt["icon"]["color"].string), "\(name) \(lbl) icon colour \(String(describing: icon.metrics["color"])) vs \(wt["icon"]["color"].string)")
            }
            if wt["label"] != .null, let label = m(id, "label"), !authoredSlot {
                let wr = wt["label"]["rect"]
                near(label.bounds.minX, wr["x"].number, "\(lbl) label x"); near(label.bounds.minY, wr["y"].number, "\(lbl) label y"); near(label.bounds.width, wr["width"].number, "\(lbl) label width", 1); near(label.bounds.height, wr["height"].number, "\(lbl) label height")
                check(colorClose(label.metrics["color"], wt["label"]["color"].string), "\(name) \(lbl) label colour")
            }
            if wt["indicator"] != .null, let ind = m(id, "indicator"), !authoredSlot {
                let wr = wt["indicator"]["rect"], s = ind.metrics["scale"]?.number ?? 1
                near(Double(ind.bounds.minX), wr["x"].number, "\(lbl) indicator x"); near(Double(ind.bounds.minY), wr["y"].number, "\(lbl) indicator y"); near(Double(ind.bounds.width), wr["width"].number, "\(lbl) indicator width", 1)
                near(Double(ind.bounds.height), wr["height"].number, "\(lbl) indicator height")
                near(ind.metrics["opacity"]?.number, Double(wt["indicator"]["opacity"].string), "\(lbl) indicator opacity", 0.02)
                near(s, scaleOf(wt["indicator"]["transform"].string), "\(lbl) indicator scale", 0.01)
                check(colorClose(ind.metrics["color"], wt["indicator"]["bg"].string), "\(name) \(lbl) indicator colour")
            }
            if wt["divider"] != .null, let div = m(id, "divider") {
                let wr = wt["divider"]["rect"]
                near(div.bounds.minX, wr["x"].number, "\(lbl) divider x"); near(div.bounds.minY, wr["y"].number, "\(lbl) divider y"); near(div.bounds.width, wr["width"].number, "\(lbl) divider width", 1)
                check(colorClose(div.metrics["color"], wt["divider"]["bg"].string), "\(name) \(lbl) divider colour \(String(describing: div.metrics["color"])) vs \(wt["divider"]["bg"].string)")
            }
            // A fixed ::part(state-layer) opacity shows at rest (Chrome's part opacity); otherwise the layer is off at rest.
            let restLayer = c["parts"].string.isEmpty ? 0 : (Double(wt["state-layer"]["opacity"].string) ?? 0)
            near(tab.metrics["layerOpacity"]?.number, restLayer, "\(lbl) state layer", 0.001)
            if !c["parts"].string.isEmpty, let layer = m(id, "state-layer") { check(colorClose(layer.metrics["color"], wt["state-layer"]["bg"].string), "\(name) \(lbl) state-layer colour \(String(describing: layer.metrics["color"])) vs \(wt["state-layer"]["bg"].string)") }
        }
        if c["panels"] != .null, let panels = nodes.first(where: { $0.tag == "md-tab-panels" }) {
            for (i, wr) in c["panels"]["items"].array.enumerated() where i < panels.children.count {
                let p = m(panels.children[i].id, "md-tab-panel"), shown = (wr["width"].number ?? 0) > 0
                check((p != nil) == shown, "\(name) panel \(i) laid out \(p != nil) vs \(shown)")
                let active = i == Int(nodes.first { $0.tag == "md-tabs" }?.properties["activeTabIndex"]?.number ?? 0)
                if let p { check((p.metrics["active"]?.bool ?? false) == active, "\(name) panel \(i) active") }
                if let p, active { check(p.metrics["label"]?.string == ax.dropFirst(i).first?["name"].string, "\(name) panel \(i) named by its tab \(p.metrics["label"]?.string ?? "")") }
                if let p, (p.metrics["active"]?.bool ?? false) != active { print("PANELDBG \(name) \(i) \(p.metrics) region \(String(describing: m(panels.id, "md-tab-panels")?.metrics)) strip \(String(describing: strip.metrics["activeTabIndex"]))"); fflush(stdout) }
            }
        }
        if name == "slotted-icon-badge" { report.append(["case": name, "skipped": "pixels: the authored badge span's inline styles"]); return }
        // Paint: every flat CSS pixel of the strip (glyph and text edges excluded in either image).
        let cx = Int((hostRect["x"].number ?? 0).rounded(.down)), cy = Int((hostRect["y"].number ?? 0).rounded(.down))
        let cw = Int((hostRect["width"].number ?? 0).rounded(.down)), ch = Int((hostRect["height"].number ?? 0).rounded(.down))
        let clip = c["clip"], ox = clip["x"].number ?? 0, oy = clip["y"].number ?? 0
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: Double(src.width) / (clip["width"].number ?? 1), origin: .init(x: ox, y: oy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch)), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxx in (cx + 1)..<(cx + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_TABS_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: TabsPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("tabs-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_TABS_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("tabs-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_TABS_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Tabs native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
