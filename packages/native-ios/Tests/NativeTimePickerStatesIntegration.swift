import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-time-picker interaction against Chrome 153 (Mac capture of tp-states.html: 18 runs + the same 18 under reduced motion):
// dial drags (12h LTR / RTL / dark, 24h inner and outer ring, minute step with the wrap across 0), taps, the input variant's
// keyboard (digits, arrows, Tab / Shift+Tab, the period radio group, Enter), invalid typing, the mode toggle, dismissal
// (Escape, scrim, Cancel), the focus trap, form bounds (required, an overnight min / max window, reset), show() / hide() with
// a hidden trigger, the landscape dialog and the responsive policy. Each phase replays Chrome's input at its recorded time
// (one-step inputs at Chrome's animation start minus the native latency); checks: the md* event sequence with every detail,
// per-phase end state (value, open, tiles' text / aria-valuenow / colours, period, active number, dial mode, hand target
// and length, the status text, the focused part) and, for every Chrome sample, the presented motion (dialog unfold, scrim,
// mode bloom, hand rotation, period colours) within one frame of the sample's time.
@Observable final class TimePickerStatesState {
    var node = AWCNode(id: "tp", tag: "md-time-picker")
    var epoch = 0
    var rtl = false
    var dark = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double)] = []
    let pointer = AWCNativePointerState()
}
struct TimePickerStatesFixture: View {
    let state: TimePickerStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope { ZStack(alignment: .topLeading) {
            AWCNativeView(node: state.node) { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000)); NativeTimePickerStatesIntegration.echo(e) }
                .frame(width: 240, alignment: .leading).fixedSize()
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 24).padding(.top, 24)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }
        .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        .awcReducedMotion(state.reduced)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "tp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
/// A key-capable borderless window: AppKit delivers a press to an NSView (the trigger's text field) only in the key window.
/// It also reports itself key while another process holds activation (a simulator or a parallel suite under machine load):
/// NSWindow.sendEvent would otherwise treat each synthesized press as an activating first click and drop it (fi-731: the
/// scrim press, dial taps and drags after the runner lost activation mid-suite).
final class TPKeyWindow: NSWindow {
    override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true }
    #if !canImport(UIKit)
    override var isKeyWindow: Bool { true }
    #endif
}
/// fi-736: reporting the window key was not enough. While another process holds activation, NSWindow.sendEvent treats a
/// press in an inactive application as an activating first click and passes it to the hit view only if that view accepts
/// first mouse; SwiftUI's hosting view does not, so dial taps, drags and scrim presses were dropped (793 of 16992 checks
/// with a simulator booting in parallel). The test host accepts first mouse; presses made while the application was
/// inactive are counted and printed with the result, so the condition stays visible.
#if canImport(UIKit)
typealias TPHostingView = NSHostingView<TimePickerStatesFixture>
#else
final class TPHostingView: NSHostingView<TimePickerStatesFixture> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { ProcessInfo.processInfo.environment["AWC_TP_FIRST_MOUSE"] != "0" }
}
#endif
@main @MainActor enum NativeTimePickerStatesIntegration {
    static let state = TimePickerStatesState()
    static var host: NSHostingView<TimePickerStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func dgSuffix() -> String {
        #if !canImport(AppKit)
        return AWCDG.suffix()
        #else
        return ""
        #endif
    }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name + dgSuffix()); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func pump(_ duration: Double = 0.004) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouseEvent(_ type: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        return NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!
    }
    static var inactivePresses = 0, presses = 0
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        if type == .leftMouseDown {
            modalSession()?.lastInputPointer = true; presses += 1
            // Diagnostic (AWC_TP_DEACTIVATE=1): give up activation before each press, the condition seen under machine load.
            #if !canImport(UIKit)
            if env["AWC_TP_DEACTIVATE"] == "1" { NSApp.deactivate() }
            if !NSApp.isActive { inactivePresses += 1 }
            #endif
        }
        #if canImport(UIKit)
        if [.leftMouseDown, .leftMouseDragged, .leftMouseUp].contains(type) { queuedAt.append(now()) }
        #endif
        window.sendEvent(mouseEvent(type, p))
    }
    /// iOS: the queue time of every synthesized touch phase and key press, paired in order with the harness's delivery stamps
    /// (`AWCShimTouch.deliveredAt`): a synthesized input reaches the app when UIKit delivers it, one touch phase per frame.
    static var queuedAt: [Double] = []
    /// Per run: (queue time relative to t0, delivery delay) of each phase's first and last input (the press / key-down and the
    /// release / key-up: the harness coalesces drag moves, one touch phase per frame, so inputs and stamps are not one to one);
    /// a Chrome sample is compared with the native frames at its time plus the delay of the latest of those queued by then (the
    /// check is timed from the delivered input, not the queue).
    static var deliveryShift: [(Double, Double)] = []
    static func shift(_ st: Double) -> Double { deliveryShift.last(where: { $0.0 <= st + 1 })?.1 ?? 0 }
    /// The modal scope's AppKit host (its local event monitor routes Escape and Tab to the top modal owner).
    static func modalSession() -> AWCModalSession? {
        func find(_ v: NSView) -> AWCModalHostView? { if let h = v as? AWCModalHostView { return h }; for s in v.subviews { if let h = find(s) { return h } }; return nil }
        return find(host)?.session
    }
    static func key(_ code: UInt16, _ chars: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            // NSApplication.sendEvent hands a key press to the local monitors first (AWCModalHostView: Escape and Tab go to
            // the top modal owner); window.sendEvent skips the monitors, so that step is applied here, then the window.
            if type == .keyDown, let session = modalSession() {
                session.lastInputPointer = false
                if session.isActive && (code == 53 && session.escape() || code == 48 && session.tab(backward: flags.contains(.shift))) { continue }
            }
            let event = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
            #if canImport(UIKit)
            queuedAt.append(now()); window.sendEvent(event)
            #else
            // As a hardware key arrives: the application's current event while the window handles it (md-text-field reads
            // NSApp.currentEvent to report the vertical arrows of a number field, `navigationKeys`).
            NSApp.postEvent(event, atStart: true)
            window.sendEvent(NSApp.nextEvent(matching: [.keyDown, .keyUp], until: .distantPast, inMode: .default, dequeue: true) ?? event)
            #endif
        }
    }
    static let keys: [String: (UInt16, String)] = ["ArrowLeft": (123, "\u{F702}"), "ArrowRight": (124, "\u{F703}"), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"),
        "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Enter": (36, "\r"), "Space": (49, " "), "Escape": (53, "\u{1B}"), "Tab": (48, "\t")]
    static func press(_ name: String, shift: Bool = false) { let k = keys[name]!; key(k.0, k.1, shift ? .shift : []) }
    /// ANSI key codes per digit (the iOS harness sends the key the code names).
    static let digitCodes: [Character: UInt16] = ["0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25]
    static func typeChar(_ ch: Character) { key(digitCodes[ch] ?? 18, String(ch)) }
    static var runtime: AWCTimePickerRuntime? { AWCTimePickerRuntime.mounted["tp"]?.runtime }
    static func m(_ name: String) -> CGRect? { state.measurements.first { $0.name == name }?.bounds }
    static func center(_ name: String) -> CGPoint { let r = m(name) ?? .zero; return CGPoint(x: r.midX, y: r.midY) }
    /// The point on the dial at clock angle `deg` (0 = 12 o'clock, clockwise) and radius fraction `f`, in 1/16 px steps (Chrome).
    static func dialPoint(_ deg: Double, _ f: Double) -> CGPoint {
        let d = m("dial") ?? .zero, rad = deg * .pi / 180, rr = d.width / 2 * f
        func q(_ v: Double) -> Double { ((v * 16) + 0.5).rounded(.down) / 16 }
        return CGPoint(x: q(d.midX + rr * sin(rad)), y: q(d.midY - rr * cos(rad)))
    }
    static func down(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
    static func move(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.leftMouseDragged, p) }
    static func up(_ p: CGPoint) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    /// A click. AppKit text fields track a press in a nested event loop until the release arrives: the release is queued first.
    static func click(_ p: CGPoint) {
        state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p)
        NSApp.postEvent(mouseEvent(.leftMouseUp, p), atStart: false)
        mouse(.leftMouseDown, p)
        state.pointer.update(phase: .up, location: p)
    }
    /// The page binds `open` to the element's property, which the component itself changes: the host follows mdOpen / mdClose.
    static func echo(_ e: AWCEvent) {
        if env["AWC_TP_DEBUG"] != nil { print("  event \(e.name) \(e.detail["value"]) @\(Int(now() - debugT0))"); fflush(stdout) }
        if e.name == "mdOpen" { setProp("open", true) } else if e.name == "mdClose" { setProp("open", false) }
        // The component writes `value` on commit (mirrored so a later host change does not replay a stale value).
        if e.name == "mdChange" { setProp("value", .string(e.detail["value"].string)) }
    }
    static var debugT0 = 0.0
    static func setProp(_ k: String, _ v: AWCValue) { var n = state.node; n.properties[k] = v; state.node = n }
    /// The native focused part, named as Chrome's deep active element below the host (`md-time-picker > …`).
    static func focusedPart() -> String {
        if let rt = runtime, let f = rt.focused, f.hasPrefix("input-") || f.hasPrefix("period-") { return "md-time-picker > " + f }
        if let fv = window.firstResponder as? AWCNativeButtonFocusView, let id = fv.configuration?.id {
            switch id { case "tp-toggle-mode": return "md-time-picker > toggle-mode"; case "tp-cancel": return "md-time-picker > cancel-button"
            case "tp-confirm": return "md-time-picker > confirm-button"; default: return "other " + id }
        }
        // The trigger is the read-only md-text-field: its field editor is the first responder.
        #if canImport(UIKit)
        if window.firstResponder is AWCFieldUITextField, runtime?.focused == nil { return "md-time-picker > trigger > input" }
        #else
        if let editor = window.firstResponder as? NSTextView, editor.isFieldEditor, runtime?.focused == nil { return "md-time-picker > trigger > input" }
        #endif
        if let rt = runtime, let f = rt.focused { return "md-time-picker > " + f }
        return "body"
    }
    /// Actions by phase label (tp-states.html).
    static func actions(_ r: AWCValue) -> [String: (_ start: Double, _ end: Double) -> Void] {
        var a: [String: (_ start: Double, _ end: Double) -> Void] = [:]
        func timed(_ body: @escaping () -> Void) -> (Double, Double) -> Void { { _, _ in body() } }
        // The trigger part is the md-text-field child (its root reports under the field's own name).
        a["open"] = timed { click(center("md-text-field")) }
        a["show"] = timed { runtime?.show() }; a["reopen"] = a["show"]
        a["hide"] = timed { runtime?.hide() }
        a["am"] = timed { click(center("period-am")) }
        a["ok"] = timed { click(center("confirm-button")) }
        a["cancel"] = timed { click(center("cancel-button")) }
        a["to-input"] = timed { click(center("toggle-mode")) }; a["to-dial"] = a["to-input"]
        a["select-minutes"] = timed { click(center("input-minute")) }
        a["scrim"] = timed { let p = CGPoint(x: 1150, y: 850); down(p); up(p) }
        a["submit-empty"] = timed {}
        a["reset"] = timed { setProp("value", "") }
        a["Control+a"] = timed { if let f = runtime?.focused, f.hasPrefix("input-") { runtime?.input(f).selectAll() } }
        for k in ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", "Escape", "Tab"] { a[k] = timed { press(k) } }
        a["Shift+Tab"] = timed { press("Tab", shift: true) }
        // Drags: down at the start angle, `n` moves spread over Chrome's drag, release when Chrome's did.
        func drag(_ a0: Double, _ a1: Double, _ f: Double, _ n: Int) -> (Double, Double) -> Void {
            { start, end in
                // S932-DRAGPLAN: the moves that change the value fire when Chrome's value changed (its mdInput events in the phase),
                // as a tap presses when Chrome's pointerdown landed; the moves between are spread evenly. A move that sits exactly on
                // a rounding boundary (k + 0.5 steps) is moved 0.4 deg on in the drag direction, so the sub-point position of the
                // synthesized touch does not decide whether it changes the value. Without a one-to-one match the moves stay even.
                let hourMode = runtime?.selecting == .hour
                let stepDeg = hourMode ? 30.0 : 6.0, mod = hourMode ? 12 : 60, dir: Double = a1 >= a0 ? 1 : -1
                func norm(_ a: Double) -> Double { (a.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) }
                func value(_ a: Double) -> Int { Int(AWCTimeMath.jsRound(norm(a) / stepDeg)) % mod }
                var angles = (0...n).map { a0 + (a1 - a0) * Double($0) / Double(n) }
                var times = (0...n).map { start + (end - start) * Double($0) / Double(n + 1) }
                let nudged = angles.map { a -> Double in let x = norm(a) / stepDeg; return abs(x - x.rounded(.down) - 0.5) * stepDeg < 0.3 ? a + 0.4 * dir : a }
                let crossings = (1...n).filter { value(nudged[$0]) != value(nudged[$0 - 1]) }
                let chrome = r["events"].array.filter { $0["name"].string == "mdInput" }.compactMap { $0["t"].number }.filter { $0 > start + 10 && $0 <= end + 1 }.sorted()
                var planned = false
                if !crossings.isEmpty, crossings.count == chrome.count {
                    var anchors: [(Int, Double)] = [(0, start)]
                    for (k, c) in crossings.enumerated() { anchors.append((c, chrome[k] - 2)) }
                    if crossings.last != n { anchors.append((n, times[n])) }
                    if zip(anchors, anchors.dropFirst()).allSatisfy({ $0.1 < $1.1 && $0.0 < $1.0 }), let last = anchors.last, last.1 < end {
                        for (p, q) in zip(anchors, anchors.dropFirst()) {
                            for i in p.0...q.0 { times[i] = p.1 + (q.1 - p.1) * Double(i - p.0) / Double(q.0 - p.0) }
                        }
                        angles = nudged; planned = true
                    }
                }
                if env["AWC_TP_DEBUG"] != nil { print("  DRAGPLAN \(planned) crossings \(crossings) chrome \(chrome.map { Int($0) }) times \(times.map { Int($0) })"); fflush(stdout) }
                down(dialPoint(angles[0], f)); pump()
                for i in 1...n {
                    while now() - t0 < times[i] { pump() }
                    move(dialPoint(angles[i], f)); pump()
                }
                while now() - t0 < end { pump() }
                up(dialPoint(a1, f))
            }
        }
        // Taps: press when Chrome's pointerdown landed (its first md* event), release when its pointerup's state change did.
        func tap(_ deg: Double, _ f: Double = 0.8) -> (Double, Double) -> Void {
            { _, end in let p = dialPoint(deg, f); down(p); pump(); while now() - t0 < end { pump() }; up(p) }
        }
        a["drag-hour-2-to-4"] = drag(60, 120, 0.8, 12); a["drag-minute-30-to-45"] = drag(180, 270, 0.8, 16)
        a["drag-inner-14-to-17"] = drag(60, 150, 0.52, 12); a["tap-outer-9"] = tap(270); a["tap-minute-20"] = tap(120)
        a["drag-50-across-0-to-10"] = drag(300, 420, 0.8, 18); a["drag-back-to-55"] = drag(60, -30, 0.8, 12)
        a["tap-hour-7"] = tap(210); a["tap-minute-5"] = tap(30); a["tap-hour-5"] = tap(150); a["drag-hour"] = drag(60, 150, 0.8, 12)
        return a
    }
    static var t0 = 0.0
    static let stateLatency = Double(env["AWC_TP_STATE_LATENCY"] ?? "") ?? 17, openLatency = Double(env["AWC_TP_OPEN_LATENCY"] ?? "") ?? 5
    static let pointerLead = Double(env["AWC_TP_POINTER_LEAD"] ?? "") ?? 0, keyLead = Double(env["AWC_TP_KEY_LEAD"] ?? "") ?? 0
    static var anchored: [(String, String, Double, Double)] = []
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = r["name"].string, label = (reduced ? "reduced/" : "") + name
        state.rtl = r["dir"].string == "rtl"; state.dark = r["theme"].string == "dark"; state.reduced = reduced
        let vp = r["viewport"].array.map { $0.number ?? 0 }
        let size = NSSize(width: vp.count == 2 ? vp[0] : 1200, height: vp.count == 2 ? vp[1] : 900)
        if window.contentView?.frame.size != size { window.setContentSize(size); host.frame = NSRect(origin: .zero, size: size) }
        var props: [String: AWCValue] = [:]; if case .object(let o) = r["props"] { props = o }
        state.node = AWCNode(id: "tp", tag: "md-time-picker", properties: props)
        state.pointer.update(phase: .leave); state.events = []; state.measurements = []; state.epoch += 1; pump(0.4)
        let phases = r["phases"].array, acts = actions(r)
        t0 = now() + 50; debugT0 = t0
        #if !canImport(AppKit)
        AWCDG.start()
        #endif
        deliveryShift = []
        #if canImport(UIKit)
        var qMark = queuedAt.count, dMark = AWCShimTouch.deliveredAt.count
        func pairDeliveries(_ fired: Double, _ lbl: String) {
            let q = Array(queuedAt[qMark...]), d = Array(AWCShimTouch.deliveredAt[dMark...])
            qMark = queuedAt.count; dMark = AWCShimTouch.deliveredAt.count
            guard env["AWC_TP_STEP_ANCHOR"] != "queue" else { return }
            // A phase without a delivered input (a Tab / Escape the modal scope takes at once) is timed from its step.
            guard let q0 = q.first, let d0 = d.first else { deliveryShift.append((fired, 0)); return }
            // 6-2: a mode-toggle click: the release (posted, not in queuedAt) fires the action; time it from its delivery.
            if env["AWC_TP_RELEASE_CLOCK"] != "0", lbl == "to-input" || lbl == "to-dial", q.count == 1, d.count > 1, let dl = d.last, dl - q0 >= 0, dl - q0 < 150 {
                if env["AWC_TP_DEBUG"] == "1" { print(String(format: "  releaseclock %@ press %.1f release %.1f (+%.1f)", lbl, d0 - t0, dl - t0, dl - q0)) }
                deliveryShift.append((q0 - t0, dl - q0)); return }
            var pairs = [(q0, d0)]; if q.count > 1, d.count > 1, let q1 = q.last, let d1 = d.last { pairs.append((q1, d1)) }
            for (qq, dd) in pairs where dd - qq >= 0 && dd - qq < 150 { deliveryShift.append((qq - t0, dd - qq)) }
        }
        #endif
        let anims = r["anims"].array.map { (kind: $0["kind"].string, start: $0["start"].number ?? 0) }
        func latency(_ kind: String) -> Double { ["scrim", "dialog", "mode"].contains(kind) ? openLatency : stateLatency }
        let multi = ["drag", "type-"]
        // The input plan: a one-step input fires at Chrome's animation start minus the native latency (else at Chrome's first
        // md* event of the phase, else at the phase start); a drag runs from the phase start to its release, timed by the
        // first animation after it (the hand / mode hand-over) or Chrome's last event of the phase.
        func plan(_ i: Int) -> (start: Double, end: Double, anchor: (kind: String, start: Double)?) {
            let ph = phases[i], lbl = ph["label"].string, t = ph["t"].number!
            let nextT = i + 1 < phases.count ? phases[i + 1]["t"].number! : t + 900
            let inPhase = anims.filter { $0.start >= t - (i == 0 ? 1 : 0) && $0.start < nextT }
            let evs = r["events"].array.filter { ($0["t"].number ?? -1) >= t && ($0["t"].number ?? 0) < nextT }.compactMap { $0["t"].number }
            if multi.contains(where: { lbl.hasPrefix($0) }) {
                let end = inPhase.last.map { $0.start - latency($0.kind) } ?? (evs.last.map { $0 + 2 } ?? t + 300)
                return (t, max(t + 50, end), inPhase.last)
            }
            // A tap: Chrome's pointerdown restyles the dial in the next frame (its first animation of the phase) and its
            // pointerup hands over to the minutes (the hand's last transition). The hand moves in the native input's own
            // frame, so the press and the release land just before those frames.
            if lbl.hasPrefix("tap-") {
                let downAt = inPhase.first?.start ?? evs.first ?? t, handAt = inPhase.last(where: { $0.kind == "hand" })?.start
                let down = max(t, downAt - 2), up = max(down + 17, (handAt ?? down + 35) - 2)
                return (down, up, inPhase.last)
            }
            if let last = inPhase.last { return (last.start - latency(last.kind), 0, last) }
            if let first = evs.first { return (max(t, first - 2), 0, nil) }
            return (t, 0, nil)
        }
        // iOS: SwiftUI buttons and tap gestures see a synthesized touch ~2 frames later than AppKit sees a mouse event (the
        // trigger field's UIKit tap and the dial's drag gesture do not), keys ~1 frame later; those inputs fire that much
        // earlier (env, default 0).
        let pointerLabels = ["am", "ok", "cancel", "to-input", "to-dial", "select-minutes", "scrim"]
        let keyLabels = Set(keys.keys).union(["Shift+Tab"])
        let plans = phases.indices.map { i -> (start: Double, end: Double, anchor: (kind: String, start: Double)?) in
            let p = plan(i), lbl = phases[i]["label"].string
            let lead = pointerLabels.contains(lbl) || lbl.hasPrefix("tap-") ? pointerLead : keyLabels.contains(lbl) || lbl.hasPrefix("type-") ? keyLead : 0
            return (p.start - lead, p.end > 0 ? p.end - lead : 0, p.anchor)
        }
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string, p = plans[i]
            while now() - t0 < p.start { pump() }
            let fired = now() - t0
            if lbl.hasPrefix("type-") {
                // One character per frame (Chrome: input events 33 ms apart).
                for (k, ch) in String(lbl.dropFirst(5)).enumerated() { while now() - t0 < p.start + Double(k) * 33.3 { pump() }; typeChar(ch); pump() }
            } else if let act = acts[lbl] { act(p.start, p.end) } else { check(false, "\(label) no native action for \(lbl)") }
            if let anchor = p.anchor { anchored.append((label + "/" + lbl, anchor.kind, anchor.start, fired)) }
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! : p.start + 900
            let nextInput = i + 1 < phases.count ? plans[i + 1].start - 2 : next
            while now() - t0 < min(next - 20, nextInput) { pump() }
            #if canImport(UIKit)
            pairDeliveries(fired, lbl)
            #endif
            #if !canImport(AppKit)
            AWCDG.input(planned: t0 + p.start)
            #endif
            checkPhase(label + "/" + lbl, ph)
        }
        pump(0.2)
        #if canImport(UIKit)
        if env["AWC_TP_DEBUG"] == "1", !deliveryShift.isEmpty { print("  delivery \(label): " + deliveryShift.map { String(format: "%.0f+%.0f", $0.0, $0.1) }.joined(separator: " ")) }
        #endif
        for a in anchored where a.0.hasPrefix(label + "/") {
            let keys = (runtime?.motion.keys).map(Array.init)?.filter { a.1 == "hand" ? $0 == "hand" : a.1 == "number" ? $0.hasPrefix("number") : a.1 == "period" ? $0.hasPrefix("period") : ["scrim", "dialog"].contains(a.1) ? $0 == a.1 : a.1 == "mode" ? $0.hasPrefix("mode") : false } ?? []
            var starts: [Double] = []
            for k in keys { let l = runtime?.motion[k] ?? []; let at = t0 + a.3
                if let before = l.last(where: { $0.t <= at }), let ch = l.first(where: { $0.t > at && $0.v != before.v }) { starts.append(ch.t - t0) }
                else if l.last(where: { $0.t <= at }) == nil, let ch = l.first(where: { $0.t > at }) { starts.append(ch.t - t0) } }
            if let s0 = starts.min() { print("  anchor \(a.0) \(a.1) chrome \(Int(a.2)) fired \(Int(a.3)) native \(Int(s0)) (\(Int(s0 - a.2)) ms)") }
        }
        anchored.removeAll()
        // md* events: names and every detail (the clock is pinned as on the oracle page).
        func text(_ name: String, _ d: AWCValue) -> String {
            if case .object(let o) = d { return name + "(" + o.keys.sorted().map { k in k + "=" + (o[k].map { v -> String in if case .object(let f) = v { return "{" + f.keys.sorted().filter { f[$0]?.bool == true }.joined(separator: ",") + "}" }; return v.number.map { String(Int($0)) } ?? v.bool.map { String($0) } ?? v.string } ?? "") }.joined(separator: ",") + ")" }
            return name
        }
        let own: Set<String> = ["mdOpen", "mdClose", "mdCancel", "mdChange", "mdInput", "mdModeChange", "mdValidityChange"]
        let web = r["events"].array.filter { own.contains($0["name"].string) }.map { text($0["name"].string, $0["detail"]) }
        let native = state.events.filter { own.contains($0.0) }.map { text($0.0, $0.1) }
        let d0 = native.indices.first { $0 >= web.count || native[$0] != web[$0] } ?? (native.count < web.count ? native.count : -1)
        check(native == web, "\(label) events differ at \(d0): native \(Array(native.dropFirst(max(0, d0 - 1)).prefix(3))) vs web \(Array(web.dropFirst(max(0, d0 - 1)).prefix(3))) (\(native.count) vs \(web.count))")
        report.append(["run": label, "events": native.count, "webEvents": web.count])
        if runtime?.isOpen == true { runtime?.hide(); pump(0.1) }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.1)
    }
    static func checkPhase(_ label: String, _ ph: AWCValue) {
        let rt = runtime
        guard let last = ph["samples"].array.last else { return }
        check(currentValue() == last["value"].string, "\(label) value \(currentValue()) vs \(last["value"].string)")
        check((rt?.isOpen ?? false) == (last["open"].bool ?? false), "\(label) open \(rt?.isOpen ?? false) vs \(last["open"])")
        let nf = focusedPart(), wf = last["active"].string
        check(nf == wf, "\(label) focus \(nf) vs \(wf)")
        if let rt, rt.isOpen {
            let dialM = state.measurements.first { $0.name == "dial" }
            for (key, id) in [("hour", "input-hour"), ("minute", "input-minute")] {
                guard case .object(let o) = last[key] else { continue }
                let n = state.measurements.first { $0.name == id }
                check(n?.metrics["value"]?.string == o["value"]?.string, "\(label) \(key) text \(n?.metrics["value"]?.string ?? "-") vs \(o["value"]?.string ?? "-")")
                let invalid = n?.metrics["invalid"]?.bool ?? false
                check(invalid == (o["valuenow"] == nil || o["valuenow"] == .null), "\(label) \(key) invalid \(invalid) vs valuenow \(o["valuenow"] ?? .null)")
                // The selected unit (the source's `selecting`, announced by its status region) is the active tile.
                if last["status"] != .null {
                    let active = n?.metrics["active"]?.bool ?? false, webActive = last["status"].string == (key == "hour" ? "Hour" : "Minute")
                    check(active == webActive, "\(label) \(key) active \(active) vs status \(last["status"].string)")
                }
            }
            if case .object(let o) = last["period"] {
                let am = state.measurements.first { $0.name == "period-am" }?.metrics["checked"]?.bool ?? false
                check(am == (o["am"]?.string == "true"), "\(label) period AM \(am) vs \(o["am"]?.string ?? "-")")
            }
            if last["dialMode"] != .null {
                let mode = dialM?.metrics["mode"]?.string ?? "-", web = last["dialMode"].string.contains("--minute") ? "minute" : "hour"
                check(mode == web, "\(label) dial mode \(mode) vs \(web)")
                if case .object(let h) = last["hand"] {
                    let target = Double((h["inline"]?.string ?? "").replacingOccurrences(of: "rotate(", with: "").replacingOccurrences(of: "deg)", with: "")) ?? .nan
                    let native = dialM?.metrics["hand"]?.number ?? .nan
                    check(abs(native - target) < 0.01, "\(label) hand target \(native) vs \(target)")
                    let length = (Double((h["length"]?.string ?? "").replacingOccurrences(of: "%", with: "")) ?? .nan) / 100
                    check(abs((dialM?.metrics["length"]?.number ?? .nan) - length) < 0.001, "\(label) hand length \(dialM?.metrics["length"]?.number ?? .nan) vs \(length)")
                }
                let activeNumber = state.measurements.first { $0.name == "dial-number" && $0.metrics["active"]?.bool == true }?.metrics["text"]?.string
                check(activeNumber == (last["activeNumber"] == .null ? nil : last["activeNumber"].string), "\(label) active number \(activeNumber ?? "-") vs \(last["activeNumber"])")
            }
            if last["status"] != .null {
                let status = state.measurements.first { $0.name == "dialog" }?.metrics["status"]?.string
                check(status == last["status"].string, "\(label) status \(status ?? "-") vs \(last["status"].string)")
            }
        }
        // Motion: every Chrome sample against the native presented values within one frame.
        for smp in ph["samples"].array {
            guard let st = smp["t"].number else { continue }
            let at = t0 + st + shift(st)
            func mx(_ o: AWCValue) -> [Double]? {
                guard case .object(let v) = o, let op = Double(v["opacity"]?.string ?? "") else { return nil }
                let m = matrix(v["transform"]?.string ?? "none"); return [op, m[0], m[5]]
            }
            if let v = mx(smp["dialog"]) { motion("dialog", at, v, [0.03, 0.006, 0.35], "\(label) t=\(Int(st))") }
            if case .object(let o) = smp["scrim"], let op = Double(o["opacity"]?.string ?? "") { motion("scrim", at, [op, 0, 0], [0.03, 99, 99], "\(label) t=\(Int(st))", component: 0) }
            // While the modes swap, Chrome's two selectors resolve to the one blooming wrapper (equal samples): it is the incoming
            // mode's area natively (the outgoing one is removed, as its content is in the source).
            if let v = mx(smp["dialWrap"]), let w = mx(smp["inputArea"]), v == w,
               let mode = state.measurements.first(where: { $0.name == "md-time-picker" })?.metrics["mode"]?.string {
                motion("mode-" + mode, at, v, [0.03, 0.006, 0.35], "\(label) t=\(Int(st))")
            } else {
                if let v = mx(smp["dialWrap"]) { motion("mode-dial", at, v, [0.03, 0.006, 0.35], "\(label) t=\(Int(st))") }
                if let v = mx(smp["inputArea"]) { motion("mode-input", at, v, [0.03, 0.006, 0.35], "\(label) t=\(Int(st))") }
            }
            if case .object(let h) = smp["hand"], let a = h["angle"]?.number {
                let phT = ph["t"].number ?? 0
                let handShift = label.contains("/tap-") ? (deliveryShift.first(where: { $0.0 >= phT - 40 && $0.0 <= st + 1 })?.1 ?? shift(st)) : shift(st)
                motion("hand", t0 + st + handShift, [a], [0.8], "\(label) t=\(Int(st))", angle: true)
            }
            if case .object(let p) = smp["period"] {
                for (k, key) in [("amBg", "period-am"), ("pmBg", "period-pm")] {
                    guard let css = p[k]?.string else { continue }
                    let c = rgba(css); motion(key, at, [c[0] / 255 * c[3], c[1] / 255 * c[3], c[2] / 255 * c[3], c[3]], [0.012, 0.012, 0.012, 0.012], "\(label) t=\(Int(st))", prefix: 4)
                }
            }
        }
    }
    static func currentValue() -> String { runtime?.committedValue ?? "-" }
    static func matrix(_ t: String) -> [Double] {
        guard t.hasPrefix("matrix(") else { return [1, 0, 0, 1, 0, 0] }
        let v = t.dropFirst(7).dropLast().split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        return v.count == 6 ? v : [1, 0, 0, 1, 0, 0]
    }
    /// A computed colour as [r, g, b (0–255), alpha]: rgb()/rgba(), and the interpolated forms Chrome reports mid-transition,
    /// `oklab(L a b / A)` and `color(srgb r g b / A)`.
    static func rgba(_ css: String) -> [Double] {
        let body = css.drop { $0 != "(" }.dropFirst().dropLast()
        let v = body.replacingOccurrences(of: "/", with: " ").replacingOccurrences(of: ",", with: " ").split(separator: " ").compactMap { Double($0) }
        if css.hasPrefix("oklab(") && v.count >= 3 {
            let a = v.count > 3 ? v[3] : 1
            let p = AWCTimePickerOKLab.toSRGB([v[0] * a, v[1] * a, v[2] * a, a])
            return a > 0 ? [p[0] / a * 255, p[1] / a * 255, p[2] / a * 255, a] : [0, 0, 0, 0]
        }
        if css.hasPrefix("color(srgb") {
            let n = Array(v); return n.count >= 3 ? [n[0] * 255, n[1] * 255, n[2] * 255, n.count > 3 ? n[3] : 1] : [0, 0, 0, 0]
        }
        return v.count >= 3 ? [v[0], v[1], v[2], v.count > 3 ? v[3] : 1] : [0, 0, 0, 0]
    }
    /// The native presented values at `at` (ms): every value recorded within one frame of it plus the value in force before;
    /// the Chrome value must lie within their range (± tolerance). Natively the dialog / mode records are [progress-derived
    /// opacity, scale, translateY]; angles compare modulo 360; colours compare the first `prefix` components.
    static func motion(_ key: String, _ at: Double, _ web: [Double], _ tol: [Double], _ label: String, component: Int? = nil, angle: Bool = false, prefix: Int? = nil) {
        guard let list = runtime?.motion[key], !list.isEmpty else { check(false, "\(label) \(key) never presented natively"); return }
        let window = 20.0
        var candidates = list.filter { abs($0.t - at) <= window }.map(\.v)
        if let before = list.last(where: { $0.t < at - window }) { candidates.append(before.v) }
        if candidates.isEmpty { candidates = [list.first!.v] }
        let n = prefix ?? (component.map { $0 + 1 } ?? web.count)
        let idx = component.map { [$0] } ?? Array(0..<min(n, web.count))
        func norm(_ v: Double) -> Double { angle ? ((v.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360) : v }
        let ok = idx.allSatisfy { i in
            let vals = candidates.compactMap { $0.count > i ? norm($0[i]) : nil }
            guard let lo = vals.min(), let hi = vals.max() else { return false }
            let w = norm(web[i])
            return w >= lo - tol[i] && w <= hi + tol[i]
        }
        check(ok, "\(label) \(key) web \(web.map { (($0 * 1000).rounded() / 1000) }) vs native \(candidates.map { $0.map { (($0 * 1000).rounded() / 1000) } })")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        // The oracle page pins `new Date()` to Thursday 2025-06-12 10:30 local time (fixed-clock.js).
        var c = DateComponents(); c.year = 2025; c.month = 6; c.day = 12; c.hour = 10; c.minute = 30
        let pinned = Calendar.current.date(from: c)!
        AWCTimeMath.clock = { pinned }
        host = TPHostingView(rootView: TimePickerStatesFixture(state: state)); window = TPKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = env["AWC_TP_STATES_ONLY"]
        // Warm-up, not checked: the simulator's first presentation of the dialog stalls ~130 ms (first-use rendering setup);
        // Chrome's oracle page was warm.
        state.node = AWCNode(id: "tp", tag: "md-time-picker", properties: ["value": .string("14:30")]); state.epoch += 1; pump(0.3)
        runtime?.show(); pump(0.8); runtime?.hide(); pump(0.5); state.events = []
        #if canImport(UIKit)
        // S932-WARMUP, not checked, always run: the first focus of a text input in a process (here the trigger field, which the open phase presses)
        // takes about 0.4 s on the simulator (UIKit keyboard task queue + becomeFirstResponder, KNOWN-CAUSES row 40); Chrome's oracle page was warm.
        // It pays that once-per-process system cost before the first checked case. It touches no later case: the dialog is hidden, the pointer and focus reset.
        do { let w0 = now(); click(center("md-text-field")); pump(0.9); runtime?.hide(); pump(0.5); state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.3); state.events = []
            if env["AWC_TP_TRACE"] != nil { print(String(format: "WARMUP first-focus done in %.0f ms", now() - w0)) } }
        #endif
        for (file, reduced) in [("timepicker-web-states", false), ("timepicker-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = env["AWC_TP_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("pointer presses \(presses), made while the application was inactive \(inactivePresses)")
        print("Time picker native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
