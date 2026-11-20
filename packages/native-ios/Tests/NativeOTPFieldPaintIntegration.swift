import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-otp-field paint and geometry against Chrome 153 (Mac capture of otp-paint.html, DPR 1, 168 cases): theme × direction ×
// density (0, −2, −4) × 13 states (empty, partial, full, focused, error, disabled, read-only, mask, groups, supporting text,
// length 4, alphanumeric uppercase), every hook alone and together, the separator slot, reserved support, densities −1/−3.
// Checks the host, every cell (box, border colour and width, character, text colour), separators and dots, the supporting
// text and every flat pixel of the clip.
@Observable final class OTPFieldPaintState {
    var node = AWCNode(id: "otp", tag: "md-otp-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 440.0
    var globalDensity: Double? = nil
    var appearance = AWCOTPFieldAppearance()
    var parts = AWCOTPFieldPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
@MainActor let otpFieldPaintController = AWCOTPFieldController()
struct OTPFieldPaintFixture: View {
    let state: OTPFieldPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .environment(\.awcNativeDensity, state.globalDensity ?? 0)
            .awcOTPFieldAppearance(state.appearance, for: "otp").awcOTPFieldPartAppearance(state.parts, for: "otp")
            .awcOTPFieldController(otpFieldPaintController).awcFieldReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "otp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct OTPGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flat(_ px: Int, _ py: Int, _ limit: Double) -> Bool {
        guard px - 1 >= x && py - 1 >= y && px + 1 < x + w && py + 1 < y + h else { return false }
        for c in 0..<3 { var lo = 999.0, hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let v = values[((py + dy - y) * w + (px + dx - x)) * 3 + c]; lo = min(lo, v); hi = max(hi, v) } }
            if hi - lo > limit { return false } }
        return true
    }
}
@main @MainActor enum NativeOTPFieldPaintIntegration {
    static let state = OTPFieldPaintState()
    static var host: NSHostingView<OTPFieldPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.01)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> OTPGrid {
        let k = max(1, Int(s.scale.rounded()))
        let crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let n = Double(k * k)
        for py in 0..<h { for px in 0..<w { var sum = [0.0, 0.0, 0.0]
            for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { let i = (yy * cg.width + xx) * 4; for c in 0..<3 { sum[c] += Double(buffer[i + c]) } } }
            for c in 0..<3 { values[(py * w + px) * 3 + c] = sum[c] / n } } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    static func diff(_ a: [Double], _ b: [Double]) -> Double { var m = 0.0; for i in 0..<3 { m = max(m, abs(a[i] - b[i])) }; return m }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func hex(_ h: String) -> [Double] { let c = Color(awcHex: h).resolve(in: EnvironmentValues()); return [Double(c.red), Double(c.green), Double(c.blue), Double(c.opacity)] }
    static func premul(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func colorClose(_ native: String?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let native else { return false }
        return zip(premul(hex(native)), premul(css(web))).allSatisfy { abs($0 - $1) <= tol }
    }
    static func px(_ s: String) -> Double? { s.hasSuffix("px") ? Double(s.dropLast(2)) : nil }
    static func hooks(_ h: AWCValue) -> AWCOTPFieldAppearance {
        guard case .object(let o) = h else { return .init() }
        func l(_ k: String) -> Double? { o["--md-otp-field-" + k].flatMap { px($0.string) } }
        func c(_ k: String) -> String? { o["--md-otp-field-" + k]?.string }
        return AWCOTPFieldAppearance(cellGap: l("cell-gap"), cellHeight: l("cell-height"), cellShape: l("cell-shape"), cellWidth: l("cell-width"),
                                     focusColor: c("focus-color"), fontSize: l("font-size"), outlineColor: c("outline-color"))
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 440
        state.globalDensity = c["globalDensity"].number; state.appearance = hooks(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : AWCOTPFieldPartAppearance(values: c["parts"].object)
        var p: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { p = o }
        let slot: [AWCNode] = c["slot"] == .null ? [] : [AWCNode(tag: "#text", properties: ["text": c["slot"]], slot: "separator")]
        state.node = AWCNode(id: "otp", tag: "md-otp-field", properties: p, children: slot); state.measurements = []; state.epoch += 1; pump(0.3)
        if c["focus"] == .bool(true) { otpFieldPaintController.setFocus(); pump(0.3) }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        guard let root = m("md-otp-field") else { check(false, "\(name) measured"); return }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ r: AWCValue, _ label: String, tol: Double = 0.6, widthTol: Double = 0.6) {
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol); near(b.minY, r["y"].number!, "\(label) y", tol)
            near(b.width, r["width"].number!, "\(label) width", widthTol); near(b.height, r["height"].number!, "\(label) height", tol)
        }
        rect(root, c["host"], "host", widthTol: 1.2)
        for (i, w) in c["cells"].array.enumerated() {
            let cell = m("cell-\(i)")
            rect(cell, w["rect"], "cell \(i)")
            check(colorClose(cell?.metrics["borderColor"]?.string, w["border"].string), "\(name) cell \(i) border \(cell?.metrics["borderColor"]?.string ?? "-") vs \(w["border"].string)")
            near(cell?.metrics["borderWidth"]?.number ?? -1, w["borderWidth"].number!, "cell \(i) border width", 0.01)
            check(cell?.metrics["text"]?.string == w["value"].string, "\(name) cell \(i) text \(cell?.metrics["text"]?.string ?? "-") vs \(w["value"].string)")
            check(colorClose(cell?.metrics["color"]?.string, w["color"].string), "\(name) cell \(i) colour \(cell?.metrics["color"]?.string ?? "-") vs \(w["color"].string)")
            near(cell?.metrics["fontSize"]?.number ?? -1, w["fontSize"].number!, "cell \(i) font", 0.01)
            let bg = w["background"].string
            if !bg.isEmpty, !bg.hasSuffix(", 0)") {   // ::part(cell) background (transparent by default)
                check(colorClose(cell?.metrics["background"]?.string, bg), "\(name) cell \(i) background \(cell?.metrics["background"]?.string ?? "-") vs \(bg)")
                check(colorClose(cell?.metrics["caret"]?.string, w["caret"].string), "\(name) cell \(i) caret \(cell?.metrics["caret"]?.string ?? "-") vs \(w["caret"].string)")
            }
            check(cell?.metrics["focused"]?.bool == w["focused"].bool, "\(name) cell \(i) focused")
            check(cell?.metrics["secure"]?.bool == (w["type"].string == "password"), "\(name) cell \(i) secure")
        }
        check(c["cells"].array.count == ms.filter { $0.name.hasPrefix("cell-") }.count, "\(name) cell count")
        for (k, s) in c["separators"].array.enumerated() {
            rect(m("separator-\(k)"), s["rect"], "separator \(k)")
        }
        if c["support"] != .null {
            rect(m("supporting-text"), c["support"]["rect"], "support", widthTol: c["support"]["text"].string.isEmpty ? 99 : 1.2)
            check(m("supporting-text")?.metrics["text"]?.string == c["support"]["text"].string, "\(name) support text")
            if !c["support"]["text"].string.isEmpty { check(colorClose(m("supporting-text")?.metrics["color"]?.string, c["support"]["color"].string), "\(name) support colour \(m("supporting-text")?.metrics["color"]?.string ?? "-") vs \(c["support"]["color"].string)") }
        } else { check(m("supporting-text") == nil, "\(name) no support row") }
        let clip = c["clip"], x0 = Int(clip["x"].number!), cxp = max(0, x0), cyp = Int(clip["y"].number!), cw = Int(clip["width"].number!) - (cxp - x0), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cxp, y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_OTP_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: OTPFieldPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 640, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("otpfield-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_OTP_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("otpfield-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_OTP_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("OTP field native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
