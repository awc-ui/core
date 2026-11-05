import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-text-field paint and geometry against Chrome 153 (Mac capture of tf-paint.html, DPR 1, 394 cases): theme × direction ×
// variant × density × 14 states, every hook alone and together, focus-border-width, appear-focused, reserved support row,
// no label, fixed multiline, speech, chips, densities -1/-3 and a global data-density -4. Checks the host, container,
// floating label, input line box, support row, counter, indicator / fieldset + legend notch, affixes, trailing buttons and
// every flat pixel of the clip.
@Observable final class TextFieldPaintState {
    var node = AWCNode(id: "tf", tag: "md-text-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 320.0
    var globalDensity: Double? = nil
    var appearance = AWCTextFieldAppearance()
    var parts = AWCTextFieldPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
@MainActor let textFieldPaintController = AWCTextFieldController()
struct TextFieldPaintFixture: View {
    let state: TextFieldPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node).frame(width: state.width).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .environment(\.awcNativeDensity, state.globalDensity ?? 0)
            .awcTextFieldAppearance(state.appearance).awcTextFieldPartAppearance(state.parts).awcTextFieldController(textFieldPaintController).awcFieldReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "tf", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct TFGrid {
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
@main @MainActor enum NativeTextFieldPaintIntegration {
    static let state = TextFieldPaintState()
    static var host: NSHostingView<TextFieldPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.01)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> TFGrid {
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
    static func appearance(_ h: AWCValue) -> AWCTextFieldAppearance {
        guard case .object(let o) = h else { return .init() }
        func l(_ k: String) -> Double? { o[k].flatMap { px($0.string) } }
        func c(_ k: String) -> String? { o[k]?.string }
        return .init(activeIndicatorColor: c("active-indicator-color"), containerColor: c("container-color"), containerShape: l("container-shape"), cursor: c("cursor"),
                     errorColor: c("error-color"), filledPill: o["filled-pill"].flatMap { Double($0.string) }, focusBorderWidth: l("focus-border-width"),
                     focusInset: l("focus-inset"), iconColor: c("icon-color"), iconSize: l("icon-size"), inputColor: c("input-color"), labelColor: c("label-color"),
                     opticalNudge: l("optical-nudge"), outlineColor: c("outline-color"), paddingInlineStart: l("padding-inline-start"),
                     paddingInlineEnd: l("padding-inline-end"), supportingTextColor: c("supporting-text-color"))
    }
    static func node(_ c: AWCValue) -> AWCNode {
        var p: [String: AWCValue] = [:]
        if case .object(let o) = c["props"] { p = o }
        var children: [AWCNode] = []
        for s in c["slots"].array {
            if s["kind"].string == "chip" { children.append(AWCNode(tag: "md-chip", properties: ["label": s["label"]], slot: s["slot"].string)) }
            else { children.append(.symbol(s["name"].string, slot: s["slot"].string)) }
        }
        return AWCNode(id: "tf", tag: "md-text-field", properties: p, children: children)
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 320
        state.globalDensity = c["globalDensity"].number; state.appearance = appearance(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : AWCTextFieldPartAppearance(values: c["parts"].object)
        state.node = node(c); state.measurements = []; state.epoch += 1; pump(0.3)
        if c["focus"] == .bool(true) { check(textFieldPaintController.setFocus(), "\(name) setFocus"); pump(0.3) }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        guard let root = m("md-text-field") else { check(false, "\(name) measured"); return }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ w: AWCValue, _ label: String, tol: Double = 0.6, widthTol: Double = 0.6, x: Bool = true, width: Bool = true) {
            guard w != .null else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let r = w["rect"], b = n.bounds
            if x { near(b.minX, r["x"].number!, "\(label) x", tol) }
            near(b.minY, r["y"].number!, "\(label) y", tol)
            if width { near(b.width, r["width"].number!, "\(label) width", widthTol) }
            near(b.height, r["height"].number!, "\(label) height", tol)
        }
        let host = c["host"]
        near(root.bounds.minX, host["x"].number!, "host x"); near(root.bounds.minY, host["y"].number!, "host y")
        near(root.bounds.width, host["width"].number!, "host width"); near(root.bounds.height, host["height"].number!, "host height")
        rect(m("container"), c["container"], "container")
        check(colorClose(m("container")?.metrics["background"]?.string, c["container"]["backgroundColor"].string), "\(name) container colour \(m("container")?.metrics["background"]?.string ?? "-") vs \(c["container"]["backgroundColor"].string)")
        if c["label"] != .null {
            rect(m("label"), c["label"], "label", widthTol: 1.2)
            check(colorClose(m("label")?.metrics["color"]?.string, c["label"]["color"].string), "\(name) label colour \(m("label")?.metrics["color"]?.string ?? "-") vs \(c["label"]["color"].string)")
            near(m("label")?.metrics["fontSize"]?.number ?? 0, px(c["label"]["fontSize"].string) ?? 0, "label font", 0.01)
        } else { check(m("label") == nil, "\(name) no label") }
        // With chips, the input follows the native md-chip widths (each within md-chip's own 0.6px paint tolerance).
        rect(m("input"), c["input"], "input", tol: c["slots"].array.contains { $0["kind"].string == "chip" } ? 1.6 : 0.6, widthTol: c["slots"].array.contains { $0["kind"].string == "chip" } ? 1.6 : 0.6)
        check(colorClose(m("input")?.metrics["color"]?.string, c["input"]["color"].string), "\(name) input colour \(m("input")?.metrics["color"]?.string ?? "-") vs \(c["input"]["color"].string)")
        if c["support"] != .null, !c["support"]["text"].string.isEmpty {
            rect(m("supporting-text"), c["support"], "support", widthTol: 1.2)
        }
        rect(m("counter"), c["counter"], "counter", widthTol: 1.2)
        if c["indicator"] != .null, c["indicator"]["rect"]["height"].number ?? 0 > 0 {
            let i = m("indicator"), w = c["indicator"]
            near(i?.metrics["height"]?.number ?? -1, w["rect"]["height"].number!, "indicator height")
            check(colorClose(i?.metrics["color"]?.string, w["backgroundColor"].string), "\(name) indicator colour \(i?.metrics["color"]?.string ?? "-") vs \(w["backgroundColor"].string)")
            near(i.map { $0.bounds.maxY } ?? -1, w["rect"]["y"].number! + w["rect"]["height"].number!, "indicator bottom")
        }
        if c["fieldset"] != .null, c["fieldset"]["rect"]["width"].number ?? 0 > 0 {
            let f = m("fieldset"), w = c["fieldset"]
            rect(f, w, "fieldset")
            near(f?.metrics["borderWidth"]?.number ?? -1, px(w["borderTopWidth"].string) ?? 0, "fieldset width")
            check(colorClose(f?.metrics["color"]?.string, w["borderTopColor"].string), "\(name) outline colour \(f?.metrics["color"]?.string ?? "-") vs \(w["borderTopColor"].string)")
            if c["legend"] != .null, let fb = f?.bounds {
                let lg = c["legend"]["rect"], start = f?.metrics["legendStart"]?.number ?? 0, lw = f?.metrics["legendWidth"]?.number ?? 0
                if c["dir"].string == "rtl" { near(fb.maxX - start, lg["x"].number! + lg["width"].number!, "legend end", 1.2) } else { near(fb.minX + start, lg["x"].number!, "legend x", 1.2) }
                near(lw, lg["width"].number!, "legend width", 1.2)
            }
        }
        rect(m("prefix"), c["prefix"], "prefix", widthTol: 1.2); rect(m("suffix"), c["suffix"], "suffix", widthTol: 1.2)
        rect(m("chips"), c["chips"].array.isEmpty && c["chips"]["rect"]["width"].number == 0 ? .null : c["chips"], "chips", widthTol: 2)
        let parts = ["Clear": "clear", "Show password": "password-toggle", "Hide password": "password-toggle", "Start voice input": "speech", "Stop listening": "speech"]
        for b in c["buttons"].array {
            let part = parts[b["label"].string] ?? b["label"].string
            if let n = m(part) {
                let hit = CGRect(x: n.bounds.midX - 20, y: n.bounds.midY - 20, width: 40, height: 40)
                near(hit.minX, b["rect"]["x"].number!, "\(part) x"); near(hit.minY, b["rect"]["y"].number!, "\(part) y")
            } else { check(false, "\(name) \(part) missing") }
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
        // Text placement (fi, 2026-10-30): the first and last ink rows of the input box (pixels far from the box's own background)
        // on Chrome's capture and on the native one; a glyph offset leaves every flat pixel unchanged. Focused cases draw a caret.
        // UIKit keeps a secure text field's characters out of every capture (secure layer content), so masked text has no ink there.
        var capturable = true
        #if !canImport(AppKit)
        capturable = c["props"]["type"].string != "password"
        #endif
        if capturable, c["input"] != .null, c["focus"] != .bool(true), c["input"]["rect"]["x"].number != nil {
            let ir = c["input"]["rect"]
            let ix0 = Int(ir["x"].number!.rounded()), iy0 = Int(ir["y"].number!.rounded()), iw = Int(ir["width"].number!.rounded()), ih = Int(ir["height"].number!.rounded())
            func ink(_ g: TFGrid) -> (Int, Int)? {
                let xs = max(ix0 + 1, g.x + 1)..<max(max(ix0 + 1, g.x + 1), min(ix0 + iw - 1, g.x + g.w - 1)), ys = max(iy0, g.y)..<max(max(iy0, g.y), min(iy0 + ih, g.y + g.h))
                guard !xs.isEmpty, !ys.isEmpty else { return nil }
                let bg = g.at(xs.lowerBound, ys.lowerBound)
                // Ink = half the box's strongest contrast (at least 24): low-contrast text (disabled, 38 %) is found on both
                // renderers whatever their antialiasing gamma.
                var peak = 0.0
                for y in ys { for x in xs { peak = max(peak, diff(g.at(x, y), bg)) } }
                let threshold = max(24, peak * 0.5)
                var first: Int?, last: Int?
                for y in ys where xs.contains(where: { diff(g.at($0, y), bg) > threshold }) { if first == nil { first = y }; last = y }
                return first.map { ($0, last!) }
            }
            let wi = ink(web), ni = ink(nat)
            let ok = (wi == nil) == (ni == nil) && (wi == nil || (abs(wi!.0 - ni!.0) <= 1 && abs(wi!.1 - ni!.1) <= 1))
            check(ok, "\(name) text rows \(ni.map { "\($0.0)–\($0.1)" } ?? "none") vs \(wi.map { "\($0.0)–\($0.1)" } ?? "none")")
        }
        if let dir = ProcessInfo.processInfo.environment["AWC_TF_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: TextFieldPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 640, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("textfield-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_TF_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("textfield-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_TF_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Text field native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
