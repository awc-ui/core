import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-color-picker paint and geometry against Chrome 153 (Mac capture of cp-paint.html, DPR 1, 165 cases): theme × direction
// × variant (inline, open popover) × 13 states, densities -1…-4 (local and an ancestor -3), keyboard focus on every part
// (real Tab walk), hover on plate / hue / preset / hex input, an invalid hex entry, every hook alone and together, a
// 240px cap, locales. Checks the host, panel, plate, sliders, tracks, preview, fields, inputs (box and value), presets
// (box incl. the selected scale) and every flat pixel of the clip.
@Observable final class ColorPickerPaintState {
    var node = AWCNode(id: "cp", tag: "md-color-picker")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 340.0
    var globalDensity: Double? = nil
    var appearance = AWCColorPickerAppearance()
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
}
struct ColorPickerPaintFixture: View {
    let state: ColorPickerPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        ZStack(alignment: .topLeading) {
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 1000, y: 10)
            AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading)
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 24).padding(.top, 24)
        }
            .environment(\.awcNativeDensity, state.globalDensity ?? 0).environment(\.awcNativeSpacingRung, state.globalDensity ?? 0)
            .awcColorPickerAppearance(state.appearance).awcReducedMotion(false)
            .awcTheme(theme)
            .environment(\.awcNativePointerState, state.pointer)
            .awcNativeInspection(rootID: "cp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct CPGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    /// Flatness of every pixel (3×3 neighbourhood range ≤ limit in each channel), computed once per grid (the suite runs
    /// unoptimised: per-pixel arrays made a case take ~20 s).
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
@main @MainActor enum NativeColorPickerPaintIntegration {
    static let state = ColorPickerPaintState()
    static var host: NSHostingView<ColorPickerPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static var pumpTrace = false, keyChainLogged = false
    static func pump(_ duration: Double = 0.1) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            var n = 0
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) {
                NSApp.sendEvent(e); n += 1
                if n > 2000 { print("pump: event flood \(e)"); fflush(stdout); break }
            }
            if pumpTrace { print("  pump layout"); fflush(stdout) }
            host.layoutSubtreeIfNeeded()
            if pumpTrace { print("  pump runloop"); fflush(stdout) }
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        } while Date() < end
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> CPGrid {
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
    static func diff(_ a: [Double], _ b: [Double]) -> Double { var m = 0.0; for i in 0..<3 { m = max(m, abs(a[i] - b[i])) }; return m }
    static func px(_ s: String) -> Double? { s.hasSuffix("px") ? Double(s.dropLast(2)) : nil }
    static func appearance(_ h: AWCValue) -> AWCColorPickerAppearance {
        guard case .object(let o) = h else { return .init() }
        func l(_ k: String) -> Double? { o[k].flatMap { px($0.string) } }
        func c(_ k: String) -> String? { o[k]?.string }
        return .init(width: l("width"), plateHeight: l("plate-height"), radius: l("radius"), surfaceColor: c("surface-color"), onSurface: c("on-surface"),
                     outlineColor: c("outline-color"), outlineStrong: c("outline-strong"), thumbSize: l("thumb-size"), thumbBorder: c("thumb-border"),
                     presetSize: l("preset-size"), popoverElevation: c("popover-elevation"))
    }
    static func key(_ code: UInt16, _ chars: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!)
        }
    }
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!)
    }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? {
        func find(_ v: NSView) -> AWCNativeButtonFocusView? { if let f = v as? AWCNativeButtonFocusView, f.configuration?.id == id { return f }; for s in v.subviews { if let f = find(s) { return f } }; return nil }
        return find(host)
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, started = Date()
        print("case \(name)"); fflush(stdout)
        defer { print("  \(name) \(Int(Date().timeIntervalSince(started) * 1000)) ms"); fflush(stdout) }
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 340
        state.globalDensity = c["wrapperDensity"].number; state.appearance = appearance(c["hooks"])
        var props: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { props = o }
        let popover = props["variant"]?.string == "popover"
        state.node = AWCNode(id: "cp", tag: "md-color-picker", properties: props, children: popover ? [AWCNode(id: "trigger", tag: "md-button", properties: ["variant": "tonal"], children: [.text("Colour")], slot: "trigger")] : [])
        state.pointer.update(phase: .leave); state.measurements = []; state.epoch += 1; pump(0.45)
        if let target = c["focus"].string as String?, !target.isEmpty, c["focus"] != .null {
            // A real Tab walk from the element before the picker until the target part has focus.
            let part = target == "channel-r" ? "r" : target
            _ = focusView("before")?.requestNativeFocus(); pump(0.05)
            var n = 0
            while AWCColorPickerRuntime.mounted["cp"]?.runtime?.focused != part && n < 24 { key(48, "\t"); pump(0.03); n += 1 }
            check(AWCColorPickerRuntime.mounted["cp"]?.runtime?.focused == part, "\(name) Tab walk reaches \(part) (\(AWCColorPickerRuntime.mounted["cp"]?.runtime?.focused ?? "-"))")
            pump(0.4)
        }
        if let hover = c["hover"].string as String?, c["hover"] != .null {
            let sel = ["preset": "preset", "plate": "plate", "hue": "hue", "hex-input": "field-hex"][hover]!
            if let r = c["parts"].array.first(where: { $0["part"].string == sel })?["rect"] {
                var p = CGPoint(x: r["x"].number! + r["width"].number! / 2, y: r["y"].number! + r["height"].number! / 2)
                if hover == "hex-input", let i = c["inputs"].array.first?["rect"] { p = CGPoint(x: i["x"].number! + i["width"].number! / 2, y: i["y"].number! + i["height"].number! / 2) }
                state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p); pump(0.5)
            }
        }
        if c["typeHex"] != .null, let i = c["inputs"].array.first?["rect"] {
            let p = CGPoint(x: i["x"].number! + i["width"].number! / 2, y: i["y"].number! + i["height"].number! / 2)
            func trace(_ s: String) { print("  typeHex: " + s); fflush(stdout) }
            // AppKit text fields track a press in a nested event loop until the release arrives: queue the release first.
            trace("click")
            let up = NSEvent.mouseEvent(with: .leftMouseUp, location: host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil), modifierFlags: [],
                                        timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 0)!
            NSApp.postEvent(up, atStart: false); mouse(.leftMouseDown, p); pump(0.05); trace("select all"); AWCColorPickerRuntime.mounted["cp"]?.runtime?.input("hex").selectAll(); pump(0.02)
            // ANSI key codes (the iOS harness maps the code to the HID key, so each character needs its own).
            let codes: [Character: UInt16] = ["0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25,
                                              "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "z": 6, "g": 5, "x": 7]
            for ch in c["typeHex"].string { trace("key \(ch)"); pumpTrace = true; key(ch == "#" ? 20 : codes[Character(ch.lowercased())] ?? 18, String(ch), ch == "#" || ch.isUppercase ? .shift : []); trace("pump"); pump(0.02); pumpTrace = false }
            trace("settle"); pump(0.35); trace("done")
        }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ r: AWCValue, _ label: String, tol: Double = 0.6) {
            guard r != .null else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol); near(b.minY, r["y"].number!, "\(label) y", tol)
            near(b.width, r["width"].number!, "\(label) width", tol); near(b.height, r["height"].number!, "\(label) height", tol)
        }
        guard let root = m("md-color-picker") else { check(false, "\(name) measured"); return }
        let h = c["host"]
        near(root.bounds.minX, h["x"].number!, "host x"); near(root.bounds.minY, h["y"].number!, "host y")
        near(root.bounds.width, h["width"].number!, "host width"); near(root.bounds.height, h["height"].number!, "host height")
        var presetIndex = 0
        for p in c["parts"].array {
            let part = p["part"].string
            switch part {
            case "label", "thumb": continue
            case "preset":
                // Chrome reports the transformed box (selected scale 1.1, hover scale + rotation); the native frame is the layout
                // box, transformed here by the presented scale and angle.
                let id = "preset-\(presetIndex)"
                let mv = AWCColorPickerRuntime.mounted["cp"]?.runtime?.motion[id]?.last?.v ?? [1, 0]
                if let n = m(id) {
                    let k = mv[0] * (abs(cos(mv[1] * .pi / 180)) + abs(sin(mv[1] * .pi / 180))), b = n.bounds
                    let t = CGRect(x: b.midX - b.width * k / 2, y: b.midY - b.height * k / 2, width: b.width * k, height: b.height * k)
                    rect(AWCNativeInspectionNode(id: n.id, name: n.name, parentId: n.parentId, bounds: t, metrics: n.metrics), p["rect"], "preset \(presetIndex)", tol: 0.8)
                } else { rect(nil, p["rect"], "preset \(presetIndex)", tol: 0.8) }
                presetIndex += 1
            default: rect(m(part), p["rect"], part)
            }
        }
        let fieldIDs = ["field-hex": "hex", "field-r": "r", "field-g": "g", "field-b": "b", "field-a": "a", "field-h": "h", "field-s": "s", "field-l": "l"]
        let inputParts = c["parts"].array.filter { fieldIDs[$0["part"].string] != nil }.map { fieldIDs[$0["part"].string]! }
        for (i, input) in c["inputs"].array.filter({ $0["tag"].string == "input" }).enumerated() where i < inputParts.count {
            let id = inputParts[i], n = m("input-" + id)
            rect(n, input["rect"], "input \(id)")
            check(n?.metrics["value"]?.string == input["value"].string, "\(name) input \(id) value \(n?.metrics["value"]?.string ?? "-") vs \(input["value"].string)")
        }
        // Pixels.
        let clip = c["clip"], x0 = Int(clip["x"].number!), cxp = max(0, x0), cyp = Int(clip["y"].number!), cw = Int(clip["width"].number!) - (cxp - x0), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cxp, y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        let wf = web.flatMask(6), nf = nat.flatMask(6)
        // Gate-1 finding: `dir="rtl"` on the host alone keeps Chrome's layout and pointer mapping LTR (`:host { direction:
        // inherit }`) but flips the plate and slider gradients (`:host([dir="rtl"])` rules). Natives have no host-only direction;
        // the case renders consistently LTR, so its gradient areas are not compared.
        let masked = c["hostDir"].string == "rtl" ? ["plate", "hue", "alpha"].compactMap { m($0)?.bounds.insetBy(dx: -2, dy: -2) } : []
        var worstPixel = (0, 0)
        web.values.withUnsafeBufferPointer { wv in nat.values.withUnsafeBufferPointer { nv in
            for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) {
                let j = (py - cyp) * cw + (pxx - cxp); guard wf[j] && nf[j] else { continue }
                if !masked.isEmpty && masked.contains(where: { $0.contains(CGPoint(x: Double(pxx) + 0.5, y: Double(py) + 0.5)) }) { continue }
                let i = j * 3, d = max(abs(wv[i] - nv[i]), abs(wv[i + 1] - nv[i + 1]), abs(wv[i + 2] - nv[i + 2]))
                n += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstPixel = (pxx, py) } } }
        } }
        if worst > 0 { worstAt = "(\(worstPixel.0),\(worstPixel.1)) web \(web.at(worstPixel.0, worstPixel.1).map { Int($0) }) native \(nat.at(worstPixel.0, worstPixel.1).map { Int($0.rounded()) })" }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage \(n)")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = env["AWC_CP_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ColorPickerPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1100, height: 700), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("colorpicker-web-paint.json")))
        let only = env["AWC_CP_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("colorpicker-web-paint")) }
        if let output = env["AWC_CP_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Color picker native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
