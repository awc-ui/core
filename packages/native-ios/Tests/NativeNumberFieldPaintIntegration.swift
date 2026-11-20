import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-number-field paint and geometry against Chrome 153 (Mac capture of nf-paint.html, DPR 1, 208 cases): theme × direction ×
// variant × steppers (inline / split / none) × states, densities, Intl formats (currency, percent, unit, de-DE, en-IN grouping,
// ar-EG digits), every hook alone and together. Checks the host, the field, both steppers (box, disabled, icon), the inner
// field's container, label, input text and line box, support row, indicator / outline and every flat pixel of the clip.
@Observable final class NumberFieldPaintState {
    var node = AWCNode(id: "nf", tag: "md-number-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 320.0
    var globalDensity: Double? = nil
    var appearance = AWCNumberFieldAppearance()
    var fieldHooks = AWCTextFieldAppearance()
    var parts = AWCNumberFieldPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
@MainActor let numberFieldPaintController = AWCNumberFieldController()
struct NumberFieldPaintFixture: View {
    let state: NumberFieldPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .environment(\.awcNativeDensity, state.globalDensity ?? 0)
            .awcNumberFieldAppearance(state.appearance, for: "nf").awcTextFieldAppearance(state.fieldHooks, for: "nf").awcNumberFieldPartAppearance(state.parts, for: "nf")
            .awcNumberFieldController(numberFieldPaintController).awcFieldReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "nf", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct NFGrid {
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
@main @MainActor enum NativeNumberFieldPaintIntegration {
    static let state = NumberFieldPaintState()
    static var host: NSHostingView<NumberFieldPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.01)) } while Date() < end }
    #if canImport(AppKit)
    static func appKitText() -> [String] { func walk(_ v: NSView) -> [String] { (v as? NSTextField).map { [$0.stringValue] } ?? v.subviews.flatMap(walk) }; return walk(host) }
    #else
    static func appKitText() -> [String] { [] }
    #endif
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> NFGrid {
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
    static func hex(_ h: String) -> [Double] {
        let c = Color(awcHex: h).resolve(in: EnvironmentValues()); return [Double(c.red), Double(c.green), Double(c.blue), Double(c.opacity)]
    }
    static func premul(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func colorClose(_ native: String?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let native else { return false }
        return zip(premul(hex(native)), premul(css(web))).allSatisfy { abs($0 - $1) <= tol }
    }
    static func px(_ s: String) -> Double? { s.hasSuffix("px") ? Double(s.dropLast(2)) : nil }
    static func hooks(_ h: AWCValue) -> (AWCNumberFieldAppearance, AWCTextFieldAppearance) {
        guard case .object(let o) = h else { return (.init(), .init()) }
        func l(_ k: String) -> Double? { o[k].flatMap { px($0.string) } }
        func c(_ k: String) -> String? { o[k]?.string }
        let nf = AWCNumberFieldAppearance(width: l("--md-number-field-width"), minWidth: l("--md-number-field-min-width"), stepperIconSize: l("--md-number-field-stepper-icon-size"),
                                          stepperColor: c("--md-number-field-stepper-color"), splitStepperSize: l("--md-number-field-split-stepper-size"))
        let t = "--md-text-field-"
        let tf = AWCTextFieldAppearance(activeIndicatorColor: c(t + "active-indicator-color"), containerColor: c(t + "container-color"), containerShape: l(t + "container-shape"),
                                        cursor: c(t + "cursor"), errorColor: c(t + "error-color"), focusBorderWidth: l(t + "focus-border-width"), iconColor: c(t + "icon-color"),
                                        inputColor: c(t + "input-color"), labelColor: c(t + "label-color"), outlineColor: c(t + "outline-color"),
                                        paddingInlineStart: l(t + "padding-inline-start"), paddingInlineEnd: l(t + "padding-inline-end"), supportingTextColor: c(t + "supporting-text-color"))
        return (nf, tf)
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 320
        state.globalDensity = c["globalDensity"].number; (state.appearance, state.fieldHooks) = hooks(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : AWCNumberFieldPartAppearance(values: c["parts"].object)
        var p: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { p = o }
        state.node = AWCNode(id: "nf", tag: "md-number-field", properties: p); state.measurements = []; state.epoch += 1; pump(0.3)
        if c["focus"] == .bool(true) { check(numberFieldPaintController.setFocus(), "\(name) setFocus"); pump(0.3) }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        guard let root = m("md-number-field") else { check(false, "\(name) measured"); return }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ w: AWCValue, _ label: String, tol: Double = 0.6, widthTol: Double = 0.6) {
            guard w != .null else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let r = w["rect"], b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol); near(b.minY, r["y"].number!, "\(label) y", tol)
            near(b.width, r["width"].number!, "\(label) width", widthTol); near(b.height, r["height"].number!, "\(label) height", tol)
        }
        let host = c["host"]
        near(root.bounds.minX, host["x"].number!, "host x"); near(root.bounds.minY, host["y"].number!, "host y")
        near(root.bounds.width, host["width"].number!, "host width"); near(root.bounds.height, host["height"].number!, "host height")
        rect(m("field"), c["field"], "field")
        if c["parts"] != .null {   // ::part(field): background and opacity of the inner field box
            check(colorClose(m("field")?.metrics["background"]?.string, c["field"]["backgroundColor"].string), "\(name) field background \(m("field")?.metrics["background"]?.string ?? "-") vs \(c["field"]["backgroundColor"].string)")
            near(m("field")?.metrics["opacity"]?.number ?? -1, Double(c["field"]["opacity"].string) ?? c["field"]["opacity"].number ?? 1, "field opacity", 0.001)
        }
        for k in ["increment", "decrement"] {
            let w = c[k]
            if w == .null { check(m(k) == nil, "\(name) no \(k)"); continue }
            rect(m(k), w, k)
            check(m(k)?.metrics["disabled"]?.bool == w["disabled"].bool, "\(name) \(k) disabled \(String(describing: m(k)?.metrics["disabled"])) vs \(w["disabled"])")
        }
        rect(m("container"), c["container"], "container")
        check(colorClose(m("container")?.metrics["background"]?.string, c["container"]["backgroundColor"].string), "\(name) container colour \(m("container")?.metrics["background"]?.string ?? "-") vs \(c["container"]["backgroundColor"].string)")
        if c["label"] != .null {
            rect(m("label"), c["label"], "label", widthTol: 1.2)
            check(colorClose(m("label")?.metrics["color"]?.string, c["label"]["color"].string), "\(name) label colour \(m("label")?.metrics["color"]?.string ?? "-") vs \(c["label"]["color"].string)")
            near(m("label")?.metrics["fontSize"]?.number ?? 0, px(c["label"]["fontSize"].string) ?? 0, "label font", 0.01)
        }
        if c["input"] != .null {
            rect(m("input"), c["input"], "input")
            var later = "-"
            if m("input")?.metrics["value"]?.string != c["input"]["value"].string {
                pump(0.6); later = state.measurements.first { $0.name == "input" }?.metrics["value"]?.string ?? "-"
                #if canImport(AppKit)
                // Diagnostic: a forced layout pass of the host, then the inspection again.
                Self.host.needsLayout = true; Self.host.layoutSubtreeIfNeeded(); pump(0.1)
                later += " / after layout " + (state.measurements.first { $0.name == "input" }?.metrics["value"]?.string ?? "-")
                #endif
            }
            check(m("input")?.metrics["value"]?.string == c["input"]["value"].string, "\(name) input text \(m("input")?.metrics["value"]?.string ?? "-") vs \(c["input"]["value"].string) (0.6 s later \(later), field value \(m("md-text-field")?.metrics["value"]?.string ?? "-"), host formatted \(root.metrics["formattedValue"]?.string ?? "-"), value \(String(describing: root.metrics["value"])), inputs \(ms.filter { $0.name == "input" }.map { $0.metrics["value"]?.string ?? "-" }), field display \(m("md-text-field")?.metrics["displayValue"]?.string ?? "-"), AppKit \(appKitText()))")
            check(colorClose(m("input")?.metrics["color"]?.string, c["input"]["color"].string), "\(name) input colour \(m("input")?.metrics["color"]?.string ?? "-") vs \(c["input"]["color"].string)")
            check(root.metrics["inputMode"]?.string == c["input"]["inputmode"].string, "\(name) inputmode \(root.metrics["inputMode"]?.string ?? "-") vs \(c["input"]["inputmode"].string)")
        }
        if c["support"] != .null, !c["support"]["text"].string.isEmpty { rect(m("supporting-text"), c["support"], "support", widthTol: 1.2) }
        if c["indicator"] != .null, c["indicator"]["rect"]["height"].number ?? 0 > 0 {
            let i = m("indicator"), w = c["indicator"]
            near(i?.metrics["height"]?.number ?? -1, w["rect"]["height"].number!, "indicator height")
            check(colorClose(i?.metrics["color"]?.string, w["backgroundColor"].string), "\(name) indicator colour \(i?.metrics["color"]?.string ?? "-") vs \(w["backgroundColor"].string)")
        }
        if c["fieldset"] != .null, c["fieldset"]["rect"]["width"].number ?? 0 > 0 {
            let f = m("fieldset"), w = c["fieldset"]
            rect(f, w, "fieldset")
            check(colorClose(f?.metrics["color"]?.string, w["borderTopColor"].string), "\(name) outline colour \(f?.metrics["color"]?.string ?? "-") vs \(w["borderTopColor"].string)")
        }
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
        if let dir = ProcessInfo.processInfo.environment["AWC_NF_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: NumberFieldPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 640, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("numberfield-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_NF_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("numberfield-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_NF_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Number field native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
