import Foundation
@testable import AWCUI

// Cartesian chart RenderScene parity: every Chrome paint case (core light/dark × LTR/RTL, extras,
// dark extras, forced colours) is rebuilt from the same markup + properties through the native
// model → spec → layout → measured-legend pass → RTL mirror, and the resulting scene is compared
// field by field with the Web engine's `getScene()` (both rounded to 0.01 px).
// Usage: NativeChartSceneIntegration [oracle-dir] [chart...]   (default: the published oracles, outputs/native-parity)

@main enum NativeChartSceneIntegration {
    static var checks = 0, failures = 0
    static func main() {
        let args = CommandLine.arguments.dropFirst()
        let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let dir = args.first.map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("../../../../../outputs/native-parity").standardizedFileURL
        let charts = args.count > 1 ? Array(args.dropFirst()) : ["line", "area", "bar", "pie", "sparkline"]
        print("oracles \(dir.path) charts \(charts.joined(separator: ","))")
        var report: [[String: Any]] = []
        for kind in charts {
            let tag = kind == "sparkline" ? "md-sparkline" : "md-\(kind)-chart"
            for subset in (kind == "pie" || kind == "sparkline" ? ["paint"] : ["paint-core", "paint-extra", "paint-dark-extra", "paint-forced-colors"]) {
                let url = awcChartOracleFile(dir, tag, "\(subset).json")
                guard let data = try? Data(contentsOf: url), let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let cases = root["cases"] as? [[String: Any]] else { print("missing \(url.path)"); failures += 1; continue }
                var passed = 0
                for c in cases {
                    let name = c["name"] as? String ?? "?"
                    guard let web = (c["scene"] ?? (c["engine"] as? [String: Any])?["scene"]) as? [String: Any] else { continue }
                    let native = nativeScene(c, kind: kind, tag: tag, web: web, firstData: (cases.first?["props"] as? [String: Any])?["data"])
                    var diffs: [String] = []
                    compare(web, native, "scene", &diffs)
                    checks += 1
                    if diffs.isEmpty { passed += 1 } else {
                        failures += 1
                        print("FAIL \(name): \(diffs.count) differences"); for d in diffs.prefix(12) { print("   " + d) }
                    }
                    report.append(["case": name, "subset": subset, "diffs": diffs.count, "first": Array(diffs.prefix(40))])
                }
                print("\(tag) \(subset): \(passed)/\(cases.filter { $0["scene"] is [String: Any] || $0["engine"] is [String: Any] }.count) scenes identical")
            }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_CHART_SCENE_REPORT"], let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: URL(fileURLWithPath: out))
        }
        print("NativeChartSceneIntegration: \(checks - failures)/\(checks) scenes identical")
        exit(failures == 0 ? 0 : 1)
    }

    /// `<md-line-chart a="b" flag style="…">` → camelCase properties, inline custom properties and the wrapper's inherited density.
    static func parse(_ html: String, tag: String) -> (props: [String: AWCValue], tokens: [String: String], inheritedDensity: Double) {
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
            if props[camel] == nil { props[camel] = value.map { .string($0) } ?? .bool(true) }  // HTML: the first duplicate attribute wins
        }
        return (props, tokens, inherited)
    }

    static func value(_ any: Any) -> AWCValue {
        switch any {
        case let s as String: return .string(s)
        case let n as NSNumber: return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue)
        case let a as [Any]: return .array(a.map(value))
        case let o as [String: Any]: return .object(o.mapValues(value))
        default: return .null
        }
    }

    static func nativeScene(_ c: [String: Any], kind: String, tag: String, web: [String: Any], firstData: Any?) -> [String: Any] {
        let name = c["name"] as? String ?? ""
        var (props, inline, inherited) = parse(c["html"] as? String ?? "", tag: tag)
        for (k, v) in (c["props"] as? [String: Any]) ?? [:] { props[k] = value(v) }
        // Cases whose data the page assigns in `prepare` (after mount) use the page's default data set.
        if name.hasSuffix("ancestor-density-3") && (kind == "pie" || kind == "sparkline"), let d = firstData { props["data"] = value(d) }
        var tokens = AWCTheme.generated(dark: (c["theme"] as? String) == "dark").tokens
        for (k, v) in inline { tokens[k] = v }
        let p = AWCChartProps(props)
        let density = awcChartDensity(p, inherited: inherited)
        var input = AWCChartCartesianInput(tag: tag, props: p, tokens: tokens, density: density)
        switch name {
        case "pie-value-formatter": input.formatters.valueFormatter = { v in "$" + String(format: "%.2f", v ?? 0) }
        case "spark-labels-formatter": input.formatters.valueFormatter = { v in v == nil ? "—" : "€" + awcJSNumberString(v!) }
        default: if name.hasSuffix("-formatter") { input.formatters.valueFormatter = { v in v == nil ? "–" : "$" + String(format: "%.1f", (v! / 1000)) + "k" } }
        }
        if name.hasSuffix("zoom-both-window") { input.zoomWindow = (1, 4) }
        let theme = awcChartReadTheme(tokens: tokens, density: density)
        let w = (web["width"] as? Double) ?? 0, h = (web["height"] as? Double) ?? 0
        let rtl = (c["dir"] as? String) == "rtl"
        let scene: AWCChartScene
        switch kind {
        case "bar": var spec = awcChartBuildBarSpec(input, theme: theme); scene = awcChartRenderBarScene(&spec, theme.engine, width: w, height: h, rtl: rtl)
        case "pie": var spec = awcChartBuildPieSpec(input, theme: theme, rtl: rtl); spec.highlightIndex = -1; spec.highlightT = 0; scene = awcChartComputePieLayout(spec, theme.engine, w, h)
        case "sparkline": scene = awcChartRenderSparkScene(AWCChartSparkInput(props: p, tokens: tokens, formatters: input.formatters), theme: theme, width: w, height: h, rtl: rtl)
        default: var spec = awcChartBuildCartesianSpec(input, theme: theme); scene = awcChartRenderScene(&spec, theme.engine, width: w, height: h, rtl: rtl)
        }
        return awcChartSceneJSON(scene)
    }

    static func compare(_ a: Any?, _ b: Any?, _ path: String, _ out: inout [String]) {
        if out.count > 200 { return }
        switch (a, b) {
        case (let x as [String: Any], let y as [String: Any]):
            for k in Set(x.keys).union(y.keys).sorted() {
                if x[k] == nil { out.append("\(path).\(k): web missing, native \(short(y[k]))"); continue }
                if y[k] == nil { out.append("\(path).\(k): native missing, web \(short(x[k]))"); continue }
                compare(x[k], y[k], path + "." + k, &out)
            }
        case (let x as [Any], let y as [Any]):
            if x.count != y.count { out.append("\(path): length web \(x.count) native \(y.count)") }
            for i in 0..<min(x.count, y.count) { compare(x[i], y[i], "\(path)[\(i)]", &out) }
        case (let x as NSNumber, let y as NSNumber) where CFGetTypeID(x) != CFBooleanGetTypeID() && CFGetTypeID(y) != CFBooleanGetTypeID():
            if abs(x.doubleValue - y.doubleValue) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
        case (let x as NSNumber, let y as Double): if abs(x.doubleValue - y) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
        case (let x as NSNumber, let y as Int): if abs(x.doubleValue - Double(y)) > 0.0101 { out.append("\(path): web \(x) native \(y)") }
        case (let x as NSNumber, let y as Bool): if CFGetTypeID(x) != CFBooleanGetTypeID() || x.boolValue != y { out.append("\(path): web \(x) native \(y)") }
        case (let x as String, let y as String): if x != y { out.append("\(path): web \"\(x)\" native \"\(y)\"") }
        case (is NSNull, is NSNull): break
        default: out.append("\(path): web \(short(a)) native \(short(b))")
        }
    }
    static func short(_ v: Any?) -> String { String(String(describing: v ?? "nil").prefix(80)) }
}

/// `<dir>/<tag>/<file>`, or the published layout `<dir>/<tag>/web-oracle-mac/<file>` (`outputs/native-parity`).
fileprivate func awcChartOracleFile(_ dir: URL, _ tag: String, _ file: String) -> URL {
    let flat = dir.appendingPathComponent(tag).appendingPathComponent(file)
    if FileManager.default.fileExists(atPath: flat.path) { return flat }
    return dir.appendingPathComponent(tag).appendingPathComponent("web-oracle-mac").appendingPathComponent(file)
}
