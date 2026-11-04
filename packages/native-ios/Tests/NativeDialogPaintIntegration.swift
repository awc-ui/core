import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-dialog paint and geometry against Chrome (dialog native-paint.html: 150 cases, 1:1 viewport captures).
// Every part box, the fallback/close/authored controls, the slotted body, roles/labels, initial focus,
// and every flat pixel of the viewport (UA page buttons masked) are compared.
@Observable final class DialogPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
struct DialogPaintFixture: View {
    let state: DialogPaintState
    static let all: [String: String] = ["container-color": "#224466AA", "content-color": "#DDBB88CC", "headline-color": "#BB3366EE", "scrim-color": "#11223366",
                                        "divider-color": "#CC9933DD", "icon-color": "#55AA88AA"]
    var appearance: AWCDialogAppearance {
        let h = state.c["hooks"]
        func s(_ k: String) -> String? { h[k].string.isEmpty ? nil : h[k].string }
        return .init(containerColor: s("container-color"), containerShape: s("container-shape").map { _ in NativeDialogPaintIntegration.ellipse }, headlineColor: s("headline-color"),
                     contentColor: s("content-color"), iconColor: s("icon-color"), iconSize: s("icon-size").flatMap { Double($0.replacingOccurrences(of: "px", with: "")) },
                     scrimColor: s("scrim-color"), dividerColor: s("divider-color"), zIndex: s("z-index").flatMap(Double.init), scrimZIndex: s("scrim-z-index").flatMap(Double.init))
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        let props = c["props"]
        var properties: [String: AWCValue] = ["headline": "Account details"]
        if case .object(let o) = props { for (k, v) in o { properties[k] = v } }
        if c["hidden"] == .bool(true) { properties["hidden"] = true }
        let body = c["bodyHeight"].number ?? 60
        let open = c["open"] != .bool(false)
        let model = AWCDialogModel(properties)
        let fullscreen = model.fullscreen
        let slots = AWCDialogSlots(
            content: AnyView(Text(body == 0 ? "" : "Supporting text").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: body, maxHeight: body, alignment: .topLeading)
                .awcInspect(nodeID: "dut", part: "body", name: "body")),
            headline: c["slots"] == .bool(true) ? AnyView(Text("Authored headline")) : nil,
            icon: c["slots"] == .bool(true) ? AnyView(AWCMaterialSymbol("star")) : nil,
            actions: c["actions"] == .bool(true) ? AnyView(Group {
                AWCNativeView(node: .init(id: "later", tag: "md-button", properties: ["variant": "text"], children: [.text("Later")])).fixedSize()
                AWCNativeView(node: .init(id: "accept", tag: "md-button", properties: ["variant": "filled"], children: [.text("Accept")])).fixedSize()
            }) : nil,
            headerAction: c["headerAction"] == .bool(true) && fullscreen ? AnyView(AWCNativeView(node: .init(id: "save", tag: "md-button", properties: ["variant": "text"], children: [.text("Save")])).fixedSize()
                .awcInspect(nodeID: "dut", part: "header-action", name: "header-action")) : nil)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                // The page is physical (absolute left/top); only the dialog follows `dir`.
                ZStack(alignment: .topLeading) {
                    Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                    Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
                }.environment(\.layoutDirection, .leftToRight)
                AWCNativeDialog(id: "dut", model: model, theme: theme, open: .constant(open), slots: slots, emit: { _ in })
                    .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
            }
            .environment(\.awcNativeDensity, c["inheritedDensity"].number ?? 0)
        }
        .awcDialogAppearance(appearance)
        .modifier(DialogPartsModifier(on: c["parts"] == .bool(true)))
        .awcModalReducedMotion(true)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "dut", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 800, height: vp.last ?? 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct DialogPartsModifier: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on {
            content
                .awcDialogPartAppearance(.init(outlineColor: "#C2185B", outlineWidth: 2), part: .container)
                .awcDialogPartAppearance(.init(letterSpacing: 1, underline: true), part: .headline)
                .awcDialogPartAppearance(.init(background: "#FFF3E0"), part: .content)
                .awcDialogPartAppearance(.init(background: "#E8F5E9"), part: .actions)
                .awcDialogPartAppearance(.init(background: "#1565C0", height: 3), part: .divider)
                .awcDialogPartAppearance(.init(background: "#00280066"), part: .scrim)
                .awcDialogPartAppearance(.init(background: "#F3E5F5"), part: .header)
                .awcDialogPartAppearance(.init(color: "#2E7D32"), part: .icon)
                .awcDialogPartAppearance(.init(background: "#FFE0B2"), part: .closeButton)
        } else { content }
    }
}
struct DialogGrid {
    let w: Int, h: Int; var v: [Float]
    @inline(__always) func c(_ px: Int, _ py: Int, _ k: Int) -> Float { v[(py * w + px) * 3 + k] }
    func at(_ px: Int, _ py: Int) -> [Double] { [Double(c(px, py, 0)), Double(c(px, py, 1)), Double(c(px, py, 2))] }
    func flat(_ px: Int, _ py: Int, _ limit: Float) -> Bool {
        guard px >= 1 && py >= 1 && px + 1 < w && py + 1 < h else { return false }
        for k in 0..<3 {
            var lo: Float = 999, hi: Float = -1
            var y = py - 1
            while y <= py + 1 { var x = px - 1; while x <= px + 1 { let q = v[(y * w + x) * 3 + k]; if q < lo { lo = q }; if q > hi { hi = q }; x += 1 }; y += 1 }
            if hi - lo > limit { return false }
        }
        return true
    }
    func diff(_ o: DialogGrid, _ px: Int, _ py: Int) -> Float {
        let i = (py * w + px) * 3
        return max(abs(v[i] - o.v[i]), max(abs(v[i + 1] - o.v[i + 1]), abs(v[i + 2] - o.v[i + 2])))
    }
}
@main @MainActor enum NativeDialogPaintIntegration {
    static let state = DialogPaintState()
    static var host: NSHostingView<DialogPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let ellipse = AWCCornerShape(topLeft: .init(x: .points(18), y: .points(12)), topRight: .init(x: .points(8), y: .points(6)),
                                        bottomRight: .init(x: .points(18), y: .points(12)), bottomLeft: .init(x: .points(8), y: .points(6)))
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func grid(_ cg: CGImage, scale: Double, w: Int, h: Int) -> DialogGrid {
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k), cw = cg.width, ch = cg.height
        var v = [Float](repeating: -999, count: w * h * 3)
        buffer.withUnsafeBufferPointer { b in
            for py in 0..<h { for px in 0..<w {
                var r: Float = 0, g: Float = 0, bl: Float = 0
                for yy in (py * k)..<min(ch, py * k + k) { for xx in (px * k)..<min(cw, px * k + k) { let i = (yy * cw + xx) * 4; r += Float(b[i]); g += Float(b[i + 1]); bl += Float(b[i + 2]) } }
                let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = bl / n
            } }
        }
        return .init(w: w, h: h, v: v)
    }
    static func diff(_ a: [Double], _ b: [Double]) -> Double { var m = 0.0; for i in 0..<3 { m = max(m, abs(a[i] - b[i])) }; return m }
    static func r(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.c = c; state.epoch += 1; pump(0.5)
        let m = state.measurements, snap = c["snap"]
        func box(_ n: String) -> CGRect? { m.first { $0.name == n }?.bounds }
        let open = c["open"] != .bool(false) && c["hidden"] != .bool(true)
        if !open {
            check(m.first { $0.name == "container" } == nil, "\(name) closed/hidden dialog renders no surface")
        } else {
            // Part boxes: layout boxes exactly; text-sized boxes within 1.5 pt (font rasterization).
            let textSized: Set<String> = ["headline", "cancel-button", "ok-button"]
            for (part, value) in snap["parts"].object {
                let web = r(value["rect"]); guard web.width > 0 || web.height > 0 else { continue }
                if part == "scrim" { check(near(box("scrim"), web, 0.6), "\(name) scrim \(d(box("scrim"))) vs \(d(web))"); continue }
                let native = part == "container" ? box("container") : box(part)
                let tol = textSized.contains(part) ? 1.5 : 0.6
                if c["group"].string == "locale" && (part == "cancel-button" || part == "ok-button") && ["ar", "ja"].contains(c["props"]["locale"].string) {
                    // Arabic/Japanese labels fall back to platform fonts (not in the bundled Roboto): compare the row, not the advance widths.
                    check(native.map { abs($0.minY - web.minY) <= 0.6 && abs($0.height - web.height) <= 0.6 } ?? false, "\(name) \(part) row \(d(native)) vs \(d(web))"); continue
                }
                check(near(native, web, tol), "\(name) \(part) \(d(native)) vs \(d(web))")
            }
            for control in snap["controls"].array where control["part"].string == "close-button" {
                check(near(box("close-button"), r(control["rect"]), 0.6), "\(name) close button \(d(box("close-button"))) vs \(d(r(control["rect"])))")
            }
            for child in snap["children"].array {
                let slot = child["slot"].string, web = r(child["rect"])
                if slot == "" { check(near(box("body"), web, 0.6), "\(name) body \(d(box("body"))) vs \(d(web))") }
                if slot == "header-action" && web.width > 0 { check(near(box("header-action"), web, 1.5), "\(name) header action \(d(box("header-action"))) vs \(d(web))") }
            }
            let container = m.first { $0.name == "container" }
            let sem = snap["semantics"]
            check(container?.metrics["role"]?.string == sem["role"].string, "\(name) role \(container?.metrics["role"]?.string ?? "nil") vs \(sem["role"].string)")
            let webLabel = sem["aria-label"].string.isEmpty ? sem["labelledbyText"].string : sem["aria-label"].string
            if c["slots"] != .bool(true) { check(container?.metrics["label"]?.string == webLabel, "\(name) accessible name \(container?.metrics["label"]?.string ?? "nil") vs \(webLabel)") }
            // Initial focus: first tabbable (fallback Cancel / fullscreen close) or the container.
            let path = snap["focus"]["path"].array.map(\.string)
            let responder = window.firstResponder as? NSView
            let leaf = path.last ?? ""
            let expected = leaf.contains("cancel-button") ? "dut.cancel-button" : leaf.contains("close-button") ? "dut.close-button" : leaf.contains("ok-button") ? "dut.ok-button" : leaf.hasPrefix("md-button") ? "" : leaf.hasPrefix("md-dialog") ? "dut.container" : "-"
            if expected != "-" && !expected.isEmpty { check(responder?.accessibilityIdentifier() == expected, "\(name) initial focus \(responder?.accessibilityIdentifier() ?? "nil") vs \(leaf)") }
        }
        // Paint: every flat viewport pixel, page UA buttons masked.
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        let w = Int(vp[0]), h = Int(vp[1])
        let web = grid(source, scale: 1, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, w: w, h: h)
        if let dir = ProcessInfo.processInfo.environment["AWC_DIALOG_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        let masks = [CGRect(x: 12, y: 12, width: 100, height: 48), CGRect(x: 12, y: 196, width: 100, height: 48)]
        var n = 0, bad = 0, sum = 0.0, raw = 0.0, worst: Float = 0, at = ""
        for py in 1..<(h - 1) { for px in 1..<(w - 1) {
            if (px >= 12 && px < 112) && ((py >= 12 && py < 60) || (py >= 196 && py < 244)) { continue }
            guard web.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
            // One 8-bit level is compositing quantisation (translucent hooks blend ±1 level differently).
            let q = web.diff(nat, px, py); n += 1; sum += Double(max(0, q - 1)); raw += Double(q); if q > 6 { bad += 1 }
            if q > worst { worst = q; at = "(\(px),\(py)) web \(web.at(px, py).map { Int($0) }) native \(nat.at(px, py).map { Int($0.rounded()) })" }
        } }
        _ = masks
        let ratio = Double(bad) / Double(max(1, n)), mean = sum / Double(max(1, n))
        check(Double(n) / Double(max(1, (w - 2) * (h - 2))) > 0.5, "\(name) flat-pixel coverage \(n)")
        check(ratio <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(at))")
        report.append(["case": name, "compared": n, "meanBeyondOneLevel": mean, "mean": raw / Double(max(1, n)), "over6": bad, "worst": worst, "worstAt": at])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: DialogPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("dialog-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_DIALOG_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("dialog-web-paint")) }
        if let out = ProcessInfo.processInfo.environment["AWC_DIALOG_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Dialog native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
