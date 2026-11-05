import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-chip paint and geometry against Chrome (web-oracle/paint.html, DPR 1): the variant ×
// appearance × state × theme × direction matrix, five density rungs × four content shapes plus
// inherited and local density, 23 content compositions in both directions, nine colour roles ×
// three appearances × selection (and dark / disabled subsets), all twelve hooks per appearance ×
// state × theme × direction, each hook alone, both part fixtures and `hidden`. Geometry, padding,
// gap, typography, colours, shadow list, outline, state layer, role / tabindex, part boxes, every
// flat pixel of the source clip, and the AWCNativeView dispatch path.
@Observable final class ChipPaintFixtureState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
/// The trailing-icon fixture SVG (`M7 10l5 5 5-5z` in a 24 viewBox, currentColor).
struct ChipPaintTriangle: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24; var p = Path()
        p.move(to: .init(x: r.minX + 7 * s, y: r.minY + 10 * s)); p.addLine(to: .init(x: r.minX + 12 * s, y: r.minY + 15 * s)); p.addLine(to: .init(x: r.minX + 17 * s, y: r.minY + 10 * s)); p.closeSubpath()
        return p
    }
}
struct ChipPaintFixture: View {
    let state: ChipPaintFixtureState
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) ?? .nan }
    static func corners(_ css: String) -> AWCCornerShape {
        let halves = css.split(separator: "/").map { $0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
        func four(_ v: [Double]) -> [Double] { v.count == 1 ? [v[0], v[0], v[0], v[0]] : v.count == 2 ? [v[0], v[1], v[0], v[1]] : v.count == 3 ? [v[0], v[1], v[2], v[1]] : v }
        let h = four(halves[0]), v = halves.count > 1 ? four(halves[1]) : h
        func r(_ i: Int) -> AWCCornerRadius { .init(x: .points(h[i]), y: .points(v[i])) }
        return .init(topLeft: r(0), topRight: r(1), bottomRight: r(2), bottomLeft: r(3))
    }
    static func hooks(_ hooks: AWCValue) -> AWCChipHookAppearance {
        func s(_ k: String) -> String? { hooks[k] == .null ? nil : hooks[k].string }
        return .init(containerColor: s("container-color"), containerColorSelected: s("container-color-selected"), labelColor: s("label-color"),
                     labelColorSelected: s("label-color-selected"), iconColor: s("icon-color"), iconSize: s("icon-size").map { .points(px($0)) },
                     containerShape: s("container-shape").map(corners), containerHeight: s("container-height").map { .points(px($0)) },
                     outlineColor: s("outline-color"), outlineWidth: s("outline-width").map(px), stateLayerColor: s("state-layer-color"),
                     elevation: s("elevation").map { AWCBoxShadow.source($0) ?? [] })
    }
    /// The two `::part()` fixtures of paint.html.
    static func parts(_ name: String) -> AWCChipPartAppearance {
        switch name {
        case "parts-input": return .init(stateLayerColor: "#F4511E", stateLayerOpacity: 0.2, outlineColor: "#00897B", outlineWidth: 2, labelColor: "#3949AB", iconColor: "#8E24AA", removeColor: "#E53935")
        case "parts-filter": return .init(outlineColor: "#000000", trailingIconColor: "#1E88E5", checkmarkColor: "#E53935")
        // md-chip::part(primary){background-color:rgba(0,137,123,.24);outline:2px solid #E53935;outline-offset:-4px}
        case "parts-primary": return .init(primaryBackground: "#00897B3D", primaryOutlineStyle: "solid", primaryOutlineColor: "#E53935", primaryOutlineWidth: 2, primaryOutlineOffset: -4)
        default: return .init()
        }
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        var props: [String: AWCValue] = [:]
        for k in ["variant", "appearance", "color", "selected", "selectable", "removable", "disabled", "softDisabled", "icon", "trailingIcon", "label", "contentAlign", "density", "elevated", "hidden"] where c[k] != .null { props[k] = c[k] }
        let node = AWCNode(id: "chip", tag: "md-chip", properties: props)
        let model = AWCChipModel(properties: props, selected: c["selected"] == .bool(true))
        let slot = c["slot"].string, avatar = slot.contains("circle"), trailSVG = slot.contains("M7 10"), slotText = !slot.isEmpty && !slot.hasPrefix("<")
        let width = c["width"] == .null ? nil : Self.px(c["width"].string)
        return ZStack(alignment: .topLeading) {
            AWCNativeChip(node: node, theme: theme, model: model, hasLeadingSlot: avatar, hasTrailingSlot: trailSVG, hasLabelSlot: slotText,
                          accessibleLabel: model.label.isEmpty ? slot : model.label, dispatch: { _, _ in false }, setSelected: { _ in }, remove: {},
                          leadingSlot: { if avatar { Circle().fill(Color(awcHex: "#7E57C2")) } },
                          labelSlot: { if slotText { Text(slot) } },
                          trailingSlot: { if trailSVG { ChipPaintTriangle() } })
                .frame(width: width.map { CGFloat($0) })
                .awcChipStretch(width != nil)
                .awcChipAppearance(c["hooks"] == .null ? .init() : Self.hooks(c["hooks"]))
                .awcChipPartAppearance(Self.parts(c["name"].string))
                .frame(width: 320, alignment: .topLeading)
                .awcDensity(c["inheritedDensity"].number ?? .nan)
                .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: 40, y: 40)
        }
        .awcTheme(theme)
        .awcNativeInspection(rootID: "chip", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct ChipGrid {
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
@main @MainActor enum NativeChipPaintIntegration {
    static let state = ChipPaintFixtureState()
    static var host: NSHostingView<ChipPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let captureDir = ProcessInfo.processInfo.environment["AWC_CHIP_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ChipGrid {
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
    static func same(_ native: [Double], _ css: String) -> Bool { native.count == 4 && zip(pre(native), pre(color(css))).allSatisfy { abs($0 - $1) < 0.006 } }
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
        let m = state.measurements, chip = m.first { $0.name == "md-chip" }
        if c["hidden"] == .bool(true) { check(chip == nil, "\(name) hidden chip renders nothing"); return }
        guard let chip else { check(false, "\(name) chip measured"); return }
        let style = s["style"], metrics = chip.metrics
        func rgba(_ k: String) -> [Double] { metrics[k]?.array.compactMap(\.number) ?? [] }
        check(near(chip.bounds, s["rect"]), "\(name) rect \(describe(chip.bounds)) vs \(wrect(s["rect"]))")
        check(metrics["paddingLeft"]?.number == px(style["paddingLeft"].string) && metrics["paddingRight"]?.number == px(style["paddingRight"].string),
              "\(name) padding \(metrics["paddingLeft"]?.number ?? -1)/\(metrics["paddingRight"]?.number ?? -1) vs \(style["paddingLeft"].string)/\(style["paddingRight"].string)")
        check(metrics["contentGap"]?.number == px(style["columnGap"].string), "\(name) gap \(metrics["contentGap"]?.number ?? -1) vs \(style["columnGap"].string)")
        check(metrics["fontSize"]?.number == px(style["fontSize"].string) && metrics["lineHeight"]?.number == px(style["lineHeight"].string),
              "\(name) typography \(metrics["fontSize"]?.number ?? -1)/\(metrics["lineHeight"]?.number ?? -1) vs \(style["fontSize"].string)/\(style["lineHeight"].string)")
        check(same(rgba("background"), style["backgroundColor"].string), "\(name) container \(rgba("background")) vs \(style["backgroundColor"].string)")
        check(same(rgba("color"), style["color"].string), "\(name) label ink \(rgba("color")) vs \(style["color"].string)")
        let ns = metrics["shadow"]?.array.compactMap(\.number) ?? [], ws = shadowList(style["boxShadow"].string).flatMap { $0 }
        check(ns.count == ws.count && zip(ns, ws).allSatisfy { abs($0 - $1) < 0.006 }, "\(name) shadow \(ns) vs \(style["boxShadow"].string)")
        // Outline part: width and colour (transparent when the source paints none).
        let outline = m.first { $0.name == "outline" }
        if s["outline"] != .null {
            let w = px(s["outline"]["borderTopWidth"].string), col = s["outline"]["borderTopColor"].string
            let nw = outline?.metrics["width"]?.number ?? -1, nc = outline?.metrics["color"]?.array.compactMap(\.number) ?? []
            check(same(nc, col) && (color(col).last == 0 || nw == w), "\(name) outline \(nw) \(nc) vs \(w) \(col)")
        } else {
            let nc = outline?.metrics["color"]?.array.compactMap(\.number) ?? []
            check(nc.last == 0, "\(name) no outline element (deprecated elevated): native outline transparent \(nc)")
        }
        // State layer: colour, resting opacity, display:none for soft-disabled.
        let layer = m.first { $0.name == "state-layer" }
        if s["stateLayer"]["display"].string == "none" { check(layer == nil, "\(name) soft-disabled state layer not rendered") }
        else {
            check(layer != nil && abs((layer?.metrics["opacity"]?.number ?? -1) - Double(s["stateLayer"]["opacity"].string)!) < 0.001, "\(name) state layer opacity \(layer?.metrics["opacity"]?.number ?? -1) vs \(s["stateLayer"]["opacity"].string)")
            check(same(layer?.metrics["color"]?.array.compactMap(\.number) ?? [], s["stateLayer"]["backgroundColor"].string), "\(name) state layer colour vs \(s["stateLayer"]["backgroundColor"].string)")
        }
        // Content parts: icon / checkmark / label / remove / trailing icon boxes and inks.
        for (part, key) in [("icon", "icon"), ("checkmark", "checkmark"), ("label", "label"), ("remove", "remove"), ("trailing-icon", "trailingIcon")] {
            let web = s[key], native = m.first { $0.name == part }
            // Slot fallback content (an `icon` behind a slotted avatar) is in the shadow tree but not rendered.
            if web == .null || (web["rect"]["width"].number == 0 && web["rect"]["height"].number == 0) { check(native == nil, "\(name) no \(part) part"); continue }
            guard let native else { check(false, "\(name) \(part) part measured"); continue }
            check(near(native.bounds, web["rect"], part == "label" ? 1.0 : 0.6), "\(name) \(part) box \(describe(native.bounds)) vs \(wrect(web["rect"]))")
            if web["color"] != .null { check(same(native.metrics["color"]?.array.compactMap(\.number) ?? [], web["color"].string), "\(name) \(part) ink \(native.metrics["color"].map { "\($0)" } ?? "nil") vs \(web["color"].string)") }
        }
        // Semantics.
        let attrs = s["attrs"], role = attrs["role"].string, tab = attrs["tabindex"] == .null ? -2.0 : Double(attrs["tabindex"].string)!
        check(metrics["role"]?.string == role && metrics["tabindex"]?.number == tab, "\(name) role/tabindex \(metrics["role"]?.string ?? "?")/\(metrics["tabindex"]?.number ?? -9) vs \(role)/\(tab)")
        let pressed = attrs["ariaPressed"] == .null ? "" : attrs["ariaPressed"].string
        check(metrics["pressedState"]?.string == (role == "button" ? pressed : (s["primary"]["ariaPressed"] == .null ? "" : s["primary"]["ariaPressed"].string)), "\(name) pressed state \(metrics["pressedState"]?.string ?? "?") vs \(pressed)")
        let primaryTab = s["primary"] == .null ? -2.0 : Double(s["primary"]["tabindex"].string) ?? -2
        check(metrics["primaryTabindex"]?.number == primaryTab, "\(name) primary tabindex \(metrics["primaryTabindex"]?.number ?? -9) vs \(primaryTab)")
        if s["remove"] != .null { check(metrics["removeTabindex"]?.number == Double(s["remove"]["tabindex"].string), "\(name) remove tabindex") }
        check(metrics["hostRing"]?.bool == false && style["outlineStyle"].string == "none", "\(name) no focus ring at rest")
        // Every flat pixel of the clip.
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let web = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), nat = grid(native, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where web.flat(pxl, py, 6) && nat.flat(pxl, py, 6) {
            let d = diff(web.at(pxl, py), nat.at(pxl, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(web.at(pxl, py).map { Int($0) }) native \(nat.at(pxl, py).map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 600 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt])
    }
    /// AWCNativeView routes md-chip to the dedicated renderer (role from variant / removable).
    static func dispatch() {
        struct Host: View { let node: AWCNode; let state: ChipPaintFixtureState
            var body: some View { AWCNativeView(node: node).awcNativeInspection(rootID: "dispatch", coordinateSpace: "awc-native-preview") { state.measurements = $0 }.frame(width: 320, alignment: .topLeading).coordinateSpace(name: "awc-native-preview") } }
        for (props, role) in [(["variant": AWCValue.string("filter"), "label": .string("Unread")], "button"), (["variant": .string("input"), "label": .string("Ada")], "group")] {
            let node = AWCNode(id: "dispatch", tag: "md-chip", properties: props)
            let view = NSHostingView(rootView: Host(node: node, state: state)); window.contentView = view; view.layoutSubtreeIfNeeded()
            let end = Date().addingTimeInterval(0.3); repeat { view.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } while Date() < end
            let chip = state.measurements.first { $0.name == "md-chip" }
            check(chip?.metrics["role"]?.string == role, "dispatch: AWCNativeView md-chip uses the dedicated renderer with role '\(role)' (\(chip?.metrics["role"]?.string ?? "nil"))")
            check(abs((chip?.bounds.height ?? 0) - 32) < 0.5, "dispatch: chip is 32 tall (\(chip?.bounds.height ?? -1))")
        }
        window.contentView = host
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ChipPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("chip-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_CHIP_PAINT_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("chip-web-paint")) }
        dispatch()
        if let output = ProcessInfo.processInfo.environment["AWC_CHIP_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Chip native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
