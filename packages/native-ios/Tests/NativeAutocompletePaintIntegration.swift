import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-autocomplete paint and geometry against Chrome 153 (Mac oracle: outputs/native-parity/md-autocomplete/web-oracle/
// web-paint.json, 60 cases from picker-paint.html acCases: theme × direction × variant × empty / value / typed-open / multiple /
// multiple-inline, density, disabled, soft-disabled, error, loading, no results, the eleven hooks one by one and together).
// The case markup is compiled to AWCNode trees (html-node.mjs) and rendered through the production dispatch (AWCNativeView)
// inside an AWCMenuScope covering the page; typed-open cases focus the input and type as the page does. The host box, every
// [part] box of the autocomplete's shadow root (field, clear, caret, loading spinner, chips, chip, menu, options, option icons,
// loading row) and every flat pixel of the clipped screenshot are compared.
@MainActor @Observable final class ACPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
    var registry = AWCMenuRegistry()
    var controller = AWCAutocompleteController()
}
struct ACPaintFixture: View {
    let state: ACPaintState
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func nodes(_ c: AWCValue) -> [AWCNode] {
        c["nodes"].array.compactMap { v in (try? JSONEncoder().encode(v)).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } }
    }
    static func ids(_ n: AWCNode) -> [String] { [n.id] + n.children.flatMap(ids) }
    var body: some View {
        let c = state.c, epoch = state.epoch
        var hooks: [String: String] = [:]; if case .object(let o) = c["hooks"] { for (k, v) in o { hooks[k] = v.string } }
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        let host = Self.rect(c["tree"]["rect"]), width = c["width"].number ?? 320
        let rtl = c["dir"].string == "rtl"
        // Typed-open cases type after mount (the typing gate filters only typed text); the others open through `open`.
        let all = Self.nodes(c).map { n -> AWCNode in var n = n; if n.id == "m" && c["open"] == .bool(true) && c["typed"] == .null { n.properties["open"] = true }
            if n.id == "m" && c["typed"] != .null { n.properties["inputValue"] = nil }; n.properties["style"] = nil; return n }
        let ids = all.flatMap(Self.ids) + ["m::menu"] + (0..<12).map { "m::opt\($0)" }
        return AWCMenuScope(registry: state.registry) {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE").frame(maxWidth: .infinity, maxHeight: .infinity)
                ForEach(all) { n in
                    AWCNativeView(node: n)
                        .frame(width: width, alignment: rtl ? .topTrailing : .topLeading)
                        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                        .padding(.leading, 24).padding(.top, host.minY)
                }
            }
        }
        .awcAutocompleteAppearance(AWCAutocompleteAppearance(css: hooks))
        .awcAutocompleteController(state.controller, for: "m")
        .awcMenuReducedMotion(false)
        .awcFieldReducedMotion(false)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 1200, height: vp.last ?? 900, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct ACGrid {
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
@main @MainActor enum NativeAutocompletePaintIntegration {
    static let state = ACPaintState()
    static var host: NSHostingView<ACPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var warmed = false
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> ACGrid {
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k), cw = cg.width, ch = cg.height
        var v = [Float](repeating: -999, count: w * h * 3)
        for py in 0..<h { for px in 0..<w {
            var r: Float = 0, g: Float = 0, b: Float = 0
            for yy in ((py + y0) * k)..<max((py + y0) * k, min(ch, (py + y0) * k + k)) { for xx in ((px + x0) * k)..<max((px + x0) * k, min(cw, (px + x0) * k + k)) { let i = (yy * cw + xx) * 4; r += Float(buffer[i]); g += Float(buffer[i + 1]); b += Float(buffer[i + 2]) } }
            let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = b / n
        } }
        return .init(w: w, h: h, v: v)
    }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol }
    static func settle(_ timeout: Double = 2) {
        func signature() -> String {
            state.measurements.filter { ["md-menu-item", "md-menu-motion", "md-text-field", "caret"].contains($0.name) }
                .map { n in "\(n.id) \(n.metrics["focusRing"] ?? .null) \(n.metrics["layerOpacity"] ?? .null) \(n.metrics["progress"] ?? .null) \(n.metrics["labelProgress"] ?? .null) \(d(n.bounds))" }.sorted().joined(separator: "|")
        }
        let end = Date().addingTimeInterval(timeout); var last = signature(), stable = 0
        while Date() < end && stable < 3 { pump(0.05); let next = signature(); stable = next == last ? stable + 1 : 0; last = next }
    }
    static let textParts: Set<String> = []
    /// Oracle host + shadow parts vs native inspection.
    static func compare(_ t: AWCValue, _ name: String, _ m: [String: AWCNativeInspectionNode], open: Bool) {
        let web = ACPaintFixture.rect(t["rect"])
        check(near(m["m:component"]?.bounds, web, 0.75), "\(name) md-autocomplete \(d(m["m:component"]?.bounds)) vs \(d(web))")
        // A closed autocomplete keeps its md-menu mounted on the Web (opacity 0, scaled 0.8): the native menu is not mounted,
        // so the parts inside the menu are compared only while it is open.
        let inMenu: Set<String> = ["menu", "option", "option option-selected", "option-icon", "loading", "loading-progress"]
        let parts = t["parts"].array.filter { $0["display"].string != "none" && $0["visibility"].string != "hidden" && $0["part"].string != "live-region" && (open || !inMenu.contains($0["part"].string)) }
        let options = parts.filter { $0["part"].string.hasPrefix("option") && $0["part"].string != "option-icon" }
        var chip = 0
        // Rows carry the option's index in the full list (stable across filtering): the k-th visible row is the k-th id present.
        let rowIDs = (0..<12).map { "m::opt\($0)" }.filter { m["\($0):component"] != nil }
        func row(_ k: Int) -> String { rowIDs.indices.contains(k) ? rowIDs[k] : "m::none" }
        for p in parts {
            let part = p["part"].string, r = ACPaintFixture.rect(p["rect"])
            guard r.width > 0 && r.height > 0 else { continue }
            var got: CGRect?
            switch part {
            case "menu": got = m["m::menu:component"]?.bounds
            case "listbox":
                let rows = rowIDs.compactMap { m["\($0):component"]?.bounds }
                got = rows.isEmpty ? nil : rows.dropFirst().reduce(rows[0]) { $0.union($1) }
            case "option", "option option-selected":
                let k = options.firstIndex { ACPaintFixture.rect($0["rect"]) == r } ?? -1
                got = m["\(row(k)):component"]?.bounds
                if part.hasSuffix("selected") { check(m["\(row(k)):component"]?.metrics["selected"]?.bool == true, "\(name) option \(k) selected") }
            case "option-icon":
                let k = options.firstIndex { ACPaintFixture.rect($0["rect"]).contains(CGPoint(x: r.midX, y: r.midY)) } ?? -1
                got = m["\(row(k)):component.leading-icon"]?.bounds
            case "chip": got = m["m:component.chip-\(chip)"]?.bounds; chip += 1
            default: got = m["m:component." + part]?.bounds
            }
            check(near(got, r, textParts.contains(part) ? 1.0 : 0.75), "\(name) \(part) \(d(got)) vs \(d(r))")
        }
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.registry = AWCMenuRegistry()
        state.c = c; state.epoch += 1; pump(warmed ? 0.5 : 1.5); warmed = true
        settle()
        if c["focused"] == .bool(true) { state.controller.focusInput(); pump(0.1) }
        if case .string(let typed) = c["typed"] { state.controller.runtime?.typeText(typed); pump(0.3); settle() }
        if ProcessInfo.processInfo.environment["AWC_AC_DEBUG"] != nil, let mc = state.registry.controllers["m::menu"] {
            print("  menu open \(mc.isOpen) closing \(mc.closing) rows \(mc.rowOrder) rt.open \(state.controller.runtime?.openNow ?? false) input \(state.controller.runtime?.inputNow ?? "-")")
        }
        else if c["open"] == .bool(true) { pump(0.3); settle() }
        let m = Dictionary(state.measurements.map { ($0.id, $0) }, uniquingKeysWith: { _, b in b })
        if ProcessInfo.processInfo.environment["AWC_AC_DEBUG"] != nil { for n in state.measurements.sorted(by: { $0.id < $1.id }) { print("  \(n.id) \(d(n.bounds))") } }
        compare(c["tree"], name, m, open: c["open"] == .bool(true))
        if c["open"] != .bool(true) { check(m["m::menu:component"] == nil, "\(name) closed autocomplete paints no menu") }
        let clip = ACPaintFixture.rect(c["clip"])
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        if let dir = ProcessInfo.processInfo.environment["AWC_AC_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        let w = min(source.width, Int(clip.width)), h = min(source.height, Int(clip.height))
        let web = grid(source, scale: 1, x0: 0, y0: 0, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, x0: Int(clip.minX), y0: Int(clip.minY), w: w, h: h)
        var n = 0, bad = 0, sum = 0.0, worst: Float = 0, at = ""
        for py in 1..<max(1, h - 1) { for px in 1..<max(1, w - 1) {
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
        host = NSHostingView(rootView: ACPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("ac-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_AC_ONLY"]
        for c in oracle["cases"].array where only.map({ o in o.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("ac-web-paint")) }
        if let out = ProcessInfo.processInfo.environment["AWC_AC_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Autocomplete native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
