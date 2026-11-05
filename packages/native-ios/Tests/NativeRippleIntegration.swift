import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-ripple against Chrome (ripple/{paint,motion,behaviour}.html, DPR 1, canonical dist):
// paint — 160 frozen frames (geometry × origin × direction × theme, every hook and fallback, inherited vs per-instance,
// the boxless parent, fades, disabled/suppressed/hidden/secondary button): wave box, scale, opacity, colour, clip radius
// and every flat pixel; motion — per-frame scale/opacity within Chrome's frame envelope and removal times;
// behaviour — the lifecycle, ownership and method scenarios.
@Observable final class RippleFixtureState {
    var epoch = 0
    var w = 120.0
    var h = 60.0
    var radius = 12.0
    var dark = false
    var rtl = false
    var boxless = false
    var disabled = false
    var hidden = false
    var suppressed = false
    var mounted = true
    var alternate = false
    var hooks = AWCRippleAppearance()
    var inherited = AWCRippleAppearance()
    var testTime: AWCRippleTestTime? = nil
    var active = true
    var measurements: [AWCNativeInspectionNode] = []
}
let rippleController = AWCRippleController()
struct RippleFixture: View {
    let state: RippleFixtureState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark), t = theme.tokens
        var p: [String: AWCValue] = [:]; if state.disabled { p["disabled"] = true }; if state.hidden { p["hidden"] = true }
        let w = state.alternate ? 90 : state.w, h = state.alternate ? 50 : state.h, r = state.alternate ? 8 : state.radius
        return ZStack(alignment: .topLeading) {
            ZStack {
                if state.mounted {
                    AWCNativeView(node: AWCNode(id: "ripple", tag: "md-ripple", properties: p))
                        .awcRippleAppearance(state.hooks)
                }
            }
            .frame(width: w, height: h)
            .background(RoundedRectangle(cornerRadius: r, style: .circular).fill(Color(awcHex: state.alternate ? "#DDDDDD" : t["--md-sys-color-surface-container-highest"]!)))
            .environment(\.awcRippleHostCornerRadius, state.boxless ? 0 : r)
            .environment(\.awcRippleContentColor, Color(awcHex: t["--md-sys-color-on-surface"]!))
            .awcRippleAppearance(state.inherited)
            .environment(\.awcRippleEnabled, !state.suppressed)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 40, y: 40)
        }
        .environment(\.awcRippleTestTime, state.testTime)
        #if os(macOS)
        .environment(\.controlActiveState, state.active ? .key : .inactive)
        #else
        .environment(\.scenePhase, state.active ? .active : .inactive)
        #endif
        .awcRippleController(rippleController)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "ripple", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct RippleGrid {
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
@main @MainActor enum NativeRippleIntegration {
    static let state = RippleFixtureState()
    static var host: NSHostingView<RippleFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp || kind == .rightMouseUp ? 0 : 1)!; window.sendEvent(e) }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> RippleGrid {
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
    static func matrixA(_ t: String) -> Double { t == "none" ? 1 : numbers(t).first ?? 1 }
    static var metrics: [String: AWCValue]? { state.measurements.first { $0.name == "md-ripple" }?.metrics }
    static func m(_ k: String) -> Double { metrics?[k]?.number ?? .nan }
    static func configure(_ c: AWCValue) {
        state.w = c["w"].number ?? 120; state.h = c["h"].number ?? 60; state.radius = c["radius"].number ?? 12
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.boxless = c["boxless"] == .bool(true)
        state.disabled = c["disabled"] == .bool(true); state.hidden = c["hidden"] == .bool(true); state.suppressed = c["suppressed"] == .bool(true)
        func app(_ v: AWCValue) -> AWCRippleAppearance { guard case .object(let o) = v else { return .init() }
            return .init(cssValues: o.compactMapValues { $0.string }) }
        state.hooks = app(c["hooks"]); state.inherited = app(c["inherited"]); state.mounted = true; state.alternate = false
    }
    static func reset(time: AWCRippleTestTime?) { state.testTime = time; state.measurements = []; state.epoch += 1; state.mounted = false; pump(0.05); state.mounted = true; pump(0.2) }
    static let origins: [String: (Double, Double) -> (Double, Double)] = ["corner": { _, _ in (6, 5) }, "far": { w, h in (w - 7, h - 4) }]

    // MARK: paint
    static func paint(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, phase = c["phase"].string, t = c["t"].number ?? 0
        configure(c)
        reset(time: phase == "grow" ? .grow(t) : phase == "held" ? .held : .grow(0))
        var down: CGPoint? = nil, right = c["button"].string == "right"
        #if !os(macOS)
        if right { report.append(["case": name, "skipped": "touch has no secondary button"]); return }
        #endif
        if c["origin"].string == "center" || state.w == 0 { rippleController.trigger() }
        else if let x = c["px"].number, let y = c["py"].number { down = CGPoint(x: 40 + x, y: 40 + y); mouse(right ? .rightMouseDown : .leftMouseDown, down!) }
        pump(0.06)
        if phase == "fade", let d = down { mouse(.leftMouseUp, d); down = nil; pump(0.03); state.testTime = .fade(t) }
        pump(0.12)
        let s = c["snap"], mt = metrics
        check(mt != nil, "\(name) measured")
        let webWaves = s["waves"].number ?? 0
        check((mt?["waves"]?.number ?? -1) == webWaves, "\(name) waves \(mt?["waves"]?.number ?? -1) vs \(webWaves)")
        if webWaves > 0, let mt {
            let w = s["wave"], d = mt["waveDiameter"]?.number ?? .nan
            func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.05) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
            near((mt["waveX"]?.number ?? .nan) - d / 2, w["left"].number!, "wave left"); near((mt["waveY"]?.number ?? .nan) - d / 2, w["top"].number!, "wave top"); near(d, w["size"].number!, "wave size")
            if !state.hidden {
                // A hidden (display:none) ripple keeps its wave but Chrome reports no transform for it; nothing paints.
                near(mt["waveScale"]?.number ?? .nan, matrixA(w["transform"].string), "wave scale", 0.001); near(mt["waveOpacity"]?.number ?? .nan, w["opacity"].number!, "wave opacity", 0.0015) }
            near(mt["cornerRadius"]?.number ?? .nan, numbers(s["container"]["radius"].string).first ?? -1, "clip radius", 0.001)
        }
        if c["group"].string == "none" || s["container"] == .null { } else { check(abs(m("containerOpacity") - (s["container"]["opacity"].number ?? 1)) < 0.001, "\(name) container opacity") }
        // Every flat CSS pixel of the clip.
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch)), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxx in (cx + 1)..<(cx + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let dd = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += dd; if dd > 6 { bad += 1 }
            if dd > worst { worst = dd; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage \(n)")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_RIPPLE_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst])
        if let d = down { mouse(right ? .rightMouseUp : .leftMouseUp, d) }
        state.testTime = nil; pump(0.02)
    }

    // MARK: motion
    /// Chrome samples (t since pointerdown, value) across repetitions; a native value at time `t` must lie within the
    /// values Chrome shows from 40 ms earlier (native leads) to 34 ms later (native trails).
    /// Two Chrome frames either way (lead 2f + 7 ms, trail 2f + 1 ms; f is Chrome's measured frame interval — 40/34 ms at
    /// 60 fps): Chrome starts a Web Animation on the frame after it is created and its fade on the frame after the grow's
    /// finished promise resolves, and observes removal only at its next frame.
    static var lead = 40.0, trail = 34.0
    static func within(_ web: [[(Double, Double?)]], _ t: Double, _ v: Double, _ tol: Double) -> (Bool, Double, Double) {
        var lo = Double.infinity, hi = -Double.infinity
        for rep in web { for (i, f) in rep.enumerated() { guard let fv = f.1 else { continue }
            if f.0 >= t - lead && f.0 <= t + trail { lo = min(lo, fv); hi = max(hi, fv) }
            if i + 1 < rep.count, let nv = rep[i + 1].1 { for edge in [t - lead, t + trail] where f.0 < edge && rep[i + 1].0 > edge {
                let x = fv + (nv - fv) * (edge - f.0) / (rep[i + 1].0 - f.0); lo = min(lo, x); hi = max(hi, x) } } } }
        return (lo == .infinity ? true : v >= lo - tol && v <= hi + tol, lo, hi)
    }
    static func motion(_ name: String, _ reps: [AWCValue]) {
        let c = reps[0]; configure(c); state.w = 120; state.h = 60; state.radius = 12
        reset(time: nil)
        // Release when Chrome actually released (its setTimeout fired late): the median of the repetitions.
        let releases = reps.compactMap { $0["upAt"].number ?? $0["releasedAt"].number }.sorted()
        let release: Double? = releases.isEmpty ? nil : releases[releases.count / 2], trigger = c["trigger"] == .bool(true)
        let start = AWCRippleEngine.now(); var released = false, removedAt: Double? = nil, samples = 0, bad = 0, worst = ""
        // Each wave exists from the press at scale 0 and its first opacity until Chrome's first sampled frame.
        let webScale = reps.map { r -> [(Double, Double?)] in [(0, 0)] + r["frames"].array.map { ($0["t"].number!, $0["scale"].number) } }
        let webOpacity = reps.map { r -> [(Double, Double?)] in let f = r["frames"].array; return [(0, f.first { $0["opacity"].number != nil }?["opacity"].number)] + f.map { ($0["t"].number!, $0["opacity"].number) } }
        let gaps = reps.flatMap { r -> [Double] in let ts = r["frames"].array.map { $0["t"].number! }; return zip(ts.dropFirst(), ts).map { $0 - $1 } }.sorted()
        let f = gaps.isEmpty ? 16.7 : gaps[gaps.count / 2]; lead = 2 * f + 7; trail = 2 * f + 1
        let webRemoval = reps.compactMap { r -> Double? in let f = r["frames"].array; guard let last = f.lastIndex(where: { ($0["waves"].number ?? 0) > 0 }), last + 1 < f.count else { return nil }; return f[last + 1]["t"].number }
        if trigger { rippleController.trigger() } else { mouse(.leftMouseDown, .init(x: 46, y: 45)) }
        while AWCRippleEngine.now() - start < (release ?? 0) + 1400 {
            pump(0.008)
            let now = AWCRippleEngine.now() - start
            if let release, !released, now >= release { mouse(.leftMouseUp, .init(x: 46, y: 45)); released = true }
            guard let mt = metrics else { continue }
            if (mt["waves"]?.number ?? 0) == 0 { if removedAt == nil && now > 20 { removedAt = now }; continue }
            guard let since = mt["waveSince"]?.number, let sc = mt["waveScale"]?.number, let op = mt["waveOpacity"]?.number else { continue }
            samples += 1
            let a = within(webScale, since, sc, 0.004), b = within(webOpacity, since, op, 0.002)
            if !a.0 || !b.0 { bad += 1; if worst.isEmpty { worst = "t=\(Int(since)) scale \(sc) in [\(a.1),\(a.2)] opacity \(op) in [\(b.1),\(b.2)]" } }
        }
        check(samples > 10, "\(name) motion sampled \(samples)")
        check(bad == 0, "\(name) motion within Chrome's frame envelope (\(bad)/\(samples) outside; first \(worst))")
        if let removedAt, let lo = webRemoval.min(), let hi = webRemoval.max() { check(removedAt >= lo - lead && removedAt <= hi + trail, "\(name) removal \(Int(removedAt)) ms vs Chrome \(Int(lo))–\(Int(hi))") }
        else { check(false, "\(name) removal observed (native \(String(describing: removedAt)), web \(webRemoval))") }
        report.append(["motion": name, "samples": samples, "outside": bad, "removedAt": removedAt ?? -1])
        pump(0.2)
    }

    // MARK: behaviour
    static func waves() -> Double { metrics?["waves"]?.number ?? 0 }
    static func settle(_ body: @escaping () async -> Void) -> Double { let t = AWCRippleEngine.now(); var done = false; Task { @MainActor in await body(); done = true }
        while !done && AWCRippleEngine.now() - t < 2000 { pump(0.004) }; return AWCRippleEngine.now() - t }
    static func untilGone(_ from: Double, limit: Double = 2000) -> Double? { while AWCRippleEngine.now() - from < limit { pump(0.004); if waves() == 0 { return AWCRippleEngine.now() - from } }; return nil }
    static func fresh(_ o: [String: AWCValue] = [:]) { configure(.object(o)); state.w = o["w"]?.number ?? 120; state.h = o["h"]?.number ?? 60; state.radius = 12; state.active = true; reset(time: nil) }
    static func behaviour(_ web: AWCValue) {
        let P = CGPoint(x: 50, y: 50)
        #if os(macOS)
        fresh(); mouse(.rightMouseDown, P); pump(0.05); check(waves() == web["secondary"]["afterDown"].number!, "secondary button starts no wave"); mouse(.rightMouseUp, P); pump(0.05)
        #endif
        fresh(); mouse(.leftMouseDown, P); pump(0.1); state.active = false; pump(0.05); check(waves() == web["blur"]["afterBlur"].number!, "window blur removes the wave"); mouse(.leftMouseUp, P); pump(0.05); check(waves() == 0, "blur: release adds nothing")
        fresh(); mouse(.leftMouseDown, P); pump(0.1); state.disabled = true; pump(0.05); check(waves() == web["disableMid"]["afterDisable"].number!, "disabling removes the wave"); mouse(.leftMouseUp, P)
        mouse(.leftMouseDown, P); pump(0.05); check(waves() == web["disableMid"]["pressWhileDisabled"].number!, "no wave while disabled"); mouse(.leftMouseUp, P)
        state.disabled = false; pump(0.05); rippleController.trigger(); pump(0.03); check(waves() == web["disableMid"]["triggerAfterEnable"].number!, "trigger works after re-enabling"); pump(0.7)
        fresh(); mouse(.leftMouseDown, P); pump(0.1); mouse(.leftMouseUp, P); mouse(.leftMouseDown, .init(x: 140, y: 90)); pump(0.03)
        let rw = web["replace"]; check(waves() == rw["waves"].number!, "a new press replaces the old wave")
        check(abs(m("waveX") - m("waveDiameter") / 2 - rw["left"].number!) < 0.05 && abs(m("waveDiameter") - rw["size"].number!) < 0.05, "replacement wave geometry \(m("waveX")) \(m("waveDiameter"))")
        mouse(.leftMouseUp, .init(x: 140, y: 90)); pump(0.7)
        fresh(); mouse(.leftMouseDown, P); pump(0.02); var e = settle { await rippleController.whenSettled() }
        check(e >= 195 && e <= 260, "whenSettled() with a held wave returns at the 200 ms bound (\(Int(e)) vs Chrome \(Int(web["settledHeld"]["elapsedMs"].number!)))"); check(waves() == 1, "held wave still visible after whenSettled()"); mouse(.leftMouseUp, P); pump(0.4)
        fresh(); rippleController.trigger(); pump(0.01); e = settle { await rippleController.whenSettled() }
        check(e >= 195 && e <= 260 && waves() == 1, "whenSettled() after trigger() is bounded (\(Int(e)) ms) while the wave still grows")
        let gone = untilGone(AWCRippleEngine.now() - e); check(gone.map { abs($0 - web["settledTrigger"]["removedMs"].number!) < 60 } ?? false, "trigger wave removed at \(String(describing: gone)) vs Chrome \(Int(web["settledTrigger"]["removedMs"].number!))")
        fresh(); e = settle { await rippleController.whenSettled() }; check(e < 30, "whenSettled() without a wave returns at once (\(Int(e)))")
        fresh(["hooks": .object(["grow-duration": "0ms"])]); state.hooks = .init(cssValues: ["grow-duration": "0ms"]); pump(0.05); mouse(.leftMouseDown, P); pump(0.03); mouse(.leftMouseUp, P); e = settle { await rippleController.whenSettled() }
        check(e <= 205 && waves() == 0, "whenSettled() resolves with the finished fade (\(Int(e)) ms, waves \(waves()))")
        fresh(); mouse(.leftMouseDown, P); pump(0.1); state.mounted = false; pump(0.05); check(metrics == nil, "removing md-ripple removes its wave and node"); mouse(.leftMouseUp, P)
        state.alternate = true; state.mounted = true; pump(0.15); mouse(.leftMouseDown, .init(x: 60, y: 60)); pump(0.03)
        check(waves() == web["disconnect"]["onNewSurface"].number!, "a reconnected ripple binds to its new surface"); check(abs(m("waveDiameter") - web["disconnect"]["newWaveSize"].number!) < 0.05, "new surface geometry \(m("waveDiameter")) vs \(web["disconnect"]["newWaveSize"].number!)"); mouse(.leftMouseUp, .init(x: 60, y: 60)); pump(0.7)
        fresh(["disabled": true]); rippleController.trigger(); pump(0.03); check(waves() == web["triggerDisabled"]["waves"].number!, "trigger() while disabled adds nothing")
        fresh(["suppressed": true]); rippleController.trigger(); pump(0.03); let st = waves(); mouse(.leftMouseDown, P); pump(0.03); check(st == web["suppressed"]["trigger"].number! && waves() == web["suppressed"]["press"].number!, "suppressed ripples allocate nothing"); mouse(.leftMouseUp, P)
        fresh(); mouse(.leftMouseDown, P); pump(0.1); state.suppressed = true; pump(0.05); check(waves() == web["suppressMidflight"]["waves"].number! && m("containerOpacity") == web["suppressMidflight"]["containerOpacity"].number!, "suppressing hides a running wave"); mouse(.leftMouseUp, P); state.suppressed = false; pump(0.7)
        fresh(); mouse(.leftMouseDown, .init(x: 60, y: 210)); pump(0.03); check(waves() == web["outside"]["waves"].number!, "a press outside the surface adds nothing"); mouse(.leftMouseUp, .init(x: 60, y: 210))
        fresh(); mouse(.leftMouseDown, P); let t0 = AWCRippleEngine.now(); pump(0.1); mouse(.leftMouseUp, P); let er = untilGone(t0)
        check(er.map { abs($0 - web["earlyRelease"]["removedMs"].number!) < 70 } ?? false, "early release fades after growth (\(String(describing: er)) vs Chrome \(Int(web["earlyRelease"]["removedMs"].number!)))")
        fresh(); mouse(.leftMouseDown, P); pump(1.0); check(waves() == 1 && abs(m("waveOpacity") - web["heldLong"]["opacity"].number!) < 0.001, "a held wave stays at full opacity"); var t1 = AWCRippleEngine.now(); mouse(.leftMouseUp, P)
        var r1 = untilGone(t1); check(r1.map { abs($0 - web["heldLong"]["removedAfterUpMs"].number!) < 60 } ?? false, "held wave fades 150 ms after release (\(String(describing: r1)))")
        fresh(); state.hooks = .init(cssValues: ["grow-duration": "0ms"]); pump(0.05); mouse(.leftMouseDown, P); pump(0.05); t1 = AWCRippleEngine.now(); mouse(.leftMouseUp, P); r1 = untilGone(t1)
        check(r1.map { abs($0 - web["zeroDuration"]["removedAfterUpMs"].number!) < 60 } ?? false, "zero grow duration fades on release (\(String(describing: r1)))")
        fresh(["dir": "rtl"]); mouse(.leftMouseDown, P); pump(0.03); let rr = web["rtlOrigin"]
        check(abs(m("waveX") - m("waveDiameter") / 2 - rr["left"].number!) < 0.05 && abs(m("waveY") - m("waveDiameter") / 2 - rr["top"].number!) < 0.05, "RTL keeps the physical origin (\(m("waveX")), \(m("waveY")))"); mouse(.leftMouseUp, P); pump(0.7)
        fresh(["hidden": true]); mouse(.leftMouseDown, P); pump(0.03); check(waves() == web["hiddenPress"]["waves"].number!, "a hidden ripple still tracks the press"); mouse(.leftMouseUp, P); pump(0.7)
        fresh(["w": 200, "h": 80]); rippleController.trigger(); pump(0.03); let tc = web["triggerCentered"]
        check(abs(m("waveX") - m("waveDiameter") / 2 - tc["left"].number!) < 0.05 && abs(m("waveDiameter") - tc["size"].number!) < 0.05, "trigger() is centred (\(m("waveX")), \(m("waveDiameter")))"); pump(0.7)
        fresh(); mouse(.leftMouseDown, P); pump(0.03); rippleController.trigger(); pump(0.02); let tr = web["triggerReplace"]
        check(waves() == tr["waves"].number! && abs(m("waveX") - m("waveDiameter") / 2 - tr["left"].number!) < 0.05, "trigger() replaces a held wave"); mouse(.leftMouseUp, P); pump(0.05); check(waves() == tr["afterUp"].number!, "the old press release does not end the trigger wave"); pump(0.7)
    }

    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: RippleFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 520, height: 300), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        func load(_ f: String) -> AWCValue { try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(f))) }
        let only = ProcessInfo.processInfo.environment["AWC_RIPPLE_ONLY"], parts = ProcessInfo.processInfo.environment["AWC_RIPPLE_PARTS"] ?? "paint,motion,behaviour"
        if parts.contains("paint") { for c in load("ripple-web-paint.json")["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { paint(c, shots: fixtures.appendingPathComponent("ripple-web-paint")) } }
        if parts.contains("motion") { let all = load("ripple-web-motion.json")["cases"].array
            var names: [String] = []; for c in all where !names.contains(c["name"].string) { names.append(c["name"].string) }
            for n in names where only.map({ n.contains($0) }) ?? true { motion(n, all.filter { $0["name"].string == n }) } }
        if parts.contains("behaviour") { behaviour(load("ripple-web-behaviour.json")["scenarios"]) }
        if let output = ProcessInfo.processInfo.environment["AWC_RIPPLE_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Ripple native: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
