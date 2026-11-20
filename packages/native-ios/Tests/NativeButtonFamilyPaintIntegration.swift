import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// Button family paint and geometry against Mac Chrome 153 (gate-7 R1-03a–f; outputs/native-parity/button-family/web-reference:
// cases.js, paint.html, DPR 1): md-fab, md-icon-button, md-button-group, md-segmented-button(+set), md-split-button and
// md-fab-menu(+item) — light/dark, variants × states, sizes, densities (local and inherited), content, RTL, every hook at once and
// each hook alone. One node schema (family.js) builds the same tree through AWCNativeView (production dispatch); hooks go through
// each tag's public appearance API (init(values:) with the Laboratory field names). Checks: every root's border box, the union
// of the painted parts, and every flat pixel of Chrome's clip.
@Observable final class FamilyPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
enum FamilyTree {
    /// The family.js node → AWCNode (ids: the authored id, else the index path "n0-1-2").
    static func node(_ v: AWCValue, _ id: String) -> AWCNode {
        if v["text"] != .null { return .text(v["text"].string) }
        if v["symbol"] != .null { return .symbol(v["symbol"].string, slot: v["slot"] == .null ? nil : v["slot"].string) }
        var props: [String: AWCValue] = [:]
        for (k, x) in v["props"].object { props[k] = x }
        for (k, x) in v["attrs"].object { props[k] = x }
        let kids = v["children"].array.enumerated().map { node($1, id + "-" + String($0)) }
        return AWCNode(id: v["id"] == .null ? id : v["id"].string, tag: v["tag"].string, properties: props, children: kids)
    }
    /// The inspection root: the first root's authored id, else "n0".
    static func rootID(_ c: AWCValue) -> String { let n = c["nodes"].array.first ?? .null; return n["id"] == .null ? "n0" : n["id"].string }
    /// Every authored appearance in the case, keyed by node id (one tag per node).
    static func appearances(_ v: AWCValue, _ id: String, into out: inout [(String, String, [String: AWCValue])]) {
        guard v["tag"] != .null else { return }
        let nid = v["id"] == .null ? id : v["id"].string
        if v["appearance"] != .null { out.append((v["tag"].string, nid, v["appearance"].object)) }
        for (i, c) in v["children"].array.enumerated() { appearances(c, id + "-" + String(i), into: &out) }
    }
}
/// Applies the case's hooks with each tag's public appearance API. Subtree scopes for root tags; md-segmented-button and
/// md-fab-menu-item target their node id (the source styles that one element).
struct FamilyAppearance: ViewModifier {
    let items: [(String, String, [String: AWCValue])]
    func body(content: Content) -> some View {
        var v = AnyView(content)
        for (tag, id, values) in items {
            switch tag {
            case "md-fab": v = AnyView(v.awcFabAppearance(.init(values: values)))
            case "md-icon-button": v = AnyView(v.awcIconButtonAppearance(.init(values: values)))
            case "md-button-group": v = AnyView(v.awcButtonGroupAppearance(.init(values: values)))
            case "md-segmented-button": v = AnyView(v.awcSegmentedButtonAppearance(.init(values: values), nodeID: id))
            case "md-split-button": v = AnyView(v.awcSplitButtonAppearance(.init(values: values)))
            case "md-fab-menu": v = AnyView(v.awcFabMenuAppearance(.init(values: values)))
            case "md-fab-menu-item": v = AnyView(v.awcFabMenuItemAppearance(.init(values: values), nodeID: id))
            default: break
            }
        }
        return v
    }
}
/// One case (or states run) of the family: the roots in the scope box Chrome used (left/top/width, direction, inherited density).
struct FamilyScene: View {
    let c: AWCValue
    let fab: AWCFabController
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let nodes = c["nodes"].array, roots = nodes.enumerated().map { FamilyTree.node($1, "n" + String($0)) }
        var looks: [(String, String, [String: AWCValue])] = []
        for (i, n) in nodes.enumerated() { FamilyTree.appearances(n, "n" + String(i), into: &looks) }
        let density = c["density"].number ?? .nan, dir: LayoutDirection = c["dir"].string == "rtl" ? .rightToLeft : .leftToRight
        let width = c["width"].number ?? 360, left = c["left"].number ?? 40, top = c["top"].number ?? 40
        return Group {
            if c["comp"].string == "fab-menu", roots.count == 2 {
                // The menu scope is the viewport (Chrome's md-fab-menu host is position: fixed, inset 0); the anchor sits in the scope box.
                AWCFabMenuScope {
                    AWCNativeView(node: roots[0], onEvent: onEvent).awcFabController(fab)
                        .frame(width: width, alignment: .topLeading).environment(\.layoutDirection, dir)
                        .offset(x: left, y: top)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).environment(\.layoutDirection, .leftToRight)
                    AWCNativeView(node: roots[1], onEvent: onEvent)
                }
                .modifier(FamilyAppearance(items: looks))
                .awcDensity(density)
                .environment(\.layoutDirection, dir)
            } else {
                VStack(alignment: .leading, spacing: 0) { ForEach(roots, id: \.id) { AWCNativeView(node: $0, onEvent: onEvent) } }
                    .modifier(FamilyAppearance(items: looks))
                    .frame(width: width, alignment: .topLeading)
                    .awcDensity(density)
                    .environment(\.layoutDirection, dir)
                    .offset(x: left, y: top)
            }
        }
    }
}
struct FamilyPaintFixture: View {
    let state: FamilyPaintState
    let fab = AWCFabController()
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        return ZStack(alignment: .topLeading) { if c != .null { FamilyScene(c: c, fab: fab) { _ in } } }
            .awcTheme(theme)
            .awcNativeInspection(rootID: FamilyTree.rootID(c), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct FamilyGrid {
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
/// Pixel helpers shared by the family paint and states suites.
@MainActor enum FamilyPixels {
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ host: NSView, _ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> FamilyGrid {
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
    struct Diff { let n: Int, bad: Int, mean: Double, worst: Double, worstAt: String; var ok: Bool { n > 200 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0 } }
    /// Every pixel flat in both images (3×3 neighbourhood within 6/255) is compared; edges are the antialiasing both draw.
    static func diff(_ web: FamilyGrid, _ native: FamilyGrid) -> Diff {
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (web.y + 1)..<(web.y + web.h - 1) { for px in (web.x + 1)..<(web.x + web.w - 1) where web.flat(px, py, 6) && native.flat(px, py, 6) {
            let a = web.at(px, py), b = native.at(px, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        return .init(n: n, bad: bad, mean: sum / Double(max(n, 1)), worst: worst, worstAt: worstAt)
    }
    static func webGrid(_ file: URL, _ clip: CGRect) -> FamilyGrid? {
        guard let cg = NSImage(contentsOf: file)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        return grid(.init(cg: cg, scale: 1, origin: clip.origin), x: Int(clip.minX), y: Int(clip.minY), w: Int(clip.width), h: Int(clip.height))
    }
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? .nan, y: v["y"].number ?? .nan, width: v["width"].number ?? .nan, height: v["height"].number ?? .nan) }
}
@main @MainActor enum NativeButtonFamilyPaintIntegration {
    static let state = FamilyPaintState()
    static var host: NSHostingView<FamilyPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_FAMILY_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    static func run(_ c: AWCValue, shots: URL) {
        var c = c
        // md-fab-menu cases are opened after build in Chrome and settled: natively the menu is authored open.
        if c["open"] == .bool(true), var nodes = Optional(c["nodes"].array), nodes.count == 2 {
            var menu = nodes[1].object, props = menu["props"]?.object ?? [:]; props["open"] = .bool(true); menu["props"] = .object(props); nodes[1] = .object(menu)
            var o = c.object; o["nodes"] = .array(nodes); c = .object(o)
        }
        let name = c["name"].string
        state.c = c; state.epoch += 1; state.measurements = []; pump(c["comp"].string == "fab-menu" ? 0.7 : 0.3)
        let snaps = c["snaps"].array
        if let r = state.measurements.first(where: { $0.id == "component" })?.bounds, let s0 = snaps.first {
            let web = FamilyPixels.rect(s0["rect"])
            check(abs(r.minX - web.minX) <= 0.75 && abs(r.minY - web.minY) <= 0.75 && abs(r.width - web.width) <= 1.0 && abs(r.height - web.height) <= 0.75, "\(name) border box \(r) vs \(web)")
        } else { check(false, "\(name) measured") }
        let clip = FamilyPixels.rect(c["clip"])
        guard let wg = FamilyPixels.webGrid(shots.appendingPathComponent(name + ".png"), clip) else { check(false, "\(name) shot"); return }
        let native = FamilyPixels.capture(host, clip), ng = FamilyPixels.grid(native, x: Int(clip.minX), y: Int(clip.minY), w: Int(clip.width), h: Int(clip.height))
        let d = FamilyPixels.diff(wg, ng)
        check(d.ok, "\(name) flat pixels match (mean \(d.mean), >6: \(d.bad)/\(d.n), worst \(d.worst) at \(d.worstAt))")
        if let dir = captureDir, !d.ok { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "comp": c["comp"].string, "group": c["group"].string, "compared": d.n, "mean": d.mean, "over6": d.bad, "worst": d.worst, "worstAt": d.worstAt,
                       "native": state.measurements.first { $0.id == "component" }.map { ["x": $0.bounds.minX, "y": $0.bounds.minY, "width": $0.bounds.width, "height": $0.bounds.height] } ?? [:]])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: FamilyPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("button-family-web-paint.json")))
        let only = env["AWC_FAMILY_PAINT_ONLY"], comps = env["AWC_FAMILY_COMPS"].map { Set($0.split(separator: ",").map(String.init)) }
        for c in oracle["cases"].array where (only.map { c["name"].string.contains($0) } ?? true) && (comps.map { $0.contains(c["comp"].string) } ?? true) { run(c, shots: fixtures.appendingPathComponent("button-family-web-paint")) }
        if let output = env["AWC_FAMILY_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Button family native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
