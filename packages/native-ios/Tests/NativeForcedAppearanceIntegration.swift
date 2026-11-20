import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// d3 (r3-01, r3-02, r3-07): md-divider, md-avatar, md-card, md-dialog and md-accordion(+item) in light and dark themes, with and
// without `forced-colors: active`, against Chrome 153 (Fixtures/forced-appearance-web.json: host/part geometry and 2x pixel probes).
@Observable final class ForcedAppearanceState {
    var nodes: [AWCNode] = []
    var hooks: [String: String] = [:]
    var parts: [AWCAccordionItemPart: AWCAccordionPartAppearance] = [:]
    var dark = false
    var forced = false
    var epoch = 0
    var inspect = "none"
    var measurements: [AWCNativeInspectionNode] = []
}
/// Typed part declarations equivalent to the case's ::part() rules (md-accordion-item parts).
private struct ForcedParts: ViewModifier {
    let parts: [AWCAccordionItemPart: AWCAccordionPartAppearance]
    func body(content: Content) -> some View {
        parts.reduce(AnyView(content)) { view, entry in AnyView(view.awcAccordionItemPartAppearance(entry.value, part: entry.key)) }
    }
}
private struct ForcedHook: ViewModifier {
    let tag: String, style: String?
    func body(content: Content) -> some View {
        // `--md-divider-color:#RRGGBB` is the only hook the cases author.
        if tag == "md-divider", let style, let hex = style.split(separator: ":").last.map({ String($0).trimmingCharacters(in: .whitespaces) }) {
            content.awcDividerAppearance(AWCDividerAppearance(color: hex))
        } else { content }
    }
}
struct ForcedAppearanceFixture: View {
    let state: ForcedAppearanceState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                Color(awcHex: state.forced ? "#000000" : theme.tokens["--md-sys-color-surface"] ?? "#FEF7FF")
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(state.nodes, id: \.id) { n in
                        let stretch = ["md-card", "md-divider"].contains(n.tag) || (n.tag == "md-accordion" && n.properties["floating"]?.bool != true)
                        AWCNativeView(node: n).modifier(ForcedHook(tag: n.tag, style: state.hooks[n.id]))
                            .frame(maxWidth: stretch ? .infinity : nil, alignment: .leading)
                    }
                }
                .frame(width: 320, alignment: .topLeading)
                .padding(.leading, 24).padding(.top, 24)
                .modifier(ForcedParts(parts: state.parts))
            }
            .frame(width: 400, height: 600, alignment: .topLeading)
        }
        .awcForcedColors(state.forced ? .standard : nil)
        .awcModalReducedMotion(true)
        .awcTheme(theme)
        .environment(\.colorScheme, state.dark ? .dark : .light)
        .awcNativeInspection(rootID: state.inspect, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: 400, height: 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .transaction { $0.disablesAnimations = true }
        .id(epoch)
    }
}
@main @MainActor enum NativeForcedAppearanceIntegration {
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
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/forced-appearance-web.json")
        let oracle = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let cases = Dictionary(uniqueKeysWithValues: (oracle["cases"] as! [[String: Any]]).map { ($0["name"] as! String, $0) })
        let state = ForcedAppearanceState()
        let host = NSHostingView(rootView: ForcedAppearanceFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 400, height: 600), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        defer { window.close() }
        for r in oracle["results"] as! [[String: Any]] {
            let name = r["name"] as! String, dark = r["theme"] as! String == "dark", forced = r["forced"] as! Bool, c = cases[name]!
            let label = "\(name) \(dark ? "dark" : "light")\(forced ? " forced" : "")"
            let roots = c["nodes"] as! [[String: Any]]
            state.nodes = roots.map(node); state.dark = dark; state.forced = forced
            state.hooks = Dictionary(uniqueKeysWithValues: roots.compactMap { o in ((o["properties"] as? [String: Any])?["style"] as? String).map { (o["id"] as! String, $0) } })
            state.parts = [:]
            for (_, byPart) in c["nativeParts"] as? [String: [String: [String: Any]]] ?? [:] {
                for (name, v) in byPart {
                    guard let part = AWCAccordionItemPart(rawValue: name) else { continue }
                    func n(_ k: String) -> Double? { (v[k] as? NSNumber)?.doubleValue }
                    state.parts[part] = AWCAccordionPartAppearance(backgroundColor: v["backgroundColor"] as? String, cornerShape: n("cornerRadius").map { .points($0) },
                                                                   width: n("width"), height: n("height"), opacity: n("opacity"))
                }
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
            func rect(_ id: String, _ part: String?) -> CGRect? {
                state.measurements.first { $0.id == id + ":component" + (part.map { "." + $0 } ?? "") }?.bounds
            }
            let geometry = r["geometry"] as! [String: [String: Any]]
            // Host boxes (sizes; the forced-colors borders change them) and the dialog container.
            for (id, g) in geometry {
                if let web = g["host"] as? [Double], let native = rect(id, nil) {
                    check(abs(native.width - web[2]) <= 1 && abs(native.height - web[3]) <= 1, "\(label) \(id) host size \(native.size) vs Chrome \(web[2])×\(web[3])")
                }
                if let web = (g["parts"] as? [String: [Double]])?["container"], let native = rect(id, "container") {
                    check(abs(native.width - web[2]) <= 1 && abs(native.height - web[3]) <= 1.5, "\(label) \(id) container size \(native.size) vs Chrome \(web[2])×\(web[3])")
                }
            }
            for sp in c["sizeParts"] as? [[String]] ?? [] {
                if let web = (geometry[sp[0]]?["parts"] as? [String: [Double]])?[sp[1]], let native = rect(sp[0], sp[1]) {
                    check(abs(native.width - web[2]) <= 1 && abs(native.height - web[3]) <= 1, "\(label) \(sp[0]) \(sp[1]) size \(native.size) vs Chrome \(web[2])×\(web[3])")
                } else { check(false, "\(label) \(sp[0]) \(sp[1]) measured") }
            }
            for p in r["probes"] as! [[String: Any]] {
                let id = p["node"] as! String, part = p["part"] as? String, tag = p["label"] as! String
                guard let web = p["rgb"] as? [Int] else { continue }
                guard let base = rect(id, part) else { check(false, "\(label) \(tag): not measured natively"); continue }
                if p["kind"] as! String == "point" {
                    let at = p["at"] as! [Double]
                    let got = rgb(Int(((base.minX + at[0]) * scale).rounded(.down)), Int(((base.minY + at[1]) * scale).rounded(.down)))
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
        print("Forced/dark appearance: \(checks - failures.count)/\(checks) checks passed")
        failures.prefix(60).forEach { print("FAIL: " + $0) }
        if !failures.isEmpty { exit(1) }
    }
}
