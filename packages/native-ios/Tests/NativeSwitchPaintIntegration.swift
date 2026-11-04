import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-switch paint and geometry against Chrome (switch/paint.html, DPR 1): 360-case matrix (theme × direction ×
// density × selected × icon mode × rest/disabled/soft-disabled), all 12 hooks, each hook alone, the four parts,
// icon slots, focus ring and hidden. Every part box, computed color and every flat pixel of the clip is compared.
@Observable final class SwitchPaintFixtureState {
    var node = AWCNode(id: "switch", tag: "md-switch")
    var epoch = 0
    var dark = false
    var rtl = false
    var appearance = AWCSwitchAppearance()
    var parts = AWCSwitchPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
/// reportValidity()/setCustomValidity() for the validation cases (the native method controller).
let switchPaintController = AWCSelectionControlController()
struct SwitchPaintFixture: View {
    let state: SwitchPaintFixtureState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCNativeView(node: state.node).awcSelectionControlController(switchPaintController)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .awcSwitchAppearance(state.appearance).awcSwitchPartAppearance(state.parts)
            .awcSelectionReducedMotion(true)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "switch", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 40).padding(.top, 40)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct SwitchGrid {
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
@main @MainActor enum NativeSwitchPaintIntegration {
    static let state = SwitchPaintFixtureState()
    static var host: NSHostingView<SwitchPaintFixture>!, window: NSWindow!
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
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> SwitchGrid {
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
    static func hooks(_ v: AWCValue) -> AWCSwitchAppearance {
        guard case .object(let o) = v else { return .init() }
        func n(_ k: String) -> Double? { o[k].map { px($0.string) } }
        func c(_ k: String) -> String? { o[k]?.string }
        return .init(trackWidth: n("track-width"), trackHeight: n("track-height"), handleSize: n("handle-size"), trackColor: c("track-color"),
                     trackOutlineColor: c("track-outline-color"), handleColor: c("handle-color"), selectedTrackColor: c("selected-track-color"),
                     selectedHandleColor: c("selected-handle-color"), iconColor: c("icon-color"), selectedIconColor: c("selected-icon-color"),
                     stateLayerColor: c("state-layer-color"), focusRingColor: c("focus-ring-color"))
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, group = c["group"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        state.appearance = c["hooks"] == .null ? .init() : hooks(c["hooks"])
        state.parts = c["parts"] == .null ? .init() : .init(trackColor: "#FFF59D", trackOutlineColor: "#F57F17", trackShape: .points(6), handleColor: "#33691E", handleShape: .points(3), handleOpacity: 0.8, iconColor: "#FFEB3B", stateLayerColor: "#C2185B")
        var p: [String: AWCValue] = ["selected": .bool(c["selected"] == .bool(true))]
        if let d = c["density"].number, d != 0 { p["density"] = .number(d) }
        if c["icons"].string == "icons" { p["icons"] = true }; if c["icons"].string == "selectedOnly" { p["showOnlySelectedIcon"] = true }
        if c["state"].string == "disabled" { p["disabled"] = true }; if c["state"].string == "softDisabled" { p["softDisabled"] = true }
        if c["hidden"] == .bool(true) { p["hidden"] = true }
        let slots = group == "slots" ? [AWCNode.slotText("", slot: "selected-icon"), AWCNode.slotText("", slot: "unselected-icon")] : []
        if c["required"] == .bool(true) { p["required"] = true }
        state.node = .init(id: "switch", tag: "md-switch", properties: p, children: slots)
        state.measurements = []; state.epoch += 1; pump(0.25)
        if c["focus"] == .bool(true) {
            if let v = all(host).compactMap({ $0 as? AWCNativeButtonFocusView }).first(where: { $0.accessibilityIdentifier() == "switch" }) { _ = v.requestNativeFocus() }
            pump(0.15)
        }
        if c["report"] == .bool(true) {
            if !c["custom"].string.isEmpty { switchPaintController.setCustomValidity(c["custom"].string) }
            check(switchPaintController.isConnected, "\(name) controller attached")
            check(!switchPaintController.reportValidity(), "\(name) reportValidity() is false")
            check(switchPaintController.getValidity().validationMessage == c["snap"]["support"]["text"].string, "\(name) validationMessage \(switchPaintController.getValidity().validationMessage)")
            pump(0.3)
        }
        let s = c["snap"], m = state.measurements.first { $0.name == "md-switch" }
        if c["hidden"] == .bool(true) { check(m == nil, "\(name) hidden switch renders nothing"); return }
        guard let m else { check(false, "\(name) measured"); return }
        let hb = m.bounds, mt = m.metrics, r = s["rect"]
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        near(hb.minX, r["x"].number!, "host x"); near(hb.minY, r["y"].number!, "host y"); near(hb.width, r["width"].number!, "host width"); near(hb.height, r["height"].number!, "host height")
        let tw = mt["trackWidth"]!.number!, th = mt["trackHeight"]!.number!, hh = mt["hostHeight"]!.number!, t = s["track"]["rect"]
        near(hb.minX, t["x"].number!, "track x"); near(hb.minY + (hh - th) / 2, t["y"].number!, "track y"); near(tw, t["width"].number!, "track width"); near(th, t["height"].number!, "track height")
        let cx = hb.minX + mt["containerX"]!.number!, cy = hb.minY + mt["containerY"]!.number!, sl = mt["layerSize"]!.number!, k = s["container"]
        near(cx, k["x"].number!, "container x"); near(cy, k["y"].number!, "container y"); near(sl, k["width"].number!, "container size")
        let hs = mt["handleSize"]!.number!, hr = s["handle"]["rect"]
        near(hs, hr["width"].number!, "handle size"); near(cx + sl / 2 - hs / 2, hr["x"].number!, "handle x"); near(cy + sl / 2 - hs / 2, hr["y"].number!, "handle y")
        check(colorClose(mt["trackColor"], s["track"]["bg"].string), "\(name) track color \(String(describing: mt["trackColor"])) vs \(s["track"]["bg"].string)")
        check(colorClose(mt["outlineColor"], s["track"]["border"].string), "\(name) track outline \(String(describing: mt["outlineColor"])) vs \(s["track"]["border"].string)")
        check(colorClose(mt["handleColor"], s["handle"]["bg"].string), "\(name) handle color \(String(describing: mt["handleColor"])) vs \(s["handle"]["bg"].string)")
        let layerShown = s["stateLayer"]["display"].string != "none"
        check(layerShown == (mt["layerOpacity"]!.number! >= 0), "\(name) state layer presence")
        if layerShown {
            check(abs(mt["layerOpacity"]!.number! - s["stateLayer"]["opacity"].number!) < 0.004, "\(name) state layer opacity \(mt["layerOpacity"]!.number!) vs \(s["stateLayer"]["opacity"].number!)")
            check(colorClose(mt["layerColor"], s["stateLayer"]["bg"].string), "\(name) state layer color")
        }
        let webIcon = s["icon"]["text"].string, webSlot = !s["slotted"].array.isEmpty
        let nativeIcon = mt["icon"]!.string
        if webSlot { check(nativeIcon == "#slot", "\(name) slotted icon shown") }
        else if s["icon"] != .null && s["icon"]["rect"]["width"].number! > 0 {
            check(nativeIcon == webIcon, "\(name) icon \(nativeIcon) vs \(webIcon)")
            check(colorClose(mt["iconColor"], s["icon"]["color"].string), "\(name) icon color \(String(describing: mt["iconColor"])) vs \(s["icon"]["color"].string)")
        } else { check(nativeIcon.isEmpty, "\(name) no icon (\(nativeIcon))") }
        check((mt["focusRing"]?.bool ?? false) == s["track"]["outline"].string.hasPrefix("solid"), "\(name) focus ring")
        check(mt["tabindex"]!.number! == Double(s["tabindex"].string)!, "\(name) tabindex \(mt["tabindex"]!.number!) vs \(s["tabindex"].string)")
        // Paint: every flat CSS pixel of the source clip (glyph edges excluded in either image).
        let clip = c["clip"], x0 = Int(clip["x"].number!), cxp = max(0, x0), cyp = Int(clip["y"].number!), cw = Int(clip["width"].number!) - (cxp - x0), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cxp, y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        let slotBoxes = s["slotted"].array.map { a in CGRect(x: a["rect"]["x"].number! - 1, y: a["rect"]["y"].number! - 1, width: 18, height: 18) }
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) && !slotBoxes.contains(where: { $0.contains(CGPoint(x: pxx, y: py)) }) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        let coverage = Double(n) / Double(max(1, (cw - 2) * (ch - 2)))
        check(coverage > 0.55, "\(name) flat coverage \(coverage)")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_SWITCH_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        if let v = all(host).compactMap({ $0 as? AWCNativeButtonFocusView }).first(where: { $0.accessibilityIdentifier() == "switch" }) { _ = window.makeFirstResponder(nil); _ = v }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SwitchPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("switch-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_SWITCH_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("switch-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_SWITCH_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "skipped": skipped, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Switch native paint: \(checks - failures.count)/\(checks) checks passed (\(skipped.count) skipped)")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
