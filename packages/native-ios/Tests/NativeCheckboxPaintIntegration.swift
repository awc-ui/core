import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-checkbox paint and geometry against Chrome (checkbox/paint.html, DPR 1): the 180-case matrix (theme × direction ×
// density × unchecked/checked/indeterminate × rest/disabled/soft-disabled), error and error text, supporting text, all 14
// hooks, each hook alone, the five parts, keyboard focus (ring), decorative and hidden. Every part box, computed colour,
// the glyph, the supporting line and every flat pixel of the clip is compared.
@Observable final class CheckboxPaintFixtureState {
    var node = AWCNode(id: "checkbox", tag: "md-checkbox")
    var epoch = 0
    var dark = false
    var rtl = false
    var probe = false
    var appearance = AWCCheckboxAppearance()
    var parts = AWCCheckboxPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
/// reportValidity()/setCustomValidity() for the validation cases (the native method controller).
let checkboxPaintController = AWCSelectionControlController()
struct CheckboxPaintFixture: View {
    let state: CheckboxPaintFixtureState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        HStack(alignment: .center, spacing: 24) {
            if state.probe { Color.clear.frame(width: 60, height: 32) }
            AWCNativeView(node: state.node).awcSelectionControlController(checkboxPaintController).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .awcCheckboxAppearance(state.appearance).awcCheckboxPartAppearance(state.parts)
            .awcSelectionReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "checkbox", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 40).padding(.top, 40)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct CheckboxGrid {
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
@main @MainActor enum NativeCheckboxPaintIntegration {
    static let state = CheckboxPaintFixtureState()
    static var host: NSHostingView<CheckboxPaintFixture>!, window: NSWindow!
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
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> CheckboxGrid {
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
    static func hooks(_ v: AWCValue) -> AWCCheckboxAppearance {
        guard case .object(let o) = v else { return .init() }
        func n(_ k: String) -> Double? { o[k].map { px($0.string) } }; func c(_ k: String) -> String? { o[k]?.string }
        return .init(containerColor: c("container-color"), containerShape: n("container-shape").map { .points($0) }, containerSize: n("container-size"),
                     selectedContainerColor: c("selected-container-color"), outlineColor: c("outline-color"), outlineWidth: n("outline-width"), iconColor: c("icon-color"),
                     iconSize: n("icon-size"), stateLayerColor: c("state-layer-color"), selectedStateLayerColor: c("selected-state-layer-color"), stateLayerSize: n("state-layer-size"),
                     touchTargetSize: n("touch-target-size"), supportingTextColor: c("supporting-text-color"), errorTextColor: c("error-text-color"))
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, group = c["group"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.probe = c["focus"] == .bool(true)
        state.appearance = c["hooks"] == .null ? .init() : hooks(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : .init(targetColor: "#FFF8E1", stateLayerColor: "#C2185B", stateLayerOpacity: 0.2, containerColor: "#FFF59D",
                                                           containerOutlineColor: "#F57F17", containerShape: .points(5), iconColor: "#1A237E", supportingTextColor: "#4A148C")
        var p: [String: AWCValue] = ["checked": .bool(c["value"].string == "checked"), "indeterminate": .bool(c["value"].string == "indeterminate")]
        if let d = c["density"].number, d != 0 { p["density"] = .number(d) }
        if c["state"].string == "disabled" { p["disabled"] = true }; if c["state"].string == "softDisabled" { p["softDisabled"] = true }
        if c["error"] == .bool(true) { p["error"] = true }
        for k in ["errorText", "supportingText"] where !c[k].string.isEmpty { p[k] = .string(c[k].string) }
        if c["decorative"] == .bool(true) { p["ariaHidden"] = "true" }
        if c["hidden"] == .bool(true) { p["hidden"] = true }
        if c["required"] == .bool(true) { p["required"] = true }
        state.node = .init(id: "checkbox", tag: "md-checkbox", properties: p)
        state.measurements = []; state.epoch += 1; pump(0.25)
        if c["focus"] == .bool(true) {
            if let v = all(host).compactMap({ $0 as? AWCNativeButtonFocusView }).first(where: { $0.accessibilityIdentifier() == "checkbox" }) { _ = v.requestNativeFocus() }
            pump(0.15)
        }
        if c["report"] == .bool(true) {
            if !c["custom"].string.isEmpty { checkboxPaintController.setCustomValidity(c["custom"].string) }
            check(checkboxPaintController.isConnected, "\(name) controller attached")
            check(!checkboxPaintController.reportValidity(), "\(name) reportValidity() is false")
            check(checkboxPaintController.getValidity().validationMessage == c["snap"]["support"]["text"].string, "\(name) validationMessage \(checkboxPaintController.getValidity().validationMessage)")
            pump(0.3)
        }
        let s = c["snap"], m = state.measurements.first { $0.name == "md-checkbox" }
        if c["hidden"] == .bool(true) { check(m == nil, "\(name) hidden checkbox renders nothing"); return }
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
        let box = s["container"], cs = num("containerSize")
        near(hb.minX + num("containerX"), box["rect"]["x"].number!, "container x"); near(hb.minY + num("containerX"), box["rect"]["y"].number!, "container y"); near(cs, box["rect"]["width"].number!, "container size")
        near(num("outlineWidth"), px(box["borderWidth"].string), "outline width")
        check(colorClose(mt["containerColor"], box["bg"].string), "\(name) container colour \(String(describing: mt["containerColor"])) vs \(box["bg"].string)")
        check(colorClose(mt["outlineColor"], box["border"].string), "\(name) outline colour \(String(describing: mt["outlineColor"])) vs \(box["border"].string)")
        let icon = s["icon"]
        check(mt["glyph"]?.string == icon["text"].string, "\(name) glyph \(mt["glyph"]?.string ?? "") vs \(icon["text"].string)")
        check(num("iconOpacity") == Double(icon["opacity"].string), "\(name) icon opacity \(num("iconOpacity")) vs \(icon["opacity"].string)")
        near(num("iconSize"), px(icon["fontSize"].string), "icon size")
        if icon["opacity"].string != "0" { check(colorClose(mt["iconColor"], icon["color"].string), "\(name) icon colour \(String(describing: mt["iconColor"])) vs \(icon["color"].string)") }
        let support = s["support"]
        if support == .null { check(mt["support"]?.string == "", "\(name) no supporting line") } else {
            check(mt["support"]?.string == support["text"].string, "\(name) support text \(mt["support"]?.string ?? "") vs \(support["text"].string)")
            check(colorClose(mt["supportColor"], support["color"].string), "\(name) support colour")
            near(num("supportY"), support["rect"]["y"].number!, "support y", 1)
            if c["dir"].string != "rtl" { near(num("supportX"), support["rect"]["x"].number!, "support x", 1) }
            else { near(num("supportX") + num("supportWidth"), support["rect"]["x"].number! + support["rect"]["width"].number!, "support inline start (right)", 1) }
        }
        check((mt["focusRing"]?.bool ?? false) == s["outline"].string.hasPrefix("solid"), "\(name) focus ring")
        if s["outline"].string.hasPrefix("solid") { near(num("ringOffset"), px(s["outlineOffset"].string), "ring offset") }
        let tab = s["tabindex"] == .null ? -2 : Double(s["tabindex"].string)!
        check(num("tabindex") == tab, "\(name) tabindex \(num("tabindex")) vs \(tab)")
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
        if let dir = ProcessInfo.processInfo.environment["AWC_CHECKBOX_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: CheckboxPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("checkbox-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_CHECKBOX_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("checkbox-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_CHECKBOX_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "skipped": skipped, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Checkbox native paint: \(checks - failures.count)/\(checks) checks passed (\(skipped.count) skipped)")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
