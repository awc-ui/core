import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-organization-chart paint and geometry against Chrome 153 (outputs/native-parity/md-organization-chart/web-reference,
// oc-paint.html, DPR 1): 97 cases (+ the 13-case ::part() subset, ?subset=parts) — themes × directions × orientations × selection modes, densities, folds, locked-open,
// empty states, multiple roots, only-child chains, accent, trail geometry, hover, keyboard focus, every hook, narrow
// viewports, localised labels and the JSON attribute. Rendered through AWCNativeView (production dispatch).
// Checks: every card box (Core Text widths), every toggler box, the host height, and every flat pixel of the clip.
@Observable final class OrgChartPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var height: CGFloat = 0
    let pointer = AWCNativePointerState()
}
struct OrgChartPaintFixture: View {
    let state: OrgChartPaintState
    static func attr(_ html: String, _ name: String) -> String? {
        guard let host = html.range(of: "<md-organization-chart") else { return nil }
        let tail = String(html[host.upperBound...]); let end = tail.firstIndex(of: ">") ?? tail.endIndex; let tag = String(tail[..<end])
        for quote in ["\"", "'"] {
            if let r = tag.range(of: " " + name + "=" + quote) { let rest = tag[r.upperBound...]; if let e = rest.firstIndex(of: Character(quote)) { return String(rest[..<e]) } }
        }
        return nil
    }
    static func px(_ s: String) -> Double? { Double(s.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "").trimmingCharacters(in: .whitespaces)) }
    static func hooks(_ html: String) -> AWCOrgChartAppearance {
        var h: [String: String] = [:]
        for decl in (attr(html, "style") ?? "").split(separator: ";") { let kv = decl.split(separator: ":", maxSplits: 1); if kv.count == 2 { h[kv[0].trimmingCharacters(in: .whitespaces)] = kv[1].trimmingCharacters(in: .whitespaces) } }
        func c(_ k: String) -> String? { h["--md-org-chart-" + k] }
        func n(_ k: String) -> Double? { c(k).flatMap(px) }
        return .init(connectorColor: c("connector-color"), connectorWidth: n("connector-width"), nodeColor: c("node-color"), nodeOutlineColor: c("node-outline-color"),
                     nodeOutlineWidth: n("node-outline-width"), nodeShape: n("node-shape"), nodeMinWidth: n("node-min-width"), nodeMaxWidth: n("node-max-width"),
                     selectedColor: c("selected-color"), focusRingColor: c("focus-ring-color"), stateLayerColor: c("state-layer-color"), toggleSize: n("toggle-size"),
                     levelGap: n("level-gap"), siblingGap: n("sibling-gap"), duration: n("duration"))
    }
    /// The case's `md-organization-chart::part(x) { … }` rules (R5-06).
    static func parts(_ html: String) -> [AWCOrgChartPart: AWCOrgChartPartAppearance] {
        guard let a = html.range(of: "<style>"), let b = html.range(of: "</style>") else { return [:] }
        var out: [AWCOrgChartPart: AWCOrgChartPartAppearance] = [:]
        for rule in html[a.upperBound..<b.lowerBound].split(separator: "}") {
            let kv = rule.split(separator: "{", maxSplits: 1); guard kv.count == 2, let o = kv[0].range(of: "::part("), let c = kv[0].range(of: ")", range: o.upperBound..<kv[0].endIndex),
                  let part = AWCOrgChartPart(part: String(kv[0][o.upperBound..<c.lowerBound])) else { continue }
            out[part] = (out[part] ?? .init()).merging(AWCOrgChartPartAppearance(css: String(kv[1])))
        }
        return out
    }
    static func properties(_ c: AWCValue) -> [String: AWCValue] {
        let html = c["html"].string
        var p: [String: AWCValue] = [:]
        if c["nodes"] != .null { p["nodes"] = c["nodes"] } else if let json = attr(html, "nodes") { p["nodes"] = .string(json) }
        for (a, k) in [("selection-mode", "selectionMode"), ("orientation", "orientation"), ("label", "label"), ("expand-label", "expandLabel"), ("collapse-label", "collapseLabel"), ("density", "density")] {
            if let v = attr(html, a) { p[k] = k == "density" ? .number(Double(v) ?? 0) : .string(v) }
        }
        if attr(html, "collapsible") == "false" { p["collapsible"] = false }
        if c["props"]["selectedIds"] != .null { p["selectedIds"] = c["props"]["selectedIds"] }
        return p
    }
    static func ancestorDensity(_ html: String) -> Double? {
        guard let r = html.range(of: "data-density=\"") else { return nil }
        return Double(html[r.upperBound...].prefix { $0 != "\"" })
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let host = c["tree"]["rect"], html = c["html"].string
        var children: [AWCNode] = []
        if html.contains("slot=\"empty\""), let r = html.range(of: "slot=\"empty\">") { children.append(.init(id: "empty", tag: "span", properties: [:], children: [.text(String(html[r.upperBound...].prefix { $0 != "<" }))], slot: "empty")) }
        let node = AWCNode(id: "chart", tag: "md-organization-chart", properties: Self.properties(c), children: children)
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: node) { _ in }
                .awcOrgChartAppearance(Self.hooks(html))
                .awcOrgChartPartAppearance(Self.parts(html))
                .frame(width: host["width"].number ?? 920, alignment: .topLeading)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { if state.epoch == epoch { state.height = $0 } }
                .awcDensity(Self.ancestorDensity(html) ?? .nan)
                .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: host["x"].number ?? 24, y: host["y"].number ?? 56)
        }
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcOrgChartInspector, { NativeOrgChartPaintIntegration.probe = $0 })
        .awcTheme(theme)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct OrgChartGrid {
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
@main @MainActor enum NativeOrgChartPaintIntegration {
    static let state = OrgChartPaintState()
    static var host: NSHostingView<OrgChartPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var probe: AWCOrgChartProbe?
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_ORGCHART_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> OrgChartGrid {
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
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? .nan, y: v["y"].number ?? .nan, width: v["width"].number ?? .nan, height: v["height"].number ?? .nan) }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, html = c["html"].string, hostRect = rect(c["tree"]["rect"])
        state.pointer.update(phase: .leave, location: nil)
        // Async avatar decoding (the SVG photo) settles before the capture, as the oracle waits for its images.
        state.c = c; state.epoch += 1; pump(0.6)
        // The oracle shoots after the unfold motion (md-org-chart-grow, the duration hook) has finished.
        if let r = c["html"].string.range(of: #"--md-org-chart-duration:\s*([0-9.]+)ms"#, options: .regularExpression),
           let ms = Double(c["html"].string[r].components(separatedBy: ":").last!.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "ms", with: "")), ms > 250 { pump(ms / 1000) }
        // Async image decoding (the SVG photo avatar) settles before the capture, as the oracle waits for its images: the clip
        // holds still across two captures 120 ms apart (at most 3 s).
        do {
            let clip = c["clip"], r = CGRect(x: clip["x"].number ?? 0, y: clip["y"].number ?? 0, width: clip["width"].number ?? 1, height: clip["height"].number ?? 1)
            var last = capture(r).cg.dataProvider?.data as Data?
            for _ in 0..<25 { pump(0.12); let next = capture(r).cg.dataProvider?.data as Data?; if next == last { break }; last = next }
        }
        // Hover cases: the source harness moved the mouse to a card (or its toggler) centre.
        if name.contains("hover") || name.hasSuffix("state-layer-color") {
            let target = name.contains("toggle") ? c["items"].array.first { $0["id"].string == "eng" }?["toggle"]["rect"] : c["items"].array.first { $0["id"].string == "eng" }?["nodeRect"]
            if let t = target.map(rect) { state.pointer.update(phase: .move, location: CGPoint(x: t.midX, y: t.midY)); pump(0.55) }
        }
        // Keyboard-focus cases: the source harness tabbed in (and pressed arrows); the focused tree item shows its ring.
        if let f = c["items"].array.first(where: { $0["focused"].bool == true })?["id"].string { _ = window.makeKey(); probe?.focus(f); pump(0.45) }
        // Geometry: the model's cards and togglers in host coordinates against the oracle's.
        let props = OrgChartPaintFixture.properties(c), appearance = OrgChartPaintFixture.hooks(html)
        let roots = AWCOrgChartNode.parse(props["nodes"])
        let density = AWCNativeDensity.resolve(props["density"]?.number, inherited: OrgChartPaintFixture.ancestorDensity(html) ?? 0)
        let model = AWCOrgChartModel(roots: roots, collapsed: AWCOrgChartModel.seededCollapsed(roots), collapsible: props["collapsible"]?.bool ?? true,
                                     mode: props["selectionMode"]?.string ?? "none", selection: (props["selectedIds"]?.array ?? []).map(\.string),
                                     vertical: props["orientation"]?.string != "horizontal", rtl: c["dir"].string == "rtl", metrics: {
                                         // The case's ::part() rules size the layout too (node / viewport padding, name / title font).
                                         var m = AWCOrgChartMetrics(density: density, appearance: appearance); m.parts = AWCOrgChartParts(styles: OrgChartPaintFixture.parts(html)); return m }())
        let layout = model.layout(width: hostRect.width)
        check(abs(Double(state.height) - hostRect.height) <= 0.6, "\(name) host height \(state.height) vs \(hostRect.height)")
        let items = c["items"].array
        check(items.count == layout.items.count, "\(name) visible items \(layout.items.count) vs \(items.count)")
        for (mine, web) in zip(layout.items, items) {
            let w = rect(web["nodeRect"]), m = mine.card.offsetBy(dx: hostRect.minX, dy: hostRect.minY)
            check(mine.node.id == web["id"].string && abs(m.minX - w.minX) <= 0.6 && abs(m.minY - w.minY) <= 0.6 && abs(m.width - w.width) <= 0.6 && abs(m.height - w.height) <= 0.6, "\(name) card \(web["id"].string) \(m) vs \(w)")
            if web["toggle"] != .null, let t = mine.toggle?.offsetBy(dx: hostRect.minX, dy: hostRect.minY) {
                let wt = rect(web["toggle"]["rect"]); check(abs(t.minX - wt.minX) <= 0.6 && abs(t.minY - wt.minY) <= 0.6 && abs(t.width - wt.width) <= 0.6, "\(name) toggle \(web["id"].string) \(t) vs \(wt)")
            } else { check((web["toggle"] == .null) == (mine.toggle == nil), "\(name) toggle presence \(web["id"].string)") }
        }
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let wg = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), ng = grid(native, x: cx, y: cy, w: cw, h: ch)
        // The harness's own "before" focus probe (a 60×24 <button>, margin-block-end 8, at the start edge above the chart)
        // is not part of the component: its pixels are left out.
        let probe = html.contains("class=\"probe\"") ? CGRect(x: c["dir"].string == "rtl" ? hostRect.maxX - 60 : hostRect.minX, y: hostRect.minY - 32, width: 60, height: 24).insetBy(dx: -1, dy: -1) : .null
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where !probe.contains(CGPoint(x: Double(pxl) + 0.5, y: Double(py) + 0.5)) && wg.flat(pxl, py, 6) && ng.flat(pxl, py, 6) {
            let a = wg.at(pxl, py), b = ng.at(pxl, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 400 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: OrgChartPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("orgchart-web-paint.json")))
        let only = env["AWC_ORGCHART_PAINT_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("orgchart-web-paint")) }
        // ::part() subset (oc-paint.html?subset=parts, R5-06).
        if let data = try? Data(contentsOf: fixtures.appendingPathComponent("orgchart-web-paint-parts.json")), let parts = try? JSONDecoder().decode(AWCValue.self, from: data) {
            for c in parts["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("orgchart-web-paint-parts")) }
        }
        if let output = env["AWC_ORGCHART_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Org chart native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
