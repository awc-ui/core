import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-menu family interactions against Chrome 153 (menu-states.html: 26 runs, full and reduced motion). Each run is replayed
// with trusted AppKit input (mouse moves/presses into the hosting window, key events to the first responder): open /
// close motion per frame (opacity, scaleY and surface box within the ±2-frame envelope), md* events (order, target and
// time), and at every phase end: open/closing menus, the focused element, every row's state layer, anchor and submenu
// row expanded state, checkbox/radio selection, and the flat pixels of the phase screenshot.
// Shared with NativeMenuPaintIntegration (each fixture compiles alone).
struct MenuAnchorView: View {
    let node: AWCNode, theme: AWCTheme
    var body: some View {
        let t = theme.tokens
        Text(node.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size: 14, weight: 500)).lineLimit(1).fixedSize()
            .foregroundStyle(Color(awcHex: t["--md-sys-color-on-surface"] ?? "#1D1B20"))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Capsule().fill(Color(awcHex: t["--md-sys-color-surface"] ?? "#FEF7FF")))
            .overlay(Capsule().strokeBorder(Color(awcHex: t["--md-sys-color-outline"] ?? "#79747E"), lineWidth: 1))
    }
}
enum MenuPaintFixture {
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func nodes(_ c: AWCValue) -> [AWCNode] {
        c["nodes"].array.compactMap { v in (try? JSONEncoder().encode(v)).flatMap { try? JSONDecoder().decode(AWCNode.self, from: $0) } }
    }
    static func ids(_ n: AWCNode) -> [String] { [n.id] + n.children.flatMap(ids) }
}
struct MenuGrid {
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
enum NativeMenuPaintIntegration {
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> MenuGrid {
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
    static func d(_ r: CGRect?) -> String { r.map { String(format: "(%.2f,%.2f,%.2f,%.2f)", $0.minX, $0.minY, $0.width, $0.height) } ?? "nil" }
}
@Observable final class MenuStatesState {
    var c: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var registry = AWCMenuRegistry()
    var pointer = AWCNativePointerState()
}
struct MenuStatesAnchor: View {
    let id: String, text: String, theme: AWCTheme, open: (Bool) -> Void
    @State private var focus = AWCButtonFocusHandle()
    var body: some View {
        MenuAnchorView(node: .init(id: id, tag: "#anchor", properties: ["text": .string(text)]), theme: theme)
            .overlay { MenuStatesClickCatcher(down: { _ = focus.requestPointerFocus?() }, up: { open(false) }) }
            .background { AWCNativeButtonFocusBridge(configuration: .init(id: id, label: text, policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil,
                                                                          handle: focus, focusChanged: { _ in }, activate: { open(true) })) }
            .awcMenuAnchor(id, focus: { focus.requestFocus?() ?? false })
    }
}
#if canImport(AppKit)
final class MenuStatesClickView: NSView {
    var down: () -> Void = {}, up: () -> Void = {}
    override func mouseDown(with event: NSEvent) { down() }
    override func mouseUp(with event: NSEvent) { if bounds.contains(convert(event.locationInWindow, from: nil)) { up() } }
}
#else
/// iOS host (parity harness): the shim delivers the fixture's mouse events as touches.
final class MenuStatesClickView: UIView {
    var down: () -> Void = {}, up: () -> Void = {}
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) { down() }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) { if let p = touches.first?.location(in: self), bounds.contains(p) { up() } }
}
#endif
struct MenuStatesClickCatcher: NSViewRepresentable {
    let down: () -> Void, up: () -> Void
    func makeNSView(context: Context) -> MenuStatesClickView { let v = MenuStatesClickView(); v.down = down; v.up = up; return v }
    func updateNSView(_ v: MenuStatesClickView, context: Context) { v.down = down; v.up = up }
}
struct MenuStatesFixture: View {
    let state: MenuStatesState
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let c = state.c, epoch = state.epoch, registry = state.registry
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let vp = c["viewport"].array.map { CGFloat($0.number ?? 0) }
        let box = MenuPaintFixture.rect(c["box"]), anchor = MenuPaintFixture.rect(c["anchor"])
        let rtl = c["dir"].string == "rtl"
        let nodes = MenuPaintFixture.nodes(c)
        var menuOf: [String: String] = [:]
        for m in nodes where m.tag == "md-menu" { if let a = m.properties["anchor"]?.string, !a.isEmpty, menuOf[a] == nil { menuOf[a] = m.id } }
        func open(_ anchorID: String, keyboard: Bool) { if let m = menuOf[anchorID] { registry.controllers[m]?.show(keyboard: keyboard) } }
        var lefts: [String: CGFloat] = [:]; var x = anchor.maxX
        for e in c["extraAnchors"].array { x += CGFloat(e["margin"].number ?? 0); lefts[e["id"].string] = x; x += MenuStatesFixture.anchorWidth(e["text"].string) }
        return AWCMenuScope(registry: registry) {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FEF7FF").frame(maxWidth: .infinity, maxHeight: .infinity)
                MenuStatesAnchor(id: "a", text: nodes.first { $0.id == "a" }?.properties["text"]?.string ?? "Edit", theme: theme) { open("a", keyboard: $0) }
                    .frame(width: anchor.width, height: anchor.height).padding(.leading, anchor.minX).padding(.top, anchor.minY)
                ForEach(c["extraAnchors"].array.map { ($0["id"].string, $0["text"].string, $0["margin"].number ?? 0) }, id: \.0) { a in
                    let left: CGFloat = lefts[a.0] ?? 0
                    MenuStatesAnchor(id: a.0, text: a.1, theme: theme) { open(a.0, keyboard: $0) }
                        .frame(width: MenuStatesFixture.anchorWidth(a.1), height: anchor.height).padding(.leading, left).padding(.top, anchor.minY)
                }
                ForEach(nodes.filter { $0.tag == "md-menu" }) { n in
                    AWCNativeView(node: n, onEvent: onEvent).fixedSize()
                        .frame(width: box.width, alignment: rtl ? .topTrailing : .topLeading)
                        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                        .padding(.leading, box.minX).padding(.top, box.minY)
                }
            }
        }
        .awcMenuReducedMotion(state.reduced)
        .environment(\.awcNativePointerState, state.pointer)
        .awcTheme(theme)
        .awcNativeInspection(rootID: nodes.flatMap(MenuPaintFixture.ids).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: vp.first ?? 1200, height: vp.last ?? 900, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
    /// `.anchor` buttons: 500 14px Roboto, 8/16 padding, 1px border.
    static func anchorWidth(_ text: String) -> CGFloat { CGFloat(awcMenuTextWidth(text, size: 14, weight: 500) + 34) }
}
struct MenuSample { var t: Double; var menus: [(open: Bool, closing: Bool, opacity: Double, scaleY: Double, rect: CGRect)]; var focus: String; var layers: [Double]; var anchorExpanded: String; var rowExpanded: String?; var selected: [Bool] }
@main @MainActor enum NativeMenuStatesIntegration {
    static let state = MenuStatesState()
    static var host: MenuFirstMouseHost<MenuStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var events: [(name: String, t: Double, node: String)] = []
    static var shotIndices: [Int] = []
    static var t0 = 0.0
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 - t0 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(CGPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!
        switch kind { case .leftMouseDown: state.pointer.update(phase: .down, location: p); case .leftMouseUp: state.pointer.update(phase: .up, location: p); default: state.pointer.update(phase: .move, location: p) }
        NSApp.postEvent(e, atStart: false); pump(0.001)
    }
    static let codes: [String: (UInt16, String)] = ["ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"), "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}"),
                                                    "Escape": (53, "\u{1B}"), "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Tab": (48, "\t"), "Enter": (36, "\r"), " ": (49, " ")]
    static let letterCodes: [Character: UInt16] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
                                                   "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46]
    static func key(_ k: String, shift: Bool) {
        // Letters carry their ANSI virtual key code: the iOS harness replays key codes as HID keyboard usages.
        let (code, text) = codes[k] ?? ((k.count == 1 ? letterCodes[Character(k.lowercased())] : nil) ?? 0, k)
        let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil,
                                 characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
        // The offscreen borderless test window is never the key window: key events go to its first responder directly.
        window.sendEvent(e)
    }
    static var nodes: [AWCNode] = []
    static func flat(_ n: AWCNode) -> [AWCNode] { [n] + n.children.flatMap(flat) }
    static var all: [AWCNode] { nodes.flatMap(flat) }
    /// md-menu-motion metrics are published by the motion wrapper under the menu's node id (name "md-menu-motion").
    static func motionMetrics(_ id: String) -> [String: AWCValue]? { state.measurements.first { $0.id == id + ":component.motion" }?.metrics }
    static func m(_ id: String, _ part: String? = nil) -> AWCNativeInspectionNode? { state.measurements.first { $0.id == id + ":component" + (part.map { "." + $0 } ?? "") } }
    /// Web target names: "#a", a headline, "#row".
    static func center(_ target: String) -> CGPoint? {
        if target.hasPrefix("#") {
            let id = String(target.dropFirst())
            if let n = all.first(where: { $0.properties["htmlId"]?.string == id }), let r = m(n.id)?.bounds { return .init(x: r.midX, y: r.midY) }
            if let r = state.registry.anchors[id] { return .init(x: r.midX, y: r.midY) }
            return nil
        }
        guard let n = all.first(where: { ($0.tag == "md-menu-item" || $0.tag == "md-sub-menu-item") && $0.properties["headline"]?.string == target }), let r = m(n.id)?.bounds else { return nil }
        return .init(x: r.midX, y: r.midY)
    }
    static func webName(_ id: String?) -> String {
        guard let id else { return "" }
        if let n = all.first(where: { $0.id == id }), n.tag != "#anchor" {
            let h: String = n.properties["headline"]?.string ?? ""
            let hid: String = n.properties["htmlId"]?.string ?? ""
            let idPart: String = hid.isEmpty ? "" : "#" + hid
            let headPart: String = h.isEmpty ? "" : "[" + h + "]"
            return n.tag + idPart + headPart
        }
        return "button#" + id
    }
    static func sample() -> MenuSample {
        var menus: [(open: Bool, closing: Bool, opacity: Double, scaleY: Double, rect: CGRect)] = []
        for n in all where n.tag == "md-menu" {
            let c: AWCMenuController? = state.registry.controllers[n.id]
            let motion: [String: AWCValue]? = motionMetrics(n.id)
            let surface: CGRect = m(n.id, "surface")?.bounds ?? .zero
            let open: Bool = c?.isOpen ?? false
            let closing: Bool = c?.closing ?? false
            let p: Double = open ? (motion?["progress"]?.number ?? 0) : 0
            let sy: Double = open ? (motion?["scaleY"]?.number ?? 0.8) : (state.reduced ? 1 : 0.8)
            let h: CGFloat = surface.height * CGFloat(sy)
            menus.append((open: open, closing: closing, opacity: p, scaleY: sy, rect: CGRect(x: surface.minX, y: surface.minY, width: surface.width, height: h)))
        }
        let responder = (window.firstResponder as? NSView).flatMap { v -> String? in let id = v.accessibilityIdentifier(); return id.isEmpty ? nil : id }
        let rows = all.filter { $0.tag == "md-menu-item" || $0.tag == "md-sub-menu-item" }
        let layers = rows.map { m($0.id)?.metrics["layerOpacity"]?.number ?? 0 }
        let rootOpen = state.registry.controllers["m"]?.isOpen ?? false
        let sub = rows.first { $0.tag == "md-sub-menu-item" }
        let rowExpanded = sub.map { (m($0.id)?.metrics["expanded"]?.bool ?? false) ? "true" : "false" }
        let selected = rows.filter { $0.properties["type"] != nil }.map { r -> Bool in
            if let v = m(r.id)?.metrics["selected"]?.bool { return v }
            for c in state.registry.controllers.values { if let v = c.selection[r.id] { return v } }
            return r.properties["selected"]?.bool ?? false
        }
        return .init(t: now(), menus: menus, focus: webName(responder), layers: layers,
                     anchorExpanded: rootOpen ? "true" : "false", rowExpanded: rowExpanded, selected: selected)
    }
    static func act(_ a: AWCValue) {
        switch a["kind"].string {
        case "click", "down", "up", "move":
            let p: CGPoint? = a["point"].array.count == 2 ? CGPoint(x: a["point"].array[0].number ?? 0, y: a["point"].array[1].number ?? 0) : center(a["target"].string)
            guard let p else { check(false, "target \(a["target"].string) not found"); return }
            // Chrome's trusted click: move, press 67 ms later, release 33 ms after that (CDP round trips; the oracle's focusin/click times).
            let begin = now()
            if a["kind"].string == "move" || a["kind"].string == "click" { while now() < begin + 33 { pump(0.002) }; mouse(.mouseMoved, p) }
            if a["kind"].string == "click" { while now() < begin + 67 { pump(0.002) } }
            if a["kind"].string == "click" || a["kind"].string == "down" { mouse(.leftMouseDown, p) }
            if a["kind"].string == "click" { while now() < begin + 100 { pump(0.002) } }
            if a["kind"].string == "click" || a["kind"].string == "up" { mouse(.leftMouseUp, p) }
            // A press on the page outside any control moves the browser's focus to the body.
            if a["point"].array.count == 2 { window.makeFirstResponder(nil) }
        case "key": key(a["key"].string, shift: a["shift"] == .bool(true))
        case "show": state.registry.controllers["m"]?.show(autoFocus: a["autoFocus"] == .bool(false) ? false : nil)
        default: break
        }
    }
    static func grid(_ cg: CGImage, scale: Double, x0: Int, y0: Int, w: Int, h: Int) -> MenuGrid { NativeMenuPaintIntegration.grid(cg, scale: scale, x0: x0, y0: y0, w: w, h: h) }
    static func run(_ r: AWCValue, shots: URL, reduced: Bool) {
        let name = r["name"].string + (reduced ? " (reduced)" : "")
        let vp = r["viewport"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        mouse(.mouseMoved, .init(x: 1, y: 1))
        state.registry = AWCMenuRegistry(); state.pointer = AWCNativePointerState(); state.reduced = reduced; events = []
        nodes = MenuPaintFixture.nodes(r)
        state.c = r; state.epoch += 1; pump(0.5)
        if r["focusAnchor"] == .bool(true) { _ = state.registry.anchorFocus["a"]?(); pump(0.05) }
        t0 = CACurrentMediaTime() * 1000
        var phaseSamples: [[MenuSample]] = [], phaseStarts: [Double] = [], phaseShots: [[NSBitmapImageRep]] = [], phaseShotTimes: [[Double]] = []
        let phases = r["phases"].array
        for (i, p) in phases.enumerated() {
            let start = p["t"].number ?? 0
            let lastWeb = p["samples"].array.last?["t"].number ?? start
            let duration = p["ms"].number ?? (lastWeb - start + 17)
            while now() < start { pump(0.002) }
            let actualStart = now()
            var samples: [MenuSample] = []
            var first = sample(); first.t -= actualStart; samples.append(first)   // the state the step starts from
            act(p["act"])
            // Chrome's phase screenshot is captured after the last sampled frame and before the next phase starts
            // (Page.captureScreenshot waits for a new compositor frame; the oracle records no capture time). The native
            // run shoots every frame across that window and the pixel check uses the matching frame.
            var shotTimes: [Double] = []
            var at = lastWeb - start + 17
            while at < duration - 8 { shotTimes.append(at); at += 16 }
            shotTimes.append(duration)
            var shots: [NSBitmapImageRep] = [], taken: [Double] = []
            // Only the clip is rendered for a shot (a full-window cache takes several frames).
            let clipTop = MenuPaintFixture.rect(p["clip"]).intersection(host.bounds)
            let clipRect = host.isFlipped ? clipTop : CGRect(x: clipTop.minX, y: host.bounds.height - clipTop.maxY, width: clipTop.width, height: clipTop.height)
            while now() < actualStart + duration || shots.count < shotTimes.count {
                pump(0.004); var s = sample(); s.t -= actualStart; samples.append(s)
                if shots.count < shotTimes.count && now() >= actualStart + shotTimes[shots.count] {
                    let t = now() - actualStart
                    let b = host.bitmapImageRepForCachingDisplay(in: clipRect)!; host.cacheDisplay(in: clipRect, to: b); shots.append(b); taken.append(t)
                }
            }
            phaseSamples.append(samples); phaseStarts.append(actualStart)
            phaseShots.append(shots); phaseShotTimes.append(taken)
        }
        for (i, p) in phases.enumerated() { compare(name, p, phaseSamples[i], shot: phaseShots[i], times: phaseShotTimes[i], shots: shots, run: r["name"].string, phase: i) }
        // md* events: order, target kind and time relative to the phase that contains them.
        let webEvents = r["events"].array.filter { e in (e["t"].number ?? 0) <= (phases.last?["samples"].array.last?["t"].number ?? 0) + 20 }
        let names = events.map(\.name), webNames = webEvents.map { $0["name"].string }
        check(names == webNames, "\(name) events \(names) vs \(webNames)")
        if ProcessInfo.processInfo.environment["AWC_MENU_EVENTS"] != nil { print("events \(name): native \(events.map { "\($0.name)@\(Int($0.t))" }) web \(webEvents.map { "\($0["name"].string)@\(Int($0["t"].number ?? 0))" })") }
        if names == webNames {
            // Time within the phase that contains the event (native phases start later when rendering is slow).
            func rel(_ t: Double, _ starts: [Double]) -> (Int, Double) { let i = max(0, (starts.lastIndex { $0 <= t + 1 }) ?? 0); return (i, t - starts[i]) }
            let webStarts = phases.map { $0["t"].number ?? 0 }
            for (e, w) in zip(events, webEvents) {
                let n = rel(e.t, phaseStarts), wv = rel(w["t"].number ?? 0, webStarts)
                check(n.0 == wv.0 && abs(n.1 - wv.1) <= 60, "\(name) \(e.name) in phase \(n.0) at +\(Int(n.1)) vs phase \(wv.0) at +\(Int(wv.1)) ms")
            }
        }
        report.append(["run": name, "phases": phases.count, "events": names, "pixelShot": shotIndices]); shotIndices = []
        print("run \(name): \(checks - failures.count)/\(checks)"); fflush(stdout)
        for c in state.registry.controllers.values where c.isOpen { c.model.quick = true; c.close() }; pump(0.4); events = []
    }
    static func compare(_ name: String, _ p: AWCValue, _ samples: [MenuSample], shot candidates: [NSBitmapImageRep], times: [Double], shots: URL, run: String, phase: Int) {
        let label = p["label"].string, web = p["samples"].array
        guard let end = samples.last, let w = web.last else { check(false, "\(name) \(label) no samples"); return }
        let tag = "\(name) \(label)"
        // Phase-end state.
        let wm = w["menus"].array
        check(wm.count == end.menus.count, "\(tag) menu count \(end.menus.count) vs \(wm.count)")
        for (i, (nm, wmn)) in zip(end.menus, wm).enumerated() {
            check(nm.open == (wmn["open"] == .bool(true)), "\(tag) menu \(i) open \(nm.open)")
            check(nm.closing == (wmn["closing"] == .bool(true)), "\(tag) menu \(i) closing \(nm.closing)")
            if wmn["open"] == .bool(true) {
                check(abs(nm.opacity - (wmn["opacity"].number ?? 0)) <= 0.02, "\(tag) menu \(i) opacity \(nm.opacity) vs \(wmn["opacity"].number ?? -1)")
                let r = CGRect(x: wmn["x"].number ?? 0, y: wmn["y"].number ?? 0, width: wmn["w"].number ?? 0, height: wmn["h"].number ?? 0)
                check(abs(nm.rect.minX - r.minX) <= 1 && abs(nm.rect.minY - r.minY) <= 1 && abs(nm.rect.width - r.width) <= 1 && abs(nm.rect.height - r.height) <= 1,
                      "\(tag) menu \(i) box \(NativeMenuPaintIntegration.d(nm.rect)) vs \(NativeMenuPaintIntegration.d(r))")
            }
        }
        // "button#run" is the reference page's own Run button: focus left the fixture (Shift+Tab before the first control).
        let webFocus = ["button#run", "body"].contains(w["focus"].string) ? "" : w["focus"].string
        check(end.focus == webFocus, "\(tag) focus \(end.focus) vs \(webFocus)")
        let wl = w["layers"].array.map { $0.number ?? 0 }
        check(wl.count == end.layers.count && zip(wl, end.layers).allSatisfy { abs($0 - $1) <= 0.02 }, "\(tag) layers \(end.layers) vs \(wl)")
        check(end.anchorExpanded == w["anchorExpanded"].string, "\(tag) anchor expanded \(end.anchorExpanded) vs \(w["anchorExpanded"].string)")
        if case .string(let re) = w["rowExpanded"] { check(end.rowExpanded == re, "\(tag) row expanded \(end.rowExpanded ?? "nil") vs \(re)") }
        let ws = w["selected"].array.map { $0 == .bool(true) }
        check(ws == end.selected, "\(tag) selected \(end.selected) vs \(ws)")
        // Motion: every Chrome frame inside the native ±2-frame envelope (opacity, scaleY).
        let start = p["t"].number ?? 0
        // iOS harness: synthesized keys and touches go through UIKit's HID queue and reach the view on a later run-loop turn
        // than their timestamp (one to two frames): the envelope's later side grows by two frames there.
        #if os(iOS)
        let late = 67.0
        #else
        let late = 34.0
        #endif
        var motionChecked = 0, motionBad = 0, worst = ""
        for s in web {
            let t = (s["t"].number ?? 0) - start
            // Native samples inside ±2 frames plus the nearest one on each side: between samples a transition is monotone.
            var near = samples.filter { $0.t >= t - 40 && $0.t <= t + late }
            if let before = samples.last(where: { $0.t < t - 40 }) { near.append(before) }
            if let after = samples.first(where: { $0.t > t + late }) { near.append(after) }
            guard !near.isEmpty else { continue }
            for (i, wmn) in s["menus"].array.enumerated() where i < end.menus.count && wmn["open"] == .bool(true) && (wmn["h"].number ?? 0) > 0 {
                for (key, value) in [("opacity", wmn["opacity"].number ?? 0), ("scaleY", wmn["scaleY"].number ?? 1)] {
                    let vals = near.map { key == "opacity" ? $0.menus[i].opacity : $0.menus[i].scaleY }
                    motionChecked += 1
                    if value < (vals.min() ?? 0) - 0.03 || value > (vals.max() ?? 0) + 0.03 { motionBad += 1; if worst.isEmpty { worst = "\(key) t=\(Int(t)) web \(value) native \(vals.map { String(format: "%.3f", $0) })" } }
                }
            }
        }
        check(motionBad == 0, "\(tag) motion \(motionBad)/\(motionChecked) frames outside the envelope \(worst)")
        // Phase-end pixels.
        let clip = MenuPaintFixture.rect(p["clip"])
        guard let source = NSImage(contentsOf: shots.appendingPathComponent("\(run)-\(label).png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(tag) shot"); return }
        let pw = min(source.width, Int(clip.width)), ph = min(source.height, Int(clip.height))
        let webG = grid(source, scale: 1, x0: 0, y0: 0, w: pw, h: ph)
        var best: (n: Int, bad: Int, sum: Double, worst: Float, at: String, index: Int)?
        for (k, b) in candidates.enumerated() {
            let nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / max(1, Double(clip.intersection(host.bounds).width)), x0: 0, y0: 0, w: pw, h: ph)
            var n = 0, bad = 0, sum = 0.0, worstPx: Float = 0, at = ""
            for py in 1..<max(1, ph - 1) { for px in 1..<max(1, pw - 1) {
                guard webG.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
                let i = (py * pw + px) * 3
                let q = max(abs(webG.v[i] - nat.v[i]), max(abs(webG.v[i + 1] - nat.v[i + 1]), abs(webG.v[i + 2] - nat.v[i + 2])))
                n += 1; sum += Double(max(0, q - 1)); if q > 6 { bad += 1 }
                if q > worstPx { worstPx = q; at = "(\(px + Int(clip.minX)),\(py + Int(clip.minY))) web \(webG.at(px, py)) native \(nat.at(px, py))" }
            } }
            if best == nil || bad < best!.bad || (bad == best!.bad && sum < best!.sum) { best = (n, bad, sum, worstPx, at, k) }
        }
        guard let r = best else { check(false, "\(tag) no native shot"); return }
        if let dir = ProcessInfo.processInfo.environment["AWC_MENU_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? candidates[r.index].representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(run)-\(label)\(state.reduced ? "-reduced" : "").png"))
        }
        shotIndices.append(r.index)
        check(Double(r.bad) / Double(max(1, r.n)) <= 0.005 && r.sum / Double(max(1, r.n)) <= 1.0, "\(tag) flat pixels (shot \(r.index + 1)/\(candidates.count) at +\(times.indices.contains(r.index) ? Int(times[r.index]) : -1) of \(times.map { Int($0) }), mean \(String(format: "%.3f", r.sum / Double(max(1, r.n)))), >6: \(r.bad)/\(r.n), worst \(r.worst) at \(r.at))")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = MenuFirstMouseHost(rootView: MenuStatesFixture(state: state, onEvent: { e in if e.name.hasPrefix("md") { events.append((e.name, now(), e.nodeID)); if ProcessInfo.processInfo.environment["AWC_MENU_EVENTS"] != nil { print("  event \(e.name) \(e.nodeID) t=\(Int(now()))") } } }))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.acceptsMouseMovedEvents = true; window.contentView = host; window.orderFrontRegardless(); pump(0.8)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_MENU_ONLY"]
        for (file, dir, reduced) in [("menu-web-states.json", "menu-web-states", false), ("menu-web-states-reduced.json", "menu-web-states-reduced", true)] {
            if ProcessInfo.processInfo.environment["AWC_MENU_REDUCED"] == (reduced ? "0" : "1") { continue }
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file)))
            for r in oracle["runs"].array where only.map({ o in o.split(separator: ",").contains { r["name"].string.contains($0) } }) ?? true { run(r, shots: fixtures.appendingPathComponent(dir), reduced: reduced) }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_MENU_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Menu native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
/// With the console locked the test app is never active: AppKit treats every click as the window-activating first click, which
/// NSHostingView does not pass to SwiftUI gestures (d4, 2026-11-06). Harness only.
#if canImport(AppKit)
final class MenuFirstMouseHost<Content: View>: NSHostingView<Content> { override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true } }
#else
typealias MenuFirstMouseHost<Content: View> = NSHostingView<Content>
#endif
