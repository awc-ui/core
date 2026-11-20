import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// d3 (r3-14): md-list-item ::part() declarations on every visual part (row, state-layer, primary, leading, content, the text and
// glyph parts, avatar(-image/-initials/-icon), image-wrap, image, image-selection-*, expand-button(-state-layer/-icon), drag-handle,
// expanded-panel(-inner)) against Chrome 153 (Fixtures/list-parts-web.json from d3-lab/web2/list-parts.mjs: host/part geometry and
// 2x pixel probes). A part the native renderer does not inspect is located from its nearest inspected ancestor part with Chrome's
// offset inside it.
@Observable final class ListPartsState {
    var nodes: [AWCNode] = []
    var hooks: [String: String] = [:]
    var parts: [AWCListItemPart: AWCListPartAppearance] = [:]
    var epoch = 0
    var inspect = "none"
    var measurements: [AWCNativeInspectionNode] = []
}
/// Typed part declarations equivalent to the case's ::part() rules (md-list-item parts).
private struct ListParts: ViewModifier {
    let parts: [AWCListItemPart: AWCListPartAppearance]
    func body(content: Content) -> some View {
        parts.reduce(AnyView(content)) { view, entry in AnyView(view.awcListItemPartAppearance(entry.value, part: entry.key)) }
    }
}
struct ListPartsFixture: View {
    let state: ListPartsState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        return ZStack(alignment: .topLeading) {
            Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FEF7FF")
            VStack(alignment: .leading, spacing: 16) {
                ForEach(state.nodes, id: \.id) { n in AWCNativeView(node: n).frame(maxWidth: .infinity, alignment: .leading) }
            }
            .frame(width: 320, alignment: .topLeading)
            .padding(.leading, 24).padding(.top, 24)
            .modifier(ListParts(parts: state.parts))
        }
        .frame(width: 400, height: 600, alignment: .topLeading)
        .awcListReducedMotion(true)
        .awcTheme(theme)
        .environment(\.colorScheme, .light)
        .awcNativeInspection(rootID: state.inspect, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: 400, height: 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .transaction { $0.disablesAnimations = true }
        .id(epoch)
    }
}
@main @MainActor enum NativeListPartsIntegration {
    static var checks = 0, failures: [String] = []
    static func check(_ ok: Bool, _ message: String) { checks += 1; if !ok { failures.append(message) } }
    static func pump(_ t: Double = 0.1) { let end = Date().addingTimeInterval(t); while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004)) } }
    static func node(_ o: [String: Any]) -> AWCNode {
        let tag = o["tag"] as! String
        let props = o["properties"] as? [String: Any] ?? [:]
        if tag == "#text" { return .text(props["text"] as? String ?? "") }
        var values = props.filter { $0.key != "style" }
        let slot = values.removeValue(forKey: "slot") as? String
        let decoded = (try? JSONDecoder().decode([String: AWCValue].self, from: JSONSerialization.data(withJSONObject: values))) ?? [:]
        return AWCNode(id: o["id"] as! String, tag: tag, properties: decoded, children: (o["children"] as? [[String: Any]] ?? []).map(node), slot: slot)
    }
    static func ids(_ o: [String: Any]) -> [String] { [(o["id"] as? String)].compactMap { $0 } + (o["children"] as? [[String: Any]] ?? []).flatMap(ids) }
    static func main() throws {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/list-parts-web.json")
        let oracle = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let cases = Dictionary(uniqueKeysWithValues: (oracle["cases"] as! [[String: Any]]).map { ($0["name"] as! String, $0) })
        let state = ListPartsState()
        let host = NSHostingView(rootView: ListPartsFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 400, height: 600), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        defer { window.close() }
        for r in oracle["results"] as! [[String: Any]] {
            let name = r["name"] as! String, c = cases[name]!
            let label = name
            let roots = c["nodes"] as! [[String: Any]]
            state.nodes = roots.map(node)
            state.parts = [:]
            for (name, v) in c["native"] as? [String: [String: Any]] ?? [:] {
                guard let part = AWCListItemPart(rawValue: name) else { check(false, "\(label): unknown part \(name)"); continue }
                func n(_ k: String) -> Double? { (v[k] as? NSNumber)?.doubleValue }
                state.parts[part] = AWCListPartAppearance(color: v["color"] as? String, backgroundColor: v["backgroundColor"] as? String,
                                                          cornerShape: n("cornerShape").map { .points($0) }, opacity: n("opacity"))
            }
            state.inspect = (roots.flatMap(ids) + ["none"]).joined(separator: "|"); state.measurements = []; state.epoch += 1
            host.layoutSubtreeIfNeeded(); pump(0.9); host.layoutSubtreeIfNeeded(); pump(0.2)
            let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: rep)
            let image = rep.cgImage!, W = image.width, H = image.height, scale = Double(W) / Double(host.bounds.width)
            var px = [UInt8](repeating: 0, count: W * H * 4)
            px.withUnsafeMutableBytes { buf in
                let ctx = CGContext(data: buf.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
            }
            func rgb(_ x: Int, _ y: Int) -> [Int] { let X = min(W - 1, max(0, x)), Y = min(H - 1, max(0, y)), i = (Y * W + X) * 4; return [Int(px[i]), Int(px[i + 1]), Int(px[i + 2])] }
            let geometry = r["geometry"] as! [String: [String: Any]]
            func measured(_ id: String, _ part: String?) -> CGRect? {
                state.measurements.first { $0.id == id + ":component" + (part.map { "." + $0 } ?? "") }?.bounds
            }
            // A part the renderer does not inspect: Chrome's offset inside its smallest enclosing part that is inspected natively.
            func rect(_ id: String, _ part: String?) -> CGRect? {
                if let m = measured(id, part) { return m }
                guard let part, let webParts = geometry[id]?["parts"] as? [String: [Double]], let t = webParts[part] else { return nil }
                let target = CGRect(x: t[0], y: t[1], width: t[2], height: t[3])
                let anc = webParts.compactMap { (k, v) -> (CGRect, CGRect)? in
                    let r = CGRect(x: v[0], y: v[1], width: v[2], height: v[3])
                    guard k != part, r.insetBy(dx: -0.5, dy: -0.5).contains(target), let n = measured(id, k) else { return nil }
                    return (r, n)
                }.min { $0.0.width * $0.0.height < $1.0.width * $1.0.height }
                return anc.map { CGRect(x: $0.1.minX + target.minX - $0.0.minX, y: $0.1.minY + target.minY - $0.0.minY, width: target.width, height: target.height) }
            }
            // Host boxes and every inspected part's size.
            for (id, g) in geometry {
                if let web = g["host"] as? [Double], let native = measured(id, nil) {
                    check(abs(native.width - web[2]) <= 1 && abs(native.height - web[3]) <= 1, "\(label) \(id) host size \(native.size) vs Chrome \(web[2])×\(web[3])")
                }
                for (part, web) in g["parts"] as? [String: [Double]] ?? [:] {
                    if let native = measured(id, part) {
                        check(abs(native.width - web[2]) <= 1 && abs(native.height - web[3]) <= 1, "\(label) \(id) \(part) size \(native.size) vs Chrome \(web[2])×\(web[3])")
                    }
                }
            }
            for p in r["probes"] as! [[String: Any]] {
                let id = p["node"] as! String, part = p["part"] as? String, tag = p["label"] as! String
                guard let web = p["rgb"] as? [Int] else { continue }
                guard let base = rect(id, part) else { check(false, "\(label) \(tag): not measured natively"); continue }
                if p["kind"] as! String == "point" {
                    let at = p["at"] as! [Double]
                    let x = at[0] < 0 ? base.maxX + at[0] : base.minX + at[0], y = at[1] < 0 ? base.maxY + at[1] : base.minY + at[1]
                    let got = rgb(Int((x * scale).rounded(.down)), Int((y * scale).rounded(.down)))
                    let d: Int = max(abs(got[0] - web[0]), abs(got[1] - web[1]), abs(got[2] - web[2]))
                    check(d <= 12, "\(label) \(tag): native \(got) vs Chrome \(web) (Δ\(d))")
                } else {
                    let rr = (p["rect"] as? [Double]).map { CGRect(x: base.minX + $0[0], y: base.minY + $0[1], width: $0[2], height: $0[3]) } ?? base
                    var pts: [[Int]] = []
                    for y in Int((rr.minY * scale).rounded(.up))..<max(Int((rr.minY * scale).rounded(.up)) + 1, Int((rr.maxY * scale).rounded(.down))) {
                        for x in Int((rr.minX * scale).rounded(.up))..<max(Int((rr.minX * scale).rounded(.up)) + 1, Int((rr.maxX * scale).rounded(.down))) { pts.append(rgb(x, y)) }
                    }
                    func channel(_ k: Int) -> Int { let values: [Int] = pts.map { $0[k] }.sorted(); return values[values.count / 2] }
                    let med: [Int] = [channel(0), channel(1), channel(2)]
                    func dist(_ a: [Int], _ b: [Int]) -> Int { abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) }
                    var best: [Int] = med, bestDistance = -1
                    for q in pts { let d = dist(q, med); if d > bestDistance { bestDistance = d; best = q } }
                    let d: Int = max(abs(best[0] - web[0]), abs(best[1] - web[1]), abs(best[2] - web[2]))
                    check(d <= 48, "\(label) \(tag): native ink \(best) vs Chrome \(web) (Δ\(d))")
                }
            }
        }
        print("List item parts: \(checks - failures.count)/\(checks) checks passed")
        failures.prefix(60).forEach { print("FAIL: " + $0) }
        if !failures.isEmpty { exit(1) }
    }
}
