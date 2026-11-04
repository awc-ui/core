import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-button interaction against Chrome 153 trusted-input records (md-button/web-reference/states.html and the
// reduced-motion set): pointer hover/press/release/leave and click on every variant, toggles (shape morph on/off,
// square), sizes, keyboard Tab/Enter/Space/Tab-away, hard and soft disabled, loading, links (pointer and keyboard),
// all hooks, RTL and dark. Checked per phase: events (mdClick/mdChange order, detail, cancelable), focus, and every flat
// pixel of Chrome's phase screenshot against the native frames inside Chrome's recorded capture window
// [shotStart, shotEnd] (a transition running across the capture is compared at the moments Chrome could have
// photographed). The default loader's box is masked (it spins in both).
@Observable final class ButtonStatesFixtureState {
    var run: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double)] = []
    let pointer = AWCNativePointerState()
}
struct ButtonStatesFixture: View {
    let state: ButtonStatesFixtureState
    static let hooks = AWCButtonAppearance(containerColor: "#22556699", labelColor: "#C62828", iconColor: "#2E7D32", trailingIconColor: "#6A1B9A", loadingColor: "#00897B",
        stateLayerColor: "#FF6F00", outlineColor: "#1565C0", iconSize: 22, trailingIconSize: 16, loadingSize: 18, fontSize: 15, fontWeight: 700, lineHeight: 22, letterSpacing: 0.5,
        cornerRadius: 6, outlineWidth: 3, paddingInline: 20, paddingBlock: 6, gap: 10, hoverOpacity: 0.2, focusOpacity: 0.24, pressedOpacity: 0.3, focusRingColor: "#D81B60",
        width: 200, minWidth: 120, maxWidth: 260, height: 48, minHeight: 44)
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark"), scenario = r["scenario"].string
        var props: [String: AWCValue] = [:]
        for k in ["variant", "size", "shape", "icon", "trailingIcon", "toggle", "shapeMorph", "loading", "href"] where r[k] != .null { props[k] = r[k] }
        if scenario == "disabled" { props["disabled"] = true }
        if scenario == "softDisabled" { props["softDisabled"] = true }
        let node = AWCNode(id: "button", tag: "md-button", properties: props, children: [.text(r["label"].string)])
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 1000, y: 10)
            AWCNativeView(node: node) { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000)) }
                .awcButtonAppearance(r["custom"] == .bool(true) ? Self.hooks : .init())
                .frame(width: 360, alignment: .topLeading)
                .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: 60, y: 60)
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 10, y: 860)
        }
        .awcReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "button", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeButtonStatesIntegration {
    static let state = ButtonStatesFixtureState()
    static var host: NSHostingView<ButtonStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_BUTTON_STATES_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func pump(_ duration: Double = 0.004) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) {
        let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
        window.sendEvent(e)
        window.sendEvent(NSEvent.keyEvent(with: .keyUp, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.configuration?.id == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id ?? "body" }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ButtonStateGrid {
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
    static func run(_ r: AWCValue, shotDir: URL, reduced: Bool) {
        let name = r["name"].string, scenario = r["scenario"].string, label = (reduced ? "reduced/" : "") + name
        state.reduced = reduced; state.run = r; state.pointer.update(phase: .leave); state.epoch += 1; pump(0.35)
        _ = window.makeFirstResponder(nil); state.events = []; pump(0.05)
        let rest = r["rest"], body = CGPoint(x: r["pointer"]["body"].array[0].number!, y: r["pointer"]["body"].array[1].number!), away = CGPoint(x: 1190, y: 600)
        if let f = state.measurements.first(where: { $0.id == "component" })?.bounds {
            check(abs(f.minX - rest["x"].number!) <= 1 && abs(f.minY - rest["y"].number!) <= 0.6 && abs(f.width - rest["width"].number!) <= 1 && abs(f.height - rest["height"].number!) <= 0.6, "\(label) rest box \(f) vs \(rest)")
        } else { check(false, "\(label) measured") }
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.mouseMoved, q) }
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        func leave() { hoverTo(away); state.pointer.update(phase: .leave) }
        let actions: [String: () -> Void] = [
            "hover": { hoverTo(body) }, "hover2": { hoverTo(body) }, "press": { down(body) }, "release": { up(body) }, "leave": { leave() }, "leave2": { leave() },
            "click2": { down(body); up(body) }, "tab": { key(48, "\t") }, "tabAway": { key(48, "\t") }, "enter": { key(36, "\r") }, "space": { key(49, " ") }]
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0, t0 = now()
        var snaps: [(Int, [(Double, Shot)], String)] = []
        let clip = r["clip"], clipRect = CGRect(x: clip["x"].number!, y: clip["y"].number!, width: clip["width"].number!, height: clip["height"].number!)
        for (i, phase) in phases.enumerated() {
            let lbl = phase["label"].string, start = phase["t"].number! - webT0
            if lbl == "tab" { leave(); _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            while now() - t0 < start { pump() }
            if lbl == "click2" {
                // Chrome's click is two trusted inputs: the wave starts on the frame after the press and the click event
                // follows the release. Press one frame before Chrome's wave start and release at its click time (a
                // same-turn down/up never shows SwiftUI's pressed state, so no wave would start).
                let t = phase["t"].number!
                let wave = r["anims"].array.first { $0["phase"].string == "click2" && $0["target"].string == "wave" && $0["startTime"] != .null }?["startTime"].number
                let click = r["events"].array.first { $0["name"].string == "mdClick" && ($0["t"].number ?? 0) >= t && ($0["t"].number ?? 0) <= t + 150 }?["t"].number
                let downAt = max(0, (wave ?? t + 16) - 16 - t), upAt = max(downAt + 4, (click ?? t + 20) - t)
                while now() - t0 < start + downAt { pump() }
                down(body)
                while now() - t0 < start + upAt { pump() }
                up(body)
            } else { actions[lbl]?() }
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! - webT0 : start + 500
            let shotStart = (phase["shotStart"].number ?? next + webT0) - webT0, shotEnd = min(next, (phase["shotEnd"].number ?? next + webT0) - webT0)
            let windowEnd = max(shotStart, min(shotEnd, next - (i + 1 < phases.count && phases[i + 1]["label"].string == "tab" ? 33 : 3)))
            // Chrome chains md-ripple's release fade on the grow animation's `finished` promise, which resolves on the first
            // frame at or after the 450 ms grow ends: depending on Chrome's frame phase the fade starts on time or one frame
            // late. The phase samples show which; the native fade starts exactly at the grow end, so its frames reach back by
            // that measured lag.
            var fadeLag = 0.0
            if let grow = r["anims"].array.first(where: { $0["phase"].string == lbl && $0["target"].string == "wave" && $0["startTime"] != .null }), let s = grow["startTime"].number {
                let growEnd = s + (grow["duration"].number ?? 450)
                if growEnd < (phase["shotStart"].number ?? .infinity), let t = phase["samples"].array.first(where: { ($0["t"].number ?? 0) >= growEnd })?["t"].number { fadeLag = min(17, max(0, t - growEnd)) }
            }
            var due = Array(stride(from: max(start, shotStart - 4 - fadeLag), through: windowEnd, by: 5.0)), shots: [(Double, Shot)] = []
            while now() - t0 < windowEnd {
                if let d = due.first, now() - t0 >= d { let at = now() - t0; shots.append((at + webT0, capture(clipRect))); due.removeAll { $0 <= at } }
                pump()
            }
            if shots.isEmpty { shots.append((now() - t0 + webT0, capture(clipRect))) }
            snaps.append((i, shots, focusedID()))
        }
        pump(0.15)
        // Events (DOM click entries excluded): names in order, mdClick/mdChange detail.selected, cancelable mdClick.
        let web = r["events"].array.filter { $0["name"].string != "click" }
        check(state.events.map(\.0) == web.map { $0["name"].string }, "\(label) events \(state.events.map(\.0)) vs \(web.map { $0["name"].string })")
        for (e, w) in zip(state.events, web) where w["detail"] != .null && w["detail"]["selected"] != .null {
            check(e.1["selected"] == w["detail"]["selected"], "\(label) \(e.0).selected \(e.1["selected"]) vs \(w["detail"]["selected"])")
        }
        // Phase focus and paint.
        let cx = Int(clipRect.minX), cy = Int(clipRect.minY), cw = Int(clipRect.width), ch = Int(clipRect.height)
        let loader = state.measurements.first { $0.id == "component.loader" }?.bounds
        for (i, shots, focused) in snaps {
            let ph = phases[i], lbl = ph["label"].string, webFocus = ph["snap"]["active"].string
            let nativeFocus = focused == "button" ? "button" : "other"
            check(nativeFocus == (webFocus == "button" || webFocus.hasPrefix("md-button__anchor") ? "button" : "other"), "\(label)/\(lbl) focus \(focused) vs \(webFocus)")
            guard let source = NSImage(contentsOf: shotDir.appendingPathComponent(name + "-" + lbl + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(label)/\(lbl) shot"); continue }
            let wg = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch)
            var best: (ok: Bool, n: Int, bad: Int, mean: Double, worstAt: String, at: Double, shot: Shot)? = nil
            for (at, shot) in shots {
                let ng = grid(shot, x: cx, y: cy, w: cw, h: ch)
                var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
                for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where wg.flat(px, py, 6) && ng.flat(px, py, 6) {
                    if let loader, loader.insetBy(dx: -2, dy: -2).contains(CGPoint(x: Double(px) + 0.5, y: Double(py) + 0.5)) { continue }
                    let a = wg.at(px, py), b = ng.at(px, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
                    n += 1; sum += d; if d > 6 { bad += 1 }; if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
                } }
                let mean = sum / Double(max(n, 1)), ok = n > 400 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0
                if best == nil || (ok && !best!.ok) || (ok == best!.ok && mean < best!.mean) { best = (ok, n, bad, mean, worstAt, at, shot) }
            }
            let b = best!
            check(b.ok, "\(label)/\(lbl) flat pixels match (mean \(b.mean), >6: \(b.bad)/\(b.n), \(b.worstAt); best of \(shots.count) frames in Chrome's capture window)")
            if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: b.shot.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(label.replacingOccurrences(of: "/", with: "-") + "-" + lbl + ".png")) }
            report.append(["case": "\(label)/\(lbl)", "compared": b.n, "mean": b.mean, "over6": b.bad, "worstAt": b.worstAt, "frame": b.at, "windowFrames": shots.count])
        }
        state.pointer.update(phase: .leave); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ButtonStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = env["AWC_BUTTON_STATES_ONLY"]
        for (file, reduced) in [("button-web-states", false), ("button-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, shotDir: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        if let output = env["AWC_BUTTON_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Button native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
struct ButtonStateGrid {
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
