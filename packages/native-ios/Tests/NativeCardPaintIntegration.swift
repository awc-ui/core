import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-card paint and geometry against Chrome (web-oracle/paint.html, DPR 1): 360 matrix cases
// (variant × theme × direction × density × state), all fourteen hooks × variant × theme ×
// direction × state, each hook alone, both parts, and 25 layout/composition cases. Geometry,
// computed style (padding, gap, typography, colours, shadow list, outline, state layer, role and
// tabindex), every flat pixel of the source clip, and the AWCNativeView dispatch path.
@Observable final class CardPaintFixtureState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
struct CardPaintFixture: View {
    let state: CardPaintFixtureState
    static func hex(_ s: String) -> String { s.uppercased() }
    static func shadow(_ css: String) -> [AWCBoxShadow] { AWCBoxShadow.source(css) ?? [] }
    static func length(_ css: String?) -> AWCCardLength? { css.flatMap { AWCCardLength(css: $0) } }
    static func corners(_ css: String) -> AWCCornerShape {
        let halves = css.split(separator: "/").map { $0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
        func four(_ v: [Double]) -> [Double] { v.count == 1 ? [v[0], v[0], v[0], v[0]] : v.count == 2 ? [v[0], v[1], v[0], v[1]] : v.count == 3 ? [v[0], v[1], v[2], v[1]] : v }
        let h = four(halves[0]), v = halves.count > 1 ? four(halves[1]) : h
        func r(_ i: Int) -> AWCCornerRadius { .init(x: .points(h[i]), y: .points(v[i])) }
        return .init(topLeft: r(0), topRight: r(1), bottomRight: r(2), bottomLeft: r(3))
    }
    static func insets(_ css: String) -> AWCCardInsets {
        let v = css.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) }
        let f = v.count == 1 ? [v[0], v[0], v[0], v[0]] : v.count == 2 ? [v[0], v[1], v[0], v[1]] : v.count == 3 ? [v[0], v[1], v[2], v[1]] : v
        return .init(top: f[0], right: f[1], bottom: f[2], left: f[3])
    }
    static func appearance(_ hooks: AWCValue) -> AWCCardAppearance {
        func s(_ k: String) -> String? { hooks[k] == .null ? nil : hooks[k].string }
        return .init(containerColor: s("container-color"), containerShape: s("container-shape").map(corners), containerElevation: s("container-elevation").map(shadow),
                     outlineColor: s("outline-color"), outlineWidth: s("outline-width").flatMap { Double($0.replacingOccurrences(of: "px", with: "")) }, stateLayerColor: s("state-layer-color"),
                     width: length(s("width")), minWidth: length(s("min-width")), maxWidth: length(s("max-width")), height: length(s("height")), minHeight: length(s("min-height")), maxHeight: length(s("max-height")),
                     padding: s("padding").map(insets), gap: s("gap").flatMap { Double($0.replacingOccurrences(of: "px", with: "")) })
    }
    /// The oracle's authored light-DOM content as native views. Authored children take the box
    /// height Chrome gave them (UA controls and CSS line boxes are authored content, not card
    /// behaviour); the card lays them out, stretches them and clips them.
    static func item(_ text: String, _ h: Double, _ i: Int) -> some View {
        Text(text).frame(maxWidth: .infinity, minHeight: h, maxHeight: h, alignment: .topLeading).awcInspect(nodeID: "card", part: "child\(i)", name: "child\(i)")
    }
    static func box<V: View>(_ v: V, _ h: [Double], _ i: Int) -> some View {
        v.frame(maxWidth: .infinity, minHeight: h.count > i ? h[i] : 0, maxHeight: h.count > i ? h[i] : nil, alignment: .topLeading).awcInspect(nodeID: "card", part: "child\(i)", name: "child\(i)")
    }
    @ViewBuilder static func content(_ kind: String, _ h: [Double]) -> some View {
        switch kind {
        case "empty": EmptyView()
        case "button": box(Button("Authored action") {}, h, 0)
        case "focusable": box(Text("Custom control"), h, 0)
        case "authored":
            box(Text("Title").font(AWCNativeFonts.label(size: 20, weight: 500)), h, 0)
            box(Text("An authored paragraph that wraps when the available width changes."), h, 1)
            box(Button("Continue") {}, h, 2)
        case "overflow": item("Tall body", 300, 0)
        case "wrap": box(Text("A longer supporting paragraph that has to wrap across several lines inside a narrow card."), h, 0)
        case "media":
            Color(awcHex: "#7E57C2").frame(height: h.first ?? 96).awcInspect(nodeID: "card", part: "child0", name: "child0").padding(.horizontal, -16).padding(.top, -16)
            box(Text("Media title").font(AWCNativeFonts.label(size: 16, weight: 500)), h, 1)
            box(Text("Supporting text below the media block."), h, 2)
            box(HStack(spacing: 8) { Spacer(minLength: 0); Button("Cancel") {}; Button("Open") {} }, h, 3)
        default: item("Card title", 20, 0); item("Two lines of body content", 40, 1); item("Footer", 30, 2)
        }
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        var props: [String: AWCValue] = ["variant": .string(c["variant"].string.isEmpty ? "elevated" : c["variant"].string)]
        for k in ["interactive", "disabled", "softDisabled", "dragEnabled", "ripple", "fullWidth", "fullHeight", "hidden"] where c[k] != .null { props[k] = c[k] }
        if let d = c["density"].number { props["density"] = .number(d) }
        let kind = c["content"].string.isEmpty ? "default" : c["content"].string
        let parts = c["parts"] == .null ? AWCCardPartAppearance() : AWCCardPartAppearance(stateLayerColor: "#EE9955", outlineColor: "#44AA88", outlineWidth: 4)
        return ZStack(alignment: .topLeading) {
            AWCNativeCard(node: .init(id: "card", tag: "md-card", properties: props), theme: theme, interactiveContent: ["button", "focusable", "authored", "media"].contains(kind),
                          label: "Card", emit: { _, _ in }) { Self.content(kind, c["snap"]["children"].array.map { $0["rect"]["height"].number ?? 0 }) }
                .awcCardAppearance(c["hooks"] == .null ? .init() : Self.appearance(c["hooks"]))
                .awcCardPartAppearance(parts)
                .frame(width: 320, height: 240, alignment: .topLeading)
                .environment(\.awcNativeDensity, c["inheritedDensity"].number ?? 0)
                .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: 40, y: 40)
        }
        .awcTheme(theme)
        .awcNativeInspection(rootID: "card", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct CardGrid {
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
@main @MainActor enum NativeCardPaintIntegration {
    static let state = CardPaintFixtureState()
    static var host: NSHostingView<CardPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let captureDir = ProcessInfo.processInfo.environment["AWC_CARD_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> CardGrid {
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
    /// rgb()/rgba()/color(srgb …) → [r,g,b,a] 0…1.
    static func color(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return []
    }
    static func pre(_ c: [Double]) -> [Double] { c.count < 4 ? c : [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    /// Computed box-shadow → [x,y,blur,spread,r,g,b,a] per layer (Chrome lists the colour first).
    static func shadowList(_ s: String) -> [[Double]] {
        if s == "none" { return [] }
        var layers: [String] = [], depth = 0, cur = ""
        for ch in s { if ch == "(" { depth += 1 }; if ch == ")" { depth -= 1 }; if ch == "," && depth == 0 { layers.append(cur); cur = "" } else { cur.append(ch) } }
        layers.append(cur)
        return layers.map { layer in
            let t = layer.trimmingCharacters(in: .whitespaces), close = t.firstIndex(of: ")")!
            let c = color(String(t[...close])), rest = numbers(String(t[t.index(after: close)...]))
            return [rest[0], rest[1], rest.count > 2 ? rest[2] : 0, rest.count > 3 ? rest[3] : 0] + c
        }
    }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? .nan }
    static func near(_ a: CGRect?, _ b: AWCValue, _ tol: Double = 0.6) -> Bool {
        guard let a else { return false }
        return abs(a.minX - b["x"].number!) <= tol && abs(a.minY - b["y"].number!) <= tol && abs(a.width - b["width"].number!) <= tol && abs(a.height - b["height"].number!) <= tol
    }
    static func describe(_ r: CGRect?) -> String { r.map { "(\($0.minX),\($0.minY),\($0.width),\($0.height))" } ?? "nil" }
    static func wrect(_ r: AWCValue) -> String { "(\(r["x"].number!),\(r["y"].number!),\(r["width"].number!),\(r["height"].number!))" }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, s = c["snap"]
        state.c = c; state.epoch += 1; pump(0.12)
        let m = state.measurements, card = m.first { $0.name == "md-card" }
        if c["hidden"] == .bool(true) { check(card == nil, "\(name) hidden card renders nothing"); return }
        guard let card else { check(false, "\(name) card measured"); return }
        let style = s["style"], metrics = card.metrics
        check(near(card.bounds, s["rect"]), "\(name) rect \(describe(card.bounds)) vs \(wrect(s["rect"]))")
        let pad = metrics["padding"]?.array.compactMap(\.number) ?? []
        check(pad == [px(style["paddingTop"].string), px(style["paddingRight"].string), px(style["paddingBottom"].string), px(style["paddingLeft"].string)], "\(name) padding \(pad)")
        check(metrics["contentGap"]?.number == px(style["rowGap"].string), "\(name) gap \(metrics["contentGap"]?.number ?? -1) vs \(style["rowGap"].string)")
        check(metrics["fontSize"]?.number == px(style["fontSize"].string) && metrics["lineHeight"]?.number == px(style["lineHeight"].string), "\(name) typography \(metrics["fontSize"]?.number ?? -1)/\(metrics["lineHeight"]?.number ?? -1) vs \(style["fontSize"].string)/\(style["lineHeight"].string)")
        func rgba(_ k: String) -> [Double] { metrics[k]?.array.compactMap(\.number) ?? [] }
        check(zip(pre(rgba("background")), pre(color(style["backgroundColor"].string))).allSatisfy { abs($0 - $1) < 0.006 } && rgba("background").count == 4, "\(name) container \(rgba("background")) vs \(style["backgroundColor"].string)")
        check(zip(pre(rgba("color")), pre(color(style["color"].string))).allSatisfy { abs($0 - $1) < 0.006 }, "\(name) content colour \(rgba("color")) vs \(style["color"].string)")
        let ns = metrics["shadow"]?.array.compactMap(\.number) ?? [], ws = shadowList(style["boxShadow"].string).flatMap { $0 }
        check(ns.count == ws.count && zip(ns, ws).allSatisfy { abs($0 - $1) < 0.006 }, "\(name) shadow \(ns) vs \(style["boxShadow"].string)")
        if s["outline"] != .null {
            check(metrics["outlineWidth"]?.number == px(s["outline"]["borderTopWidth"].string) && zip(pre(rgba("outlineColor")), pre(color(s["outline"]["borderTopColor"].string))).allSatisfy { abs($0 - $1) < 0.006 },
                  "\(name) outline \(metrics["outlineWidth"]?.number ?? -1) \(rgba("outlineColor")) vs \(s["outline"]["borderTopWidth"].string) \(s["outline"]["borderTopColor"].string)")
        } else { check(metrics["outlineWidth"]?.number == 0, "\(name) no outline part") }
        let layer = m.first { $0.name == "state-layer" }
        if s["stateLayer"] != .null && s["stateLayer"]["display"].string != "none" {
            check(layer != nil && abs((layer?.metrics["opacity"]?.number ?? -1) - Double(s["stateLayer"]["opacity"].string)!) < 0.001, "\(name) state layer opacity \(layer?.metrics["opacity"]?.number ?? -1)")
            check(near(layer?.bounds, s["stateLayer"]["rect"]), "\(name) state layer box \(describe(layer?.bounds))")
        } else { check(layer == nil, "\(name) no rendered state layer (source \(s["stateLayer"] == .null ? "absent" : "display:none"))") }
        let role = s["attrs"]["role"] == .null ? "" : s["attrs"]["role"].string, tab = s["attrs"]["tabindex"] == .null ? -2.0 : Double(s["attrs"]["tabindex"].string)!
        check(metrics["role"]?.string == role && metrics["tabindex"]?.number == tab, "\(name) role/tabindex \(metrics["role"]?.string ?? "?")/\(metrics["tabindex"]?.number ?? -9) vs \(role)/\(tab)")
        check(metrics["focusRing"]?.bool == false && style["outlineStyle"].string == "none", "\(name) no focus ring at rest")
        // Authored children: inherited typography and stretched boxes.
        var authored: [CGRect] = []
        for (i, child) in s["children"].array.enumerated() {
            authored.append(CGRect(x: child["rect"]["x"].number!, y: child["rect"]["y"].number!, width: child["rect"]["width"].number!, height: child["rect"]["height"].number!))
            guard let n = m.first(where: { $0.name == "child\(i)" }) else { check(false, "\(name) child \(i) measured"); continue }
            check(near(n.bounds, child["rect"]), "\(name) child \(i) \(describe(n.bounds)) vs \(wrect(child["rect"]))")
        }
        // Every flat pixel of the clip (authored controls masked in both images).
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let web = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), nat = grid(native, x: cx, y: cy, w: cw, h: ch)
        let masked = c["authoredControls"] == .bool(true) || c["content"].string == "wrap"
        let nativeChildren = m.filter { $0.name.hasPrefix("child") }.map(\.bounds)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where web.flat(pxl, py, 6) && nat.flat(pxl, py, 6) {
            let p = CGPoint(x: Double(pxl) + 0.5, y: Double(py) + 0.5)
            if masked && (authored + nativeChildren).contains(where: { $0.insetBy(dx: -2, dy: -2).contains(p) }) { continue }
            let d = diff(web.at(pxl, py), nat.at(pxl, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(web.at(pxl, py).map { Int($0) }) native \(nat.at(pxl, py).map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 1000 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt])
    }
    /// AWCNativeView routes md-card to the dedicated renderer (default slot only; role from content).
    static func dispatch() {
        struct Host: View { let node: AWCNode; let state: CardPaintFixtureState
            var body: some View { AWCNativeView(node: node).awcNativeInspection(rootID: "dispatch", coordinateSpace: "awc-native-preview") { state.measurements = $0 }.frame(width: 320).coordinateSpace(name: "awc-native-preview") } }
        for (children, role) in [([AWCNode.text("Plain body")], "button"), ([AWCNode(tag: "md-button", children: [.text("Act")])], "")] {
            let node = AWCNode(id: "dispatch", tag: "md-card", properties: ["interactive": true, "variant": "outlined"], children: children + [AWCNode.text("Ignored", slot: "headline")])
            let view = NSHostingView(rootView: Host(node: node, state: state)); window.contentView = view; view.layoutSubtreeIfNeeded()
            let end = Date().addingTimeInterval(0.3); repeat { view.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } while Date() < end
            let card = state.measurements.first { $0.name == "md-card" }
            check(card?.metrics["role"]?.string == role, "dispatch: AWCNativeView md-card uses the dedicated renderer with role '\(role)' (\(card?.metrics["role"]?.string ?? "nil"))")
            check(abs((card?.bounds.width ?? 0) - 320) < 0.5, "dispatch: block-level card fills its proposal")
        }
        window.contentView = host
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: CardPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("card-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_CARD_PAINT_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("card-web-paint")) }
        dispatch()
        if let output = ProcessInfo.processInfo.environment["AWC_CARD_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Card native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
