import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-text-field interaction and motion against Chrome 153 (Mac capture of tf-states.html, 13 runs, full and reduced motion):
// real AppKit mouse and key events drive the native input (field editor). Checks the md* event sequence (names, details,
// debounce / throttle timing), every phase's end state (label, indicator / outline / notch, value, focus, support row,
// host height) and the per-frame label, indicator and outline motion inside Chrome's ±2-frame envelope.
#if canImport(AppKit)
final class TFKeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
/// SwiftUI receives a synthesized press while the test process is not the active application (another process activated):
/// NSWindow.sendEvent hands an inactive app's first click only to views that accept first mouse (fi, 2026-10-31).
final class TFAcceptingHost: NSHostingView<TFStatesFixture> { override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true } }
#else
typealias TFKeyWindow = NSWindow
typealias TFAcceptingHost = NSHostingView<TFStatesFixture>
#endif
@Observable final class TFStatesState {
    var node = AWCNode(id: "tf", tag: "md-text-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = false
    var form: AWCFormState? = nil
    var measurements: [AWCNativeInspectionNode] = []
    var formatting = AWCTextFieldFormatting()
}
struct TFRecorded { let t: Double; let name: String; let detail: AWCValue }
@MainActor var tfEvents: [TFRecorded] = []
@MainActor var tfFinalAttempt = false
/// The source's emitSearch replayed on the delivered keystrokes: Chrome's events without its mdSearch, each kept at the time of
/// the matching native event, plus the emissions of debounce (trailing), throttle (leading, then the latest value at each window
/// end) and distinct-until-changed; a timer due at an input's instant fires after that input.
@MainActor func tfReplay(_ web: [AWCValue], native: [TFRecorded], debounce: Double, throttle: Double) -> [AWCValue] {
    let kept = web.filter { $0["name"].string != "mdSearch" }, nativeKept = native.filter { $0.name != "mdSearch" }
    guard kept.count == nativeKept.count else { return web }
    var emissions: [(Double, String)] = [], last: String? = nil
    func distinct(_ t: Double, _ v: String) { if v != last { last = v; emissions.append((t, v)) } }
    var debounceDue: (Double, String)? = nil, windowEnd: Double? = nil, pending = false, current = ""
    func fire(before t: Double) {
        while true {
            var next: (Double, Int)? = nil
            if let d = debounceDue, d.0 < t { next = (d.0, 0) }
            if let w = windowEnd, w < t, next == nil || w < next!.0 { next = (w, 1) }
            guard let n = next else { return }
            if n.1 == 0 { let d = debounceDue!; debounceDue = nil; distinct(d.0, d.1) }
            else { windowEnd = nil; if pending { pending = false; distinct(n.0, current) } }
        }
    }
    for e in native where e.name == "mdInput" {
        let t = e.t, v = e.detail.string
        fire(before: t); current = v
        if debounce > 0 { debounceDue = (t + debounce, v) }
        if throttle > 0 { if windowEnd == nil { distinct(t, v); pending = false; windowEnd = t + throttle + 1 } else { pending = true } }
        if debounce <= 0 && throttle <= 0 { distinct(t, v) }
    }
    fire(before: .infinity)
    var timed: [(Double, Int, AWCValue)] = zip(kept, nativeKept).enumerated().map { ($0.element.1.t, 0, $0.element.0) }
    timed += emissions.map { ($0.0, 1, AWCValue.object(["name": .string("mdSearch"), "t": .number($0.0), "detail": .string($0.1)])) }
    return timed.enumerated().sorted { a, b in a.element.0 != b.element.0 ? a.element.0 < b.element.0 : a.element.1 != b.element.1 ? a.element.1 < b.element.1 : a.offset < b.offset }.map { $0.element.2 }
}
@MainActor var tfClock: () -> Double = { CACurrentMediaTime() * 1000 }
let tfPointer = AWCNativePointerState()
@MainActor let textFieldStatesController = AWCTextFieldController()
struct TFStatesFixture: View {
    let state: TFStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node) { e in MainActor.assumeIsolated { tfEvents.append(.init(t: tfClock(), name: e.name, detail: e.detail)) } }
                .frame(width: 320).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .environment(\.awcFormState, state.form)
            .environment(\.awcNativePointerState, tfPointer)
            .awcTextFieldController(textFieldStatesController)
            .awcTextFieldFormatting(state.formatting)
            .awcFieldReducedMotion(state.reduced)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "tf", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeTextFieldStatesIntegration {
    static let state = TFStatesState()
    static var host: NSHostingView<TFStatesFixture>!, window: TFKeyWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func dgSuffix() -> String {
        #if !canImport(AppKit)
        return AWCDG.suffix()
        #else
        return ""
        #endif
    }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name + dgSuffix()); fflush(stdout) } }
    struct Sample { var t: Double; var m: [String: AWCNativeInspectionNode]; var ph: Int; var at: Double
        nonisolated(unsafe) static var cur = 0
        @MainActor init(t: Double, m: [String: AWCNativeInspectionNode], ph: Int = Sample.cur, at: Double? = nil) { self.t = t; self.m = m; self.ph = ph; self.at = at ?? tfClock() } }
    static var samples: [Sample] = []
    static var phaseStart = 0.0
    static var tabBackFocuses = false
    static func pump(_ duration: Double) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004))
            var m: [String: AWCNativeInspectionNode] = [:]; for n in state.measurements { m[n.name] = n }
            samples.append(.init(t: tfClock() - phaseStart, m: m))
        } while Date() < end
    }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        return [0, 0, 0, 0]
    }
    static func hex(_ h: String) -> [Double] { let c = Color(awcHex: h).resolve(in: EnvironmentValues()); return [Double(c.red), Double(c.green), Double(c.blue), Double(c.opacity)] }
    static func premul(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func colorDistance(_ native: String?, _ web: String) -> Double {
        guard let native else { return 9 }; return zip(premul(hex(native)), premul(css(web))).map { abs($0 - $1) }.max() ?? 9
    }
    // Real input.
    static func key(_ chars: String, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
            NSApp.sendEvent(e)
        }
    }
    /// Keystrokes at Chrome's recorded cadence (the oracle's input events, relative to the phase start) when known.
    static var cadence: [Double] = []
    /// The latest a keystroke landed after its oracle time in the current run (ms): the timer races of debounce/throttle
    /// are only meaningful when the keystrokes kept Chrome's cadence.
    static var maxLate = 0.0
    /// macOS virtual key codes (the iOS harness maps them to HID usages); `true` = with Shift.
    static let codes: [Character: (UInt16, Bool)] = {
        var m: [Character: (UInt16, Bool)] = [:]
        let letters: [(Character, UInt16)] = [("a",0),("s",1),("d",2),("f",3),("h",4),("g",5),("z",6),("x",7),("c",8),("v",9),("b",11),("q",12),("w",13),("e",14),("r",15),("y",16),("t",17),("o",31),("u",32),("i",34),("p",35),("l",37),("j",38),("k",40),("n",45),("m",46)]
        for (c, k) in letters { m[c] = (k, false); m[Character(c.uppercased())] = (k, true) }
        for (c, k) in [("1",18),("2",19),("3",20),("4",21),("6",22),("5",23),("9",25),("7",26),("8",28),("0",29),(".",47),(",",43),("-",27),(" ",49)] as [(Character, UInt16)] { m[c] = (k, false) }
        m["@"] = (19, true); return m
    }()
    static func type(_ text: String) {
        for ch in text {
            if !cadence.isEmpty { let at = cadence.removeFirst(); let wait = (phaseStart + at) - tfClock(); if wait > 0 { pump(wait / 1000) }; maxLate = max(maxLate, tfClock() - (phaseStart + at)) }
            if ch == "\n" { key("\r", 36) } else { let c = codes[ch] ?? (0, false); key(String(ch), c.0, c.1 ? .shift : []) }
            if cadence.isEmpty { pump(0.033) } else { pump(0.002) }
        }
    }
    /// Press length for buttons: Chrome's release lands where the phase's first md event did (CDP latency included).
    static var pressMs = 0.0
    static func click(_ p: CGPoint) {
        let wp = host.convert(p, to: nil)
        if pressMs > 4 {
            func ev(_ t: NSEvent.EventType) -> NSEvent { NSEvent.mouseEvent(with: t, location: wp, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: t == .leftMouseDown ? 1 : 0)! }
            tfPointer.update(phase: .down, location: p)
            let up = ev(.leftMouseUp); DispatchQueue.main.asyncAfter(deadline: .now() + (pressMs - 2) / 1000) { NSApp.postEvent(up, atStart: false) }
            NSApp.sendEvent(ev(.leftMouseDown)); pump(pressMs / 1000 + 0.004)
            tfPointer.update(phase: .up, location: p); return
        }
        tfPointer.update(phase: .down, location: p)
        func ev(_ t: NSEvent.EventType) -> NSEvent {
            NSEvent.mouseEvent(with: t, location: wp, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                               context: nil, eventNumber: 0, clickCount: 1, pressure: t == .leftMouseDown ? 1 : 0)!
        }
        // AppKit text views track the press in a nested event loop: queue the release first so it can end the loop.
        NSApp.postEvent(ev(.leftMouseUp), atStart: false)
        NSApp.sendEvent(ev(.leftMouseDown))
        pump(0.01)
        tfPointer.update(phase: .up, location: p)
    }
    static func centre(_ part: String) -> CGPoint? { state.measurements.first { $0.name == part }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func act(_ run: String, _ label: String) {
        switch label {
        case "hover": if let c = centre("container") { tfPointer.update(phase: .move, location: c) }
        case "press-focus", "focus": if let c = centre("container") { click(c)
            #if canImport(AppKit)
            // A press that focused nothing: what AppKit hit at the point and where the text views are (diagnostic).
            pump(0.03)
            if textFieldStatesController.getInputElement()?.focused != true {
                let wp = host.convert(c, to: nil), hit = window.contentView?.hitTest(wp)
                func views(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(views) }
                let texts = window.contentView.map(views)?.filter { $0 is NSTextView || $0 is NSTextField }.map { "\(Swift.type(of: $0)) \($0.convert($0.bounds, to: nil)) hidden \($0.isHiddenOrHasHiddenAncestor)" } ?? []
                print("  \(run) \(label): press at \(wp) focused nothing (app active \(NSApp.isActive), key \(window.isKeyWindow)); hit \(hit.map { "\(Swift.type(of: $0)) \($0.convert($0.bounds, to: nil))" } ?? "nil"); first responder \(window.firstResponder.map { "\(Swift.type(of: $0))" } ?? "nil"); inputs \(texts)")
            }
            #endif
        }
        case "type-Hello": type("Hello")
        case "select-all-delete": textFieldStatesController.select(); pump(0.01); key("\u{7F}", 51)
        // Page focus navigation: Tab leaves the field (the page has nothing after it); Shift+Tab returns only where Chrome did.
        // (Chrome blurs at the Tab keydown: the focus leaves the page's last focusable element at once.)
        case "tab-out", "blur": key("\t", 48); if textFieldStatesController.getInputElement()?.focused == true { _ = window.makeFirstResponder(nil) }
        case "tab-back-in": if tabBackFocuses { _ = textFieldStatesController.setFocus() }
        case "click-clear": if let c = centre("clear") { click(c) } else { check(false, "\(run) no clear measurement") }
        case "type-abc": type("abc")
        case "escape-clears", "escape-empty-noop": key("\u{1B}", 53)
        case "reveal", "hide": if let c = centre("password-toggle") { click(c) } else { check(false, "\(run) no password-toggle measurement") }
        case "type-bad": type("ada@")
        // Chrome: Tab moved focus to the form's Send button, so Enter submits the form from there.
        case "submit-enter": state.form?.submit()
        case "fix": if let c = centre("container") { click(c) }; pump(0.05); type("x.io")
        case "type-a1b2c3d4e5": type("a1b2c3d4e5")
        case "type-d": type("d")
        case "type-abcdefgh": type("abcdefgh")
        case "type-3-lines": type("one\ntwo\nthree")
        default: check(false, "\(run) unknown phase \(label)")
        }
    }
    static func properties(_ html: String) -> (tag: String, props: [String: AWCValue], form: Bool) {
        var p: [String: AWCValue] = [:]
        let tagRange = html.range(of: "<md-text-field")!
        let rest = html[tagRange.upperBound...], end = rest.firstIndex(of: ">")!
        let attrs = String(rest[..<end])
        let re = try! NSRegularExpression(pattern: #"([a-z-]+)(?:="([^"]*)")?"#)
        for m in re.matches(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)) {
            let k = String(attrs[Range(m.range(at: 1), in: attrs)!]); let v = m.range(at: 2).location == NSNotFound ? nil : String(attrs[Range(m.range(at: 2), in: attrs)!])
            let camel = k == "readonly" ? "readOnly" : k.split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.capitalized }.joined()
            if ["max-length", "debounce", "throttle", "rows", "min-length"].contains(k), let v, let n = Double(v) { p[camel] = .number(n) }
            else if let v { p[camel] = .string(v) } else { p[camel] = .bool(true) }
        }
        return ("md-text-field", p, html.contains("<form"))
    }
    /// The native value of `key` over [t-40, t+34] (Chrome's ±2 frames: native may lead by ≤40 ms or trail by ≤34 ms).
    static func envelope(_ t: Double, _ value: (Sample) -> Double?) -> (Double, Double)? {
        var window = samples.filter { $0.t >= t - 40 && $0.t <= t + 34 }
        #if !canImport(AppKit)
        // A frame UIKit did not draw (its text-input session set-up holds the main thread when focus moves): the screen
        // keeps the last drawn frame until the next one, so the frames around such a gap (> 34 ms) bound what was shown.
        if let before = samples.last(where: { $0.t < t - 40 }), (window.first?.t ?? .infinity) - before.t > 34 { window.insert(before, at: 0) }
        if let after = samples.first(where: { $0.t > t + 34 }), after.t - (window.last?.t ?? -.infinity) > 34 { window.append(after) }
        #endif
        let vs = window.compactMap(value)
        guard let lo = vs.min(), let hi = vs.max() else { return nil }
        return (lo, hi)
    }
    /// Phases that begin with a pointer press on the field (focus comes from the press, not the keyboard or a method).
    static func pressStarted(_ label: String) -> Bool { ["press-focus", "focus", "click"].contains(label) }
    static func runOne(_ r: AWCValue, reduced: Bool, last: Bool = false) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        let parsed = properties(r["html"].string)
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.form = parsed.form ? AWCFormState() : nil
        state.node = AWCNode(id: "tf", tag: parsed.tag, properties: parsed.props)
        tfPointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.measurements = []; state.epoch += 1; samples = []; pump(0.4)
        tfEvents = []
        let t0 = tfClock()
        #if !canImport(AppKit)
        AWCDG.start()
        #endif
        var phaseEnds: [(String, [String: AWCNativeInspectionNode])] = []
        for (i, p) in r["phases"].array.enumerated() {
            let label = p["label"].string
            Sample.cur = i
            let next = i + 1 < r["phases"].array.count ? r["phases"].array[i + 1]["t"].number! : (p["t"].number! + 450)
            let prevStart = phaseStart
            phaseStart = t0 + p["t"].number!
            #if !canImport(AppKit)
            AWCDG.input(planned: phaseStart)
            #endif
            let carried = samples.map { Sample(t: $0.t + prevStart - phaseStart, m: $0.m, ph: $0.ph, at: $0.at) }.filter { $0.t >= -45 && $0.t < 0 }
            // The earlier phases' frames are re-timed once (carried) and never kept under their old times (C96-01, 9-6-124).
            samples = carried
            // Hold the phase start against the oracle timeline (each phase begins at its recorded offset).
            let wait = phaseStart - tfClock(); if wait > 0 { pump(wait / 1000) }
            // Keep the frames just before the phase: native may lead Chrome by up to 40 ms (±2 frames).
            samples = samples.filter { $0.t >= -45 && $0.t < 0 }
            if ProcessInfo.processInfo.environment["AWC_DIAG_CARRY"] != nil {
                let stale = samples.filter { Swift.abs($0.t - ($0.at - phaseStart)) > 1 }.count
                var byPh: [Int: Int] = [:]; for x in samples { byPh[x.ph, default: 0] += 1 }
                print("DIAG-CARRY \(name) phase#\(i) \(label): buffer=\(samples.count) staleTime=\(stale) otherPhase=\(samples.filter { $0.ph != i }.count) byPhase=\(byPh.sorted { $0.key < $1.key }.map { "\($0.key):\($0.value)" }.joined(separator: ","))"); fflush(stdout)
            }
            tabBackFocuses = label == "tab-back-in" && (p["samples"].array.last?["input"]["focused"].bool ?? false)
            // Chrome's keystroke times in this phase: its `input` / mdInput events (one per key).
            let pEnd = next
            cadence = r["events"].array.filter { $0["name"].string == "mdInput" && $0["t"].number! >= p["t"].number! && $0["t"].number! < pEnd }.map { $0["t"].number! - p["t"].number! - 2 }
            if !label.hasPrefix("type") { cadence = [] }
            pressMs = ["click-clear", "reveal", "hide"].contains(label) ? (r["events"].array.first { $0["t"].number! >= p["t"].number! && $0["t"].number! < pEnd }.map { $0["t"].number! - p["t"].number! } ?? 0) : 0
            maxLate = max(maxLate, tfClock() - phaseStart)
            act(name, label)
            let remaining = next - (tfClock() - t0); pump(max(0.05, remaining / 1000))
            // Frame starvation (host load) while Chrome's frames show motion also voids the timing comparison.
            let os = p["samples"].array
            let moving = zip(os.dropFirst(), os).filter { cur, prev in ["fontSize", "y"].contains { cur["label"][$0].number != prev["label"][$0].number }
                || cur["indicator"]["height"].number != prev["indicator"]["height"].number || cur["notch"].number != prev["notch"].number }.compactMap { $0.0["t"].number }
            if let a = moving.min(), let b = moving.max() {
                let ts = samples.map(\.t).filter { $0 >= a - 40 && $0 <= b + 34 }.sorted()
                if ts.count > 1 { maxLate = max(maxLate, (zip(ts.dropFirst(), ts).map { $0 - $1 }.max() ?? 0) - 34) } else { maxLate = max(maxLate, 100) }
            }
            // iOS (UIKit) focuses a text input when the tap ends, as Safari on iOS does; Chrome's mouse focuses on press.
            // For phases a press starts, the focus motion is compared from each platform's focus moment (latency reported).
            var shift = 0.0
            #if !canImport(AppKit)
            // Each side's motion start: the first frame whose label size differs from the phase's opening frame.
            func nativeFont(_ x: Sample) -> Double? { x.m["label"]?.metrics["fontSize"]?.number }
            // The native start is the moment its label passes Chrome's first moving value, interpolated between the native frames
            // around it (a frame gap at the tap release must not move the start to the next frame).
            if pressStarted(label), let f0 = os.first?["label"]["fontSize"].number,
               let first = os.first(where: { abs(($0["label"]["fontSize"].number ?? f0) - f0) > 0.01 }),
               let chromeAt = first["t"].number, let cv = first["label"]["fontSize"].number,
               let n0 = samples.last(where: { $0.t < 0 }).flatMap(nativeFont),
               let k = samples.firstIndex(where: { $0.t >= 0 && abs((nativeFont($0) ?? n0) - n0) > 0.01 }), k > 0, let v1 = nativeFont(samples[k]) {
                let tp = samples[k - 1].t, tk = samples[k].t, crossing = tp + (tk - tp) * min(1, max(0, (n0 - cv) / (n0 - v1)))
                if crossing > chromeAt {
                    shift = crossing - chromeAt; samples = samples.map { Sample(t: $0.t - shift, m: $0.m, ph: $0.ph, at: $0.at) }
                    report.append(["run": name, "phase": label, "tapReleaseFocusLatency": shift])
                }
            }
            #endif
            // Motion: every oracle frame inside the native envelope.
            var motion = 0, motionBad = 0
            var dlv = 0.0
            #if !canImport(AppKit)
            if ProcessInfo.processInfo.environment["AWC_CMP"] != "none", ["tab-out", "blur"].contains(label) { // AWCDLV (default; AWC_CMP=none = planned input)
                if let k = AWCShimTouch.keyArrivals.first(where: { $0 >= phaseStart - 2 && $0 <= phaseStart + 200 }) { dlv = k - phaseStart }
                print("DLV tf \(name) \(label) d=" + String(format: "%.1f", dlv)); fflush(stdout)
            }
            #endif
            for s in p["samples"].array {
                let t = s["t"].number! + dlv
                if let fs = s["label"]["fontSize"].number, let env = envelope(t, { $0.m["label"]?.metrics["fontSize"]?.number }) {
                    motion += 1; if fs < env.0 - 0.05 || fs > env.1 + 0.05 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) label font \(fs) not in \(env)") } }
                }
                if let y = s["label"]["y"].number, let env = envelope(t, { $0.m["label"].map { Double($0.bounds.minY) } }) {
                    motion += 1; if y < env.0 - 0.3 || y > env.1 + 0.3 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) label y \(y) not in \(env)") } }
                }
                if let h = s["indicator"]["height"].number, let env = envelope(t, { $0.m["indicator"]?.metrics["height"]?.number }) {
                    motion += 1; if h < env.0 - 0.05 || h > env.1 + 0.05 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) indicator \(h) not in \(env)") } }
                }
                if let w = s["notch"].number, let env = envelope(t, { $0.m["fieldset"]?.metrics["legendWidth"]?.number }) {
                    motion += 1; if w < env.0 - 0.6 || w > env.1 + 0.6 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) notch \(w) not in \(env)") } }
                }
            }
            check(motionBad == 0, "\(name) \(label) motion: \(motionBad)/\(motion) frames outside the envelope")
            report.append(["run": name, "phase": label, "frames": motion, "outside": motionBad])
            // End state = the oracle's last frame of the phase against the native final frame.
            guard let last = p["samples"].array.last, let fin = samples.last?.m else { continue }
            phaseEnds.append((label, fin))
            // A press that focused nothing (a host still settling its views after the run's field was replaced) voids the run like
            // late input: it is repeated.
            if pressStarted(label), last["input"]["focused"].bool == true, fin["md-text-field"]?.metrics["focused"]?.bool != true { maxLate = max(maxLate, 100) }
            func near(_ a: Double?, _ b: Double?, _ what: String, _ tol: Double = 0.6) { guard let b else { return }; check(a.map { abs($0 - b) <= tol } ?? false, "\(name) \(label) \(what) \(a.map { "\($0)" } ?? "-") vs \(b)") }
            if last["label"] != .null {
                near(fin["label"].map { Double($0.bounds.minY) }, last["label"]["y"].number, "label y")
                near(fin["label"]?.metrics["fontSize"]?.number, last["label"]["fontSize"].number, "label font", 0.05)
                check(colorDistance(fin["label"]?.metrics["color"]?.string, last["label"]["color"].string) < 0.012, "\(name) \(label) label colour \(fin["label"]?.metrics["color"]?.string ?? "-") vs \(last["label"]["color"].string)")
            }
            if last["indicator"] != .null {
                near(fin["indicator"]?.metrics["height"]?.number, last["indicator"]["height"].number, "indicator height", 0.05)
                check(colorDistance(fin["indicator"]?.metrics["color"]?.string, last["indicator"]["color"].string) < 0.012, "\(name) \(label) indicator colour \(fin["indicator"]?.metrics["color"]?.string ?? "-") vs \(last["indicator"]["color"].string)")
            }
            if last["outline"] != .null {
                near(fin["fieldset"]?.metrics["borderWidth"]?.number, last["outline"]["width"].number, "outline width", 0.05)
                check(colorDistance(fin["fieldset"]?.metrics["color"]?.string, last["outline"]["color"].string) < 0.012, "\(name) \(label) outline colour \(fin["fieldset"]?.metrics["color"]?.string ?? "-") vs \(last["outline"]["color"].string)")
                near(fin["fieldset"]?.metrics["legendWidth"]?.number, last["notch"].number, "notch width", 0.8)
            }
            if last["input"] != .null {
                check(fin["md-text-field"]?.metrics["value"]?.string == last["host"]["value"].string, "\(name) \(label) value \(fin["md-text-field"]?.metrics["value"]?.string ?? "-") vs \(last["host"]["value"].string)")
                check(fin["md-text-field"]?.metrics["focused"]?.bool == last["input"]["focused"].bool, "\(name) \(label) focused \(String(describing: fin["md-text-field"]?.metrics["focused"])) vs \(last["input"]["focused"])")
                check(fin["input"]?.metrics["secure"]?.bool == (last["input"]["type"].string == "password"), "\(name) \(label) input type \(last["input"]["type"].string)")
            }
            near(fin["md-text-field"].map { Double($0.bounds.height) }, last["host"]["height"].number, "host height")
            check(fin["md-text-field"]?.metrics["floating"]?.bool == last["host"]["floating"].bool, "\(name) \(label) floating")
            check(fin["md-text-field"]?.metrics["error"]?.bool == last["host"]["error"].bool, "\(name) \(label) error state")
            if last["support"] != .null { check(fin["md-text-field"]?.metrics["validationMessage"]?.string == last["support"]["text"].string || last["support"]["text"].string == (state.node.properties["supportingText"]?.string ?? ""), "\(name) \(label) support \(last["support"]["text"].string)") }
        }
        // Teardown: Chrome's next run replaces the field, which blurs it (a pending change fires).
        // (The page's last run is never replaced, so it is not blurred.)
        if !last { _ = window.makeFirstResponder(nil); pump(0.05) }
        // Events: the field's md* sequence (form-level mdInvalid/mdSubmit/mdReset are not field events), in order, with details.
        let webAll = r["events"].array, native = tfEvents.filter { $0.name.hasPrefix("md") && !["mdInvalid", "mdSubmit", "mdReset"].contains($0.name) }
        // Keystroke cadence as delivered (the mdInput times) against Chrome's: the timer races of debounce / throttle are only
        // comparable on Chrome's cadence, so such a run is repeated; when the host still cannot keep it (iOS Simulator input
        // latency) on the last attempt, the expected mdSearch sequence is the source's emitSearch replayed on the keystrokes
        // actually delivered (input before a timer due at the same instant, as in Chrome).
        let timed = name.contains("debounce") || name.contains("throttle")
        let wi = webAll.filter { $0["name"].string == "mdInput" }.map { $0["t"].number! }, ni = native.filter { $0.name == "mdInput" }.map(\.t)
        var lateness = 0.0
        if timed, wi.count == ni.count, let w0 = wi.first, let n0 = ni.first { for (a, b) in zip(wi, ni) { lateness = max(lateness, abs((b - n0) - (a - w0))) } }
        if timed { maxLate = max(maxLate, lateness) }
        // On the last attempt any delivery jitter (or a late frame/input that would have repeated the run) puts a throttle boundary
        // (1 ms) or a debounce window out of Chrome's order: the source's emitSearch is replayed on the delivered keystrokes.
        // A key within one frame (Chrome's timers are frame-quantised: its window ended 16.7 ms late) of the throttle window end is a
        // boundary race the host cannot reproduce (S71-07, 9-8): the source's emitSearch is replayed on the delivered times.
        let thrWin = state.node.properties["throttle"]?.number ?? 0
        var nearBoundary = false
        if timed, thrWin > 0, let n0 = ni.first { for b in ni where abs((b - n0) - thrWin) <= 20 { nearBoundary = true } }
        let replay = timed && (nearBoundary || (tfFinalAttempt && (lateness > 4 || maxLate > 12)) || lateness > 12)
        let web = replay ? tfReplay(webAll, native: native, debounce: state.node.properties["debounce"]?.number ?? 0, throttle: state.node.properties["throttle"]?.number ?? 0) : webAll
        if replay { report.append(["run": name, "replayedTimers": true, "lateness": lateness]) }
        check(native.count == web.count, "\(name) \(native.count) md events vs \(web.count): native \(native.map { "\($0.name) \($0.detail.string) @\(Int($0.t))" })")
        for (i, (w, n)) in zip(web, native).enumerated() {
            check(w["name"].string == n.name, "\(name) event \(i) \(n.name) vs \(w["name"].string)")
            if w["name"].string == "mdValidityChange" {
                check(n.detail["valid"] == w["detail"]["valid"] && n.detail["validationMessage"].string == w["detail"]["validationMessage"].string && n.detail["flags"] == w["detail"]["flags"],
                      "\(name) event \(i) validity \(n.detail) vs \(w["detail"])")
            } else if w["detail"] != .null { check(n.detail == w["detail"], "\(name) event \(i) \(n.name) detail \(n.detail) vs \(w["detail"])") }
        }
        // Debounce / throttle timing: an mdSearch lands where Chrome's did relative to the preceding mdInput (±40 ms).
        if timed && !replay {
            for (i, w) in web.enumerated() where w["name"].string == "mdSearch" && i < native.count {
                guard let prevW = web[..<i].last(where: { $0["name"].string == "mdInput" }), let prevN = native[..<i].last(where: { $0.name == "mdInput" }) else { continue }
                let dw = w["t"].number! - prevW["t"].number!, dn = native[i].t - prevN.t
                check(abs(dw - dn) <= 40, "\(name) mdSearch \(i) delay \(dn) vs \(dw)")
            }
        }
        _ = window.makeFirstResponder(nil); tfPointer.update(phase: .leave)
    }
    /// 6-3: Shift+Tab out of a field between two buttons (a window without a document-order root) moves to the previous button;
    /// Tab still moves to the next one (n2-083 probe: Shift+Tab went forward, the field editor's own key-view loop).
    #if canImport(AppKit)
    static func shiftTabCheck() {
        func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
        func name(_ w: NSWindow) -> String {
            guard let r = w.firstResponder, r !== w else { return "body" }
            if let tv = r as? NSTextView, tv.delegate is NSView { return "field" }
            if let v = r as? NSView { return v.accessibilityLabel() ?? "view" }
            return "other"
        }
        func key(_ w: NSWindow, shift: Bool) {
            let c = shift ? "\u{19}" : "\t"
            for t in [NSEvent.EventType.keyDown, .keyUp] {
                NSApp.postEvent(NSEvent.keyEvent(with: t, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime,
                                                 windowNumber: w.windowNumber, context: nil, characters: c, charactersIgnoringModifiers: "\t", isARepeat: false, keyCode: 48)!, atStart: false)
            }
            pump(0.25)
        }
        let root = AWCMenuScope {
            HStack(spacing: 16) {
                AWCNativeView(tag: "md-button", properties: ["label": "Before"])
                AWCNativeView(tag: "md-text-field", properties: ["label": "Fruit"]).frame(width: 220)
                AWCNativeView(tag: "md-button", properties: ["label": "After"])
            }.padding(40)
        }
        let h = NSHostingView(rootView: root)
        let w = TFKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 700, height: 300), styleMask: [.borderless], backing: .buffered, defer: false)
        w.isReleasedWhenClosed = false; w.contentView = h; w.orderFrontRegardless(); w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); pump(0.6)
        guard let tf = all(h).first(where: { $0 is NSTextField }) else { check(false, "shift-tab: no text field"); return }
        _ = w.makeFirstResponder(tf); pump(0.2)
        var back = [name(w)]
        for _ in 0..<3 { key(w, shift: true); back.append(name(w)) }
        check(back == ["field", "Before", "After", "field"], "shift-tab backward order \(back) vs [field, Before, After, field]")
        _ = w.makeFirstResponder(tf); pump(0.2)
        var fwd = [name(w)]
        for _ in 0..<3 { key(w, shift: false); fwd.append(name(w)) }
        check(fwd == ["field", "After", "Before", "field"], "tab forward order \(fwd) vs [field, After, Before, field]")
        w.close(); pump(0.2)
    }
    #endif
    // S71-05: members of md-text-field that no native test covered. Each reads the field's own inspection (the values the renderer
    // applies), so a renderer that ignores the member fails the case.
    static func memberCase(_ props: [String: AWCValue], children: [AWCNode] = []) {
        state.node = AWCNode(id: "tf", tag: "md-text-field", properties: props, children: children); state.measurements = []; state.reduced = true; state.epoch += 1; pump(0.3)
    }
    static func metric(_ part: String, _ key: String) -> AWCValue? { state.measurements.first { $0.name == part }?.metrics[key] }
    static func memberCases() {
        func mc(_ ok: Bool, _ name: String) { check(ok, "member " + name) }
        memberCase(["label": "Q", "enterKeyHint": "search", "autoCapitalize": "words", "spellcheck": false])
        mc(metric("input", "enterKeyHint")?.string == "search", "enterKeyHint search"); mc(metric("input", "autocapitalize")?.string == "words", "autoCapitalize words"); mc(metric("input", "spellcheck")?.bool == false, "spellcheck false")
        memberCase(["label": "Q", "enterKeyHint": "done", "autoCapitalize": "characters", "spellcheck": true])
        mc(metric("input", "enterKeyHint")?.string == "done", "enterKeyHint done"); mc(metric("input", "autocapitalize")?.string == "characters", "autoCapitalize characters"); mc(metric("input", "spellcheck")?.bool == true, "spellcheck true")
        memberCase(["label": "Q"])
        mc(metric("input", "enterKeyHint")?.string == "" && metric("input", "autocapitalize")?.string == "" && metric("input", "spellcheck")?.bool == true, "hint defaults")
        memberCase(["label": "P", "type": "password", "passwordToggle": true, "value": "secret", "showPasswordLabel": "Mostrar", "hidePasswordLabel": "Ocultar"])
        mc(metric("password-toggle", "label")?.string == "Mostrar", "showPasswordLabel")
        if let c = centre("password-toggle") { click(c); pump(0.3) } else { mc(false, "password-toggle measured") }
        mc(metric("password-toggle", "label")?.string == "Ocultar", "hidePasswordLabel")
        memberCase(["label": "P", "type": "password", "passwordToggle": true, "value": "secret"])
        mc(metric("password-toggle", "label")?.string == "Show password", "showPasswordLabel default")
        memberCase(["label": "V", "speechToText": true, "speechLang": "ro-RO"])
        mc(metric("speech", "lang")?.string == "ro-RO", "speechLang")
        memberCase(["label": "V", "speechToText": true])
        mc(metric("speech", "lang")?.string == "", "speechLang default")
        for (slot, props, part) in [("clear-icon", ["clearable": true, "value": "x"] as [String: AWCValue], "clear"), ("password-toggle-icon", ["type": "password", "passwordToggle": true, "value": "x"], "password-toggle"), ("speech-icon", ["speechToText": true], "speech")] {
            var p = props; p["label"] = "S"
            memberCase(p, children: [.symbol("star", slot: slot)])
            mc(metric(part, "icon")?.string == "slot", "slot " + slot)
            memberCase(p)
            mc(metric(part, "icon")?.string == "default", "slot " + slot + " absent")
        }
        // formatOn + parser (the formatter shows upper case; the parser turns the typed text back to lower case for the events)
        state.formatting = AWCTextFieldFormatting(formatter: { $0.uppercased() }, parser: { $0.lowercased() })
        for (fo, shown) in [("input", "AB"), ("blur", "ab")] {
            memberCase(["label": "F", "formatOn": .string(fo)]); tfEvents = []
            if let c = centre("input") { click(c); pump(0.2) } else { mc(false, "input measured") }
            type("ab"); pump(0.2)
            let got = metric("input", "value")?.string ?? "nil"
            mc(got == shown, "formatOn " + fo + " shows " + shown + " got " + got)
            if fo == "input" { let last = tfEvents.last { $0.name == "mdInput" }?.detail.string ?? "nil"; mc(last == "ab", "parser detail ab got " + last) }
        }
        state.formatting = AWCTextFieldFormatting()
        // inputRole, inputExpanded, inputAriaAutocomplete
        memberCase(["label": "C", "inputRole": "combobox", "inputExpanded": true, "inputAriaAutocomplete": "list"])
        mc(metric("input", "role")?.string == "combobox", "inputRole combobox"); mc(metric("input", "expanded")?.string == "true", "inputExpanded true"); mc(metric("input", "ariaAutocomplete")?.string == "list", "inputAriaAutocomplete list")
        memberCase(["label": "C", "inputRole": "combobox", "inputExpanded": false])
        mc(metric("input", "expanded")?.string == "false", "inputExpanded false")
        memberCase(["label": "C"])
        mc(metric("input", "role")?.string == "textbox" && metric("input", "expanded")?.string == "none" && metric("input", "ariaAutocomplete")?.string == "", "inputRole defaults")
        // mdSpeechResult (external speech: the host owns recognition, the field reports the toggle)
        memberCase(["label": "V", "speechToText": "external"]); tfEvents = []
        for (n, want) in [(1, true), (2, false)] {
            if let c = centre("speech") { click(c); pump(0.2) } else { mc(false, "speech measured") }
            let sp = tfEvents.filter { $0.name == "mdSpeechResult" }
            mc(sp.count == n && sp.last?.detail["listening"].bool == want && sp.last?.detail["transcript"].string == "", "mdSpeechResult \(n) listening \(want) count \(sp.count)")
        }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = TFAcceptingHost(rootView: TFStatesFixture(state: state))
        window = TFKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 480, height: 320), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        #if canImport(AppKit)
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        #endif
        pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("textfield-web-states.json")))
        let only = ProcessInfo.processInfo.environment["AWC_TF_ONLY"]
        for (k, list) in [("runs", false), ("reduced", true)] {
            let runs = oracle[k].array
            for (i, r) in runs.enumerated() where only.map({ r["name"].string.contains($0) }) ?? true {
                // A run whose keystrokes fell behind Chrome's cadence (host load) is repeated, at most twice.
                for attempt in 1...3 {
                    let c0 = checks, f0 = failures.count, r0 = report.count
                    tfFinalAttempt = attempt == 3
                    maxLate = 0; runOne(r, reduced: list, last: i == runs.count - 1)
                    if failures.count == f0 || maxLate <= 12 || attempt == 3 { if attempt > 1 { report.append(["run": r["name"].string, "attempts": attempt]) }; break }
                    print("  \(r["name"].string): input or frames up to \(Int(maxLate)) ms late, repeating"); checks = c0; failures.removeLast(failures.count - f0); report.removeLast(report.count - r0)
                }
            }
        }
        if only == nil || only == "members" { memberCases() }
        #if canImport(AppKit)
        if only == nil || only == "shift-tab" { shiftTabCheck() }
        #endif
        if let output = ProcessInfo.processInfo.environment["AWC_TF_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Text field native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
