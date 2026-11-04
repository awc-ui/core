import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-toolbar interaction against Chrome (states.html, Mac Chrome 153, full and reduced-motion sets): roving in docked,
// floating, RTL and multi-section bars (Tab in, every arrow, wrap, Home/End, off-axis and modified arrows ignored, Tab out
// and back to the remembered stop, Enter), the vertical strip, mixed independent controls, soft-disabled members, opt-out
// and aria-hidden controls, the FAB as its own stop, setFocus(), generic mode, the dynamic re-sync sequence (hide the
// stop, disable, append, generic ↔ toolbar, vertical) and pointer state layers under both schemes and themes: every
// phase's focus, roving stops, focus rings, role and orientation, the focusin / click sequence, and every flat pixel of
// the bar against Chrome's phase screenshot. Raw HTML controls of the oracle have no native node: phases that land on one
// are not replayed.
@Observable final class ToolbarStatesState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    let controller = AWCToolbarController()
    @ObservationIgnored var events: [(name: String, target: String)] = []
}
struct ToolbarStatesFixture: View {
    let state: ToolbarStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        let ids = ["before", "after"] + state.nodes.flatMap { [$0.id] + $0.children.map(\.id) }
        ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: #before sits above the bar and #after below it, as in the DOM.
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 0, y: 0).opacity(0.01)
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in AWCNativeView(node: n) { e in state.events.append((e.name, e.nodeID)) }.frame(maxWidth: .infinity, alignment: .leading) }
                }
                .frame(width: 720, alignment: .topLeading)
            }
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 60, y: 60)
            AWCNativeView(node: AWCNode(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 0, y: 420).opacity(0.01)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .awcToolbarController(state.controller)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeToolbarStatesIntegration {
    static let state = ToolbarStatesState()
    static var host: NSHostingView<ToolbarStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    /// Focus moves are observed as Chrome's focusin: the first responder entering a toolbar child.
    static var lastFocus = "body"
    static func pump(_ d: Double = 0.004) { let end = Date().addingTimeInterval(d); repeat {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002))
        let f = focusedID(); if f != lastFocus { lastFocus = f; if f != "body" { state.events.append(("focusin", f)) } } } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
        }
    }
    static func named(_ k: String, _ flags: NSEvent.ModifierFlags = []) {
        switch k {
        case "Tab": key(48, "\t", flags)
        case "ArrowLeft": key(123, "\u{F702}", flags); case "ArrowRight": key(124, "\u{F703}", flags)
        case "ArrowDown": key(125, "\u{F701}", flags); case "ArrowUp": key(126, "\u{F700}", flags)
        case "Home": key(115, "\u{F729}", flags); case "End": key(119, "\u{F72B}", flags)
        case "Enter": key(36, "\r", flags)
        default: check(false, "unknown key \(k)")
        }
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func tabbable(_ v: AWCNativeButtonFocusView) -> Bool {
        #if canImport(AppKit)
        return v.canBecomeKeyView
        #else
        return v.awcCanBecomeKeyView
        #endif
    }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasPrefix(id + ".")) } }
    static func center(_ id: String) -> CGPoint? { m(id, "toolbar-item").map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func webID(_ active: String) -> String { active == "body" ? "body" : String(active.split(separator: "#").last ?? "") }
    static func edit(_ id: String, _ change: (inout AWCNode) -> Void) {
        state.nodes = state.nodes.map { bar in
            var bar = bar
            if bar.id == id { change(&bar) } else { bar.children = bar.children.map { c in var c = c; if c.id == id { change(&c) }; return c } }
            return bar
        }
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ToolbarGridS {
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
    /// The bar against Chrome's phase screenshot (clipOf(bar, 24)): flat pixels only (glyph and ripple edges excluded).
    static func pixels(_ name: String, _ shotName: String, shots: URL) {
        guard let bar = m("bar1", "md-toolbar"), bar.bounds.width > 0 else { return }
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(shotName + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot \(shotName)"); return }
        let ox = floor(Double(bar.bounds.minX)) - 24, oy = floor(Double(bar.bounds.minY)) - 24
        let cx = Int(floor(Double(bar.bounds.minX))), cy = Int(floor(Double(bar.bounds.minY))), cw = Int(Double(bar.bounds.width)), ch = Int(Double(bar.bounds.height))
        check(abs(Double(src.width) - (Double(cw) + 48)) <= 2 && abs(Double(src.height) - (Double(ch) + 48)) <= 2, "\(name) bar box matches the shot (\(src.width)x\(src.height) vs \(cw)x\(ch) + 48)")
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: ox, y: oy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        if let dir = ProcessInfo.processInfo.environment["AWC_TOOLBAR_STATES_CAPTURE"], let data = NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:]) {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true); try? data.write(to: URL(fileURLWithPath: dir).appendingPathComponent(shotName + ".png"))
        }
        let nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, at = ""
        for py in (cy + 1)..<max(cy + 1, cy + ch - 1) { for px in (cx + 1)..<max(cx + 1, cx + cw - 1) where web.flat(px, py, 6) && nat.flat(px, py, 6) {
            let a = web.at(px, py), b = nat.at(px, py); var d = 0.0; for i in 0..<3 { d = max(d, abs(a[i] - b[i])) }
            n += 1; sum += d; if d > 8 { bad += 1 }; if d > worst { worst = d; at = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" } } }
        check(n > 0 && Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.2, "\(name) flat pixels (mean \(sum / Double(max(n, 1))), >8: \(bad)/\(n), worst \(worst) at \(at))")
    }
    static func snapshot(_ name: String, _ ph: AWCValue, dropped: Set<String>) {
        if ProcessInfo.processInfo.environment["AWC_TOOLBAR_DEBUG"] != nil { print("DBG \(name) \(ph["label"].string) focus \(focusedID()) rings \(all(host).compactMap { $0 as? AWCNativeButtonFocusView }.map { "\($0.accessibilityIdentifier()):\($0.configuration?.handle.isFocusVisible == true ? 1 : 0)\($0.configuration?.handle.isFocused == true ? "f" : "")" })"); fflush(stdout) }
        let lbl = "\(name) \(ph["label"].string)"
        let want = webID(ph["active"].string), got = focusedID()
        check(got == want, "\(lbl) focus \(got) vs \(want)")
        let bar = m("bar1", "md-toolbar")
        let role = ph["role"] == .null ? "generic" : ph["role"].string
        check(bar?.metrics["role"]?.string == role, "\(lbl) role \(bar?.metrics["role"]?.string ?? "-") vs \(role)")
        if role == "toolbar" { check(bar?.metrics["orientation"]?.string == ph["orientation"].string, "\(lbl) orientation \(bar?.metrics["orientation"]?.string ?? "-") vs \(ph["orientation"].string)") }
        for c in ph["children"].array {
            let id = c["id"].string
            if dropped.contains(id) { continue }
            let v = focusView(id)
            if c["hidden"].bool == true { check(v == nil || m(id, "toolbar-item") == nil, "\(lbl) \(id) hidden"); continue }
            guard let v else { check(false, "\(lbl) \(id) focus view"); continue }
            check(tabbable(v) == (c["tabindex"].string == "0" && c["disabled"].bool != true), "\(lbl) \(id) tab stop \(tabbable(v)) vs \(c["tabindex"].string)")
            if c["layer"] != .null {   // md-icon-button: the focus ring shows exactly on the keyboard-focused button
                check((v.configuration?.handle.isFocusVisible ?? false) == (c["ring"].string == "solid"), "\(lbl) \(id) focus ring \(v.configuration?.handle.isFocusVisible ?? false) vs \(c["ring"].string)")
            }
        }
    }
    static func run(_ r: AWCValue, reduced: Bool, shots: URL) {
        let name = (reduced ? "reduced " : "") + r["name"].string
        state.dark = r["theme"].string == "dark"; state.rtl = r["dir"].string == "rtl"; state.reduced = reduced
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(r["nodesJSON"].string.utf8))
        state.events = []; lastFocus = "body"; state.epoch += 1; pump(0.6)
        let dropped = Set(r["dropped"].array.map(\.string)), scenario = r["scenario"].string
        if scenario != "setFocus" && scenario != "pointer" { _ = focusView("before")?.requestNativeFocus(); pump(0.05); state.events = [] }
        var replayed: [String] = []
        let phases = r["phases"].array
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            // A phase whose result is a raw HTML control (no native node) is not replayed.
            if dropped.contains(webID(ph["active"].string)) { report.append(["run": name, "phase": lbl, "skipped": "lands on \(ph["active"].string)"]); continue }
            // The last phase lasts as long as Chrome sampled it (its screenshot ends it), and at least until SwiftUI commits
            // its running animations (the bitmap capture shows a view's committed values, not the in-flight frame).
            let dur = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? 0) - (ph["t"].number ?? 0) : max((ph["frames"].array.last?["t"].number ?? 200) + 17, 320)
            let target = r["target"].string
            switch lbl {
            case "tab", "tab1", "tab2", "tab3", "tab4", "tabOut", "tabToInput": named("Tab")
            case "shiftTab", "shiftTab1", "shiftTab2", "shiftTab3", "shiftTabIn": named("Tab", .shift)
            case _ where lbl.hasPrefix("right"): named(state.rtl ? "ArrowRight" : "ArrowRight")
            case "left", "arrowOnFab": named("ArrowLeft")
            case "downAfterSwitch":
                let ok = state.controller.setFocus(); pump(0.033)
                if ProcessInfo.processInfo.environment["AWC_TOOLBAR_DEBUG"] != nil { let bar = m("bar1", "md-toolbar"); print("DBG setFocus \(ok) focus \(focusedID()) active \(bar?.metrics["activeID"] ?? .null) members \(bar?.metrics["members"] ?? .null) views \(all(host).compactMap { ($0 as? AWCNativeButtonFocusView)?.accessibilityIdentifier() })"); for id in ["b3", "b4", "b5"] { let v = all(host).compactMap { $0 as? AWCNativeButtonFocusView }.filter { $0.accessibilityIdentifier() == id }; print("DBG \(id) views \(v.count) accepts \(v.map(\.acceptsFirstResponder)) keyView \(v.map(\.canBecomeKeyView)) window \(v.map { $0.window != nil }) group \(v.map { $0.configuration?.group.map { ObjectIdentifier($0).hashValue } ?? 0 })") }; fflush(stdout) }
                named("ArrowDown")
            case _ where lbl.hasPrefix("down"): named("ArrowDown")
            case "up", "upWrap": named("ArrowUp")
            case "home": named("Home"); case "end": named("End")
            case "shiftRight": named("ArrowRight", .shift)
            case "enter": named("Enter")
            case "enterOnSoft": named("Home"); pump(0.02); named("Enter")
            case "setFocus", "setFocusAgain": state.controller.setFocus()
            case "blur": _ = window.makeFirstResponder(nil)
            case "hideActive": edit("b2") { $0.properties["hidden"] = true }
            case "disableFirst": edit("b1") { $0.properties["disabled"] = true }
            case "append": edit("bar1") { $0.children.append(AWCNode(id: "b5", tag: "md-icon-button", properties: ["icon": "add", "aria-label": "add"])) }
            case "toGeneric": edit("bar1") { $0.properties["containerSemantics"] = "generic" }
            case "toToolbar": edit("bar1") { $0.properties["containerSemantics"] = "toolbar" }
            case "toVertical": edit("bar1") { $0.properties["variant"] = "floating"; $0.properties["layout"] = "vertical" }
            case "restore": edit("b2") { $0.properties["hidden"] = false }; edit("b1") { $0.properties["disabled"] = false }
            case "hover": if let p = center(target) { state.pointer.update(phase: .move, location: p) }
            case "press": if let p = center(target) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
            case "release": if let p = center(target) { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
            case "leave": state.pointer.update(phase: .leave)
            default: check(false, "\(name) unknown phase \(lbl)")
            }
            replayed.append(lbl)
            pump(max(0.15, dur / 1000 - 0.02))
            snapshot(name, ph, dropped: dropped)
            // Pixels only where every oracle control has a native node (a dropped control leaves a gap in Chrome's shot).
            if dropped.isEmpty { pixels("\(name) \(lbl)", r["name"].string + "-" + lbl, shots: shots) }
        }
        // focusin / click sequence (Web click = mdClick natively), without events on raw HTML controls.
        let web = r["events"].array.filter { !dropped.contains($0["target"].string) }.map { "\($0["name"].string == "click" ? "mdClick" : $0["name"].string)@\($0["target"].string)" }
        let native = state.events.filter { ["focusin", "mdClick"].contains($0.name) && !["before", "after", "bar1"].contains($0.target) }.map { "\($0.name)@\($0.target)" }
        check(native == web, "\(name) events \(native) vs \(web)")
        report.append(["run": name, "phases": replayed])
        print("RUN \(name): \(checks - failures.count)/\(checks) cumulative"); fflush(stdout)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        #if canImport(AppKit)
        let screen = NSScreen.main?.frame ?? .init(x: 0, y: 0, width: 1440, height: 900)
        #else
        let screen = CGRect(x: 0, y: 0, width: 1440, height: 900)
        #endif
        host = NSHostingView(rootView: ToolbarStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        #if canImport(AppKit)
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        #endif
        window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_TOOLBAR_ONLY"]
        for (file, reduced, shots) in [("toolbar-web-states", false, "toolbar-web-states"), ("toolbar-web-states-reduced", true, "toolbar-web-states-reduced")] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reduced: reduced, shots: fixtures.appendingPathComponent(shots)) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_TOOLBAR_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Toolbar native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
struct ToolbarGridS {
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
