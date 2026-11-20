import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-app-bar interactions against Chrome 153 (app bar states.html: 15 runs, plus 3 under prefers-reduced-motion). Each run's
// bar is an AWCNode tree rendered through the production dispatch at (60, 60), 720 wide, between a "Before" and an "After"
// button; the steps of states.html are replayed with the host pointer state and trusted AppKit events (mouse to the window,
// keys to the first responder): hover / press / release / leave on the search pill and the leading icon, typing, Enter, Space,
// Home, Tab / Shift+Tab, `scrolled`, `searchValue`, the variant / subtitle / alignment / density changes and the trailing
// cap (append, author-hide, show, remove). Checked: the focused element, the host and pill backgrounds, the pill's focused /
// focus-ring state and opacity, the search state layer, the input value, caret and placeholder alignment and which children
// are shown at every phase end; every sampled Chrome frame of the host / pill colours and the state layer within the native
// ±2-frame envelope; the md* events (order, value, time in their phase); the console warnings; the phase screenshots.
@Observable final class AppBarStatesState {
    var epoch = 0
    var bar = AWCNode(id: "ab", tag: "md-app-bar")
    var dark = false
    var rtl = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored var events: [(name: String, detail: AWCValue, t: Double)] = []
}
struct AppBarStatesFixture: View {
    let state: AppBarStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = NativeAppBarStatesIntegration.ids(state.bar) + ["before", "after", "appbar-states-sentinel"]
        ZStack(alignment: .topLeading) {
            Color(awcHex: theme.tokens["--md-sys-color-surface-container-lowest"] ?? "#FFFFFF").frame(maxWidth: .infinity, maxHeight: .infinity)
            // AppKit orders the key-view loop geometrically: "Before" sits above the bar, as #before precedes it in the DOM.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 900, y: 4)
            AWCNativeView(node: state.bar)
                .frame(width: 720, alignment: .topLeading)
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 60).padding(.top, 60)
            AWCNativeView(node: AWCNode(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 900, y: 840)
        }
        .frame(width: 1200, height: 900, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .awcAppBarReducedMotion(state.reduced)
        .environment(\.awcEventDispatcher, AWCEventDispatcher(id: "page") { ctx in
            if ctx.event.nodeID == "ab" && ctx.event.name.hasPrefix("md") { state.events.append((ctx.event.name, ctx.event.detail, CACurrentMediaTime() * 1000)) }
        })
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .coordinateSpace(name: "awc-native-preview")
    }
}
struct AppBarStatesGrid {
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
struct AppBarSample {
    var t: Double
    var focus: String
    var host: [Double]?
    var pill: [Double]?
    var pillOpacity: Double?
    var layer: Double?
    var focused = false, ring = false
    var value: String?
    var selection: Int?
    var centered: Bool?
    var visible: [String: Bool] = [:]
}
@main @MainActor enum NativeAppBarStatesIntegration {
    static let state = AppBarStatesState()
    static var host: NSHostingView<AppBarStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var t0 = 0.0
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.004) {
        let end = Date().addingTimeInterval(d)
        repeat { host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end
    }
    static func now() -> Double { CACurrentMediaTime() * 1000 - t0 }
    static func ids(_ n: AWCNode) -> [String] { (n.id.isEmpty || n.tag.hasPrefix("#") ? [] : [n.id]) + n.children.flatMap(ids) }
    // MARK: input
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil,
                                            eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static let codes: [String: (UInt16, String)] = ["Tab": (48, "\t"), "Enter": (36, "\r"), " ": (49, " "), "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Escape": (53, "\u{1B}")]
    static let letterCodes: [Character: UInt16] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
                                                   "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46, " ": 49]
    static func key(_ k: String, shift: Bool = false) {
        let (code, text) = codes[k] ?? ((k.count == 1 ? letterCodes[Character(k.lowercased())] : nil) ?? 0, k)
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            // The offscreen borderless test window is never the key window: key events go to its first responder directly.
            window.sendEvent(e)
        }
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func m(_ id: String, _ part: String? = nil) -> AWCNativeInspectionNode? { state.measurements.first { $0.id == id + ":component" + (part.map { "." + $0 } ?? "") } }
    static func center(_ target: AWCValue) -> CGPoint? {
        if case .array(let a) = target, a.count == 2 { return .init(x: a[0].number ?? 0, y: a[1].number ?? 0) }
        let part = target.string == "pill" ? "search" : target.string == "leading" ? "leading-icon" : target.string
        guard let r = m("ab", part)?.bounds else { return nil }
        return .init(x: r.midX, y: r.midY)
    }
    static func wait(until t: Double) { while now() < t { pump(0.002) } }
    static func mutate(_ change: (inout AWCNode) -> Void) { var b = state.bar; change(&b); state.bar = b; pump(0.001) }
    static func act(_ a: AWCValue, start: Double) {
        if a["move"] != .null { guard let p = center(a["move"]) else { check(false, "move target \(a["move"])"); return }; state.pointer.update(phase: .move, location: p); pump(0.001) }
        // The search pill takes the host pointer state only: an AppKit mouse-down on the text field would enter its tracking
        // loop (it waits for the mouse-up the test can only send after it returns). Buttons also get the trusted events.
        let appKit = { (t: AWCValue) in t != "pill" }
        if a["down"] != .null { guard let p = center(a["down"]) else { check(false, "down target"); return }; state.pointer.update(phase: .down, location: p); if appKit(a["down"]) { mouse(.leftMouseDown, p) } }
        if a["up"] != .null { guard let p = center(a["up"]) else { check(false, "up target"); return }; if appKit(a["up"]) { mouse(.leftMouseUp, p) }; state.pointer.update(phase: .up, location: p) }
        if a["click"] != .null {
            guard let p = center(a["click"]) else { check(false, "click target"); return }
            state.pointer.update(phase: .down, location: p); if appKit(a["click"]) { mouse(.leftMouseDown, p) }
            wait(until: start + 33); if appKit(a["click"]) { mouse(.leftMouseUp, p) }; state.pointer.update(phase: .up, location: p)
        }
        if case .string(let k) = a["key"] { key(k, shift: a["shift"] == .bool(true)) }
        if case .string(let text) = a["type"] {
            // CDP Input.insertText per character, one frame apart.
            for (i, ch) in text.enumerated() { wait(until: start + 1 + Double(i) * 32.6); key(String(ch)) }
        }
        if a["focus"] == "before" { _ = focusView("before")?.requestNativeFocus() }
        if case .object(let props) = a["props"] { mutate { b in for (k, v) in props { b.properties[k] = v } } }
        if case .array(let kids) = a["append"] {
            // The oracle's appended element: { tag, id, slot, props, attrs } (the props and the attributes are both node properties).
            mutate { b in for k in kids {
                var props: [String: AWCValue] = [:]
                if case .object(let p) = k["props"] { props.merge(p) { _, n in n } }
                if case .object(let at) = k["attrs"] { props.merge(at) { _, n in n } }
                b.children.append(AWCNode(id: k["id"].string, tag: k["tag"].string, properties: props, slot: k["slot"] == .null ? nil : k["slot"].string))
            } }
        }
        if case .string(let id) = a["hide"] { mutate { b in if let i = b.children.firstIndex(where: { $0.id == id }) { b.children[i].properties["hidden"] = true } } }
        if case .string(let id) = a["show"] { mutate { b in if let i = b.children.firstIndex(where: { $0.id == id }) { b.children[i].properties["hidden"] = nil } } }
        if case .string(let id) = a["remove"] { mutate { b in b.children.removeAll { $0.id == id } } }
    }
    // MARK: sampling
    static func rgb(_ hex: String?) -> [Double]? {
        guard let h = hex?.dropFirst(), h.count >= 6 else { return nil }
        let s = Array(h); func c(_ i: Int) -> Double { Double(Int(String(s[i...i + 1]), radix: 16) ?? 0) }
        return [c(0), c(2), c(4)]
    }
    static func focus() -> String {
        if m("ab", "search")?.metrics["focused"]?.bool == true { return "md-app-bar#ab > input.md-app-bar__search-input" }
        guard let v = window.firstResponder as? AWCNativeButtonFocusView else { return "body" }
        let id = v.accessibilityIdentifier()
        switch id {
        case "ab-leading-icon": return "md-app-bar#ab > md-icon-button.md-app-bar__leading-button"
        case "before", "after": return "button#" + id
        case "": return "body"
        default: return "md-icon-button#" + id
        }
    }
    static func sample() -> AppBarSample {
        var s = AppBarSample(t: now(), focus: focus())
        s.host = rgb(m("ab")?.metrics["fill"]?.string)
        // Timed by the frame the bar computed its values for (as the pill below): a bar without a search pill too.
        if let rendered = m("ab")?.metrics["renderTime"]?.number { s.t = rendered - t0 }
        if let pill = m("ab", "search")?.metrics {
            // A sample is timed by the frame its values were computed for (the measurements reach the test later, frames later
            // on the iOS simulator), as the rail suite times its frames.
            if let rendered = pill["renderTime"]?.number { s.t = rendered - t0 }
            s.pill = rgb(pill["fill"]?.string); s.pillOpacity = pill["opacity"]?.number; s.layer = pill["layer"]?.number
            s.focused = pill["focused"]?.bool ?? false; s.ring = pill["focusRing"]?.bool ?? false
        }
        if let input = m("ab", "search-input")?.metrics {
            s.value = input["value"]?.string; s.selection = input["selection"]?.number.map { Int($0) }; s.centered = input["placeholderCentered"]?.bool
        }
        for c in state.bar.children where !c.id.isEmpty && c.tag.hasPrefix("md-") { s.visible[c.id] = (m(c.id)?.bounds.width ?? 0) > 0.5 }
        return s
    }
    static func webRGB(_ v: AWCValue) -> [Double]? { v.array.isEmpty ? nil : Array(v.array.prefix(3).map { $0.number ?? 0 }) }
    static func close(_ a: [Double]?, _ b: [Double]?, _ tol: Double = 3) -> Bool { guard let a, let b else { return a == nil && b == nil }; return zip(a, b).allSatisfy { abs($0 - $1) <= tol } }
    // MARK: run
    static func run(_ r: AWCValue, shots: URL, reduced: Bool) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.pointer.update(phase: .move, location: .init(x: 1190, y: 600)); state.pointer.update(phase: .leave)
        _ = window.makeFirstResponder(nil)
        state.bar = (try? JSONEncoder().encode(r["node"])).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } ?? AWCNode(id: "ab", tag: "md-app-bar")
        state.epoch += 1; pump(0.6)
        state.events = []; AWCAppBarDiagnostics.warnings = []
        let phases = r["phases"].array
        var allSamples: [[AppBarSample]] = [], starts: [Double] = [], shotsTaken: [[NSBitmapImageRep]] = [], shotTimes: [[Double]] = []
        t0 = CACurrentMediaTime() * 1000
        for (i, p) in phases.enumerated() {
            if p["pre"] == "focusBefore" { _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            let start = p["t"].number ?? 0
            wait(until: start)
            let actual = now()
            var samples: [AppBarSample] = []
            var first = sample(); first.t -= actual; samples.append(first)
            act(p["act"], start: actual)
            let acted = now() - actual
            let ms = p["ms"].number ?? 250
            let lastWeb = (p["samples"].array.last?["t"].number ?? start) - start
            let next = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - start : acted + ms + 60
            // Chrome shoots the phase after its last sampled frame and before the next phase starts: shoot every 16 ms across it.
            var times: [Double] = []; var at = max(lastWeb + 17, acted + ms); while at < next - 4 { times.append(at); at += 16 }
            if times.isEmpty { times = [max(lastWeb + 17, acted + ms)] }
            let clip = clipRect(run: r["name"].string, label: p["label"].string, shots: shots)
            var shotsHere: [NSBitmapImageRep] = [], taken: [Double] = []
            var due = 0
            while now() < actual + times.last! || due < times.count {
                pump(0.004); var s = sample(); s.t -= actual; samples.append(s)
                if due < times.count, now() >= actual + times[due] {
                    due += 1
                    if let clip {
                        let rect = host.isFlipped ? clip : CGRect(x: clip.minX, y: host.bounds.height - clip.maxY, width: clip.width, height: clip.height)
                        let b = host.bitmapImageRepForCachingDisplay(in: rect)!; host.cacheDisplay(in: rect, to: b); shotsHere.append(b); taken.append(now() - actual)
                    }
                }
            }
            allSamples.append(samples); starts.append(actual); shotsTaken.append(shotsHere); shotTimes.append(taken)
        }
        for (i, p) in phases.enumerated() { compare(name, r["name"].string, p, allSamples[i], shots: shotsTaken[i], times: shotTimes[i], dir: shots) }
        // md* events of the bar: order and value; time within the phase that contains them.
        let web = r["events"].array
        let names = state.events.map(\.name), webNames = web.map { $0["name"].string }
        check(names == webNames, "\(name) events \(names) vs \(webNames)")
        if names == webNames {
            let webStarts = phases.map { $0["t"].number ?? 0 }
            func rel(_ t: Double, _ s: [Double]) -> (Int, Double) { let i = max(0, s.lastIndex { $0 <= t + 1 } ?? 0); return (i, t - s[i]) }
            for (e, w) in zip(state.events, web) {
                if e.name != "mdLeadingClick" { check(e.detail["value"] == w["detail"]["value"], "\(name) \(e.name) value \(e.detail["value"]) vs \(w["detail"]["value"])") }
                let n = rel(e.t - t0, starts), wv = rel(w["t"].number ?? 0, webStarts)
                check(n.0 == wv.0 && abs(n.1 - wv.1) <= 60, "\(name) \(e.name) in phase \(n.0) at +\(Int(n.1)) vs phase \(wv.0) at +\(Int(wv.1)) ms")
            }
        }
        let warnings = r["warnings"].array.map(\.string)
        check(AWCAppBarDiagnostics.warnings == warnings, "\(name) warnings \(AWCAppBarDiagnostics.warnings) vs \(warnings)")
        report.append(["run": name, "phases": phases.count, "events": names])
        print("run \(name): \(checks - failures.count)/\(checks)"); fflush(stdout)
    }
    /// The phase screenshot's clip: the bar's box grown by 16 (clipOf), its size from the PNG.
    static func clipRect(run: String, label: String, shots: URL) -> CGRect? {
        guard let image = NSImage(contentsOf: shots.appendingPathComponent("\(run)-\(label).png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        return CGRect(x: 44, y: 44, width: image.width, height: image.height)
    }
    static func compare(_ name: String, _ run: String, _ p: AWCValue, _ samples: [AppBarSample], shots candidates: [NSBitmapImageRep], times: [Double], dir: URL) {
        let label = p["label"].string, tag = "\(name) \(label)", w = p["snap"]
        guard let end = samples.last else { check(false, "\(tag) no samples"); return }
        // Phase-end state.
        let webFocus = ["body", "button#run"].contains(w["active"].string) ? "body" : w["active"].string
        check(end.focus == webFocus, "\(tag) focus \(end.focus) vs \(webFocus)")
        check(close(end.host, webRGB(w["host"])), "\(tag) host \(end.host ?? []) vs \(webRGB(w["host"]) ?? [])")
        if case .object = w["pill"] {
            check(close(end.pill, webRGB(w["pill"]["bg"])), "\(tag) pill \(end.pill ?? []) vs \(webRGB(w["pill"]["bg"]) ?? [])")
            check(abs((end.pillOpacity ?? -1) - (w["pill"]["opacity"].number ?? 1)) <= 0.01, "\(tag) pill opacity \(end.pillOpacity ?? -1)")
            check(end.focused == (w["pill"]["focused"] == .bool(true)), "\(tag) pill focused \(end.focused)")
            check(end.ring == (w["pill"]["ring"] == .bool(true)), "\(tag) focus ring \(end.ring)")
        } else { check(end.pill == nil, "\(tag) no search pill") }
        if case .object = w["layer"] {
            let shown = w["layer"]["shown"] == .bool(true), web = shown ? (w["layer"]["opacity"].number ?? 0) : 0
            check(abs((end.layer ?? -1) - web) <= 0.02, "\(tag) state layer \(end.layer ?? -1) vs \(web)\(shown ? "" : " (display: none)")")
        }
        if case .object = w["input"] {
            check(end.value == w["input"]["value"].string, "\(tag) input value \(end.value ?? "nil") vs \(w["input"]["value"].string)")
            check(end.selection == w["input"]["selection"].number.map { Int($0) }, "\(tag) caret \(end.selection ?? -1) vs \(w["input"]["selection"].number ?? -1)")
            check(end.centered == (w["input"]["centered"] == .bool(true)), "\(tag) placeholder centred \(end.centered ?? false)")
        }
        for c in w["children"].array where c["slot"].string != "search" {
            let id = c["id"].string
            check(end.visible[id] == (c["hidden"] != .bool(true)), "\(tag) child \(id) shown \(end.visible[id].map(String.init) ?? "nil") vs \(c["hidden"] != .bool(true))")
        }
        // Every Chrome frame inside the native ±2-frame envelope (host / pill colours, the visible state layer).
        let start = p["t"].number ?? 0
        var checked = 0, bad = 0, worst = ""
        for s in p["samples"].array {
            let t = (s["t"].number ?? 0) - start
            var near = samples.filter { $0.t >= t - 40 && $0.t <= t + 34 }
            if let before = samples.last(where: { $0.t < t - 40 }) { near.append(before) }
            if let after = samples.first(where: { $0.t > t + 34 }) { near.append(after) }
            guard !near.isEmpty else { continue }
            func within(_ key: String, _ web: [Double]?, _ native: (AppBarSample) -> [Double]?, _ tol: Double) {
                guard let web else { return }
                let vals = near.compactMap(native); guard !vals.isEmpty else { return }
                checked += 1
                for k in web.indices where k < (vals.first?.count ?? 0) {
                    let lo = vals.map { $0[k] }.min()!, hi = vals.map { $0[k] }.max()!
                    if web[k] < lo - tol || web[k] > hi + tol { bad += 1; if worst.isEmpty { worst = "\(key) t=\(Int(t)) web \(web) native \(vals)" }; break }
                }
            }
            within("host", webRGB(s["host"]), { $0.host }, 3)
            if case .object = s["pill"] { within("pill", webRGB(s["pill"]["bg"]), { $0.pill }, 3) }
            if case .object = s["layer"], s["layer"]["shown"] == .bool(true) { within("layer", [s["layer"]["opacity"].number ?? 0], { $0.layer.map { [$0] } }, 0.02) }
        }
        check(bad == 0, "\(tag) motion \(bad)/\(checked) frames outside the envelope \(worst)")
        // Phase-end pixels: the best native shot across Chrome's capture window.
        guard let source = NSImage(contentsOf: dir.appendingPathComponent("\(run)-\(label).png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(tag) shot"); return }
        let pw = source.width, ph = source.height
        let webG = grid(source, scale: 1, w: pw, h: ph)
        // Sequential focus into a filled input selects its text (verified above by the caret and below by the events): the
        // highlight is the system's selection colour, which AppKit does not draw in the harness's non-key window — the
        // input's text box is left out of the pixel comparison for those phases only.
        let selectedAll = (label.hasPrefix("tab") || label.hasPrefix("shiftTab")) && webFocus.contains("search-input") && !w["input"]["value"].string.isEmpty
        let mask: CGRect? = selectedAll ? m("ab", "search-input")?.bounds.insetBy(dx: -2, dy: -2) : nil
        var best: (n: Int, bad: Int, sum: Double, worst: Float, at: String, index: Int)?
        for (k, b) in candidates.enumerated() {
            let nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / Double(pw), w: pw, h: ph)
            var n = 0, badPx = 0, sum = 0.0, worstPx: Float = 0, at = ""
            for py in 1..<max(1, ph - 1) { for px in 1..<max(1, pw - 1) {
                guard webG.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
                if let mask, mask.contains(CGPoint(x: Double(px + 44) + 0.5, y: Double(py + 44) + 0.5)) { continue }
                let i = (py * pw + px) * 3
                let q = max(abs(webG.v[i] - nat.v[i]), max(abs(webG.v[i + 1] - nat.v[i + 1]), abs(webG.v[i + 2] - nat.v[i + 2])))
                n += 1; sum += Double(max(0, q - 1)); if q > 6 { badPx += 1 }
                if q > worstPx { worstPx = q; at = "(\(px + 44),\(py + 44)) web \(webG.at(px, py)) native \(nat.at(px, py))" }
            } }
            if best == nil || badPx < best!.bad || (badPx == best!.bad && sum < best!.sum) { best = (n, badPx, sum, worstPx, at, k) }
        }
        guard let r = best else { check(false, "\(tag) no native shot"); return }
        if let d = ProcessInfo.processInfo.environment["AWC_APPBAR_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true)
            try? candidates[r.index].representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: d).appendingPathComponent("\(run)-\(label)\(state.reduced ? "-reduced" : "").png"))
        }
        check(Double(r.n) / Double(max(1, (pw - 2) * (ph - 2))) > 0.4, "\(tag) flat-pixel coverage \(r.n)")
        check(Double(r.bad) / Double(max(1, r.n)) <= 0.005 && r.sum / Double(max(1, r.n)) <= 1.0,
              "\(tag) flat pixels (shot \(r.index + 1)/\(candidates.count) at +\(times.indices.contains(r.index) ? Int(times[r.index]) : -1), mean \(String(format: "%.3f", r.sum / Double(max(1, r.n)))), >6: \(r.bad)/\(r.n), worst \(r.worst) at \(r.at))")
    }
    static func grid(_ cg: CGImage, scale: Double, w: Int, h: Int) -> AppBarStatesGrid {
        let sw = Int((Double(w) * scale).rounded()), sh = Int((Double(h) * scale).rounded())
        var raw = [UInt8](repeating: 0, count: sw * sh * 4)
        let ctx = CGContext(data: &raw, width: sw, height: sh, bitsPerComponent: 8, bytesPerRow: sw * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: sw, height: sh))
        var v = [Float](repeating: 0, count: w * h * 3)
        let f = max(1, Int(scale.rounded()))
        for y in 0..<h { for x in 0..<w { for k in 0..<3 {
            var acc: Float = 0
            for dy in 0..<f { for dx in 0..<f { acc += Float(raw[((y * f + dy) * sw + (x * f + dx)) * 4 + k]) } }
            v[(y * w + x) * 3 + k] = acc / Float(f * f)
        } } }
        return AppBarStatesGrid(w: w, h: h, v: v)
    }
    /// The text-input system's first focus is not part of any phase: the iOS simulator loads its keyboard / input machinery
    /// then (the main thread stalls for frames, so the first pointer press on a search pill rendered late, every run). One
    /// press and focus of a search field before the runs, as Chrome's page is warm.
    static func warmUp(_ fixtures: URL) {
        guard let oracle = try? JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("app-bar-web-states.json"))),
              let r = oracle["runs"].array.first(where: { $0["node"]["properties"]["variant"].string == "search" }) else { return }
        state.bar = (try? JSONEncoder().encode(r["node"])).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } ?? state.bar
        state.epoch += 1; pump(0.4)
        if let p = center("pill") {
            state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p); pump(0.4)
            state.pointer.update(phase: .up, location: p); pump(0.2)
        }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.3)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: AppBarStatesFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB
        #if canImport(AppKit)
        window.autorecalculatesKeyViewLoop = true
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.8)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_APPBAR_ONLY"]
        #if os(iOS)
        warmUp(fixtures)   // the simulator only: macOS passed 1397/1397 without it; with it, two later `clear` phases kept their text (n5-052)
        #endif
        for (file, reduced) in [("app-bar-web-states", false), ("app-bar-web-states-reduced", true)] {
            if ProcessInfo.processInfo.environment["AWC_APPBAR_REDUCED"] == (reduced ? "0" : "1") { continue }
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ o in o.split(separator: ",").contains { r["name"].string.contains($0) } }) ?? true {
                run(r, shots: fixtures.appendingPathComponent(file), reduced: reduced)
            }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_APPBAR_OUTPUT"] {
            try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out))
        }
        print("App bar native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
