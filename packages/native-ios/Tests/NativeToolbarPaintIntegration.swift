import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-toolbar paint and geometry against Chrome (paint.html, Mac Chrome 153, DPR 1): docked/floating × standard/vibrant ×
// theme × direction, vertical strips, the four alignments with and without sections, leading/trailing/multi sections,
// the paired FAB, density (local, inherited, local over inherited), the icon-button variants under both schemes, mixed
// and soft-disabled content, semantics, overflow (visible, scroll, wrap), every hook together and each hook alone, and the
// hidden bar: boxes of the host, container, FAB and every item, the chrome colours, radius and elevation, the toolbar-only
// icon-button tints, the roving Tab stop, role / orientation / name, and every flat pixel of the bar.
@Observable final class ToolbarPaintState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var width = 720.0
    var frame: [String: Double] = [:]
    var inheritedDensity: Double?
    var origin = CGPoint(x: 40, y: 40)
    var appearance = AWCToolbarAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
struct ToolbarPaintFixture: View {
    let state: ToolbarPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        // A single root id is reported as "component" (the Laboratory naming): keep the list plural.
        let ids = state.nodes.flatMap { [$0.id] + $0.children.map(\.id) } + ["-"]
        let margin = 16.0
        ZStack(alignment: .topLeading) {
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in
                        AWCNativeView(node: n)
                            .frame(width: state.frame["width"].map { CGFloat($0) })
                            .frame(maxWidth: state.frame["maxWidth"].map { CGFloat($0 + 2 * margin) } ?? .infinity, alignment: .leading)
                            .frame(maxHeight: state.frame["maxHeight"].map { CGFloat($0) } ?? .infinity, alignment: .top)
                            .fixedSize(horizontal: false, vertical: state.frame["maxHeight"] == nil)
                    }
                }
                .frame(width: state.width, alignment: .topLeading)
            }
            .modifier(ToolbarInheritedDensity(value: state.inheritedDensity))
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: state.origin.x, y: state.origin.y)
        }
        .awcToolbarAppearance(state.appearance)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
/// The oracle sets the global density on an ancestor (`data-density`), which the bar inherits.
struct ToolbarInheritedDensity: ViewModifier {
    let value: Double?
    func body(content: Content) -> some View { if let value { content.awcDensity(value) } else { content } }
}
@main @MainActor enum NativeToolbarPaintIntegration {
    static let state = ToolbarPaintState()
    static var host: NSHostingView<ToolbarPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ToolbarGrid {
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
        if s.hasPrefix("#"), s.count >= 7 { let h = Array(s.dropFirst()); func c(_ i: Int) -> Double { Double(Int(String(h[i..<i + 2]), radix: 16) ?? 0) / 255 }; return [c(0), c(2), c(4), h.count >= 8 ? c(6) : 1] }
        return [0, 0, 0, 0]
    }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        let w = css(web); func pm(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return zip(pm(a), pm(w)).allSatisfy { abs($0 - $1) <= tol }
    }
    static func hooks(_ v: AWCValue) -> [String: String] { guard case .object(let o) = v else { return [:] }; return o.compactMapValues(\.string) }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) }
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        let nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(c["nodesJSON"].string.utf8))
        state.appearance = AWCToolbarAppearance(css: hooks(nodes.first?.properties["_hooks"] ?? .null))
        state.nodes = nodes
        state.width = c["parent"]["width"].number ?? 720
        var frame: [String: Double] = [:]; if case .object(let o) = c["frame"] { for (k, v) in o { frame[k] = v.number } }; state.frame = frame
        state.inheritedDensity = c["inheritedDensity"].number
        let ox = c["parent"]["x"].number ?? 40, oy = c["parent"]["y"].number ?? 40
        state.origin = CGPoint(x: ox, y: oy)
        state.measurements = []; state.epoch += 1; pump(0.5)
        if ProcessInfo.processInfo.environment["AWC_TOOLBAR_DUMP"] != nil { for n in state.measurements { print("MEAS \(n.id) \(n.name) \(n.bounds) \(n.metrics)") }; fflush(stdout) }
        func near(_ a: Double?, _ b: Double?, _ label: String, _ tol: Double = 0.75) { check(a != nil && b != nil && abs(a! - b!) <= tol, "\(name) \(label) \(a ?? .nan) vs \(b ?? .nan)") }
        let h = c["host"], hr = h["rect"]
        let bar = m("bar1", "md-toolbar")
        if c["host"]["display"].string == "none" || (hr["width"].number ?? 0) == 0 {
            check(bar == nil || bar!.bounds.width < 0.5, "\(name) hidden bar takes no space"); return
        }
        guard let bar else { check(false, "\(name) bar measured"); return }
        // Raw HTML controls of the oracle have no native node: their widths are not in a hugging (floating) bar.
        let dropped = Set(c["dropped"].array.map(\.string)), hugs = !dropped.isEmpty && h["display"].string != "flex"
        // Host box (oracle rects are relative to the parent; native bounds are window coordinates).
        near(Double(bar.bounds.minX) - ox, hr["x"].number, "host x"); near(Double(bar.bounds.minY) - oy, hr["y"].number, "host y")
        if !hugs { near(Double(bar.bounds.width), hr["width"].number, "host width", 1) }; near(Double(bar.bounds.height), hr["height"].number, "host height")
        check(colorClose(bar.metrics["background"], h["bg"].string), "\(name) host background \(String(describing: bar.metrics["background"])) vs \(h["bg"].string)")
        near(bar.metrics["radius"]?.number, numbers(h["radius"].string).first, "host radius", 0.01)
        check(((bar.metrics["elevation"]?.number ?? 0) > 0) == (h["boxShadow"].string != "none"), "\(name) host elevation presence")
        check((bar.metrics["role"]?.string == "toolbar") == (h["role"].string == "toolbar"), "\(name) role \(bar.metrics["role"]?.string ?? "") vs \(h["role"].string)")
        if h["role"].string == "toolbar" {
            check(bar.metrics["orientation"]?.string == h["orientation"].string, "\(name) orientation \(bar.metrics["orientation"]?.string ?? "") vs \(h["orientation"].string)")
            check(bar.metrics["label"]?.string == (h["label"] == .null ? "" : h["label"].string), "\(name) name")
        }
        // Container (docked: the flex box; floating: the pill with its chrome).
        let ct = c["container"], cr = ct["rect"]
        if let cont = m("bar1", "container") {
            near(Double(cont.bounds.minX) - ox, cr["x"].number, "container x"); near(Double(cont.bounds.minY) - oy, cr["y"].number, "container y")
            if !hugs { near(Double(cont.bounds.width), cr["width"].number, "container width", 1) }; near(Double(cont.bounds.height), cr["height"].number, "container height")
            check(colorClose(cont.metrics["background"], ct["bg"].string), "\(name) container background \(String(describing: cont.metrics["background"])) vs \(ct["bg"].string)")
            if ct["bg"].string != "rgba(0, 0, 0, 0)" { near(cont.metrics["radius"]?.number, min(numbers(ct["radius"].string).first ?? 0, (cr["height"].number ?? 0) / 2, (cr["width"].number ?? 0) / 2), "container radius", 0.01) }
            check(((cont.metrics["elevation"]?.number ?? 0) > 0) == (ct["boxShadow"].string != "none"), "\(name) container elevation presence")
        } else { check(false, "\(name) container measured") }
        if c["fab"] != .null {
            if let fab = m("bar1", "fab-container") {
                let fr = c["fab"]["rect"]
                near(Double(fab.bounds.minX) - ox, fr["x"].number, "fab x"); near(Double(fab.bounds.minY) - oy, fr["y"].number, "fab y")
                near(Double(fab.bounds.width), fr["width"].number, "fab width", 1); near(Double(fab.bounds.height), fr["height"].number, "fab height", 1)
            } else { check(false, "\(name) fab measured") }
        }
        // Items: boxes (positions only when no raw HTML control was dropped before them), the roving stop, the tints.
        var shifted = false
        for ch in c["children"].array {
            let id = ch["id"].string
            if dropped.contains(id) { shifted = true; continue }
            guard let item = m(id, "toolbar-item") else { check(false, "\(name) \(id) measured"); continue }
            let r = ch["rect"]
            if !shifted { near(Double(item.bounds.minX) - ox, r["x"].number, "\(id) x") }
            near(Double(item.bounds.minY) - oy, r["y"].number, "\(id) y")
            near(Double(item.bounds.width), r["width"].number, "\(id) width", 1); near(Double(item.bounds.height), r["height"].number, "\(id) height", 1)
            let member = item.metrics["member"]?.bool ?? false
            check(member == (ch["groupTabindex"] != .null && ch["groupTabindex"].number != nil), "\(name) \(id) roving member \(member)")
            if member { check((item.metrics["tabStop"]?.bool ?? false) == (ch["tabindex"].string == "0"), "\(name) \(id) tab stop") }
            if ch["vars"] != .null {
                for (key, native) in [("--md-icon-button-icon-color", "iconColor"), ("--md-icon-button-state-layer-color", "stateLayerColor"), ("--md-icon-button-container-color", "containerColor")] {
                    let web = ch["vars"][key].string
                    if web.isEmpty { check(item.metrics[native] == nil, "\(name) \(id) \(native) untinted") }
                    else { check(colorClose(item.metrics[native], web), "\(name) \(id) \(native) \(String(describing: item.metrics[native])) vs \(web)") }
                }
            }
        }
        if !dropped.isEmpty { report.append(["case": name, "skipped": "pixels and x after \(dropped.sorted()): raw HTML controls have no native node"]); return }
        // Paint: every flat CSS pixel of the bar (glyph edges excluded in either image); floating bars include the FAB.
        let cx = Int((ox + (hr["x"].number ?? 0)).rounded(.down)), cy = Int((oy + (hr["y"].number ?? 0)).rounded(.down))
        let cw = Int((hr["width"].number ?? 0).rounded(.down)), chh = Int((hr["height"].number ?? 0).rounded(.down))
        let clip = c["clip"], clx = clip["x"].number ?? 0, cly = clip["y"].number ?? 0
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: Double(src.width) / (clip["width"].number ?? 1), origin: .init(x: clx, y: cly)), x: cx, y: cy, w: cw, h: chh)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: chh)), nat = grid(shot, x: cx, y: cy, w: cw, h: chh)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<max(cy + 1, cy + chh - 1) { for pxx in (cx + 1)..<max(cx + 1, cx + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(n > 0 && Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_TOOLBAR_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ToolbarPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 700), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("toolbar-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_TOOLBAR_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("toolbar-web-paint")) }
        // aria-labelledby: the IDREF resolves to the referenced node's text in the native scope (wins over aria-label); an
        // unresolved reference falls back to aria-label; the name follows a later text change of the referenced node.
        if only == nil {
            func labelled(_ text: String, ref: String) -> String {
                state.nodes = [AWCNode(id: "tb-title", tag: "#text", properties: ["text": .string(text)]),
                               AWCNode(id: "tbl", tag: "md-toolbar", properties: ["ariaLabelledby": .string(ref), "ariaLabelProp": "Fallback"],
                                       children: [AWCNode(id: "tbl-b1", tag: "md-icon-button", properties: ["icon": "undo", "aria-label": "Undo"])])]
                state.measurements = []; state.epoch += 1; pump(0.4)
                return state.measurements.first { $0.name == "md-toolbar" }?.metrics["label"]?.string ?? "-"
            }
            let a = labelled("Text formatting", ref: "tb-title"); check(a == "Text formatting", "aria-labelledby names the toolbar (\(a))")
            let b = labelled("Text formatting", ref: "missing"); check(b == "Fallback", "an unresolved aria-labelledby falls back to aria-label (\(b))")
            let c = labelled("Paragraph", ref: "tb-title missing"); check(c == "Paragraph", "IDREF lists keep the resolved names (\(c))")
        }
        if let output = ProcessInfo.processInfo.environment["AWC_TOOLBAR_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Toolbar native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
struct ToolbarGrid {
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
