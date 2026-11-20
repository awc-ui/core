import AppKit
import SwiftUI
import Observation
import Accessibility
@testable import AWCUI

// md-line/area/bar/pie-chart and md-sparkline: the RENDERED native views against Chrome 153 (gate 5, r5 R5-02/R5-03/R5-06).
// Every paint case of the published Mac oracles (outputs/native-parity/<tag>/web-oracle-mac/paint*.json + shots, DPR 1) is
// rebuilt from the same markup, properties, slots, hooks and ::part rules through AWCNativeView (production dispatch) and
// window-captured. Checks: the host box (x, y, width, height) and every flat pixel of the clip (edges excluded: a pixel whose
// 3×3 neighbourhood varies by more than 6 levels in either image; mean |Δ| ≤ 1.0 and at most 0.5 % of pixels > 6 levels).
// Cases whose markup puts the chart inside other page content (inline text) compare the host box region only.
// Fixtures: AWC_CHART_PAINT_ORACLES (default Tests/Fixtures/chart-web-paint) = <tag>/<subset>.json + <tag>/shots-<subset>/.
// AWC_CHART_PAINT_ONLY=<substring> filters cases; AWC_CHART_PAINT_SUBSETS=<subset,…> filters subsets.
@Observable final class ChartPaintState {
    var c: AWCValue = .null
    var tag = ""
    var epoch = 0
    var host: CGRect = .zero
    let controller = AWCChartController()
}

/// The small HTML subset the chart oracle pages use: elements with quoted / bare attributes, text, character references.
enum ChartPaintHTML {
    static func decode(_ s: String) -> String {
        s.replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">").replacingOccurrences(of: "&nbsp;", with: "\u{00A0}").replacingOccurrences(of: "&amp;", with: "&")
    }
    static func attributes(_ inner: String) -> [(String, String?)] {
        let re = try! NSRegularExpression(pattern: #"([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?"#)
        var out: [(String, String?)] = []
        for m in re.matches(in: inner, range: NSRange(inner.startIndex..., in: inner)) {
            let name = String(inner[Range(m.range(at: 1), in: inner)!])
            var value: String? = nil
            for k in 2...4 where m.range(at: k).location != NSNotFound { value = decode(String(inner[Range(m.range(at: k), in: inner)!])) }
            out.append((name, value))
        }
        return out
    }
    /// Element / text trees; element properties carry the authored attributes as strings (`slot` becomes the node's slot).
    static func parse(_ html: String) -> [AWCNode] {
        let chars = Array(html); var i = 0, counter = 0
        func children() -> [AWCNode] {
            var out: [AWCNode] = []
            while i < chars.count {
                if chars[i] == "<" {
                    guard let end = chars[i...].firstIndex(of: ">") else { i = chars.count; break }
                    if i + 1 < chars.count && chars[i + 1] == "/" { i = end + 1; return out }
                    var inner = String(chars[(i + 1)..<end]); i = end + 1
                    let selfClosing = inner.hasSuffix("/"); if selfClosing { inner.removeLast() }
                    let name = String(inner.prefix { !$0.isWhitespace }).lowercased()
                    let attrs = attributes(String(inner.dropFirst(name.count)))
                    let void = ["br", "img", "input", "hr", "meta", "link", "source"].contains(name)
                    let kids = selfClosing || void ? [] : children()
                    counter += 1
                    var props: [String: AWCValue] = [:]; var slot: String? = nil
                    for (k, v) in attrs { if k == "slot" { slot = v } else { props[k] = .string(v ?? "") } }
                    out.append(AWCNode(id: "h\(counter)", tag: name, properties: props, children: kids, slot: slot))
                } else {
                    let start = i; while i < chars.count && chars[i] != "<" { i += 1 }
                    let text = decode(String(chars[start..<i]))
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { out.append(.text(text)) }
                }
            }
            return out
        }
        return children()
    }
    static func find(_ nodes: [AWCNode], _ tag: String) -> AWCNode? {
        for n in nodes { if n.tag == tag { return n }; if let f = find(n.children, tag) { return f } }
        return nil
    }
}

struct ChartPaintFixture: View {
    let state: ChartPaintState
    /// `<md-…-chart a="b" flag style="…">` → camelCase properties (+ the raw `style`, read by the chart for its custom
    /// properties), the slotted children, the wrapper's inherited density and the authored host block-size.
    static func model(_ c: AWCValue, tag: String) -> (props: [String: AWCValue], children: [AWCNode], inherited: Double?, block: Double?) {
        let html = c["html"].string
        var props: [String: AWCValue] = [:], block: Double? = nil
        let tree = ChartPaintHTML.parse(html)
        let chart = ChartPaintHTML.find(tree, tag)
        if let open = html.range(of: "<" + tag), let close = html[open.upperBound...].firstIndex(of: ">") {
            for (name, value) in ChartPaintHTML.attributes(String(html[open.upperBound..<close])) {
                if name == "style" {
                    props["style"] = .string(value ?? "")
                    for decl in (value ?? "").split(separator: ";") {
                        let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                        if kv.count == 2, kv[0] == "block-size" || kv[0] == "height" { block = Double(kv[1].replacingOccurrences(of: "px", with: "")) }
                    }
                    continue
                }
                let camel = name.split(separator: "-").enumerated().map { $0 == 0 ? String($1) : $1.prefix(1).uppercased() + $1.dropFirst() }.joined()
                if props[camel] == nil { props[camel] = value.map { .string($0) } ?? .bool(true) }
            }
        }
        for (k, v) in c["props"].object ?? [:] { props[k] = v }
        var inherited: Double? = nil
        if let r = html.range(of: "data-density=\""), let end = html[r.upperBound...].firstIndex(of: "\"") { inherited = Double(html[r.upperBound..<end]) }
        return (props, chart?.children ?? [], inherited, block)
    }
    static func formatters(_ name: String) -> AWCChartFormatters? {
        switch name {
        case "pie-value-formatter": return .init(valueFormatter: { v in "$" + String(format: "%.2f", v ?? 0) })
        case "spark-labels-formatter": return .init(valueFormatter: { v in v == nil ? "—" : "€" + awcJSNumberString(v!) })
        default: return name.hasSuffix("-formatter") ? .init(valueFormatter: { v in v == nil ? "–" : "$" + String(format: "%.1f", (v! / 1000)) + "k" }) : nil
        }
    }
    static func hostRect(_ c: AWCValue) -> AWCValue { c["snap"]["rect"] != .null ? c["snap"]["rect"] : c["tree"]["rect"] }
    var body: some View {
        let c = state.c, epoch = state.epoch, tag = state.tag, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let m = Self.model(c, tag: tag), rect = Self.hostRect(c)
        let node = AWCNode(id: "chart", tag: tag, properties: m.props, children: m.children)
        let parts = NativeChartPaintIntegration.partRules(c["html"].string)
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: node) { _ in }
                .awcChartFormatters(Self.formatters(c["name"].string) ?? .init(), nodeID: "chart")
                .awcChartController(state.controller)
                .modifier(ChartPaintPartsModifier(parts: parts))
                .frame(width: rect["width"].number ?? 640, alignment: .topLeading)   // the host block-size comes from its own style (native parsing)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { if state.epoch == epoch { state.host = $0 } }
                .awcDensity(m.inherited ?? .nan)
                .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: rect["x"].number ?? 24, y: rect["y"].number ?? 24)
        }
        .awcTheme(theme)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}

/// `::part()` rules of a case (`<style>tag::part(name){decls}</style>`) through the typed part API.
struct ChartPaintPartsModifier: ViewModifier {
    let parts: [(part: String, declarations: String)]
    func body(content: Content) -> some View {
        var rules: [AWCChartPart: AWCChartPartAppearance] = [:]
        for (part, decls) in parts { if let p = AWCChartPart(rawValue: part) { rules[p] = (rules[p] ?? .init()).merging(AWCChartPartAppearance(css: decls)) } }
        return content.awcChartPartAppearance(rules)
    }
}

struct ChartPaintGrid {
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

@main @MainActor enum NativeChartPaintIntegration {
    static let state = ChartPaintState()
    static var host: NSHostingView<ChartPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_CHART_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) {
        let end = Date().addingTimeInterval(duration)
        repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.main.run(until: Date().addingTimeInterval(0.01)) } while Date() < end
    }
    /// `<style>…tag::part(name){declarations}…</style>` in the case markup.
    static func partRules(_ html: String) -> [(part: String, declarations: String)] {
        guard let s = html.range(of: "<style>"), let e = html.range(of: "</style>", range: s.upperBound..<html.endIndex) else { return [] }
        let css = String(html[s.upperBound..<e.lowerBound])
        let re = try! NSRegularExpression(pattern: #"::part\(([a-z-]+)\)\s*\{([^}]*)\}"#)
        return re.matches(in: css, range: NSRange(css.startIndex..., in: css)).map { m in
            (String(css[Range(m.range(at: 1), in: css)!]), String(css[Range(m.range(at: 2), in: css)!])) }
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ChartPaintGrid {
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
    /// Cases whose page assigns `data` in `prepare` (after mount) use the subset's first data set, as the page does.
    static var firstData: AWCValue = .null
    static func run(_ c0: AWCValue, tag: String, shots: URL) {
        var c = c0
        if c["name"].string.hasSuffix("ancestor-density-3"), c["props"]["data"] == .null, firstData != .null, case .object(var o) = c {
            var props = c["props"].object ?? [:]; props["data"] = firstData; o["props"] = .object(props); c = .object(o)
        }
        let name = c["name"].string, html = c["html"].string
        state.tag = tag; state.c = c; state.epoch += 1; pump(0.35)
        if name.hasSuffix("zoom-both-window") { state.controller.setZoom(startIndex: 1, endIndex: 4); pump(0.3) }
        // Settle: the clip holds still across two captures 120 ms apart (at most 3 s).
        let clip = c["clip"], clipRect = CGRect(x: clip["x"].number ?? 0, y: clip["y"].number ?? 0, width: clip["width"].number ?? 1, height: clip["height"].number ?? 1)
        do { var last = capture(clipRect).cg.dataProvider?.data as Data?
            for _ in 0..<25 { pump(0.12); let next = capture(clipRect).cg.dataProvider?.data as Data?; if next == last { break }; last = next } }
        // Host box.
        let web = ChartPaintFixture.hostRect(c), wr = CGRect(x: web["x"].number ?? 0, y: web["y"].number ?? 0, width: web["width"].number ?? 0, height: web["height"].number ?? 0)
        let embedded = !(html.hasPrefix("<" + tag) || html.hasPrefix("<style>") || html.hasPrefix("<div style=\"--md-sys-density-scale"))
        if !embedded {
            let h = state.host
            check(abs(h.minX - wr.minX) <= 0.6 && abs(h.minY - wr.minY) <= 0.6 && abs(h.width - wr.width) <= 0.6 && abs(h.height - wr.height) <= 0.6, "\(name) host box \(h) vs \(wr)")
        }
        // Pixels: the clip (or, for an embedded chart, the host box).
        let area = embedded ? wr.integral : clipRect
        let cx = Int(area.minX), cy = Int(area.minY), cw = Int(area.width), ch = Int(area.height)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let wg = grid(.init(cg: source, scale: 1, origin: clipRect.origin), x: cx, y: cy, w: cw, h: ch), ng = grid(native, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where wg.flat(pxl, py, 6) && ng.flat(pxl, py, 6) {
            let a = wg.at(pxl, py), b = ng.at(pxl, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 400 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt, "host": [state.host.minX, state.host.minY, state.host.width, state.host.height]])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ChartPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1100, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        let fixtures = env["AWC_CHART_PAINT_ORACLES"].map { URL(fileURLWithPath: $0) } ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/chart-web-paint")
        let only = env["AWC_CHART_PAINT_ONLY"], subsets = env["AWC_CHART_PAINT_SUBSETS"].map { Set($0.split(separator: ",").map(String.init)) }
        for tag in ["md-line-chart", "md-area-chart", "md-bar-chart", "md-pie-chart", "md-sparkline"] where env["AWC_CHART_PAINT_TAGS"].map({ $0.contains(tag) }) ?? true {
            let dir = fixtures.appendingPathComponent(tag)
            let files = ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []).filter { $0.hasPrefix("paint") && $0.hasSuffix(".json") && $0 != "paint-forced-colors.json" }.sorted()
            for file in files {
                let subset = String(file.dropLast(5))
                if let subsets, !subsets.contains(subset) { continue }
                guard let data = try? Data(contentsOf: dir.appendingPathComponent(file)), let oracle = try? JSONDecoder().decode(AWCValue.self, from: data) else { check(false, "\(tag) \(file) unreadable"); continue }
                let before = failures.count, start = checks
                firstData = oracle["cases"].array.first?["props"]["data"] ?? .null
                for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, tag: tag, shots: dir.appendingPathComponent("shots-" + subset)) }
                print("\(tag) \(subset): \(checks - start - (failures.count - before))/\(checks - start) checks"); fflush(stdout)
            }
        }
        // R5-04: `tableLabels` titles the chart descriptor (the Web's screen-reader table headers: X / # / Series; Category / Value / Share).
        let line = awcChartAXDescriptor(kind: .line, props: AWCChartProps(["label": "Sales", "tableLabels": .object(["x": "Monat", "series": "Reihe"]),
            "xAxis": .object(["data": .array(["Jan", "Feb"])]), "series": .array([.object(["label": "Umsatz", "data": .array([1, 2])]), .object(["data": .array([3, 4])])])]), summary: "")?.makeChartDescriptor()
        check(line?.xAxis.title == "Monat" && line?.series.map(\.name) == ["Umsatz", "Reihe"], "tableLabels line: x \(line?.xAxis.title ?? "-") series \(line?.series.map(\.name) ?? [])")
        let index = awcChartAXDescriptor(kind: .area, props: AWCChartProps(["tableLabels": .string("{\"index\":\"Nr.\"}"), "series": .array([.object(["data": .array([1, 2])])])]), summary: "")?.makeChartDescriptor()
        check(index?.xAxis.title == "Nr." && index?.series.first?.name == "Series", "tableLabels index: x \(index?.xAxis.title ?? "-") series \(index?.series.first?.name ?? "-")")
        // md-bar-chart declares no `tableLabels`: its table keeps X / # / Series.
        let bar = awcChartAXDescriptor(kind: .bar, props: AWCChartProps(["tableLabels": .object(["index": "Nr.", "series": "Reihe"]), "series": .array([.object(["data": .array([1, 2])])])]), summary: "")?.makeChartDescriptor()
        check(bar?.xAxis.title == "#" && bar?.series.first?.name == "Series", "bar ignores tableLabels: x \(bar?.xAxis.title ?? "-") series \(bar?.series.first?.name ?? "-")")
        let titled = awcChartAXDescriptor(kind: .area, props: AWCChartProps(["tableLabels": .object(["x": "Monat"]), "xAxis": .object(["label": "Month", "data": .array(["Jan"])]),
            "series": .array([.object(["data": .array([1])])])]), summary: "")?.makeChartDescriptor()
        check(titled?.xAxis.title == "Month", "tableLabels: the x axis label wins (\(titled?.xAxis.title ?? "-"))")
        let pie = awcChartAXDescriptor(kind: .pie, props: AWCChartProps(["label": "Traffic", "tableLabels": .object(["category": "Quelle", "value": "Wert", "share": "Anteil"]),
            "data": .array([.object(["label": "A", "value": 30]), .object(["label": "B", "value": 10])])]), summary: "")?.makeChartDescriptor()
        let shareAxis = pie?.additionalAxes.first as? AXNumericDataAxisDescriptor
        check(pie?.xAxis.title == "Quelle" && pie?.yAxis?.title == "Wert" && pie?.series.first?.name == "Wert" && shareAxis?.title == "Anteil"
              && shareAxis?.valueDescriptionProvider(75) == "75%" && shareAxis?.valueDescriptionProvider(48.84) == "48.8%",
              "tableLabels pie: \(pie?.xAxis.title ?? "-") / \(pie?.yAxis?.title ?? "-") / \(shareAxis?.title ?? "-")")
        let plain = awcChartAXDescriptor(kind: .pie, props: AWCChartProps(["data": .array([.object(["label": "A", "value": 1])])]), summary: "")?.makeChartDescriptor()
        check(plain?.xAxis.title == "Category" && plain?.yAxis?.title == "Value" && (plain?.additionalAxes.first as? AXNumericDataAxisDescriptor)?.title == "Share", "tableLabels pie defaults")
        print("tableLabels descriptor: \(checks)"); fflush(stdout)
        if let output = env["AWC_CHART_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Chart native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
