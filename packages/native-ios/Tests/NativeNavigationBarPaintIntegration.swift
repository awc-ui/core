import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-navigation-bar / md-navigation-tab paint and geometry against Chrome (navbar.html, Mac Chrome 153, DPR 1): the
// matrix (label behaviour × theme × direction × density), active index, badges (caps, dots, text), hard and soft
// disabled, the active icon, slotted icons and label, 3 and 5 destinations, narrow and wide bars, long labels, local
// density, a per-tab label override, every hook together and each hook alone: boxes of the bar, tabs, container,
// indicator (with its scale), icon container, icon, label and badge, colours, opacities, weights, tab stops, names, and
// every flat pixel of the bar.
@Observable final class NavigationBarPaintState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var width = 412.0
    var origin = CGPoint(x: 24, y: 24)
    var appearance = AWCNavigationBarAppearance(tab: .init())
    var measurements: [AWCNativeInspectionNode] = []
    var tabParts = AWCNavigationTabPartAppearance()
    var barParts = AWCNavigationBarPartAppearance()
}
struct NavigationBarPaintFixture: View {
    let state: NavigationBarPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = state.nodes.flatMap { [$0.id] + $0.children.flatMap { [$0.id, $0.id + "-ripple"] + $0.children.map(\.id) } }
        ZStack(alignment: .topLeading) {
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) { ForEach(state.nodes) { AWCNativeView(node: $0) } }
                    .frame(width: state.width, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: state.origin.x, y: state.origin.y)
        }
        .awcNavigationBarAppearance(state.appearance)
        .awcNavigationTabPartAppearance(state.tabParts).awcNavigationBarPartAppearance(state.barParts)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeNavigationBarPaintIntegration {
    static let state = NavigationBarPaintState()
    static var host: NSHostingView<NavigationBarPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> TabsGridN {
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
        return [0, 0, 0, 0]
    }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func scaleOf(_ t: String) -> Double { t == "none" || t.isEmpty ? 1 : numbers(t).first ?? 1 }
    static func hooks(_ v: AWCValue) -> [String: String] { guard case .object(let o) = v else { return [:] }; return o.compactMapValues(\.string) }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasSuffix(":" + id) || $0.id.contains(":" + id + ":") || $0.id.hasPrefix(id + ".")) }
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
    /// Gate-7 R6-17: the declarations of `tag::part(part){…}` in a case's rules.
    static func boxRule(_ css: String, _ tag: String, _ part: String) -> [String: String]? {
        guard let r = css.range(of: tag + "::part(" + part + "){") else { return nil }
        var out: [String: String] = [:]
        for decl in css[r.upperBound...].prefix(while: { $0 != "}" }).split(separator: ";") {
            let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }; if kv.count == 2 { out[kv[0]] = kv[1] } }
        return out.isEmpty ? nil : out
    }
    /// A wrapper part's rule as the typed box: background(-color), border (width style colour), border-radius, padding shorthand.
    static func partBox(_ r: [String: String]?) -> AWCPartBox? {
        guard let r, ["background-color", "background", "border", "border-radius", "padding"].contains(where: { r[$0] != nil }) else { return nil }
        func n(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
        let border = (r["border"] ?? "").split(separator: " ").map(String.init)
        return AWCPartBox(background: r["background-color"] ?? r["background"], borderWidth: border.first.map(n), borderColor: border.last.flatMap { $0.hasPrefix("#") ? $0 : nil },
                          cornerRadius: r["border-radius"].map(n), padding: r["padding"].map { $0.split(separator: " ").map { n(String($0)) } })
    }
    /// The inspected box of a wrapper part against Chrome's computed box.
    static func boxCheck(_ label: String, _ node: AWCNativeInspectionNode?, bg: String, bw: String, bc: String, radius: String, pad: [String]) {
        guard let node else { check(false, "\(label) box measured"); return }
        func n(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
        check(colorClose(node.metrics["background"], bg), "\(label) box background \(String(describing: node.metrics["background"])) vs \(bg)")
        check(abs((node.metrics["borderWidth"]?.number ?? -1) - n(bw)) < 0.01, "\(label) box border width \(String(describing: node.metrics["borderWidth"])) vs \(bw)")
        if n(bw) > 0 { check(colorClose(node.metrics["borderColor"], bc), "\(label) box border colour \(String(describing: node.metrics["borderColor"])) vs \(bc)") }
        check(abs((node.metrics["radius"]?.number ?? -1) - n(radius)) < 0.01, "\(label) box radius \(String(describing: node.metrics["radius"])) vs \(radius)")
        let p = node.metrics["padding"]?.array.compactMap(\.number) ?? []
        check(p.count == 4 && zip(p, pad.map(n)).allSatisfy { abs($0 - $1) < 0.01 }, "\(label) box padding \(p) vs \(pad)")
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        let nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(c["nodesJSON"].string.utf8))
        let h = c["host"], hostRect = h["rect"]
        state.appearance = AWCNavigationBarAppearance(css: hooks(nodes.first?.properties["_hooks"] ?? .null))
        let rules = partRules(c["parts"].string), tp = { (part: String, prop: String) in rules["md-navigation-tab::" + part]?[prop] }
        state.tabParts = .init(stateLayerColor: tp("state-layer", "background-color"), stateLayerOpacity: tp("state-layer", "opacity").flatMap(Double.init), iconColor: tp("icon", "color"),
                               labelColor: tp("label", "color"), indicatorColor: tp("indicator", "background-color"), badgeColor: tp("badge", "background-color"), badgeLabelColor: tp("badge", "color"),
                               container: partBox(boxRule(c["parts"].string, "md-navigation-tab", "container")), iconContainer: partBox(boxRule(c["parts"].string, "md-navigation-tab", "icon-container")))
        state.barParts = .init(containerColor: rules["md-navigation-bar::container"]?["background-color"])
        // The global density rung of the matrix rides on the bar (the oracle sets it on an ancestor).
        if let d = c["density"].number, d != 0 { state.nodes = nodes.map { n in var n = n; if n.properties["density"] == nil { n.properties["density"] = .number(d) }; return n } } else { state.nodes = nodes }
        state.width = c["width"].number ?? 412
        state.origin = CGPoint(x: hostRect["x"].number ?? 24, y: hostRect["y"].number ?? 24)
        state.measurements = []; state.epoch += 1; pump(0.6)
        if ProcessInfo.processInfo.environment["AWC_NAVBAR_DUMP"] != nil { for n in state.measurements { print("MEAS \(n.id) \(n.name) \(n.bounds) \(n.metrics)") }; fflush(stdout) }
        func near(_ a: Double?, _ b: Double?, _ label: String, _ tol: Double = 0.75) { check(a != nil && b != nil && abs(a! - b!) <= tol, "\(name) \(label) \(a ?? .nan) vs \(b ?? .nan)") }
        guard let barNode = nodes.first(where: { $0.tag == "md-navigation-bar" }), let bar = m(barNode.id, "md-navigation-bar") else { check(false, "\(name) bar measured"); return }
        near(bar.bounds.minX, hostRect["x"].number, "bar x"); near(bar.bounds.minY, hostRect["y"].number, "bar y")
        near(bar.bounds.width, hostRect["width"].number, "bar width", 1); near(bar.bounds.height, hostRect["height"].number, "bar height")
        check(colorClose(bar.metrics["container"], h["bg"].string), "\(name) bar background \(String(describing: bar.metrics["container"])) vs \(h["bg"].string)")
        near(bar.metrics["dividerWidth"]?.number, numbers(h["borderTopWidth"].string).first, "divider width", 0.01)
        if (numbers(h["borderTopWidth"].string).first ?? 0) > 0 { check(colorClose(bar.metrics["divider"], h["borderTopColor"].string), "\(name) divider colour") }
        near(bar.metrics["zIndex"]?.number, Double(h["zIndex"].string), "z-index", 0.01)
        check(((bar.metrics["elevation"]?.number ?? 0) > 0) == (h["boxShadow"].string != "none"), "\(name) elevation presence")
        let ax = c["ax"].array.filter { $0["role"].string == "tab" }
        for (i, wt) in c["tabs"].array.enumerated() where i < barNode.children.count {
            let id = barNode.children[i].id
            guard let tab = m(id, "md-navigation-tab") else { check(false, "\(name) \(id) measured"); continue }
            let r = wt["rect"], lbl = "\(id)"
            near(tab.bounds.minX, r["x"].number, "\(lbl) x"); near(tab.bounds.minY, r["y"].number, "\(lbl) y"); near(tab.bounds.width, r["width"].number, "\(lbl) width", 1); near(tab.bounds.height, r["height"].number, "\(lbl) height")
            check((tab.metrics["active"]?.bool ?? false) == (wt["selected"].string == "true"), "\(name) \(lbl) selected")
            check((tab.metrics["tabStop"]?.bool ?? false) == (wt["tabindex"].string == "0"), "\(name) \(lbl) tab stop")
            check(colorClose(tab.metrics["color"], wt["color"].string), "\(name) \(lbl) colour \(String(describing: tab.metrics["color"])) vs \(wt["color"].string)")
            near(tab.metrics["opacity"]?.number, Double(wt["opacity"].string), "\(lbl) opacity", 0.005)
            if i < ax.count { check(tab.metrics["name"]?.string == ax[i]["name"].string, "\(name) \(lbl) name \(tab.metrics["name"]?.string ?? "") vs \(ax[i]["name"].string)") }
            near(tab.metrics["layerOpacity"]?.number, Double(wt["state-layer"]["opacity"].string), "\(lbl) state layer", 0.001)
            for part in ["container", "icon-container", "icon"] where wt[part] != .null {
                guard let p = m(id, part) else { check(false, "\(name) \(lbl) \(part) measured"); continue }
                let wr = wt[part]["rect"]
                near(p.bounds.minX, wr["x"].number, "\(lbl) \(part) x"); near(p.bounds.minY, wr["y"].number, "\(lbl) \(part) y")
                near(p.bounds.width, wr["width"].number, "\(lbl) \(part) width", 1); near(p.bounds.height, wr["height"].number, "\(lbl) \(part) height", 1)
                // ::part(container) / ::part(icon-container) boxes (gate-7 R6-17): the typed box against Chrome's computed box.
                if part != "icon", boxRule(c["parts"].string, "md-navigation-tab", part) != nil {
                    boxCheck("\(name) \(lbl) \(part)", p, bg: wt[part]["bg"].string, bw: wt[part]["bw"].string, bc: wt[part]["bc"].string, radius: wt[part]["radius"].string, pad: wt[part]["pad"].array.map(\.string))
                }
            }
            // A text icon slot (R6-11): the run's own box (Chrome's Range) — font family and size decide its width.
            for sl in wt["slotted"].array where sl["textRect"] != .null {
                guard let run = m(id, "slotted-icon") else { check(false, "\(name) \(lbl) slotted icon measured"); continue }
                let tr = sl["textRect"]
                near(run.bounds.minX, tr["x"].number, "\(lbl) slotted icon x"); near(run.bounds.width, tr["width"].number, "\(lbl) slotted icon width")
                near(run.bounds.midY, (tr["y"].number ?? 0) + (tr["height"].number ?? 0) / 2, "\(lbl) slotted icon centre y", 1)
                near(run.metrics["fontSize"]?.number, numbers(sl["fontSize"].string).first, "\(lbl) slotted icon size", 0.01)
                check(colorClose(run.metrics["color"], sl["color"].string), "\(name) \(lbl) slotted icon colour")
            }
            if wt["icon"] != .null, let icon = m(id, "icon") { check(colorClose(icon.metrics["color"], wt["icon"]["color"].string), "\(name) \(lbl) icon colour \(String(describing: icon.metrics["color"])) vs \(wt["icon"]["color"].string)") }
            let label = m(id, "label")
            check((label != nil) == (wt["label"] != .null), "\(name) \(lbl) label presence")
            if wt["label"] != .null, let label {
                let wr = wt["label"]["rect"]
                near(label.bounds.minX, wr["x"].number, "\(lbl) label x"); near(label.bounds.minY, wr["y"].number, "\(lbl) label y"); near(label.bounds.width, wr["width"].number, "\(lbl) label width", 1); near(label.bounds.height, wr["height"].number, "\(lbl) label height")
                check(colorClose(label.metrics["color"], wt["label"]["color"].string), "\(name) \(lbl) label colour \(String(describing: label.metrics["color"])) vs \(wt["label"]["color"].string)")
                near(label.metrics["opacity"]?.number, Double(wt["label"]["opacity"].string), "\(lbl) label opacity", 0.01)
                near(label.metrics["fontWeight"]?.number, Double(wt["label"]["fontWeight"].string), "\(lbl) label weight", 0.5)
                near(label.metrics["fontSize"]?.number, numbers(wt["label"]["fontSize"].string).first, "\(lbl) label size", 0.01)
            }
            if wt["indicator"] != .null, let ind = m(id, "indicator") {
                let wr = wt["indicator"]["rect"]
                near(Double(ind.bounds.minX), wr["x"].number, "\(lbl) indicator x"); near(Double(ind.bounds.minY), wr["y"].number, "\(lbl) indicator y")
                near(Double(ind.bounds.width), wr["width"].number, "\(lbl) indicator width", 1); near(Double(ind.bounds.height), wr["height"].number, "\(lbl) indicator height")
                near(ind.metrics["opacity"]?.number, Double(wt["indicator"]["opacity"].string), "\(lbl) indicator opacity", 0.02)
                near(ind.metrics["scale"]?.number, scaleOf(wt["indicator"]["transform"].string), "\(lbl) indicator scale", 0.01)
                check(colorClose(ind.metrics["color"], wt["indicator"]["bg"].string), "\(name) \(lbl) indicator colour")
                if let rr = numbers(wt["indicator"]["radius"].string).first { near(ind.metrics["radius"]?.number, min(rr, (wr["height"].number ?? 0) / 2, 9999), "\(lbl) indicator radius", 0.01) }
            }
            let badge = m(id, "badge")
            check((badge != nil) == (wt["badge"] != .null), "\(name) \(lbl) badge presence")
            if wt["badge"] != .null, let badge {
                let wr = wt["badge"]["rect"]
                near(badge.bounds.minX, wr["x"].number, "\(lbl) badge x"); near(badge.bounds.minY, wr["y"].number, "\(lbl) badge y")
                near(badge.bounds.width, wr["width"].number, "\(lbl) badge width", 1); near(badge.bounds.height, wr["height"].number, "\(lbl) badge height")
                check(colorClose(badge.metrics["color"], wt["badge"]["bg"].string), "\(name) \(lbl) badge colour")
                if (wr["height"].number ?? 0) > 8 { check(badge.metrics["text"]?.string == wt["badge"]["text"].string, "\(name) \(lbl) badge text \(badge.metrics["text"]?.string ?? "") vs \(wt["badge"]["text"].string)")
                    check(colorClose(badge.metrics["textColor"], wt["badge"]["color"].string), "\(name) \(lbl) badge text colour") }
            }
        }
        if name == "slotted" { report.append(["case": name, "skipped": "pixels: authored SVG icons (natively symbol views)"]); return }
        // Paint: every flat CSS pixel of the bar (glyph and text edges excluded in either image).
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
        if let dir = ProcessInfo.processInfo.environment["AWC_NAVBAR_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: NavigationBarPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("navbar-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_NAVBAR_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("navbar-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_NAVBAR_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Navigation bar native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
struct TabsGridN {
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
