import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-navigation-rail / md-navigation-rail-tab paint and geometry against Chrome (rail.html, Mac Chrome 153, DPR 1): the
// matrix (standard / expanded × label visibility × theme × direction), density rungs, slots (logo, toggle, FAB, footer
// profile) in both variants and directions, alignment, the modal overlay, horizontal bars (with and without logo, slots
// and hooks), overflow (column and bar), badges, disabled and aria-disabled, links, a dropdown destination, full height,
// no active destination, local density, every hook together and each hook alone: boxes of the rail, its parts, the
// destinations and their parts (indicator, icon wrapper, icon, label, badge), colours, label typography, tab stops,
// roles and names, and every flat pixel of the rail (slotted brand / avatar / name stand-ins masked). rail-parts.html
// (rail-web-paint-parts): the header slot and every exported part styled through ::part() — the native typed part
// appearances (.awcNavigationRailPartAppearance / .awcNavigationRailTabPartAppearance) with the authored values.
@Observable final class RailPaintState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var width = 420.0
    var height = 560.0
    var origin = CGPoint(x: 24, y: 24)
    var viewport: CGSize? = nil
    var appearance = AWCNavigationRailAppearance()
    var railParts: [(AWCNavigationRailPart, AWCNavigationRailPartAppearance)] = []
    var tabParts: [(AWCNavigationRailTabPart, AWCNavigationRailPartAppearance)] = []
    var measurements: [AWCNativeInspectionNode] = []
}
/// Applies the case's part rules through the public typed part API.
struct RailPartsApplied: ViewModifier {
    let rail: [(AWCNavigationRailPart, AWCNavigationRailPartAppearance)], tab: [(AWCNavigationRailTabPart, AWCNavigationRailPartAppearance)]
    func body(content: Content) -> some View {
        let railed = rail.reduce(AnyView(content)) { v, p in AnyView(v.awcNavigationRailPartAppearance(p.1, part: p.0)) }
        tab.reduce(railed) { v, p in AnyView(v.awcNavigationRailTabPartAppearance(p.1, part: p.0)) }
    }
}
struct RailPaintFixture: View {
    let state: RailPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = railInspectionIDs(state.nodes)
        ZStack(alignment: .topLeading) {
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) { ForEach(state.nodes) { AWCNativeView(node: $0) } }
                    .frame(width: state.width, height: state.height, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: state.origin.x, y: state.origin.y)
        }
        .awcNavigationRailAppearance(state.appearance)
        .modifier(RailPartsApplied(rail: state.railParts, tab: state.tabParts))
        .environment(\.awcNavigationRailViewport, state.viewport)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // The reference page's body (surface-container-low): what a modal rail's scrim covers.
        .background(Color(awcHex: theme.tokens["--md-sys-color-surface-container-low"] ?? "#F7F2FA")).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeNavigationRailPaintIntegration {
    static let state = RailPaintState()
    static var host: NSHostingView<RailPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> RailGrid {
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
    /// CSS colours: rgb(), rgba() and `color(srgb r g b / a)` (Chrome's color-mix result).
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba"), n.count >= 4 { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb"), n.count >= 3 { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count >= 4 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func hooks(_ v: AWCValue) -> [String: String] { guard case .object(let o) = v else { return [:] }; return o.compactMapValues(\.string) }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasSuffix(":" + id) || $0.id.contains(":" + id + ":") || $0.id.hasPrefix(id + ".")) }
    }
    static func rect(_ v: AWCValue) -> CGRect? { guard let x = v["x"].number, let y = v["y"].number, let w = v["width"].number, let h = v["height"].number else { return nil }; return CGRect(x: x, y: y, width: w, height: h) }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        var nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(c["nodesJSON"].string.utf8))
        let hostRect = rect(c["host"]["rect"]) ?? .zero
        state.appearance = AWCNavigationRailAppearance(css: hooks(nodes.first?.properties["_hooks"] ?? .null))
        func partValues(_ v: AWCValue) -> [(String, AWCNavigationRailPartAppearance)] {
            guard case .object(let o) = v else { return [] }
            return o.keys.sorted().compactMap { k in if case .object(let f) = o[k]! { return (k, AWCNavigationRailPartAppearance(values: f)) }; return nil }
        }
        state.railParts = partValues(c["partsRail"]).compactMap { k, v in AWCNavigationRailPart(rawValue: k).map { ($0, v) } }
        state.tabParts = partValues(c["partsTab"]).compactMap { k, v in AWCNavigationRailTabPart(rawValue: k).map { ($0, v) } }
        let styled = !state.railParts.isEmpty || !state.tabParts.isEmpty
        if let d = c["density"].number, d != 0 { nodes = nodes.map { n in var n = n; if n.properties["density"] == nil { n.properties["density"] = .number(d) }; return n } }
        state.nodes = nodes
        let modal = nodes.first?.properties["modal"]?.bool == true
        state.width = c["width"].number ?? 420
        state.height = modal ? 560 : (nodes.first?.properties["orientation"]?.string == "horizontal" ? 120 : 560)
        state.origin = CGPoint(x: 24, y: Double(hostRect.minY))
        state.viewport = name == "full-height" ? CGSize(width: 1200, height: 900) : nil
        state.measurements = []; state.epoch += 1; pump(0.7)
        if ProcessInfo.processInfo.environment["AWC_RAIL_DUMP"] != nil { for n in state.measurements { print("MEAS \(n.id) \(n.name) \(n.bounds) \(n.metrics)") }; fflush(stdout) }
        func near(_ a: Double?, _ b: Double?, _ label: String, _ tol: Double = 0.75) { check(a != nil && b != nil && abs(a! - b!) <= tol, "\(name) \(label) \(a ?? .nan) vs \(b ?? .nan)") }
        func box(_ r: CGRect?, _ w: CGRect?, _ label: String, _ tol: Double = 0.75) {
            guard let r, let w else { check(false, "\(name) \(label) measured"); return }
            near(Double(r.minX), Double(w.minX), "\(label) x", tol); near(Double(r.minY), Double(w.minY), "\(label) y", tol)
            near(Double(r.width), Double(w.width), "\(label) width", max(1, tol)); near(Double(r.height), Double(w.height), "\(label) height", max(1, tol))
        }
        guard let railNode = nodes.first, let rail = m(railNode.id, "md-navigation-rail") else { check(false, "\(name) rail measured"); return }
        let hv = rail.metrics["host"]?.array.compactMap(\.number) ?? []
        let nativeHost = hv.count == 4 ? CGRect(x: Double(rail.bounds.minX) + hv[0], y: Double(rail.bounds.minY) + hv[1], width: hv[2], height: hv[3]) : nil
        box(nativeHost, hostRect, "host")
        let parts = c["parts"]
        if modal {
            if let cont = m(railNode.id, "container") { box(cont.bounds, rect(parts["container"]["rect"]), "modal surface")
                check(colorClose(cont.metrics["background"], parts["container"]["backgroundColor"].string), "\(name) modal surface colour \(String(describing: cont.metrics["background"])) vs \(parts["container"]["backgroundColor"].string)") }
            if let scrim = m(railNode.id, "scrim") { box(scrim.bounds, rect(parts["scrim"]["rect"]), "scrim"); near(scrim.metrics["opacity"]?.number, Double(parts["scrim"]["opacity"].string), "scrim opacity", 0.01) }
        } else {
            check(colorClose(rail.metrics["background"], c["host"]["style"]["backgroundColor"].string), "\(name) rail colour \(String(describing: rail.metrics["background"])) vs \(c["host"]["style"]["backgroundColor"].string)")
        }
        if let d = m(railNode.id, "destinations"), let wr = rect(parts["destinations"]["rect"]), wr.width > 0 { box(d.bounds, wr, "destinations") }
        if let t = m(railNode.id, "toggle"), let wr = rect(parts["toggle"]["rect"]), wr.width > 0 { near(Double(t.bounds.minY), Double(wr.minY), "toggle y"); near(Double(t.bounds.height), Double(wr.height), "toggle height") }
        if let o = m(railNode.id, "overflow-trigger"), let wr = rect(parts["overflow-trigger"]["rect"]), wr.width > 0 { box(o.bounds, wr, "overflow trigger") }
        for k in ["footer-leading", "footer-content"] where (rect(parts[k]["rect"])?.width ?? 0) > 0 {
            guard let p = m(railNode.id, k) else { check(false, "\(name) \(k) measured"); continue }
            let wr = rect(parts[k]["rect"])!
            if k == "footer-content" {
                near(Double(p.bounds.minX), Double(wr.minX), "\(k) x"); near(Double(p.bounds.width), Double(wr.width), "\(k) width", 1.5); near(Double(p.bounds.midY), Double(wr.midY), "\(k) centre y", 1)
                check(colorClose(p.metrics["color"], parts[k]["color"].string), "\(name) \(k) colour \(String(describing: p.metrics["color"])) vs \(parts[k]["color"].string)")
                near(p.metrics["fontSize"]?.number, numbers(parts[k]["fontSize"].string).first, "\(k) font size", 0.01)
                near(p.metrics["fontWeight"]?.number, Double(parts[k]["fontWeight"].string), "\(k) font weight", 0.5)
                if parts[k]["visibility"].string != "hidden" { near(p.metrics["opacity"]?.number, Double(parts[k]["opacity"].string), "\(k) opacity", 0.01) }
            }
            else { box(p.bounds, wr, k) }
        }
        if let o = m(railNode.id, "overflow-trigger"), parts["overflow-trigger"]["color"] != .null {
            check(colorClose(o.metrics["color"], parts["overflow-trigger"]["color"].string), "\(name) overflow trigger colour \(String(describing: o.metrics["color"])) vs \(parts["overflow-trigger"]["color"].string)")
        }
        // Painted part boxes: each authored background at the source part's box, in its colour.
        for (part, value) in state.railParts where value.backgroundColor != nil && part != .scrim && !(modal && part == .container) {
            let k = part.rawValue
            guard let b = m(railNode.id, "box-" + k) else { check(false, "\(name) \(k) box measured"); continue }
            box(b.bounds, rect(parts[k]["rect"]), "\(k) box", 1)
            check(colorClose(b.metrics["color"], parts[k]["backgroundColor"].string), "\(name) \(k) box colour \(String(describing: b.metrics["color"])) vs \(parts[k]["backgroundColor"].string)")
        }
        let fabWeb = c["others"].array.first { $0["tag"].string == "md-fab" }
        if let fabWeb, let fabNode = railNode.children.first(where: { $0.tag == "md-fab" }) {
            let fab = state.measurements.first { $0.name == "md-fab" && ($0.id == fabNode.id || $0.id.hasPrefix(fabNode.id)) }
            box(fab?.bounds, rect(fabWeb["rect"]), "fab", 1)
        }
        // A slotted header icon button: on the rail's axis (vertical), centred in a bar.
        if let hw = c["others"].array.first(where: { $0["tag"].string == "md-icon-button" }) {
            box(m(railNode.id + "-header", "md-icon-button")?.bounds, rect(hw["rect"]), "header icon button", 1)
        }
        // Destinations.
        let tabsWeb = c["tabs"].array, tabNodes = railNode.children.filter { $0.tag == "md-navigation-rail-tab" }
        let axTabs = c["ax"].array.filter { ["tab", "link"].contains($0["role"].string) }
        var axIndex = 0
        for (i, wt) in tabsWeb.enumerated() where i < tabNodes.count {
            let id = tabNodes[i].id, attrs = wt["attrs"], lbl = "tab\(i)"
            guard let tab = m(id, "md-navigation-rail-tab") else { check(false, "\(name) \(lbl) measured"); continue }
            let overflowedWeb = attrs["data-overflowed"] != .null
            check((tab.metrics["overflowed"]?.bool ?? false) == overflowedWeb, "\(name) \(lbl) overflowed")
            check((tab.metrics["tabStop"]?.bool ?? false) == (attrs["tabindex"].string == "0"), "\(name) \(lbl) tab stop \(tab.metrics["tabStop"]?.bool ?? false) vs \(attrs["tabindex"].string)")
            check((tab.metrics["role"]?.string ?? "") == attrs["role"].string, "\(name) \(lbl) role")
            check((tab.metrics["active"]?.bool ?? false) == (attrs["active"] != .null), "\(name) \(lbl) active")
            if overflowedWeb { continue }
            if axIndex < axTabs.count { check(tab.metrics["name"]?.string == axTabs[axIndex]["name"].string, "\(name) \(lbl) name \(tab.metrics["name"]?.string ?? "") vs \(axTabs[axIndex]["name"].string)"); axIndex += 1 }
            box(tab.bounds, rect(wt["rect"]), "\(lbl)")
            check(colorClose(tab.metrics["color"], wt["style"]["color"].string), "\(name) \(lbl) colour \(String(describing: tab.metrics["color"])) vs \(wt["style"]["color"].string)")
            let p = wt["parts"]
            if p["indicator"]["display"].string != "none", let ind = m(id, "indicator") {
                box(ind.bounds, rect(p["indicator"]["rect"]), "\(lbl) indicator")
                check(colorClose(ind.metrics["color"], p["indicator"]["backgroundColor"].string), "\(name) \(lbl) indicator colour \(String(describing: ind.metrics["color"])) vs \(p["indicator"]["backgroundColor"].string)")
                if let r = numbers(p["indicator"]["borderTopLeftRadius"].string).first, let wr = rect(p["indicator"]["rect"]) { near(ind.metrics["radius"]?.number, min(r, Double(min(wr.width, wr.height)) / 2), "\(lbl) indicator radius", 0.01) }
            }
            if let iw = m(id, "icon-wrapper") { box(iw.bounds, rect(p["icon-wrapper"]["rect"]), "\(lbl) icon wrapper")
                if p["indicator"]["display"].string == "none" { check(colorClose(iw.metrics["color"], p["icon-wrapper"]["backgroundColor"].string), "\(name) \(lbl) pill colour") } }
            if styled, let sl = m(id, "state-layer"), p["state-layer"]["display"].string != "none", p["indicator"]["display"].string != "none" {
                check(colorClose(sl.metrics["color"], p["state-layer"]["backgroundColor"].string), "\(name) \(lbl) state layer colour \(String(describing: sl.metrics["color"])) vs \(p["state-layer"]["backgroundColor"].string)")
                near(sl.metrics["opacity"]?.number, Double(p["state-layer"]["opacity"].string), "\(lbl) state layer opacity", 0.01)
            }
            if let icon = m(id, "icon") {
                box(icon.bounds, rect(p["icon"]["rect"]), "\(lbl) icon")
                if let ws = numbers(p["icon"]["fontSize"].string).first { near(icon.metrics["size"]?.number, ws, "\(lbl) icon glyph size", 0.01) }
                check(colorClose(icon.metrics["color"], p["icon"]["color"].string), "\(name) \(lbl) icon colour \(String(describing: icon.metrics["color"])) vs \(p["icon"]["color"].string)")
                near(icon.metrics["fill"]?.number, p["icon"]["fontVariationSettings"].string.contains("\"FILL\" 1") ? 1 : 0, "\(lbl) icon fill", 0.01)
            }
            let labelShown = p["label"] != .null && p["label"]["display"].string != "none"
            let label = m(id, "label")
            check((label != nil) == labelShown, "\(name) \(lbl) label presence")
            if labelShown, let label {
                box(label.bounds, rect(p["label"]["rect"]), "\(lbl) label", 1)
                check(colorClose(label.metrics["color"], p["label"]["color"].string), "\(name) \(lbl) label colour \(String(describing: label.metrics["color"])) vs \(p["label"]["color"].string)")
                near(label.metrics["opacity"]?.number, Double(p["label"]["opacity"].string), "\(lbl) label opacity", 0.01)
                near(label.metrics["fontWeight"]?.number, Double(p["label"]["fontWeight"].string), "\(lbl) label weight", 0.5)
                near(label.metrics["fontSize"]?.number, numbers(p["label"]["fontSize"].string).first, "\(lbl) label size", 0.01)
                near(label.metrics["lineHeight"]?.number, numbers(p["label"]["lineHeight"].string).first, "\(lbl) label line height", 0.01)
                near(label.metrics["letterSpacing"]?.number, numbers(p["label"]["letterSpacing"].string).first ?? 0, "\(lbl) label letter spacing", 0.01)
            }
            let badge = m(id, "badge")
            check((badge != nil) == (p["badge"] != .null), "\(name) \(lbl) badge presence")
            if p["badge"] != .null, let badge {
                box(badge.bounds, rect(p["badge"]["rect"]), "\(lbl) badge", 1)
                check(colorClose(badge.metrics["color"], p["badge"]["backgroundColor"].string), "\(name) \(lbl) badge colour")
                if (rect(p["badge"]["rect"])?.height ?? 0) > 8 {
                    check(badge.metrics["text"]?.string == p["badge"]["text"].string, "\(name) \(lbl) badge text \(badge.metrics["text"]?.string ?? "") vs \(p["badge"]["text"].string)")
                    check(colorClose(badge.metrics["textColor"], p["badge"]["color"].string), "\(name) \(lbl) badge text colour")
                }
            }
        }
        // Paint: every flat CSS pixel of the rail (the modal: its overlay box), brand / avatar / name stand-ins masked.
        let clip = c["clip"], ox = clip["x"].number ?? 0, oy = clip["y"].number ?? 0
        // The compared area lies inside the oracle's clip (the modal overlay box can extend past the captured shot).
        let shotBox = CGRect(x: ox, y: oy, width: clip["width"].number ?? 0, height: clip["height"].number ?? 0)
        let area = (modal ? (rect(parts["scrim"]["rect"]) ?? hostRect) : hostRect).intersection(shotBox)
        let cx = Int(Double(area.minX).rounded(.up)), cy = Int(Double(area.minY).rounded(.up)), cw = Int(Double(area.maxX).rounded(.down)) - Int(Double(area.minX).rounded(.up)), ch = min(Int(Double(area.maxY).rounded(.down)) - Int(Double(area.minY).rounded(.up)), 860)
        let masks: [CGRect] = (styled
            ? [m(railNode.id, "logo-contracted")?.bounds, rect(parts["footer-leading"]["rect"]), rect(parts["footer-content"]["rect"])].compactMap { $0 }
            : ["logo", "logo-contracted", "logo-expanded", "footer-leading", "footer-content"].compactMap { rect(parts[$0]["rect"]) })
            .filter { $0.width > 0 }.map { $0.insetBy(dx: -2, dy: -2) }
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: Double(src.width) / (clip["width"].number ?? 1), origin: .init(x: ox, y: oy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch)), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = "", wf = 0, nf = 0
        for py in (cy + 1)..<max(cy + 1, cy + ch - 1) { for px in (cx + 1)..<max(cx + 1, cx + cw - 1) {
            let a = web.flat(px, py, 6), b = nat.flat(px, py, 6); if a { wf += 1 }; if b { nf += 1 }
            guard a && b && !masks.contains(where: { $0.contains(CGPoint(x: Double(px) + 0.5, y: Double(py) + 0.5)) }) else { continue }
            let d = diff(web.at(px, py), nat.at(px, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(web.at(px, py).map { Int($0) }) native \(nat.at(px, py).map { Int($0.rounded()) })" } } }
        check(n > 0 && Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt); area \(cx),\(cy) \(cw)x\(ch), flat web \(wf) native \(nf), web grid \(web.values.first ?? 0 > -999 ? "ok" : "missing"), native grid \(nat.values.first ?? 0 > -999 ? "ok" : "missing"))")
        if let dir = ProcessInfo.processInfo.environment["AWC_RAIL_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
    }
    /// A hidden destination (Web: display: none) keeps its index — activeIndex 2 is the third destination — and takes no box:
    /// the third sits where the second would (no oracle case: the source's own layout rule, checked on the rendered rail).
    static func hiddenDestination() {
        state.dark = false; state.rtl = false; state.appearance = AWCNavigationRailAppearance(css: [:]); state.railParts = []; state.tabParts = []
        func tab(_ id: String, _ label: String, hidden: Bool = false) -> AWCNode {
            var p: [String: AWCValue] = ["label": .string(label), "icon": .string("home")]; if hidden { p["hidden"] = .bool(true) }
            return AWCNode(id: id, tag: "md-navigation-rail-tab", properties: p)
        }
        state.nodes = [AWCNode(id: "hr", tag: "md-navigation-rail", properties: ["activeIndex": .number(2), "label": .string("Navigation")],
                               children: [tab("hr0", "Home"), tab("hr1", "Saved", hidden: true), tab("hr2", "Settings")])]
        state.width = 420; state.height = 560; state.origin = CGPoint(x: 24, y: 24); state.viewport = nil
        state.measurements = []; state.epoch += 1; pump(0.7)
        let a = m("hr0", "md-navigation-rail-tab"), c = m("hr2", "md-navigation-rail-tab"), h = m("hr1", "md-navigation-rail-tab")
        check(a != nil && c != nil, "hidden destination: the shown destinations render")
        if let a, let c {
            check(c.bounds.minY - a.bounds.minY < a.bounds.height * 1.5, "hidden destination: the third follows the first directly (\(a.bounds.minY) → \(c.bounds.minY))")
            check(c.metrics["active"]?.bool == true && a.metrics["active"]?.bool != true, "hidden destination: activeIndex 2 is the third destination")
        }
        check(h == nil || h!.metrics["overflowed"]?.bool == true || h!.bounds.height < 0.5, "hidden destination: draws nothing (\(h.map { "\($0.bounds) \($0.metrics)" } ?? "none"))")
        print("hidden destination checked"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: RailPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 960), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_RAIL_ONLY"]
        for file in ["rail-web-paint", "rail-web-paint-parts"] {
            let url = fixtures.appendingPathComponent(file + ".json")
            guard let data = try? Data(contentsOf: url) else { check(false, "\(file) fixture"); continue }
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: data)
            for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent(file)) }
        }
        if only == nil { hiddenDestination() }
        if let output = ProcessInfo.processInfo.environment["AWC_RAIL_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Navigation rail native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
/// Every node the fixture inspects: the rails, their toggles, destinations (with their ripples) and slotted children.
func railInspectionIDs(_ nodes: [AWCNode]) -> [String] {
    var out: [String] = []
    for n in nodes {
        out.append(n.id); out.append(n.id + "-toggle")
        for c in n.children {
            out.append(c.id); out.append(c.id + "-ripple")
            for g in c.children { out.append(g.id) }
        }
    }
    return out
}
struct RailGrid {
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
