import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-bottom-sheet paint and geometry against Chrome (bottom-sheet native-paint.html: 126 cases, 1:1 viewport captures).
// Every part box, the fallback/authored close, the slotted body, role/label, initial focus and every flat pixel of the
// viewport (UA page buttons masked) are compared.
@Observable final class SheetPaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
struct SheetPaintFixture: View {
    let state: SheetPaintState
    var appearance: AWCBottomSheetAppearance {
        let h = state.c["hooks"]
        func s(_ k: String) -> String? { h[k].string.isEmpty ? nil : h[k].string }
        func px(_ k: String) -> Double? { s(k).flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
        func len(_ k: String) -> AWCSkeletonLength? { px(k).map { .points($0) } }
        let shape = s("container-shape").map { AWCBottomSheetShape($0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) }) }
        return .init(containerColor: s("container-color"), containerShape: shape, contentColor: s("content-color"), headlineColor: s("headline-color"),
                     scrimColor: s("scrim-color"), dragHandleColor: s("drag-handle-color"), dividerColor: s("divider-color"), iconColor: s("icon-color"),
                     width: len("width"), minWidth: len("min-width"), maxWidth: len("max-width"), height: len("height"), minHeight: len("min-height"), maxHeight: len("max-height"),
                     detachedMargin: px("detached-margin"), contentPaddingInline: px("content-padding-inline"))
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        var properties: [String: AWCValue] = ["headline": "Account details"]
        if case .object(let o) = c["props"] { for (k, v) in o { properties[k] = v } }
        if c["hidden"] == .bool(true) { properties["hidden"] = true }
        let body = c["bodyHeight"].number ?? 120
        let open = c["open"] != .bool(false)
        let slots = AWCBottomSheetSlots(
            // The Web block's `height: <body>px` in the flex column: an ideal height that may shrink down to its text (min-height: auto).
            content: AnyView(Text("Sheet content").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: 20, idealHeight: body, maxHeight: body, alignment: .topLeading)
                .awcInspect(nodeID: "dut", part: "body", name: "body")),
            headline: c["slots"] == .bool(true) ? AnyView(Text("Authored headline")) : nil,
            close: c["slots"] == .bool(true) ? AnyView(AWCNativeView(node: .init(id: "done", tag: "md-button", properties: ["variant": "text"], children: [.text("Done")]))) : nil,
            actions: c["actions"] == .bool(true) ? AnyView(Group {
                AWCNativeView(node: .init(id: "later", tag: "md-button", properties: ["variant": "text"], children: [.text("Later")])).fixedSize()
                AWCNativeView(node: .init(id: "accept", tag: "md-button", properties: ["variant": "filled"], children: [.text("Accept")])).fixedSize()
            }) : nil)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                ZStack(alignment: .topLeading) {
                    Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                    Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
                }.environment(\.layoutDirection, .leftToRight)
                AWCNativeBottomSheet(id: "dut", model: AWCBottomSheetModel(properties), theme: theme, open: .constant(open), slots: slots, emit: { _ in })
                    .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
            }
            .environment(\.awcNativeDensity, c["inheritedDensity"].number ?? 0)
        }
        .awcBottomSheetAppearance(appearance)
        .modifier(SheetPartsModifier(on: c["parts"] == .bool(true)))
        .awcModalReducedMotion(true)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "dut", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 800, height: vp.last ?? 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct SheetPartsModifier: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on {
            content
                .awcBottomSheetPartAppearance(.init(outlineColor: "#C2185B", outlineWidth: 2), part: .container)
                .awcBottomSheetPartAppearance(.init(background: "#FFF3E0"), part: .dragHandle)
                .awcBottomSheetPartAppearance(.init(background: "#C62828", opacity: 1), part: .dragHandleIndicator)
                .awcBottomSheetPartAppearance(.init(background: "#F3E5F5"), part: .header)
                .awcBottomSheetPartAppearance(.init(letterSpacing: 1), part: .headline)
                .awcBottomSheetPartAppearance(.init(background: "#FFE0B2"), part: .close)
                .awcBottomSheetPartAppearance(.init(background: "#1565C0", height: 3), part: .dividerTop)
                .awcBottomSheetPartAppearance(.init(background: "#2E7D32", height: 3), part: .dividerBottom)
                .awcBottomSheetPartAppearance(.init(background: "#E3F2FD"), part: .content)
                .awcBottomSheetPartAppearance(.init(background: "#E8F5E9"), part: .actions)
                .awcBottomSheetPartAppearance(.init(background: "#00280066"), part: .scrim)
        } else { content }
    }
}
struct SheetGrid {
    let w: Int, h: Int; var v: [Float]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = (py * w + px) * 3; return [Double(v[i]), Double(v[i + 1]), Double(v[i + 2])] }
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
    func diff(_ o: SheetGrid, _ px: Int, _ py: Int) -> Float {
        let i = (py * w + px) * 3
        return max(abs(v[i] - o.v[i]), max(abs(v[i + 1] - o.v[i + 1]), abs(v[i + 2] - o.v[i + 2])))
    }
}
@main @MainActor enum NativeBottomSheetPaintIntegration {
    static func grid(_ cg: CGImage, scale: Double, w: Int, h: Int) -> SheetGrid {
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
    static let state = SheetPaintState()
    static var host: NSHostingView<SheetPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func r(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.c = c; state.epoch += 1; pump(0.5)
        let m = state.measurements, snap = c["snap"]
        func box(_ n: String) -> CGRect? { m.first { $0.name == n }?.bounds }
        let open = c["open"] != .bool(false) && c["hidden"] != .bool(true)
        if !open {
            check(m.first { $0.name == "container" } == nil, "\(name) closed/hidden sheet renders no surface")
        } else {
            let authoredClose = c["slots"] == .bool(true)
            for (part, value) in snap["parts"].object {
                let web = r(value["rect"]); guard web.width > 0 || web.height > 0 else { continue }
                let tol = part == "headline" || (part == "close" && authoredClose) ? 1.5 : 0.6
                check(near(box(part), web, tol), "\(name) \(part) \(d(box(part))) vs \(d(web))")
            }
            for child in snap["children"].array where child["slot"].string == "" {
                // Chrome shrinks the slotted block (a flex item of the content column) to fit; so does native (gate-7 R4-01).
                let web = r(child["rect"])
                check(near(box("body"), web, 0.6), "\(name) body \(d(box("body"))) vs \(d(web))")
            }
            let container = m.first { $0.name == "container" }
            let sem = snap["semantics"]
            check(container?.metrics["role"]?.string == sem["role"].string, "\(name) role \(container?.metrics["role"]?.string ?? "nil")")
            let webLabel = sem["aria-label"].string.isEmpty ? sem["labelledbyText"].string : sem["aria-label"].string
            if !authoredClose { check(container?.metrics["label"]?.string == webLabel, "\(name) accessible name \(container?.metrics["label"]?.string ?? "nil") vs \(webLabel)") }
            let leaf = snap["focus"]["path"].array.last?.string ?? ""
            let expected = leaf.hasPrefix("md-icon-button") ? "dut.close-button" : leaf.contains("[part=container]") ? "dut.container" : leaf.contains("[slot=close]") ? "done" : leaf.contains("[slot=actions]") ? "later" : "-"
            let responder = window.firstResponder as? NSView
            if expected != "-" { check(responder?.accessibilityIdentifier() == expected, "\(name) initial focus \(responder?.accessibilityIdentifier() ?? "nil") vs \(leaf)") }
        }
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        let w = Int(vp[0]), h = Int(vp[1])
        let web = grid(source, scale: 1, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, w: w, h: h)
        if let dir = ProcessInfo.processInfo.environment["AWC_SHEET_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        var n = 0, bad = 0, sum = 0.0, raw = 0.0, worst: Float = 0, at = ""
        for py in 1..<(h - 1) { for px in 1..<(w - 1) {
            if (px >= 12 && px < 112) && ((py >= 12 && py < 60) || (py >= 196 && py < 244)) { continue }
            guard web.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
            let q = web.diff(nat, px, py); n += 1; sum += Double(max(0, q - 1)); raw += Double(q); if q > 6 { bad += 1 }
            if q > worst { worst = q; at = "(\(px),\(py)) web \(web.at(px, py).map { Int($0) }) native \(nat.at(px, py).map { Int($0.rounded()) })" }
        } }
        let ratio = Double(bad) / Double(max(1, n)), mean = sum / Double(max(1, n))
        check(Double(n) / Double(max(1, (w - 2) * (h - 2))) > 0.5, "\(name) flat-pixel coverage \(n)")
        check(ratio <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(at))")
        report.append(["case": name, "compared": n, "meanBeyondOneLevel": mean, "mean": raw / Double(max(1, n)), "over6": bad, "worst": worst, "worstAt": at])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SheetPaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("bottom-sheet-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_SHEET_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("bottom-sheet-web-paint")) }
        if let out = ProcessInfo.processInfo.environment["AWC_SHEET_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Bottom sheet native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
