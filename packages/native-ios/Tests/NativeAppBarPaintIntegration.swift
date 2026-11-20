import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-app-bar paint and geometry against Chrome 153 (Mac oracle: outputs/native-parity/md-app-bar/web-oracle/web-paint.json,
// 156 cases from paint.html). Each case's bar (ab.js fixtures) is an AWCNode tree rendered through the production dispatch
// (AWCNativeView) in a 1200 × 900 page, the bar at (40, 40) in a scope of the case's width. The host, row, leading, title,
// subtitle, trailing, expanded block, search host / pill / field / input / in-pill trailing boxes, every child's box and every
// flat pixel of the clipped Chrome shot are compared. app-bar-web-paint-parts.json (n5's capture of rules in the typed part
// vocabulary) applies each case's rules through the public .awcAppBarPartAppearance(_:part:) and compares its pixels too; n2's
// three earlier parts cases (outline / shorthand rules outside the shared vocabulary) stay geometry-only.
@Observable final class AppBarPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
    var parts: [(AWCAppBarPart, AWCAppBarPartAppearance)] = []
}
/// Applies a case's part rules through the public typed part API.
struct AppBarPartsApplied: ViewModifier {
    let parts: [(AWCAppBarPart, AWCAppBarPartAppearance)]
    func body(content: Content) -> some View { parts.reduce(AnyView(content)) { v, p in AnyView(v.awcAppBarPartAppearance(p.1, part: p.0)) } }
}
struct AppBarPaintFixture: View {
    let state: AppBarPaintState
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func node(_ c: AWCValue) -> AWCNode? { (try? JSONEncoder().encode(c["node"])).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } }
    static func ids(_ n: AWCNode) -> [String] { (n.id.isEmpty || n.tag == "#text" ? [] : [n.id]) + n.children.flatMap(ids) }
    var body: some View {
        let c = state.c, epoch = state.epoch
        var hooks: [String: String] = [:]; if case .object(let o) = c["hooks"] { for (k, v) in o { hooks[k] = v.string } }
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark", tokens: [:])
        let rtl = c["dir"].string == "rtl", width = c["width"].number ?? 720
        let inherited = c["inheritedDensity"].number
        let bar = Self.node(c) ?? AWCNode(tag: "md-app-bar")
        return ZStack(alignment: .topLeading) {
            Color(awcHex: theme.tokens["--md-sys-color-surface-container-lowest"] ?? "#FFFFFF").frame(maxWidth: .infinity, maxHeight: .infinity)
            AWCNativeView(node: bar)
                .frame(width: width, alignment: .topLeading)
                .modifier(AppBarInheritedDensity(value: inherited))
                .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 40).padding(.top, 40)
        }
        .awcAppBarAppearance(AWCAppBarAppearance(css: hooks))
        .modifier(AppBarPartsApplied(parts: state.parts))
        .awcTheme(theme)
        .awcNativeInspection(rootID: (Self.ids(bar) + ["appbar-paint-sentinel"]).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: 1200, height: 900, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct AppBarInheritedDensity: ViewModifier {
    let value: Double?
    func body(content: Content) -> some View { if let value, value != 0 { content.awcDensity(value) } else { content } }
}
struct AppBarGrid {
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
@main @MainActor enum NativeAppBarPaintIntegration {
    static let state = AppBarPaintState()
    static var host: NSHostingView<AppBarPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var warmed = false
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) {
        let end = Date().addingTimeInterval(d)
        repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.005)) } while Date() < end
    }
    static func settle(_ timeout: Double = 2) {
        func signature() -> String { state.measurements.map { "\($0.id) \(d($0.bounds))" }.sorted().joined(separator: "|") }
        let end = Date().addingTimeInterval(timeout); var last = signature(), stable = 0
        while Date() < end && stable < 3 { pump(0.05); let next = signature(); stable = next == last && !next.isEmpty ? stable + 1 : 0; last = next }
    }
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> AppBarGrid {
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k), cw = cg.width, ch = cg.height
        var v = [Float](repeating: -999, count: w * h * 3)
        for py in 0..<h { for px in 0..<w {
            var r: Float = 0, g: Float = 0, b: Float = 0
            for yy in ((py + y0) * k)..<max((py + y0) * k, min(ch, (py + y0) * k + k)) { for xx in ((px + x0) * k)..<max((px + x0) * k, min(cw, (px + x0) * k + k)) {
                let i = (yy * cw + xx) * 4; r += Float(buffer[i]); g += Float(buffer[i + 1]); b += Float(buffer[i + 2]) } }
            let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = b / n
        } }
        return .init(w: w, h: h, v: v)
    }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double) -> Bool {
        guard let a else { return false }
        return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol
    }
    static func box(_ name: String, _ label: String, _ web: AWCValue, _ native: AWCNativeInspectionNode?, _ tol: Double = 0.75) {
        guard case .object = web else { return }
        let r = AppBarPaintFixture.rect(web)
        if r.width <= 0 && r.height <= 0 && (native == nil || (native!.bounds.width < 0.5 && native!.bounds.height < 0.5)) { check(true, ""); return }
        check(near(native?.bounds, r, tol), "\(name) \(label) \(d(native?.bounds)) vs \(d(r))")
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        var parts: [(AWCAppBarPart, AWCAppBarPartAppearance)] = []
        if case .object(let o) = c["partsValues"] {
            for k in o.keys.sorted() { if case .object(let f) = o[k]!, let part = AWCAppBarPart(rawValue: k) { parts.append((part, AWCAppBarPartAppearance(values: f))) } else { check(false, "\(name) part \(k) is a typed part") } }
        }
        state.parts = parts
        state.c = c; state.epoch += 1; pump(warmed ? 0.3 : 1.2); warmed = true
        settle()
        let m = Dictionary(state.measurements.map { ($0.id, $0) }, uniquingKeysWith: { _, b in b })
        let s = c["snap"], part = { (p: String) in m["ab:component." + p] }
        if c["hidden"] == .bool(true) {
            check(m["ab:component"] == nil || (m["ab:component"]!.bounds.height < 0.5), "\(name) hidden bar renders nothing")
            print("case \(name): \(checks - failures.count)/\(checks)"); fflush(stdout); return
        }
        box(name, "host", s["rect"], m["ab:component"])
        box(name, "row", s["row"], part("row"))
        box(name, "leading", s["leading"], part("leading"))
        if case .object = s["leadingButton"] { box(name, "leading-icon", s["leadingButton"]["rect"], part("leading-icon")) }
        if case .object = s["inline"] { box(name, "headline-inline", s["inline"]["rect"], part("headline-inline")) }
        if case .object = s["title"] { box(name, "title", s["title"]["rect"], part("title"), 1.0) }
        if case .object = s["subtitle"] { box(name, "subtitle(inline)", s["subtitle"]["rect"], m[c["node"]["properties"]["variant"].string == "medium" || c["node"]["properties"]["variant"].string == "large" ? "ab:component.inline-subtitle" : "ab:component.subtitle"], 1.0) }
        if case .object = s["expanded"] {
            box(name, "expanded", s["expanded"]["rect"], part("expanded"))
            box(name, "expanded-headline", s["expanded"]["headline"], part("expanded-headline"), 1.0)
            if case .object = s["expanded"]["subtitle"] { box(name, "subtitle(expanded)", s["expanded"]["subtitle"], m["ab:component.subtitle"], 1.0) }
        }
        box(name, "trailing", s["trailing"], part("trailing"))
        if case .object = s["search"] {
            box(name, "search-host", s["search"]["host"], part("search-host"))
            box(name, "search", s["search"]["pill"], part("search"))
            box(name, "search-field", s["search"]["field"], part("search-field"), 1.0)
            if case .object = s["search"]["input"] { box(name, "search-input", s["search"]["input"]["rect"], part("search-input"), 1.0) }
            if case .object = s["search"]["trailing"], (s["search"]["trailing"]["width"].number ?? 0) > 0 { box(name, "search-trailing", s["search"]["trailing"], part("search-trailing")) }
        }
        for ch in s["children"].array {
            let id = ch["id"].string, r = AppBarPaintFixture.rect(ch["rect"])
            let n = m[id + ":component"]
            if ch["display"].string == "none" || r.width <= 0 { check(n == nil || n!.bounds.width < 0.5, "\(name) child \(id) hidden (\(d(n?.bounds)))") }
            else if ch["tag"].string == "span" { continue }   // slotted text spans: their runs are the title / subtitle / search content boxes
            else { box(name, "child \(id)", ch["rect"], n) }
        }
        // Paint: flat pixels of the clipped Chrome screenshot (n2's ::part() cases outside the vocabulary: geometry only).
        let typedParts: Bool = { if case .object = c["partsValues"] { return true }; return false }()
        guard c["parts"] != .bool(true) || typedParts, case .object = c["clip"] else { print("case \(name): \(checks - failures.count)/\(checks)"); fflush(stdout); return }
        let clip = AppBarPaintFixture.rect(c["clip"])
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        if let dir = ProcessInfo.processInfo.environment["AWC_APPBAR_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        let w = min(source.width, Int(clip.width)), h = min(source.height, Int(clip.height))
        let web = grid(source, scale: 1, x0: 0, y0: 0, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, x0: Int(clip.minX), y0: Int(clip.minY), w: w, h: h)
        var n = 0, bad = 0, sum = 0.0, worst: Float = 0, at = ""
        for py in 1..<max(2, h - 1) { for px in 1..<max(2, w - 1) {
            guard web.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
            let i = (py * w + px) * 3
            let q = max(abs(web.v[i] - nat.v[i]), max(abs(web.v[i + 1] - nat.v[i + 1]), abs(web.v[i + 2] - nat.v[i + 2])))
            n += 1; sum += Double(max(0, q - 1)); if q > 6 { bad += 1 }
            if q > worst { worst = q; at = "(\(px + Int(clip.minX)),\(py + Int(clip.minY))) web \(web.at(px, py)) native \(nat.at(px, py))" }
        } }
        let ratio = Double(bad) / Double(max(1, n)), mean = sum / Double(max(1, n))
        check(Double(n) / Double(max(1, (w - 2) * (h - 2))) > 0.4, "\(name) flat-pixel coverage \(n)")
        check(ratio <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(String(format: "%.3f", mean)), >6: \(bad)/\(n), worst \(worst) at \(at))")
        report.append(["case": name, "compared": n, "meanBeyondOneLevel": mean, "over6": bad, "worst": worst, "worstAt": at])
        print("case \(name): \(checks - failures.count)/\(checks)"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: AppBarPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_APPBAR_ONLY"]
        for file in ["app-bar-web-paint", "app-bar-web-paint-parts"] {
            guard let data = try? Data(contentsOf: fixtures.appendingPathComponent(file + ".json")) else { check(false, "\(file).json present"); continue }
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: data)
            for c in oracle["cases"].array where only.map({ o in o.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent(file)) }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_APPBAR_OUTPUT"] {
            try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out))
        }
        print("App bar native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
