import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-switch interaction against Chrome trusted-input runs (switch/states.html): hover, press, release (toggle
// with the spatial-spring slide and handle morph), leave, keyboard focus, Space (toggle + 150 ms press pulse),
// Enter (inert), blur; dark, RTL, all hooks, density −4, soft/hard disabled, cancelled mdInput, press-and-drag-off.
// Each rendered frame is compared at its render time with Chrome's per-frame samples; phase paint per screenshot.
@Observable final class SwitchStatesFixtureState {
    var node = AWCNode(id: "switch", tag: "md-switch")
    var epoch = 0
    var dark = false
    var rtl = false
    var cancel = false
    var reduced = false
    var appearance = AWCSwitchAppearance()
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Bool)] = []
    var formMode = false
    var form = AWCFormState()
    let pointer = AWCNativePointerState()
}
struct SwitchStatesFixture: View {
    let state: SwitchStatesFixtureState
    var control: some View {
        AWCEventScope(id: "scope", onEvent: { ctx in if state.cancel && ctx.event.name == "mdInput" { ctx.preventDefault() } }) {
            AWCNativeView(node: state.node, onEvent: { e in state.events.append((e.name, e.detail, e.defaultPrevented)) })
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
    }
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        // Inside the source's form the probes are inline (no flex gap): the switch follows "before" directly.
        HStack(spacing: state.formMode ? 0 : 24) {
            Color.clear.frame(width: 60, height: 32)
            if state.formMode { AWCFormScope(form: state.form) { control } } else { control }
            Color.clear.frame(width: 60, height: 32)
        }
        .awcSwitchAppearance(state.appearance).awcSelectionReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "switch", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .padding(.leading, 40).padding(.top, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct SwitchStatesGrid {
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
@main @MainActor enum NativeSwitchStatesIntegration {
    static let state = SwitchStatesFixtureState()
    static var host: NSHostingView<SwitchStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = [], skipped: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView() -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == "switch" } }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    static func key(_ code: UInt16, _ text: String) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot { let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height); let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b); return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin) }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> SwitchStatesGrid {
        let k = max(1, Int(s.scale.rounded())), crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!; ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height)) }
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
    static func premul(_ c: [Double]) -> [Double] { c.count < 4 ? c : [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
    static func hooks(_ v: AWCValue) -> AWCSwitchAppearance {
        guard case .object(let o) = v else { return .init() }
        func n(_ k: String) -> Double? { o[k].map { px($0.string) } }; func c(_ k: String) -> String? { o[k]?.string }
        return .init(trackWidth: n("track-width"), trackHeight: n("track-height"), handleSize: n("handle-size"), trackColor: c("track-color"), trackOutlineColor: c("track-outline-color"),
                     handleColor: c("handle-color"), selectedTrackColor: c("selected-track-color"), selectedHandleColor: c("selected-handle-color"), iconColor: c("icon-color"),
                     selectedIconColor: c("selected-icon-color"), stateLayerColor: c("state-layer-color"), focusRingColor: c("focus-ring-color"))
    }
    struct Sample { let t: Double; let renderT: Double?; let x: Double?; let size: Double?; let handle: [Double]?; let track: [Double]?; let outline: [Double]?; let layer: Double? }
    static func sample() -> Sample {
        let m = state.measurements.first { $0.name == "md-switch" }?.metrics
        func rgba(_ k: String) -> [Double]? { m?[k]?.array.compactMap(\.number) }
        return .init(t: now(), renderT: m?["renderTime"]?.number, x: m?["containerX"]?.number, size: m?["handleSize"]?.number, handle: rgba("handleColor"), track: rgba("trackColor"), outline: rgba("outlineColor"), layer: m?["layerOpacity"]?.number)
    }
    static func run(_ c: AWCValue, shots: URL, reduced: Bool) {
        let name = (reduced ? "reduced/" : "") + c["name"].string, cfg = c["config"]
        state.formMode = cfg["form"] == .bool(true); state.form = AWCFormState()
        state.dark = cfg["theme"].string == "dark"; state.rtl = cfg["dir"].string == "rtl"; state.cancel = cfg["cancel"] == .bool(true); state.reduced = reduced
        state.appearance = cfg["hooks"] == .null ? .init() : hooks(cfg["hooks"])
        var p: [String: AWCValue] = ["selected": .bool(cfg["selected"] == .bool(true))]
        if cfg["icons"].string == "icons" { p["icons"] = true }
        if let d = cfg["density"].number, d != 0 { p["density"] = .number(d) }
        if cfg["state"].string == "disabled" { p["disabled"] = true }; if cfg["state"].string == "softDisabled" { p["softDisabled"] = true }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.node = .init(id: "switch", tag: "md-switch", properties: p); state.measurements = []; state.epoch += 1; pump(0.5); state.events = []
        let phases = c["phases"].array, hp = CGPoint(x: c["handlePoint"].array[0].number!, y: c["handlePoint"].array[1].number!), off = CGPoint(x: hp.x, y: hp.y + 60)
        let hostX = phases[0]["snap"]["rect"]["x"].number!
        if let m = state.measurements.first(where: { $0.name == "md-switch" }) { check(abs(m.bounds.minX - hostX) < 0.6 && abs(m.bounds.minY - phases[0]["snap"]["rect"]["y"].number!) < 0.6, "\(name) host at the source position \(m.bounds)") }
        var steps: [(String, Double, () -> Void)] = []
        // Chrome step time = trusted-event delivery where the source reports it (focus/blur/mdInput),
        // else the phase start plus the harness's CDP round trips (move: 1, down/up: 2).
        let events = c["events"].array
        // Chrome renders an input's style change in the first frame at or after it (transitions start at that
        // frame's time); the step fires at that frame, which the every-frame samples give exactly.
        let frameTimes = phases.flatMap { $0["samples"].array.compactMap { $0["t"].number } }
        // A transition the input started gives that frame directly (rAF-aligned mouse moves start in the frame
        // that dispatched them, before the event's own timestamp); otherwise the first frame at or after it.
        let animStarts = c["anims"].array.compactMap { $0["startTime"].number }
        func frameAfter(_ t: Double) -> Double { animStarts.filter { $0 >= t - 17 && $0 <= t + 34 }.min() ?? frameTimes.first { $0 >= t && $0 <= t + 34 } ?? t }
        func at(_ ph: AWCValue, _ kinds: [String], _ fallback: Double) -> Double {
            let t = ph["t"].number!
            return frameAfter(events.first { kinds.contains($0["name"].string) && $0["t"].number! >= t && $0["t"].number! <= t + 150 }?["t"].number ?? t + fallback)
        }
        for ph in phases {
            let t = ph["t"].number!
            switch ph["label"].string {
            case "hover": steps.append(("hover", frameAfter(t + 5), { state.pointer.update(phase: .move, location: hp) }))
            case "press": steps.append(("press", at(ph, ["focus", "mdInput"], 10), { state.pointer.update(phase: .down, location: hp); mouse(.leftMouseDown, hp) }))
            case "release": steps.append(("release", at(ph, ["mdInput"], 10), { mouse(.leftMouseUp, hp); state.pointer.update(phase: .up, location: hp) }))
            case "leave": steps.append(("leave", frameAfter(t + 5), { state.pointer.update(phase: .leave) }))
            // Press, hold four frames, then move off the host (pointerleave clears the pressed class mid-morph).
            case "pressOff": steps.append(("pressOff", at(ph, ["focus"], 10), { state.pointer.update(phase: .down, location: hp); mouse(.leftMouseDown, hp) }))
                steps.append(("pressOffMove", at(ph, ["pointerleave"], 75), { state.pointer.update(phase: .move, location: off); mouse(.leftMouseDragged, off) }))
            case "releaseOff": steps.append(("releaseOff", frameAfter(t + 10), { mouse(.leftMouseUp, off); state.pointer.update(phase: .up, location: off) }))
            case "tab": steps.append(("tab", t, { _ = window.makeFirstResponder(nil) })); steps.append(("tabFocus", at(ph, ["focus"], 30), { _ = focusView()?.requestNativeFocus() }))
            case "space", "space2": steps.append((ph["label"].string, at(ph, ["mdInput"], 5), { key(49, " ") }))
            case "enter": steps.append(("enter", frameAfter(t + 5), { key(36, "\r") }))
            case "reset": steps.append(("reset", frameAfter(t + 2), { _ = state.form.reset() }))
            case "tabAway": steps.append(("tabAway", at(ph, ["blur"], 5), { _ = window.makeFirstResponder(nil) }))
            default: steps.append((ph["label"].string, t, {}))
            }
        }
        var samples: [Sample] = [], stepTimes: [String: Double] = [:], pending: [(String, AWCValue, Shot)] = []
        let webT0 = steps[0].1, t0 = now(), end = steps.last!.1 - webT0 + 470
        var next = 0
        while now() - t0 < end {
            while next < steps.count && now() - t0 >= steps[next].1 - webT0 {
                if next > 0 && !["tabFocus", "pressOffMove"].contains(steps[next].0), let i = phases.firstIndex(where: { $0["label"].string == steps[next].0 }), i > 0 {
                    let ph = phases[i - 1]; pending.append((ph["label"].string, ph, capture(clipRect(ph["clip"])))) }
                stepTimes[steps[next].0] = now(); steps[next].2(); next += 1
            }
            // Fire the next step on time: pump in 4 ms slices, then wait out the remainder before it.
            let due = next < steps.count ? steps[next].1 - webT0 - (now() - t0) : 4
            if due >= 4 { pump(0.004) } else if due > 0 { let until = now() + due; while now() < until {} }
            samples.append(sample())
        }
        let lastPh = phases.last!; pending.append((lastPh["label"].string, lastPh, capture(clipRect(lastPh["clip"]))))
        // Events: names, proposed/committed state and cancellation.
        let webEvents = c["events"].array.filter { ["mdInput", "mdChange"].contains($0["name"].string) }
        check(state.events.map(\.0) == webEvents.map { $0["name"].string }, "\(name) events \(state.events.map(\.0)) vs \(webEvents.map { $0["name"].string })")
        for (e, w) in zip(state.events, webEvents) { check(e.1["selected"] == w["detail"]["selected"] && e.2 == (w["defaultPrevented"] == .bool(true)), "\(name) \(e.0) detail \(e.1) prevented \(e.2) vs \(w["detail"]) \(w["defaultPrevented"])") }
        // Per-frame values against Chrome's samples (±2 frames; monotone envelope across >2-frame gaps).
        var web = phases.flatMap { $0["samples"].array }
        if c["rest"] != .null { var rest = c["rest"]; if case .object(var o) = rest { o["t"] = .number(webT0 - 5); rest = .object(o) }; web.insert(rest, at: 0) }
        let webSteps = steps.map { ($0.0, $0.1) }
        func webTime(_ native: Double) -> Double {
            let done = webSteps.filter { stepTimes[$0.0].map { $0 <= native } ?? false }
            guard let step = done.last, let n = stepTimes[step.0] else { return webT0 + (native - t0) }
            return step.1 + (native - n)
        }
        func webValue(_ read: (AWCValue) -> [Double], _ t: Double) -> (lo: [Double], hi: [Double]) {
            guard let after = web.firstIndex(where: { $0["t"].number! >= t }) else { let v = read(web.last!); return (v, v) }
            if after == 0 { let v = read(web[0]); return (v, v) }
            let a = web[after - 1], b = web[after], ta = a["t"].number!, tb = b["t"].number!, va = read(a), vb = read(b)
            if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
            let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
        }
        let props: [(String, Double, (AWCValue) -> [Double], (Sample) -> [Double]?)] = [
            ("handle position", 0.35, { [$0["containerX"].number! - hostX] }, { s in s.x.map { [$0] } }),
            ("handle size", 0.2, { [$0["handle"]["width"].number!] }, { s in s.size.map { [$0] } }),
            ("handle color", 0.012, { premul(css($0["handleBg"].string)) }, { s in s.handle.map(premul) }),
            ("track color", 0.012, { premul(css($0["trackBg"].string)) }, { s in s.track.map(premul) }),
            ("track outline", 0.012, { premul(css($0["trackBorder"].string)) }, { s in s.outline.map(premul) }),
            ("state layer", 0.004, { $0["layerDisplay"].string == "none" ? [-1] : [$0["layerOpacity"].number!] }, { s in s.layer.map { [$0] } }),
        ]
        var compared: [String: Int] = [:]
        for (prop, tol, readWeb, read) in props {
            var seen = Set<Double>()
            for s in samples {
                guard let v = read(s), !v.isEmpty else { continue }
                let at = s.renderT ?? s.t
                // Each distinct render is compared once (a static frame keeps its render time).
                if let r = s.renderT { if seen.contains(r) { continue }; seen.insert(r) }
                var lo = Array(repeating: Double.infinity, count: v.count), hi = Array(repeating: -Double.infinity, count: v.count), x = at - 34
                while x <= at + 40 { let e = webValue(readWeb, webTime(x)); for i in 0..<min(v.count, e.lo.count) { lo[i] = min(lo[i], e.lo[i]); hi[i] = max(hi[i], e.hi[i]) }; x += 2 }
                check((0..<min(v.count, lo.count)).allSatisfy { v[$0] >= lo[$0] - tol && v[$0] <= hi[$0] + tol }, "\(name) \(prop) rendered \(v) at web \(Int(webTime(at))) within Chrome [\(lo),\(hi)]"); compared[prop, default: 0] += 1
            }
            if let final = samples.last.flatMap(read) { let want = readWeb(web.last!); check(zip(final, want).allSatisfy { abs($0 - $1) <= max(tol, 0.012) }, "\(name) \(prop) settles \(final) vs \(want)") }
            // A run whose source value never changes (hard disabled) renders few distinct frames.
            let varies = Set(web.map { readWeb($0).map { ($0 * 1000).rounded() } }).count > 1
            check((compared[prop] ?? 0) > (varies ? 8 : 0), "\(name) \(prop) samples compared (\(compared[prop] ?? 0))")
        }
        // Phase paint: every flat pixel of each source phase screenshot. The source's probes are native <button>s
        // (plain spacers here, not part of the switch); inside the form "after" follows the switch 1px later.
        let b = c["before"], probe = CGRect(x: b["x"].number!, y: b["y"].number!, width: b["width"].number!, height: b["height"].number!)
        let hostRight = hostX + phases[0]["snap"]["rect"]["width"].number!
        let probes = [probe] + (state.formMode ? [CGRect(x: hostRight + 1, y: probe.minY, width: probe.width, height: probe.height)] : [])
        for (label, ph, shot) in pending {
            let clip = ph["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
            guard let src = NSImage(contentsOf: shots.appendingPathComponent(c["name"].string + "-" + label + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name)/\(label) source"); continue }
            let webG = grid(.init(cg: src, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
            var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
            for py in (cy + 1)..<(cy + ch - 1) { for pxx in (cx + 1)..<(cx + cw - 1) where webG.flat(pxx, py, 6) && nat.flat(pxx, py, 6) && !probes.contains(where: { $0.insetBy(dx: -2, dy: -2).contains(CGPoint(x: Double(pxx) + 0.5, y: Double(py) + 0.5)) }) {
                let d = diff(webG.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(webG.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
            check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name)/\(label) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
            if let dir = ProcessInfo.processInfo.environment["AWC_SWITCH_CAPTURE_DIRECTORY"] { try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name.replacingOccurrences(of: "/", with: "-") + "-" + label + ".png")) }
        }
        report.append(["case": name, "samples": samples.count, "compared": compared])
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.1)
    }
    static func clipRect(_ c: AWCValue) -> CGRect { .init(x: c["x"].number!, y: c["y"].number!, width: c["width"].number!, height: c["height"].number!) }
    /// Source md-switch.tsx keydown: `if (e.repeat) return` — a held Space (OS auto-repeat) toggles once; a later press toggles again (gate-7 R4-06).
    static func heldSpace() {
        state.cancel = false; state.rtl = false; state.formMode = false
        state.node = .init(id: "switch", tag: "md-switch", properties: [:]); state.measurements = []; state.epoch += 1; pump(0.5); state.events = []
        guard let f = focusView() else { check(false, "held-space: focus view"); return }
        _ = window.makeFirstResponder(f); pump(0.1)
        func send(_ type: NSEvent.EventType, _ repeating: Bool) { window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: " ", charactersIgnoringModifiers: " ", isARepeat: repeating, keyCode: 49)!) }
        send(.keyDown, false); pump(0.05)
        for _ in 0..<12 { send(.keyDown, true); pump(0.035) }
        send(.keyUp, false); pump(0.3)
        check(state.events.filter { $0.0 == "mdChange" }.count == 1, "held-space toggles once: \(state.events.map(\.0))")
        state.events = []; send(.keyDown, false); pump(0.05); send(.keyUp, false); pump(0.3)
        check(state.events.filter { $0.0 == "mdChange" }.count == 1, "held-space: a second Space press toggles again: \(state.events.map(\.0))")
        _ = window.makeFirstResponder(nil); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SwitchStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_SWITCH_ONLY"]
        for (file, reduced) in [("switch-web-states", false), ("switch-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for c in oracle["runs"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        if only == nil { heldSpace() }
        if let output = ProcessInfo.processInfo.environment["AWC_SWITCH_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "skipped": skipped, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Switch native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
