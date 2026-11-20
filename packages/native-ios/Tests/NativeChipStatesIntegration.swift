import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-chip interaction against Chrome trusted-input records (web-oracle/states.html, and the
// reduced-motion set): pointer on the body, keyboard on button- and group-role chips (primary
// action, remove button, Delete / Backspace, Shift+Tab), pressing ✕, default removal by click,
// Delete and Backspace, display tokens, hard and soft disabled, hooks, colour roles, RTL, dark and
// an avatar. Each rendered value is compared at its render time with Chrome's per-frame samples;
// phase paint, geometry, focus, rings, selection, events (order, detail, prevented) and source
// timings are checked too.
@Observable final class ChipStatesFixtureState {
    var run: AWCValue = .null
    var epoch = 0
    var reduced = false
    var selected = false
    var removed = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Bool, Double)] = []
    let pointer = AWCNativePointerState()
}
struct ChipStatesFixture: View {
    let state: ChipStatesFixtureState
    static let hooks = AWCChipHookAppearance(containerColor: "#22556699", containerColorSelected: "#7B1FA2CC", labelColor: "#C62828", labelColorSelected: "#FFF59D", iconColor: "#2E7D32",
                                             iconSize: .points(22), containerShape: .init(topLeft: .init(x: .points(14), y: .points(6)), topRight: .init(x: .points(2), y: .points(10)), bottomRight: .init(x: .points(14), y: .points(6)), bottomLeft: .init(x: .points(2), y: .points(10))), containerHeight: .points(40), outlineColor: "#1565C0CC",
                                             outlineWidth: 3, stateLayerColor: "#FF6F00", elevation: AWCBoxShadow.source("0px 3px 6px 0px #00000059") ?? [])
    static let content: [String: [String: AWCValue]] = ["assist": ["icon": "event", "label": "Add to calendar"], "filter": ["label": "Unread"],
                                                         "input": ["label": "Ada Lovelace", "icon": "person"], "suggestion": ["label": "Nearby"]]
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark"), scenario = r["scenario"].string
        var props: [String: AWCValue] = ["variant": .string(r["variant"].string), "appearance": .string(r["appearance"].string)]
        for (k, v) in Self.content[r["variant"].string] ?? [:] { props[k] = v }
        for k in ["color", "selectable", "removable"] where r[k] != .null { props[k] = r[k] }
        if scenario == "disabled" { props["disabled"] = true }
        if scenario == "softDisabled" { props["softDisabled"] = true }
        props["selected"] = .bool(state.selected)
        let node = AWCNode(id: "chip", tag: "md-chip", properties: props), model = AWCChipModel(properties: props, selected: state.selected)
        let keep = !["removeDelete", "removeClick", "removeBackspace"].contains(scenario), avatar = scenario == "avatar"
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 1000, y: 10)
            if !state.removed {
                AWCNativeChip(node: node, theme: theme, model: model, hasLeadingSlot: avatar, hasTrailingSlot: false, hasLabelSlot: false, accessibleLabel: model.label,
                              dispatch: { name, detail in let prevented = name == "mdRemove" && keep; state.events.append((name, detail, prevented, CACurrentMediaTime() * 1000)); return prevented },
                              setSelected: { state.selected = $0 }, remove: { state.removed = true },
                              leadingSlot: { if avatar { Circle().fill(Color(awcHex: "#7E57C2")) } }, labelSlot: { EmptyView() }, trailingSlot: { EmptyView() })
                    .awcChipAppearance(r["custom"] == .bool(true) ? Self.hooks : .init())
                    .frame(width: 360, alignment: .topLeading)
                    .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                    .offset(x: 60, y: 60)
            }
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 10, y: 860)
        }
        .awcChipReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "chip", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct ChipGrid {
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
@main @MainActor enum NativeChipStatesIntegration {
    static let state = ChipStatesFixtureState()
    static var host: NSHostingView<ChipStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let captureDir = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    /// Diagnostic only: AWC_CHIP_STATES_SHOT_ANCHOR=t0 restores the run-start shot clock; AWC_CHIP_STATES_TIMING=1 logs input lateness.
    static let shotsAnchoredToRunStart = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_SHOT_ANCHOR"] == "t0"
    static let timingLog = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_TIMING"] == "1"
    #if os(iOS)
    /// iOS (gate-7 R1-01 class): Chrome photographs a phase on demand, at any moment of its animation clock, while the
    /// simulator draws only on its display frames; across click2's 150 ms wave fade Chrome's photo can fall between two native
    /// frames. When two consecutive distinct frames in Chrome's capture window straddle Chrome's image (one darker, one
    /// lighter over the compared pixels), the frame at Chrome's moment is their blend (1 - w)·A + w·B (a wave's opacity is
    /// linear in the composited pixel), which must match under the same thresholds. AWC_CHIP_STATES_BRACKET=0: off.
    static let bracketFallback = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_BRACKET"] != "0"
    static func bracket(_ web: ChipGrid, _ frames: [(at: Double, grid: ChipGrid)], minCompared: Int)
        -> (ok: Bool, a: Double, b: Double, sa: Double, sb: Double, w: Double, mean: Double, bad: Int, n: Int)? {
        var distinct: [(at: Double, grid: ChipGrid)] = []
        for f in frames { if let last = distinct.last, zip(last.grid.values, f.grid.values).allSatisfy({ abs($0 - $1) < 0.5 }) { continue }; distinct.append(f) }
        var best: (ok: Bool, a: Double, b: Double, sa: Double, sb: Double, w: Double, mean: Double, bad: Int, n: Int)? = nil
        for (fa, fb) in zip(distinct, distinct.dropFirst()) {
            var pixels: [(Int, Int)] = [], sa = 0.0, sb = 0.0
            for py in (web.y + 1)..<(web.y + web.h - 1) { for px in (web.x + 1)..<(web.x + web.w - 1) where web.flat(px, py, 6) && fa.grid.flat(px, py, 6) && fb.grid.flat(px, py, 6) {
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
                if best == nil || (ok && !best!.ok) || (ok == best!.ok && mean < best!.mean) { best = (ok, fa.at, fb.at, sa, sb, w, mean, bad, pixels.count) }
            }
        }
        return best
    }
    #endif
    /// iOS: per-frame value windows read a slipped step's samples on the previous step's clock too (gate-7 R4-11);
    /// AWC_CHIP_STATES_SLIP=0: each step's clock only.
    static let slipWindow = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_SLIP"] != "0"
    /// Probe: AWC_CHIP_STATES_LATE=<phase>:<ms>[,...] dispatches that phase's input <ms> late, as a capture overrun in the
    /// window before it does.
    static let probeLate: [String: Double] = Dictionary((ProcessInfo.processInfo.environment["AWC_CHIP_STATES_LATE"] ?? "").split(separator: ",").compactMap { item -> (String, Double)? in
        let kv = item.split(separator: ":"); guard kv.count == 2, let ms = Double(kv[1]) else { return nil }; return (String(kv[0]), ms) }, uniquingKeysWith: { $1 })
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func capture(_ r: CGRect) -> NativeChipPaintShot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    struct NativeChipPaintShot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func grid(_ s: NativeChipPaintShot, x: Int, y: Int, w: Int, h: Int) -> ChipGrid {
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
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func color(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func pre(_ c: [Double]) -> [Double] { c.count < 4 ? c : [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    /// Shadow list → padded [x,y,blur,spread, premultiplied r,g,b,a] × 2 layers.
    static func shadow(_ s: String) -> [Double] {
        var layers: [[Double]] = []
        if s != "none" {
            var parts: [String] = [], depth = 0, cur = ""
            for ch in s { if ch == "(" { depth += 1 }; if ch == ")" { depth -= 1 }; if ch == "," && depth == 0 { parts.append(cur); cur = "" } else { cur.append(ch) } }
            parts.append(cur)
            layers = parts.map { layer in
                let t = layer.trimmingCharacters(in: .whitespaces), close = t.firstIndex(of: ")")!
                let rest = numbers(String(t[t.index(after: close)...]))
                return [rest[0], rest[1], rest.count > 2 ? rest[2] : 0, rest.count > 3 ? rest[3] : 0] + pre(color(String(t[...close])))
            }
        }
        while layers.count < 2 { layers.append([0, 0, 0, 0, 0, 0, 0, 0]) }
        return layers.flatMap { $0 }
    }
    static func nativeShadow(_ v: AWCValue?) -> [Double] {
        let n = v?.array.compactMap(\.number) ?? []
        var layers = stride(from: 0, to: n.count, by: 8).map { i in Array(n[i..<(i + 4)]) + pre(Array(n[(i + 4)..<(i + 8)])) }
        while layers.count < 2 { layers.append([0, 0, 0, 0, 0, 0, 0, 0]) }
        return layers.flatMap { $0 }
    }
    /// md-ripple growth: cubic-bezier(0.2, 0, 0, 1) of the clamped progress.
    static func rippleCurve(_ x: Double) -> Double {
        let p = min(1, max(0, x)); var lo = 0.0, hi = 1.0
        func bx(_ u: Double) -> Double { 3 * (1 - u) * (1 - u) * u * 0.2 + 3 * (1 - u) * u * u * 0 + u * u * u }
        func by(_ u: Double) -> Double { 3 * (1 - u) * u * u * 1 + u * u * u }
        for _ in 0..<60 { let mid = (lo + hi) / 2; if bx(mid) < p { lo = mid } else { hi = mid } }
        return by((lo + hi) / 2)
    }
    struct Sample { let t: Double; let chipT: Double?; let layerT: Double?; let rippleT: Double?; let chip: [String: AWCValue]; let layer: Double?; let ripple: [String: AWCValue]?; let frame: CGRect? }
    static func sample() -> Sample {
        let m = state.measurements, chip = m.first { $0.name == "md-chip" }, layer = m.first { $0.name == "state-layer" }, ripple = m.first { $0.name == "ripple" }
        return .init(t: now(), chipT: chip?.metrics["renderTime"]?.number, layerT: layer?.metrics["renderTime"]?.number, rippleT: ripple?.metrics["renderTime"]?.number,
                     chip: chip?.metrics ?? [:], layer: layer?.metrics["opacity"]?.number, ripple: ripple?.metrics, frame: chip?.bounds)
    }
    /// Native focus ids → the source's `document.activeElement` / shadow active element names.
    static func webFocusName(_ native: String, hostIsButton: Bool) -> String {
        switch native { case "chip": return hostIsButton ? "chip" : "md-chip__primary"; case "chip.remove": return "md-chip__remove"; case "before", "after": return native; default: return "body" }
    }
    static func run(_ r: AWCValue, shots: URL, reduced: Bool) {
        let name = r["name"].string, scenario = r["scenario"].string, label = (reduced ? "reduced/" : "") + name
        state.reduced = reduced; state.run = r; state.selected = r["selected"] == .bool(true); state.removed = false
        state.pointer.update(phase: .leave); state.epoch += 1; pump(0.35)
        _ = window.makeFirstResponder(nil); state.events = []; pump(0.05)
        let rest = r["rest"], body = CGPoint(x: r["pointer"]["body"].array[0].number!, y: r["pointer"]["body"].array[1].number!)
        let remove = r["pointer"]["remove"] == .null ? body : CGPoint(x: r["pointer"]["remove"].array[0].number!, y: r["pointer"]["remove"].array[1].number!)
        let away = CGPoint(x: 1190, y: 600)
        if let f = sample().frame { check(abs(f.minX - rest["x"].number!) <= 0.6 && abs(f.minY - rest["y"].number!) <= 0.6 && abs(f.width - rest["width"].number!) <= 1.0 && abs(f.height - rest["height"].number!) <= 0.6, "\(label) rest box \(f) vs \(rest)") }
        else { check(false, "\(label) chip measured") }
        let hostIsButton = sample().chip["role"]?.string == "button"
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q) }
        #if os(iOS)
        // iOS harness: the host pointer goes down / up when UIKit delivers the touch (a frame or two after it is queued), the
        // order AppKit's synchronous sendEvent gives on macOS. Updated at queue time it was down for frames on either side of
        // the touch, so a click painted :active where Chrome's does not (gate-7 r3-22, R4-11).
        func down(_ q: CGPoint) { AWCShimTouch.pointerDown({ state.pointer.update(phase: .down, location: q) }) { mouse(.leftMouseDown, q) } }
        func up(_ q: CGPoint) { AWCShimTouch.pointerUp({ state.pointer.update(phase: .up, location: q) }) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q) } }
        #else
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        #endif
        func leave() { hoverTo(away); state.pointer.update(phase: .leave) }
        typealias Step = (Double, () -> Void)
        let tab: [Step] = [(0, { key(48, "\t") })], enter: [Step] = [(0, { key(36, "\r") })], space: [Step] = [(0, { key(49, " ") })]
        let delete: [Step] = [(0, { key(117, "\u{F728}") })], backspace: [Step] = [(0, { key(51, "\u{7F}") })]
        var actions: [String: [Step]] = [
            "hover": [(0, { hoverTo(body) })], "hover2": [(0, { hoverTo(body) })], "hoverBody": [(0, { hoverTo(body) })], "hoverRemove": [(0, { hoverTo(remove) })],
            "press": [(0, { down(body) })], "release": [(0, { up(body) })], "pressRemove": [(0, { down(remove) })], "releaseRemove": [(0, { up(remove) })],
            "leave": [(0, { leave() })], "leave2": [(0, { leave() })],
            "click2": [(0, { down(body); up(body) })], "clickBody": [(0, { down(body); up(body) })],
            "tab": tab, "tabRemove": tab, "tabAway": tab, "enter": enter, "enterRemove": enter, "space": space, "spaceRemove": space,
            "delete": delete, "deleteRemove": delete, "backspace": backspace,
            "shiftTab": [(0, { key(48, "\u{19}", .shift) })], "arrow": [(0, { key(124, "\u{F703}") })],
        ]
        if scenario == "removeClick" { actions["pressRemove"] = [(0, { hoverTo(remove); down(remove) })] }
        var clickStarts: [Double] = []
        var samples: [Sample] = [], stepTimes: [(Double, Double)] = [], snaps: [(Int, NativeChipPaintShot, [String: AWCValue], CGRect?, String, Bool)] = []
        var windowShots: [Int: [(Double, NativeChipPaintShot)]] = [:]
        let t0 = now()
        for (i, phase) in phases.enumerated() {
            let lbl = phase["label"].string, start = phase["t"].number! - webT0
            // The source focuses #before ahead of every first Tab.
            if lbl == "tab" { leave(); _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            while now() - t0 < start { pump(0.004); samples.append(sample()) }
            if let late = Self.probeLate[lbl] { let w = now(); while now() - w < late { pump(0.004); samples.append(sample()) } }
            let nativeStart = now(); stepTimes.append((phase["t"].number!, nativeStart))
            if lbl == "click2" || lbl == "clickBody" { clickStarts.append(nativeStart) }
            var queue = actions[lbl] ?? []
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! - webT0 : start + 500, end = next - 25
            let clipRect = CGRect(x: r["clip"]["x"].number!, y: r["clip"]["y"].number!, width: r["clip"]["width"].number!, height: r["clip"]["height"].number!)
            // Chrome photographs a phase after its last sample and before the next phase begins (states.html `phase()`:
            // samples, one more sample, `oracleShot`, then the next `phase()` reads its start time; a Tab phase first runs
            // `focusBefore`). The captured frame therefore lies in (last sample, next start); the native candidates cover
            // the same window every 6 ms, so a transition that runs across the gap (a wave fading 450 ms after a click)
            // is compared at the same moments Chrome could have photographed.
            let windowEnd = next - (i + 1 < phases.count && phases[i + 1]["label"].string == "tab" ? 33 : 3)
            let lastWeb = (phase["samples"].array.last?["t"].number).map { $0 - webT0 } ?? end
            var shotTimes = Array(stride(from: max(start, min(lastWeb, end)), through: windowEnd, by: 6.0)), candidates: [(Double, NativeChipPaintShot)] = []
            var snapped = false
            // Shot times run on the native input's clock (Chrome photographs a fixed time after its own phase start): a phase
            // whose input starts late because the previous window's captures overran (an iOS hierarchy capture takes several
            // ms) keeps its shots at the same distance from its input (gate-7 R4-11). AWC_CHIP_STATES_SHOT_ANCHOR=t0: the old timing.
            let late = Self.shotsAnchoredToRunStart ? 0 : nativeStart - t0 - start
            func clock() -> Double { now() - t0 - late }
            while clock() < windowEnd {
                while let first = queue.first, now() - nativeStart >= first.0 { first.1(); queue.removeFirst() }
                if !snapped && clock() >= end {
                    let s = sample(); snaps.append((i, capture(clipRect), s.chip, s.frame, focusedID(), state.selected)); snapped = true
                }
                if let due = shotTimes.first, clock() >= due {
                    let at = clock(); candidates.append((at - start + phase["t"].number!, capture(clipRect))); shotTimes.removeAll { $0 <= at }
                }
                pump(0.004); samples.append(sample())
            }
            if Self.timingLog { print(String(format: "CHIPTIMING %@/%@ input late %.1f ms", label, lbl, nativeStart - t0 - start)) }
            if !snapped { let s = sample(); snaps.append((i, capture(clipRect), s.chip, s.frame, focusedID(), state.selected)) }
            windowShots[i] = candidates
        }
        let tail = now(); while now() - tail < 150 { pump(0.004); samples.append(sample()) }
        // Diagnostics (AWC_CHIP_STATES_TRACE=<run name part>): the native wave and state layer per sample, in web time.
        if let trace = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_TRACE"], name.contains(trace) {
            report.append(["case": label + "/trace", "samples": samples.map { s -> [String: Any] in
                ["t": s.t - t0 + webT0, "ripple": s.ripple.map { ["opacity": $0["opacity"]?.number ?? -1, "scale": $0["scale"]?.number ?? -1] } ?? [:] as [String: Any],
                 "rippleT": s.rippleT.map { $0 - t0 + webT0 } ?? -1, "layer": s.layer ?? -1] }])
        }
        // Events: mdSelect / mdClick / mdRemove in order, detail and default-prevented state (DOM click entries excluded).
        let web = r["events"].array.filter { $0["name"].string != "click" }
        check(state.events.map(\.0) == web.map { $0["name"].string }, "\(label) events \(state.events.map(\.0)) vs \(web.map { $0["name"].string })")
        for (e, w) in zip(state.events, web) {
            if e.0 == "mdSelect" { check(e.1["selected"] == w["detail"]["selected"], "\(label) mdSelect.selected \(e.1["selected"]) vs \(w["detail"]["selected"])") }
            check(e.2 == (w["prevented"] == .bool(true)), "\(label) \(e.0) prevented \(e.2) vs \(w["prevented"])")
        }
        // Phase end states: presence, geometry, focus, rings, selection, pressed state.
        var pending: [(String, NativeChipPaintShot, Int)] = []
        for (i, shot, chip, frame, focused, selected) in snaps {
            let ph = phases[i], snap = ph["snap"], lbl = ph["label"].string
            if snap["connected"] == .bool(false) { check(frame == nil, "\(label)/\(lbl) chip removed (\(frame.map { "\($0)" } ?? "nil"))"); continue }
            if let f = frame { check(abs(f.minX - snap["rect"]["x"].number!) <= 0.6 && abs(f.minY - snap["rect"]["y"].number!) <= 0.6 && abs(f.width - snap["rect"]["width"].number!) <= 1.0, "\(label)/\(lbl) box \(f) vs \(snap["rect"])") }
            else { check(false, "\(label)/\(lbl) box measured") }
            let webFocus = snap["active"].string, nativeFocus = webFocusName(focused, hostIsButton: hostIsButton)
            check(nativeFocus == webFocus || (webFocus == "body" && !["chip", "md-chip__primary", "md-chip__remove"].contains(nativeFocus)), "\(label)/\(lbl) focus \(focused) vs \(webFocus)")
            check((chip["hostRing"]?.bool ?? false) == (snap["focusRing"]["style"].string == "solid"), "\(label)/\(lbl) host ring \(chip["hostRing"] ?? .null) vs \(snap["focusRing"]["style"].string)")
            check((chip["primaryRing"]?.bool ?? false) == (snap["primaryRing"]["style"].string == "solid"), "\(label)/\(lbl) primary ring \(chip["primaryRing"] ?? .null) vs \(snap["primaryRing"]["style"].string)")
            check((chip["removeRing"]?.bool ?? false) == (snap["removeRing"]["style"].string == "solid"), "\(label)/\(lbl) remove ring \(chip["removeRing"] ?? .null) vs \(snap["removeRing"]["style"].string)")
            check(selected == (snap["selected"] == .bool(true)), "\(label)/\(lbl) selected \(selected) vs \(snap["selected"])")
            let pressed = snap["ariaPressed"] == .null ? "" : snap["ariaPressed"].string
            check(chip["pressedState"]?.string == pressed, "\(label)/\(lbl) pressed state \(chip["pressedState"] ?? .null) vs \(pressed)")
            if ph["shot"] == .bool(true) { pending.append(("\(label)/\(lbl)", shot, i)) }
        }
        // Per-frame values at render time within Chrome's samples (±2 frames; monotone envelope across gaps > 2 frames).
        var webSamples = phases.flatMap { $0["samples"].array }.filter { $0["connected"] == .bool(true) }
        if let first = webSamples.first {
            var seed = first.object, start = first["t"].number!
            for a in r["anims"].array where a["phase"].string == phases[0]["label"].string && a["startTime"] != .null {
                start = min(start, a["startTime"].number!)
                if a["target"].string == "state-layer" && a["property"].string == "opacity" { var l = first["layer"].object; l["opacity"] = .number(Double(a["from"]["opacity"].string) ?? 0); seed["layer"] = .object(l) }
                if a["target"].string == "host" && a["property"].string == "box-shadow" { seed["shadow"] = a["from"]["boxShadow"] }
                if a["target"].string == "host" && a["property"].string == "background-color" { seed["background"] = a["from"]["backgroundColor"] }
                if a["target"].string == "host" && a["property"].string == "color" { seed["color"] = a["from"]["color"] }
            }
            seed["t"] = .number(min(start, first["t"].number!)); seed["waves"] = .array([])
            webSamples.insert(.object(seed), at: 0)
        }
        guard !webSamples.isEmpty else { return }
        func webTime(_ native: Double) -> Double { guard let step = stepTimes.last(where: { $0.1 <= native }) else { return webT0 + native - t0 }; return step.0 + native - step.1 }
        // iOS (gate-7 R4-11 ripple-fade samples): a phase input the harness dispatched late (the window before it ran over
        // with captures) re-anchors the web clock by that slip for every sample after it, though the md-ripple wave is timed
        // from the press that started it (450 ms grow, then the 150 ms fade) and runs across the next phases; the end of a
        // window just before a slipped step is folded back the same way. For the wave's values, within 600 ms after a step
        // that slipped against the step before it, the window also reads Chrome's values on the previous step's clock (SLIP
        // lines: samples that matched only there). Other properties follow their own step's input: one clock. AWC_CHIP_STATES_SLIP=0: one
        // clock. macOS: one clock.
        var slipRescued = 0
        func webTimes(_ native: Double) -> [Double] {
            guard let k = stepTimes.lastIndex(where: { $0.1 <= native }) else { return [webT0 + native - t0] }
            var times = [stepTimes[k].0 + native - stepTimes[k].1]
            #if os(iOS)
            if Self.slipWindow, k > 0, native - stepTimes[k].1 < 600 {
                let p = stepTimes[k - 1], slip = (stepTimes[k].1 - p.1) - (stepTimes[k].0 - p.0)
                if abs(slip) > 2 { times.append(p.0 + native - p.1) }
            }
            #endif
            return times
        }
        #if os(iOS)
        func noteSlip(_ prop: String, _ v: [Double], _ at: Double, _ lo: [Double], _ hi: [Double], _ lo1: [Double]?, _ hi1: [Double]?, _ tol: Double) {
            guard (0..<v.count).allSatisfy({ v[$0] >= lo[$0] - tol && v[$0] <= hi[$0] + tol }) else { return }
            if let lo1, let hi1, (0..<v.count).allSatisfy({ v[$0] >= lo1[$0] - tol && v[$0] <= hi1[$0] + tol }) { return }
            slipRescued += 1
            if slipRescued <= 6 { print("SLIP \(label) \(prop) rendered \(v) at web \(webTime(at)): within Chrome [\(lo), \(hi)] on the previous step's clock (step clock only: [\(lo1.map { "\($0)" } ?? "none"), \(hi1.map { "\($0)" } ?? "none")])"); fflush(stdout) }
        }
        #endif
        func envelope(_ read: (AWCValue) -> [Double]?, _ t: Double) -> ([Double], [Double])? {
            // Past Chrome's last sample there is no source value (a ripple still growing when the chip is removed).
            guard let after = webSamples.firstIndex(where: { $0["t"].number! >= t }) else { return t <= webSamples.last!["t"].number! + 17 ? read(webSamples.last!).map { ($0, $0) } : nil }
            if after == 0 { return read(webSamples[0]).map { ($0, $0) } }
            let a = webSamples[after - 1], b = webSamples[after], ta = a["t"].number!, tb = b["t"].number!
            guard let va = read(a), let vb = read(b), va.count == vb.count else { return read(b).map { ($0, $0) } }
            if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
            let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
        }
        typealias Prop = (String, Double, (AWCValue) -> [Double]?, (Sample) -> (Double?, [Double]?))
        var props: [Prop] = []
        props.append(("state layer", 0.004, { s in s["layer"] == .null || s["layer"]["display"].string == "none" ? nil : [s["layer"]["opacity"].number ?? 0] }, { s in (s.layerT, s.layer.map { [$0] }) }))
        props.append(("shadow", 0.02, { s in shadow(s["shadow"].string) }, { s in (s.chipT, s.chipT == nil ? nil : nativeShadow(s.chip["shadow"])) }))
        props.append(("container", 0.008, { s in pre(color(s["background"].string)) }, { s in
            guard let c = s.chip["background"]?.array.compactMap(\.number), c.count == 4 else { return (nil, nil) }
            return (s.chipT, pre(c)) }))
        props.append(("label ink", 0.008, { s in pre(color(s["color"].string)) }, { s in
            guard let c = s.chip["color"]?.array.compactMap(\.number), c.count == 4 else { return (nil, nil) }
            return (s.chipT, pre(c)) }))
        props.append(("ripple opacity", 0.006, { s in s["waves"].array.first.map { [$0["opacity"].number ?? 0] } ?? [0] }, { s in (s.rippleT, [s.ripple?["opacity"]?.number ?? 0]) }))
        props.append(("ripple scale", 0.02, { s in s["waves"].array.first.map { [numbers($0["transform"].string).first ?? 1] } }, { s in
            guard let r = s.ripple, (r["opacity"]?.number ?? 0) > 0, let k = r["scale"]?.number else { return (nil, nil) }
            return (s.rippleT, [k]) }))
        var compared: [String: Int] = [:], transient = 0
        let waveStart = phases.flatMap { $0["samples"].array }.first { s in s["waves"].array.first.map { numbers($0["transform"].string).first == 0 } ?? false }?["t"].number
        for (prop, tol, readWeb, read) in props {
            for s in samples where s.frame != nil {
                let (time, value) = read(s); guard let v = value else { continue }
                let at = time ?? s.t
                // Chrome's press and release of a click arrive within one frame (no :active style recalc); AppKit
                // renders between the native mouse-down and mouse-up, so the state layer may start toward the press
                // value for that frame. It must be back within Chrome's envelope 80 ms after the click.
                if prop == "state layer" && clickStarts.contains(where: { at >= $0 && at < $0 + 80 }) { transient += 1; continue }
                var lo: [Double]? = nil, hi: [Double]? = nil, x = at - 34
                #if os(iOS)
                var lo1: [Double]? = nil, hi1: [Double]? = nil
                #endif
                while x <= at + 40 {
                    let times = prop.hasPrefix("ripple") ? webTimes(x) : [webTime(x)]
                    for j in times.indices { if let e = envelope(readWeb, times[j]), e.0.count == v.count {
                        lo = zip(lo ?? e.0, e.0).map { min($0, $1) }; hi = zip(hi ?? e.1, e.1).map { max($0, $1) }
                        #if os(iOS)
                        if j == 0 { lo1 = zip(lo1 ?? e.0, e.0).map { min($0, $1) }; hi1 = zip(hi1 ?? e.1, e.1).map { max($0, $1) } }
                        #endif
                    } }
                    x += 2
                }
                guard let lo, let hi else { continue }
                #if os(iOS)
                noteSlip(prop, v, at, lo, hi, lo1, hi1, tol)
                #endif
                var ok = (0..<v.count).allSatisfy { v[$0] >= lo[$0] - tol && v[$0] <= hi[$0] + tol }
                // Chrome's computed transform of a compositor-driven wave can lag its own animation clock by frames
                // (a plateau before the phase screenshot): the wave's md-ripple curve from its first sampled frame
                // (scale 0, ±1 frame) is the source value then.
                if !ok && prop == "ripple scale", let start = waveStart {
                    ok = stride(from: -17.0, through: 17.0, by: 1).contains { d in abs(v[0] - rippleCurve((webTime(at) - start + d) / 450)) <= tol }
                }
                check(ok, "\(label) \(prop) rendered \(v) at web \(webTime(at)) within Chrome [\(lo), \(hi)]")
                compared[prop, default: 0] += 1
            }
        }
        #if os(iOS)
        if slipRescued > 0 { print("SLIP \(label): \(slipRescued) samples matched on the previous step's clock; step slips (ms) \(zip(stepTimes, stepTimes.dropFirst()).map { String(format: "%.1f", ($1.1 - $0.1) - ($1.0 - $0.0)) }.joined(separator: " "))"); fflush(stdout) }
        #endif
        check((compared["container"] ?? 0) > 30, "\(label) per-frame samples compared \(compared)")
        // Ripple geometry: physical origin and diameter of the first wave.
        // A keyboard activation that widens a filter chip keeps the wave at the pre-toggle box, as Chrome does (gate-7 R4-10).
        if let w = phases.flatMap({ $0["samples"].array }).compactMap({ $0["waves"].array.first }).first, let n = samples.compactMap(\.ripple).first(where: { ($0["opacity"]?.number ?? 0) > 0 }) {
            let size = numbers(w["size"].string)[0], left = numbers(w["left"].string)[0], top = numbers(w["top"].string)[0]
            check(abs((n["diameter"]?.number ?? 0) - size) < 1.0 && abs((n["x"]?.number ?? 0) - (left + size / 2)) < 0.6 && abs((n["y"]?.number ?? 0) - (top + size / 2)) < 0.6,
                  "\(label) ripple origin/diameter (\(n["x"] ?? .null),\(n["y"] ?? .null)) \(n["diameter"] ?? .null) vs (\(left + size / 2),\(top + size / 2)) \(size)")
        }
        // Source timings: state layer 50 ms (short1), host colours / shadow 100 ms (short2), none under reduced motion.
        for a in r["anims"].array where a["target"].string != "wave" {
            let d = a["duration"].number!, expected = a["target"].string == "state-layer" ? 50.0 : 100
            check(!reduced && d == expected, "\(label) \(a["target"].string) \(a["property"].string) duration \(d) is the native timing \(reduced ? 0 : expected)")
            check(a["easing"].string == "cubic-bezier(0.2, 0, 0, 1)", "\(label) easing \(a["easing"].string)")
        }
        // Phase paint.
        let clip = r["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        for (lbl, primary, index) in pending {
            let phase = lbl.split(separator: "/").last.map(String.init) ?? ""
            guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + "-" + phase + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(lbl) shot"); continue }
            let web = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch)
            // The phase-end snapshot first, then the frames across Chrome's capture window (see the phase loop).
            let options: [(Double?, NativeChipPaintShot)] = [(nil, primary)] + (windowShots[index] ?? []).map { (Optional($0.0), $0.1) }
            var best: (ok: Bool, n: Int, bad: Int, mean: Double, worst: Double, worstAt: String, at: Double?, shot: NativeChipPaintShot)? = nil
            for (at, shot) in options {
                let nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
                var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
                for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where web.flat(px, py, 6) && nat.flat(px, py, 6) {
                    var d = 0.0; let a = web.at(px, py), b = nat.at(px, py); for c in 0..<3 { d = max(d, abs(a[c] - b[c])) }
                    n += 1; sum += d; if d > 6 { bad += 1 }; if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
                } }
                let mean = sum / Double(max(n, 1)), ok = n > 1000 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0
                if best == nil || (ok && !(best!.ok)) || (ok == best!.ok && mean < best!.mean) { best = (ok, n, bad, mean, worst, worstAt, at, shot) }
                if ok && at == nil { break }
            }
            let b = best!
            var matched = b.ok, between = ""
            #if os(iOS)
            let frames = (windowShots[index] ?? []).sorted { $0.0 < $1.0 }
            if !b.ok, Self.bracketFallback, frames.count > 1,
               let m = Self.bracket(web, frames.map { (at: $0.0, grid: grid($0.1, x: cx, y: cy, w: cw, h: ch)) }, minCompared: 1000) {
                print(String(format: "BRACKET %@ %@: Chrome's frame between native frames at web %.1f and %.1f (signed %.2f / %.2f), blend w %.2f: mean %.3f, >6: %ld/%ld (best single frame mean %.3f)", lbl, m.ok ? "match" : "no match", m.a, m.b, m.sa, m.sb, m.w, m.mean, m.bad, m.n, b.mean)); fflush(stdout)
                if m.ok { matched = true; between = String(format: "; Chrome's frame between native frames at web %.1f and %.1f (blend w %.2f: mean %.3f, >6: %ld/%ld)", m.a, m.b, m.w, m.mean, m.bad, m.n) }
            }
            #endif
            check(matched, "\(lbl) flat pixels match (mean \(b.mean), >6: \(b.bad)/\(b.n), worst \(b.worst) at \(b.worstAt); best of \(options.count) frames in Chrome's capture window\(between))")
            if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: b.shot.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(lbl.replacingOccurrences(of: "/", with: "-") + ".png")) }
            report.append(["case": lbl, "compared": b.n, "mean": b.mean, "over6": b.bad, "worst": b.worst, "worstAt": b.worstAt,
                           "frame": b.at.map { $0 as Any } ?? "phase end", "windowFrames": options.count - 1])
        }
        report.append(["case": label, "samples": samples.count, "compared": compared, "transientPressSamples": transient])
        state.pointer.update(phase: .leave); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ChipStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_ONLY"]
        for (file, reduced) in [("chip-web-states", false), ("chip-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, shots: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_CHIP_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Chip native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
