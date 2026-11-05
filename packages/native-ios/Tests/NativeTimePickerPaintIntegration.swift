import AppKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
import Observation
@testable import AWCUI

// md-time-picker paint and geometry against Chrome 153 (Mac capture of tp-paint.html, DPR 1, 96 cases): the trigger (12h / 24h
// × empty / value, dark, RTL, error, supporting, disabled, required, reserve-space, label, density −1…−4), the dial dialog
// (12h / 24h × theme × direction, inner ring, AM, empty, horizontal period, minute step, min / max, headline, translated
// labels, densities, landscape, the responsive policy on two viewports), the input dialog, every hook alone and together, the
// undocumented aliases. Checks the host, every part box (dial numbers by text, the rotated hand's box), the tiles' values,
// the focused part and every flat pixel of the clip.
@Observable final class TimePickerPaintState {
    var node = AWCNode(id: "tp", tag: "md-time-picker")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 360.0
    var origin = CGPoint(x: 24, y: 24)
    var appearance = AWCTimePickerAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
struct TimePickerPaintFixture: View {
    let state: TimePickerPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope {
            ZStack(alignment: .topLeading) {
                AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading)
                    .fixedSize()
                    .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                    // The page positions the host (its rect in the oracle) in physical coordinates.
                    .padding(.leading, state.origin.x).padding(.top, state.origin.y)
                    .environment(\.layoutDirection, .leftToRight)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .awcTimePickerAppearance(state.appearance).awcReducedMotion(false)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "tp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct TPGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flatMask(_ limit: Double) -> [Bool] {
        var out = [Bool](repeating: false, count: w * h)
        guard w > 2 && h > 2 else { return out }
        values.withUnsafeBufferPointer { v in out.withUnsafeMutableBufferPointer { o in
            for yy in 1..<(h - 1) { for xx in 1..<(w - 1) {
                var ok = true, c = 0
                while ok && c < 3 {
                    var lo = 999.0, hi = -1.0, dy = -1
                    while dy <= 1 { let row = (yy + dy) * w; var dx = -1
                        while dx <= 1 { let q = v[(row + xx + dx) * 3 + c]; if q < lo { lo = q }; if q > hi { hi = q }; dx += 1 }
                        dy += 1 }
                    if hi - lo > limit { ok = false }; c += 1
                }
                o[yy * w + xx] = ok } }
        } }
        return out
    }
}
@main @MainActor enum NativeTimePickerPaintIntegration {
    /// Box tolerance (pt). Chrome lays out in 1/64 px; SwiftUI snaps every box to the device pixel grid. On a 2x UIKit screen
    /// (iPad) that grid is 0.5 pt and the snapping of the dialog's stacked rows accumulates to 0.81 pt (fi-721): 0.85 there.
    #if canImport(UIKit)
    static let snapTolerance: Double = UIScreen.main.scale < 2.5 ? 0.85 : 0.6
    #else
    static let snapTolerance = 0.6
    #endif
    static let state = TimePickerPaintState()
    static var host: NSHostingView<TimePickerPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            var n = 0
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e); n += 1; if n > 2000 { break } }
            host.layoutSubtreeIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        } while Date() < end
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> TPGrid {
        let k = max(1, Int(s.scale.rounded()))
        let crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let n = Double(k * k), cw = cg.width
        buffer.withUnsafeBufferPointer { b in values.withUnsafeMutableBufferPointer { out in
            for py in 0..<h { for px in 0..<w { var s0 = 0.0, s1 = 0.0, s2 = 0.0, yy = py * k
                while yy < py * k + k { var xx = px * k
                    while xx < px * k + k { let i = (yy * cw + xx) * 4; s0 += Double(b[i]); s1 += Double(b[i + 1]); s2 += Double(b[i + 2]); xx += 1 }
                    yy += 1 }
                let o = (py * w + px) * 3; out[o] = s0 / n; out[o + 1] = s1 / n; out[o + 2] = s2 / n } }
        } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    static var runtime: AWCTimePickerRuntime? { AWCTimePickerRuntime.mounted["tp"]?.runtime }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, started = Date()
        print("case \(name)"); fflush(stdout)
        defer { print("  \(name) \(Int(Date().timeIntervalSince(started) * 1000)) ms"); fflush(stdout) }
        let vp = c["viewport"].array.map { $0.number ?? 0 }
        let size = NSSize(width: vp.count == 2 ? vp[0] : 1200, height: vp.count == 2 ? vp[1] : 900)
        if window.contentView?.frame.size != size { window.setContentSize(size); host.frame = NSRect(origin: .zero, size: size) }
        let h = c["host"]
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = h["width"].number ?? 240
        state.origin = CGPoint(x: h["x"].number ?? 24, y: h["y"].number ?? 24)
        var hooks: [String: String] = [:]; if case .object(let o) = c["hooks"] { for (k, v) in o { hooks[k] = v.string } }
        state.appearance = AWCTimePickerAppearance(hooks)
        var props: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { props = o }
        let open = props["open"]?.bool == true
        state.node = AWCNode(id: "tp", tag: "md-time-picker", properties: props)
        state.measurements = []; state.epoch += 1; pump(open ? 0.9 : 0.35)
        if c["active"].string.hasSuffix("input-hour") && name == "input-hour-focused" { _ = runtime?.input("input-hour").focus(); pump(0.2) }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = snapTolerance) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ r: AWCValue, _ label: String, tol: Double = snapTolerance) {
            guard r != .null else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol); near(b.minY, r["y"].number!, "\(label) y", tol)
            near(b.width, r["width"].number!, "\(label) width", tol); near(b.height, r["height"].number!, "\(label) height", tol)
        }
        guard let root = m("md-time-picker") else { check(false, "\(name) measured"); return }
        near(root.bounds.minX, h["x"].number!, "host x"); near(root.bounds.minY, h["y"].number!, "host y")
        near(root.bounds.width, h["width"].number!, "host width"); near(root.bounds.height, h["height"].number!, "host height")
        let direct: Set<String> = ["scrim", "dialog", "headline", "body", "input-area", "input-hour", "input-minute", "footer", "toggle-mode", "actions",
                                   "cancel-button", "confirm-button", "period-toggle", "period-am", "period-pm", "time-area", "dial-wrap", "dial"]
        for e in c["elements"].array {
            let key = e["key"].string
            switch key {
            case _ where direct.contains(key): rect(m(key), e["rect"], key)
            case "trigger": rect(m("md-text-field"), e["rect"], key)
            case "trigger-icon":
                // The field's leading-icon part is the slot (glyph + its padding); Chrome's rect is the slotted glyph (a square
                // of the icon size at the slot's leading edge).
                if let n = m("leading-icon") {
                    let b = n.bounds, side = b.height
                    let glyph = CGRect(x: state.rtl ? b.maxX - side : b.minX, y: b.minY, width: side, height: side)
                    rect(AWCNativeInspectionNode(id: n.id, name: n.name, parentId: n.parentId, bounds: glyph, metrics: n.metrics), e["rect"], key)
                } else { rect(nil, e["rect"], key) }
            case "trigger/container": rect(m("container"), e["rect"], key)
            // md-ripple reports an empty box in Chrome (its surface is drawn by the host); the native ripple is the button's.
            case "period-am-ripple", "period-pm-ripple": continue
            case "dial-number":
                let text = e["text"].string
                let n = ms.first { $0.name == "dial-number" && $0.metrics["text"]?.string == text }
                rect(n, e["rect"], "dial-number \(text)", tol: max(0.8, snapTolerance))
                if let n { check((n.metrics["active"]?.bool ?? false) == e["cls"].string.contains("--active"), "\(name) dial-number \(text) active") }
            case "dial-hand":
                // A zero-width bar from the dial centre (radius long) rotated about its foot: Chrome's box is the segment's.
                guard let dial = m("dial"), let hand = m("dial-hand"), let deg = hand.metrics["angle"]?.number else { check(false, "\(name) dial-hand missing"); continue }
                let a = deg * .pi / 180, r = dial.bounds.height / 2, cx = dial.bounds.midX, cy = dial.bounds.midY
                let tx = cx + r * sin(a), ty = cy - r * cos(a)
                let box = CGRect(x: min(cx, tx), y: min(cy, ty), width: abs(tx - cx), height: abs(ty - cy))
                rect(AWCNativeInspectionNode(id: hand.id, name: hand.name, parentId: hand.parentId, bounds: box, metrics: hand.metrics), e["rect"], key, tol: max(0.8, snapTolerance))
            case "value-input-hour", "value-input-minute":
                let n = m(String(key.dropFirst(6)))
                check(n?.metrics["value"]?.string == e["value"].string, "\(name) \(key) \(n?.metrics["value"]?.string ?? "-") vs \(e["value"].string)")
            default: continue
            }
        }
        // The focused part (Chrome's active element).
        let active = c["active"].string, focused = runtime?.focused
        let expected = active == "body" ? nil : active.components(separatedBy: " > ").last
        check(focused == expected, "\(name) focus \(focused ?? "body") vs \(expected ?? "body")")
        // Pixels.
        let clip = c["clip"], cxp = Int(clip["x"].number!), cyp = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cxp, y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = "", worstPixel = (0, 0)
        let wf = web.flatMask(6), nf = nat.flatMask(6)
        // A focused tile's text is selected on open (`select()`): the selection highlight is the platform's (Chrome on macOS
        // #AAC9FE; AppKit / UIKit / Android their own), not a component style, so the tile's text box is not compared there.
        let mask: CGRect? = expected.flatMap { e in e.hasPrefix("input-") ? m(e)?.bounds.insetBy(dx: 16, dy: 4).insetBy(dx: -2, dy: -2) : nil }
        web.values.withUnsafeBufferPointer { wv in nat.values.withUnsafeBufferPointer { nv in
            for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) {
                let j = (py - cyp) * cw + (pxx - cxp); guard wf[j] && nf[j] else { continue }
                if let mask, mask.contains(CGPoint(x: Double(pxx) + 0.5, y: Double(py) + 0.5)) { continue }
                let i = j * 3, d = max(abs(wv[i] - nv[i]), abs(wv[i + 1] - nv[i + 1]), abs(wv[i + 2] - nv[i + 2]))
                n += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstPixel = (pxx, py) } } }
        } }
        if worst > 0 { worstAt = "(\(worstPixel.0),\(worstPixel.1)) web \(web.at(worstPixel.0, worstPixel.1).map { Int($0) }) native \(nat.at(worstPixel.0, worstPixel.1).map { Int($0.rounded()) })" }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage \(n)")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = env["AWC_TP_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        // Close before the next case (the next epoch rebuilds the view).
        runtime?.hide(); pump(0.05); _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: TimePickerPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("timepicker-web-paint.json")))
        let only = env["AWC_TP_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("timepicker-web-paint")) }
        if let output = env["AWC_TP_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Time picker native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
