import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-side-sheet paint and geometry against Chrome (side-sheet native-paint.html: 178 cases, 1:1 viewport captures).
// Every part box, the standard host and the page column it leaves, the fallback back/close, the slotted body,
// role/label, initial focus, the container radius and every flat pixel of the viewport (UA page buttons masked) are compared.
@Observable final class SidePaintState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
/// The oracle page: `#page { display: flex }` holding `#main { flex: 1 1 auto }` and, for a standard sheet, the sheet
/// before (`start`) or after (`end`) it; a flex row follows the document direction.
struct SidePage: Layout {
    let sheetRight: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { proposal.replacingUnspecifiedDimensions() }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sheet = subviews.count > 1 ? subviews[1].sizeThatFits(.init(width: bounds.width, height: bounds.height)) : .zero
        let mainWidth = max(0, bounds.width - sheet.width)
        let mainX = sheetRight ? bounds.minX : bounds.minX + sheet.width
        subviews[0].place(at: .init(x: mainX, y: bounds.minY), anchor: .topLeading, proposal: .init(width: mainWidth, height: bounds.height))
        if subviews.count > 1 {
            subviews[1].place(at: .init(x: sheetRight ? bounds.minX + mainWidth : bounds.minX, y: bounds.minY), anchor: .topLeading,
                              proposal: .init(width: bounds.width, height: bounds.height))
        }
    }
}
struct SidePaintFixture: View {
    let state: SidePaintState
    var appearance: AWCSideSheetAppearance {
        let h = state.c["hooks"]
        func s(_ k: String) -> String? { h[k].string.isEmpty ? nil : h[k].string }
        func len(_ k: String) -> AWCSkeletonLength? {
            guard let v = s(k) else { return nil }
            if v.hasPrefix("calc(") {
                // calc(P% - Npx)
                let n = v.replacingOccurrences(of: "calc(", with: "").replacingOccurrences(of: ")", with: "").split(separator: " ")
                guard n.count == 3, let pct = Double(n[0].replacingOccurrences(of: "%", with: "")), let px = Double(n[2].replacingOccurrences(of: "px", with: "")) else { return nil }
                return .init(points: n[1] == "-" ? -px : px, fraction: pct / 100)
            }
            return Double(v.replacingOccurrences(of: "px", with: "")).map { .points($0) }
        }
        let shape = s("container-shape").map { AWCSideSheetShape($0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) }) }
        return .init(containerColor: s("container-color"), containerShape: shape, headlineColor: s("headline-color"), contentColor: s("content-color"),
                     scrimColor: s("scrim-color"), dividerColor: s("divider-color"), iconColor: s("icon-color"), width: len("width"), maxWidth: len("max-width"))
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        var properties: [String: AWCValue] = ["headline": "Filters"]
        if case .object(let o) = c["props"] { for (k, v) in o { properties[k] = v } }
        if c["hidden"] == .bool(true) { properties["hidden"] = true }
        let model = AWCSideSheetModel(properties)
        let rtl = c["dir"].string == "rtl"
        let body = c["bodyHeight"].number ?? 120
        let open = c["open"] != .bool(false)
        let authored = c["slots"] == .bool(true)
        let slots = AWCSideSheetSlots(
            content: AnyView(Text("Sheet content").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: body, maxHeight: body, alignment: .topLeading)
                .awcInspect(nodeID: "dut", part: "body", name: "body")),
            headline: authored ? AnyView(Text("Authored headline")) : nil,
            back: authored ? AnyView(AWCNativeView(node: .init(id: "menu", tag: "md-icon-button", properties: ["icon": "menu", "aria-label": "Menu"]))) : nil,
            close: authored ? AnyView(AWCNativeView(node: .init(id: "done", tag: "md-button", properties: ["variant": "text"], children: [.text("Done")]))) : nil,
            actions: c["actions"] == .bool(true) ? AnyView(Group {
                AWCNativeView(node: .init(id: "save", tag: "md-button", properties: ["variant": "filled"], children: [.text("Save")])).fixedSize()
                AWCNativeView(node: .init(id: "cancel", tag: "md-button", properties: ["variant": "outlined"], children: [.text("Cancel")])).fixedSize()
            }) : nil)
        let sheet = AWCNativeSideSheet(id: "dut", model: model, theme: theme, open: .constant(open), slots: slots, emit: { _ in })
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
        let main = ZStack(alignment: .topLeading) {
            Color.clear
            Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
        }
        // `#main { flex: 1 1 auto; min-width: 0 }`: its box is the column it is given (the block may overflow it).
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity, alignment: .topLeading)
        .awcInspect(nodeID: "dut", part: "main", name: "main")
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                if model.modal {
                    main
                    sheet
                } else {
                    SidePage(sheetRight: (model.side == "end") != rtl) { main; sheet }
                }
            }
            .environment(\.layoutDirection, .leftToRight)
            .environment(\.awcNativeDensity, c["inheritedDensity"].number ?? 0)
        }
        .awcSideSheetAppearance(appearance)
        .modifier(SidePartsModifier(on: c["parts"] == .bool(true)))
        .awcModalReducedMotion(true)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "dut", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 800, height: vp.last ?? 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct SidePartsModifier: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on {
            content
                .awcSideSheetPartAppearance(.init(outlineColor: "#C2185B", outlineWidth: 2), part: .container)
                .awcSideSheetPartAppearance(.init(background: "#F3E5F5"), part: .header)
                .awcSideSheetPartAppearance(.init(letterSpacing: 1), part: .headline)
                .awcSideSheetPartAppearance(.init(background: "#FFE0B2"), part: .close)
                .awcSideSheetPartAppearance(.init(background: "#1565C0", height: 3), part: .dividerTop)
                .awcSideSheetPartAppearance(.init(background: "#2E7D32", height: 3), part: .dividerBottom)
                .awcSideSheetPartAppearance(.init(background: "#E3F2FD"), part: .content)
                .awcSideSheetPartAppearance(.init(background: "#E8F5E9"), part: .actions)
                .awcSideSheetPartAppearance(.init(background: "#00280066"), part: .scrim)
        } else { content }
    }
}
struct SideGrid {
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
    func diff(_ o: SideGrid, _ px: Int, _ py: Int) -> Float {
        let i = (py * w + px) * 3
        return max(abs(v[i] - o.v[i]), max(abs(v[i + 1] - o.v[i + 1]), abs(v[i + 2] - o.v[i + 2])))
    }
}
@main @MainActor enum NativeSideSheetPaintIntegration {
    static func grid(_ cg: CGImage, scale: Double, w: Int, h: Int) -> SideGrid {
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
    static let state = SidePaintState()
    static var host: NSHostingView<SidePaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func r(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol }
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? -1 }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        let vp = c["vp"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.c = c; state.epoch += 1; pump(0.5)
        let m = state.measurements, snap = c["snap"]
        func box(_ n: String) -> CGRect? { m.first { $0.name == n }?.bounds }
        let open = c["open"] != .bool(false) && c["hidden"] != .bool(true)
        let modal = c["props"]["variant"].string == "modal"
        check(near(box("main"), r(snap["page"]["main"]), 0.6), "\(name) page main \(d(box("main"))) vs \(d(r(snap["page"]["main"])))")
        if !open {
            check(m.first { $0.name == "container" } == nil, "\(name) closed/hidden sheet renders no surface")
        } else {
            let authored = c["slots"] == .bool(true)
            if !modal { check(near(box("host"), r(snap["host"]["rect"]), 0.6), "\(name) host \(d(box("host"))) vs \(d(r(snap["host"]["rect"])))") }
            for (part, value) in snap["parts"].object {
                let web = r(value["rect"]); guard web.width > 0 || web.height > 0 else { continue }
                let tol = (part == "headline" || part == "close") && authored ? 1.5 : 0.6
                check(near(box(part), web, tol), "\(name) \(part) \(d(box(part))) vs \(d(web))")
            }
            if !authored, let back = snap["controls"].array.first(where: { $0["label"].string == "Back" && ($0["rect"]["width"].number ?? 0) > 0 }) {
                check(near(box("back"), r(back["rect"]), 0.6), "\(name) back \(d(box("back"))) vs \(d(r(back["rect"])))")
            }
            for child in snap["children"].array where child["slot"].string == "" {
                let web = r(child["rect"])
                check(near(box("body"), web, 0.6), "\(name) body \(d(box("body"))) vs \(d(web))")
            }
            let container = m.first { $0.name == "container" }
            let sem = snap["semantics"]
            check(container?.metrics["role"]?.string == sem["role"].string, "\(name) role \(container?.metrics["role"]?.string ?? "nil") vs \(sem["role"].string)")
            let webLabel = sem["aria-label"].string.isEmpty ? sem["labelledbyText"].string : sem["aria-label"].string
            if !authored { check(container?.metrics["label"]?.string == webLabel, "\(name) accessible name \(container?.metrics["label"]?.string ?? "nil") vs \(webLabel)") }
            let radius = px(snap["parts"]["container"]["borderTopLeftRadius"].string)
            check(abs((container?.metrics["radius"]?.number ?? -1) - radius) < 0.01, "\(name) radius \(container?.metrics["radius"]?.number ?? -1) vs \(radius)")
            let focus = snap["focus"], leaf = focus["path"].array.last?.string ?? "", text = focus["text"].string
            let expected: String = leaf == "body" ? "" : leaf.contains("[slot=back]") ? "menu" : leaf.contains("[slot=close]") ? "done" : leaf.contains("[slot=actions]") ? text.lowercased()
                : leaf.hasPrefix("md-icon-button") ? (text == "Back" ? "dut.back-button" : "dut.close-button") : leaf.hasPrefix("md-side-sheet") || leaf.contains("[part=container]") ? "dut.container" : "-"
            let responder = (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? ""
            if expected != "-" { check(responder == expected, "\(name) initial focus \(responder) vs \(leaf) \(text)") }
        }
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        let w = Int(vp[0]), h = Int(vp[1])
        let web = grid(source, scale: 1, w: w, h: h), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width, w: w, h: h)
        if let dir = ProcessInfo.processInfo.environment["AWC_SIDE_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        // The UA page buttons (#opener, #after) are not part of the component; they sit at the native main column's start.
        let mainX = Int((box("main")?.minX ?? 0).rounded())
        var n = 0, bad = 0, sum = 0.0, raw = 0.0, worst: Float = 0, at = ""
        for py in 1..<(h - 1) { for px in 1..<(w - 1) {
            if (px >= mainX + 12 && px < mainX + 112) && ((py >= 12 && py < 60) || (py >= 196 && py < 244)) { continue }
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
        host = NSHostingView(rootView: SidePaintFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("side-sheet-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_SIDE_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("side-sheet-web-paint")) }
        if let out = ProcessInfo.processInfo.environment["AWC_SIDE_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Side sheet native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
