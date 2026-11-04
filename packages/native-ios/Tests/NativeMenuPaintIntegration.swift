import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-menu family paint and geometry against Chrome 153 (Mac oracle: outputs/native-parity/md-menu/web-oracle/web-paint.json,
// 138 cases from menu.html). The case markup is compiled to AWCNode trees (html-node.mjs) and rendered through the
// production dispatch (AWCNativeView) inside an AWCMenuScope. Every md-* box and [part] box of the oracle tree, row roles
// and aria-checked, and every flat pixel of the clipped screenshot are compared.
@Observable final class MenuPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
    var registry = AWCMenuRegistry()
}
struct MenuAnchorView: View {
    let node: AWCNode, theme: AWCTheme
    var body: some View {
        let t = theme.tokens
        Text(node.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size: 14, weight: 500)).lineLimit(1).fixedSize()
            .foregroundStyle(Color(awcHex: t["--md-sys-color-on-surface"] ?? "#1D1B20"))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Capsule().fill(Color(awcHex: t["--md-sys-color-surface"] ?? "#FEF7FF")))
            .overlay(Capsule().strokeBorder(Color(awcHex: t["--md-sys-color-outline"] ?? "#79747E"), lineWidth: 1))
    }
}
struct MenuPaintFixture: View {
    let state: MenuPaintState
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func nodes(_ c: AWCValue) -> [AWCNode] {
        c["nodes"].array.compactMap { v in (try? JSONEncoder().encode(v)).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } }
    }
    static func ids(_ n: AWCNode) -> [String] { [n.id] + n.children.flatMap(ids) }
    static func flatten(_ n: AWCNode) -> [AWCNode] { [n] + n.children.flatMap(flatten) }
    var body: some View {
        let c = state.c, epoch = state.epoch
        var tokens: [String: String] = [:]; if case .object(let o) = c["tokens"] { for (k, v) in o { tokens[k] = v.string } }
        var hooks: [String: String] = [:]; if case .object(let o) = c["hooks"] { for (k, v) in o { hooks[k] = v.string } }
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark", tokens: tokens)
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        let box = Self.rect(c["box"]), anchor = Self.rect(c["anchor"])
        let rtl = c["dir"].string == "rtl", closed = c["closed"] == .bool(true)
        let all = Self.nodes(c).map { n -> AWCNode in var n = n; if n.id == "m" && !closed { n.properties["open"] = true }; return n }
        let density = c["density"].number ?? 0
        return AWCMenuScope(registry: state.registry) {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FEF7FF").frame(maxWidth: .infinity, maxHeight: .infinity)
                ForEach(all) { n in
                    if n.tag == "#anchor" {
                        MenuAnchorView(node: n, theme: theme).frame(width: anchor.width, height: anchor.height)
                            .awcMenuAnchor(n.id).padding(.leading, anchor.minX).padding(.top, anchor.minY)
                    } else {
                        AWCNativeView(node: n).fixedSize()
                            .frame(width: box.width, alignment: rtl ? .topTrailing : .topLeading)
                            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                            .padding(.leading, box.minX).padding(.top, box.minY)
                    }
                }
            }
        }
        .awcMenuAppearance(AWCMenuAppearance(css: hooks))
        .awcMenuHeader(for: "m") { MenuHeaderView(nodes: all, theme: theme) }
        .awcMenuReducedMotion(false)
        .modifier(MenuGlobalDensity(value: density))
        .awcTheme(theme)
        .awcNativeInspection(rootID: all.flatMap(Self.ids).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 1200, height: vp.last ?? 900, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
/// `<div slot="header" style="padding:8px 12px;font:500 12px Roboto;color:var(--md-sys-color-on-surface-variant)">`.
struct MenuHeaderView: View {
    let nodes: [AWCNode], theme: AWCTheme
    var body: some View {
        if let h = nodes.first(where: { $0.id == "m" })?.children.first(where: { $0.slot == "header" }) {
            Text(h.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size: 12, weight: 500)).modifier(AWCCSSLineBox(size: 12, line: AWCCSSLineBox.natural(12)))
                .foregroundStyle(Color(awcHex: theme.tokens["--md-sys-color-on-surface-variant"] ?? "#49454F"))
                .padding(.vertical, 8).padding(.horizontal, 12).frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
struct MenuGlobalDensity: ViewModifier {
    let value: Double
    func body(content: Content) -> some View { if value != 0 { content.awcDensity(value) } else { content } }
}
struct MenuGrid {
    let w: Int, h: Int; var v: [Float]
    func flat(_ px: Int, _ py: Int, _ limit: Float) -> Bool {
        guard px >= 1 && py >= 1 && px + 1 < w && py + 1 < h else { return false }
        for k in 0..<3 {
            var lo: Float = 999, hi: Float = -1
            for y in (py - 1)...(py + 1) { for x in (px - 1)...(px + 1) { let q = v[(y * w + x) * 3 + k]; lo = min(lo, q); hi = max(hi, q) } }
            if hi - lo > limit { return false }
        }
        return true
    }
    func at(_ px: Int, _ py: Int) -> [Int] { let i = (py * w + px) * 3; return [Int(v[i]), Int(v[i + 1]), Int(v[i + 2])] }
}
@main @MainActor enum NativeMenuPaintIntegration {
    static let state = MenuPaintState()
    static var host: NSHostingView<MenuPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var warmed = false
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> MenuGrid {
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k), cw = cg.width, ch = cg.height
        var v = [Float](repeating: -999, count: w * h * 3)
        for py in 0..<h { for px in 0..<w {
            var r: Float = 0, g: Float = 0, b: Float = 0
            for yy in ((py + y0) * k)..<max((py + y0) * k, min(ch, (py + y0) * k + k)) { for xx in ((px + x0) * k)..<max((px + x0) * k, min(cw, (px + x0) * k + k)) { let i = (yy * cw + xx) * 4; r += Float(buffer[i]); g += Float(buffer[i + 1]); b += Float(buffer[i + 2]) } }
            let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = b / n
        } }
        return .init(w: w, h: h, v: v)
    }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    /// `h` widens only the horizontal checks (x, width): the fallback-font slack never moves anything vertically.
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double, _ h: Double = 0) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol + h && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol + h && abs(a.height - b.height) <= tol }
    /// iOS only: a trailing text with a symbol drawn from the platform fallback font (U+2190–U+2BFF, e.g. ⌘) has another
    /// advance than Mac Chrome's fallback (as on Android). The largest such difference widens the horizontal box checks and
    /// the surfaces' edge bands are masked from the pixel comparison. macOS shares Chrome's fallback: no slack.
    static var slack = 0.0
    static func fallbackGlyphs(_ s: String) -> Bool { s.unicodeScalars.contains { (0x2190...0x2BFF).contains($0.value) } }
    static func fallbackSlack(_ t: AWCValue, _ m: [String: AWCNativeInspectionNode], _ texts: [String: String]) -> Double {
        var out = 0.0
        let id = t["id"].string
        if fallbackGlyphs(texts[id] ?? ""), let p = t["parts"].array.first(where: { $0["part"].string == "trailing" }), let n = m[id + ":component.trailing"] {
            out = abs(n.bounds.width - MenuPaintFixture.rect(p["rect"]).width)
        }
        for c in t["children"].array { out = max(out, fallbackSlack(c, m, texts)) }
        return out
    }
    static func menus(_ t: AWCValue) -> [AWCValue] { (t["tag"].string == "md-menu" ? [t] : []) + t["children"].array.flatMap(menus) }
    /// Inspection, row state and motion settle (the open motion and the focus state layer of the first row finish before capture).
    static func settle(_ timeout: Double = 2) {
        func signature() -> String {
            state.measurements.filter { $0.name == "md-menu-item" || $0.name == "md-sub-menu-item" || $0.name == "md-menu-motion" }
                .map { n in "\(n.id) \(n.metrics["focusRing"] ?? .null) \(n.metrics["layerOpacity"] ?? .null) \(n.metrics["progress"] ?? .null) \(d(n.bounds))" }.sorted().joined(separator: "|")
        }
        let end = Date().addingTimeInterval(timeout); var last = signature(), stable = 0
        while Date() < end && stable < 3 { pump(0.05); let next = signature(); stable = next == last ? stable + 1 : 0; last = next }
    }
    static let textParts: Set<String> = ["headline", "supporting-text", "content", "trailing", "badge", "empty-text"]
    /// Oracle tree vs native inspection: host and part boxes, roles and aria-checked.
    static func compare(_ t: AWCValue, _ name: String, _ m: [String: AWCNativeInspectionNode]) {
        let id = t["id"].string, web = MenuPaintFixture.rect(t["rect"]), tag = t["tag"].string
        guard web.width > 0 || web.height > 0 else { return }
        let native = m[id + ":component"]
        if tag == "md-menu" {
            // The host is the surface box (position: fixed, display: block around the surface).
            check(near(native?.bounds, web, 0.75, slack), "\(name) \(id) md-menu \(d(native?.bounds)) vs \(d(web))")
        } else {
            check(near(native?.bounds, web, 0.75, slack), "\(name) \(id) \(tag) \(d(native?.bounds)) vs \(d(web))")
        }
        for p in t["parts"].array {
            let part = p["part"].string, r = MenuPaintFixture.rect(p["rect"])
            guard r.width > 0 && r.height > 0, p["display"].string != "none" else { continue }
            if part == "empty-text" && t["parts"].array.contains(where: { $0["part"].string == "empty-text" }) && native == nil { continue }
            let n = m[id + ":component." + part]
            check(near(n?.bounds, r, textParts.contains(part) ? 1.0 : 0.75, slack), "\(name) \(id) \(part) \(d(n?.bounds)) vs \(d(r))")
        }
        let attrs = t["attrs"]
        if tag == "md-menu-item" || tag == "md-sub-menu-item" {
            check(native?.metrics["role"]?.string == attrs["role"].string, "\(name) \(id) role \(native?.metrics["role"]?.string ?? "nil") vs \(attrs["role"].string)")
            let checked = attrs["aria-checked"].string, nativeChecked = native?.metrics["ariaChecked"]?.string ?? ""
            check(checked == nativeChecked, "\(name) \(id) aria-checked \(nativeChecked) vs \(checked)")
        }
        if tag == "md-menu-item-group" { check(native?.metrics["role"]?.string == "group", "\(name) \(id) group role") }
        for child in t["children"].array { compare(child, name, m) }
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.registry = AWCMenuRegistry()
        state.c = c; state.epoch += 1; pump(warmed ? 0.4 : 1.2); warmed = true
        if let p = c["prepare"].string.isEmpty ? nil : c["prepare"].string {
            if p == "submenu", let root = state.registry.controllers["m"] {
                let row = root.rowOrder.first { root.rows[$0]?.sub == true } ?? ""
                _ = root.focus(row, ring: true); pump(0.05); root.rows[row]?.openSubmenu(true); pump(0.4)
            } else if p.hasPrefix("scroll:"), let root = state.registry.controllers["m"] { root.scrollTop = Double(p.dropFirst(7)) ?? 0; pump(0.2) }
        }
        settle()
        let m = Dictionary(state.measurements.map { ($0.id, $0) }, uniquingKeysWith: { _, b in b })
        #if os(iOS)
        let texts = Dictionary(MenuPaintFixture.nodes(c).flatMap(MenuPaintFixture.flatten).map { ($0.id, $0.properties["trailingText"]?.string ?? "") }, uniquingKeysWith: { a, _ in a })
        slack = c["closed"] == .bool(true) ? 0 : fallbackSlack(c["tree"], m, texts)
        #else
        slack = 0
        #endif
        // With a fallback-font slack the surfaces' edges (and their shadows) may sit up to `slack` apart: those bands are masked.
        var masks: [CGRect] = []
        if slack > 0 { for t in menus(c["tree"]) {
            guard let n = m[t["id"].string + ":component.surface"]?.bounds else { continue }
            let w = MenuPaintFixture.rect(t["rect"]), top = min(n.minY, w.minY) - 4, bottom = max(n.maxY, w.maxY) + 12
            for (a, b) in [(n.minX, w.minX), (n.maxX, w.maxX)] { masks.append(CGRect(x: min(a, b) - 4, y: top, width: abs(a - b) + 14, height: bottom - top)) }
        } }
        if ProcessInfo.processInfo.environment["AWC_MENU_DEBUG"] != nil, let root = state.registry.controllers["m"] {
            print("  focus \(name): focused=\(root.focusedID ?? "nil") ringed=\(root.ringed ?? "nil") responder=\(String(describing: window.firstResponder).prefix(80)) host=\(host.frame) rows=\(root.rowOrder.prefix(3))")
            for id in root.rowOrder.prefix(2) { print("    row \(id) ring=\(m[id + ":component"]?.metrics["focusRing"] ?? .null) layer=\(m[id + ":component"]?.metrics["layerOpacity"] ?? .null)") }
        }
        if c["closed"] == .bool(true) {
            check(m["m:component.surface"] == nil, "\(name) closed menu paints no surface")
        } else {
            compare(c["tree"], name, m)
        }
        // Paint: flat pixels of the clipped Chrome screenshot.
        let clip = MenuPaintFixture.rect(c["clip"])
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        if let dir = ProcessInfo.processInfo.environment["AWC_MENU_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        let w = min(source.width, Int(clip.width)), h = min(source.height, Int(clip.height))
        let web = grid(source, scale: 1, x0: 0, y0: 0, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, x0: Int(clip.minX), y0: Int(clip.minY), w: w, h: h)
        var n = 0, bad = 0, sum = 0.0, worst: Float = 0, at = ""
        for py in 1..<max(1, h - 1) { for px in 1..<max(1, w - 1) {
            guard web.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
            if !masks.isEmpty, masks.contains(where: { $0.contains(CGPoint(x: Double(px) + clip.minX + 0.5, y: Double(py) + clip.minY + 0.5)) }) { continue }
            let i = (py * w + px) * 3
            let q = max(abs(web.v[i] - nat.v[i]), max(abs(web.v[i + 1] - nat.v[i + 1]), abs(web.v[i + 2] - nat.v[i + 2])))
            n += 1; sum += Double(max(0, q - 1)); if q > 6 { bad += 1 }
            if q > worst { worst = q; at = "(\(px + Int(clip.minX)),\(py + Int(clip.minY))) web \(web.at(px, py)) native \(nat.at(px, py))" }
        } }
        let ratio = Double(bad) / Double(max(1, n)), mean = sum / Double(max(1, n))
        check(Double(n) / Double(max(1, (w - 2) * (h - 2))) > 0.4, "\(name) flat-pixel coverage \(n)")
        check(ratio <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(String(format: "%.3f", mean)), >6: \(bad)/\(n), worst \(worst) at \(at))")
        report.append(["case": name, "compared": n, "meanBeyondOneLevel": mean, "over6": bad, "worst": worst, "worstAt": at, "fallbackSlack": slack])
        print("case \(name): \(checks - failures.count)/\(checks)"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: MenuPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("menu-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_MENU_ONLY"]
        for c in oracle["cases"].array where only.map({ o in o.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("menu-web-paint")) }
        if let out = ProcessInfo.processInfo.environment["AWC_MENU_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Menu native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
