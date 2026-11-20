import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-autocomplete interaction and motion against Chrome 153 (Mac oracle: outputs/native-parity/md-autocomplete/web-oracle/
// web-states(-reduced).json, 8 runs each from picker-states.html, LTR and RTL): typing opens and filters without moving focus
// (one mdInput per key, "{count} suggestions available"), ArrowDown moves real focus into the list, Enter picks, Backspace
// reopens, Escape snaps the text back; multiple (stays open, clears the text, chips, Backspace removes the last chip, clear);
// Tab while open; free solo (No results, Enter commits). Per phase: open state, value, input text, caret rotation, listbox
// surface (opacity, scaleY, box), focus, rows (labels, selection, roving row), chips, the live status, per-frame motion inside
// Chrome's ±2-frame envelope, md* events (order, time, detail) and the phase-end pixels.
@MainActor @Observable final class ACStatesState {
    var c: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var registry = AWCMenuRegistry()
    var pointer = AWCNativePointerState()
    var controller = AWCAutocompleteController()
}
struct ACStatesFixture: View {
    let state: ACStatesState
    let onEvent: (AWCEvent) -> Void
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func nodes(_ c: AWCValue) -> [AWCNode] { c["nodes"].array.compactMap { v in (try? JSONEncoder().encode(v)).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } } }
    var body: some View {
        let c = state.c, epoch = state.epoch
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        let host = Self.rect(c["host"]), rtl = c["dir"].string == "rtl"
        let nodes = Self.nodes(c)
        return AWCMenuScope(registry: state.registry) {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE").frame(maxWidth: .infinity, maxHeight: .infinity)
                ForEach(nodes) { n in
                    AWCNativeView(node: n, onEvent: onEvent)
                        .frame(width: c["width"].number ?? 320, alignment: rtl ? .topTrailing : .topLeading)
                        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                        .padding(.leading, 24).padding(.top, host.minY)
                }
                // The oracle page's next focusable lies outside the fixture: Tab from the select leaves it.
                AWCTabSentinel().frame(width: 1, height: 1).position(x: 1190, y: 890)
            }
        }
        .awcMenuReducedMotion(state.reduced)
        .awcFieldReducedMotion(state.reduced)
        .environment(\.awcNativePointerState, state.pointer)
        .awcTheme(theme)
        .awcAutocompleteController(state.controller, for: "m")
        .awcNativeInspection(rootID: (["m", "m::menu", "m::clear"] + (0..<8).map { "m::opt\($0)" } + (0..<8).map { "m::chip\($0)" }).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 1200, height: vp.last ?? 900, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct ACSample { var t: Double; var open: Bool; var value: AWCValue; var input: String; var caret: Double; var opacity: Double; var scaleY: Double; var surface: CGRect?; var focus: String; var roving: String?
    var rows: [(String, Bool)]; var chips: [String]; var live: String }
struct ACStatesGrid {
    let w: Int, h: Int; var v: [Float]
    func flat(_ px: Int, _ py: Int, _ limit: Float) -> Bool {
        guard px >= 1 && py >= 1 && px + 1 < w && py + 1 < h else { return false }
        for k in 0..<3 {
            var lo: Float = 999, hi: Float = -1
            for y in (py - 1)...(py + 1) { for x in (px - 1)...(px + 1) { let q = v[(y * w + x) * 3 + k]; lo = min(lo, q); hi = max(hi, q) } }
            if hi - lo > limit { return false }
        }
        return true
    }
    func at(_ px: Int, _ py: Int) -> [Int] { let i = (py * w + px) * 3; return [Int(v[i]), Int(v[i + 1]), Int(v[i + 2])] }
}
// A key-capable offscreen window: keys reach the first responder through NSApp (as n3's field harnesses do).
#if canImport(AppKit)
final class ACKeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
/// Takes the first click even while the window is not key: a locked console keeps the app inactive, so the window never
/// becomes key and AppKit would swallow every click as the activating one (SwiftUI's gestures never see it).
final class ACHostingView<V: View>: NSHostingView<V> { override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true } }
#else
typealias ACKeyWindow = NSWindow
typealias ACHostingView<V: View> = NSHostingView<V>
#endif
/// A focusable 1 pt view after the fixture in the key-view loop.
#if canImport(AppKit)
struct AWCTabSentinel: NSViewRepresentable {
    // An NSTextField: always part of AppKit's recalculated key-view loop.
    final class V: NSTextField { override func accessibilityIdentifier() -> String { "tab-sentinel" } }
    func makeNSView(context: Context) -> V { let v = V(string: ""); v.isBordered = false; v.drawsBackground = false; return v }
    func updateNSView(_ v: V, context: Context) {}
}
#else
struct AWCTabSentinel: View { var body: some View { Color.clear } }
#endif
@main @MainActor enum NativeAutocompleteStatesIntegration {
    static let state = ACStatesState()
    static var host: NSHostingView<ACStatesFixture>!, window: ACKeyWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var events: [(name: String, t: Double, detail: AWCValue)] = []
    static var t0 = 0.0
    static var options: [(label: String, value: String)] = []
    /// The row (`m::opt<i>`, an index into the filtered list) that shows `label`, from the menu's own row registry.
    static func rowID(_ label: String) -> String? { state.registry.controllers["m::menu"].flatMap { c in c.rowOrder.first { c.rows[$0]?.label == label } } }
    static func rowLabel(_ id: String) -> String? { state.registry.controllers["m::menu"]?.rows[id]?.label }
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 - t0 }
    /// iOS: when each press, release, key-down and key-up was queued, paired in order with the harness's delivery stamps
    /// (`AWCShimTouch.deliveredAt`: one per delivered touch phase / press), as the time-picker states fixture does.
    static var queuedAt: [Double] = []
    /// iOS: (delivery time on the run clock, delay after queueing) of each delivered input of the run.
    static var deliveries: [(at: Double, delay: Double)] = []
    /// The delivery delay of the latest input delivered by `t` (run clock) within the last 400 ms; 0 on macOS.
    static func deliveryDelay(at t: Double) -> Double { deliveries.last { $0.at <= t + 0.5 && t - $0.at < 400 }?.delay ?? 0 }
    static func queued() {
        #if canImport(UIKit)
        queuedAt.append(CACurrentMediaTime() * 1000)
        #endif
    }
    static func m(_ id: String, _ part: String? = nil) -> AWCNativeInspectionNode? { state.measurements.first { $0.id == id + ":component" + (part.map { "." + $0 } ?? "") } }
    static func event(_ kind: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        let point = host.convert(CGPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        return NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!
    }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let e = event(kind, p)
        switch kind { case .leftMouseDown: queued(); state.pointer.update(phase: .down, location: p); case .leftMouseUp: queued(); state.pointer.update(phase: .up, location: p); default: state.pointer.update(phase: .move, location: p) }
        NSApp.postEvent(e, atStart: false); pump(0.001)
    }
    static let codes: [String: (UInt16, String)] = ["ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"), "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}"),
                                                    "Escape": (53, "\u{1B}"), "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Tab": (48, "\t"), "Enter": (36, "\r"), " ": (49, " "), "Backspace": (51, "\u{7F}")]
    static let letterCodes: [Character: UInt16] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
                                                   "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46]
    static func key(_ k: String) {
        let (code, text) = codes[k] ?? ((k.count == 1 ? letterCodes[Character(k.lowercased())] : nil) ?? 0, k)
        let flags: NSEvent.ModifierFlags = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].contains(k) ? [.function, .numericPad] : ["Home", "End"].contains(k) ? [.function] : []
        // Dispatched through the event queue of the key window, as real input is: the text system reads NSApp.currentEvent
        // (the dequeued event) for the key behind a command such as moveDown:, and md-select's key monitor sees it.
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            queued()
            NSApp.postEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                             context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!, atStart: false)
        }
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    static func center(_ target: String) -> CGPoint? {
        if target == "field", let r = m("m", "field")?.bounds { return .init(x: r.midX, y: r.midY) }
        if target.hasPrefix("row:"), let id = rowID(String(target.dropFirst(4))), let r = m(id)?.bounds { return .init(x: r.midX, y: r.midY) }
        if target == "clear", let r = m("m", "clear")?.bounds { return .init(x: r.midX, y: r.midY) }
        if target.hasPrefix("chip-remove:"), let k = Int(target.dropFirst(12)) {
            if let r = m("m::chip\(k)", "remove")?.bounds { return .init(x: r.midX, y: r.midY) }
            // The chip's trailing remove target (18 px icon, 8 px end padding).
            if let r = m("m", "chip-\(k)")?.bounds { return .init(x: state.c["dir"].string == "rtl" ? r.minX + 17 : r.maxX - 17, y: r.midY) }
        }
        return nil
    }
    /// A typing phase's schedule: the k-th character at the time of Chrome's k-th mdInput in the phase (Chrome types
    /// "kiwi" at +0, +17, +50, +83 ms); without one, 20 ms apart.
    static var typeSchedule: [Double] = []
    static func act(_ a: AWCValue) {
        switch a["kind"].string {
        case "click", "move":
            var p: CGPoint? = a["point"].array.count == 2 ? CGPoint(x: a["point"].array[0].number ?? 0, y: a["point"].array[1].number ?? 0) : center(a["target"].string)
            if a["kind"].string == "move", let r = m("m", "field")?.bounds { p = CGPoint(x: r.minX + (a["dx"].number ?? 0), y: r.minY + (a["dy"].number ?? 0)) }
            guard let p else { check(false, "target \(a["target"].string) not found"); return }
            if ProcessInfo.processInfo.environment["AWC_AC_EVENTS"] != nil {
                let hit = window.contentView?.hitTest(event(.leftMouseDown, p).locationInWindow)
                print("    click \(a["target"].string) at \(p) focus \(focusName()) responder \(String(describing: window.firstResponder.map { type(of: $0) })) hit \(String(describing: hit.map { type(of: $0) })) rows \(state.registry.controllers["m::menu"]?.rowOrder ?? [])"); fflush(stdout)
            }
            // Chrome's trusted click: move, press 67 ms later, release 33 ms after that (the oracle's CDP round trips).
            let begin = now()
            while now() < begin + 33 { pump(0.002) }; mouse(.mouseMoved, p)
            if a["kind"].string == "click" {
                while now() < begin + 67 { pump(0.002) }
                // AppKit text views track a press in a nested event loop (the read-only trigger is one): the release is
                // posted from the main queue, which that loop also services, at Chrome's release time, so it ends the loop.
                DispatchQueue.main.asyncAfter(deadline: .now() + max(0.001, (begin + 100 - now()) / 1000)) {
                    queued(); state.pointer.update(phase: .up, location: p); NSApp.postEvent(event(.leftMouseUp, p), atStart: false)
                }
                // The press goes through the queue too (the menu scope's click observers are local event monitors).
                queued(); state.pointer.update(phase: .down, location: p); NSApp.postEvent(event(.leftMouseDown, p), atStart: false)
                while now() < begin + 104 { pump(0.002) }
                if a["point"].array.count == 2 { window.makeFirstResponder(nil) }
            }
        case "key": key(a["key"].string)
        case "keys": let begin = now(); for k in a["keys"].array { while now() < begin + (k.array.last?.number ?? 0) { pump(0.002) }; key(k.array.first?.string ?? "") }
        case "type":
            let begin = now()
            for (k, ch) in a["text"].string.enumerated() {
                let at = k < typeSchedule.count ? typeSchedule[k] : Double(k) * 20
                while now() < begin + at { pump(0.002) }
                key(String(ch))
            }
            pump(0.02)
        case "focusInput": state.controller.focusInput(); pump(0.01)
        case "tabIn":
            // The oracle tabs into the field: Chrome (as AppKit's key-view loop) selects the input's text.
            _ = state.registry.anchorFocus["m::trigger"]?(); pump(0.01)
            #if canImport(AppKit)
            (window.firstResponder as? NSTextView)?.selectAll(nil)
            #endif
        default: break
        }
    }
    static func focusName() -> String {
        guard let r = window.firstResponder, r !== window else { return "body" }
        #if canImport(AppKit)
        if let tv = r as? NSTextView, let tf = tv.delegate as? NSTextField, tf.accessibilityIdentifier() == "tab-sentinel" { return "body" }
        if (r as? NSView)?.accessibilityIdentifier() == "tab-sentinel" { return "body" }
        if r is NSText { return "field" }
        #else
        if r is UITextField || r is UITextView { return "field" }
        #endif
        if let v = r as? NSView {
            let id = v.accessibilityIdentifier()
            if let label = rowLabel(id) { return "option:" + label }
            if id == "m::clear" { return "clear" }
            if id.hasPrefix("m::chip") { return "chip-remove" }
            if id == "m" { return "field" }
            return id.isEmpty ? String(describing: type(of: r)) : id
        }
        return "body"
    }
    static func sample() -> ACSample {
        let host = m("m")?.metrics ?? [:]
        let motion = m("m::menu", "motion")?.metrics
        let open = host["open"]?.bool ?? false
        let c = state.registry.controllers["m::menu"]
        let roving = c.flatMap { c in c.isOpen ? c.focusedID : nil }.flatMap(rowLabel)
        let value = host["value"] ?? .string("")
        let rows: [(String, Bool)] = (c?.rowOrder ?? []).map { id in (rowLabel(id) ?? "?", m(id)?.metrics["selected"]?.bool ?? false) }
        let chips = (value.array).map { v in options.first { $0.value == v.string }?.label ?? v.string }
        return .init(t: now(), open: open, value: value, input: host["inputValue"]?.string ?? "", caret: m("m", "caret-glyph")?.metrics["rotation"]?.number ?? 0,
                     opacity: motion?["progress"]?.number ?? 0, scaleY: motion?["scaleY"]?.number ?? 0.8, surface: m("m::menu", "surface")?.bounds,
                     focus: focusName(), roving: roving, rows: rows, chips: chips, live: host["status"]?.string ?? "")
    }
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> ACStatesGrid {
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k), cw = cg.width, ch = cg.height
        var v = [Float](repeating: -999, count: w * h * 3)
        for py in 0..<h { for px in 0..<w {
            var r: Float = 0, g: Float = 0, b: Float = 0
            for yy in ((py + y0) * k)..<max((py + y0) * k, min(ch, (py + y0) * k + k)) { for xx in ((px + x0) * k)..<max((px + x0) * k, min(cw, (px + x0) * k + k)) { let i = (yy * cw + xx) * 4; r += Float(buffer[i]); g += Float(buffer[i + 1]); b += Float(buffer[i + 2]) } }
            let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = b / n
        } }
        return .init(w: w, h: h, v: v)
    }
    static func run(_ r: AWCValue, shots: URL, reduced: Bool) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        mouse(.mouseMoved, .init(x: 1190, y: 890)); window.makeFirstResponder(nil)
        state.registry = AWCMenuRegistry(); state.pointer = AWCNativePointerState(); state.reduced = reduced; events = []; deliveries = []
        let nodes = ACStatesFixture.nodes(r)
        options = (nodes.first?.properties["options"]?.array ?? []).map { ($0["label"].string, $0["value"].string) }
        state.controller = AWCAutocompleteController()
        state.c = r; state.epoch += 1; pump(0.6)
        t0 = CACurrentMediaTime() * 1000
        var phaseSamples: [[ACSample]] = [], starts: [Double] = [], phaseShots: [[NSBitmapImageRep]] = []
        let phases = r["phases"].array
        for p in phases {
            let start = p["t"].number ?? 0, duration = p["ms"].number ?? 300
            let lastWeb = p["samples"].array.last?["t"].number ?? start
            while now() < start { pump(0.002) }
            if ProcessInfo.processInfo.environment["AWC_AC_EVENTS"] != nil { print("  phase \(p["label"].string) t=\(Int(now()))"); fflush(stdout) }
            let actual = now(); var samples: [ACSample] = []
            var first = sample(); first.t -= actual; samples.append(first)
            #if canImport(UIKit)
            let qMark = queuedAt.count, dMark = AWCShimTouch.deliveredAt.count
            #endif
            let phaseEnd = start + (p["ms"].number ?? 300)
            typeSchedule = r["events"].array.filter { $0["name"].string == "mdInput" && ($0["t"].number ?? -1) >= start && ($0["t"].number ?? 0) < phaseEnd }.map { ($0["t"].number ?? 0) - start }
            if typeSchedule.count != p["act"]["text"].string.count { typeSchedule = [] }
            act(p["act"])
            var shotTimes: [Double] = []; var at = lastWeb - start + 17
            // One more frame after the phase end: Chrome's capture lands ~4 frames after its last sample, between two native frames.
            while at < duration - 8 { shotTimes.append(at); at += 16 }; shotTimes.append(duration); shotTimes.append(duration + 16)
            var shotsTaken: [NSBitmapImageRep] = []
            let clip = ACStatesFixture.rect(p["clip"]).intersection(host.bounds)
            let clipRect = host.isFlipped ? clip : CGRect(x: clip.minX, y: host.bounds.height - clip.maxY, width: clip.width, height: clip.height)
            while now() < actual + duration || shotsTaken.count < shotTimes.count {
                pump(0.004); var s = sample(); s.t -= actual; samples.append(s)
                if let ct = ProcessInfo.processInfo.environment["AWC_AC_CARET_TRACE"], ct == r["name"].string + (reduced ? "-reduced" : "") + ":" + p["label"].string {
                    print("  caret-trace t=\(Int(s.t)) caret=\(String(format: "%.3f", s.caret)) open=\(s.open) overshoot=\(Int(actual - start))"); fflush(stdout)
                }
                if let tr = ProcessInfo.processInfo.environment["AWC_AC_TRACE"], tr.split(separator: ",").contains(Substring(p["label"].string)), samples.count % 6 == 0 {
                    let row = rowID("Apple").flatMap { m($0) }
                    print("  trace t=\(Int(s.t)) layer=\(row?.metrics["layerOpacity"]?.number ?? -1) ripple=\(state.measurements.filter { $0.id.hasPrefix("m::opt") && $0.id.contains("ripple") }.map { "\($0.id):o=\($0.metrics["opacity"]?.number ?? -1),s=\($0.metrics["scale"]?.number ?? -1)" })"); fflush(stdout)
                }
                if shotsTaken.count < shotTimes.count && now() >= actual + shotTimes[shotsTaken.count] {
                    let b = host.bitmapImageRepForCachingDisplay(in: clipRect)!; host.cacheDisplay(in: clipRect, to: b); shotsTaken.append(b)
                }
            }
            // iOS harness: a synthesized press / key reaches the app when UIKit delivers it (17–36 ms after it is queued, more
            // under load; ios-harness.md item 31). Chrome times its frames and events from its trusted inputs, so a native frame or
            // event is timed back by the delivery delay of the latest input delivered by then (each queued input paired in order
            // with its delivery stamp, as the time-picker states fixture does; AWC_AC_STEP_ANCHOR=queue: the queue time, as on macOS).
            #if canImport(UIKit)
            if ProcessInfo.processInfo.environment["AWC_AC_STEP_ANCHOR"] != "queue" {
                let q = Array(queuedAt[qMark...]), d = Array(AWCShimTouch.deliveredAt[dMark...])
                for (qq, dd) in zip(q, d) where dd - qq >= 0 && dd - qq < 150 { deliveries.append((at: dd - t0, delay: dd - qq)) }
                if ProcessInfo.processInfo.environment["AWC_AC_DELIVERY_DEBUG"] != nil {
                    print("  delivery \(name) \(p["label"].string): queued \(q.map { Int($0 - t0 - actual) }) delivered \(d.map { Int($0 - t0 - actual) })"); fflush(stdout)
                }
            }
            #endif
            for i in samples.indices.dropFirst() { samples[i].t -= deliveryDelay(at: actual + samples[i].t) }
            phaseSamples.append(samples); starts.append(actual); phaseShots.append(shotsTaken)
        }
        for (i, p) in phases.enumerated() { compare(name, p, phaseSamples[i], shots: phaseShots[i], dir: shots) }
        let webEvents = r["events"].array.filter { ($0["t"].number ?? 0) <= (phases.last.map { ($0["t"].number ?? 0) + ($0["ms"].number ?? 0) } ?? 0) }
        let names = events.map(\.name), webNames = webEvents.map { $0["name"].string }
        check(names == webNames, "\(name) events \(names) vs \(webNames)")
        if names == webNames {
            func rel(_ t: Double, _ s: [Double]) -> (Int, Double) { let i = max(0, (s.lastIndex { $0 <= t + 1 }) ?? 0); return (i, t - s[i]) }
            let webStarts = phases.map { $0["t"].number ?? 0 }
            for (e, w) in zip(events, webEvents) {
                let n = rel(e.t - deliveryDelay(at: e.t), starts), wv = rel(w["t"].number ?? 0, webStarts)
                // A phase the oracle page stalled in (over 5 s between its steps, Mac Chrome reduced-motion captures) has no
                // meaningful event time: order and detail are still checked.
                let stalled = wv.0 < phases.count && (phases[wv.0]["ms"].number ?? 0) > 5000
                if !stalled { check(n.0 == wv.0 && abs(n.1 - wv.1) <= 60, "\(name) \(e.name) in phase \(n.0) at +\(Int(n.1)) vs phase \(wv.0) at +\(Int(wv.1)) ms") }
                if e.name == "mdChange" || e.name == "mdInput" { check(e.detail == w["detail"], "\(name) \(e.name) detail \(e.detail) vs \(w["detail"])") }
            }
        }
        report.append(["run": name, "events": names])
        print("run \(name): \(checks - failures.count)/\(checks)"); fflush(stdout)
        for c in state.registry.controllers.values where c.isOpen { c.closeNow() }; pump(0.3); events = []
    }
    /// Oracle capture labels: Chrome's frames of ac-multiple-ltr / escape are labelled one capture slot (33.4 ms) late. The phase
    /// has no +33 frame, and the menu exit's opacity series (0.972, 0.881, 0.698, 0.342) and the caret rotation sit 33 ms after
    /// those of its RTL twin and of every other close, while its mdClose (+166.8, the end of the 150 ms exit) matches them. The
    /// motion check reads that phase's frames 33.4 ms earlier (d4-075 caret envelope; work/d4-lab/ac/PROGRESS.md).
    static let oracleSlotLate: [String: Double] = ["ac-multiple-ltr|escape": 33.4]
    static func compare(_ name: String, _ p: AWCValue, _ samples: [ACSample], shots: [NSBitmapImageRep], dir: URL) {
        let label = p["label"].string, web = p["samples"].array, tag = "\(name) \(label)"
        guard let end = samples.last, let w = web.last else { check(false, "\(tag) no samples"); return }
        check(end.open == (w["open"] == .bool(true)), "\(tag) open \(end.open)")
        check(end.value == w["value"], "\(tag) value \(end.value) vs \(w["value"])")
        check(end.input == w["inputValue"].string, "\(tag) input text \(end.input) vs \(w["inputValue"].string)")
        let wc = w["chips"].array.map { $0.string }
        check(end.chips == wc, "\(tag) chips \(end.chips) vs \(wc)")
        // The live regions Chrome reports: md-menu's empty-text status ("No results", md-menu's own) and the autocomplete's
        // polite status; the autocomplete's is the entry built from its template (or the loading text).
        let wl = w["live"].array.map { $0.string }.last { $0.hasSuffix("suggestions available") || $0 == "Loading…" } ?? ""
        check(end.live == wl, "\(tag) live status \(end.live) vs \(wl)")
        check(abs(end.caret - (w["caret"].number ?? 0)) <= 0.05, "\(tag) caret \(end.caret) vs \(w["caret"].number ?? -1)")
        let webOpacity = w["surface"]["opacity"].number ?? 0
        check(abs(end.opacity - webOpacity) <= 0.02, "\(tag) surface opacity \(end.opacity) vs \(webOpacity)")
        if webOpacity > 0.99, let s = end.surface {
            let wy = w["surface"]["y"].number ?? 0, ww = w["surface"]["w"].number ?? 0, wh = w["surface"]["h"].number ?? 0
            check(abs(s.minY - wy) <= 1 && abs(s.width - ww) <= 1 && abs(s.height - wh) <= 1, "\(tag) surface y/w/h (\(Int(s.minY)),\(Int(s.width)),\(Int(s.height))) vs (\(wy),\(ww),\(wh))")
        }
        // "body": focus left the fixture (the next focusable of the oracle page lies outside it).
        // Decision (source review, "Tab while open"): Chromium makes md-menu's scroll viewport a keyboard-focusable scroller; the
        // native menus have no focusable viewport, so the second Tab leaves the fixture ("body") with the popup still open.
        let wf = w["active"].string == "menu-viewport" ? "body" : w["active"].string
        check(wf == "body" ? !["field", "clear"].contains(end.focus) && !end.focus.hasPrefix("option:") : end.focus == wf, "\(tag) focus \(end.focus) vs \(wf)")
        if w["open"] == .bool(true) {
            let webRows = w["rows"].array.map { "\($0["t"].string)\($0["sel"] == .bool(true) ? "*" : "")" }, rows = end.rows.map { "\($0.0)\($0.1 ? "*" : "")" }
            check(rows == webRows, "\(tag) rows \(rows) vs \(webRows)")
            // The roving row matters once focus is in the list (the source's rows keep tabindex 0 on the first row otherwise).
            if wf.hasPrefix("option:"), let webRoving = w["rows"].array.first(where: { $0["tab"].string == "0" })?["t"].string {
                check(end.roving == webRoving, "\(tag) roving row \(end.roving ?? "nil") vs \(webRoving)")
            }
        }
        // Motion: every Chrome frame inside the native envelope (−40 / +34 ms plus the neighbour samples).
        let start = Self.oracleSlotLate["\(name)|\(label)"] ?? 0.0
        var checked = 0, bad = 0, worst = ""
        for s in web {
            let t = (s["t"].number ?? 0) - (p["t"].number ?? 0) - start
            var near = samples.filter { $0.t >= t - 40 && $0.t <= t + 34 }
            if let b = samples.last(where: { $0.t < t - 40 }) { near.append(b) }
            if let a = samples.first(where: { $0.t > t + 34 }) { near.append(a) }
            guard !near.isEmpty else { continue }
            var pairs: [(String, Double, [Double])] = [("caret", s["caret"].number ?? 0, near.map(\.caret))]
            if (s["surface"]["opacity"].number ?? 0) > 0 || near.contains(where: { $0.opacity > 0 }) {
                pairs.append(("opacity", s["surface"]["opacity"].number ?? 0, near.map(\.opacity)))
                if (s["surface"]["opacity"].number ?? 0) > 0 { pairs.append(("scaleY", s["surface"]["scaleY"].number ?? 1, near.map(\.scaleY))) }
            }
            for (k, v, vals) in pairs {
                checked += 1
                if v < (vals.min() ?? 0) - 0.03 || v > (vals.max() ?? 0) + 0.03 { bad += 1; if worst.isEmpty { worst = "\(k) t=\(Int(t)) web \(v) native \(vals.map { String(format: "%.3f", $0) })" } }
            }
        }
        check(bad == 0, "\(tag) motion \(bad)/\(checked) frames outside the envelope \(worst)")
        // Phase-end pixels of the field clip (best native frame across the capture window).
        let clip = ACStatesFixture.rect(p["clip"])
        guard let source = NSImage(contentsOf: dir.appendingPathComponent(p["shot"].string))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(tag) shot"); return }
        let pw = min(source.width, Int(clip.width)), ph = min(source.height, Int(clip.height))
        let webG = grid(source, scale: 1, x0: 0, y0: 0, w: pw, h: ph)
        // Chrome's text selection in the trigger (Tab focus selects the input's text: the macOS highlight #B3D5FE) is a
        // browser text-selection rendering, not the component's paint: its box (+2 px) is masked on every platform.
        var sel = (x0: Int.max, y0: Int.max, x1: -1, y1: -1)
        for py in 0..<ph { for px in 0..<pw { let c = webG.at(px, py)
            if abs(c[0] - 179) <= 8 && abs(c[1] - 213) <= 8 && abs(c[2] - 254) <= 8 { sel = (min(sel.x0, px), min(sel.y0, py), max(sel.x1, px), max(sel.y1, py)) } } }
        func masked(_ px: Int, _ py: Int) -> Bool { sel.x1 >= 0 && px >= sel.x0 - 2 && px <= sel.x1 + 2 && py >= sel.y0 - 2 && py <= sel.y1 + 2 }
        var best: (n: Int, bad: Int, sum: Double, worst: Float, at: String)?
        // Chrome's phase-end capture lies between two native frames: each candidate frame and the span of consecutive frames are
        // compared (per channel the value nearest Chrome's within the two frames' range: a layer still moving at the capture — a
        // press wave fading ~0.03 per frame is 5–6 levels apart between frames — has an intermediate value there). The same
        // compare as the Compose harness (n2's CardWeb.between).
        let frames = shots.map { b in grid(b.cgImage!, scale: Double(b.pixelsWide) / max(1, Double(clip.intersection(host.bounds).width)), x0: 0, y0: 0, w: pw, h: ph) }
        var candidates = frames
        for (a, b) in zip(frames, frames.dropFirst()) where a.v.count == b.v.count && a.v.count == webG.v.count {
            var g = a; for i in g.v.indices { g.v[i] = min(max(webG.v[i], min(a.v[i], b.v[i])), max(a.v[i], b.v[i])) }; candidates.append(g)
        }
        for nat in candidates {
            var n = 0, badPx = 0, sum = 0.0, worstPx: Float = 0, at = ""
            for py in 1..<max(1, ph - 1) { for px in 1..<max(1, pw - 1) {
                guard webG.flat(px, py, 6) && nat.flat(px, py, 6), !masked(px, py) else { continue }
                let i = (py * pw + px) * 3
                let q = max(abs(webG.v[i] - nat.v[i]), max(abs(webG.v[i + 1] - nat.v[i + 1]), abs(webG.v[i + 2] - nat.v[i + 2])))
                n += 1; sum += Double(max(0, q - 1)); if q > 6 { badPx += 1 }
                if q > worstPx { worstPx = q; at = "(\(px + Int(clip.minX)),\(py + Int(clip.minY))) web \(webG.at(px, py)) native \(nat.at(px, py))" }
            } }
            if best == nil || badPx < best!.bad || (badPx == best!.bad && sum < best!.sum) { best = (n, badPx, sum, worstPx, at) }
        }
        guard let r = best else { check(false, "\(tag) no native shot"); return }
        check(Double(r.bad) / Double(max(1, r.n)) <= 0.005 && r.sum / Double(max(1, r.n)) <= 1.0, "\(tag) flat pixels (mean \(String(format: "%.3f", r.sum / Double(max(1, r.n)))), >6: \(r.bad)/\(r.n), worst \(r.worst) at \(r.at))")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = ACHostingView(rootView: ACStatesFixture(state: state, onEvent: { e in if e.name.hasPrefix("md") && e.nodeID == "m" { events.append((e.name, now(), e.detail)); if ProcessInfo.processInfo.environment["AWC_AC_EVENTS"] != nil { print("  event \(e.name) t=\(Int(now()))"); fflush(stdout) } } }))
        window = ACKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.acceptsMouseMovedEvents = true; window.contentView = host
        #if canImport(AppKit)
        window.autorecalculatesKeyViewLoop = true
        // The oracle ran in the light system appearance (Chrome's selection highlight #B3D5FE).
        window.appearance = NSAppearance(named: .aqua)
        #endif
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); pump(0.8)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_AC_ONLY"]
        for (file, dir, reduced) in [("ac-web-states.json", "ac-web-states", false), ("ac-web-states-reduced.json", "ac-web-states-reduced", true)] {
            if ProcessInfo.processInfo.environment["AWC_AC_REDUCED"] == (reduced ? "0" : "1") { continue }
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file)))
            for r in oracle["runs"].array where only.map({ o in o.split(separator: ",").contains { r["name"].string.contains($0) } }) ?? true { run(r, shots: fixtures.appendingPathComponent(dir), reduced: reduced) }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_AC_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Autocomplete native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
