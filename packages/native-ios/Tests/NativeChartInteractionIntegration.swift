import Foundation
@testable import AWCUI

// Chart interaction parity: the Web interaction oracles (hover / keys / pointer for line, area and bar; the pie
// and sparkline state runs, plain and reduced motion) are replayed through the native interaction controllers, step for step, and compared
// with what Chrome recorded: the events (name + detail), the live region, the hover layer (index, crosshair,
// markers and their dimming), the tooltip text and position (from the card size Chrome measured) and the scene
// after zoom / legend / re-feed / drill / theme steps. Lockstep with the Kotlin replay (InteractHarness.kt).
// Usage: NativeChartInteractionIntegration [oracle-dir] [chart...]   (default: the published oracles, outputs/native-parity)

@main enum NativeChartInteractionIntegration {
    static var total = 0, passed = 0
    static func main() {
        let args = CommandLine.arguments.dropFirst()
        let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let dir = args.first.map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("../../../../../outputs/native-parity").standardizedFileURL
        let charts = args.count > 1 ? Array(args.dropFirst()) : ["line", "area", "bar", "pie", "sparkline"]
        for kind in charts {
            if kind == "pie" || kind == "sparkline" {
                let tag = kind == "pie" ? "md-pie-chart" : "md-sparkline"
                // The state runs with and without prefers-reduced-motion (the same replay: the runs are settled states).
                for subset in ["states", "states-reduced-motion"] {
                    guard let root = load(awcChartOracleFile(dir, tag, "\(subset).json")), let runs = root["runs"] as? [[String: Any]] else { print("missing \(tag)/\(subset).json"); total += 1; continue }
                    var ok = 0
                    for c in runs {
                        let diffs = kind == "pie" ? PieReplay(c).run() : SparkReplay(c).run()
                        total += 1
                        if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (\(subset))"); diffs.prefix(12).forEach { print("   " + $0) } }
                    }
                    print("\(tag) \(subset): \(ok)/\(runs.count)")
                }
                continue
            }
            for subset in ["hover", "hover-reduced-motion", "keys", "pointer"] {
                let tag = "md-\(kind)-chart"
                guard let root = load(awcChartOracleFile(dir, tag, "\(subset).json")), let cases = root["cases"] as? [[String: Any]] else { print("missing \(tag)/\(subset).json"); total += 1; continue }
                var ok = 0
                for c in cases {
                    let diffs = PlotReplay(kind, c, reduced: subset.hasSuffix("reduced-motion")).run()
                    total += 1
                    if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (\(subset))"); diffs.prefix(14).forEach { print("   " + $0) } }
                }
                print("\(tag) \(subset): \(ok)/\(cases.count)")
            }
        }
        print("NativeChartInteractionIntegration: \(passed)/\(total) runs identical")
        exit(passed == total ? 0 : 1)
    }

    static func load(_ url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

// MARK: shared helpers

func num(_ v: Any?) -> Double { (v as? NSNumber)?.doubleValue ?? 0 }

func awcTestParse(_ html: String, tag: String) -> (props: [String: AWCValue], tokens: [String: String], inheritedDensity: Double) {
    var props: [String: AWCValue] = [:], tokens: [String: String] = [:], inherited = 0.0
    if let r = html.range(of: "data-density=\""), let end = html[r.upperBound...].firstIndex(of: "\"") { inherited = Double(html[r.upperBound..<end]) ?? 0 }
    guard let open = html.range(of: "<" + tag), let close = html[open.upperBound...].firstIndex(of: ">") else { return (props, tokens, inherited) }
    let attrs = String(html[open.upperBound..<close])
    let re = try! NSRegularExpression(pattern: #"([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?"#)
    for m in re.matches(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)) {
        let name = String(attrs[Range(m.range(at: 1), in: attrs)!])
        let value: String? = m.range(at: 2).location == NSNotFound ? nil : String(attrs[Range(m.range(at: 2), in: attrs)!])
        if name == "style" {
            for decl in (value ?? "").split(separator: ";") {
                let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                if kv.count == 2, kv[0].hasPrefix("--") { tokens[kv[0]] = kv[1] }
            }
            continue
        }
        let camel = name.split(separator: "-").enumerated().map { $0 == 0 ? String($1) : $1.prefix(1).uppercased() + $1.dropFirst() }.joined()
        if props[camel] == nil { props[camel] = value.map { .string($0) } ?? .bool(true) }
    }
    return (props, tokens, inherited)
}

func awcTestValue(_ any: Any?) -> AWCValue {
    switch any {
    case let s as String: return .string(s)
    case let n as NSNumber: return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue)
    case let a as [Any]: return .array(a.map(awcTestValue))
    case let o as [String: Any]: return .object(o.mapValues(awcTestValue))
    default: return .null
    }
}

/// A JS value or a native detail value, normalised for comparison (numbers as Double, nativeEvent dropped).
func awcTestNorm(_ v: Any?) -> Any {
    switch v {
    case nil: return NSNull()
    case is NSNull: return NSNull()
    case let n as NSNumber where CFGetTypeID(n) == CFBooleanGetTypeID(): return n.boolValue
    case let n as NSNumber: return n.doubleValue
    case let b as Bool: return b
    case let i as Int: return Double(i)
    case let d as Double: return d
    case let s as String: return s
    case let a as AWCValue:
        switch a { case .null: return NSNull(); case .number(let n): return n; case .string(let s): return s; case .bool(let b): return b
        case .array(let x): return x.map { awcTestNorm($0) }; case .object(let o): return awcTestNorm(o.mapValues { $0 as Any }) }
    case let a as [Int]: return a.map { Double($0) }
    case let a as [Any]: return a.map { awcTestNorm($0) }
    case let a as [[String: Any?]]: return a.map { awcTestNorm($0) }
    case let o as [String: Any?]: var r: [String: Any] = [:]; for (k, x) in o where k != "nativeEvent" { if let w = x { r[k] = awcTestNorm(w) } else { r[k] = NSNull() } }; return r
    case let o as [String: Any]: var r: [String: Any] = [:]; for (k, x) in o where k != "nativeEvent" { r[k] = awcTestNorm(x) }; return r
    default: return String(describing: v!)
    }
}

func awcTestEqual(_ a: Any, _ b: Any) -> Bool {
    switch (a, b) {
    case (is NSNull, is NSNull): return true
    case (let x as Double, let y as Double): return x == y
    case (let x as Bool, let y as Bool): return x == y
    case (let x as String, let y as String): return x == y
    case (let x as [Any], let y as [Any]): return x.count == y.count && zip(x, y).allSatisfy { awcTestEqual($0, $1) }
    case (let x as [String: Any], let y as [String: Any]):
        // null and absent compare equal (a JS detail omits undefined keys).
        let kx = Set(x.keys.filter { !(x[$0] is NSNull) }), ky = Set(y.keys.filter { !(y[$0] is NSNull) })
        return kx == ky && kx.allSatisfy { awcTestEqual(x[$0]!, y[$0]!) }
    default: return false
    }
}

func awcTestCompareScene(_ a: Any?, _ b: Any?, _ path: String, _ out: inout [String]) {
    if out.count > 40 { return }
    switch (a, b) {
    case (let x as [String: Any], let y as [String: Any]):
        for k in Set(x.keys).union(y.keys).sorted() {
            if x[k] == nil { out.append("\(path).\(k): web missing"); continue }
            if y[k] == nil { out.append("\(path).\(k): native missing"); continue }
            awcTestCompareScene(x[k], y[k], path + "." + k, &out)
        }
    case (let x as [Any], let y as [Any]):
        if x.count != y.count { out.append("\(path): length web \(x.count) native \(y.count)") }
        for i in 0..<min(x.count, y.count) { awcTestCompareScene(x[i], y[i], "\(path)[\(i)]", &out) }
    case (let x as NSNumber, let y as NSNumber) where CFGetTypeID(x) != CFBooleanGetTypeID(): if abs(x.doubleValue - y.doubleValue) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
    case (let x as NSNumber, let y as Double): if abs(x.doubleValue - y) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
    case (let x as NSNumber, let y as Int): if abs(x.doubleValue - Double(y)) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
    case (let x as NSNumber, let y as Bool): if x.boolValue != y { out.append("\(path): web \(x) native \(y)") }
    case (let x as String, let y as String): if x != y { out.append("\(path): web \"\(x)\" native \"\(y)\"") }
    case (is NSNull, is NSNull): break
    default: out.append("\(path): web \(String(describing: a).prefix(60)) native \(String(describing: b).prefix(60))")
    }
}

func awcTestTokens(dark: Bool, inline: [String: String]) -> [String: String] {
    var t = AWCTheme.generated(dark: dark).tokens
    for (k, v) in inline { t[k] = v }
    return t
}

/// Events recorded per phase (by the phase whose start precedes them), compared as one ordered list.
func awcTestEvents(web: [[String: Any]], native: [(Int, AWCChartEvent)], phases: [[String: Any]], skip: Set<String> = ["mdReady"]) -> [String] {
    let w = web.filter { !skip.contains($0["name"] as? String ?? "") }.map { ($0["name"] as? String ?? "", awcTestNorm($0["detail"])) }
    let n = native.map { ($0.1.name, awcTestNorm($0.1.detail)) }
    if w.count == n.count && zip(w, n).allSatisfy({ $0.0 == $1.0 && awcTestEqual($0.1, $1.1) }) { return [] }
    var out = ["events web \(w.count) native \(n.count)"]
    for k in 0..<max(w.count, n.count) {
        let a = k < w.count ? "\(w[k].0) \(w[k].1)" : "-", b = k < n.count ? "\(n[k].0) \(n[k].1)" : "-"
        if a != b { out.append("  ev[\(k)] web \(a.prefix(200)) | native \(b.prefix(200))") }
    }
    return out
}

// MARK: line / area / bar

final class PlotReplay {
    let kind: String, c: [String: Any], name: String, phases: [[String: Any]], rtl: Bool, tag: String
    let cart: AWCChartCartesianInteraction?, bar: AWCChartBarInteraction?
    var ctl: AWCChartPlotInteraction { cart ?? bar! }
    var clock = 0.0, phaseIdx = 0
    var events: [(Int, AWCChartEvent)] = []
    var props: [String: AWCValue], inline: [String: String], inherited: Double
    var w = 0.0, h = 0.0, ox = 0.0, oy = 0.0
    var fm = AWCChartFormatters()
    var themeDensity: Double? = nil
    var diffs: [String] = []
    var inside = false

    init(_ kind: String, _ c: [String: Any], reduced: Bool) {
        self.kind = kind; self.c = c; tag = "md-\(kind)-chart"
        name = c["name"] as? String ?? ""; phases = c["phases"] as? [[String: Any]] ?? []; rtl = (c["dir"] as? String) == "rtl"
        cart = kind == "bar" ? nil : AWCChartCartesianInteraction(isArea: kind == "area")
        bar = kind == "bar" ? AWCChartBarInteraction() : nil
        var (p, i, inh) = awcTestParse(c["html"] as? String ?? "", tag: tag)
        for (k, v) in (c["props"] as? [String: Any]) ?? [:] { p[k] = awcTestValue(v) }
        props = p; inline = i; inherited = inh
        if name.hasSuffix("formatter-locale") { fm.valueFormatter = { v in v == nil ? "–" : AWCChartIntl.number(v!, "de-DE") + " €" } }
        if name.hasSuffix("custom-renderer") { fm.tooltipRenderer = { ctx in .text("<b></b> custom (\(ctx.series.count) rows)") } }
        cart?.renderer = fm.tooltipRenderer; bar?.renderer = fm.tooltipRenderer
        ctl.now = { [unowned self] in self.clock }
        ctl.reducedMotion = reduced; ctl.rtl = rtl
        ctl.onEvent = { [unowned self] e in self.events.append((self.phaseIdx, e)) }
        ctl.rebuild = { [unowned self] in self.rebuild() }
        sizeFrom(phases[0]); configure(); ctl.applyEngine()
    }

    func sizeFrom(_ p: [String: Any]) {
        let r = ((p["snap"] as? [String: Any])?["plot"] as? [String: Any])?["rect"] as? [String: Any] ?? [:]
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    func configure() {
        let pr = AWCChartProps(props)
        let series = pr.obj("series")?.array ?? []
        let xAxis = pr.obj("xAxis")
        let xData: [AWCValue]? = xAxis.flatMap { $0["data"] == .null ? nil : $0["data"].array }
        if let c = cart {
            c.series = series; c.xAxisData = xData
            c.merged = awcChartNormalizeSeriesX(series.map { $0["data"].array }, xData?.compactMap(awcChartAxisValue), xAxis.flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .category)
            c.tooltip = pr.str("tooltip", "axis"); c.zoom = pr.str("zoom", "none"); c.locale = pr.str("locale", ""); c.labelPoint = pr.str("labelPoint", "%x%: %values%")
            c.formatters = fm; c.missingFormatter = fm.valueFormatter
        }
        if let b = bar {
            b.series = series; b.xAxisData = xData
            b.tooltip = pr.str("tooltip", "axis"); b.zoom = pr.str("zoom", "none"); b.locale = pr.str("locale", ""); b.labelPoint = pr.str("labelPoint", "%x%: %values%")
            b.formatters = fm; b.missingFormatter = fm.valueFormatter
            b.polar = pr.bool("polar"); b.horizontal = pr.str("layout", "vertical") == "horizontal"; b.clickable = pr.bool("clickable")
        }
    }

    func rebuild() {
        let toks = awcTestTokens(dark: (c["theme"] as? String) == "dark", inline: inline)
        let pr = AWCChartProps(props)
        let density = themeDensity ?? awcChartDensity(pr, inherited: inherited)
        let theme = awcChartReadTheme(tokens: toks, density: density)
        var inp = AWCChartCartesianInput(tag: tag, props: pr, tokens: toks, density: density, formatters: fm)
        inp.zoomWindow = ctl.zoomWindow()
        if let b = bar {
            inp.legendHidden = b.legendHidden; inp.hiddenOverride = b.hiddenOverride
            var spec = awcChartBuildBarSpec(inp, theme: theme)
            b.valueFormatter = spec.valueFormatter; b.surface = theme.engine.surface
            ctl.scene = awcChartRenderBarScene(&spec, theme.engine, width: w, height: h, rtl: rtl)
        } else if let c = cart {
            inp.legendHidden = c.legendHidden; inp.hiddenOverride = c.hiddenOverride
            var spec = awcChartBuildCartesianSpec(inp, theme: theme)
            c.yFormatter = spec.yFormatter
            ctl.scene = awcChartRenderScene(&spec, theme.engine, width: w, height: h, rtl: rtl)
        }
    }

    var s: AWCChartScene { ctl.scene! }
    func atIndex(_ i: Int, _ f: Double = 0.5) -> (Double, Double) { (s.xPositions[i], s.plot.y + s.plot.height * f) }
    func marker(_ si: Int, _ di: Int) -> (Double, Double) { let p = s.hoverPoints[si].byIndex[di]!; return (p.x, p.y) }
    func lineBetween(_ si: Int, _ di: Int) -> (Double, Double) { let a = s.hoverPoints[si].byIndex[di]!, b = s.hoverPoints[si].byIndex[di + 1]!; return (a.x + (b.x - a.x) / 4, a.y + (b.y - a.y) / 4) }
    func areaInside(_ si: Int, _ di: Int) -> (Double, Double) { let p = s.hoverPoints[si].byIndex[di]!; return (p.x, (p.y + (s.areas.first?.baselineY ?? (s.plot.y + s.plot.height))) / 2) }
    func barCentre(_ si: Int, _ di: Int) -> (Double, Double) { let b = s.bars.first { $0.seriesIndex == si && $0.dataIndex == di } ?? s.bars[0]; return (b.x + b.w / 2, b.y + b.h / 2) }
    func sliceCentre(_ i: Int) -> (Double, Double) { let sl = s.slices[i]; let a = (sl.startAngle + sl.endAngle) / 2, r = (sl.innerR + sl.outerR) / 2; return (sl.cx + cos(a) * r, sl.cy + sin(a) * r) }
    /// Blink carries pointer positions as float32: quantise the page coordinate, then return to canvas space.
    func q(_ p: (Double, Double)) -> (Double, Double) { (Double(Float(ox + p.0)) - ox, Double(Float(oy + p.1)) - oy) }
    func move(_ p0: (Double, Double)) {
        let p = q(p0)
        let now = p.0 >= 0 && p.1 >= 0 && p.0 <= w && p.1 <= h
        if !now { if inside { ctl.pointerLeave() }; inside = false; return }
        inside = true; ctl.pointerMove(p.0, p.1)
    }
    func leave() { if inside { ctl.pointerLeave() }; inside = false }
    func down(_ p0: (Double, Double)) { move(p0); let p = q(p0); ctl.pointerDown(p.0, p.1, button: 0) }
    func up(_ p0: (Double, Double)) { let p = q(p0); ctl.pointerUp(p.0, p.1, insideCanvas: inside) }
    func click(_ p: (Double, Double)) { down(p); up(p) }
    func drag(_ from: (Double, Double), _ to: () -> (Double, Double)) {
        let t = to()
        down(from)
        for k in 1...8 { clock += 35; move((from.0 + (t.0 - from.0) * Double(k) / 8, from.1 + (t.1 - from.1) * Double(k) / 8)) }
        up(t)
    }
    func dbl(_ p0: (Double, Double)) { move(p0); let p = q(p0); ctl.pointerDown(p.0, p.1, button: 0); up(p0); ctl.pointerDown(p.0, p.1, button: 0); up(p0) }
    func legendClick(_ i: Int) { leave(); ctl.legendToggle(i) }

    func steps() -> [() -> Void] {
        let k = kind
        let keyAll: [() -> Void] = [{}, { _ = self.ctl.keyDown("ArrowRight") }, { _ = self.ctl.keyDown("ArrowRight") }, { _ = self.ctl.keyDown("End") }, { _ = self.ctl.keyDown("ArrowRight") },
            { _ = self.ctl.keyDown("Home") }, { _ = self.ctl.keyDown("ArrowLeft") }, { _ = self.ctl.keyDown("ArrowDown") }, { _ = self.ctl.keyDown("ArrowRight") },
            { _ = self.ctl.keyDown("Enter") }, { _ = self.ctl.keyDown(" ") }, { _ = self.ctl.keyDown("Escape") }, { _ = self.ctl.keyDown("ArrowRight") }, { self.ctl.blur() }]
        switch true {
        case name.contains("-hover-axis-"): return [{}, { self.move(self.atIndex(1)) }, { self.move(self.atIndex(3)) }, { self.move(self.atIndex(5)) }, { self.leave() }]
        case name == "bar-hover-item": return [{ self.move(self.barCentre(0, 1)) }, { self.move(self.barCentre(1, 3)) }, { self.move(self.atIndex(2, 0.02)) }, { self.leave() }]
        case name == "bar-hover-horizontal": return [{}, { self.move((self.s.plot.x + self.s.plot.width / 2, self.s.xPositions[1])) }, { self.move((self.s.plot.x + self.s.plot.width / 2, self.s.xPositions[4])) }, { self.leave() }]
        case name == "bar-keys-horizontal": return [{}, { _ = self.ctl.keyDown("ArrowDown") }, { _ = self.ctl.keyDown("ArrowRight") }, { _ = self.ctl.keyDown("ArrowUp") }, { _ = self.ctl.keyDown("Enter") }]
        case name == "bar-click": return [{ self.click(self.barCentre(0, 1)) }, { self.click(self.barCentre(1, 4)) }, { self.click(self.atIndex(2, 0.02)) }, { self.click((self.s.plot.x + 2, self.s.plot.y + self.s.plot.height - 2)) }]
        case name == "bar-click-horizontal": return [{ self.click(self.barCentre(0, 2)) }]
        case name == "bar-click-negative": return [{ self.click(self.barCentre(0, 1)) }]
        case name == "bar-click-stacked": return [{ self.click(self.barCentre(2, 3)) }]
        case name == "bar-click-polar": return [{ self.click(self.sliceCentre(1)) }]
        case name.hasSuffix("-hover-item"): return [{ self.move(self.marker(0, 1)) }, { self.move(self.marker(1, 3)) }, { self.move(self.atIndex(2, 0.02)) }, { self.leave() }]
        case name.hasSuffix("-hover-tooltip-none") || name.hasSuffix("-custom-renderer") || name.hasSuffix("-hover-stacked"): return [{ self.move(self.atIndex(2)) }, { self.leave() }]
        case name.hasSuffix("-formatter-locale"): return [{ self.move(self.atIndex(0)) }, { self.leave() }]
        case name.hasSuffix("-keys-ltr") || name.hasSuffix("-keys-rtl"): return keyAll
        case name.hasSuffix("-keys-label-point"): return Array(keyAll.prefix(3))
        case name.hasSuffix("-keys-zoomed"): return [{}, { _ = self.ctl.keyDown("Home") }, { _ = self.ctl.keyDown("End") }, { _ = self.ctl.keyDown("ArrowRight") }, { _ = self.ctl.keyDown("Enter") }]
        case name.hasSuffix("-keys-inverted"): return [{}, { _ = self.ctl.keyDown("ArrowRight") }, { _ = self.ctl.keyDown("ArrowDown") }]
        case name.hasSuffix("-keys-legend"): return [{}, { self.ctl.blur() }, { self.ctl.legendToggle(0) }, {}, { self.ctl.legendToggle(1) }, {}, { self.ctl.legendToggle(0) }]
        case name.hasSuffix("-keys-empty"): return [{}]
        case name == "\(k)-click": return [{ self.click(self.marker(0, 1)) }, { self.click(self.lineBetween(0, 2)) }, { self.click(self.atIndex(3, 0.02)) }]
        case name == "\(k)-click-area": return [{ self.click(self.areaInside(0, 2)) }]
        case name.hasSuffix("-legend-pointer"): return [{ self.leave() }, { self.legendClick(1) }, { self.move(self.atIndex(2)) }, { self.legendClick(1) }, { self.leave() }]
        case name.hasSuffix("-zoom-inside"): return [{ self.drag(self.atIndex(1)) { self.atIndex(4) } }, { self.move(self.atIndex(2)) }, { let f = self.atIndex(2, 0.4); self.drag(f) { self.atIndex(1, 0.4) } },
                                                       { let f = self.atIndex(0); self.drag(f) { (self.s.xPositions[0] + 4, self.s.plot.y + self.s.plot.height / 2) } }, { self.dbl(self.atIndex(0, 0.1)) }]
        case name.hasSuffix("-zoom-inside-rtl"): return [{ self.drag(self.atIndex(1)) { self.atIndex(4) } }, { self.dbl(self.atIndex(1, 0.1)) }]
        case name.hasSuffix("-zoom-slider"): return [{}, {}, { let w = self.ctl.win(); self.ctl.zoomSliderInput(Double(w.0 + 1), Double(w.1)) }, { let w = self.ctl.win(); self.ctl.zoomSliderInput(Double(w.0 + 1), Double(w.1)) },
                                                       {}, { let w = self.ctl.win(); self.ctl.zoomSliderInput(Double(w.0), Double(w.1 - 1)) }, { self.ctl.setZoom(0, 2) }, { self.ctl.resetZoom() }]
        case name.hasSuffix("-runtime"):
            let original = props["series"]
            return [{}, { self.ctl.loadingChanged(now: true, before: false) }, { self.ctl.loadingChanged(now: false, before: true) },
                    { self.props["series"] = .array([]); self.configure(); self.ctl.applyEngine() },
                    { self.props["series"] = original; self.configure(); self.ctl.applyEngine() },
                    { self.ctl.applyEngine() },
                    { self.props["locale"] = .string("de-DE"); self.props["series"] = .array([.object(["label": .string("Sales"), "data": .array([1200, 2400, 1800, 3600, 3000, 4200].map { .number($0) })])]); self.configure(); self.ctl.applyEngine() },
                    { self.themeDensity = AWCChartProps(self.props).num("density") ?? self.inherited; self.props["density"] = .number(-3) }]
        default: return []
        }
    }

    func run() -> [String] {
        if name.hasSuffix("-keys-zoomed") { ctl.setZoom(2, 4); events.removeAll() }
        let st = steps()
        guard st.count == phases.count else { return ["steps \(st.count) != phases \(phases.count)"] }
        for (i, p) in phases.enumerated() {
            phaseIdx = i
            clock = num(p["t"]) + 1000
            let before = (w, h)
            sizeFrom(p)
            if before != (w, h) { ctl.resize() }
            st[i]()
            clock += 300
            ctl.tick(clock); ctl.tick(clock + 400)
            compare(i, p)
        }
        diffs += awcTestEvents(web: c["events"] as? [[String: Any]] ?? [], native: events, phases: phases)
        return diffs
    }

    func compare(_ i: Int, _ p: [String: Any]) {
        let label = "\(p["label"] ?? "")#\(i)"
        guard let sm = (p["samples"] as? [[String: Any]])?.last else { return }
        if (sm["live"] as? String ?? "") != ctl.announcement { diffs.append("\(label) live web '\(sm["live"] ?? "")' native '\(ctl.announcement)'") }
        let hi = sm["hoverIndex"] as? String
        if hi != ctl.hoverIndexAttr.map { String($0) } { diffs.append("\(label) hoverIndex web \(hi ?? "nil") native \(ctl.hoverIndexAttr.map { String($0) } ?? "nil")") }
        let tip = sm["tooltip"] as? [String: Any]
        let m = ctl.hover?.model
        let text: String? = m.flatMap { m in m.customText ?? (m.rows.isEmpty ? nil : ([m.header] + m.rows.flatMap { [$0.label, $0.value] }).joined(separator: "\n")) }
        if (tip?["text"] as? String) != text { diffs.append("\(label) tooltip web \(tip?["text"] ?? "nil") native \(text ?? "nil")") }
        if let tip, text != nil, let r = tip["rect"] as? [String: Any], let o = ctl.tooltipOrigin(num(r["width"]), num(r["height"]), roomAbove: true) {
            if abs(ox + o.x - num(r["x"])) > 0.02 || abs(oy + o.y - num(r["y"])) > 0.02 { diffs.append("\(label) tooltip at web \(num(r["x"])),\(num(r["y"])) native \(ox + o.x),\(oy + o.y)") }
        }
        let nodes = sm["hoverNodes"] as? [[String: Any]] ?? []
        if let m {
            var mine: [(String, [Double])] = []
            if let l = m.line { mine.append(("line", [ox + l.minX, oy + l.minY, l.width, l.height])) }
            for mk in m.markers { mine.append((mk.dimmed ? "0.4" : "1", [ox + mk.x, oy + mk.y])) }
            if nodes.count != mine.count { diffs.append("\(label) hover nodes web \(nodes.count) native \(mine.count)") }
            for (k, n) in nodes.enumerated() where k < mine.count {
                let r = n["rect"] as? [String: Any] ?? [:]
                if mine[k].0 == "line" {
                    let e = [num(r["x"]), num(r["y"]), num(r["width"]), num(r["height"])]
                    if zip(e, mine[k].1).contains(where: { abs($0 - $1) > 0.02 }) { diffs.append("\(label) crosshair web \(e) native \(mine[k].1)") }
                } else {
                    let cx = num(r["x"]) + num(r["width"]) / 2, cy = num(r["y"]) + num(r["height"]) / 2
                    if abs(cx - mine[k].1[0]) > 0.03 || abs(cy - mine[k].1[1]) > 0.03 { diffs.append("\(label) marker[\(k)] web \(cx),\(cy) native \(mine[k].1)") }
                    if (n["opacity"] as? String) != mine[k].0 { diffs.append("\(label) marker[\(k)] opacity web \(n["opacity"] ?? "") native \(mine[k].0)") }
                }
            }
        } else if !nodes.isEmpty { diffs.append("\(label) hover nodes web \(nodes.count) native 0") }
        if let web = p["scene"] as? [String: Any], let scene = ctl.scene {
            var out: [String] = []
            awcTestCompareScene(web, awcChartSceneJSON(scene), "scene", &out)
            diffs += out.prefix(6).map { "\(label) \($0)" }
        }
    }
}

// MARK: pie

final class PieReplay {
    let c: [String: Any], name: String, phases: [[String: Any]], rtl: Bool
    var dark: Bool
    let ctl = AWCChartPieInteraction()
    var clock = 0.0, phaseIdx = 0
    var events: [(Int, AWCChartEvent)] = []
    var props: [String: AWCValue], inline: [String: String], inherited: Double
    var w = 0.0, h = 0.0, ox = 0.0, oy = 0.0
    var fm = AWCChartFormatters()
    var diffs: [String] = []
    var probe: [Int: (Double, Double)] = [:]
    let DATA: [AWCValue]

    init(_ c: [String: Any]) {
        self.c = c; name = c["name"] as? String ?? ""; phases = c["phases"] as? [[String: Any]] ?? []; rtl = (c["dir"] as? String) == "rtl"; dark = (c["theme"] as? String) == "dark"
        var (p, i, inh) = awcTestParse(c["html"] as? String ?? "", tag: "md-pie-chart")
        for (k, v) in (c["props"] as? [String: Any]) ?? [:] { p[k] = awcTestValue(v) }
        props = p; inline = i; inherited = inh
        DATA = p["data"]?.array ?? []
        if name == "pie-keyboard-templates" { fm.valueFormatter = { v in "\(awcJSNumberString(v ?? 0)) vizite" } }
        if name == "pie-hover-tooltip-renderer" { ctl.renderer = { ctx in .text("\(ctx.axisLabel): \(String(format: "%.2f", ctx.series.first { $0.focused }?.percent ?? 0))% of traffic") } }
        ctl.now = { [unowned self] in self.clock }
        ctl.rtl = rtl
        ctl.onEvent = { [unowned self] e in self.events.append((self.phaseIdx, e)) }
        ctl.buildSpec = { [unowned self] in
            let toks = awcTestTokens(dark: self.dark, inline: self.inline)
            let pr = AWCChartProps(self.props)
            let density = awcChartDensity(pr, inherited: self.inherited)
            var inp = AWCChartCartesianInput(tag: "md-pie-chart", props: pr, tokens: toks, density: density, formatters: self.fm)
            inp.legendHidden = self.ctl.legendHidden
            return awcChartBuildPieSpec(inp, theme: awcChartReadTheme(tokens: toks, density: density), rtl: self.rtl)
        }
        ctl.layout = { [unowned self] spec in
            let toks = awcTestTokens(dark: self.dark, inline: self.inline)
            let density = awcChartDensity(AWCChartProps(self.props), inherited: self.inherited)
            return awcChartComputePieLayout(spec, awcChartReadTheme(tokens: toks, density: density).engine, self.w, self.h)
        }
        sizeFrom(phases[0]); configure(); ctl.applyEngine()
        for sl in (ctl.scene?.slices ?? []).reversed() { let a = (sl.startAngle + sl.endAngle) / 2, r = (sl.innerR + sl.outerR) / 2; probe[sl.dataIndex] = (sl.cx + cos(a) * r, sl.cy + sin(a) * r) }
    }

    func sizeFrom(_ p: [String: Any]) {
        let cv = (p["overlay"] as? [[String: Any]] ?? []).first { ($0["tag"] as? String) == "canvas" }
        let r = cv?["rect"] as? [String: Any] ?? [:]
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    func configure() {
        let pr = AWCChartProps(props)
        ctl.data = pr.obj("data")?.array ?? []
        ctl.locale = pr.str("locale", ""); ctl.labelPoint = pr.str("labelPoint", "%label%: %value% (%percent%)")
        ctl.valueFormatter = fm.valueFormatter.map { f in { v in f(v) } }
    }

    func q(_ p: (Double, Double)) -> (Double, Double) { (Double(Float(ox + p.0)) - ox, Double(Float(oy + p.1)) - oy) }
    func hover(_ i: Int) { let p = q(probe[i]!); ctl.pointerMove(p.0, p.1) }
    func setData(_ v: [AWCValue]) { props["data"] = .array(v); configure(); ctl.applyEngine() }
    func with(_ d: AWCValue, _ k: String, _ v: AWCValue) -> AWCValue { guard case .object(var o) = d else { return d }; o[k] = v; return .object(o) }
    func without(_ d: AWCValue, _ k: String) -> AWCValue { guard case .object(var o) = d else { return d }; o[k] = nil; return .object(o) }

    func steps() -> [() -> Void] {
        let leave: () -> Void = { self.ctl.pointerLeave() }
        if name.contains("-entrance-") || name == "pie-nested-entrance" { return [{}] }
        switch name {
        case "pie-replay": return [{ self.ctl.replay() }]
        case "pie-hover-slice", "pie-hover-series", "pie-hover-none": return [{ self.hover(0) }, { self.hover(2) }, leave]
        case "donut-hover-slice": return [{ self.hover(0) }, { self.hover(3) }, leave]
        case "pie-hover-rtl-dark": return [{ self.hover(1) }, leave]
        case "pie-hover-locale-de", "pie-hover-tooltip-renderer": return [{ self.hover(0) }, leave]
        case "pie-hover-nested": return [{ self.hover(0) }, { self.hover(4) }, leave]
        case "pie-click": return [{ self.hover(1) }, { let p = self.q(self.probe[1]!); self.ctl.pointerDown(p.0, p.1) }, { let p = self.q(self.probe[1]!); self.ctl.pointerUp(p.0, p.1) },
                                  { self.setData(self.DATA.enumerated().map { $0.offset == 1 ? self.with($0.element, "selected", .bool(true)) : $0.element }) }, leave]
        case "pie-legend-pointer": return [{ self.ctl.legendToggle(1) }, { self.ctl.legendToggle(3) }, { self.setData(self.DATA.map { self.with($0, "value", .number(($0["value"].number ?? 0) + 1)) }) }, { self.ctl.legendToggle(1) }, leave]
        case "pie-legend-rtl": return [{ self.ctl.legendToggle(0) }, leave]
        case "pie-refeed": return [{ self.setData(self.DATA.enumerated().map { self.with($0.element, "value", .number([10, 30, 25, 20, 15][$0.offset])) }) }, { self.setData(Array(self.DATA.prefix(3))) }]
        case "pie-drill":
            let kids: [AWCValue] = [.object(["label": .string("Phones"), "value": .number(10)]), .object(["label": .string("Laptops"), "value": .number(22)]), .object(["label": .string("Tablets"), "value": .number(8)])]
            return [{ self.ctl.drill(0, direction: "down"); self.setData(kids) }, { self.ctl.drill(0, direction: "up"); self.setData(self.DATA.map { self.without($0, "children") }) }]
        case "pie-loading-to-loaded":
            let data: [AWCValue] = [("search", "Search", 42), ("direct", "Direct", 26), ("social", "Social", 18), ("email", "Email", 9), ("referral", "Referral", 5)].map { .object(["id": .string($0.0), "label": .string($0.1), "value": .number(Double($0.2))]) }
            return [{ self.setData(data); self.props["loading"] = nil; self.ctl.loadingChanged() }]
        case "pie-theme-flip": return [{ self.dark = true; self.ctl.applyEngine() }, { self.dark = false; self.ctl.applyEngine() }]
        default: break
        }
        guard name.hasPrefix("pie-keyboard-") || name == "pie-legend-keyboard" else { return [] }
        var legendFocus = -1
        return phases.map { p in
            let l = p["label"] as? String ?? ""
            switch l {
            case "tab-in": return {}
            case "Space", " ": return { if legendFocus >= 0 { self.ctl.legendToggle(legendFocus) } else { _ = self.ctl.keyDown(" ") } }
            case "Enter": return { if legendFocus >= 0 { self.ctl.legendToggle(legendFocus) } else { _ = self.ctl.keyDown("Enter") } }
            case "Tab": return { if self.name == "pie-legend-keyboard" { if legendFocus < 0 { self.ctl.blur() }; legendFocus += 1 } else { self.ctl.blur() } }
            case "Tab+Shift": return { legendFocus -= 1 }
            case "shrink": return { self.setData(Array(self.DATA.prefix(2))) }
            case "hide-current": return { self.setData(self.DATA.prefix(2).enumerated().map { $0.offset == 0 ? self.with($0.element, "hidden", .bool(true)) : $0.element }) }
            case "empty": return { self.setData([]) }
            default: return { _ = self.ctl.keyDown(l) }
            }
        }
    }

    func run() -> [String] {
        let st = steps()
        guard st.count == phases.count else { return ["steps \(st.count) != phases \(phases.count)"] }
        for (i, p) in phases.enumerated() {
            phaseIdx = i
            clock = num(p["t"]) + 5000
            let before = (w, h)
            sizeFrom(p)
            if before != (w, h) { ctl.resize() }
            st[i]()
            for _ in 0..<60 { clock += 16; ctl.tick(clock) }
            _ = ctl.drillFrame(clock + 2000)
            compare(i, p)
        }
        diffs += awcTestEvents(web: c["events"] as? [[String: Any]] ?? [], native: events, phases: phases)
        return diffs
    }

    func compare(_ i: Int, _ p: [String: Any]) {
        let label = "\(p["label"] ?? "")#\(i)"
        guard let sm = (p["samples"] as? [[String: Any]])?.last else { return }
        if (sm["live"] as? String ?? "") != ctl.announcement { diffs.append("\(label) live web '\(sm["live"] ?? "")' native '\(ctl.announcement)'") }
        let t = ctl.tooltip
        let text = t.map { $0.customText ?? (($0.label ?? "") + ($0.value ?? "")) }
        if (sm["tip"] as? String) != text { diffs.append("\(label) tip web \(sm["tip"] ?? "nil") native \(text ?? "nil")") }
        if let r = sm["tipRect"] as? [String: Any], t != nil, let o = ctl.tooltipOrigin(num(r["width"]), num(r["height"])) {
            if abs(ox + o.x - num(r["x"])) > 1.0 / 64 || abs(oy + o.y - num(r["y"])) > 1.0 / 64 { diffs.append("\(label) tip at web \(num(r["x"])),\(num(r["y"])) native \(ox + o.x),\(oy + o.y)") }
        }
        if let web = (p["engine"] as? [String: Any])?["scene"] as? [String: Any], let scene = ctl.scene {
            var out: [String] = []
            awcTestCompareScene(web, awcChartSceneJSON(scene), "scene", &out)
            diffs += out.prefix(6).map { "\(label) \($0)" }
        }
    }
}

// MARK: sparkline

final class SparkReplay {
    let c: [String: Any], name: String, phases: [[String: Any]], rtl: Bool
    var dark: Bool
    let ctl = AWCChartSparkInteraction()
    var clock = 0.0, phaseIdx = 0
    var events: [(Int, AWCChartEvent)] = []
    var props: [String: AWCValue], inline: [String: String]
    var w = 0.0, h = 0.0, ox = 0.0, oy = 0.0
    var fm = AWCChartFormatters()
    var diffs: [String] = []
    var xs: [Double] = [], midY = 0.0
    let DATA: [AWCValue]

    init(_ c: [String: Any]) {
        self.c = c; name = c["name"] as? String ?? ""; phases = c["phases"] as? [[String: Any]] ?? []; rtl = (c["dir"] as? String) == "rtl"; dark = (c["theme"] as? String) == "dark"
        var (p, i, _) = awcTestParse(c["html"] as? String ?? "", tag: "md-sparkline")
        for (k, v) in (c["props"] as? [String: Any]) ?? [:] { p[k] = awcTestValue(v) }
        props = p; inline = i; DATA = p["data"]?.array ?? []
        if name == "spark-hover-labels-formatter" { fm.valueFormatter = { v in v == nil ? "—" : "€" + awcJSNumberString(v!) } }
        ctl.now = { [unowned self] in self.clock }; ctl.rtl = rtl
        ctl.onEvent = { [unowned self] e in self.events.append((self.phaseIdx, e)) }
        ctl.rebuild = { [unowned self] plot in
            let toks = awcTestTokens(dark: self.dark, inline: self.inline)
            let theme = awcChartReadTheme(tokens: toks, density: 0)
            plot.scene = awcChartRenderSparkScene(AWCChartSparkInput(props: AWCChartProps(self.props), tokens: toks, formatters: self.fm), theme: theme, width: self.w, height: self.h, rtl: self.rtl)
            let f: (Double) -> String = { [fm = self.fm] v in fm.valueFormatter?(v) ?? AWCChartIntl.number(v, "") }
            (plot as? AWCChartCartesianInteraction)?.yFormatter = f
            (plot as? AWCChartBarInteraction)?.valueFormatter = f
        }
        sizeFrom(phases[0]); apply()
        if let s = ctl.plot?.scene { xs = s.xPositions.isEmpty ? s.bars.map { $0.x + $0.w / 2 } : s.xPositions; midY = s.plot.y + s.plot.height / 2 }
    }

    func sizeFrom(_ p: [String: Any]) {
        let cv = (p["overlay"] as? [[String: Any]] ?? []).first { ($0["tag"] as? String) == "canvas" }
        let r = cv?["rect"] as? [String: Any] ?? [:]
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    func apply() {
        let pr = AWCChartProps(props)
        ctl.data = pr.obj("data")?.array ?? []
        ctl.showTooltip = pr.bool("showTooltip", true)
        ctl.applyEngine(variant: pr.str("variant", "line"))
    }

    func q(_ x: Double, _ y: Double) -> (Double, Double) { (Double(Float(ox + x)) - ox, Double(Float(oy + y)) - oy) }
    func set(_ k: String, _ v: AWCValue) { props[k] = v; apply() }

    func steps() -> [() -> Void] {
        phases.map { p in
            let l = p["label"] as? String ?? ""
            if ["settled", "tab-in", "Enter", "ArrowRight"].contains(l) { return {} }
            if l == "leave" { return { self.ctl.plot?.pointerLeave() } }
            if l.hasPrefix("hover-"), let i = Int(l.dropFirst(6)) { return { let p = self.q(self.xs[i], self.midY); self.ctl.plot?.pointerMove(p.0, p.1) } }
            if l.hasPrefix("click-"), let i = Int(l.dropFirst(6)) {
                return { let p = self.q(self.xs[i], self.midY); self.ctl.plot?.pointerMove(p.0, p.1); self.ctl.plot?.pointerDown(p.0, p.1, button: 0); self.ctl.plot?.pointerUp(p.0, p.1, insideCanvas: true) }
            }
            switch l {
            case "values": return { self.set("data", .array(self.DATA.map { .number(40 - ($0.number ?? 0)) })) }
            case "longer": return { self.set("data", .array(self.DATA + [36, 38, 41].map { .number($0) })) }
            case "empty": return { self.set("data", .array([])) }
            case "back": return { self.set("data", .array(self.DATA)) }
            case "to-bar": return { self.set("variant", .string("bar")) }
            case "to-area": return { self.set("variant", .string("area")) }
            case "color": return { self.set("color", .string("error")) }
            case "ref": return { self.set("referenceAreas", .array([.object(["from": .number(2), "to": .number(5), "label": .string("Promo")])])) }
            case "to-dark": return { self.dark = true; self.apply() }
            case "to-light": return { self.dark = false; self.apply() }
            default: return { self.diffs.append("unknown step \(l)") }
            }
        }
    }

    func run() -> [String] {
        let st = steps()
        for (i, p) in phases.enumerated() {
            phaseIdx = i
            clock = num(p["t"]) + 5000
            let before = (w, h)
            sizeFrom(p)
            if before != (w, h) { ctl.plot?.resize() }
            st[i]()
            compare(i, p)
        }
        diffs += awcTestEvents(web: c["events"] as? [[String: Any]] ?? [], native: events, phases: phases)
        return diffs
    }

    func compare(_ i: Int, _ p: [String: Any]) {
        let label = "\(p["label"] ?? "")#\(i)"
        guard let sm = (p["samples"] as? [[String: Any]])?.last, let plot = ctl.plot else { return }
        let m = plot.hover?.model
        let text: String? = m.flatMap { m in m.customText ?? (m.rows.isEmpty ? nil : m.header + m.rows.map { $0.label + $0.value }.joined()) }
        if (sm["tip"] as? String) != text { diffs.append("\(label) tip web \(sm["tip"] ?? "nil") native \(text ?? "nil")") }
        if let r = sm["tipRect"] as? [String: Any], text != nil {
            let th = num(r["height"])
            if let o = plot.tooltipOrigin(num(r["width"]), th, roomAbove: oy - th.rounded() - 6 >= 0), abs(ox + o.x - num(r["x"])) > 1.0 / 64 || abs(oy + o.y - num(r["y"])) > 1.0 / 64 {
                diffs.append("\(label) tip at web \(num(r["x"])),\(num(r["y"])) native \(ox + o.x),\(oy + o.y)")
            }
        }
        let summary = awcChartSparkSummary(AWCChartProps(props), formatters: fm)
        if (sm["label"] as? String) != summary { diffs.append("\(label) aria-label web '\(sm["label"] ?? "")' native '\(summary)'") }
        if let web = (p["engine"] as? [String: Any])?["scene"] as? [String: Any], let scene = plot.scene {
            var out: [String] = []
            awcTestCompareScene(web, awcChartSceneJSON(scene), "scene", &out)
            diffs += out.prefix(6).map { "\(label) \($0)" }
        }
    }
}

/// `<dir>/<tag>/<file>`, or the published layout `<dir>/<tag>/web-oracle-mac/<file>` (`outputs/native-parity`).
fileprivate func awcChartOracleFile(_ dir: URL, _ tag: String, _ file: String) -> URL {
    let flat = dir.appendingPathComponent(tag).appendingPathComponent(file)
    if FileManager.default.fileExists(atPath: flat.path) { return flat }
    return dir.appendingPathComponent(tag).appendingPathComponent("web-oracle-mac").appendingPathComponent(file)
}
