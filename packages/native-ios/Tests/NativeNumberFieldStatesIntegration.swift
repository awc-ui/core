import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-number-field interaction against Chrome 153 (Mac capture of nf-states.html, 7 runs, full and reduced motion): real
// AppKit key, mouse and scroll-wheel events. Checks the md* event sequence (names, value / formattedValue / reason and the
// press-and-hold tick times), every phase's end state (value, display text, focus, stepper disabled states, label) and the
// per-frame label motion inside Chrome's ±2-frame envelope.
#if canImport(AppKit)
final class NFKeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
/// SwiftUI receives a synthesized press while the test process is not the active application (another process activated):
/// NSWindow.sendEvent hands an inactive app's first click only to views that accept first mouse (fi, 2026-10-31).
final class NFAcceptingHost: NSHostingView<NFStatesFixture> { override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true } }
#else
typealias NFKeyWindow = NSWindow
typealias NFAcceptingHost = NSHostingView<NFStatesFixture>
#endif
@Observable final class NFStatesState {
    var node = AWCNode(id: "nf", tag: "md-number-field")
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
}
struct NFRecorded { let t: Double; let name: String; let detail: AWCValue }
@MainActor var nfEvents: [NFRecorded] = []
@MainActor var nfClock: () -> Double = { CACurrentMediaTime() * 1000 }
@MainActor let numberFieldStatesController = AWCNumberFieldController()
struct NFStatesFixture: View {
    let state: NFStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) {
            AWCNativeView(node: state.node) { e in MainActor.assumeIsolated { nfEvents.append(.init(t: nfClock(), name: e.name, detail: e.detail)) } }
                .frame(width: 320, alignment: .leading).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        }
            .awcNumberFieldController(numberFieldStatesController)
            .awcFieldReducedMotion(state.reduced)
            .awcTheme(theme)
            .awcNativeInspection(rootID: "nf", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeNumberFieldStatesIntegration {
    static let state = NFStatesState()
    static var host: NSHostingView<NFStatesFixture>!, window: NFKeyWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    struct Sample { var t: Double; var m: [String: AWCNativeInspectionNode]; var ph: Int; var at: Double
        nonisolated(unsafe) static var cur = 0
        @MainActor init(t: Double, m: [String: AWCNativeInspectionNode], ph: Int = Sample.cur, at: Double? = nil) { self.t = t; self.m = m; self.ph = ph; self.at = at ?? nfClock() } }
    static var samples: [Sample] = []
    static var phaseStart = 0.0
    static var maxLate = 0.0
    static func pump(_ duration: Double) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004))
            var m: [String: AWCNativeInspectionNode] = [:]; for n in state.measurements { m[n.name] = n }
            samples.append(.init(t: nfClock() - phaseStart, m: m))
        } while Date() < end
    }
    static func key(_ chars: String, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
            NSApp.postEvent(e, atStart: false)
        }
        // Dispatched through the event queue, as real input is: the text system reads NSApp.currentEvent (the dequeued event)
        // for the key behind a command such as moveUp:.
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    static func special(_ scalar: Int, _ code: UInt16, _ flags: NSEvent.ModifierFlags = []) { key(String(UnicodeScalar(UInt32(scalar))!), code, flags.union([.function, .numericPad])) }
    static var cadence: [Double] = []
    static let codes: [Character: UInt16] = ["1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, ".": 47, ",": 43, "-": 27]
    static func type(_ text: String) {
        for ch in text {
            if !cadence.isEmpty { let at = cadence.removeFirst(); let wait = (phaseStart + at) - nfClock(); if wait > 0 { pump(wait / 1000) }; maxLate = max(maxLate, nfClock() - (phaseStart + at)) }
            key(String(ch), codes[ch] ?? 0)
            pump(cadence.isEmpty ? 0.033 : 0.002)
        }
    }
    static func mouse(_ t: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        NSEvent.mouseEvent(with: t, location: host.convert(p, to: nil), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                           context: nil, eventNumber: 0, clickCount: 1, pressure: t == .leftMouseDown ? 1 : 0)!
    }
    static func click(_ p: CGPoint, hold: Double = 0) {
        if hold > 0 { NSApp.sendEvent(mouse(.leftMouseDown, p)); pump(hold); NSApp.sendEvent(mouse(.leftMouseUp, p)); return }
        // AppKit text views track the press in a nested event loop: queue the release first so it can end the loop.
        NSApp.postEvent(mouse(.leftMouseUp, p), atStart: false); NSApp.sendEvent(mouse(.leftMouseDown, p)); pump(0.01)
    }
    /// Chrome's WheelEvent delta is the negated AppKit scrolling delta (pixel units).
    static func wheel(_ p: CGPoint, dx: Int32, dy: Int32, shift: Bool = false) {
        #if canImport(AppKit)
        guard let cg = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: -dy, wheel2: -dx, wheel3: 0) else { return }
        cg.location = CGPoint(x: window.frame.minX + host.convert(p, to: nil).x, y: (NSScreen.screens.first?.frame.height ?? 0) - (window.frame.minY + host.convert(p, to: nil).y))
        if shift { cg.flags = .maskShift }
        if let e = NSEvent(cgEvent: cg) { NSApp.postEvent(e, atStart: false) }
        pump(0.01)
        #endif
    }
    static func centre(_ part: String) -> CGPoint? { state.measurements.first { $0.name == part }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func blurIfFocused() { if state.measurements.first(where: { $0.name == "md-number-field" })?.metrics["focused"]?.bool == true { _ = window.makeFirstResponder(nil) } }
    static func act(_ run: String, _ label: String) {
        switch label {
        case "focus": if let c = centre("input") { click(c) }
        case "ArrowUp", "ArrowUp-at-max": special(0xF700, 126)
        case "Shift+ArrowUp": special(0xF700, 126, .shift)
        case "Alt+ArrowDown": special(0xF701, 125, .option)
        case "End": special(0xF72B, 119)
        case "Home": special(0xF729, 115)
        case "select-type-12.5": numberFieldStatesController.select(); pump(0.005); type("12.5")
        case "type-out-of-range": numberFieldStatesController.select(); pump(0.005); type("250")
        case "select-type-9876,5": numberFieldStatesController.select(); pump(0.005); type("9876,5")
        case "Enter-commit": key("\r", 36)
        // Page focus navigation: Tab leaves the field (nothing focusable follows it on the page).
        case "Tab-blur-clamps", "Tab-reformat": key("\t", 48); pump(0.02); blurIfFocused()
        case "click-increment": if let c = centre("increment") { click(c, hold: 0.033) }
        case "click-decrement": if let c = centre("decrement") { click(c, hold: 0.033) }
        case "hold-increment-1200ms": if let c = centre("increment") { click(c, hold: 1.2) }
        case "wheel-unfocused-ignored", "wheel-up": if let c = centre("md-number-field") { wheel(c, dx: 0, dy: -100) }
        case "wheel-down": if let c = centre("md-number-field") { wheel(c, dx: 0, dy: 100) }
        case "shift-wheel-down": if let c = centre("md-number-field") { wheel(c, dx: 0, dy: 100, shift: true) }
        case "horizontal-pan-ignored": if let c = centre("md-number-field") { wheel(c, dx: 100, dy: 0) }
        default: check(false, "\(run) unknown phase \(label)")
        }
    }
    static func properties(_ html: String) -> [String: AWCValue] {
        var p: [String: AWCValue] = [:]
        let tagRange = html.range(of: "<md-number-field")!
        let rest = html[tagRange.upperBound...], end = rest.firstIndex(of: ">")!
        let attrs = String(rest[..<end])
        let re = try! NSRegularExpression(pattern: #"([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'))?"#)
        for m in re.matches(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)) {
            let k = String(attrs[Range(m.range(at: 1), in: attrs)!])
            let v = [2, 3].compactMap { m.range(at: $0).location == NSNotFound ? nil : String(attrs[Range(m.range(at: $0), in: attrs)!]) }.first
            let camel = k == "readonly" ? "readOnly" : k.split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.capitalized }.joined()
            if ["value", "min", "max", "step", "small-step", "large-step", "density"].contains(k), let v, let n = Double(v) { p[camel] = .number(n) }
            else if let v { p[camel] = .string(v) } else { p[camel] = .bool(true) }
        }
        return p
    }
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
    static func runOne(_ r: AWCValue, reduced: Bool, last: Bool = false) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.node = AWCNode(id: "nf", tag: "md-number-field", properties: properties(r["html"].string))
        _ = window.makeFirstResponder(nil)
        state.measurements = []; state.epoch += 1; samples = []; pump(0.4)
        nfEvents = []
        let t0 = nfClock()
        for (i, p) in r["phases"].array.enumerated() {
            let label = p["label"].string
            Sample.cur = i
            let next = i + 1 < r["phases"].array.count ? r["phases"].array[i + 1]["t"].number! : (p["t"].number! + 450)
            let prevStart = phaseStart
            phaseStart = t0 + p["t"].number!
            let carried = samples.map { Sample(t: $0.t + prevStart - phaseStart, m: $0.m, ph: $0.ph, at: $0.at) }.filter { $0.t >= -45 && $0.t < 0 }
            // The earlier phases' frames are re-timed once (carried) and never kept under their old times (C96-01, 9-6-124).
            samples = carried
            let wait = phaseStart - nfClock(); if wait > 0 { pump(wait / 1000) }
            samples = samples.filter { $0.t >= -45 && $0.t < 0 }
            if ProcessInfo.processInfo.environment["AWC_DIAG_CARRY"] != nil {
                let stale = samples.filter { Swift.abs($0.t - ($0.at - phaseStart)) > 1 }.count
                var byPh: [Int: Int] = [:]; for x in samples { byPh[x.ph, default: 0] += 1 }
                print("DIAG-CARRY \(name) phase#\(i) \(label): buffer=\(samples.count) staleTime=\(stale) otherPhase=\(samples.filter { $0.ph != i }.count) byPhase=\(byPh.sorted { $0.key < $1.key }.map { "\($0.key):\($0.value)" }.joined(separator: ","))"); fflush(stdout)
            }
            cadence = r["events"].array.filter { $0["name"].string == "mdInput" && $0["t"].number! >= p["t"].number! && $0["t"].number! < next }.map { $0["t"].number! - p["t"].number! - 2 }
            if !label.contains("type") { cadence = [] }
            maxLate = max(maxLate, nfClock() - phaseStart)
            act(name, label)
            let remaining = next - (nfClock() - t0); pump(max(0.05, remaining / 1000))
            #if !canImport(AppKit)
            // iOS (UIKit) focuses a text input when the tap ends (as Safari on iOS does); Chrome's mouse focuses on press. The
            // focus motion is compared from each side's motion start: the first frame whose label size leaves the opening one.
            let os = p["samples"].array
            func nativeFont(_ x: Sample) -> Double? { x.m["label"]?.metrics["fontSize"]?.number }
            // The native start is the moment its label passes Chrome's first moving value, interpolated between the native frames
            // around it (a frame gap at the tap release must not move the start to the next frame).
            if label == "focus", let f0 = os.first?["label"]["fontSize"].number,
               let first = os.first(where: { abs(($0["label"]["fontSize"].number ?? f0) - f0) > 0.01 }),
               let chromeAt = first["t"].number, let cv = first["label"]["fontSize"].number,
               let n0 = samples.last(where: { $0.t < 0 }).flatMap(nativeFont),
               let k = samples.firstIndex(where: { $0.t >= 0 && abs((nativeFont($0) ?? n0) - n0) > 0.01 }), k > 0, let v1 = nativeFont(samples[k]) {
                let tp = samples[k - 1].t, tk = samples[k].t, crossing = tp + (tk - tp) * min(1, max(0, (n0 - cv) / (n0 - v1)))
                if crossing > chromeAt {
                    let shift = crossing - chromeAt; samples = samples.map { Sample(t: $0.t - shift, m: $0.m, ph: $0.ph, at: $0.at) }
                    report.append(["run": name, "phase": label, "tapReleaseFocusLatency": shift])
                }
            }
            #endif
            // Motion: the label's per-frame size and position inside the native envelope (focus phases).
            var motion = 0, motionBad = 0
            for s in p["samples"].array {
                let t = s["t"].number!
                if let fs = s["label"]["fontSize"].number, let env = envelope(t, { $0.m["label"]?.metrics["fontSize"]?.number }) {
                    motion += 1; if fs < env.0 - 0.05 || fs > env.1 + 0.05 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) label font \(fs) not in \(env)") } }
                }
                if let y = s["label"]["y"].number, let env = envelope(t, { $0.m["label"].map { Double($0.bounds.minY) } }) {
                    motion += 1; if y < env.0 - 0.3 || y > env.1 + 0.3 { motionBad += 1; if motionBad <= 3 { print("  \(name) \(label) t=\(t) label y \(y) not in \(env)") } }
                }
            }
            check(motionBad == 0, "\(name) \(label) motion: \(motionBad)/\(motion) frames outside the envelope")
            guard let lastS = p["samples"].array.last, let fin = samples.last?.m else { continue }
            func near(_ a: Double?, _ b: Double?, _ what: String, _ tol: Double = 0.6) { guard let b else { return }; check(a.map { abs($0 - b) <= tol } ?? false, "\(name) \(label) \(what) \(a.map { "\($0)" } ?? "-") vs \(b)") }
            let h = fin["md-number-field"]
            check(h?.metrics["value"] == lastS["value"], "\(name) \(label) value \(String(describing: h?.metrics["value"])) vs \(lastS["value"])")
            check(fin["input"]?.metrics["value"]?.string == lastS["text"].string, "\(name) \(label) text \(fin["input"]?.metrics["value"]?.string ?? "-") vs \(lastS["text"].string)")
            var wantFocus = lastS["focused"].bool
            #if !canImport(AppKit)
            // Touch: a stepper press does not focus the input (source: only a non-touch pointer press focuses it).
            if name.hasPrefix("nf-steppers-pointer") { wantFocus = false }
            #endif
            check(h?.metrics["focused"]?.bool == wantFocus, "\(name) \(label) focused \(String(describing: h?.metrics["focused"])) vs \(String(describing: wantFocus))")
            for k in ["increment", "decrement"] where lastS[k] != .null {
                check(fin[k]?.metrics["disabled"]?.bool == lastS[k]["disabled"].bool, "\(name) \(label) \(k) disabled \(String(describing: fin[k]?.metrics["disabled"])) vs \(lastS[k]["disabled"])")
                near(fin[k].map { Double($0.bounds.minX) }, lastS[k]["x"].number, "\(k) x")
            }
            if lastS["label"] != .null {
                near(fin["label"].map { Double($0.bounds.minY) }, lastS["label"]["y"].number, "label y")
                near(fin["label"]?.metrics["fontSize"]?.number, lastS["label"]["fontSize"].number, "label font", 0.05)
            }
        }
        if !last { _ = window.makeFirstResponder(nil); pump(0.05) }
        let web = r["events"].array.filter { $0["name"].string != "mdSearch" }, native = nfEvents.filter { $0.name.hasPrefix("md") }
        check(native.count == web.count, "\(name) \(native.count) md events vs \(web.count): native \(native.map { "\($0.name) \($0.detail)" })")
        for (i, (w, n)) in zip(web, native).enumerated() {
            check(w["name"].string == n.name, "\(name) event \(i) \(n.name) vs \(w["name"].string)")
            check(n.detail == w["detail"], "\(name) event \(i) \(n.name) detail \(n.detail) vs \(w["detail"])")
        }
        // Press-and-hold: every tick lands where Chrome's did relative to the first one (400 ms delay, then 60 ms).
        if name.hasPrefix("nf-steppers-pointer") {
            let wt = web.filter { $0["name"].string == "mdInput" }.map { $0["t"].number! }, nt = native.filter { $0.name == "mdInput" }.map { $0.t - t0 }
            for (i, (a, b)) in zip(wt, nt).enumerated() where i > 0 {
                // Each press is timed from its own arrival (a synthesized press reaches the view 0–60 ms after its schedule, varying
                // per press and with load; di, 2026-11-05): a tick of the same press (Chrome's gap under 450 ms: the 400 ms delay,
                // then 60 ms) keeps Chrome's gap to the one before it; the first tick of the next press starts a new timeline.
                let gap = a - wt[i - 1]
                if gap < 450 { check(abs((b - nt[i - 1]) - gap) <= 40, "\(name) tick \(i) \(b - nt[i - 1]) ms after tick \(i - 1) vs \(gap)") }
            }
        }
        _ = window.makeFirstResponder(nil)
    }
    // S71-02 / S71-05: members without an oracle phase. Each case reads the value / label the host reports after the property
    // reached the field (created, or retained: the node is replaced without a new view identity).
    static func memberValue() -> Double? { state.measurements.first { $0.name == "md-number-field" }?.metrics["value"]?.number }
    static func memberMetric(_ part: String, _ key: String) -> AWCValue? { state.measurements.first { $0.name == part }?.metrics[key] }
    static func memberCreate(_ p: [String: AWCValue]) {
        state.node = AWCNode(id: "nf", tag: "md-number-field", properties: p)
        _ = window.makeFirstResponder(nil); state.measurements = []; state.epoch += 1; samples = []; pump(0.4)
    }
    static func memberRetain(_ p: [String: AWCValue]) { state.node = AWCNode(id: "nf", tag: "md-number-field", properties: p); pump(0.25) }
    static func memberSteps(_ ops: [Int]) -> [Double?] {
        ops.map { op in if op > 0 { numberFieldStatesController.stepUp() } else { numberFieldStatesController.stepDown() }; pump(0.1); return memberValue() }
    }
    static func memberTyped(_ p: [String: AWCValue]) -> Double? {
        memberCreate(p); act("member", "focus"); pump(0.1); act("member", "type-out-of-range"); act("member", "Tab-blur-clamps"); pump(0.15)
        return memberValue()
    }
    static func members() {
        let only = ProcessInfo.processInfo.environment["AWC_NF_MEMBERS"].map { Set($0.split(separator: ",").map(String.init)) }
        func on(_ k: String) -> Bool { only?.contains(k) ?? true }
        let base: [String: AWCValue] = ["label": .string("Team"), "value": .number(7), "min": .number(0), "max": .number(10), "variant": .string("outlined")]
        func with(_ extra: [String: AWCValue]) -> [String: AWCValue] { base.merging(extra) { $1 } }
        if on("step") {
            memberCreate(base); memberRetain(with(["step": .number(2)]))
            let got = memberSteps([1, 1, -1]); check(got == [9, 10, 8], "member step: stepUp, stepUp, stepDown after a step update \(got)")
            memberCreate(with(["step": .number(2)])); let c = memberSteps([1, 1, -1]); check(c == [9, 10, 8], "member step: the same steps on a created field \(c)")
        }
        if on("max") { memberCreate(base); memberRetain(with(["max": .number(8)])); let g = memberSteps([1, 1]); check(g == [8, 8], "member max: stepUp after a max update \(g)") }
        if on("min") { memberCreate(with(["value": .number(6)])); memberRetain(with(["value": .number(6), "min": .number(5)])); let g = memberSteps([-1, -1]); check(g == [5, 5], "member min: stepDown after a min update \(g)") }
        if on("snapOnStep") {
            memberCreate(with(["step": .number(2)])); memberRetain(with(["step": .number(2), "snapOnStep": .bool(true)]))
            let g = memberSteps([1, -1]); check(g == [8, 6], "member snapOnStep: stepUp, stepDown after a snapOnStep update \(g)")
            memberCreate(with(["step": .number(2)])); let off = memberSteps([1]); check(off == [9], "member snapOnStep: off steps from the typed base \(off)")
        }
        if on("allowOutOfRange") {
            let wide: [String: AWCValue] = ["value": .number(5), "max": .number(100)]
            let keep = memberTyped(with(wide.merging(["allowOutOfRange": .bool(true)]) { $1 })); check(keep == 250, "member allowOutOfRange: a typed value past max is kept \(String(describing: keep))")
            let clamp = memberTyped(with(wide)); check(clamp == 100, "member allowOutOfRange: off clamps a typed value to max \(String(describing: clamp))")
        }
        if on("labels") {
            memberCreate(with(["incrementLabel": .string("Plus one"), "decrementLabel": .string("Minus one")]))
            check(memberMetric("increment", "label")?.string == "Plus one", "member incrementLabel: \(String(describing: memberMetric("increment", "label")?.string))")
            check(memberMetric("decrement", "label")?.string == "Minus one", "member decrementLabel: \(String(describing: memberMetric("decrement", "label")?.string))")
            memberRetain(with(["incrementLabel": .string("More"), "decrementLabel": .string("Less")]))
            check(memberMetric("increment", "label")?.string == "More" && memberMetric("decrement", "label")?.string == "Less", "member labels follow a retained update")
        }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NFAcceptingHost(rootView: NFStatesFixture(state: state))
        window = NFKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 480, height: 320), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        #if canImport(AppKit)
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        #endif
        pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("numberfield-web-states.json")))
        let only = ProcessInfo.processInfo.environment["AWC_NF_ONLY"]
        for (k, list) in [("runs", false), ("reduced", true)] {
            let runs = oracle[k].array
            for (i, r) in runs.enumerated() where only.map({ r["name"].string.contains($0) }) ?? true {
                #if !canImport(AppKit)
                // iOS has no scroll-wheel input: the wheel scrub run is recorded as an exception (docs/native-parity/md-number-field.md).
                if r["name"].string.contains("wheel") { print("SKIP: \(r["name"].string) — no scroll-wheel input on iOS (recorded exception)"); report.append(["run": r["name"].string, "skipped": "no scroll-wheel input on iOS"]); continue }
                #endif
                for attempt in 1...3 {
                    let c0 = checks, f0 = failures.count, r0 = report.count
                    maxLate = 0; runOne(r, reduced: list, last: i == runs.count - 1)
                    if failures.count == f0 || maxLate <= 12 || attempt == 3 { break }
                    print("  \(r["name"].string): input up to \(Int(maxLate)) ms late, repeating"); checks = c0; failures.removeLast(failures.count - f0); report.removeLast(report.count - r0)
                }
            }
        }
        members()
        if let output = ProcessInfo.processInfo.environment["AWC_NF_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Number field native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
