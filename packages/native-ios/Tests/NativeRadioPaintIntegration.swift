import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-radio paint and geometry against Chrome (radio/paint.html, DPR 1): the matrix (theme × direction × density ×
// unchecked/checked × rest/disabled/soft-disabled), all 7 hooks and each hook alone, the parts, keyboard and method
// focus (ring), and hidden: target, state layer, outer/inner circle boxes and colours, the inner scale, focus ring,
// tab stop and every flat pixel of the clip. The two reportValidity cases (inline support line) are not in this pass.
@Observable final class RadioPaintFixtureState {
    var node = AWCNode(id: "radio", tag: "md-radio")
    var epoch = 0
    var dark = false
    var rtl = false
    var probe = false
    var appearance = AWCRadioAppearance()
    var parts = AWCRadioPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
/// reportValidity()/setCustomValidity() for the validation cases (the native method controller).
let radioPaintController = AWCSelectionControlController()
struct RadioPaintFixture: View {
    let state: RadioPaintFixtureState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        HStack(alignment: .center, spacing: 24) {
            if state.probe { Color.clear.frame(width: 60, height: 32) }
            AWCNativeView(node: state.node).awcSelectionControlController(radioPaintController).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .awcRadioAppearance(state.appearance).awcRadioPartAppearance(state.parts)
            .awcSelectionReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "radio", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 40).padding(.top, 40)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct RadioGrid {
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
@main @MainActor enum NativeRadioPaintIntegration {
    static let state = RadioPaintFixtureState()
    static var host: NSHostingView<RadioPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = [], skipped: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> RadioGrid {
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
    /// rgb()/rgba()/color(srgb …) → sRGB [r,g,b,a] in 0…1.
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func premul(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func colorClose(_ native: AWCValue?, _ web: String, _ tol: Double = 0.012) -> Bool {
        guard let a = native?.array.compactMap(\.number), a.count == 4 else { return false }
        return zip(premul(a), premul(css(web))).allSatisfy { abs($0 - $1) <= tol }
    }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
    static func hooks(_ v: AWCValue) -> AWCRadioAppearance {
        guard case .object(let o) = v else { return .init() }
        func n(_ k: String) -> Double? { o[k].map { px($0.string) } }; func c(_ k: String) -> String? { o[k]?.string }
        return .init(iconColor: c("icon-color"), selectedIconColor: c("selected-icon-color"), iconSize: n("icon-size"), innerCircleSize: n("inner-circle-size"),
                     stateLayerSize: n("state-layer-size"), stateLayerColor: c("state-layer-color"), selectedStateLayerColor: c("selected-state-layer-color"))
    }
    static func matrixA(_ t: String) -> Double { t == "none" ? 1 : numbers(t).first ?? 1 }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, group = c["group"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.probe = c["focus"] != .null && c["focus"] != .bool(false)
        state.appearance = c["hooks"] == .null ? .init() : hooks(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : .init(stateLayerColor: "#C2185B", stateLayerOpacity: 0.2, outerColor: "#F57F17", outerFill: "#FFF59D", innerColor: "#1A237E")
        var p: [String: AWCValue] = ["checked": .bool(c["checked"] == .bool(true))]
        if let d = c["density"].number, d != 0 { p["density"] = .number(d) }
        if c["state"].string == "disabled" { p["disabled"] = true }; if c["state"].string == "softDisabled" { p["softDisabled"] = true }
        if c["hidden"] == .bool(true) { p["hidden"] = true }
        if c["required"] == .bool(true) { p["required"] = true }
        state.node = .init(id: "radio", tag: "md-radio", properties: p)
        state.measurements = []; state.epoch += 1; pump(0.25)
        if state.probe {
            if let v = all(host).compactMap({ $0 as? AWCNativeButtonFocusView }).first(where: { $0.accessibilityIdentifier() == "radio" }) { _ = v.requestNativeFocus() }
            pump(0.15)
        }
        if c["report"] == .bool(true) {
            if !c["custom"].string.isEmpty { radioPaintController.setCustomValidity(c["custom"].string) }
            check(radioPaintController.isConnected, "\(name) controller attached")
            check(!radioPaintController.reportValidity(), "\(name) reportValidity() is false")
            check(radioPaintController.getValidity().validationMessage == c["snap"]["support"]["text"].string, "\(name) validationMessage \(radioPaintController.getValidity().validationMessage)")
            pump(0.3)
        }
        let s = c["snap"], m = state.measurements.first { $0.name == "md-radio" }
        if c["hidden"] == .bool(true) { check(m == nil, "\(name) hidden radio renders nothing"); return }
        guard let m else { check(false, "\(name) measured"); return }
        let hb = m.bounds, mt = m.metrics, r = s["rect"]
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func num(_ k: String) -> Double { mt[k]?.number ?? .nan }
        near(hb.minX, r["x"].number!, "host x"); near(hb.minY, r["y"].number!, "host y"); near(hb.width, r["width"].number!, "host width"); near(hb.height, r["height"].number!, "host height", 1)
        let touch = num("touch"), t = s["target"]
        near(touch, t["width"].number!, "target size")
        let sl = num("stateLayerSize"), layer = s["stateLayer"], shown = layer["display"].string != "none"
        check(shown == (num("layerOpacity") >= 0), "\(name) state layer presence")
        if shown {
            near(hb.minX + (touch - sl) / 2, layer["rect"]["x"].number!, "state layer x"); near(sl, layer["rect"]["width"].number!, "state layer size")
            check(abs(num("layerOpacity") - layer["opacity"].number!) < 0.004, "\(name) state layer opacity \(num("layerOpacity")) vs \(layer["opacity"].number!)")
            check(colorClose(mt["layerColor"], layer["bg"].string), "\(name) state layer colour")
        }
        let outer = s["outer"], ic = num("iconSize")
        near(hb.minX + num("containerX"), outer["rect"]["x"].number!, "container x"); near(hb.minY + num("containerX"), outer["rect"]["y"].number!, "container y"); near(ic, outer["rect"]["width"].number!, "icon size")
        near(2, px(outer["borderWidth"].string), "outer border width")
        check(colorClose(mt["outerColor"], outer["border"].string), "\(name) outer colour \(String(describing: mt["outerColor"])) vs \(outer["border"].string)")
        check(colorClose(mt["outerFill"], outer["bg"].string), "\(name) outer fill \(String(describing: mt["outerFill"])) vs \(outer["bg"].string)")
        let inner = s["inner"], webScale = matrixA(inner["transform"].string)
        check(abs(num("innerScale") - webScale) < 0.001, "\(name) inner scale \(num("innerScale")) vs \(webScale)")
        if webScale > 0 { near(num("innerSize") * webScale, inner["rect"]["width"].number!, "inner size")
            check(colorClose(mt["innerColor"], inner["bg"].string), "\(name) inner colour \(String(describing: mt["innerColor"])) vs \(inner["bg"].string)") }
        check((mt["focusRing"]?.bool ?? false) == s["ring"]["outline"].string.hasPrefix("solid"), "\(name) focus ring")
        check(num("tabindex") == Double(s["tabindex"].string)!, "\(name) tabindex \(num("tabindex")) vs \(s["tabindex"].string)")
        let support = s["support"]
        if support == .null || support["text"].string.isEmpty { check((mt["support"]?.string ?? "") == "", "\(name) no supporting line") } else {
            check(mt["support"]?.string == support["text"].string, "\(name) support text \(mt["support"]?.string ?? "") vs \(support["text"].string)")
            near(num("supportY"), support["rect"]["y"].number!, "support y", 1)
            if c["dir"].string != "rtl" { near(num("supportX"), support["rect"]["x"].number!, "support x", 1) }
            else { near(num("supportX") + num("supportWidth"), support["rect"]["x"].number! + support["rect"]["width"].number!, "support inline start (right)", 1) }
        }
        // Paint: every flat CSS pixel of the source clip (glyph and text edges excluded in either image).
        // Chrome clamps a clip that leaves the viewport (RTL supporting text overflowing left) to x ≥ 0.
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
        if let dir = ProcessInfo.processInfo.environment["AWC_RADIO_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: RadioPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("radio-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_RADIO_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("radio-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_RADIO_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "skipped": skipped, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Radio native paint: \(checks - failures.count)/\(checks) checks passed (\(skipped.count) skipped)")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
