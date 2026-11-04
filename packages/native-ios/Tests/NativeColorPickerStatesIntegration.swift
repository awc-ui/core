import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-color-picker interaction against Chrome 153 (Mac capture of cp-states.html: 23 runs + the same 23 under reduced motion):
// plate / hue / alpha drags with clamping and release outside (LTR, RTL), keyboard steps and endpoints, Tab order, hex and
// channel typing with commit on Enter / Tab, presets (hover, press, click, re-click, keyboard), the popover lifecycle
// (trigger, Escape, Enter / Space, outside press, show(), open, close()), disabled, controlled value / format / alpha.
// Each phase replays Chrome's input at its recorded time; checks: the md* event sequence and values, per-phase end state
// (value, hex, invalid flag, channels, selected presets, open, focused part, preview colour, plate / hue / alpha thumb
// centres) and, for every Chrome sample, the presented motion (popover pop-in opacity / scale / translateY, preset
// scale / rotation springs, thumb press scale) within one frame of the sample's time.
@Observable final class ColorPickerStatesState {
    var node = AWCNode(id: "cp", tag: "md-color-picker")
    var epoch = 0
    var rtl = false
    var width = 340.0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double)] = []
    let pointer = AWCNativePointerState()
}
struct ColorPickerStatesFixture: View {
    let state: ColorPickerStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        // The modal scope hosts the md-dialog of cp-popover-in-dialog (without one md-dialog falls back to a platform sheet).
        AWCModalScope { ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop by rows (overlapping vertical extents share a row, then leading to trailing):
            // "before" sits at the top-left so it precedes the picker's first stop as in the page's DOM order.
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")]))
            // Past the picker's last stop Chrome leaves the page (focus on body): this stop reports "body".
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 10, y: 880)
            AWCNativeView(node: state.node) { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000)); NativeColorPickerStatesIntegration.echo(e) }
                .frame(width: state.width, alignment: .leading)
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 24).padding(.top, 24)
        } }
        .awcReducedMotion(state.reduced)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "cp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeColorPickerStatesIntegration {
    static let state = ColorPickerStatesState()
    static var host: NSHostingView<ColorPickerStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func pump(_ duration: Double = 0.004) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouseEvent(_ type: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        return NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!
    }
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        if type == .leftMouseDown { modalSession()?.lastInputPointer = true }
        window.sendEvent(mouseEvent(type, p))
    }
    /// The modal scope's AppKit host (its local event monitor routes Escape and Tab to the top modal owner).
    static func modalSession() -> AWCModalSession? {
        func find(_ v: NSView) -> AWCModalHostView? { if let h = v as? AWCModalHostView { return h }; for s in v.subviews { if let h = find(s) { return h } }; return nil }
        return find(host)?.session
    }
    static func key(_ code: UInt16, _ chars: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            // NSApplication.sendEvent hands a key press to the local monitors first (AWCModalHostView: Escape and Tab go to
            // the top modal owner); the borderless test window is never key, so that step is applied here, then the window.
            if type == .keyDown, let session = modalSession() {
                session.lastInputPointer = false
                if session.isActive && (code == 53 && session.escape() || code == 48 && session.tab(backward: flags.contains(.shift))) { continue }
            }
            window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!)
        }
    }
    static let keys: [String: (UInt16, String)] = ["ArrowLeft": (123, "\u{F702}"), "ArrowRight": (124, "\u{F703}"), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"),
        "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "PageUp": (116, "\u{F72C}"), "PageDown": (121, "\u{F72D}"), "Enter": (36, "\r"), "Space": (49, " "), "Escape": (53, "\u{1B}"), "Tab": (48, "\t"), "Shift": (56, "")]
    static func press(_ name: String, shift: Bool = false) { let k = keys[name]!; key(k.0, k.1, shift ? .shift : []) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? {
        func find(_ v: NSView) -> AWCNativeButtonFocusView? { if let f = v as? AWCNativeButtonFocusView, f.configuration?.id == id { return f }; for s in v.subviews { if let f = find(s) { return f } }; return nil }
        return find(host)
    }
    static var runtime: AWCColorPickerRuntime? { AWCColorPickerRuntime.mounted["cp"]?.runtime }
    static func m(_ name: String) -> CGRect? { state.measurements.first { $0.name == name }?.bounds }
    static func at(_ name: String, _ fx: Double, _ fy: Double) -> CGPoint {
        let r = m(name) ?? .zero
        // Chrome's mouse coordinates arrive in 1/16 CSS px steps (fits every Chrome drag event of the oracle; exact,
        // 1/64 and whole-px coordinates do not), so the same points are sent here.
        func q(_ v: Double) -> Double { ((v * 16) + 0.5).rounded(.down) / 16 }
        return CGPoint(x: q(r.minX + r.width * fx), y: q(r.minY + r.height * fy))
    }
    static func down(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
    static func move(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.leftMouseDragged, p) }
    static func up(_ p: CGPoint) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    /// A click. AppKit text fields track a press in a nested event loop until the release arrives: the release is queued
    /// first (where AppKit itself would find it), then the press is sent.
    static func click(_ p: CGPoint) {
        if env["AWC_CP_DEBUG"] != nil { print("  click \(p) @\(Int(now() - debugT0))"); fflush(stdout) }
        state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p)
        NSApp.postEvent(mouseEvent(.leftMouseUp, p), atStart: false)
        mouse(.leftMouseDown, p)
        state.pointer.update(phase: .up, location: p)
    }
    static func hover(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p) }
    static let blank = CGPoint(x: 4, y: 860)
    /// A pointer path of n moves, one per frame (Chrome: one per requestAnimationFrame).
    static func path(_ part: String, _ fx0: Double, _ fy0: Double, _ fx1: Double, _ fy1: Double, _ n: Int) {
        for i in 1...n { move(at(part, fx0 + (fx1 - fx0) * Double(i) / Double(n), fy0 + (fy1 - fy0) * Double(i) / Double(n))); pump(1 / 60) }
    }
    static func type(_ text: String) {
        // ANSI key codes per character (the iOS harness sends the key the code names, not the characters).
        let codes: [Character: UInt16] = ["0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, ".": 47, "-": 27, " ": 49,
                                          "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "l": 37, "r": 15, "s": 1, "x": 7, "z": 6]
        for ch in text { let s = String(ch); key(ch == "#" ? 20 : codes[Character(ch.lowercased())] ?? 18, s, ch == "#" || ch.isUppercase ? .shift : []); pump(0.033) }
    }
    static func typeIn(_ input: String, _ text: String) {
        click(at("input-" + input, 0.5, 0.5)); pump(0.03)
        // UIKit sets up the text input system when a field becomes first responder; on a loaded simulator that can take
        // longer than the click's frame, and keys typed before it land nowhere. Wait for the focus (at most 1 s).
        let until = Date().addingTimeInterval(1)
        while runtime?.input(input).isFocused() != true && Date() < until { pump(0.02) }
        runtime?.input(input).selectAll(); pump(0.01); type(text)
    }
    static func setProp(_ k: String, _ v: AWCValue) {
        var n = state.node
        if n.tag == "md-dialog", var c = n.children.first(where: { $0.id == "cp" }), let i = n.children.firstIndex(where: { $0.id == "cp" }) { c.properties[k] = v; n.children[i] = c }
        else { n.properties[k] = v }
        state.node = n
    }
    /// The page binds `open` to the element's property, which the component itself changes (trigger, Escape, outside press):
    /// the host node follows mdOpenChange so a later `open = true` is a change again.
    static func echo(_ e: AWCEvent) {
        if env["AWC_CP_DEBUG"] != nil { print("  event \(e.name) \(e.detail) @\(Int(now() - debugT0)) responder \(String(describing: window.firstResponder.map { Swift.type(of: $0) }))"); fflush(stdout) }
        if e.name == "mdOpenChange", let o = e.detail["open"].bool { setProp("open", .bool(o)) }
    }
    static var debugT0 = 0.0
    /// The native focused part (Web: the deep active element's part).
    static func focusedPart() -> String {
        guard let rt = runtime, let f = rt.focused else {
            if let fr = window.firstResponder as? AWCNativeButtonFocusView { return fr.configuration?.id == "before" ? "button" : fr.configuration?.id == "trigger" ? "trigger" : fr.configuration?.id == "after" ? "body" : "other" }
            return "body"
        }
        if f.hasPrefix("preset") { return "preset" }
        if ["hex", "r", "g", "b", "a", "h", "s", "l"].contains(f) { return "input" }
        return f
    }
    static func webFocus(_ f: AWCValue) -> String {
        let a = f.array.map { $0.string }
        if a.count >= 2 { return a[1] }
        if a.first == "button" { return "button" }
        if a.first?.hasPrefix("md-button") == true || a.first == "md-button" { return "trigger" }
        return a.first ?? "body"
    }
    /// Chrome's click is three CDP events (move, press, release): the pointer reaches the target about two frames before the
    /// release fires the md* event, so hover motion starts first. These clicks move there at that time.
    static var hoverFirst: [String: () -> CGPoint] = [:]
    static func actions(_ run: AWCValue) -> [String: () -> Void] {
        let name = run["name"].string
        hoverFirst = [:]
        var a: [String: () -> Void] = [:]
        if name.hasPrefix("cp-drag-plate") {
            a["down-25-25"] = { down(at("plate", 0.25, 0.25)) }
            a["drag-to-75-75"] = { path("plate", 0.25, 0.25, 0.75, 0.75, 20) }
            a["drag-outside-clamps"] = { path("plate", 0.75, 0.75, 1.3, 1.4, 8) }
            a["release-outside"] = { up(at("plate", 1.3, 1.4)) }
            a["click-centre"] = { click(at("plate", 0.5, 0.5)) }
        } else if name.hasPrefix("cp-drag-") {
            let sl = name.contains("hue") ? "hue" : "alpha"
            a["down-10"] = { down(at(sl, 0.1, 0.5)) }
            a["drag-to-90"] = { path(sl, 0.1, 0.5, 0.9, 0.5, 16) }
            a["drag-past-end"] = { path(sl, 0.9, 0.5, 1.2, 0.5, 6) }
            a["drag-past-start-vertical-offset"] = { path(sl, 1.2, 0.5, -0.2, 3, 12) }
            a["release"] = { up(at(sl, -0.2, 3)) }
        } else if name.hasPrefix("cp-keyboard-") {
            let part = name.contains("plate") ? "plate" : name.contains("hue") ? "hue" : "alpha"
            a["focus-" + part] = { click(blank); pump(0.02); _ = runtime?.control(part).focus(true) }
            for k in ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End", "PageDown", "PageUp", "Tab"] { a[k] = { press(k) } }
            a["Shift+ArrowRight"] = { press("ArrowRight", shift: true) }; a["Shift+ArrowUp"] = { press("ArrowUp", shift: true) }; a["Shift+ArrowLeft"] = { press("ArrowLeft", shift: true) }
            a["Enter-ignored"] = { press("Enter") }; a["ArrowLeft-wraps"] = { press("ArrowLeft") }; a["End-wraps-to-0"] = { press("End") }; a["End-again"] = { press("End") }
            a["ArrowUp-ignored"] = { press("ArrowUp") }; a["ArrowLeft-at-min"] = { press("ArrowLeft") }; a["Tab-to-hex"] = { press("Tab") }
        } else if name == "cp-tab-order" {
            a["blank"] = { click(blank) }
            a["Tab-1"] = { _ = focusView("before")?.requestNativeFocus() }
            for i in 2...18 { a["Tab-\(i)"] = { press("Tab") } }
            // Chrome: Shift+Tab from the first element of the page wraps through the browser to the last stop (the last preset).
            // Natively the loop past the last stop leaves focus on the page's button or on nothing (UIKit has no browser
            // chrome to cycle through): both are Chrome's "outside", where Shift+Tab reaches the last stop.
            a["Shift+Tab"] = { if ["button", "body"].contains(focusedPart()), let rt = runtime,
                                  let last = (0..<32).map({ "preset-\($0)" }).last(where: { rt.controls[$0] != nil }) { _ = rt.control(last).focus(true) } else { press("Tab", shift: true) } }
        } else if name.hasPrefix("cp-hex-typing") {
            a["select-type-#ff5722"] = { typeIn("hex", "#ff5722") }
            a["Enter-commit"] = { press("Enter") }
            a["type-short-0f0"] = { typeIn("hex", "0f0") }
            a["Tab-commit"] = { press("Tab") }
            a["type-invalid-zz"] = { typeIn("hex", "#zz") }
            a["Tab-snaps-back"] = { press("Tab") }
            a["focus-blur-no-edit"] = { click(at("input-hex", 0.5, 0.5)); pump(0.02); press("Tab") }
            a["type-8-digit"] = { typeIn("hex", "#11223380") }
        } else if name == "cp-channels-rgb" {
            a["type-R-255"] = { typeIn("r", "255") }; a["Tab-commit"] = { press("Tab") }
            a["type-G-999-clamps"] = { typeIn("g", "999") }; a["Enter-commit"] = { press("Enter") }
            a["ArrowUp-in-B"] = { click(at("input-b", 0.3, 0.5)); pump(0.02); press("ArrowUp") }; a["Tab-commit-B"] = { press("Tab") }
            a["type-A-0.25"] = { typeIn("a", "0.25") }; a["Tab-commit-A"] = { press("Tab") }
        } else if name == "cp-channels-hsl" {
            a["type-H-200"] = { typeIn("h", "200") }; a["Tab-commit"] = { press("Tab") }
            a["type-L-90"] = { typeIn("l", "90") }; a["Tab-commit-L"] = { press("Tab") }
        } else if name == "cp-presets" {
            a["hover-0"] = { hover(at("preset-0", 0.5, 0.5)) }
            a["press-0"] = { down(at("preset-0", 0.5, 0.5)) }
            a["release-0"] = { up(at("preset-0", 0.5, 0.5)) }
            a["click-5-short-hex"] = { click(at("preset-5", 0.5, 0.5)) }; hoverFirst["click-5-short-hex"] = { at("preset-5", 0.5, 0.5) }
            a["reclick-5"] = { click(at("preset-5", 0.5, 0.5)) }; hoverFirst["reclick-5"] = { at("preset-5", 0.5, 0.5) }
            a["leave"] = { hover(blank); state.pointer.update(phase: .leave) }
            a["Tab-to-next-preset"] = { press("Tab") }; a["Space"] = { press("Space") }; a["Tab"] = { press("Tab") }; a["Enter"] = { press("Enter") }
            a["ArrowRight-ignored"] = { press("ArrowRight") }
        } else if name.hasPrefix("cp-popover-") && !name.contains("dialog") {
            let trig = { at("md-color-picker", 0.5, 0.5) }
            a["click-trigger-open"] = { click(trig()) }; hoverFirst["click-trigger-open"] = trig
            a["Escape-close-focus-stays-on-trigger"] = { press("Escape") }
            a["Enter-on-trigger-opens"] = { press("Enter") }
            a["Tab-into-panel"] = { press("Tab") }
            a["ArrowRight-on-plate"] = { press("ArrowRight") }
            a["Escape-returns-focus"] = { press("Escape") }
            a["Space-on-trigger-opens"] = { press("Space") }
            a["click-plate"] = { click(at("plate", 0.3, 0.3)) }; hoverFirst["click-plate"] = { at("plate", 0.3, 0.3) }
            a["outside-click-closes-focus-stays"] = { click(blank) }
            a["show()"] = { if (state.node.properties["disabled"]?.bool ?? false) == false { setProp("open", true) } }
            a["trigger-click-toggles-closed"] = { click(trig()) }; hoverFirst["trigger-click-toggles-closed"] = trig
            a["open-prop-true"] = { setProp("open", true) }
            a["close()"] = { setProp("open", false) }
        } else if name == "cp-popover-in-dialog" {
            a["show-and-focus-plate"] = { setProp("open", true); pump(0.35); _ = runtime?.control("plate").focus(true) }
            a["Escape-closes-picker-only"] = { press("Escape") }
            a["Escape-closes-dialog"] = { press("Escape") }
        } else if name == "cp-disabled" {
            a["click-plate"] = { click(at("plate", 0.2, 0.2)) }
            a["drag-hue"] = { down(at("hue", 0.1, 0.5)); path("hue", 0.1, 0.5, 0.9, 0.5, 8); up(at("hue", 0.9, 0.5)) }
            a["click-preset"] = { click(at("preset-0", 0.5, 0.5)) }
            a["Tab-from-blank"] = { click(blank); _ = focusView("before")?.requestNativeFocus(); press("Tab") }
        } else if name == "cp-controlled" {
            a["set-value-rgb()"] = { setProp("value", "rgb(0, 128, 255)") }
            a["set-value-rgba()"] = { setProp("value", "rgba(255, 0, 0, 0.5)") }
            a["set-value-invalid"] = { setProp("value", "not-a-colour") }
            a["set-format-hsl"] = { setProp("format", "hsl") }
            a["keyboard-emit-in-hsl"] = { _ = runtime?.control("hue").focus(false); press("ArrowRight") }
            a["set-alpha-false"] = { setProp("alpha", false) }
        }
        return a
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = r["name"].string, label = (reduced ? "reduced/" : "") + name
        state.rtl = r["dir"].string == "rtl"; state.width = r["width"].number ?? 340; state.reduced = reduced
        var props: [String: AWCValue] = [:]; if case .object(let o) = r["props"] { props = o }
        let picker = AWCNode(id: "cp", tag: "md-color-picker", properties: props, children: r["trigger"] == .bool(true) ? [AWCNode(id: "trigger", tag: "md-button", properties: ["variant": "tonal"], children: [.text("Colour")], slot: "trigger")] : [])
        // cp-popover-in-dialog: the picker inside an open md-dialog (Escape closes the picker first, then the dialog).
        state.node = r["inDialog"] == .bool(true) ? AWCNode(id: "dlg", tag: "md-dialog", properties: ["open": true, "headline": "Theme"], children: [picker]) : picker
        state.pointer.update(phase: .leave); state.events = []; state.measurements = []; state.epoch += 1; pump(0.4); debugT0 = now() + 50
        _ = window.makeFirstResponder(nil); pump(0.05); state.events = []
        // The run clock starts a little ahead so a first-phase input can lead Chrome's animation start by the native latency.
        let phases = r["phases"].array, acts = actions(r), t0 = now() + 50
        let multi = ["drag", "type", "select-type", "focus-", "ArrowUp-in-B", "Tab-from-blank", "keyboard-emit", "click-centre"]
        // Chrome's animation starts (`anims`: preset / thumb transforms, the popover pop-in, the preview colour fade that marks
        // the frame rendering a state change). A one-step input is timed so that the native transition starts in the frame
        // Chrome's did: anchor − the native paint latency (one frame: the source renders state in its next frame, mirrored by
        // the delayed state animations; the pop-in starts when the open panel first renders).
        let anims = r["anims"].array.map { (kind: $0["kind"].string, start: $0["start"].number ?? 0) }
        func latency(_ kind: String) -> Double { kind == "pop" ? popLatency : stateLatency }
        // The input plan (oracle only): when each phase's input fires and, for clicks that hover first, when the pointer arrives.
        func plan(_ i: Int) -> (start: Double, hover: Double?, press: Double?, anchor: (kind: String, start: Double)?) {
            let ph = phases[i], lbl = ph["label"].string, t = ph["t"].number!
            let nextT = i + 1 < phases.count ? phases[i + 1]["t"].number! : t + 400
            // A one-step input fires when Chrome's first md* event of the phase did (a click activates on release).
            let first = r["events"].array.first { $0["name"].string.hasPrefix("md") && ($0["t"].number ?? -1) >= t && ($0["t"].number ?? 0) < nextT }?["t"].number
            let single = !multi.contains(where: { lbl.contains($0) })
            let inPhase = anims.filter { $0.start >= t - (i == 0 ? 1 : 0) && $0.start < nextT }
            var start = single && first != nil ? max(t, first! - 2) : t
            var anchor: (kind: String, start: Double)? = nil
            if single, let last = inPhase.last { anchor = last; start = last.start - latency(last.kind) }
            var hover: Double? = nil, press: Double? = nil
            if hoverFirst[lbl] != nil {
                // The pointer reaches the target first: at Chrome's hover transition when one precedes the activation's.
                let h = inPhase.count > 1 && inPhase[0].start < inPhase.last!.start - 10 ? inPhase[0].start - latency(inPhase[0].kind) : max(t, (first ?? t) - 40)
                hover = min(h, start - 4)
                // A preset click whose press and release Chrome rendered in separate frames (hover, :active, selected: three
                // groups of starts) is delivered as a press and a release at those frames; one click would coalesce them.
                var groups: [Double] = []
                for a in inPhase where groups.last.map({ a.start - $0 > 2 }) ?? true { groups.append(a.start) }
                if lbl.contains("click-5"), groups.count >= 3 { press = groups[groups.count - 2] - stateLatency }
            }
            return (start, hover, press, anchor)
        }
        let plans = phases.indices.map(plan)
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            let p = plans[i], start = p.start
            if let target = hoverFirst[lbl], let h = p.hover { while now() - t0 < h { pump() }; hover(target()); pump() }
            if let target = hoverFirst[lbl], let pr = p.press { while now() - t0 < pr { pump() }; down(target()); pump() }
            while now() - t0 < start { pump() }
            let fired = now() - t0
            if p.press != nil, let target = hoverFirst[lbl] { up(target()) }
            else if let act = acts[lbl] { act() } else { check(false, "\(label) no native action for \(lbl)") }
            if let anchor = p.anchor { anchored.append((label + "/" + lbl, anchor.kind, anchor.start, fired)) }
            // The phase's end state is read just before the next input (at the latest 20 ms before Chrome's next phase).
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! : start + 400
            let nextInput = i + 1 < phases.count ? min(plans[i + 1].start, plans[i + 1].hover ?? .infinity, plans[i + 1].press ?? .infinity) - 2 : next
            while now() - t0 < min(next - 20, nextInput) { pump() }
            let rt = runtime
            let last = ph["samples"].array.last ?? .null
            let nativeValue = currentValue()
            if last != .null {
                check(nativeValue == last["value"].string, "\(label)/\(lbl) value \(nativeValue) vs \(last["value"].string)")
                if last["hex"] != .null { check(rt?.hexInput == last["hex"].string, "\(label)/\(lbl) hex \(rt?.hexInput ?? "-") vs \(last["hex"].string)") }
                check((rt?.hexInvalid == true) == (last["hexInvalid"].string == "true"), "\(label)/\(lbl) hexInvalid \(rt?.hexInvalid == true) vs \(last["hexInvalid"])")
                if case .array(let web) = last["selectedPresets"] { let native = selectedPresets(); check(native == web.map { $0.string }, "\(label)/\(lbl) selected presets \(native) vs \(web.map { $0.string })") }
                if last["open"] != .null, props["variant"]?.string == "popover" { check(currentOpen() == (last["open"].bool ?? false), "\(label)/\(lbl) open \(currentOpen()) vs \(last["open"])") }
                if case .array(let web) = last["channels"], !web.isEmpty { let native = channels(); check(native == web.map { $0.string }, "\(label)/\(lbl) channels \(native) vs \(web.map { $0.string })") }
                if last["preview"] != .null, let rt { let w = rgba(last["preview"].string), v = AWCColorMath.rgba(rt.hsva)
                    check(abs(w[0] - v.r) <= 1 && abs(w[1] - v.g) <= 1 && abs(w[2] - v.b) <= 1 && abs(w[3] - v.a) <= 0.01, "\(label)/\(lbl) preview \(v) vs \(last["preview"].string)") }
                for (key, part) in [("plateThumb", "thumb"), ("hueThumb", "hue-thumb"), ("alphaThumb", "alpha-thumb")] {
                    guard case .object(let o) = last[key], let r = o["rect"], let x = r["x"].number, let y = r["y"].number, let w = r["width"].number, let h = r["height"].number else { continue }
                    // Chrome's rect is the transformed box (translateY(-50%) on the slider thumbs, scale while pressed): compare centres.
                    guard let n = m(part) else { check(false, "\(label)/\(lbl) \(part) measured"); continue }
                    let wc = CGPoint(x: x + w / 2, y: y + h / 2)
                    check(abs(n.midX - wc.x) <= 1 && abs(n.midY - wc.y) <= 1, "\(label)/\(lbl) \(part) centre (\(n.midX), \(n.midY)) vs (\(wc.x), \(wc.y))")
                }
            }
            // Motion: every Chrome sample of this phase against the native presented values within one frame.
            for smp in ph["samples"].array {
                guard let st = smp["t"].number else { continue }
                let at = t0 + st
                if case .object(let o) = smp["popover"], let op = Double(o["opacity"]?.string ?? "") {
                    let mx = matrix(o["transform"]?.string ?? "none")
                    motion("popover", at, [op, mx[0], mx[5]], [0.03, 0.012, 0.35], "\(label)/\(lbl) popover t=\(Int(st))")
                }
                for (i, tr) in smp["presetTransforms"].array.enumerated() {
                    let mx = matrix(tr.string), sc = (mx[0] * mx[0] + mx[1] * mx[1]).squareRoot(), ang = atan2(mx[1], mx[0]) * 180 / .pi
                    motion("preset-\(i)", at, [sc, ang], [0.012, 0.35], "\(label)/\(lbl) preset \(i) t=\(Int(st))")
                }
                for (key, part) in [("plateThumb", "plate"), ("hueThumb", "hue"), ("alphaThumb", "alpha")] {
                    guard case .object(let o) = smp[key] else { continue }
                    let sc = matrix(o["transform"]?.string ?? "none")[0]
                    motion("thumb-" + part, at, [(sc - 1) / 0.15], [0.1], "\(label)/\(lbl) \(part) thumb press t=\(Int(st))")
                }
            }
            let wf = webFocus(ph["focus"]), nf = focusedPart()
            // Outside the picker Chrome's focus is the page's button or, past the last stop, the browser (body); which one depends
            // on the browser's tab cycle, not on the component: both count as "outside".
            let outside: Set<String> = ["button", "body"]
            if name != "cp-tab-order" || wf != "body" { check(nf == wf || (outside.contains(nf) && outside.contains(wf)), "\(label)/\(lbl) focus \(nf) vs \(wf)") }
        }
        pump(0.2)
        // Calibration: where each anchored native transition started (first presented value after the input that differs).
        for a in anchored where a.0.hasPrefix(label + "/") {
            let keys = (runtime?.motion.keys).map(Array.init)?.filter { a.1 == "pop" ? $0 == "popover" : a.1 == "thumb" ? $0.hasPrefix("thumb") : a.1 == "preset" ? $0.hasPrefix("preset") : false } ?? []
            var starts: [Double] = []
            for k in keys { let l = runtime?.motion[k] ?? []; let at = t0 + a.3
                if let before = l.last(where: { $0.t <= at }), let ch = l.first(where: { $0.t > at && $0.v != before.v }) { starts.append(ch.t - t0) }
                else if l.first(where: { $0.t > at }) != nil, l.last(where: { $0.t <= at }) == nil, let ch = l.first(where: { $0.t > at }) { starts.append(ch.t - t0) } }
            if let s0 = starts.min() { print("  anchor \(a.0) \(a.1) chrome \(Int(a.2)) fired \(Int(a.3)) native \(Int(s0)) (\(Int(s0 - a.2)) ms)") }
        }
        anchored.removeAll()
        // The page's clean-up moves focus away (a focused field's blur commits: mdChange).
        _ = window.makeFirstResponder(nil); pump(0.1)
        // md* event sequence (names and values).
        let web = r["events"].array.map { e -> String in let d = e["detail"]; return e["name"].string + (d["value"] != .null ? ":" + d["value"].string : d["open"] != .null ? ":" + (d["open"].bool == true ? "true" : "false") : "") }
        let own: Set<String> = ["mdInput", "mdChange", "mdOpenChange"]
        let native = state.events.filter { own.contains($0.0) }.map { e -> String in e.0 + (e.1["value"] != .null ? ":" + e.1["value"].string : e.1["open"] != .null ? ":" + (e.1["open"].bool == true ? "true" : "false") : "") }
        // Pointer drags: Chrome's pointer coordinates carry sub-pixel rounding (≈1/16 px, direction-dependent at exact .5
        // channel boundaries) that cannot be reproduced bit for bit; a drag event value may differ by one 8-bit step in one
        // channel (reported, counted, never more).
        func near(_ a: String, _ b: String) -> Bool {
            if a == b { return true }
            let x = a.split(separator: ":"), y = b.split(separator: ":")
            guard name.contains("drag"), x.count == 2, y.count == 2, x[0] == y[0], x[1].hasPrefix("#"), y[1].hasPrefix("#"), x[1].count == y[1].count else { return false }
            let p = Array(x[1].dropFirst()), q = Array(y[1].dropFirst())
            let d = stride(from: 0, to: p.count, by: 2).map { i in abs((Int(String(p[i..<i + 2]), radix: 16) ?? -9) - (Int(String(q[i..<i + 2]), radix: 16) ?? 9)) }
            return d.filter { $0 == 1 }.count == 1 && d.allSatisfy { $0 <= 1 }
        }
        let lsb = native.indices.filter { $0 < web.count && native[$0] != web[$0] && near(native[$0], web[$0]) }.count
        let same = native.count == web.count && native.indices.allSatisfy { near(native[$0], web[$0]) }
        let d0 = native.indices.first { $0 >= web.count || !near(native[$0], web[$0]) } ?? (native.count < web.count ? native.count : -1)
        if lsb > 0 { report.append(["run": label, "dragEventsWithinOneStep": lsb]) }
        check(same, "\(label) events differ at \(d0): native \(Array(native.dropFirst(max(0, d0 - 2)).prefix(5))) vs web \(Array(web.dropFirst(max(0, d0 - 2)).prefix(5))) (\(native.count) vs \(web.count))")
        report.append(["run": label, "events": native.count, "webEvents": web.count])
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.1)
    }
    /// CSS `matrix(a, b, c, d, e, f)` (or `none`).
    static func matrix(_ t: String) -> [Double] {
        guard t.hasPrefix("matrix(") else { return [1, 0, 0, 1, 0, 0] }
        let v = t.dropFirst(7).dropLast().split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        return v.count == 6 ? v : [1, 0, 0, 1, 0, 0]
    }
    static func rgba(_ css: String) -> [Double] {
        let v = css.drop { $0 != "(" }.dropFirst().dropLast().split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        return v.count >= 3 ? [v[0], v[1], v[2], v.count > 3 ? v[3] : 1] : [0, 0, 0, 0]
    }
    static var motionFailures = 0
    /// Native paint latency (ms) from an input to the start of the transition it causes: state paint is delayed one frame
    /// (AWCColorPickerMotion.frame); the pop-in starts when the opened panel first renders.
    static let stateLatency = Double(env["AWC_CP_STATE_LATENCY"] ?? "") ?? 17, popLatency = Double(env["AWC_CP_POP_LATENCY"] ?? "") ?? 5
    static var anchored: [(String, String, Double, Double)] = []
    /// The native presented values at `at` (ms): every value recorded within one frame of it plus the value in force before
    /// that window; the Chrome value must lie within their range (± tolerance). A key never recorded is at rest (identity).
    static func motion(_ key: String, _ at: Double, _ web: [Double], _ tol: [Double], _ label: String) {
        let rest: [Double] = key == "popover" ? [1, 1, 0] : key.hasPrefix("preset") ? [1, 0] : [0]
        let list = runtime?.motion[key] ?? []
        let window = 20.0
        var candidates = list.filter { abs($0.t - at) <= window }.map(\.v)
        if let before = list.last(where: { $0.t < at - window }) { candidates.append(before.v) }
        if candidates.isEmpty { candidates = [list.first?.v ?? rest] }
        let ok = web.indices.allSatisfy { i in
            let lo = candidates.map { $0[i] }.min()!, hi = candidates.map { $0[i] }.max()!
            return web[i] >= lo - tol[i] && web[i] <= hi + tol[i]
        }
        if !ok { motionFailures += 1 }
        check(ok, "\(label) \(key) web \(web.map { (($0 * 1000).rounded() / 1000) }) vs native \(candidates.map { $0.map { (($0 * 1000).rounded() / 1000) } })")
    }
    static func currentValue() -> String { runtime?.snapshot.value ?? "-" }
    static func currentOpen() -> Bool { runtime?.snapshot.open ?? false }
    static func selectedPresets() -> [String] { runtime?.snapshot.selected ?? [] }
    static func channels() -> [String] { runtime?.snapshot.channels ?? [] }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ColorPickerStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = env["AWC_CP_STATES_ONLY"]
        for (file, reduced) in [("colorpicker-web-states", false), ("colorpicker-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced) }
        }
        if let output = env["AWC_CP_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Color picker native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
