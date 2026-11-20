import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-otp-field interaction against Chrome 153 (Mac capture of otp-states.html: 4 runs, full and reduced motion): real
// AppKit mouse and key events and the text system's paste. Checks the md* event sequence (names and details, the form's
// submit), every phase's end state (value, focused cell, each cell's character, border colour and width) and every
// frame's cell borders inside Chrome's ±2-frame envelope (the 100 ms border-colour transition on blur and hover).
#if canImport(AppKit)
final class OTPKeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
/// SwiftUI receives a synthesized press while the test process is not the active application (another process activated):
/// NSWindow.sendEvent hands an inactive app's first click only to views that accept first mouse (fi, 2026-10-31).
final class OTPAcceptingHost: NSHostingView<OTPStatesFixture> { override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true } }
#else
typealias OTPKeyWindow = NSWindow
typealias OTPAcceptingHost = NSHostingView<OTPStatesFixture>
#endif
@Observable final class OTPStatesState {
    var node = AWCNode(id: "otp", tag: "md-otp-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = false
    var form: AWCFormState? = nil
    var measurements: [AWCNativeInspectionNode] = []
}
struct OTPRecorded { let t: Double; let name: String; let detail: AWCValue }
@MainActor var otpEvents: [OTPRecorded] = []
@MainActor var otpClock: () -> Double = { CACurrentMediaTime() * 1000 }
let otpPointer = AWCNativePointerState()
@MainActor let otpStatesController = AWCOTPFieldController()
struct OTPStatesFixture: View {
    let state: OTPStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node) { e in MainActor.assumeIsolated { otpEvents.append(.init(t: otpClock(), name: e.name, detail: e.detail)) } }
                .frame(width: 440, alignment: .leading).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .environment(\.awcFormState, state.form)
            .environment(\.awcNativePointerState, otpPointer)
            .awcOTPFieldController(otpStatesController)
            .awcFieldReducedMotion(state.reduced)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "otp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeOTPFieldStatesIntegration {
    static let state = OTPStatesState()
    static var host: NSHostingView<OTPStatesFixture>!, window: OTPKeyWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    struct Sample { let t: Double; let m: [String: AWCNativeInspectionNode] }
    static var samples: [Sample] = []
    static var phaseStart = 0.0
    static var maxLate = 0.0
    static func pump(_ duration: Double) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004))
            var m: [String: AWCNativeInspectionNode] = [:]; for n in state.measurements { m[n.name] = n }
            samples.append(.init(t: otpClock() - phaseStart, m: m))
        } while Date() < end
    }
    /// Keys go through the event queue as real input does (the text system reads the dequeued event).
    static func key(_ chars: String, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
            NSApp.postEvent(e, atStart: false)
        }
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    /// The keys of one step in one turn: all are queued first, then dispatched in order (one run-loop turn, as Chrome's one task).
    static func keys(_ list: [(String, UInt16)]) {
        for (chars, code) in list { for type in [NSEvent.EventType.keyDown, .keyUp] {
            NSApp.postEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                             context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!, atStart: false) } }
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    static func special(_ scalar: Int, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) { key(String(UnicodeScalar(UInt32(scalar))!), code, flags.union([.function, .numericPad])) }
    static var cadence: [Double] = []
    /// The cell Chrome's mouse pointer rests over after the run's last click (its border shows hover once it is not focused).
    static var pointerCell: Int?
    /// Chrome's mouse comes to rest over cell `k` with the click. macOS: the host pointer state follows the click. iOS: a touch
    /// never hovers, so the iPadOS pointer rests there through the runtime's pointer-hover entry (`.onContinuousHover`'s).
    static func restPointer(_ k: Int) {
        pointerCell = k
        #if !canImport(AppKit)
        AWCOTPFieldRuntime.mounted.object(forKey: "otp")?.pointerHover(k, true)
        #endif
    }
    static let codes: [Character: (UInt16, Bool)] = ["1": (18, false), "2": (19, false), "3": (20, false), "4": (21, false), "6": (22, false), "5": (23, false), "9": (25, false),
                                                     "7": (26, false), "8": (28, false), "0": (29, false), "x": (7, false), "a": (0, false), "b": (11, false), "!": (18, true)]
    static func type(_ text: String) {
        for ch in text {
            if !cadence.isEmpty { let at = cadence.removeFirst(); let wait = (phaseStart + at) - otpClock(); if wait > 0 { pump(wait / 1000) }; maxLate = max(maxLate, otpClock() - (phaseStart + at)) }
            let c = codes[ch] ?? (0, false)
            key(String(ch), c.0, c.1 ? .shift : [])
            pump(cadence.isEmpty ? 0.033 : 0.002)
        }
    }
    static func click(_ p: CGPoint) {
        let wp = host.convert(p, to: nil)
        func ev(_ t: NSEvent.EventType) -> NSEvent { NSEvent.mouseEvent(with: t, location: wp, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: t == .leftMouseDown ? 1 : 0)! }
        otpPointer.update(phase: .down, location: p)
        // AppKit text fields track the press in a nested event loop: queue the release first so it can end the loop.
        NSApp.postEvent(ev(.leftMouseUp), atStart: false); NSApp.sendEvent(ev(.leftMouseDown)); pump(0.01)
        otpPointer.update(phase: .up, location: p)
    }
    /// The text system's paste (Edit ▸ Paste / ⌘V) of `text` from a pasteboard of the suite's own: the input's paste handler reads
    /// AWCFieldPasteboard, so the system clipboard is never written, read or waited on (di, 2026-11-04: reading the general
    /// pasteboard blocked on the pasteboard server in some iOS runs).
    static func paste(_ text: String) {
        #if canImport(AppKit)
        let board = NSPasteboard(name: NSPasteboard.Name("dev.awc.n3.otp-states"))
        board.clearContents(); board.setString(text, forType: .string); AWCFieldPasteboard.board = board
        // To the focused cell's field editor itself: a nil-target action needs a key window, which a locked screen never gives.
        NSApp.sendAction(#selector(NSText.paste(_:)), to: window.firstResponder, from: nil)
        board.clearContents(); board.releaseGlobally(); AWCFieldPasteboard.board = .general
        #else
        let name = UIPasteboard.Name("dev.awc.n3.otp-states")
        // The previous step's board is removed here, before this step's input, not after the paste: the pasteboard-server round
        // trip of the removal held the main thread for tens of ms between the input and the first frame drawn (S71-03, 9-6-230).
        UIPasteboard.remove(withName: name)
        let board = UIPasteboard(name: name, create: true)!
        board.string = text; AWCFieldPasteboard.board = board
        UIApplication.shared.sendAction(#selector(UIResponderStandardEditActions.paste(_:)), to: nil, from: nil, for: nil)
        AWCFieldPasteboard.board = .general
        #endif
    }
    static func centre(_ part: String) -> CGPoint? { state.measurements.first { $0.name == part }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func act(_ run: String, _ label: String) {
        switch label {
        case "click-cell-3-lands-first-empty": if let c = centre("cell-3") { click(c); restPointer(3) }
        // Chrome focuses with a click on cell 0 (the pointer then rests there: cell 0 shows hover once focus moves on).
        case "focus": if let c = centre("cell-0") { click(c); restPointer(0) }
        case "type-12": type("12")
        case "type-x-rejected": type("x")
        case "type-3456-complete": type("3456")
        case "overtype-last-7": type("7")
        case "type-a1!b": type("a1!b")
        case "ArrowLeft": special(0xF702, 123)
        case "Home": special(0xF729, 115)
        case "End": special(0xF72B, 119)
        case "Backspace-filled": key("\u{7F}", 51)
        case "Backspace-x3":
            #if canImport(AppKit)
            keys([("\u{7F}", 51), ("\u{7F}", 51), ("\u{7F}", 51)])   // Chrome's script dispatches the three keys in one task
            #else
            for _ in 0..<3 { key("\u{7F}", 51); pump(0.002) }   // keyBurst([51,51,51]) tried in 9-6-123: worse (6/96 frames), see story
            #endif
        case "Delete-at-0":
            #if canImport(AppKit)
            special(0xF729, 115); pump(0.016); special(0xF728, 117)
            #else
            special(0xF729, 115); pump(0.016); special(0xF728, 117)   // keyBurst([115,117]) tried in 9-6-123: Delete did not apply
            #endif
        // Page focus navigation: Tab moves to the next cell (every cell is a Tab stop).
        case "Tab-out-commits": key("\t", 48)
        case "paste-12-34-56x": paste(" 12-34 56x")
        case "paste-same-again": paste("123456")
        default: check(false, "\(run) unknown phase \(label)")
        }
    }
    static func properties(_ html: String) -> (props: [String: AWCValue], form: Bool) {
        var p: [String: AWCValue] = [:]
        let tagRange = html.range(of: "<md-otp-field")!
        let rest = html[tagRange.upperBound...], end = rest.firstIndex(of: ">")!
        let attrs = String(rest[..<end])
        let re = try! NSRegularExpression(pattern: #"([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'))?"#)
        for m in re.matches(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)) {
            let k = String(attrs[Range(m.range(at: 1), in: attrs)!])
            let v = [2, 3].compactMap { m.range(at: $0).location == NSNotFound ? nil : String(attrs[Range(m.range(at: $0), in: attrs)!]) }.first
            let camel = k == "readonly" ? "readOnly" : k.split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.capitalized }.joined()
            if ["length", "group-size", "density"].contains(k), let v, let n = Double(v) { p[camel] = .number(n) }
            else if let v { p[camel] = .string(v) } else { p[camel] = .bool(true) }
        }
        return (p, html.contains("<form"))
    }
    static func rgb(_ s: String) -> [Double] {
        var out: [Double] = [], cur = ""
        for ch in s { if "0123456789.".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }
        if let v = Double(cur) { out.append(v) }
        return out.count >= 3 ? [out[0], out[1], out[2], out.count > 3 ? out[3] * 255 : 255] : [0, 0, 0, 0]
    }
    static func hexRGBA(_ h: String?) -> [Double]? {
        guard let h, h.hasPrefix("#"), h.count >= 7 else { return nil }
        let v = Array(h.dropFirst()); func c(_ i: Int) -> Double { Double(Int(String(v[i..<(i + 2)]), radix: 16) ?? 0) }
        return [c(0), c(2), c(4), v.count >= 8 ? c(6) : 255]
    }
    static func expectedBorder(_ bc: String, _ bw: Double) -> [Double] { rgb(bc) }
    /// The native frames within ±2 frames of `t` (later edge extended by `spread`: the keys Chrome applied together reached UIKit
    /// that far apart, so the in-between states of those arrivals count).
    static func envelope(_ t: Double, spread: Double = 0, _ value: (Sample) -> [Double]?) -> ([Double], [Double])? {
        var window = samples.filter { $0.t >= t - 40 && $0.t <= t + spread + 34 }
        #if !canImport(AppKit)
        // A frame UIKit did not draw (its text-input session set-up holds the main thread when focus moves): the screen
        // keeps the last drawn frame until the next one, so the frames around such a gap (> 34 ms) bound what was shown.
        if let before = samples.last(where: { $0.t < t - 40 }), (window.first?.t ?? .infinity) - before.t > 34 { window.insert(before, at: 0) }
        if let after = samples.first(where: { $0.t > t + spread + 34 }), after.t - (window.last?.t ?? -.infinity) > 34 { window.append(after) }
        #endif
        let vs = window.compactMap(value)
        guard let first = vs.first else { return nil }
        var lo = first, hi = first
        for v in vs { for k in 0..<v.count { lo[k] = min(lo[k], v[k]); hi[k] = max(hi[k], v[k]) } }
        return (lo, hi)
    }
    static func runOne(_ r: AWCValue, reduced: Bool, last: Bool = false) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        let parsed = properties(r["html"].string)
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.form = parsed.form ? AWCFormState() : nil
        state.node = AWCNode(id: "otp", tag: "md-otp-field", properties: parsed.props)
        otpPointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.measurements = []; state.epoch += 1; samples = []; pump(0.4)
        otpEvents = []; pointerCell = nil
        var t0 = otpClock()
        for (i, p) in r["phases"].array.enumerated() {
            let label = p["label"].string
            let next = i + 1 < r["phases"].array.count ? r["phases"].array[i + 1]["t"].number! : (p["t"].number! + 300)
            let prevStart = phaseStart
            phaseStart = t0 + p["t"].number!
            let carried = samples.map { Sample(t: $0.t + prevStart - phaseStart, m: $0.m) }.filter { $0.t >= -45 && $0.t < 0 }
            // The earlier phases' frames are re-timed once (carried) and never kept under their old times: before 9-6-124 the frames
            // an earlier phase had kept in [-45, 0) stayed in the buffer with their old times, so every phase's window held stale
            // frames of other phases (S71-03: Backspace-x3's frame before a drawing gap was one with cell 5 unfocused).
            samples = carried
            let wait = phaseStart - otpClock(); if wait > 0 { pump(wait / 1000) }
            samples = samples.filter { $0.t >= -45 && $0.t < 0 }
            // Chrome's keystroke times in this phase: its input / invalid-input events (one per key).
            cadence = r["events"].array.filter { ["mdInput", "mdInvalidInput"].contains($0["name"].string) && $0["t"].number! >= p["t"].number! && $0["t"].number! < next }.map { $0["t"].number! - p["t"].number! - 2 }
            if !label.hasPrefix("type") && !label.hasPrefix("overtype") { cadence = [] }
            maxLate = max(maxLate, otpClock() - phaseStart)
            let e0 = otpEvents.count
            #if !canImport(AppKit)
            AWCShimTouch.keyArrivals = []
            #endif
            act(name, label)
            let remaining = next - (otpClock() - t0); pump(max(0.05, remaining / 1000))
            #if canImport(AppKit)
            func anchored(_ t: Double) -> (t: Double, spread: Double) { (t, 0) }
            #else
            // iOS: a hardware key reaches a UIKit text input through the keyboard one or more run-loop turns after the HID key-down
            // (5–70 ms; di, 2026-11-04), so each keystroke's frames are timed from its arrival, the field's own input event, rather
            // than from Chrome's schedule: Chrome's frame at t after its k-th input is compared at t + (native k − Chrome k).
            let inputNames = ["mdInput", "mdInvalidInput"]
            let webInputs = r["events"].array.filter { inputNames.contains($0["name"].string) && $0["t"].number! >= p["t"].number! && $0["t"].number! < next }.map { $0["t"].number! - p["t"].number! }
            func arrived() -> [Double] { otpEvents[e0...].filter { inputNames.contains($0.name) }.map { $0.t - phaseStart } }
            var waited = 0.0   // keys still on their way through the keyboard at the phase's end (bounded)
            while arrived().count < webInputs.count && waited < 400 { pump(0.01); waited += 10 }
            let nativeInputs = arrived()
            // Keys with no input event (Home, End, Delete, arrows): Chrome dispatches the keys of one step in one task, so they are timed
            // from their HID arrival at UIKit (harness time, 9-6; the simulator's HID delivery is not product time).
            let keyOnly = (["Home", "End", "ArrowLeft"].contains(label) && webInputs.isEmpty) || (label == "Delete-at-0" && AWCShimTouch.keyArrivals.count >= 2)
            let shifts: [(at: Double, late: Double)] = keyOnly ? AWCShimTouch.keyArrivals.map { (0, max(0, $0 - phaseStart)) }
                : webInputs.count == nativeInputs.count ? zip(webInputs, nativeInputs).map { ($0, max(0, $1 - $0)) } : []
            // The phase's end state once its last key arrived; the following phases keep their own timelines (start that much later).
            if let last = shifts.last, last.late > 0 { let wait = t0 + next + last.late - otpClock(); if wait > 0 { pump(wait / 1000) } }
            let over = otpClock() - (t0 + next); if over > 0 { t0 += over }
            // Keys Chrome applied together (one dispatch, e.g. Backspace ×3) arrive over several turns: compared from the first
            // arrival, with the frames up to the last one counted.
            func anchored(_ t: Double) -> (t: Double, spread: Double) {
                guard let at = shifts.last(where: { $0.at <= t + 1 })?.at else { return (t, 0) }
                let group = shifts.filter { abs($0.at - at) <= 1 }.map(\.late), lo = group.min() ?? 0
                return (t + lo, (group.max() ?? lo) - lo)
            }
            #endif
            // Motion: every cell's border colour in each Chrome frame inside the native envelope.
            var motion = 0, motionBad = 0
            for s in p["samples"].array {
                let t = s["t"].number!
                for (k, c) in s["cells"].array.enumerated() {
                    let want = expectedBorder(c["bc"].string, c["bw"].number!)
                    let a = anchored(t)
                    guard let env = envelope(a.t, spread: a.spread, { hexRGBA($0.m["cell-\(k)"]?.metrics["borderColor"]?.string) }) else { continue }
                    motion += 1
                    if (0..<3).contains(where: { want[$0] < env.0[$0] - 3 || want[$0] > env.1[$0] + 3 }) {
                        motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) cell \(k) border \(want) not in \(env)") }
                    }
                }
            }
            check(motionBad == 0, "\(name) \(label) motion: \(motionBad)/\(motion) frames outside the envelope")
            if motionBad > 0 {
                // The native frames of a failing phase: time, focused cell, value and every cell's border.
                #if !canImport(AppKit)
                print("    diag \(name) \(label) web inputs \(webInputs) native \(nativeInputs) shifts \(shifts.map(\.late))")
                let badCells = Set(p["samples"].array.flatMap { s -> [Int] in s["cells"].array.enumerated().compactMap { (k, c) -> Int? in
                    let a = anchored(s["t"].number!); let w = expectedBorder(c["bc"].string, c["bw"].number!)
                    guard let env = envelope(a.t, spread: a.spread, { hexRGBA($0.m["cell-\(k)"]?.metrics["borderColor"]?.string) }) else { return nil }
                    return (0..<3).contains(where: { w[$0] < env.0[$0] - 3 || w[$0] > env.1[$0] + 3 }) ? k : nil } })
                for k in badCells.sorted().prefix(2) {
                    print("    diag cell \(k) chrome (t anchored want-R env-R): " + p["samples"].array.filter { $0["t"].number! <= 260 }.map { s -> String in
                        let a = anchored(s["t"].number!); let w = expectedBorder(s["cells"].array[k]["bc"].string, s["cells"].array[k]["bw"].number!)
                        let env = envelope(a.t, spread: a.spread, { hexRGBA($0.m["cell-\(k)"]?.metrics["borderColor"]?.string) })
                        return "\(Int(s["t"].number!)):\(Int(a.t))/\(Int(w[0]))/\(Int(env?.0[0] ?? -1))-\(Int(env?.1[0] ?? -1))" }.joined(separator: " "))
                    print("    diag cell \(k) native (t R): " + samples.filter { $0.t >= -20 && $0.t <= 260 }.map { f in "\(Int(f.t)):\(hexRGBA(f.m["cell-\(k)"]?.metrics["borderColor"]?.string).map { Int($0[0]) } ?? -1)" }.joined(separator: " "))
                }
                #endif
                #if canImport(AppKit)
                for k in [3, 4, 5] { print("    diagmac cell \(k) native (t:R/B): " + samples.filter { $0.t >= -45 && $0.t <= 130 }.map { f in "\(Int(f.t)):\(hexRGBA(f.m["cell-\(k)"]?.metrics["borderColor"]?.string).map { "\(Int($0[0]))/\(Int($0[2]))" } ?? "-")" }.joined(separator: " ")) }
                #endif
                for f in samples.filter({ $0.t >= -20 && $0.t <= 200 }).prefix(16) {
                    let h = f.m["md-otp-field"]
                    let borders = (0..<12).compactMap { f.m["cell-\($0)"]?.metrics["borderColor"]?.string }.joined(separator: " ")
                    print("    native t=\(Int(f.t)) focus=\(h?.metrics["focusedIndex"]?.number.map { Int($0) } ?? -1) value=\(h?.metrics["value"]?.string ?? "-") \(borders)")
                }
            }
            report.append(["run": name, "phase": label, "frames": motion, "outside": motionBad])
            guard let lastS = p["samples"].array.last, let fin = samples.last?.m else { continue }
            let h = fin["md-otp-field"]
            check(h?.metrics["value"]?.string == lastS["value"].string, "\(name) \(label) value \(h?.metrics["value"]?.string ?? "-") vs \(lastS["value"].string)")
            let active = lastS["active"].number.map { Int($0) } ?? -1
            check((h?.metrics["focusedIndex"]?.number.map { Int($0) } ?? -1) == active, "\(name) \(label) focused cell \(String(describing: h?.metrics["focusedIndex"])) vs \(active)")
            for (k, c) in lastS["cells"].array.enumerated() {
                let cell = fin["cell-\(k)"]
                check(cell?.metrics["text"]?.string == c["v"].string, "\(name) \(label) cell \(k) text \(cell?.metrics["text"]?.string ?? "-") vs \(c["v"].string)")
                check(cell?.metrics["borderWidth"]?.number == c["bw"].number, "\(name) \(label) cell \(k) border width \(String(describing: cell?.metrics["borderWidth"])) vs \(c["bw"])")
                let want = expectedBorder(c["bc"].string, c["bw"].number!), got = hexRGBA(cell?.metrics["borderColor"]?.string) ?? [-99, -99, -99, 0]
                check((0..<3).allSatisfy { abs(want[$0] - got[$0]) <= 3 }, "\(name) \(label) cell \(k) border \(cell?.metrics["borderColor"]?.string ?? "-") vs \(c["bc"].string)")
            }
        }
        // Teardown: Chrome's next run replaces the field, which blurs it (a pending change commits). The page's last run is not replaced.
        if !last { _ = window.makeFirstResponder(nil); pump(0.05) }
        let web = r["events"].array, native = otpEvents.filter { $0.name.hasPrefix("md") && $0.name != "mdInvalid" && $0.name != "mdReset" }
        check(native.count == web.count, "\(name) \(native.count) events vs \(web.count): native \(native.map { "\($0.name) \($0.detail)" })")
        for (i, (w, n)) in zip(web, native).enumerated() {
            let wn = w["name"].string == "submit" ? "mdSubmit" : w["name"].string
            check(wn == n.name, "\(name) event \(i) \(n.name) vs \(wn)")
            if wn != "mdSubmit" { check(n.detail == w["detail"], "\(name) event \(i) \(n.name) detail \(n.detail) vs \(w["detail"])") }
        }
        _ = window.makeFirstResponder(nil); otpPointer.update(phase: .leave)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = OTPAcceptingHost(rootView: OTPStatesFixture(state: state))
        window = OTPKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 560, height: 320), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        #if canImport(AppKit)
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        #endif
        pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("otpfield-web-states.json")))
        let only = ProcessInfo.processInfo.environment["AWC_OTP_ONLY"]
        for (k, list) in [("runs", false), ("reduced", true)] {
            let runs = oracle[k].array
            for (i, r) in runs.enumerated() where only.map({ r["name"].string.contains($0) }) ?? true {
                for attempt in 1...3 {
                    let c0 = checks, f0 = failures.count, r0 = report.count
                    maxLate = 0; runOne(r, reduced: list, last: i == runs.count - 1)
                    if failures.count == f0 || maxLate <= 12 || attempt == 3 { if attempt > 1 { report.append(["run": r["name"].string, "attempts": attempt]) }; break }
                    print("  \(r["name"].string): input up to \(Int(maxLate)) ms late, repeating"); checks = c0; failures.removeLast(failures.count - f0); report.removeLast(report.count - r0)
                }
            }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_OTP_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("OTP field native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
