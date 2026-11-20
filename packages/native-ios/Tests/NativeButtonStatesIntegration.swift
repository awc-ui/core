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
    #if os(iOS)
    /// iOS (gate-7 R1-01): Chrome photographs a phase on demand, at any moment of its animation clock, while the simulator
    /// draws only on its display frames; across a fast fade (click2's 150 ms wave release) Chrome's photo can fall between two
    /// native frames and match neither on a large surface. When two consecutive distinct native frames in Chrome's capture
    /// window straddle Chrome's image (one darker, one lighter over the compared pixels), the frame at Chrome's moment is their
    /// blend (1 - w)·A + w·B (a wave's opacity is linear in the composited pixel), and it must match under the same thresholds.
    /// Only adjacent native frames bracket (gate-7 R1-14: an 18.6 run blended frames 42.5 ms apart with captured frames missing
    /// between them): the first capture of the later frame follows the last capture of the earlier one within a display frame
    /// (+4 ms), or on the very next display tick when the display stalled (no frame was drawn in between; the BRACKET line
    /// reports the stall). AWC_BUTTON_STATES_BRACKET=0: off.
    static let bracketFallback = env["AWC_BUTTON_STATES_BRACKET"] != "0"
    /// iOS: native captures continue two display frames past Chrome's window end (gate-7 R1-01 on 18.6). A simulator capture
    /// shows the last committed frame, whose content is up to a frame (plus TimelineView's content offset, 2-9 ms) older than
    /// the capture, and captures come about a frame apart; so the frame showing Chrome's latest possible photo moment is
    /// captured up to two frames after it. AWC_BUTTON_STATES_WINDOW_EXTRA=<ms>: another extension (0: Chrome's window only).
    static let windowExtra = Double(env["AWC_BUTTON_STATES_WINDOW_EXTRA"] ?? "") ?? 2000.0 / 60
    static func bracket(_ web: ButtonStateGrid, _ frames: [(at: Double, grid: ButtonStateGrid)], ticks: [Double: Int], skip: (Int, Int) -> Bool, minCompared: Int)
        -> (ok: Bool, a: Double, b: Double, sa: Double, sb: Double, w: Double, mean: Double, bad: Int, n: Int)? {
        // A run of identical captures is one native frame, on screen from its first capture to its last (`ticks`: the display
        // frame of each capture).
        var distinct: [(at: Double, until: Double, grid: ButtonStateGrid)] = []
        for f in frames { if let last = distinct.last, zip(last.grid.values, f.grid.values).allSatisfy({ abs($0 - $1) < 0.5 }) { distinct[distinct.count - 1].until = f.at; continue }; distinct.append((f.at, f.at, f.grid)) }
        var best: (ok: Bool, a: Double, b: Double, sa: Double, sb: Double, w: Double, mean: Double, bad: Int, n: Int)? = nil
        for (fa, fb) in zip(distinct, distinct.dropFirst()) where fb.at - fa.until <= 1000.0 / 60 + 4 || (ticks[fb.at].flatMap { next in ticks[fa.until].map { next - $0 == 1 } } ?? false) {
            var pixels: [(Int, Int)] = [], sa = 0.0, sb = 0.0
            for py in (web.y + 1)..<(web.y + web.h - 1) { for px in (web.x + 1)..<(web.x + web.w - 1) where web.flat(px, py, 6) && fa.grid.flat(px, py, 6) && fb.grid.flat(px, py, 6) && !skip(px, py) {
                pixels.append((px, py)); let c0 = web.at(px, py), a = fa.grid.at(px, py), b = fb.grid.at(px, py)
                for c in 0..<3 { sa += a[c] - c0[c]; sb += b[c] - c0[c] }
            } }
            guard pixels.count > minCompared else { continue }
            sa /= Double(pixels.count * 3); sb /= Double(pixels.count * 3)
            guard sa * sb < 0 else { continue }
            for k in 1...19 {
                let w = Double(k) / 20; var bad = 0, sum = 0.0
                for (px, py) in pixels {
                    let c0 = web.at(px, py), a = fa.grid.at(px, py), b = fb.grid.at(px, py); var d = 0.0
                    for c in 0..<3 { d = max(d, abs((1 - w) * a[c] + w * b[c] - c0[c])) }
                    sum += d; if d > 6 { bad += 1 }
                }
                let mean = sum / Double(pixels.count), ok = Double(bad) / Double(pixels.count) <= 0.005 && mean <= 1.0
                if best == nil || (ok && !best!.ok) || (ok == best!.ok && mean < best!.mean) { best = (ok, fa.until, fb.at, sa, sb, w, mean, bad, pixels.count) }
            }
        }
        return best
    }
    #endif
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
    #if os(iOS)
    /// iOS: a frame of the capture window, taken as a render-server snapshot view (about 2 ms) and drawn to pixels after the
    /// window. A hierarchy capture holds the main thread for a display frame or more (15-24 ms at 3x, fx-104), so SwiftUI's
    /// frame-driven content skipped frames under it and a window on a loaded host held every second or third native frame.
    /// The snapshot drawn later has the pixels of a direct capture of that moment (fx-104: identical on iOS 26.3 and 18.6;
    /// checked once per process in `run`).
    static var framesVerified = false
    static func takeFrame(_ r: CGRect) -> UIView? { host.snapshotView(afterScreenUpdates: false) }
    /// S921-01: the snapshot is the whole host, placed in a clipping box at -r.origin. A resizable snapshot cut out of the host
    /// (`resizableSnapshotView(from:)`) is re-composited by the render server on an iPad (scale 2) with one edge pixel rounded
    /// differently from a direct capture (alpha 193 vs 194); the full-host snapshot drawn through a clipping box is bit-identical.
    static func develop(_ frame: UIView, _ r: CGRect) -> Shot? {
        let full = frame.bounds.size, rect = CGRect(origin: .zero, size: r.size)
        let box = UIView(frame: rect); box.clipsToBounds = true; box.backgroundColor = .white
        frame.frame = CGRect(x: -r.minX , y: -r.minY, width: full.width, height: full.height); box.addSubview(frame)
        window.addSubview(box); defer { box.removeFromSuperview(); frame.removeFromSuperview() }
        CATransaction.flush(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02))
        let format = UIGraphicsImageRendererFormat(); format.scale = window.screen.scale; format.opaque = true; format.preferredRange = .standard
        let image = UIGraphicsImageRenderer(size: r.size, format: format).image { _ in _ = box.drawHierarchy(in: rect, afterScreenUpdates: true) }
        return image.cgImage.map { Shot(cg: $0, scale: Double($0.width) / r.width, origin: r.origin) }
    }
    #endif
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
        let clip = r["clip"], clipRect = CGRect(x: clip["x"].number!, y: clip["y"].number!, width: clip["width"].number!, height: clip["height"].number!)
        #if os(iOS)
        // Once per process, on a run's rest state: a snapshot frame drawn later has the pixels of a direct capture.
        if !framesVerified, let frame = takeFrame(clipRect) {
            framesVerified = true
            let x = Int(clipRect.minX), y = Int(clipRect.minY), w = Int(clipRect.width), h = Int(clipRect.height)
            let direct = grid(capture(clipRect), x: x, y: y, w: w, h: h), late = develop(frame, clipRect).map { grid($0, x: x, y: y, w: w, h: h) }
            check(late.map { zip(direct.values, $0.values).allSatisfy { abs($0 - $1) < 0.01 } } ?? false, "iOS snapshot frame equals a direct capture (\(label) rest)")
            pump(0.035)
        }
        var shotTicks: [Double: Int] = [:]   // captured frame time -> its display frame
        #endif
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0, t0 = now()
        var snaps: [(Int, [(Double, Shot)], String)] = []
        for (i, phase) in phases.enumerated() {
            let lbl = phase["label"].string, start = phase["t"].number! - webT0
            if lbl == "tab" { leave(); _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            while now() - t0 < start { pump() }
            // The phase runs on its own clock: when it starts late because the previous window's captures overran (an iOS
            // hierarchy capture takes several ms), the press, release and capture window keep Chrome's distances from the
            // phase start (gate-7 R1-01). AWC_BUTTON_STATES_SHOT_ANCHOR=t0: the run clock, as before.
            let late = env["AWC_BUTTON_STATES_SHOT_ANCHOR"] == "t0" ? 0 : now() - t0 - start
            func clock() -> Double { now() - t0 - late }
            if lbl == "click2" {
                // Chrome's click is two trusted inputs: the wave starts on the frame after the press and the click event
                // follows the release. Press one frame before Chrome's wave start and release at its click time (a
                // same-turn down/up never shows SwiftUI's pressed state, so no wave would start).
                let t = phase["t"].number!
                let wave = r["anims"].array.first { $0["phase"].string == "click2" && $0["target"].string == "wave" && $0["startTime"] != .null }?["startTime"].number
                let click = r["events"].array.first { $0["name"].string == "mdClick" && ($0["t"].number ?? 0) >= t && ($0["t"].number ?? 0) <= t + 150 }?["t"].number
                let downAt = max(0, (wave ?? t + 16) - 16 - t), upAt = max(downAt + 4, (click ?? t + 20) - t)
                while clock() < start + downAt { pump() }
                down(body)
                while clock() < start + upAt { pump() }
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
            #if os(iOS)
            let captureEnd = windowEnd + windowExtra
            #else
            let captureEnd = windowEnd
            #endif
            var due = Array(stride(from: max(start, shotStart - 4 - fadeLag), through: captureEnd, by: 5.0)), shots: [(Double, Shot)] = []
            #if os(iOS)
            // One snapshot view per display frame, drawn after the window; two quiet frames follow the drawing (it adds and removes
            // views in the window), so the next phase's input meets an idle main thread. The phase clock absorbs both.
            var frames: [(Double, UIView)] = [], lastFrame = -1
            while clock() < captureEnd {
                if let d = due.first, clock() >= d, AWCShimFrameClock.frames != lastFrame, let frame = takeFrame(clipRect) { let at = clock() + webT0; frames.append((at, frame)); lastFrame = AWCShimFrameClock.frames; shotTicks[at] = lastFrame }
                pump()
            }
            shots = frames.compactMap { item in develop(item.1, clipRect).map { (item.0, $0) } }
            if !frames.isEmpty { pump(0.035) }
            #else
            while clock() < captureEnd {
                if let d = due.first, clock() >= d { let at = clock(); shots.append((at + webT0, capture(clipRect))); due.removeAll { $0 <= at } }
                pump()
            }
            #endif
            if shots.isEmpty { shots.append((clock() + webT0, capture(clipRect))) }
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
            var matched = b.ok, between = ""
            #if os(iOS)
            if !b.ok, bracketFallback, shots.count > 1,
               let m = bracket(wg, shots.map { (at: $0.0, grid: grid($0.1, x: cx, y: cy, w: cw, h: ch)) }, ticks: shotTicks, skip: { px, py in loader.map { $0.insetBy(dx: -2, dy: -2).contains(CGPoint(x: Double(px) + 0.5, y: Double(py) + 0.5)) } ?? false }, minCompared: 400) {
                let stall = m.b - m.a > 1000.0 / 60 + 4 ? String(format: "; the display stalled %.0f ms between them (consecutive display frames)", m.b - m.a) : ""
                print(String(format: "BRACKET %@/%@ %@: Chrome's frame between native frames at web %.1f and %.1f (signed %.2f / %.2f), blend w %.2f: mean %.3f, >6: %ld/%ld (best single frame mean %.3f)", label, lbl, m.ok ? "match" : "no match", m.a, m.b, m.sa, m.sb, m.w, m.mean, m.bad, m.n, b.mean) + stall); fflush(stdout)
                if m.ok { matched = true; between = String(format: "; Chrome's frame between native frames at web %.1f and %.1f (blend w %.2f: mean %.3f, >6: %ld/%ld)", m.a, m.b, m.w, m.mean, m.bad, m.n) + stall }
            }
            #endif
            #if os(iOS)
            if !matched {
                var parts: [String] = [], last: ButtonStateGrid? = nil
                for (at, shot) in shots {
                    let ng = grid(shot, x: cx, y: cy, w: cw, h: ch)
                    if let l = last, zip(l.values, ng.values).allSatisfy({ abs($0 - $1) < 0.5 }) { parts.append(String(format: "%.1f=", at)); continue }
                    last = ng; var n = 0, sd = 0.0
                    for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where wg.flat(px, py, 6) && ng.flat(px, py, 6) {
                        let a = wg.at(px, py), b = ng.at(px, py); n += 1; for k in 0..<3 { sd += b[k] - a[k] } } }
                    parts.append(String(format: "%.1f:%+.2f", at, sd / Double(max(1, n * 3))))
                }
                print("FRAMES \(label)/\(lbl) native-minus-Chrome per window frame (web time: signed mean; = repeats): \(parts.joined(separator: " "))"); fflush(stdout)
            }
            #endif
            check(matched, "\(label)/\(lbl) flat pixels match (mean \(b.mean), >6: \(b.bad)/\(b.n), \(b.worstAt); best of \(shots.count) frames in Chrome's capture window\(between))")
            if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: b.shot.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(label.replacingOccurrences(of: "/", with: "-") + "-" + lbl + ".png")) }
            report.append(["case": "\(label)/\(lbl)", "compared": b.n, "mean": b.mean, "over6": b.bad, "worstAt": b.worstAt, "frame": b.at, "windowFrames": shots.count])
        }
        state.pointer.update(phase: .leave); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ButtonStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        #if os(iOS)
        AWCShimFrameClock.start()
        #endif
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
