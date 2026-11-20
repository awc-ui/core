import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-date-picker interaction against Chrome 153 (Mac capture of dp-states.html: 24 runs, and the same 24 under reduced
// motion; today pinned to 2025-06-12): the modal day and year keyboards in both directions, pointer picks, the year grid,
// dismissal (scrim, Escape, a non-dismissing scrim), commit on select, the entry mode (invalid and valid typing), the
// modal-input trigger field, the docked panel (pointer menus, Shift+M / Shift+Y menus, outside presses, clear), a required
// form, min / max keyboard clamping, the focus trap and a phone viewport. Each phase replays Chrome's input at its
// recorded time; checks: the md* event sequence with every detail (a `date` as its civil day), and per phase the end
// state: value, open, the focused part, the roving tab stop, the selected day, the view label, the open menu, the year
// grid's scroll, the trigger / entry text, the error.
@Observable final class DatePickerStatesState {
    var node = AWCNode(id: "dp", tag: "md-date-picker")
    var epoch = 0
    var rtl = false
    var dark = false
    var reduced = false
    var width = 360.0
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double)] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored let controller = AWCDatePickerController()
}
struct DatePickerStatesFixture: View {
    let state: DatePickerStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope { ZStack(alignment: .topLeading) {
            AWCNativeView(node: state.node) { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000)); NativeDatePickerStatesIntegration.echo(e) }
                .frame(width: state.width, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .padding(.leading, 24).padding(.top, 24)
                .environment(\.layoutDirection, .leftToRight)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }
        .awcDatePickerToday(AWCDay(year: 2025, month: 6, day: 12))
        .awcDatePickerController(state.controller, for: "dp")
        .environment(\.locale, Locale(identifier: "en_US"))
        .awcReducedMotion(state.reduced)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "dp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0; NativeDatePickerStatesIntegration.traceDelivery($0) } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
/// A key-capable borderless window that reports itself key while another process holds activation (fi-731 / fi-736).
final class DPKeyWindow: NSWindow {
    override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true }
    #if !canImport(UIKit)
    override var isKeyWindow: Bool { true }
    #endif
}
#if canImport(UIKit)
typealias DPHostingView = NSHostingView<DatePickerStatesFixture>
#else
final class DPHostingView: NSHostingView<DatePickerStatesFixture> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
#endif
@main @MainActor enum NativeDatePickerStatesIntegration {
    static let state = DatePickerStatesState()
    static var host: NSHostingView<DatePickerStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    /// Diagnostics (AWC_DP_DEBUG): main-thread stalls between pump iterations, inspection deliveries.
    static var lastPump = 0.0
    static var lastNames: [String] = []
    static func traceDelivery(_ ms: [AWCNativeInspectionNode]) {
        guard env["AWC_DP_DEBUG"] != nil else { return }
        let names = Set(ms.map(\.name)).sorted()
        guard names != lastNames else { return }
        lastNames = names
        print("  DELIVER +\(Int(now() - t0)) \(names.count) names day=\(names.contains("day")) entry=\(names.contains("entry")) year=\(names.contains("year")) menu=\(names.contains("year-menu") || names.contains("month-menu"))"); fflush(stdout)
    }
    static func pump(_ duration: Double = 0.004) { let end = Date().addingTimeInterval(duration); repeat {
        if env["AWC_DP_DEBUG"] != nil { let a = now(); if lastPump > 0, a - lastPump > 40 { print("  STALL +\(Int(a - t0)) \(Int(a - lastPump))ms \(current)"); fflush(stdout) }; lastPump = a }
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)); lastPump = env["AWC_DP_DEBUG"] != nil ? now() : 0 } while Date() < end }
    static func mouseEvent(_ type: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        return NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!
    }
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        if type == .leftMouseDown { modalSession()?.lastInputPointer = true }
        window.sendEvent(mouseEvent(type, p))
    }
    static func modalSession() -> AWCModalSession? {
        func find(_ v: NSView) -> AWCModalHostView? { if let h = v as? AWCModalHostView { return h }; for s in v.subviews { if let h = find(s) { return h } }; return nil }
        return find(host)?.session
    }
    /// A key as NSApplication delivers it: the modal scope's monitor (Escape / Tab to the top owner) first, then the window.
    static func key(_ code: UInt16, _ chars: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            if type == .keyDown, let session = modalSession() {
                session.lastInputPointer = false
                if session.isActive && (code == 53 && session.escape() || code == 48 && session.tab(backward: flags.contains(.shift))) { continue }
            }
            let ignoring = flags.contains(.shift) ? chars.lowercased() : chars
            let event = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: ignoring, isARepeat: false, keyCode: code)!
            #if canImport(UIKit)
            window.sendEvent(event)
            #else
            // As a hardware key arrives: the application's current event while the window handles it.
            NSApp.postEvent(event, atStart: true)
            window.sendEvent(NSApp.nextEvent(matching: [.keyDown, .keyUp], until: .distantPast, inMode: .default, dequeue: true) ?? event)
            #endif
        }
    }
    static let keys: [String: (UInt16, String)] = ["ArrowLeft": (123, "\u{F702}"), "ArrowRight": (124, "\u{F703}"), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"),
        "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "PageUp": (116, "\u{F72C}"), "PageDown": (121, "\u{F72D}"), "Enter": (36, "\r"), " ": (49, " "),
        "Escape": (53, "\u{1B}"), "Tab": (48, "\t"), "M": (46, "M"), "Y": (16, "Y"), "a": (0, "a")]
    /// "Shift+PageDown", "Alt+ArrowDown", "Control+End", "Shift+M", "Shift+Tab", " ".
    static func press(_ label: String) {
        let parts = label == " " ? [" "] : label.split(separator: "+").map(String.init)
        var flags: NSEvent.ModifierFlags = []
        for m in parts.dropLast() { flags.insert(m == "Shift" ? .shift : m == "Alt" ? .option : m == "Control" ? .control : .command) }
        guard let k = keys[parts.last ?? ""] else { check(false, "no key for \(label)"); return }
        #if !canImport(UIKit)
        if k.0 == 116 || k.0 == 121 || (123...126).contains(k.0) || k.0 == 115 || k.0 == 119 { flags.insert(.function) }
        #endif
        key(k.0, k.1, flags)
    }
    static let digitCodes: [Character: UInt16] = ["0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, "/": 44]
    static func typeChar(_ ch: Character) { key(digitCodes[ch] ?? 18, String(ch)) }
    static var runtime: AWCDatePickerRuntime? { AWCDatePickerRuntime.mounted["dp"] }
    static func node(_ name: String, _ match: (AWCNativeInspectionNode) -> Bool = { _ in true }) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && match($0) } }
    static func center(_ n: AWCNativeInspectionNode?) -> CGPoint? { n.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// The trigger's trailing slot holds [clear] [calendar]; each is a square of the slot's height.
    static func trailingButton(_ which: String) -> CGPoint? {
        guard let t = node("trailing-icon") else { return nil }
        let h = t.bounds.height, rtl = state.rtl
        let calendarX = rtl ? t.bounds.minX + h / 2 : t.bounds.maxX - h / 2
        return CGPoint(x: which == "calendar" ? calendarX : calendarX + (rtl ? h : -h), y: t.bounds.midY)
    }
    static func click(_ p: CGPoint?, _ what: String) {
        guard let p else { check(false, "\(current) no target for \(what)"); return }
        state.pointer.update(phase: .move, location: p); state.pointer.update(phase: .down, location: p)
        NSApp.postEvent(mouseEvent(.leftMouseUp, p), atStart: false)
        mouse(.leftMouseDown, p)
        state.pointer.update(phase: .up, location: p)
    }
    static var current = ""
    static var t0 = 0.0
    /// The page binds nothing: `open` follows the component (mdOpen / mdClose), `value` its commits.
    static func echo(_ e: AWCEvent) {
        if env["AWC_DP_DEBUG"] != nil { print("  event +\(Int(now() - t0)) \(e.name) \(e.detail)"); fflush(stdout) }
        if e.name == "mdOpen" { setProp("open", true) } else if e.name == "mdClose" { setProp("open", false) }
        if e.name == "mdChange" { setProp("value", .string(e.detail["value"].string)) }
    }
    static func setProp(_ k: String, _ v: AWCValue) { var n = state.node; n.properties[k] = v; state.node = n }
    /// The native focused part, named as Chrome's deep active element below the host (`md-date-picker > …`).
    static func focusedPart() -> String {
        let rt = runtime
        if rt?.entryTarget?.isFocused() == true { return "md-date-picker > entry-input > input" }
        if rt?.fieldTarget?.isFocused() == true { return "md-date-picker > field > input" }
        guard let fv = window.firstResponder as? AWCNativeButtonFocusView, let id = fv.configuration?.id, id.hasPrefix("dp-") else {
            #if canImport(UIKit)
            return window.firstResponder is UITextField ? "other text" : "body"
            #else
            return window.firstResponder is NSTextView ? "other text" : "body"
            #endif
        }
        let s = String(id.dropFirst(3))
        if s.hasPrefix("day-") { return "md-date-picker > " + s.dropFirst(4) }
        if s.hasPrefix("month-option-") { return "md-date-picker > month-option" + (Int(s.dropFirst(13)) == rt?.viewMonth ? " month-option-selected" : "") }
        if s.hasPrefix("year-option-") { return "md-date-picker > year-option" + (Int(s.dropFirst(12)) == rt?.viewYear ? " year-option-selected" : "") }
        if s.hasPrefix("year-"), Int(s.dropFirst(5)) != nil { return "md-date-picker > " + s.dropFirst(5) }
        let names = ["cancel": "cancel-button", "ok": "ok-button", "prev": "prev-button", "next": "next-button", "calendar": "calendar-button", "clear": "clear-button",
                     "prev-month": "prev-month-button", "next-month": "next-month-button", "prev-year": "prev-year-button", "next-year": "next-year-button"]
        return "md-date-picker > " + (names[s] ?? s)
    }
    /// Actions by phase label (dp-states.html).
    static func act(_ label: String) {
        let rt = runtime
        func day(_ d: Int) -> CGPoint? {
            guard let rt else { return nil }
            let iso = AWCDay(year: rt.viewYear, month: rt.viewMonth, day: d).iso
            return center(node("day") { $0.metrics["date"]?.string == iso })
        }
        // The docked list scrolls inside the panel (decision 3): the entry is scrolled into view before the press.
        // The entry was revealed before the phase's time (`prepare`), so the click lands at Chrome's time.
        func option(_ kind: String, _ n: Int) -> CGPoint? { center(node(kind) { $0.id.hasSuffix("\(kind)-\(n)") }) }
        switch label {
        case "show": rt?.show()
        case "open", "open-calendar": click(trailingButton("calendar"), label)
        case "clear": click(trailingButton("clear"), label)
        case "focus-field": rt?.focusInput()
        case "ok": click(center(node("ok-button")), label)
        case "cancel": click(center(node("cancel-button")), label)
        case "to-entry", "to-calendar": click(center(node("mode-toggle")), label)
        case "open-years": click(center(node("month-toggle")), label)
        case "month-menu": click(center(node("month-menu-button")), label)
        case "year-menu": click(center(node("year-menu-button")), label)
        case "next-month": click(center(node("next-button") ?? node("next-month-chevron-slot")), label)
        case "prev-month": click(center(node("prev-button") ?? node("prev-month-chevron-slot")), label)
        case "prev-year": click(center(node("prev-year-chevron-slot")), label)
        case "pick-sep": click(option("month-option", 9), label)
        case "pick-feb": click(option("month-option", 2), label)
        case "pick-year+2": click(option("year-option", (rt?.viewYear ?? 0) + 2), label)
        case "scrim", "scrim-ignored": click(CGPoint(x: 1150, y: 850), label)
        case "outside", "outside-ignored": click(CGPoint(x: 1100, y: 120), label)
        case "Control+a":
            #if canImport(UIKit)
            (window.firstResponder as? UITextField)?.selectAll(nil)
            #else
            (window.firstResponder as? NSTextView)?.selectAll(nil)
            #endif
        case "submit-empty", "form-data": break
        case "reset": setProp("value", "")
        case _ where label.hasPrefix("focus-"):
            let id = "dp-day-" + label.dropFirst(6); _ = rt?.dayFocus.focus(id)
        case _ where label.hasPrefix("pick-day-"): click(day(Int(label.dropFirst(9)) ?? 1), label)
        case _ where label.hasPrefix("pick-"):
            let n = Int(label.dropFirst(5)) ?? 0
            if n > 1000 { click(center(node("year") { $0.metrics["year"]?.number == Double(n) }), label) } else { click(day(n), label) }
        default: press(label)
        }
    }
    static func run(_ r: AWCValue, reduced: Bool) {
        let name = r["name"].string, label = (reduced ? "reduced/" : "") + name
        state.rtl = r["dir"].string == "rtl"; state.dark = r["theme"].string == "dark"; state.reduced = reduced
        let phone = name.hasPrefix("phone-")
        let size = NSSize(width: phone ? 360 : 1200, height: phone ? 640 : 900)
        if window.contentView?.frame.size != size { window.setContentSize(size); host.frame = NSRect(origin: .zero, size: size) }
        var props: [String: AWCValue] = [:]; if case .object(let o) = r["props"] { props = o }
        state.width = props["variant"]?.string == "modal" ? 1 : phone ? 320 : 360
        state.node = AWCNode(id: "dp", tag: "md-date-picker", properties: props)
        state.pointer.update(phase: .leave); state.events = []; state.measurements = []; state.epoch += 1; pump(0.4)
        let phases = r["phases"].array
        webRuns = r["anims"].array.compactMap { a in
            let target = a["target"].string, prop = a["property"].string
            guard prop.hasPrefix("md-date-picker-"), let part = target.split(separator: " ").dropFirst().first.map(String.init) else { return nil }
            return (part, a["start"].number ?? 0)
        }
        t0 = now() + 50
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string, t = ph["t"].number ?? 0
            current = label + "/" + lbl
            while now() - t0 < t { pump() }
            if lbl.hasPrefix("type-") {
                // The page types "MM/DD/YYYY"; its label keeps the digits only.
                var typed = String(lbl.dropFirst(5)); if typed.count == 8 { typed.insert("/", at: typed.index(typed.startIndex, offsetBy: 4)); typed.insert("/", at: typed.index(typed.startIndex, offsetBy: 2)) }
                for (k, ch) in typed.enumerated() { while now() - t0 < t + Double(k) * 33.3 { pump() }; typeChar(ch); pump() }
            } else { act(lbl) }
            let next = i + 1 < phases.count ? phases[i + 1]["t"].number! : t + 900
            // A docked list entry the next phase clicks is revealed after this phase's check, 110 ms ahead, so the click itself is
            // replayed at Chrome's time (Chrome's lists show every entry: nothing scrolls there).
            let nextLabel = i + 1 < phases.count ? phases[i + 1]["label"].string : ""
            let reveal: Int? = nextLabel == "pick-sep" ? 9 : nextLabel == "pick-feb" ? 2 : nextLabel == "pick-year+2" ? (runtime?.viewYear ?? 0) + 2 : nil
            while now() - t0 < next - (reveal == nil ? 20 : 110) { pump() }
            checkPhase(current, ph)
            if let reveal { runtime?.revealMenuEntry(reveal) }
        }
        pump(0.2)
        // md* events with every detail; a `date` is compared as its civil day (Chrome reports local midnight in UTC).
        func text(_ name: String, _ d: AWCValue) -> String {
            func v(_ k: String, _ x: AWCValue) -> String {
                if case .object(let f) = x { return "{" + f.keys.sorted().filter { f[$0]?.bool == true }.joined(separator: ",") + "}" }
                switch x {
                case .null: return "null"
                case .bool(let b): return String(b)
                case .number(let n): return String(Int(n))
                default: break
                }
                if k == "date", x.string.contains("T") {
                    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    if let date = f.date(from: x.string) { let o = ISO8601DateFormatter(); o.formatOptions = [.withFullDate]; return o.string(from: date.addingTimeInterval(12 * 3600)) }
                }
                return x.string
            }
            if case .object(let o) = d { return name + "(" + o.keys.sorted().map { k in k + "=" + v(k, o[k] ?? .null) }.joined(separator: ",") + ")" }
            return name
        }
        let web = r["events"].array.filter { $0["name"].string.hasPrefix("md") }.map { text($0["name"].string, $0["detail"]) }
        let native = state.events.filter { $0.0.hasPrefix("md") }.map { text($0.0, $0.1) }
        let d0 = native.indices.first { $0 >= web.count || native[$0] != web[$0] } ?? (native.count < web.count ? native.count : -1)
        check(native == web, "\(label) events differ at \(d0): native \(Array(native.dropFirst(max(0, d0 - 1)).prefix(3))) vs web \(Array(web.dropFirst(max(0, d0 - 1)).prefix(3))) (\(native.count) vs \(web.count))")
        report.append(["run": label, "events": native.count, "webEvents": web.count])
        if runtime?.isOpen == true { runtime?.hide(); pump(0.1) }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.1)
    }
    /// Native check (no oracle run scrolls): the year grid is `overflow-y: auto` — the wheel's path scrolls the years, clamped
    /// to the content, and the rows scrolled into view are real cells.
    static func yearGridScrolls() {
        state.reduced = true; state.rtl = false; state.dark = false; state.width = 1
        state.node = AWCNode(id: "dp", tag: "md-date-picker", properties: ["variant": "modal", "value": "2025-06-18"])
        state.events = []; state.measurements = []; state.epoch += 1; pump(0.3)
        current = "year-scroll"
        runtime?.show(); pump(0.4)
        click(center(node("month-toggle")), "month-toggle"); pump(0.5)
        func top() -> Double? { node("year-grid")?.metrics["scrollTop"]?.number }
        guard let before = top() else { check(false, "year-scroll: the year view is open"); return }
        runtime?.yearWheel(120); pump(0.3)
        check(top().map { abs($0 - before - 120) < 0.5 } == true, "year-scroll: a 120 px wheel step scrolls the years (\(before) → \(top() ?? -1))")
        let view = node("year-grid-scroll")?.bounds ?? .zero
        let shown = state.measurements.filter { $0.name == "year" && view.intersects($0.bounds) }
        // 288 px viewport, 36 px cells at a 52 px pitch: a window of that height always touches at least 6 rows of 3 (Chrome: 5.5 rows).
        check(shown.count >= 18 && shown.allSatisfy { $0.metrics["tabindex"] != nil }, "year-scroll: the rows in view are year cells (\(shown.count))")
        check(runtime?.viewMode == .year && runtime?.viewYear == 2025 && !state.events.contains { $0.0 == "mdMenuSelect" }, "year-scroll: scrolling picks nothing")
        runtime?.yearWheel(-50_000); pump(0.3)
        check(top() == 0, "year-scroll: the scroll stops at the first row (\(top() ?? -1))")
        runtime?.hide(); pump(0.3)
    }
    static func checkPhase(_ label: String, _ ph: AWCValue) {
        guard let last = ph["samples"].array.last else { return }
        let rt = runtime, ms = state.measurements
        if env["AWC_DP_DEBUG"] != nil {
            print("  PHASE \(label) open=\(rt?.isOpen ?? false) closing=\(rt?.closing ?? false) panelClosing=\(rt?.panelClosing ?? false) session=\(modalSession()?.isActive ?? false) nodes=\(Set(ms.map(\.name)).sorted().prefix(12))")
            let rootM = ms.first { $0.name == "md-date-picker" }?.metrics, panelM = ms.first { $0.name == "panel" }?.metrics
            let cal = rt?.motion["calendar"] ?? []
            print("  MEAS rootInputMode=\(rootM?["inputMode"]?.bool.map { String($0) } ?? "-") panelSettle=\(panelM?["settle"]?.number.map { String(Int($0)) } ?? "-") rt.inputMode=\(rt?.inputMode ?? false) rt.settle=\(rt?.settle ?? -1) calendar=\(cal.count) last=\(cal.suffix(3).map { "+\(Int($0.t - t0)):\((($0.v.first ?? 0) * 1000).rounded() / 1000)" })")
            print("  RUNS +\(Int(now() - t0)) menus=\(rt?.monthMenuOpen ?? false)/\(rt?.yearMenuOpen ?? false) closing=\(rt?.menuClosing ?? false) " + (rt?.runStarts ?? [:]).sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value.suffix(3).map { Int($0 - t0) })" }.joined(separator: " "))
        }
        let value = state.node.properties["value"]?.string ?? ""
        check(value == last["value"].string, "\(label) value \(value) vs \(last["value"].string)")
        check((rt?.isOpen ?? false) == (last["open"].bool ?? false), "\(label) open \(rt?.isOpen ?? false) vs \(last["open"])")
        let nf = focusedPart(), wf = last["active"].string
        check(nf == wf, "\(label) focus \(nf) vs \(wf)")
        // Roving tab stops (days / years with tabindex 0), the selected day.
        let stops = ms.filter { ($0.name == "day" || $0.name == "year") && $0.metrics["tabindex"]?.number == 0 }
            .map { $0.metrics["date"]?.string ?? $0.metrics["year"].map { String(Int($0.number ?? 0)) } ?? "?" }
        let webStops: [String] = { if case .array(let a) = last["tabbable"] { return a.map(\.string) }; return [last["tabbable"].string] }()
        check(stops == webStops, "\(label) tab stops \(stops) vs \(webStops)")
        let selected = ms.first { $0.name == "day" && $0.metrics["selected"]?.bool == true }?.metrics["date"]?.string
        let webSelected = last["selected"] == .null ? nil : last["selected"].string
        check(selected == webSelected, "\(label) selected \(selected ?? "-") vs \(webSelected ?? "-")")
        // The view label: the month toggle (modal) or the month and year menu buttons (docked), without the caret glyphs.
        func strip(_ s: String) -> String { s.replacingOccurrences(of: "arrow_drop_down", with: "").replacingOccurrences(of: "arrow_drop_up", with: "").trimmingCharacters(in: .whitespaces) }
        let webView = last["view"].string.split(separator: " ").map { strip(String($0)) }.filter { !$0.isEmpty }.joined(separator: " ")
        let nativeView = ["month-toggle", "month-menu-button", "year-menu-button"].compactMap { n in ms.first { $0.name == n }?.metrics["label"]?.string }.joined(separator: " ")
        check(nativeView == webView, "\(label) view \(nativeView) vs \(webView)")
        let menus = (ms.contains { $0.name == "month-menu" }, ms.contains { $0.name == "year-menu" })
        check(menus.0 == (last["monthMenu"] != .null) && menus.1 == (last["yearMenu"] != .null), "\(label) menus \(menus) vs \(last["monthMenu"] != .null), \(last["yearMenu"] != .null)")
        let scroll = ms.first { $0.name == "year-grid" }?.metrics["scrollTop"]?.number
        let webScroll = last["yearScrollTop"].number
        check((scroll == nil) == (webScroll == nil) && abs((scroll ?? 0) - (webScroll ?? 0)) <= 1, "\(label) year scroll \(scroll.map { String($0) } ?? "-") vs \(webScroll.map { String($0) } ?? "-")")
        // The trigger / entry text and the error.
        let fields = ms.filter { $0.name == "md-text-field" }
        let entryBox = ms.first { $0.name == "entry-input" }?.bounds
        let entry = entryBox.flatMap { b in fields.first { b.insetBy(dx: -1, dy: -1).contains($0.bounds) } }
        let trigger = fields.first { f in entryBox.map { !$0.insetBy(dx: -1, dy: -1).contains(f.bounds) } ?? true }
        let nativeField = (entry ?? trigger)?.metrics["value"]?.string
        let webField = last["fieldValue"] == .null ? nil : last["fieldValue"].string
        check(nativeField == webField, "\(label) field \(nativeField ?? "-") vs \(webField ?? "-")")
        let nativeEntry = entry?.metrics["value"]?.string, webEntry = last["entryValue"] == .null ? nil : last["entryValue"].string
        check(nativeEntry == webEntry, "\(label) entry \(nativeEntry ?? "-") vs \(webEntry ?? "-")")
        let error = !(rt?.validationMessage ?? "").isEmpty || state.node.properties["error"]?.bool == true
        check(error == (last["error"].bool ?? false) && (rt?.validationMessage ?? "") == last["errorText"].string,
              "\(label) error \(error) \(rt?.validationMessage ?? "") vs \(last["error"]) \(last["errorText"].string)")
        // Motion: every Chrome sample of a running keyframe animation, at its time into Chrome's run, against the native
        // presented values at the same time into the native run (the native run starts with its first frame after the replayed
        // input; that latency is printed, not compared): [opacity, scale, translateY, translateX] of the panel, scrim,
        // calendar bloom, grid slide, docked menus and the year view.
        for smp in ph["samples"].array {
            guard let st = smp["t"].number else { continue }
            for (webKey, part, comps) in [("panel", "panel", [0, 1, 2]), ("scrim", "scrim", [0]), ("calendar", "calendar", [0, 1, 2]), ("grid", "grid", [3]),
                                          ("monthMenu", "month-menu-wrap", [0, 1, 2]), ("yearMenu", "year-menu-wrap", [0, 1, 2]), ("yearWrap", "year-grid-wrap", [0, 1, 2])] {
                guard case .object(let o) = smp[webKey], let anim = o["animation"]?.string, anim != "none", !anim.isEmpty,
                      let webStart = webRuns.filter({ $0.part == part && $0.start <= st + 1 }).map(\.start).max() else { continue }
                let m = matrix(o["transform"]?.string ?? "none")
                motion(webKey, st - webStart, webStart, [Double(o["opacity"]?.string ?? "1") ?? 1, m[0], m[5], m[4]], comps, "\(label) t=\(Int(st))")
            }
        }
    }
    /// Chrome's keyframe runs of the current run (part, start ms).
    static var webRuns: [(part: String, start: Double)] = []
    static var latencies: [String: [Double]] = [:]
    static func matrix(_ t: String) -> [Double] {
        guard t.hasPrefix("matrix(") else { return [1, 0, 0, 1, 0, 0] }
        let v = t.dropFirst(7).dropLast().split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        return v.count == 6 ? v : [1, 0, 0, 1, 0, 0]
    }
    /// The native presented value `elapsed` ms into the native run matching Chrome's run (the first native start from 150 ms
    /// before to 400 ms after Chrome's: the year view's 201 md-button cells take ~230 ms to appear; 700 ms for the calendar
    /// bloom, which follows a native exit run and remounts the 42 day cells): Chrome's value must lie between the two native frames around that time (± tolerance).
    static func motion(_ key: String, _ elapsed: Double, _ webStart: Double, _ web: [Double], _ comps: [Int], _ label: String) {
        let recordKey = key == "monthMenu" ? "monthMenu" : key == "yearMenu" ? "yearMenu" : key
        guard let list = runtime?.motion[recordKey], !list.isEmpty else { check(false, "\(label) \(key) never presented natively"); return }
        guard let start = runtime?.runStarts[recordKey]?.first(where: { $0 - t0 >= webStart - 150 && $0 - t0 <= webStart + (key == "calendar" ? 700 : 400) }) else {
            check(false, "\(label) \(key) no native run near Chrome's start \(Int(webStart))"); return
        }
        let at = start + elapsed
        latencies[key, default: []].append(start - t0 - webStart)
        let before = list.last { $0.t <= at + 0.5 }?.v ?? list.first!.v, after = list.first { $0.t >= at - 0.5 }?.v ?? list.last!.v
        let tol = [0.03, 0.006, 0.35, 2.0]
        let ok = comps.allSatisfy { i in
            let lo = min(before[i], after[i]), hi = max(before[i], after[i])
            return web[i] >= lo - tol[i] && web[i] <= hi + tol[i]
        }
        check(ok, "\(label) \(key) +\(Int(elapsed))ms web \(comps.map { (web[$0] * 1000).rounded() / 1000 }) vs native \(comps.map { (before[$0] * 1000).rounded() / 1000 })…\(comps.map { (after[$0] * 1000).rounded() / 1000 })")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = DPHostingView(rootView: DatePickerStatesFixture(state: state)); window = DPKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); pump(0.3)
        let fixtures = env["AWC_DP_FIXTURES"].map { URL(fileURLWithPath: $0) } ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = env["AWC_DP_STATES_ONLY"]
        // Warm-up, not checked: the first presentation of the dialog sets up its rendering.
        state.node = AWCNode(id: "dp", tag: "md-date-picker", properties: ["variant": "modal", "value": "2025-06-18"]); state.width = 1; state.epoch += 1; pump(0.3)
        runtime?.show(); pump(0.8); runtime?.hide(); pump(0.5); state.events = []
        let files = env["AWC_DP_STATES_REDUCED_ONLY"] != nil ? [("datepicker-web-states-reduced", true)] : [("datepicker-web-states", false), ("datepicker-web-states-reduced", true)]
        #if canImport(UIKit)
        if env["AWC_DP_DEBUG"] != nil {
            for n in [UIResponder.keyboardWillShowNotification, UIResponder.keyboardWillHideNotification, UIResponder.keyboardDidHideNotification] {
                NotificationCenter.default.addObserver(forName: n, object: nil, queue: .main) { note in
                    print("  KB +\(Int(now() - t0)) \(note.name.rawValue) \(String(describing: note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey]))"); fflush(stdout)
                }
            }
        }
        #endif
        for (file, reduced) in files {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ f in f.split(separator: ",").contains { r["name"].string.contains($0) } }) ?? true { run(r, reduced: reduced) }
        }
        if only == nil { yearGridScrolls() }
        if let output = env["AWC_DP_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        for (k, l) in latencies.sorted(by: { $0.key < $1.key }) { let v = l.sorted(); print("motion latency \(k): median \(Int(v[v.count / 2])) ms, max \(Int(v.last ?? 0)) ms (\(v.count) samples)") }
        print("Date picker native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
