import AppKit
import SwiftUI
@testable import AWCUI

// md-transfer-list interaction states against Chrome 153 (web-oracle states.json + states-reduced-motion.json, slimmed to
// Tests/Fixtures/transferlist-web-states.json = Android assets TransferListWebStates.json; 10 runs): pointer (LTR/RTL),
// keyboard (the page's button, both columns, the movers, Space/Enter, Shift+Tab), search (typing, select-all of the visible
// rows, Escape, the clear button, a move with a hidden checked row), single-step-only, disabled, programmatic (methods,
// controlled value/items, count template), stacked (≤ 640) and reduced motion. The oracle's input timeline (trusted pointer and
// key events) is replayed at Chrome's times on a virtual frame clock (Chrome's 16.667 ms frames; real-time pumps between
// frames let AppKit settle); property sets and method calls go in at their phase start; a press outside every focusable part
// blurs as the page body takes it. Per phase the settled sample must match (value, rows: label/checked/background/ring,
// counts, select-all, queries, empty texts, movers, the focused part); every Chrome frame must match, group by group (value,
// rows, row backgrounds, rings, counts, select-all, queries, empty texts, movers, focus), a native frame within one frame
// either side (Chrome samples in rAF before Stencil re-renders: a property is new before its rows, which may trail by two
// frames after a nested control's event; a row's background within the native row's values over those frames); events by
// order, phase and payload.

@Observable final class TransferStatesState {
    var run: AWCValue = .null
    var epoch = 0
    var props: [String: AWCValue] = [:]
}
/// The page's first control at the top-left and its last at the bottom, on the screen of a narrow window too: the iPad focus system enters Tab at the first control it finds by position, and cannot enter a view off the screen (the tab order stays top row / list / bottom row).
let pageStopX: CGFloat = 780
let pageStartX: CGFloat = 0
struct TransferStatesFixture: View {
    let state: TransferStatesState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        let stacked = r["viewport"] != .null
        return ZStack(alignment: .topLeading) {
            // The page's Run button (first in the Tab order; AppKit orders the key-view loop geometrically) and the page's end.
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("b")])).frame(width: 40, height: 16).offset(x: pageStartX, y: 0)
            if r != .null {
                AWCNativeView(node: .init(id: "tl", tag: "md-transfer-list", properties: state.props)) { e in
                    if e.name == "mdChange" || e.name == "mdMove" { NativeTransferListStatesIntegration.events.append((e.name, e.detail, NativeTransferListStatesIntegration.chromeNow())) }
                    // The page writes the next value back (the source's controlled value), so later property sets keep it.
                    if e.name == "mdChange" { state.props["value"] = e.detail } }
                    .awcTransferListViewport(stacked ? 500 : 1200)
                    .frame(width: stacked ? 460 : 900, alignment: .topLeading)
                    .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                    .awcNativeInspection(rootID: "tl", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { NativeTransferListStatesIntegration.measurements = $0 } }
                    .offset(x: 24, y: 24)
            }
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("a")])).frame(width: 40, height: 16).offset(x: pageStopX, y: 880)
        }
        .environment(\.awcTransferListInspector, { NativeTransferListStatesIntegration.probe = $0 })
        .environment(\.awcTransferListReducedMotion, r["reduced"].bool == true)
        .environment(\.awcTransferListClock, NativeTransferListStatesIntegration.clock)
        .awcTransferListController(NativeTransferListStatesIntegration.controller, for: "tl")
        .awcTheme(theme)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeTransferListStatesIntegration {
    static let state = TransferStatesState()
    static var host: NSHostingView<TransferStatesFixture>!, window: NSWindow!
    static var probe: AWCTransferListProbe?
    static var clock = AWCTransferListClock()
    static let controller = AWCTransferListController()
    static var events: [(String, AWCValue, Double)] = []
    static var c0 = 0.0
    static let debugMovers = ProcessInfo.processInfo.environment["AWC_TRANSFER_DEBUG"] != nil
    static var moverFrames: [String] = []
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = [], exceptions: Set<String> = []
    static func chromeNow() -> Double { clock.now - c0 }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouseEvent(_ kind: NSEvent.EventType, _ p: CGPoint) -> NSEvent {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        return NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!
    }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        // A press goes through NSApp (local mouse monitors run, as for a real click: a disabled list's press focuses its scroller).
        if kind == .leftMouseDown { NSApp.sendEvent(mouseEvent(kind, p)) } else { window.sendEvent(mouseEvent(kind, p)) }
    }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            // NSApp's local key monitors (AWCKeyViewGroup's Tab routing) run before the window gets the key; sendEvent on the window skips them.
            if type == .keyDown && AWCKeyViewGroup.handle(e) { continue }
            window.sendEvent(e) }
    }
    static let letters: [Character: UInt16] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17,
                                               "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46]
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    /// The focused part as the oracle names it.
    /// iOS debugging (AWC_TRANSFER_DEBUG): the movers' focus views — first responder, policy flags.
    static func moverDebug() -> String {
        #if canImport(UIKit)
        func walk(_ v: UIView) -> [String] {
            var out: [String] = []
            if let b = v as? AWCNativeButtonFocusView, let c = b.configuration, c.id.contains("-move-") {
                out.append("\(c.id) fr=\(b.isFirstResponder) cbfr=\(b.canBecomeFirstResponder) retain=\(c.policy.retainsFocusWhenDisabled) prog=\(c.policy.programmaticallyFocusable) win=\(b.window != nil)")
            }
            for c in v.subviews { out += walk(c) }
            return out
        }
        return walk(host).joined(separator: " | ")
        #else
        return ""
        #endif
    }
    static func focusKind() -> String {
        let r = window.firstResponder
        // A text field or its field editor (iOS: the UIKit text field; the parity host has no NSText).
        if let r, "\(type(of: r))".contains("Text") { return "search" }
        guard let v = r as? NSView else { return "body" }
        let id = v.accessibilityIdentifier()
        if id == "before" { return "button" }; if id == "after" { return "body" }
        if id.hasPrefix("tl/") { return "item" }; if id.contains("-move-all-") { return "mover-tonal" }; if id.contains("-move-") { return "mover-filled" }
        if id.contains("-all-") { return "select-all" }; if id.contains("-list-") { return "list" }
        if id.contains("-search-") { return "search" }
        return v === host || v === window.contentView ? "body" : "\(type(of: v)):\(id)"
    }
    static func chromeFocus(_ path: [AWCValue]) -> String {
        let parts = path.map(\.string); guard let first = parts.first else { return "body" }
        if first == "body" { return "body" }; if first == "button" { return "button" }
        let last = parts.last!
        if last == "item" { return "item" }; if last == "list" { return "list" }; if last.hasPrefix("md-transfer-list__select-all") { return "select-all" }
        if parts.contains("search") { return "search" }; if last.hasPrefix("md-icon-button") { return "mover-" + (last.contains("--tonal") ? "tonal" : "filled") }
        return parts.count == 1 ? "body" : last
    }
    /// Chrome's colours (rgba(), color(srgb …), oklab(…)) as premultiplied sRGB + alpha.
    static func chromeColor(_ s: String) -> [Double] {
        let n = s.split(whereSeparator: { "(), /".contains($0) }).compactMap { Double($0) }
        var rgba: [Double]
        if s.hasPrefix("oklab") { rgba = AWCTransferListTrack.srgb([n[0] * (n.count > 3 ? n[3] : 1), n[1] * (n.count > 3 ? n[3] : 1), n[2] * (n.count > 3 ? n[3] : 1), n.count > 3 ? n[3] : 1]); return rgba }
        if s.hasPrefix("color(srgb") { rgba = [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] } else { rgba = [n[0] / 255, n[1] / 255, n[2] / 255, n.count > 3 ? n[3] : 1] }
        return [rgba[0] * rgba[3], rgba[1] * rgba[3], rgba[2] * rgba[3], rgba[3]]
    }
    static func same(_ a: [Double], _ b: [Double]) -> Bool { zip(a, b).allSatisfy { abs($0 - $1) <= 0.008 } }
    static func attr(_ html: String, _ name: String) -> String? {
        guard let i = html.range(of: "<md-transfer-list") else { return nil }
        let tag = String(html[i.lowerBound...].prefix { $0 != ">" })
        for q in ["'", "\""] { if let r = tag.range(of: " " + name + "=" + q) { let rest = tag[r.upperBound...]; return String(rest.prefix { String($0) != q }) } }
        return tag.range(of: " " + name + "( |$)", options: .regularExpression) != nil ? "" : nil
    }
    static func initialProps(_ r: AWCValue) -> [String: AWCValue] {
        let html = r["html"].string; var p: [String: AWCValue] = ["value": .array([.string("e"), .string("f")])]
        if let items = attr(html, "items") { p["items"] = .string(items.replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&quot;", with: "\"")) }
        if attr(html, "disabled") != nil { p["disabled"] = true }
        if attr(html, "single-step-only") != nil { p["singleStepOnly"] = true }
        return p
    }
    static func run(_ r: AWCValue) {
        let name = (r["reduced"].bool == true ? "reduced/" : "") + r["name"].string
        mouse(.mouseMoved, CGPoint(x: 1190, y: 890)); probe = nil; events = []; moverFrames = []
        state.run = r; state.props = initialProps(r); state.epoch += 1; clock = AWCTransferListClock(); pump(0.4)
        for _ in 0..<20 { clock.tick(); pump(0.004) }
        _ = window.makeFirstResponder(nil); pump(0.05)
        c0 = clock.now
        let phases = r["phases"].array, inputs = r["inputs"].array
        let parts = Dictionary((probeParts()), uniquingKeysWith: { a, _ in a })
        let hostRect = parts.filter { $0.key.hasPrefix("column-") || $0.key == "controls" }.values.reduce(CGRect.null) { $0.union($1) }
        func focusablePart(_ q: CGPoint) -> Bool { probeParts().contains { ($0.0.hasPrefix("item-") || $0.0.hasPrefix("search-") || $0.0 == "controls" || $0.0.hasPrefix("header-")) && $0.1.contains(q) } }
        func disabledMover(_ q: CGPoint) -> Bool { measurements.contains { $0.id.hasPrefix("component.mover-") && $0.bounds.contains(q) && $0.metrics["disabled"]?.bool == true } }
        func row(_ q: CGPoint) -> (Bool, String)? { probeParts().first { $0.0.hasPrefix("item-") && $0.1.contains(q) }.map { k, _ in let key = k.dropFirst(5); return (key.hasPrefix("t:"), String(key.dropFirst(2))) } }
        var acts: [(Double, Int, () -> Void)] = []
        var shift = false, releasedEarly = false, lastPointer = CGPoint(x: 1190, y: 890)
        // Keys less than a frame apart (the oracle's nine Shift+Tabs in 15 ms) go in together, at the last one's time: Chrome's
        // own samples show the burst land within one frame, whatever the events' timestamps (CDP stamps them before dispatch).
        var due = inputs.map { $0["t"].number ?? 0 }
        var b0 = 0
        while b0 < inputs.count { var j = b0
            while j + 1 < inputs.count, inputs[j]["type"].string == "keydown", inputs[j + 1]["type"].string == "keydown", due[j + 1] - due[j] < 1000.0 / 60 { j += 1 }
            if j > b0 { for k in b0...j { due[k] = due[j] } }
            b0 = j + 1 }
        for (i, e) in inputs.enumerated() {
            let q = CGPoint(x: e["x"].number ?? 0, y: e["y"].number ?? 0)
            acts.append((due[i], i, {
                switch e["type"].string {
                case "pointermove": lastPointer = q; mouse(.mouseMoved, q); if let rw = row(q) { probe?.hover(rw.0, rw.1) } else { probe?.hover(false, nil) }
                case "pointerdown":
                    if !hostRect.contains(q) || !focusablePart(q) || disabledMover(q) { _ = window.makeFirstResponder(nil) }
                    // A press on a text field enters AppKit's text tracking loop until the release: post the release first.
                    if probeParts().contains(where: { $0.0.hasPrefix("search-") && $0.1.contains(q) }) { NSApp.postEvent(mouseEvent(.leftMouseUp, q), atStart: false); releasedEarly = true }
                    mouse(.leftMouseDown, q)
                case "pointerup": if releasedEarly { releasedEarly = false } else { mouse(.leftMouseUp, q) }
                case "keydown":
                    let k = e["key"].string
                    if k == "Shift" { shift = true; return }
                    let flags: NSEvent.ModifierFlags = shift ? [.shift] : []; shift = false
                    switch k {
                    case "Tab":
                        // The page's end button stands for Chrome's forward wrap stop (the document); Chrome's backward wrap from the
                        // page's first control goes straight to the last one, so a Shift+Tab that lands on the end button goes on.
                        let fromFirst = flags.contains(.shift) && focusKind() == "button"
                        let fromEnd = !flags.contains(.shift) && (window.firstResponder as? NSView)?.accessibilityIdentifier() == "after"
                        key(48, "\t", flags)
                        var wraps = 0
                        while fromFirst && focusKind() == "body" && wraps < 2 { pump(0.01); key(48, "\t", flags); wraps += 1 }
                        // UIKit's loop leaves the page after the end button (Chrome's document stop); Chrome's next Tab enters at the
                        // first control.
                        if fromEnd && window.firstResponder.map({ !($0 is NSView) || ($0 as! NSView) === host }) ?? true { pump(0.01); key(48, "\t", flags) }
                    case " ": key(49, " ", flags)
                    case "Enter": key(36, "\r", flags)
                    case "Escape": key(53, "\u{1b}", flags)
                    case "ArrowDown": key(125, "\u{F701}", flags)
                    default: if k.count == 1, let c = k.first, let code = letters[c] { key(code, k, flags) }
                    }
                default: break
                }
            }))
        }
        for ph in phases {
            let t = ph["t"].number ?? 0
            let set: (() -> Void)? = switch ph["label"].string {
            case "set-single-step-false": { state.props["singleStepOnly"] = false }
            case "enable": { state.props["disabled"] = false }
            case "set-value-controlled": { state.props["value"] = .array([.string("b")]) }
            case "set-items-controlled": { state.props["items"] = .array([.object(["value": "b", "label": "Billing"]), .object(["value": "z", "label": "Zeta"])]) }
            case "set-count-template": { state.props["countTemplate"] = "{checked} of {total} ({checked})" }
            case "moveSelectedRight()": { controller.moveSelectedRight() }
            case "moveSelectedLeft()-nothing-checked": { controller.moveSelectedLeft() }
            default: nil
            }
            if let set { acts.append((t, -1, { set(); pump(0.03); if let rw = row(lastPointer) { probe?.hover(rw.0, rw.1) } else { probe?.hover(false, nil) } })) }
        }
        acts.sort { $0.0 != $1.0 ? $0.0 < $1.0 : $0.1 < $1.1 }
        let end = (phases.last?["samples"].array.last?["t"].number ?? 0) + 40
        var frames: [(Double, AWCTransferListSnapshot?, String)] = [], trails: [[String]] = []
        var ai = 0
        while chromeNow() < end {
            // Real-time pumps let AppKit / SwiftUI deliver an input (gestures, text input, child events) before the frame; the
            // virtual clock does not move meanwhile.
            // The focused part after each input before this frame (a burst passes through several within one frame).
            var trail: [String] = []
            while ai < acts.count && acts[ai].0 <= chromeNow() + (acts[ai].1 >= 0 ? 1000.0 / 60 - 0.5 : 0.5) { acts[ai].2(); pump(acts[ai].1 >= 0 ? 0.06 : 0.012); trail.append(focusKind()); ai += 1 }
            trails.append(trail)
            clock.tick(); pump(0.004)
            frames.append((chromeNow(), probe?.snapshot(), focusKind()))
            if debugMovers { moverFrames.append(moverDebug()) }
        }
        func nativeAt(_ t: Double) -> Int { frames.indices.min { abs(frames[$0].0 - t) < abs(frames[$1].0 - t) }! }
        var settledFails = 0, motion = 0, motionFails = 0
        for (pi, ph) in phases.enumerated() {
            let samples = ph["samples"].array, tag = "\(name)/\(pi):\(ph["label"].string)"
            for (si, s) in samples.enumerated() {
                let settled = si == samples.count - 1, idx = nativeAt(s["t"].number ?? 0)
                // What one native frame differs in, by group. A settled sample must match in every group at its own frame. A motion
                // sample must match, group by group, a native frame within one frame either side: Chrome's sample is read in rAF,
                // before Stencil re-renders, so for one frame a property (value, the query, a check) is already new while the rows
                // are still the old ones; native state and rows change in the same frame. The focused part may also be one the
                // replay passes through between those frames (a key burst).
                func groups(_ n: Int) -> [(String, [String])] {
                    guard let snap = frames[n].1 else { return [("snapshot", ["no snapshot"])] }
                    var out: [(String, [String])] = []
                    let value = s["value"].array.map(\.string); out.append(("value", value != snap.value ? ["value \(value) vs \(snap.value)"] : []))
                    for (sideName, side) in [("source", snap.source), ("target", snap.target)] {
                        let w = s[sideName], rows = w["rows"].array
                        var ident: [String] = [], bg: [String] = [], ring: [String] = []
                        if rows.count != side.rows.count { ident.append("\(sideName) rows \(rows.count) vs \(side.rows.count)"); bg = ident; ring = ident }
                        else { for (i, rw) in rows.enumerated() { let cells = rw.array, nr = side.rows[i]
                            if cells[0].string != nr.label || (cells[1].string == "true") != nr.checked { ident.append("\(sideName) row \(i) \(cells[0].string) \(cells[1].string) vs \(nr.label) \(nr.checked)") }
                            if !same(chromeColor(cells[2].string), nr.background) { bg.append("\(sideName) row \(i) background \(cells[2].string) vs \(nr.background.map { String(format: "%.3f", $0) })") }
                            if (cells[3] != .null) != nr.ring { ring.append("\(sideName) row \(i) ring \(cells[3] != .null) vs \(nr.ring)") } } }
                        out.append((sideName + ".rows", ident)); out.append((sideName + ".background", bg)); out.append((sideName + ".ring", ring))
                        out.append((sideName + ".count", w["count"].string != side.count ? ["\(sideName) count '\(w["count"].string)' vs '\(side.count)'"] : []))
                        let sa: [Bool]? = w["selectAll"] == .null ? nil : w["selectAll"].array.map { $0.bool == true }
                        out.append((sideName + ".select-all", sa != side.selectAll ? ["\(sideName) select-all \(String(describing: sa)) vs \(String(describing: side.selectAll))"] : []))
                        let query: String? = w["query"] == .null ? nil : w["query"].string
                        out.append((sideName + ".query", query != side.query ? ["\(sideName) query '\(query ?? "nil")' vs '\(side.query ?? "nil")'"] : []))
                        let empty: String? = w["empty"] == .null ? nil : w["empty"].string.trimmingCharacters(in: .whitespaces)
                        out.append((sideName + ".empty", empty != side.empty ? ["\(sideName) empty '\(empty ?? "nil")' vs '\(side.empty ?? "nil")'"] : []))
                    }
                    let movers = s["movers"].array.map { $0.array }
                    out.append(("movers", movers.map({ $0[0].string }) != snap.movers || movers.map({ $0[1].bool == true }) != snap.moversDisabled ? ["movers \(movers.map { "\($0[0].string):\($0[1].bool == true)" }) vs \(zip(snap.movers, snap.moversDisabled).map { "\($0):\($1)" })"] : []))
                    let cf = chromeFocus(s["focus"].array)
                    out.append(("focus", cf != frames[n].2 ? ["focus \(cf) vs \(frames[n].2)"] : []))
                    return out
                }
                func bad(_ n: Int) -> [String] { groups(n).flatMap { $0.1 } }
                func motionBad() -> [String] {
                    let window = [idx - 1, idx, idx + 1].filter { frames.indices.contains($0) }
                    // What the oracle reads from the DOM (rows, counts, select-all, empty texts, movers, rings) trails the property by up to
                    // two frames: the sample precedes the frame's Stencil render, and a nested control's event (the search field's
                    // mdInput) reaches the list a task later; the native list updates in the frame of the input.
                    let domWindow = ([idx - 2].filter { frames.indices.contains($0) }) + window
                    let all = window.map(groups), allDom = domWindow.map(groups), mine = groups(idx)
                    guard !allDom.contains(where: { $0.first?.0 == "snapshot" }) else { return ["no snapshot"] }
                    let cf = chromeFocus(s["focus"].array)
                    // A row's background (rows by label): the value Chrome shows lies within the native row's values over those frames
                    // (a transition Chrome starts between two frames, on a forced style recalc, runs a fraction of a frame ahead).
                    func backgroundsWithin(_ sideName: String) -> Bool {
                        for rw in s[sideName]["rows"].array {
                            let cells = rw.array, web = chromeColor(cells[2].string)
                            let natives = domWindow.compactMap { n -> [Double]? in
                                guard let snap = frames[n].1 else { return nil }
                                return (sideName == "target" ? snap.target : snap.source).rows.first { $0.label == cells[0].string }?.background }
                            guard !natives.isEmpty else { return false }
                            // A row that has left the native list by this frame: Chrome's sampled DOM still holds it for the frame before
                            // its re-render (its transition runs on); there is no native row to compare.
                            if let now = frames[idx].1, !(sideName == "target" ? now.target : now.source).rows.contains(where: { $0.label == cells[0].string }) { continue }
                            for c in 0..<4 { let lo = natives.map { $0[c] }.min()!, hi = natives.map { $0[c] }.max()!
                                if web[c] < lo - 0.008 || web[c] > hi + 0.008 { return false } }
                        }
                        return true
                    }
                    var out: [String] = []
                    for (g, group) in mine.enumerated() where !group.1.isEmpty {
                        let name = group.0, dom = name == "movers" || [".rows", ".count", ".select-all", ".empty", ".ring"].contains { name.hasSuffix($0) }
                        if (dom ? allDom : all).contains(where: { $0[g].1.isEmpty }) { continue }
                        if name == "focus", window.contains(where: { trails[$0].contains(cf) }) || (window.last.map { $0 + 1 < trails.count && trails[$0 + 1].contains(cf) } ?? false) { continue }
                        if name.hasSuffix(".background"), backgroundsWithin(String(name.dropLast(".background".count))) { continue }
                        out += group.1
                    }
                    return out
                }
                if settled { let b = bad(idx); check(b.isEmpty, "\(tag) settled: \(b.joined(separator: "; ").prefix(400))"); if !b.isEmpty { settledFails += 1 }
                    if !b.isEmpty, ProcessInfo.processInfo.environment["AWC_TRANSFER_DEBUG"] != nil { print("DBG \(tag) \(moverFrames.indices.contains(idx) ? moverFrames[idx] : "-")") } }
                else { motion += 1; let best = motionBad()
                    if !best.isEmpty { motionFails += 1; if motionFails <= 12 { failures.append("\(tag) t=\(String(format: "%.1f", s["t"].number ?? 0)): \(best.joined(separator: "; ").prefix(300))"); print("FAIL: \(failures.last!)") } } }
            }
        }
        checks += 1; if motionFails > 0 { failures.append("\(name) motion \(motionFails)/\(motion) frames differ") }
        let web = r["events"].array
        func phaseOf(_ t: Double) -> Int { phases.lastIndex { ($0["t"].number ?? 0) <= t + 0.5 } ?? -1 }
        check(web.map { $0["name"].string } == events.map(\.0), "\(name) events \(web.map { $0["name"].string }) vs \(events.map(\.0))")
        for (i, e) in web.enumerated() where i < events.count {
            let n = events[i]
            check(e["detail"] == n.1 && phaseOf(e["t"].number ?? 0) == phaseOf(n.2), "\(name) event \(i) \(e["name"].string) \(e["detail"]) @\(phaseOf(e["t"].number ?? 0)) vs \(n.1) @\(phaseOf(n.2))")
        }
        if debugMovers { for (i, e) in web.enumerated() where i < events.count { print("DBG event \(name) \(e["name"].string) chrome \(String(format: "%.1f", e["t"].number ?? 0)) native \(String(format: "%.1f", events[i].2))") } }
        print("RUN \(name): phases \(phases.count), settled fails \(settledFails), motion \(motion - motionFails)/\(motion), events \(events.count)/\(web.count)"); fflush(stdout)
        report.append(["run": name, "phases": phases.count, "settledFails": settledFails, "motion": motion, "motionFails": motionFails, "events": "\(events.count)/\(web.count)"])
    }
    /// The renderer's inspection parts (window coordinates): `item-s:<value>`, `search-source`, `controls`, `column-*`…
    static func probeParts() -> [(String, CGRect)] { measurements.compactMap { m in m.id.hasPrefix("component.") ? (String(m.id.dropFirst(10)), m.bounds) : nil } }
    static var measurements: [AWCNativeInspectionNode] = []
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: TransferStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("transferlist-web-states.json")))
        let only = ProcessInfo.processInfo.environment["AWC_TRANSFER_STATES_ONLY"]
        for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r) }
        if let output = ProcessInfo.processInfo.environment["AWC_TRANSFER_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report, "exceptions": exceptions.sorted()], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        if !exceptions.isEmpty { print("Recorded exceptions: \(exceptions.sorted())") }
        print("Transfer list native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
