import SwiftUI
import AppKit
import ImageIO
@testable import AWCUI

// Chart entrance motion against Chrome: each motion.json case (line / area / bar, plain and reduced motion) is driven
// through the view's AWCChartState on a manual 60 Hz clock — mount, let the first entrance finish, replay(),
// then step frame by frame — and every frame's plot canvas is rasterised (ImageRenderer, 1x) and digested exactly as
// the oracle page digests Chrome's canvas: per series colour (±28 per channel, alpha ≥ 200) the matching pixel
// count, bounding box and the top / bottom match at each probe x; plus the canvas layer opacity. Anti-aliased edge pixels
// blended between two series sit near the ±28 band edge and classify differently across rasterisers, so each native
// measurement (count, each bound, each probe column) is the interval its ±24, ±28 and ±32 digests span, and Chrome's ±28
// value must fall inside it (widened by max(24, 3 %, one-pixel ring) for counts, 1 px for bounds and columns).
// Usage: NativeChartMotionIntegration <oracle dir: n5-lab/oracle-out or outputs/native-parity> [kinds…]

struct MotionDigest { var count: Int; var x0: Int?, y0: Int?, x1: Int?, y1: Int?; var cols: [(top: Int?, bottom: Int?)] }

let motionBands = [28, 24, 32]

@MainActor func rasterDigest(_ scene: AWCChartScene, width: Int, height: Int, targets: [(String, [Int])], probes: [Int], dump: String? = nil) -> [[MotionDigest]] {
    let view = Canvas { ctx, _ in var c = ctx; awcChartDrawScene(&c, scene) }.frame(width: CGFloat(width), height: CGFloat(height))
    let r = ImageRenderer(content: view); r.scale = 1
    guard let cg = r.cgImage else { return motionBands.map { _ in targets.map { _ in MotionDigest(count: -1, cols: []) } } }
    if let dump, let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: dump) as CFURL, "public.png" as CFString, 1, nil) {
        CGImageDestinationAddImage(dst, cg, nil); CGImageDestinationFinalize(dst)
    }
    let w = cg.width, h = cg.height
    var px = [UInt8](repeating: 0, count: w * h * 4)
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    // The context writes into the buffer during draw: keep the pointer valid for the whole scope (not just the init call).
    px.withUnsafeMutableBytes { buf in
        let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    var out = motionBands.map { _ in targets.map { _ in MotionDigest(count: 0, x0: Int.max, y0: Int.max, x1: -1, y1: -1, cols: probes.map { _ in (nil, nil) }) } }
    for y in 0..<h { for x in 0..<w {
        let i = (y * w + x) * 4; let a = Int(px[i + 3]); if a < 200 { continue }
        // Un-premultiply (canvas getImageData returns straight alpha).
        let r = Int(px[i]) * 255 / a, g = Int(px[i + 1]) * 255 / a, b = Int(px[i + 2]) * 255 / a
        for (k, t) in targets.enumerated() {
            let dist = max(abs(r - t.1[0]), abs(g - t.1[1]), abs(b - t.1[2]))
            for (n, band) in motionBands.enumerated() where dist <= band {
                out[n][k].count += 1
                out[n][k].x0 = min(out[n][k].x0!, x); out[n][k].x1 = max(out[n][k].x1!, x); out[n][k].y0 = min(out[n][k].y0!, y); out[n][k].y1 = max(out[n][k].y1!, y)
                for (j, pxX) in probes.enumerated() where pxX == x { if out[n][k].cols[j].top == nil { out[n][k].cols[j].top = y }; out[n][k].cols[j].bottom = y }
            }
        }
    } }
    for n in out.indices { for k in out[n].indices where out[n][k].count == 0 { out[n][k].x0 = nil; out[n][k].y0 = nil; out[n][k].x1 = nil; out[n][k].y1 = nil } }
    return out
}

/// Targets whose colour lies within ±32 of an anti-aliased blend (coverage c, composited alpha ≥ 200) of another series'
/// line over a third series' area fill it can actually cross (stacked: the area right above the line; unstacked: any) —
/// such pixels exist in one rasteriser and not the other, so their bounds and probe columns are not comparable (counts are).
func motionBlendAmbiguous(targets: [(String, [Int])], areas: [[String: Any]]) -> Set<String> {
    let stacked = areas.contains { a in
        guard let base = a["basePoints"] as? [[String: Any]], let y0 = (a["baselineY"] as? NSNumber)?.doubleValue else { return false }
        return base.contains { abs((($0["y"] as? NSNumber)?.doubleValue ?? y0) - y0) > 0.5 }
    }
    let fills: [(Int, [Double], Double)] = areas.compactMap { a in
        guard let css = a["colorTop"] as? String, let si = (a["seriesIndex"] as? NSNumber)?.intValue else { return nil }
        let n = css.split(whereSeparator: { !"0123456789.".contains($0) }).compactMap { Double($0) }
        return n.count >= 4 ? (si, Array(n[0..<3]), n[3]) : nil
    }
    var out = Set<String>()
    for (i, t) in targets.enumerated() {
        for (j, a) in targets.enumerated() where j != i {
            for (si, fill, alpha) in fills where si != i && si != j && (!stacked || si == j + 1) {
                for step in 0...100 {
                    let cov = Double(step) / 100, al = cov + alpha * (1 - cov)
                    guard al * 255 >= 200 else { continue }
                    let col = (0..<3).map { (cov * Double(a.1[$0]) + (1 - cov) * alpha * fill[$0]) / al }
                    if (0..<3).allSatisfy({ abs(col[$0] - Double(t.1[$0])) <= 32 }) { out.insert(t.0) }
                }
            }
        }
    }
    return out
}

func motionParse(_ html: String, tag: String) -> (props: [String: AWCValue], tokens: [String: String], inherited: Double) {
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

func motionValue(_ any: Any?) -> AWCValue {
    switch any {
    case let s as String: return .string(s)
    case let n as NSNumber: return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue)
    case let a as [Any]: return .array(a.map(motionValue))
    case let o as [String: Any]: return .object(o.mapValues(motionValue))
    default: return .null
    }
}

@MainActor func runMotionCase(_ c: [String: Any], kind: String, reduced: Bool) -> [String] {
    let tag = "md-\(kind)-chart"
    var (props, inline, inherited) = motionParse(c["html"] as? String ?? "", tag: tag)
    for (k, v) in (c["props"] as? [String: Any]) ?? [:] { props[k] = motionValue(v) }
    var tokens = AWCTheme.generated(dark: (c["theme"] as? String) == "dark").tokens
    for (k, v) in inline { tokens[k] = v }
    let fs = c["finalScene"] as? [String: Any] ?? [:]
    let w = Int((fs["width"] as? NSNumber)?.doubleValue ?? 0), h = Int((fs["height"] as? NSNumber)?.doubleValue ?? 0)
    let rtl = (c["dir"] as? String) == "rtl"
    let targets: [(String, [Int])] = (c["targets"] as? [[String: Any]] ?? []).map { ($0["key"] as? String ?? "", ($0["rgb"] as? [NSNumber] ?? []).map { $0.intValue }) }
    let probes = (c["probes"] as? [NSNumber] ?? []).map { Int(($0.doubleValue).rounded()) }
    let ambiguous = motionBlendAmbiguous(targets: targets, areas: (c["finalScene"] as? [String: Any])?["areas"] as? [[String: Any]] ?? [])
    let ctl = AWCChartState()
    var clock = 0.0
    ctl.clock = { clock }
    let density = awcChartDensity(AWCChartProps(props), inherited: inherited)
    ctl.sync(kind: AWCChartKind(rawValue: tag)!, properties: props, tokens: tokens, density: density, formatters: AWCChartFormatters(),
             size: CGSize(width: w, height: h), rtl: rtl, reducedMotion: reduced)
    clock = 5000; _ = ctl.frame(clock)          // the first entrance (on mount) has finished
    // AWC_MOTION_DUMP=<dir> [AWC_MOTION_CASES=a,b]: write the native frames named like the oracle shots (final, f000, f003…).
    let env = ProcessInfo.processInfo.environment, name = c["name"] as? String ?? "case"
    let dumpDir: String? = env["AWC_MOTION_DUMP"].flatMap { d in (env["AWC_MOTION_CASES"].map { $0.split(separator: ",").map(String.init).contains(name) } ?? true) ? d : nil }
    let t0 = 10_000.0
    clock = t0
    ctl.perform { ctl.activePlot?.replay() }     // engine.replay(): t = 0 paint, intro armed
    var diffs: [String] = []
    for f in c["frames"] as? [[String: Any]] ?? [] {
        let i = (f["i"] as? NSNumber)?.intValue ?? 0
        let t = (f["t"] as? NSNumber)?.doubleValue ?? 0
        clock = t0 + t
        // Frame -1 is the synchronous t = 0 paint of the replay (before the first animation frame), f0 the first rAF tick.
        guard let fr = ctl.frame(clock) else { diffs.append("f\(i): no frame"); continue }
        // Canvas layer opacity (the fade variants); the Web leaves it at "" (= 1) when not animating opacity.
        let webAlpha = Double(f["canvasOpacity"] as? String ?? "") ?? 1
        if abs(webAlpha - fr.alpha) > 0.002 { diffs.append("f\(i) t\(t): opacity web \(webAlpha) native \(String(format: "%.4f", fr.alpha))") }
        let stem = name + (reduced ? "-rm" : "")
        let dump = dumpDir.flatMap { d in i >= 0 && i % 3 == 0 ? String(format: "%@/%@-f%03d.png", d, stem, i) : nil }
        let mine = rasterDigest(fr.scene, width: w, height: h, targets: targets, probes: probes, dump: dump)
        for (k, wd) in (f["digest"] as? [[String: Any]] ?? []).enumerated() where k < targets.count {
            let key = wd["key"] as? String ?? "?"
            let wc = (wd["count"] as? NSNumber)?.intValue ?? 0
            let ring = (wd["x1"] as? NSNumber).flatMap { x1 in (wd["x0"] as? NSNumber).map { x1.intValue - $0.intValue + 1 } } ?? 0
            let tolCount = max(24, Int(Double(wc) * 0.03), ring + 2)
            // The native measurement is the interval spanned by the ±24 / ±28 / ±32 digests; Chrome's (±28) must fall inside it.
            let ms = mine.map { $0[k] }, m = ms[0]
            func inside(_ wv: Int?, _ vals: [Int?], _ tol: Int, significant: Bool) -> Bool {
                guard let w = wv else { return vals.contains { $0 == nil } || !significant }
                let v = vals.compactMap { $0 }
                guard let lo = v.min(), let hi = v.max() else { return !significant }
                return w >= lo - tol && w <= hi + tol
            }
            let counts = ms.map { $0.count }
            if !inside(wc, counts, tolCount, significant: true) { diffs.append("f\(i) t\(t) \(key): count web \(wc) native \(m.count) [\(counts.min()!)…\(counts.max()!)]") }
            // A target that is not really there in either renderer (a stray anti-aliased pixel) has no meaningful bounds; a
            // target whose colour anti-aliased blends of two other series reproduce is checked by its count only.
            let significant = max(wc, m.count) > tolCount
            if !significant || ambiguous.contains(key) { continue }
            for (n, kp) in [("x0", \MotionDigest.x0), ("y0", \MotionDigest.y0), ("x1", \MotionDigest.x1), ("y1", \MotionDigest.y1)] {
                let wv = (wd[n] as? NSNumber)?.intValue
                if !inside(wv, ms.map { $0[keyPath: kp] }, 1, significant: true) {
                    diffs.append("f\(i) t\(t) \(key) \(n) web \(wv.map(String.init) ?? "nil") native \(m[keyPath: kp].map(String.init) ?? "nil")")
                }
            }
            for (j, col) in (wd["cols"] as? [[String: Any]] ?? []).enumerated() where j < m.cols.count {
                let top = (col["top"] as? NSNumber)?.intValue, bottom = (col["bottom"] as? NSNumber)?.intValue
                if !inside(top, ms.map { $0.cols[j].top }, 1, significant: true) { diffs.append("f\(i) \(key) col\(j) top web \(top.map(String.init) ?? "none") native \(m.cols[j].top.map(String.init) ?? "none")") }
                if !inside(bottom, ms.map { $0.cols[j].bottom }, 1, significant: true) { diffs.append("f\(i) \(key) col\(j) bottom web \(bottom.map(String.init) ?? "none") native \(m.cols[j].bottom.map(String.init) ?? "none")") }
            }
        }
    }
    if let d = dumpDir, let fr = ctl.frame(t0 + 1_000_000) {
        _ = rasterDigest(fr.scene, width: w, height: h, targets: [], probes: [], dump: "\(d)/\(name + (reduced ? "-rm" : ""))-final.png")
    }
    return diffs
}

@main enum NativeChartMotionIntegration {
    @MainActor static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        let root = URL(fileURLWithPath: args.first ?? ".")
        let kinds = args.count > 1 ? Array(args.dropFirst()) : ["line", "area", "bar"]
        var total = 0, passed = 0
        for kind in kinds {
            for file in ["motion.json", "motion-reduced-motion.json"] {
                guard let data = try? Data(contentsOf: awcChartOracleFile(root, "md-\(kind)-chart", file)),
                      let doc = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let cases = doc["cases"] as? [[String: Any]] else { print("missing md-\(kind)-chart/\(file)"); continue }
                var ok = 0
                for c in cases {
                    let diffs = runMotionCase(c, kind: kind, reduced: file.contains("reduced"))
                    total += 1
                    if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (\(file)): \(diffs.count) frame differences"); diffs.prefix(8).forEach { print("   " + $0) } }
                }
                print("md-\(kind)-chart \(file): \(ok)/\(cases.count)")
            }
        }
        print("NativeChartMotionIntegration: \(passed)/\(total) runs within tolerance")
        exit(passed == total ? 0 : 1)
    }
}

/// `<dir>/<tag>/<file>`, or the published layout `<dir>/<tag>/web-oracle-mac/<file>` (`outputs/native-parity`).
fileprivate func awcChartOracleFile(_ dir: URL, _ tag: String, _ file: String) -> URL {
    let flat = dir.appendingPathComponent(tag).appendingPathComponent(file)
    if FileManager.default.fileExists(atPath: flat.path) { return flat }
    return dir.appendingPathComponent(tag).appendingPathComponent("web-oracle-mac").appendingPathComponent(file)
}
